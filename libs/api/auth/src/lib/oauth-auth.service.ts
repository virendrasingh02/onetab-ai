import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, createPublicKey, createSign, createVerify, randomBytes, timingSafeEqual } from 'node:crypto';
import axios from 'axios';
import type { Response } from 'express';
import { PrismaService } from '@org/database';
import type { UserIdentityDto } from '@org/types';
import type {
  AppleCallbackBodyInput,
  OAuthCallbackQueryInput,
  OAuthInitQueryInput,
} from '@org/validation';
import { DesktopAuthService } from './desktop-auth.service.js';
import { TokenService } from './token.service.js';

export interface OAuthStateData {
  provider: 'google' | 'apple';
  nonce: string;
  pkceVerifier?: string;
  returnTo?: string;
  desktop?: boolean;
  handoffState?: string;
  handoffChallenge?: string;
  invitationToken?: string;
  linkUserId?: string;
  createdAt: number;
}

interface JWKKey {
  kty: string;
  kid: string;
  use: string;
  alg: string;
  n: string;
  e: string;
}

interface AppleKeysResponse {
  keys: JWKKey[];
}

const REFRESH_COOKIE = 'onetab_rt';
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

@Injectable()
export class OAuthAuthService {
  private readonly logger = new Logger(OAuthAuthService.name);
  private readonly redeemedStates = new Set<string>();
  private applePublicKeysCache: { keys: JWKKey[]; fetchedAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly tokens: TokenService,
    private readonly desktopAuth: DesktopAuthService,
  ) {
    // Prune redeemed states set periodically
    setInterval(() => {
      if (this.redeemedStates.size > 5000) {
        this.redeemedStates.clear();
      }
    }, 60_000).unref();
  }

  // --- Configuration helpers ---

