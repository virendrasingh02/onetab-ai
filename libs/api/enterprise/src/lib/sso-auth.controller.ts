import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Header,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '@org/api-auth';
import { Public } from '@org/api-common';
import { PrismaService } from '@org/database';
import { MembershipStatus, WorkspaceRole } from '@org/types';
import type { SSOLookupResponse } from '@org/types';
import { ssoRecoveryLoginSchema } from '@org/validation';
import type { Request, Response } from 'express';
import {
  hashToken,
  deriveSecretKey,
  encryptSecret,
  decryptSecret,
} from './crypto-secrets.js';
import { EnterpriseService } from './enterprise.service.js';
import { OidcSsoService } from './oidc-sso.service.js';
import { SamlService } from './saml.service.js';

const REFRESH_COOKIE = 'onetab_rt';
const OIDC_FLOW_COOKIE = 'onetab_oidc_flow';
const SSO_FLOW_TTL_MS = 15 * 60 * 1000;

interface OidcFlowState {
  organizationId: string;
  state: string;
  nonce: string;
  codeVerifier: string;
  returnTo?: string;
  expiresAt: number;
}

@Controller({ path: 'auth/sso', version: '1' })
@Public()
export class SsoAuthController {
  private readonly logger = new Logger(SsoAuthController.name);
  private readonly flowKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly enterpriseService: EnterpriseService,
    private readonly samlService: SamlService,
    private readonly oidcService: OidcSsoService,
    private readonly authService: AuthService,
  ) {
    const secret =
      this.config.get<string>('ENCRYPTION_KEY') ||
      this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.flowKey = deriveSecretKey(secret, 'enterprise-sso-flow-cookie-v1');
  }

  private get webAppUrl(): string {
    const raw =
      this.config.get<string>('WEB_APP_URL') ||
      this.config.get<string>('APP_URL') ||
      'http://localhost:4200';
    return raw.replace(/\/+$/, '');
  }

  private get apiUrl(): string {
    const raw =
      this.config.get<string>('API_URL') ||
      `http://localhost:${this.config.get<number>('PORT', 3000)}/api/v1`;
    return raw.replace(/\/+$/, '');
  }

  /* -------------------------------------------------------------------------- */
  /* SSO Email Lookup                                                           */
  /* -------------------------------------------------------------------------- */

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('lookup')
  async lookupSSO(@Query('email') email?: string): Promise<SSOLookupResponse> {
    if (!email || !email.includes('@')) {
      return { ssoAvailable: false };
    }

    const domain = email.split('@')[1]?.toLowerCase().trim();
    if (!domain) return { ssoAvailable: false };

    const org = await this.prisma.organization.findFirst({
      where: {
        OR: [
          { domain },
          { verifiedDomains: { has: domain } },
        ],
      },
      include: {
        ssoConfigs: {
          where: { isActive: true },
          take: 1,
        },
      },
    });

    const ssoConfig = org?.ssoConfigs[0];
    if (!org || !ssoConfig) {
      return { ssoAvailable: false };
    }

    return {
      ssoAvailable: true,
      organizationId: org.id,
      providerType: ssoConfig.providerType as 'SAML' | 'OIDC',
      idpName: ssoConfig.idpName ?? undefined,
      enforceSso: ssoConfig.enforceSso,
    };
  }

  /* -------------------------------------------------------------------------- */
  /* SAML 2.0 SP Metadata                                                       */
  /* -------------------------------------------------------------------------- */

  @Get('saml/metadata/:orgId')
  @Header('Content-Type', 'application/xml')
  async getSamlMetadata(@Param('orgId') orgId: string): Promise<string> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: { ssoConfigs: true },
    });

    if (!org) {
      throw new NotFoundException('Organization not found.');
    }

    const config = org.ssoConfigs[0];
    const spEntityId = config?.spEntityId || `${this.apiUrl}/auth/sso/saml/metadata/${orgId}`;
    const acsUrl = config?.acsUrl || `${this.apiUrl}/auth/sso/saml/acs/${orgId}`;

    return this.samlService.generateSpMetadata({
      spEntityId,
      acsUrl,
    });
  }

  /* -------------------------------------------------------------------------- */
  /* SAML 2.0 Initiation                                                        */
  /* -------------------------------------------------------------------------- */

  @Get('saml/start')
  async startSaml(
    @Query('organizationId') organizationId: string | undefined,
    @Query('domain') domain: string | undefined,
    @Query('returnTo') returnTo: string | undefined,
    @Res() res: Response,
  ) {
    let orgId = organizationId;
    if (!orgId && domain) {
      const org = await this.prisma.organization.findFirst({
        where: {
          OR: [{ domain }, { verifiedDomains: { has: domain } }],
        },
      });
      orgId = org?.id;
    }

    if (!orgId) {
      throw new BadRequestException('organizationId or domain is required.');
    }

    const config = await this.prisma.sSOConfig.findFirst({
      where: { organizationId: orgId, isActive: true },
    });

    if (!config || config.providerType !== 'SAML' || !config.ssoUrl) {
      throw new BadRequestException('SAML SSO is not configured or active for this organization.');
    }

    const spEntityId = config.spEntityId || `${this.apiUrl}/auth/sso/saml/metadata/${orgId}`;
    const acsUrl = config.acsUrl || `${this.apiUrl}/auth/sso/saml/acs/${orgId}`;

    const relayState = JSON.stringify({
      orgId,
      returnTo: returnTo || '/',
      nonce: hashToken(String(Date.now())),
    });

    const { url } = this.samlService.buildAuthnRequest({
      ssoUrl: config.ssoUrl,
      spEntityId,
      acsUrl,
      relayState: Buffer.from(relayState).toString('base64url'),
      forceAuthn: config.forceAuthn,
    });

    return res.redirect(HttpStatus.FOUND, url);
  }

  /* -------------------------------------------------------------------------- */
  /* SAML 2.0 ACS Callback                                                      */
  /* -------------------------------------------------------------------------- */

  @Post('saml/acs/:orgId')
  async handleSamlAcs(
    @Param('orgId') orgId: string,
    @Body('SAMLResponse') samlResponse: string | undefined,
    @Body('RelayState') relayState: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (!samlResponse) {
      this.logger.warn('SAML ACS received without SAMLResponse.');
      return res.redirect(`${this.webAppUrl}/login?error=saml_invalid_response`);
    }

    const config = await this.prisma.sSOConfig.findFirst({
      where: { organizationId: orgId, isActive: true },
    });

    if (!config || !config.certificate) {
      this.logger.error(`SAML ACS configuration missing certificate for org: ${orgId}`);
      return res.redirect(`${this.webAppUrl}/login?error=sso_config_error`);
    }

    const spEntityId = config.spEntityId || `${this.apiUrl}/auth/sso/saml/metadata/${orgId}`;
    const acsUrl = config.acsUrl || `${this.apiUrl}/auth/sso/saml/acs/${orgId}`;

    let claims;
    try {
      claims = await this.samlService.validateSamlResponse({
        samlResponseBase64: samlResponse,
        certificatePem: config.certificate,
        expectedAudience: spEntityId,
        expectedAcsUrl: acsUrl,
      });
    } catch (err: any) {
      this.logger.error(`SAML validation failed for org ${orgId}: ${err.message}`);
      return res.redirect(`${this.webAppUrl}/login?error=saml_verification_failed`);
    }

    // Parse relay state
    let destination = '/';
    if (relayState) {
      try {
        const decoded = JSON.parse(Buffer.from(relayState, 'base64url').toString('utf8'));
        destination = decoded.returnTo || '/';
      } catch {
        destination = '/';
      }
    }

    // Resolve or provision user
    const outcome = await this.resolveSsoUser(orgId, 'saml', claims.nameId, claims.email, claims.displayName, claims.groups);

    const context = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };

    const sessionResult = await this.authService.signInWithFederatedIdentity(outcome.userId, `saml:${orgId}`, context);

    if ('twoFactor' in sessionResult) {
      const fragment = new URLSearchParams({
        two_factor: sessionResult.twoFactor.challengeToken,
        expires_at: sessionResult.twoFactor.expiresAt,
      });
      return res.redirect(`${this.webAppUrl}/login#${fragment.toString()}`);
    }

    this.setRefreshCookie(res, sessionResult.session);
    return res.redirect(HttpStatus.FOUND, `${this.webAppUrl}${destination.startsWith('/') ? destination : `/${destination}`}`);
  }

  /* -------------------------------------------------------------------------- */
  /* OIDC Initiation & Callback                                                 */
  /* -------------------------------------------------------------------------- */

  @Get('oidc/start')
  async startOidc(
    @Query('organizationId') organizationId: string | undefined,
    @Query('returnTo') returnTo: string | undefined,
    @Res() res: Response,
  ) {
    if (!organizationId) {
      throw new BadRequestException('organizationId is required.');
    }

    const config = await this.prisma.sSOConfig.findFirst({
      where: { organizationId, isActive: true },
    });

    if (!config || config.providerType !== 'OIDC' || !config.oidcIssuer || !config.oidcClientId) {
      throw new BadRequestException('OIDC SSO is not configured or active for this organization.');
    }

    const redirectUri = `${this.apiUrl}/auth/sso/oidc/callback/${organizationId}`;
    const state = hashToken(String(Date.now() + Math.random()));
    const nonce = hashToken(String(Date.now() + Math.random()));

    const { url, codeVerifier } = await this.oidcService.buildAuthorizationUrl({
      issuer: config.oidcIssuer,
      clientId: config.oidcClientId,
      redirectUri,
      state,
      nonce,
      scopes: config.oidcScopes ?? ['openid', 'profile', 'email'],
      authorizationEndpoint: config.oidcAuthorizationEndpoint ?? undefined,
    });

    const flowState: OidcFlowState = {
      organizationId,
      state,
      nonce,
      codeVerifier,
      returnTo: returnTo || '/',
      expiresAt: Date.now() + SSO_FLOW_TTL_MS,
    };

    this.setFlowCookie(res, OIDC_FLOW_COOKIE, encryptSecret(JSON.stringify(flowState), this.flowKey));
    return res.redirect(HttpStatus.FOUND, url);
  }

  @Get('oidc/callback/:orgId')
  async handleOidcCallback(
    @Param('orgId') orgId: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    if (error) {
      this.logger.warn(`OIDC provider returned error: ${error}`);
      return res.redirect(`${this.webAppUrl}/login?error=oidc_provider_error`);
    }

    const rawFlow = req.cookies?.[OIDC_FLOW_COOKIE];
    this.clearCookie(res, OIDC_FLOW_COOKIE);

    let flow: OidcFlowState | null;
    try {
      const plain = typeof rawFlow === 'string' ? decryptSecret(rawFlow, this.flowKey) : null;
      flow = plain ? JSON.parse(plain) : null;
    } catch {
      flow = null;
    }

    if (!flow || flow.organizationId !== orgId || flow.state !== state || flow.expiresAt <= Date.now()) {
      this.logger.warn(`OIDC state mismatch for org: ${orgId}`);
      return res.redirect(`${this.webAppUrl}/login?error=oauth_state_mismatch`);
    }

    if (!code) {
      return res.redirect(`${this.webAppUrl}/login?error=oauth_invalid_code`);
    }

    const config = await this.prisma.sSOConfig.findFirst({
      where: { organizationId: orgId, isActive: true },
    });

    if (!config || !config.oidcIssuer || !config.oidcClientId) {
      return res.redirect(`${this.webAppUrl}/login?error=sso_config_error`);
    }

    const clientSecret = this.enterpriseService.getDecryptedOidcClientSecret(config);
    const redirectUri = `${this.apiUrl}/auth/sso/oidc/callback/${orgId}`;

    let claims;
    try {
      claims = await this.oidcService.exchangeCode({
        issuer: config.oidcIssuer,
        clientId: config.oidcClientId,
        clientSecret: clientSecret ?? undefined,
        redirectUri,
        code,
        codeVerifier: flow.codeVerifier,
        nonce: flow.nonce,
        tokenEndpoint: config.oidcTokenEndpoint ?? undefined,
        jwksUri: config.oidcJwksUri ?? undefined,
      });
    } catch (err: any) {
      this.logger.error(`OIDC code exchange failed: ${err.message}`);
      return res.redirect(`${this.webAppUrl}/login?error=oidc_token_failed`);
    }

    const outcome = await this.resolveSsoUser(
      orgId,
      'oidc',
      claims.sub,
      claims.email,
      claims.displayName,
      claims.groups,
    );

    const context = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };

    const sessionResult = await this.authService.signInWithFederatedIdentity(outcome.userId, `oidc:${orgId}`, context);

    if ('twoFactor' in sessionResult) {
      const fragment = new URLSearchParams({
        two_factor: sessionResult.twoFactor.challengeToken,
        expires_at: sessionResult.twoFactor.expiresAt,
      });
      return res.redirect(`${this.webAppUrl}/login#${fragment.toString()}`);
    }

    this.setRefreshCookie(res, sessionResult.session);
    const destination = flow.returnTo || '/';
    return res.redirect(HttpStatus.FOUND, `${this.webAppUrl}${destination.startsWith('/') ? destination : `/${destination}`}`);
  }

  /* -------------------------------------------------------------------------- */
  /* Emergency Break-Glass Recovery Login                                       */
  /* -------------------------------------------------------------------------- */

  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @Post('recovery-login')
  async recoveryLogin(
    @Body() body: unknown,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { email, recoveryCode } = ssoRecoveryLoginSchema.parse(body);
    const cleanEmail = email.toLowerCase().trim();

    const domain = cleanEmail.split('@')[1];
    const org = await this.prisma.organization.findFirst({
      where: {
        OR: [{ domain }, { verifiedDomains: { has: domain } }],
      },
      include: {
        workspaces: {
          include: {
            members: {
              where: { user: { email: cleanEmail } },
              include: { user: true },
            },
          },
        },
      },
    });

    if (!org) {
      throw new UnauthorizedException('No organization found matching this email domain.');
    }

    // Verify user is an ADMIN or OWNER in at least one workspace of this organization
    let authorizedUser: any = null;
    for (const workspace of org.workspaces) {
      const member = workspace.members[0];
      if (member && (member.role === WorkspaceRole.ADMIN || member.role === WorkspaceRole.OWNER)) {
        authorizedUser = member.user;
        break;
      }
    }

    if (!authorizedUser) {
      throw new ForbiddenException('Break-glass emergency recovery is restricted to organization administrators.');
    }

    const isValid = await this.enterpriseService.verifyRecoveryLogin(org.id, recoveryCode);
    if (!isValid) {
      await this.enterpriseService.logAuditEvent(org.id, cleanEmail, 'RECOVERY_LOGIN_FAILED', `User:${authorizedUser.id}`, {
        ip: req.ip,
      });
      throw new UnauthorizedException('Invalid recovery code.');
    }

    await this.enterpriseService.logAuditEvent(org.id, cleanEmail, 'RECOVERY_LOGIN_SUCCESS', `User:${authorizedUser.id}`, {
      ip: req.ip,
    });

    const context = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };

    const sessionResult = await this.authService.signInWithFederatedIdentity(authorizedUser.id, 'recovery', context);
    if ('twoFactor' in sessionResult) {
      return sessionResult.twoFactor;
    }

    this.setRefreshCookie(res, sessionResult.session);
    return {
      user: sessionResult.user,
      ...sessionResult.session.tokens,
      refreshToken: sessionResult.session.refreshToken,
    };
  }

  /* -------------------------------------------------------------------------- */
  /* User Resolution & Safe Account Linking                                     */
  /* -------------------------------------------------------------------------- */

  private async resolveSsoUser(
    orgId: string,
    protocol: 'saml' | 'oidc',
    subjectId: string,
    email: string,
    displayName?: string,
    groups: string[] = [],
  ): Promise<{ userId: string }> {
    const cleanEmail = email.toLowerCase().trim();
    const providerKey = `${protocol}:${orgId}`;

    // 1. Check existing UserIdentity
    const existingIdentity = await this.prisma.userIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: providerKey,
          providerUserId: subjectId,
        },
      },
      include: { user: true },
    });

    let userId: string;

    if (existingIdentity) {
      userId = existingIdentity.userId;
      // Ensure email verified
      if (!existingIdentity.user.emailVerifiedAt) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { emailVerifiedAt: new Date() },
        });
      }
    } else {
      // The IdP is asserted by the tenant, so its email claim is only trusted
      // for domains that tenant has verified. Otherwise a tenant could mint a
      // login for any other tenant's (or consumer) account.
      const org = await this.prisma.organization.findUnique({
        where: { id: orgId },
        select: { domain: true, verifiedDomains: true },
      });
      const emailDomain = cleanEmail.split('@')[1] ?? '';
      const owned = [org?.domain, ...(org?.verifiedDomains ?? [])]
        .filter((d): d is string => !!d)
        .map((d) => d.toLowerCase());
      if (!emailDomain || !owned.includes(emailDomain)) {
        throw new ForbiddenException(
          'This email domain is not verified for your organization.',
        );
      }

      // 2. Safe account linking: find existing user by email
      let user = await this.prisma.user.findUnique({
        where: { email: cleanEmail },
      });

      if (user) {
        userId = user.id;
        if (!user.emailVerifiedAt) {
          await this.prisma.user.update({
            where: { id: userId },
            data: { emailVerifiedAt: new Date() },
          });
        }
      } else {
        // Provision new user
        user = await this.prisma.user.create({
          data: {
            email: cleanEmail,
            name: displayName || cleanEmail.split('@')[0],
            emailVerifiedAt: new Date(),
            passwordHash: '$2b$10$sso_federated_user_placeholder',
          },
        });
        userId = user.id;
      }

      // Link UserIdentity
      await this.prisma.userIdentity.upsert({
        where: {
          provider_providerUserId: {
            provider: providerKey,
            providerUserId: subjectId,
          },
        },
        create: {
          userId,
          provider: providerKey,
          providerUserId: subjectId,
          email: cleanEmail,
        },
        update: {
          email: cleanEmail,
        },
      });
    }

    // 3. Ensure workspace membership in org workspaces and apply role mappings
    await this.ensureWorkspaceMembershipAndRoles(orgId, userId, groups);

    return { userId };
  }

  private async ensureWorkspaceMembershipAndRoles(orgId: string, userId: string, groups: string[]): Promise<void> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        workspaces: { orderBy: { createdAt: 'asc' }, take: 10 },
        groupRoleMappings: true,
      },
    });

    if (!org || org.workspaces.length === 0) return;

    // Determine target role from group mappings (highest privilege wins)
    let assignedRole: WorkspaceRole = WorkspaceRole.MEMBER;
    for (const mapping of org.groupRoleMappings) {
      if (groups.includes(mapping.groupName)) {
        if (mapping.targetRole === WorkspaceRole.OWNER) {
          assignedRole = WorkspaceRole.OWNER;
        } else if (mapping.targetRole === WorkspaceRole.ADMIN && assignedRole !== WorkspaceRole.OWNER) {
          assignedRole = WorkspaceRole.ADMIN;
        }
      }
    }

    // Ensure member of primary workspace
    const primaryWorkspace = org.workspaces[0];
    if (primaryWorkspace) {
      await this.prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: primaryWorkspace.id,
            userId,
          },
        },
        create: {
          workspaceId: primaryWorkspace.id,
          userId,
          role: assignedRole,
          status: MembershipStatus.ACTIVE,
        },
        update: {
          status: MembershipStatus.ACTIVE,
          ...(assignedRole !== WorkspaceRole.MEMBER ? { role: assignedRole } : {}),
        },
      });
    }
  }

  /* -------------------------------------------------------------------------- */
  /* Cookie Helpers                                                             */
  /* -------------------------------------------------------------------------- */

  private setRefreshCookie(res: Response, session: any): void {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    res.cookie(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/api/v1/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  private setFlowCookie(res: Response, cookieName: string, value: string): void {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    res.cookie(cookieName, value, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/api/v1/auth/sso',
      maxAge: SSO_FLOW_TTL_MS,
    });
  }

  private clearCookie(res: Response, cookieName: string): void {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';
    res.clearCookie(cookieName, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/api/v1/auth/sso',
    });
  }
}
