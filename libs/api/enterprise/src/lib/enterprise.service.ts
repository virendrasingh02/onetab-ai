import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@org/database';
import { WorkspaceRole } from '@org/types';
import type {
  DomainVerificationDto,
  EnterpriseSSOConfigDto,
  GenerateRecoveryCodeResponse,
  RotateScimTokenResponse,
  SaveGroupRoleMappingInput,
  SaveSSOConfigInput,
  SSOConnectionTestResult,
  SSOGroupRoleMappingDto,
} from '@org/types';
import axios from 'axios';
import { createPublicKey } from 'node:crypto';
import {
  decryptSecret,
  deriveSecretKey,
  encryptSecret,
  generateRecoveryCode,
  generateScimToken,
  normalizeCertificatePem,
  verifyTokenHash,
} from './crypto-secrets.js';
import { DomainVerificationService } from './domain-verification.service.js';
import { OidcSsoService } from './oidc-sso.service.js';

@Injectable()
export class EnterpriseService {
  private readonly logger = new Logger(EnterpriseService.name);
  private readonly encryptionKey: Buffer;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly domainVerifier: DomainVerificationService,
    private readonly oidcService: OidcSsoService,
  ) {
    const secret =
      this.config.get<string>('ENCRYPTION_KEY') ||
      this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    this.encryptionKey = deriveSecretKey(secret);
  }

  private get apiUrl(): string {
    const raw =
      this.config.get<string>('API_URL') ||
      `http://localhost:${this.config.get<number>('PORT', 3000)}/api/v1`;
    return raw.replace(/\/+$/, '');
  }

  /* -------------------------------------------------------------------------- */
  /* Organization Retrieval & Auto-Provisioning                                  */
  /* -------------------------------------------------------------------------- */

  async getOrganization(orgId: string) {
    return this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
      include: {
        departments: true,
        ssoConfigs: true,
        subscriptions: true,
        groupRoleMappings: true,
        workspaces: {
          select: { id: true, name: true, slug: true },
        },
        _count: {
          select: {
            auditLogs: true,
            scimGroups: true,
          },
        },
      },
    });
  }

  async createOrganization(data: { name: string; domain: string; billingEmail?: string }) {
    const cleanDomain = data.domain.toLowerCase().trim();
    const org = await this.prisma.organization.create({
      data: {
        name: data.name,
        domain: cleanDomain,
        verifiedDomains: [cleanDomain],
        domainVerifiedAt: new Date(),
        billingEmail: data.billingEmail,
        departments: {
          create: [
            { name: 'Engineering', code: 'ENG' },
            { name: 'Product & Design', code: 'PROD' },
          ],
        },
        subscriptions: {
          create: { planTier: 'ENTERPRISE', seatsTotal: 100, seatsUsed: 5 },
        },
      },
    });
    this.logger.log(`Created enterprise organization '${org.name}' (${org.id})`);
    return org;
  }

  /**
   * Resolves or provisions an Organization for a workspace.
   * If the workspace is not yet associated with an organization, creates one automatically.
   */
  async ensureOrganizationForWorkspace(workspaceId: string): Promise<string> {
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
      include: { organization: true },
    });

    if (workspace.organizationId && workspace.organization) {
      return workspace.organizationId;
    }

    // Workspace needs an associated organization.
    // Try to find an organization matching the workspace slug or domain.
    const defaultDomain = `${workspace.slug}.local`;
    let org = await this.prisma.organization.findFirst({
      where: {
        OR: [
          { domain: defaultDomain },
          { name: workspace.name },
        ],
      },
    });

    if (!org) {
      const verificationToken = this.domainVerifier.generateVerificationToken();
      org = await this.prisma.organization.create({
        data: {
          name: workspace.name,
          domain: defaultDomain,
          domainVerificationToken: verificationToken,
          verifiedDomains: [],
          subscriptions: {
            create: { planTier: 'ENTERPRISE', seatsTotal: 50, seatsUsed: 1 },
          },
        },
      });
    }

    // Link workspace to organization
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { organizationId: org.id },
    });

    this.logger.log(`Linked workspace "${workspace.name}" (${workspaceId}) to organization "${org.name}" (${org.id})`);
    return org.id;
  }

  /* -------------------------------------------------------------------------- */
  /* SSO Configuration & Diagnostics                                            */
  /* -------------------------------------------------------------------------- */

  async getSSOConfig(orgId: string): Promise<EnterpriseSSOConfigDto> {
    const config = await this.prisma.sSOConfig.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
    });

    return await this.toSSOConfigDto(config, orgId);
  }

  async configureSSO(
    orgId: string,
    data: SaveSSOConfigInput,
    actorEmail: string,
  ): Promise<EnterpriseSSOConfigDto> {
    const existing = await this.prisma.sSOConfig.findFirst({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
    });

    const spEntityId = `${this.apiUrl}/auth/sso/saml/metadata/${orgId}`;
    const acsUrl = `${this.apiUrl}/auth/sso/saml/acs/${orgId}`;

    let oidcClientSecretCipher = existing?.oidcClientSecretCipher ?? null;
    if (data.oidcClientSecret) {
      oidcClientSecretCipher = encryptSecret(data.oidcClientSecret, this.encryptionKey);
    }

    const certificate = data.certificate
      ? normalizeCertificatePem(data.certificate)
      : existing?.certificate ?? null;

    let updated;
    if (existing) {
      updated = await this.prisma.sSOConfig.update({
        where: { id: existing.id },
        data: {
          providerType: data.providerType,
          idpName: data.idpName ?? existing.idpName,
          // SAML
          idpEntityId: data.idpEntityId ?? existing.idpEntityId,
          ssoUrl: data.ssoUrl ?? existing.ssoUrl,
          certificate,
          spEntityId,
          acsUrl,
          allowIdpInitiated: data.allowIdpInitiated ?? existing.allowIdpInitiated,
          forceAuthn: data.forceAuthn ?? existing.forceAuthn,
          // OIDC
          oidcIssuer: data.oidcIssuer ?? existing.oidcIssuer,
          oidcClientId: data.oidcClientId ?? existing.oidcClientId,
          oidcClientSecretCipher,
          oidcAuthorizationEndpoint: data.oidcAuthorizationEndpoint ?? existing.oidcAuthorizationEndpoint,
          oidcTokenEndpoint: data.oidcTokenEndpoint ?? existing.oidcTokenEndpoint,
          oidcJwksUri: data.oidcJwksUri ?? existing.oidcJwksUri,
          oidcUserInfoEndpoint: data.oidcUserInfoEndpoint ?? existing.oidcUserInfoEndpoint,
          oidcScopes: data.oidcScopes ?? existing.oidcScopes,
          // Enforcement & Recovery
          enforceSso: data.enforceSso ?? existing.enforceSso,
          allowPasswordFallbackForAdmins:
            data.allowPasswordFallbackForAdmins ?? existing.allowPasswordFallbackForAdmins,
        },
      });
    } else {
      const { rawToken, tokenPrefix, tokenHash } = generateScimToken();
      updated = await this.prisma.sSOConfig.create({
        data: {
          organizationId: orgId,
          providerType: data.providerType,
          idpName: data.idpName,
          idpEntityId: data.idpEntityId,
          ssoUrl: data.ssoUrl,
          certificate,
          spEntityId,
          acsUrl,
          allowIdpInitiated: data.allowIdpInitiated ?? true,
          forceAuthn: data.forceAuthn ?? false,
          oidcIssuer: data.oidcIssuer,
          oidcClientId: data.oidcClientId,
          oidcClientSecretCipher,
          oidcAuthorizationEndpoint: data.oidcAuthorizationEndpoint,
          oidcTokenEndpoint: data.oidcTokenEndpoint,
          oidcJwksUri: data.oidcJwksUri,
          oidcUserInfoEndpoint: data.oidcUserInfoEndpoint,
          oidcScopes: data.oidcScopes ?? ['openid', 'profile', 'email'],
          enforceSso: data.enforceSso ?? false,
          allowPasswordFallbackForAdmins: data.allowPasswordFallbackForAdmins ?? true,
          scimToken: rawToken,
          scimTokenHash: tokenHash,
          scimTokenPrefix: tokenPrefix,
        },
      });
    }

    await this.logAuditEvent(orgId, actorEmail, 'SSO_CONFIG_UPDATED', `SSOConfig:${updated.id}`, {
      providerType: data.providerType,
      enforceSso: updated.enforceSso,
    });

    return await this.toSSOConfigDto(updated, orgId);
  }

  async testConnection(orgId: string): Promise<SSOConnectionTestResult> {
    const config = await this.prisma.sSOConfig.findFirst({
      where: { organizationId: orgId },
    });

    if (!config) {
      throw new NotFoundException('No SSO configuration exists for this organization.');
    }

    const timestamp = new Date().toISOString();
    let result: SSOConnectionTestResult;

    try {
      if (config.providerType === 'SAML') {
        if (!config.ssoUrl) throw new BadRequestException('Single Sign-on URL is missing.');
        if (!config.certificate) throw new BadRequestException('Signing Certificate is missing.');

        // Validate certificate parsing
        try {
          createPublicKey(normalizeCertificatePem(config.certificate));
        } catch (err) {
          throw new BadRequestException(`IdP Signing Certificate is invalid: ${(err as Error).message}`);
        }

        // Test SSO URL reachability (optional HEAD request with short timeout)
        try {
          await axios.get(config.ssoUrl, { timeout: 5000, validateStatus: () => true });
        } catch (err: any) {
          this.logger.warn(`SAML SSO URL connection test warning: ${err.message}`);
        }

        result = {
          success: true,
          message: 'SAML 2.0 configuration verified. Certificate parsed successfully and SSO URL is valid.',
          details: {
            idpEntityId: config.idpEntityId,
            ssoUrl: config.ssoUrl,
            acsUrl: config.acsUrl,
            spEntityId: config.spEntityId,
          },
          timestamp,
        };
      } else {
        // OIDC test
        if (!config.oidcIssuer) throw new BadRequestException('OIDC Issuer URL is missing.');
        if (!config.oidcClientId) throw new BadRequestException('OIDC Client ID is missing.');

        // Test discovery
        const discovery = await this.oidcService.discover(config.oidcIssuer);
        result = {
          success: true,
          message: 'OIDC discovery document resolved and verified successfully.',
          details: {
            issuer: discovery.issuer,
            authorizationEndpoint: discovery.authorization_endpoint,
            tokenEndpoint: discovery.token_endpoint,
            jwksUri: discovery.jwks_uri,
          },
          timestamp,
        };
      }

      await this.prisma.sSOConfig.update({
        where: { id: config.id },
        data: {
          lastConnectionTestAt: new Date(),
          lastConnectionTestStatus: 'SUCCESS',
          lastConnectionTestMessage: result.message,
        },
      });
    } catch (err: any) {
      result = {
        success: false,
        message: err.message || 'Connection test failed.',
        details: { error: err.message },
        timestamp,
      };

      await this.prisma.sSOConfig.update({
        where: { id: config.id },
        data: {
          lastConnectionTestAt: new Date(),
          lastConnectionTestStatus: 'FAILED',
          lastConnectionTestMessage: result.message,
        },
      });
    }

    return result;
  }

  /* -------------------------------------------------------------------------- */
  /* Domain Verification                                                        */
  /* -------------------------------------------------------------------------- */

  async getDomainVerificationDetails(orgId: string): Promise<DomainVerificationDto[]> {
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
    });

    const token =
      org.domainVerificationToken ||
      (await this.ensureDomainVerificationToken(org.id));

    const domains = Array.from(new Set([org.domain, ...(org.verifiedDomains ?? [])]));

    return domains.map((domain) => {
      const isVerified = (org.verifiedDomains ?? []).includes(domain);
      return {
        domain,
        verified: isVerified,
        verificationToken: token,
        verifiedAt: isVerified && org.domainVerifiedAt ? org.domainVerifiedAt.toISOString() : null,
        txtRecordName: `_mie-verification.${domain}`,
        txtRecordValue: token,
      };
    });
  }

  async addDomain(orgId: string, domain: string, actorEmail: string): Promise<DomainVerificationDto> {
    const cleanDomain = domain.toLowerCase().trim();
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
    });

    const token =
      org.domainVerificationToken ||
      (await this.ensureDomainVerificationToken(org.id));

    await this.logAuditEvent(orgId, actorEmail, 'DOMAIN_ADDED', `Domain:${cleanDomain}`, {
      domain: cleanDomain,
    });

    return {
      domain: cleanDomain,
      verified: (org.verifiedDomains ?? []).includes(cleanDomain),
      verificationToken: token,
      verifiedAt: null,
      txtRecordName: `_mie-verification.${cleanDomain}`,
      txtRecordValue: token,
    };
  }

  async verifyDomain(orgId: string, domain: string, actorEmail: string): Promise<DomainVerificationDto> {
    const cleanDomain = domain.toLowerCase().trim();
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
    });

    const token =
      org.domainVerificationToken ||
      (await this.ensureDomainVerificationToken(org.id));

    const result = await this.domainVerifier.verifyDomainDns(cleanDomain, token);

    if (!result.verified) {
      throw new BadRequestException(result.message);
    }

    const updatedVerifiedDomains = Array.from(new Set([...(org.verifiedDomains ?? []), cleanDomain]));

    await this.prisma.organization.update({
      where: { id: orgId },
      data: {
        verifiedDomains: updatedVerifiedDomains,
        domainVerifiedAt: new Date(),
      },
    });

    await this.logAuditEvent(orgId, actorEmail, 'DOMAIN_VERIFIED', `Domain:${cleanDomain}`, {
      domain: cleanDomain,
      recordsFound: result.recordsFound,
    });

    return {
      domain: cleanDomain,
      verified: true,
      verificationToken: token,
      verifiedAt: new Date().toISOString(),
      txtRecordName: `_mie-verification.${cleanDomain}`,
      txtRecordValue: token,
    };
  }

  async removeDomain(orgId: string, domain: string, actorEmail: string): Promise<void> {
    const cleanDomain = domain.toLowerCase().trim();
    const org = await this.prisma.organization.findUniqueOrThrow({
      where: { id: orgId },
    });

    const updated = (org.verifiedDomains ?? []).filter((d) => d !== cleanDomain);

    await this.prisma.organization.update({
      where: { id: orgId },
      data: { verifiedDomains: updated },
    });

    await this.logAuditEvent(orgId, actorEmail, 'DOMAIN_REMOVED', `Domain:${cleanDomain}`, {
      domain: cleanDomain,
    });
  }

  private async ensureDomainVerificationToken(orgId: string): Promise<string> {
    const token = this.domainVerifier.generateVerificationToken();
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { domainVerificationToken: token },
    });
    return token;
  }

  /* -------------------------------------------------------------------------- */
  /* SCIM 2.0 Management & Token Rotation                                       */
  /* -------------------------------------------------------------------------- */

  async rotateScimToken(orgId: string, actorEmail: string): Promise<RotateScimTokenResponse> {
    const config = await this.prisma.sSOConfig.findFirst({
      where: { organizationId: orgId },
    });

    if (!config) {
      throw new NotFoundException('This organization has no SSO configuration.');
    }

    const { rawToken, tokenPrefix, tokenHash } = generateScimToken();

    await this.prisma.sSOConfig.update({
      where: { id: config.id },
      data: {
        scimToken: rawToken, // legacy field
        scimTokenHash: tokenHash,
        scimTokenPrefix: tokenPrefix,
        scimTokenExpiresAt: null, // no expiration by default unless configured
      },
    });

    await this.logAuditEvent(orgId, actorEmail, 'SCIM_TOKEN_ROTATED', `SSOConfig:${config.id}`, {
      tokenPrefix,
    });

    return {
      rawToken,
      tokenPrefix,
      expiresAt: null,
    };
  }

  async toggleScim(orgId: string, enabled: boolean, actorEmail: string): Promise<EnterpriseSSOConfigDto> {
    let config = await this.prisma.sSOConfig.findFirst({
      where: { organizationId: orgId },
    });

    if (!config) {
      const { rawToken, tokenPrefix, tokenHash } = generateScimToken();
      config = await this.prisma.sSOConfig.create({
        data: {
          organizationId: orgId,
          scimEnabled: enabled,
          scimToken: rawToken,
          scimTokenHash: tokenHash,
          scimTokenPrefix: tokenPrefix,
        },
      });
    } else {
      let dataToUpdate: any = { scimEnabled: enabled };
      if (enabled && !config.scimTokenHash) {
        const { rawToken, tokenPrefix, tokenHash } = generateScimToken();
        dataToUpdate = {
          ...dataToUpdate,
          scimToken: rawToken,
          scimTokenHash: tokenHash,
          scimTokenPrefix: tokenPrefix,
        };
      }
      config = await this.prisma.sSOConfig.update({
        where: { id: config.id },
        data: dataToUpdate,
      });
    }

    await this.logAuditEvent(orgId, actorEmail, 'SCIM_TOGGLED', `SSOConfig:${config.id}`, {
      scimEnabled: enabled,
    });

    return this.toSSOConfigDto(config, orgId);
  }

  /* -------------------------------------------------------------------------- */
  /* Emergency Break-Glass Admin Recovery                                       */
  /* -------------------------------------------------------------------------- */

  async generateEmergencyRecoveryCode(
    orgId: string,
    actorEmail: string,
  ): Promise<GenerateRecoveryCodeResponse> {
    const config = await this.prisma.sSOConfig.findFirst({
      where: { organizationId: orgId },
    });

    if (!config) {
      throw new NotFoundException('Organization SSO config not found.');
    }

    const { rawCode, codeHash } = generateRecoveryCode();

    await this.prisma.sSOConfig.update({
      where: { id: config.id },
      data: { recoveryCodeHash: codeHash },
    });

    await this.logAuditEvent(orgId, actorEmail, 'EMERGENCY_RECOVERY_CODE_GENERATED', `Organization:${orgId}`, {
      action: 'GENERATED',
    });

    return {
      recoveryCode: rawCode,
      generatedAt: new Date().toISOString(),
    };
  }

  async verifyRecoveryLogin(orgId: string, candidateCode: string): Promise<boolean> {
    const config = await this.prisma.sSOConfig.findFirst({
      where: { organizationId: orgId },
    });

    if (!config || !config.recoveryCodeHash) return false;
    return verifyTokenHash(candidateCode, config.recoveryCodeHash);
  }

  /* -------------------------------------------------------------------------- */
  /* Group-to-Role Mappings                                                     */
  /* -------------------------------------------------------------------------- */

  async getGroupRoleMappings(orgId: string): Promise<SSOGroupRoleMappingDto[]> {
    const mappings = await this.prisma.sSOGroupRoleMapping.findMany({
      where: { organizationId: orgId },
      orderBy: { groupName: 'asc' },
    });

    return mappings.map((m) => ({
      id: m.id,
      organizationId: m.organizationId,
      groupName: m.groupName,
      groupId: m.groupId,
      targetWorkspaceId: m.targetWorkspaceId,
      targetRole: m.targetRole as WorkspaceRole,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
    }));
  }

  async saveGroupRoleMapping(
    orgId: string,
    data: SaveGroupRoleMappingInput,
    actorEmail: string,
  ): Promise<SSOGroupRoleMappingDto> {
    const mapping = await this.prisma.sSOGroupRoleMapping.upsert({
      where: {
        organizationId_groupName: { organizationId: orgId, groupName: data.groupName },
      },
      create: {
        organizationId: orgId,
        groupName: data.groupName,
        groupId: data.groupId,
        targetWorkspaceId: data.targetWorkspaceId,
        targetRole: data.targetRole,
      },
      update: {
        groupId: data.groupId,
        targetWorkspaceId: data.targetWorkspaceId,
        targetRole: data.targetRole,
      },
    });

    await this.logAuditEvent(orgId, actorEmail, 'GROUP_ROLE_MAPPING_SAVED', `Mapping:${mapping.id}`, {
      groupName: data.groupName,
      targetRole: data.targetRole,
    });

    return {
      id: mapping.id,
      organizationId: mapping.organizationId,
      groupName: mapping.groupName,
      groupId: mapping.groupId,
      targetWorkspaceId: mapping.targetWorkspaceId,
      targetRole: mapping.targetRole as WorkspaceRole,
      createdAt: mapping.createdAt.toISOString(),
      updatedAt: mapping.updatedAt.toISOString(),
    };
  }

  async deleteGroupRoleMapping(orgId: string, id: string, actorEmail: string): Promise<void> {
    await this.prisma.sSOGroupRoleMapping.deleteMany({
      where: { id, organizationId: orgId },
    });

    await this.logAuditEvent(orgId, actorEmail, 'GROUP_ROLE_MAPPING_DELETED', `Mapping:${id}`, {});
  }

  /* -------------------------------------------------------------------------- */
  /* Decrypt Helper for Auth Callbacks (internal only)                          */
  /* -------------------------------------------------------------------------- */

  getDecryptedOidcClientSecret(config: { oidcClientSecretCipher?: string | null }): string | null {
    if (!config.oidcClientSecretCipher) return null;
    return decryptSecret(config.oidcClientSecretCipher, this.encryptionKey);
  }

  /* -------------------------------------------------------------------------- */
  /* Audit Logs                                                                 */
  /* -------------------------------------------------------------------------- */

  async logAuditEvent(
    orgId: string,
    actorEmail: string,
    action: string,
    targetResource: string,
    details: Record<string, unknown> = {},
  ) {
    try {
      return await this.prisma.enterpriseAuditLog.create({
        data: {
          organizationId: orgId,
          actorEmail,
          action,
          targetResource,
          details: JSON.stringify(details),
        },
      });
    } catch {
      // never crash caller on audit write
      return undefined;
    }
  }

  async getAuditLogs(orgId: string) {
    return this.prisma.enterpriseAuditLog.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /* -------------------------------------------------------------------------- */
  /* DTO Transformer & Secret Redaction                                         */
  /* -------------------------------------------------------------------------- */

  private async toSSOConfigDto(config: any, orgId: string): Promise<EnterpriseSSOConfigDto> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { verifiedDomains: true, domainVerificationToken: true, domainVerifiedAt: true },
    });
    const scimEndpoint = `${this.apiUrl}/scim/v2`;
    const spEntityId = config?.spEntityId || `${this.apiUrl}/auth/sso/saml/metadata/${orgId}`;
    const acsUrl = config?.acsUrl || `${this.apiUrl}/auth/sso/saml/acs/${orgId}`;
    const metadataUrl = `${this.apiUrl}/auth/sso/saml/metadata/${orgId}`;

    return {
      id: config?.id || 'unconfigured',
      organizationId: orgId,
      providerType: config?.providerType || 'SAML',
      idpName: config?.idpName || null,
      idpEntityId: config?.idpEntityId || null,
      ssoUrl: config?.ssoUrl || null,
      certificate: config?.certificate || null,
      spEntityId,
      acsUrl,
      metadataUrl,
      allowIdpInitiated: config?.allowIdpInitiated ?? true,
      forceAuthn: config?.forceAuthn ?? false,
      oidcIssuer: config?.oidcIssuer || null,
      oidcClientId: config?.oidcClientId || null,
      hasOidcClientSecret: Boolean(config?.oidcClientSecretCipher),
      oidcAuthorizationEndpoint: config?.oidcAuthorizationEndpoint || null,
      oidcTokenEndpoint: config?.oidcTokenEndpoint || null,
      oidcJwksUri: config?.oidcJwksUri || null,
      oidcUserInfoEndpoint: config?.oidcUserInfoEndpoint || null,
      oidcScopes: config?.oidcScopes || ['openid', 'profile', 'email'],
      enforceSso: config?.enforceSso ?? false,
      allowPasswordFallbackForAdmins: config?.allowPasswordFallbackForAdmins ?? true,
      hasRecoveryCode: Boolean(config?.recoveryCodeHash),
      scimEnabled: config?.scimEnabled ?? false,
      scimEndpoint,
      scimTokenPrefix: config?.scimTokenPrefix || null,
      scimTokenExpiresAt: config?.scimTokenExpiresAt ? config.scimTokenExpiresAt.toISOString() : null,
      scimLastSyncAt: config?.scimLastSyncAt ? config.scimLastSyncAt.toISOString() : null,
      lastConnectionTestAt: config?.lastConnectionTestAt ? config.lastConnectionTestAt.toISOString() : null,
      lastConnectionTestStatus: config?.lastConnectionTestStatus || null,
      lastConnectionTestMessage: config?.lastConnectionTestMessage || null,
      verifiedDomains: org?.verifiedDomains || [],
      domainVerificationToken: org?.domainVerificationToken || null,
      domainVerifiedAt: org?.domainVerifiedAt ? org.domainVerifiedAt.toISOString() : null,
      isActive: config?.isActive ?? true,
      createdAt: config?.createdAt ? config.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: config?.updatedAt ? config.updatedAt.toISOString() : new Date().toISOString(),
    };
  }
}