  private get webAppUrl(): string {
    const raw =
      this.config.get<string>('WEB_APP_URL') ||
      this.config.get<string>('VITE_WEB_APP_URL') ||
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

  private get googleClientId(): string | undefined {
    return this.config.get<string>('GOOGLE_CLIENT_ID');
  }

  private get googleClientSecret(): string | undefined {
    return this.config.get<string>('GOOGLE_CLIENT_SECRET');
  }

  private get googleRedirectUri(): string {
    return (
      this.config.get<string>('GOOGLE_AUTH_REDIRECT_URI') ||
      this.config.get<string>('GOOGLE_REDIRECT_URI') ||
      `${this.apiUrl}/auth/google/callback`
    );
  }

  private get appleClientId(): string | undefined {
    return this.config.get<string>('APPLE_CLIENT_ID');
  }

  private get appleTeamId(): string | undefined {
    return this.config.get<string>('APPLE_TEAM_ID');
  }

  private get appleKeyId(): string | undefined {
    return this.config.get<string>('APPLE_KEY_ID');
  }

  private get applePrivateKey(): string | undefined {
    return this.config.get<string>('APPLE_PRIVATE_KEY');
  }

  private get appleRedirectUri(): string {
    return (
      this.config.get<string>('APPLE_AUTH_REDIRECT_URI') ||
      this.config.get<string>('APPLE_REDIRECT_URI') ||
      `${this.apiUrl}/auth/apple/callback`
    );
  }

  private get stateSecret(): string {
    return (
      this.config.get<string>('JWT_ACCESS_SECRET') ||
      this.config.get<string>('ENCRYPTION_KEY') ||
      'onetab-oauth-state-secret-fallback'
    );
  }

  // --- Security: State generation and validation ---

  generateState(data: Omit<OAuthStateData, 'createdAt' | 'nonce'>): { state: string; nonce: string } {
    const nonce = randomBytes(24).toString('hex');
    const payload: OAuthStateData = {
      ...data,
      nonce,
      createdAt: Date.now(),
    };

    const serialized = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    const signature = createHmac('sha256', this.stateSecret).update(serialized).digest('base64url');
    return { state: `${serialized}.${signature}`, nonce };
  }

  verifyState(stateString?: string, expectedProvider?: 'google' | 'apple'): OAuthStateData {
    if (!stateString || typeof stateString !== 'string') {
      throw new BadRequestException({
        code: 'oauth_state_invalid',
        message: 'Missing or invalid OAuth state parameter.',
      });
    }

    const [serialized, signature] = stateString.split('.');
    if (!serialized || !signature) {
      throw new BadRequestException({
        code: 'oauth_state_invalid',
        message: 'Malformed OAuth state token.',
      });
    }

    const expectedSignature = createHmac('sha256', this.stateSecret).update(serialized).digest('base64url');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    const actualBuffer = Buffer.from(signature, 'utf8');

    if (
      expectedBuffer.length !== actualBuffer.length ||
      !timingSafeEqual(expectedBuffer, actualBuffer)
    ) {
      this.logger.warn('OAuth state verification failed: Invalid HMAC signature.');
      throw new BadRequestException({
        code: 'oauth_state_mismatch',
        message: 'OAuth state validation failed. Possible CSRF attempt.',
      });
    }

    if (this.redeemedStates.has(stateString)) {
      this.logger.warn('OAuth state replay detected.');
      throw new BadRequestException({
        code: 'oauth_state_reused',
        message: 'This sign-in request has already been used.',
      });
    }

    let payload: OAuthStateData;
    try {
      payload = JSON.parse(Buffer.from(serialized, 'base64url').toString('utf8')) as OAuthStateData;
    } catch {
      throw new BadRequestException({
        code: 'oauth_state_invalid',
        message: 'Invalid state payload.',
      });
    }

    if (Date.now() - payload.createdAt > OAUTH_STATE_TTL_MS) {
      throw new BadRequestException({
        code: 'oauth_state_expired',
        message: 'OAuth state has expired. Please sign in again.',
      });
    }

    if (expectedProvider && payload.provider !== expectedProvider) {
      throw new BadRequestException({
        code: 'oauth_provider_mismatch',
        message: `OAuth provider mismatch (expected ${expectedProvider}).`,
      });
    }

    // Mark state as redeemed to prevent replay
    this.redeemedStates.add(stateString);
    return payload;
  }

  sanitizeReturnTo(returnTo?: string): string {
    if (!returnTo) return '/';
    const trimmed = returnTo.trim();
    // Allow relative paths starting with single slash (disallow protocol-relative //)
    if (trimmed.startsWith('/') && !trimmed.startsWith('//')) {
      return trimmed;
    }
    try {
      const url = new URL(trimmed);
      const appOrigin = new URL(this.webAppUrl).origin;
      if (url.origin === appOrigin) {
        return url.pathname + url.search + url.hash;
      }
    } catch {
      // Ignore URL parse errors
    }
    return '/';
  }

  // --- Google OAuth ---

  async getGoogleAuthUrl(options: OAuthInitQueryInput & { linkUserId?: string }): Promise<{ url: string }> {
    const clientId = this.googleClientId;
    if (!clientId) {
      throw new BadRequestException(
        'Google login is not configured on this server (GOOGLE_CLIENT_ID missing). ' +
          'Configure Google Cloud OAuth credentials to enable Google sign-in.',
      );
    }

    // Generate PKCE
    const pkceVerifier = randomBytes(48).toString('base64url');
    const pkceChallenge = createHash('sha256')
      .update(pkceVerifier)
      .digest('base64url');

    const { state } = this.generateState({
      provider: 'google',
      pkceVerifier,
      returnTo: options.returnTo,
      desktop: options.desktop === 'true',
      handoffState: options.state,
      handoffChallenge: options.code_challenge,
      invitationToken: options.invitationToken,
      linkUserId: options.linkUserId,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.googleRedirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      code_challenge: pkceChallenge,
      code_challenge_method: 'S256',
      state,
      access_type: 'offline',
      prompt: 'select_account',
    });

    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    };
  }

  async handleGoogleCallback(
    input: OAuthCallbackQueryInput,
    context: { ipAddress?: string; userAgent?: string },
    response: Response,
  ): Promise<void> {
    if (input.error) {
      this.logger.warn(`Google login returned error: ${input.error}`);
      const errCode = input.error === 'access_denied' ? 'oauth_cancelled' : 'oauth_provider_error';
      return response.redirect(`${this.webAppUrl}/login?error=${errCode}`);
    }

    if (!input.code || !input.state) {
      return response.redirect(`${this.webAppUrl}/login?error=oauth_invalid_code`);
    }

    let stateData: OAuthStateData;
    try {
      stateData = this.verifyState(input.state, 'google');
    } catch (err) {
      this.logger.warn('Google state validation failed', err);
      return response.redirect(`${this.webAppUrl}/login?error=oauth_state_mismatch`);
    }

    const clientId = this.googleClientId;
    const clientSecret = this.googleClientSecret;
    if (!clientId || !clientSecret) {
      return response.redirect(`${this.webAppUrl}/login?error=oauth_config_error`);
    }

    // Exchange code for tokens
    let tokenData: { access_token: string; id_token?: string };
    try {
      const exchangeBody: Record<string, string> = {
        code: input.code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: this.googleRedirectUri,
        grant_type: 'authorization_code',
      };
      if (stateData.pkceVerifier) {
        exchangeBody['code_verifier'] = stateData.pkceVerifier;
      }

      const tokenRes = await axios.post<{ access_token: string; id_token?: string }>(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams(exchangeBody),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10_000,
        },
      );
      tokenData = tokenRes.data;
    } catch (err: any) {
      this.logger.error('Failed to exchange Google authorization code', err?.response?.data || err?.message);
      return response.redirect(`${this.webAppUrl}/login?error=oauth_invalid_code`);
    }

    // Verify token and fetch userinfo
    let profile: { sub: string; email: string; email_verified?: boolean; name?: string; picture?: string };
    try {
      const userinfoRes = await axios.get<{
        sub: string;
        email: string;
        email_verified?: boolean;
        name?: string;
        picture?: string;
      }>('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        timeout: 10_000,
      });
      profile = userinfoRes.data;
    } catch (err: any) {
      this.logger.error('Failed to fetch Google user profile', err?.message);
      return response.redirect(`${this.webAppUrl}/login?error=oauth_provider_unavailable`);
    }

    if (!profile.email || !profile.sub) {
      return response.redirect(`${this.webAppUrl}/login?error=oauth_provider_unavailable`);
    }

    if (profile.email_verified === false) {
      return response.redirect(`${this.webAppUrl}/login?error=oauth_email_unverified`);
    }

    await this.resolveUserAndCompleteSession(
      'google',
      profile.sub,
      profile.email.toLowerCase().trim(),
      {
        name: profile.name || profile.email.split('@')[0],
        avatarUrl: profile.picture,
      },
      stateData,
      context,
      response,
    );
  }

  // --- Apple OAuth ---

  private async getApplePublicKeys(): Promise<JWKKey[]> {
    const now = Date.now();
    if (this.applePublicKeysCache && now - this.applePublicKeysCache.fetchedAt < 60 * 60 * 1000) {
      return this.applePublicKeysCache.keys;
    }

    try {
      const res = await axios.get<AppleKeysResponse>('https://appleid.apple.com/auth/keys', {
        timeout: 10_000,
      });
      this.applePublicKeysCache = { keys: res.data.keys, fetchedAt: now };
      return res.data.keys;
    } catch (err: any) {
      this.logger.error('Failed to fetch Apple public keys', err?.message);
      if (this.applePublicKeysCache) return this.applePublicKeysCache.keys;
      throw new BadRequestException('Could not fetch Apple identity keys.');
    }
  }

  private generateAppleClientSecret(): string | null {
    const clientId = this.appleClientId;
    const teamId = this.appleTeamId;
    const keyId = this.appleKeyId;
    const privateKeyRaw = this.applePrivateKey;

    if (!clientId || !teamId || !keyId || !privateKeyRaw) {
      return null;
    }

    const privateKeyPem = privateKeyRaw.includes('BEGIN PRIVATE KEY')
      ? privateKeyRaw
      : Buffer.from(privateKeyRaw, 'base64').toString('utf8');

    const now = Math.floor(Date.now() / 1000);
    const header = { alg: 'ES256', kid: keyId, typ: 'JWT' };
    const payload = {
      iss: teamId,
      iat: now,
      exp: now + 300, // 5 minutes
      aud: 'https://appleid.apple.com',
      sub: clientId,
    };

    const encHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
    const encPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signer = createSign('SHA256');
    signer.update(`${encHeader}.${encPayload}`);
    const signature = signer.sign(
      { key: privateKeyPem, dsaEncoding: 'ieee-p1363' },
      'base64url',
    );
    return `${encHeader}.${encPayload}.${signature}`;
  }

  private async verifyAppleIdToken(idToken: string, expectedNonce?: string): Promise<{
    sub: string;
    email?: string;
    email_verified?: boolean | string;
    nonce?: string;
  }> {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new BadRequestException('Malformed Apple identity token.');
    }

    let header: { kid: string; alg: string };
    let payload: {
      iss: string;
      aud: string;
      exp: number;
      sub: string;
      email?: string;
      email_verified?: boolean | string;
      nonce?: string;
    };

    try {
      header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
      payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid Apple token JSON.');
    }

    // Validate claims
    if (payload.iss !== 'https://appleid.apple.com') {
      throw new UnauthorizedException('Invalid Apple token issuer.');
    }

    if (this.appleClientId && payload.aud !== this.appleClientId) {
      throw new UnauthorizedException('Invalid Apple token audience.');
    }

    if (Date.now() >= payload.exp * 1000) {
      throw new UnauthorizedException('Apple token has expired.');
    }

    if (expectedNonce && payload.nonce && payload.nonce !== expectedNonce) {
      throw new UnauthorizedException('Apple token nonce mismatch.');
    }

    // Verify cryptographic signature using Apple JWKS
    try {
      const keys = await this.getApplePublicKeys();
      const jwk = keys.find((k) => k.kid === header.kid);
      if (jwk) {
        const publicKey = createPublicKey({ key: jwk as any, format: 'jwk' });
        const verifier = createVerify('SHA256');
        verifier.update(`${parts[0]}.${parts[1]}`);
        const isValid = verifier.verify(publicKey, Buffer.from(parts[2], 'base64url'));
        if (!isValid) {
          throw new UnauthorizedException('Apple identity token signature verification failed.');
        }
      }
    } catch (err: any) {
      this.logger.warn('Apple signature verification warning:', err?.message);
    }

    return payload;
  }

  async getAppleAuthUrl(options: OAuthInitQueryInput & { linkUserId?: string }): Promise<{ url: string }> {
    const clientId = this.appleClientId;
    if (!clientId) {
      throw new BadRequestException(
        'Apple login is not configured on this server (APPLE_CLIENT_ID missing). ' +
          'Configure Apple Developer Service ID credentials to enable Sign in with Apple.',
      );
    }

    const { state, nonce } = this.generateState({
      provider: 'apple',
      returnTo: options.returnTo,
      desktop: options.desktop === 'true',
      handoffState: options.state,
      handoffChallenge: options.code_challenge,
      invitationToken: options.invitationToken,
      linkUserId: options.linkUserId,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.appleRedirectUri,
      response_type: 'code id_token',
      response_mode: 'form_post',
      scope: 'name email',
      state,
      nonce,
    });

    return {
      url: `https://appleid.apple.com/auth/authorize?${params.toString()}`,
    };
  }

  async handleAppleCallback(
    input: AppleCallbackBodyInput,
    context: { ipAddress?: string; userAgent?: string },
    response: Response,
  ): Promise<void> {
    if (input.error) {
      this.logger.warn(`Apple login returned error: ${input.error}`);
      const errCode = input.error === 'user_cancelled_authorize' ? 'oauth_cancelled' : 'oauth_provider_error';
      return response.redirect(`${this.webAppUrl}/login?error=${errCode}`);
    }

    if (!input.state || (!input.id_token && !input.code)) {
      return response.redirect(`${this.webAppUrl}/login?error=oauth_invalid_code`);
    }

    let stateData: OAuthStateData;
    try {
      stateData = this.verifyState(input.state, 'apple');
    } catch (err) {
      this.logger.warn('Apple state validation failed', err);
      return response.redirect(`${this.webAppUrl}/login?error=oauth_state_mismatch`);
    }

    let idToken = input.id_token;

    // If only authorization code was received, exchange it for id_token
    if (!idToken && input.code) {
      const clientSecret = this.generateAppleClientSecret();
      if (clientSecret && this.appleClientId) {
        try {
          const exchangeRes = await axios.post<{ id_token: string }>(
            'https://appleid.apple.com/auth/token',
            new URLSearchParams({
              client_id: this.appleClientId,
              client_secret: clientSecret,
              code: input.code,
              grant_type: 'authorization_code',
              redirect_uri: this.appleRedirectUri,
            }),
            {
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              timeout: 10_000,
            },
          );
          idToken = exchangeRes.data.id_token;
        } catch (err: any) {
          this.logger.error('Failed to exchange Apple authorization code', err?.response?.data || err?.message);
        }
      }
    }

    if (!idToken) {
      return response.redirect(`${this.webAppUrl}/login?error=oauth_invalid_code`);
    }

    let claims: { sub: string; email?: string; email_verified?: boolean | string };
    try {
      claims = await this.verifyAppleIdToken(idToken, stateData.nonce);
    } catch (err) {
      this.logger.warn('Apple id_token verification failed', err);
      return response.redirect(`${this.webAppUrl}/login?error=oauth_invalid_token`);
    }

    // Extract first-login user profile name if present
    let displayName: string | undefined;
    if (input.user) {
      try {
        const userObj = typeof input.user === 'string' ? JSON.parse(input.user) : input.user;
        const fn = userObj?.name?.firstName || '';
        const ln = userObj?.name?.lastName || '';
        const combined = `${fn} ${ln}`.trim();
        if (combined) displayName = combined;
      } catch {
        // Ignore user parsing errors
      }
    }

    const email = claims.email?.toLowerCase().trim();
    if (!email) {
      // In rare cases Apple doesn't return email after first login; identity lookup by sub will handle it
    }

    await this.resolveUserAndCompleteSession(
      'apple',
      claims.sub,
      email,
      { name: displayName },
      stateData,
      context,
      response,
    );
  }

  // --- Unified Account Linking & Session Completion ---

  private async resolveUserAndCompleteSession(
    provider: 'google' | 'apple',
    providerUserId: string,
    email: string | undefined,
    profile: { name?: string; avatarUrl?: string },
    stateData: OAuthStateData,
    context: { ipAddress?: string; userAgent?: string },
    response: Response,
  ): Promise<void> {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';

    try {
      // FLOW A: User is already signed in and linking account from settings
      if (stateData.linkUserId) {
        const targetUserId = stateData.linkUserId;
        const targetUser = await this.prisma.user.findUnique({
          where: { id: targetUserId },
          select: { id: true, email: true },
        });

        if (!targetUser) {
          return response.redirect(`${this.webAppUrl}/login?error=oauth_user_not_found`);
        }

        // Check if this provider identity is already linked to ANOTHER user
        const existingIdentity = await this.prisma.userIdentity.findUnique({
          where: { provider_providerUserId: { provider, providerUserId } },
        });

        if (existingIdentity) {
          if (existingIdentity.userId !== targetUserId) {
            return response.redirect(
              `${this.webAppUrl}/settings/security?error=oauth_account_linked_to_other`,
            );
          }
          // Already linked to this user
          return response.redirect(
            `${this.webAppUrl}/settings/security?linked=${provider}`,
          );
        }

        // Link identity to current user
        await this.prisma.userIdentity.create({
          data: {
            userId: targetUserId,
            provider,
            providerUserId,
            email: email || targetUser.email,
          },
        });

        this.logger.log(`Linked ${provider} identity to user ${targetUserId}`);
        const returnUrl = this.sanitizeReturnTo(stateData.returnTo || '/settings/security');
        return response.redirect(`${this.webAppUrl}${returnUrl}?linked=${provider}`);
      }

      // FLOW B: Sign in or register via provider
      // Step 1: Look up by (provider, providerUserId)
      let resolvedUser = await this.prisma.user.findFirst({
        where: {
          identities: {
            some: {
              provider,
              providerUserId,
            },
          },
        },
      });

      // Step 2: If no identity found, link to existing user with same verified email or create new
      if (!resolvedUser) {
        if (!email) {
          // If Apple gave no email on repeat login and identity missing, cannot resolve
          return response.redirect(`${this.webAppUrl}/login?error=oauth_email_required`);
        }

        const existingUserByEmail = await this.prisma.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
        });

        if (existingUserByEmail) {
          // Account Linking: Link provider to existing user
          await this.prisma.userIdentity.create({
            data: {
              userId: existingUserByEmail.id,
              provider,
              providerUserId,
              email,
            },
          });

          // Update verified date & avatar if missing
          await this.prisma.user.update({
            where: { id: existingUserByEmail.id },
            data: {
              emailVerifiedAt: existingUserByEmail.emailVerifiedAt ?? new Date(),
              avatarUrl: existingUserByEmail.avatarUrl ?? profile.avatarUrl ?? null,
            },
          });

          resolvedUser = existingUserByEmail;
          this.logger.log(`Linked ${provider} to existing account: ${email}`);
        } else {
          // New User Registration
          resolvedUser = await this.prisma.user.create({
            data: {
              email,
              name: profile.name || email.split('@')[0],
              avatarUrl: profile.avatarUrl ?? null,
              passwordHash: null,
              emailVerifiedAt: new Date(),
              identities: {
                create: {
                  provider,
                  providerUserId,
                  email,
                },
              },
            },
          });
          this.logger.log(`Created new user via ${provider}: ${email}`);
        }
      }

      // Step 3: Issue standard application session
      const session = await this.tokens.issueSession(resolvedUser, context);

      // Set httpOnly cookie
      response.cookie(REFRESH_COOKIE, session.refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'strict' : 'lax',
        path: '/api/v1/auth',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      // Step 4: Handle destination / handoff
      if (stateData.desktop && stateData.handoffState && stateData.handoffChallenge) {
        const { code: desktopCode } = await this.desktopAuth.generateCode(resolvedUser.id, {
          state: stateData.handoffState,
          codeChallenge: stateData.handoffChallenge,
        });

        return response.redirect(
          `${this.webAppUrl}/auth/callback?code=${encodeURIComponent(desktopCode)}&state=${encodeURIComponent(stateData.handoffState)}`,
        );
      }

      if (stateData.invitationToken) {
        return response.redirect(
          `${this.webAppUrl}/invite/${encodeURIComponent(stateData.invitationToken)}`,
        );
      }

      const returnUrl = this.sanitizeReturnTo(stateData.returnTo);
      return response.redirect(`${this.webAppUrl}${returnUrl}`);
    } catch (err: any) {
      this.logger.error('Failed to resolve OAuth user and issue session', err);
      return response.redirect(`${this.webAppUrl}/login?error=oauth_callback_failed`);
    }
  }

  // --- Identity Management (Settings) ---

  async getIdentities(userId: string): Promise<{
    identities: UserIdentityDto[];
    hasPassword: boolean;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        passwordHash: true,
        identities: {
          select: {
            id: true,
            provider: true,
            providerUserId: true,
            email: true,
            createdAt: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    return {
      identities: user.identities.map((i) => ({
        id: i.id,
        provider: i.provider as 'google' | 'apple',
        providerUserId: i.providerUserId,
        email: i.email,
        createdAt: i.createdAt.toISOString(),
      })),
      hasPassword: Boolean(user.passwordHash),
    };
  }

  async disconnectIdentity(userId: string, provider: string): Promise<{ success: boolean }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        passwordHash: true,
        identities: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    const targetIdentity = user.identities.find((i) => i.provider === provider);
    if (!targetIdentity) {
      throw new NotFoundException(`No connected ${provider} account found.`);
    }

    // Safety rule: Prevent user from disconnecting their ONLY authentication method
    const remainingIdentities = user.identities.filter((i) => i.provider !== provider);
    const hasPassword = Boolean(user.passwordHash);

    if (!hasPassword && remainingIdentities.length === 0) {
      throw new BadRequestException(
        'Cannot disconnect your only sign-in method. You must set a password or connect another login method first.',
      );
    }

    await this.prisma.userIdentity.delete({
      where: { id: targetIdentity.id },
    });

    this.logger.log(`User ${userId} disconnected ${provider} identity`);
    return { success: true };
  }
}
