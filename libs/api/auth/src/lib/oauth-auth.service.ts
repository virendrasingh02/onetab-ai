import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createSign,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import axios from 'axios';
import { PrismaService } from '@org/database';
import type { UserIdentityDto } from '@org/types';
import type {
  AppleCallbackBodyInput,
  OAuthCallbackQueryInput,
  OAuthInitQueryInput,
} from '@org/validation';
import { AuthService, type SessionContext } from './auth.service.js';
import {
  IdTokenError,
  JwksCache,
  isEmailVerified,
  verifyIdToken,
  type IdTokenClaims,
} from './oidc-id-token.js';
import type { IssuedSession } from './token.service.js';

export type OAuthProvider = 'google' | 'apple';
export const OAUTH_PROVIDERS: readonly OAuthProvider[] = ['google', 'apple'];

/**
 * Carries one in-flight sign-in from `start` to the callback. It is sealed
 * (AES-256-GCM) into an httpOnly cookie, so it is bound to the browser that
 * started the flow (no login CSRF) and the PKCE verifier never appears in a
 * URL. The provider only ever sees the random `state` and `nonce`.
 */
interface OAuthFlow {
  v: 1;
  provider: OAuthProvider;
  state: string;
  nonce: string;
  pkceVerifier?: string;
  returnTo?: string;
  desktop?: { state: string; codeChallenge: string };
  invitationToken?: string;
  linkUserId?: string;
  expiresAt: number;
}

export interface OAuthStartResult {
  /** The provider's authorization URL to send the browser to. */
  url: string;
  /** Sealed flow; the controller stores it in {@link OAUTH_FLOW_COOKIE}. */
  flowCookie: string;
}

/** What the controller does after a callback: set the session (if any), redirect. */
export interface OAuthCallbackOutcome {
  redirectTo: string;
  session?: IssuedSession;
}

interface ProviderIdentity {
  provider: OAuthProvider;
  subject: string;
  email?: string;
  emailVerified: boolean;
  name?: string;
  avatarUrl?: string;
}

/** Reasons shown on the login page as `?error=<code>`. */
type OAuthErrorCode =
  | 'oauth_cancelled'
  | 'oauth_provider_error'
  | 'oauth_state_mismatch'
  | 'oauth_invalid_code'
  | 'oauth_invalid_token'
  | 'oauth_email_unverified'
  | 'oauth_email_required'
  | 'oauth_account_linked_to_other'
  | 'oauth_config_error'
  | 'oauth_callback_failed';

class OAuthFlowError extends Error {
  constructor(
    readonly code: OAuthErrorCode,
    detail?: string,
  ) {
    super(detail ?? code);
  }
}

export const OAUTH_FLOW_COOKIE = 'onetab_oauth';
export const OAUTH_FLOW_TTL_MS = 10 * 60 * 1000;

const GOOGLE_ISSUERS = [
  'https://accounts.google.com',
  'accounts.google.com',
] as const;
const APPLE_ISSUERS = ['https://appleid.apple.com'] as const;
const DEFAULT_LINK_RETURN = '/settings/security';

@Injectable()
export class OAuthAuthService {
  private readonly logger = new Logger(OAuthAuthService.name);
  private readonly flowKey: Buffer;
  private readonly googleKeys: JwksCache;
  private readonly appleKeys: JwksCache;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
  ) {
    // Derived, not reused: a leaked flow key must not be an access-token key.
    this.flowKey = Buffer.from(
      hkdfSync(
        'sha256',
        this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        Buffer.alloc(0),
        'onetab-oauth-flow-v1',
        32,
      ),
    );
    this.googleKeys = new JwksCache(
      'https://www.googleapis.com/oauth2/v3/certs',
    );
    this.appleKeys = new JwksCache('https://appleid.apple.com/auth/keys');
  }

  /* --- Configuration ------------------------------------------------------ */

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

  private googleConfig() {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET');
    if (!clientId || !clientSecret) return null;
    const redirectUri =
      this.config.get<string>('GOOGLE_AUTH_REDIRECT_URI') ||
      `${this.apiUrl}/auth/google/callback`;
    return { clientId, clientSecret, redirectUri };
  }

  private appleConfig() {
    const clientId = this.config.get<string>('APPLE_CLIENT_ID');
    const teamId = this.config.get<string>('APPLE_TEAM_ID');
    const keyId = this.config.get<string>('APPLE_KEY_ID');
    const privateKey = this.config.get<string>('APPLE_PRIVATE_KEY');
    if (!clientId || !teamId || !keyId || !privateKey) return null;
    const redirectUri =
      this.config.get<string>('APPLE_AUTH_REDIRECT_URI') ||
      `${this.apiUrl}/auth/apple/callback`;
    return { clientId, teamId, keyId, privateKey, redirectUri };
  }

  isConfigured(provider: OAuthProvider): boolean {
    return Boolean(
      provider === 'google' ? this.googleConfig() : this.appleConfig(),
    );
  }

  /* --- Flow sealing ------------------------------------------------------- */

  sealFlow(flow: OAuthFlow): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.flowKey, iv);
    const body = Buffer.concat([
      cipher.update(JSON.stringify(flow), 'utf8'),
      cipher.final(),
    ]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
  }

  /** `null` for anything missing, tampered with, or expired. */
  openFlow(sealed: string | undefined): OAuthFlow | null {
    if (!sealed) return null;
    try {
      const raw = Buffer.from(sealed, 'base64url');
      if (raw.length < 29) return null;
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.flowKey,
        raw.subarray(0, 12),
      );
      decipher.setAuthTag(raw.subarray(12, 28));
      const json = Buffer.concat([
        decipher.update(raw.subarray(28)),
        decipher.final(),
      ]);
      const flow = JSON.parse(json.toString('utf8')) as OAuthFlow;
      if (flow.v !== 1 || flow.expiresAt <= Date.now()) return null;
      return flow;
    } catch {
      return null;
    }
  }

  sanitizeReturnTo(returnTo?: string): string | undefined {
    const trimmed = returnTo?.trim();
    if (!trimmed) return undefined;
    // Same-origin relative path only: no `//host`, no `/\host` (browsers
    // normalise the backslash), no scheme.
    if (/^\/(?![/\\])/.test(trimmed)) return trimmed;
    try {
      const url = new URL(trimmed);
      if (url.origin === new URL(this.webAppUrl).origin) {
        return url.pathname + url.search + url.hash;
      }
    } catch {
      // not a URL
    }
    return undefined;
  }

  /* --- Start -------------------------------------------------------------- */

  start(
    provider: OAuthProvider,
    options: OAuthInitQueryInput,
    linkUserId?: string,
  ): OAuthStartResult {
    const state = randomBytes(32).toString('base64url');
    const nonce = randomBytes(32).toString('base64url');
    const desktop =
      options.desktop === 'true' && options.state && options.code_challenge
        ? { state: options.state, codeChallenge: options.code_challenge }
        : undefined;

    const flow: OAuthFlow = {
      v: 1,
      provider,
      state,
      nonce,
      returnTo: this.sanitizeReturnTo(options.returnTo),
      desktop,
      invitationToken: options.invitationToken || undefined,
      linkUserId,
      expiresAt: Date.now() + OAUTH_FLOW_TTL_MS,
    };

    let url: string;
    if (provider === 'google') {
      const google = this.googleConfig();
      if (!google) throw this.notConfigured('Google');
      flow.pkceVerifier = randomBytes(48).toString('base64url');
      const params = new URLSearchParams({
        client_id: google.clientId,
        redirect_uri: google.redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        code_challenge: createHash('sha256')
          .update(flow.pkceVerifier)
          .digest('base64url'),
        code_challenge_method: 'S256',
        state,
        nonce,
        prompt: 'select_account',
      });
      url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    } else {
      const apple = this.appleConfig();
      if (!apple) throw this.notConfigured('Apple');
      // `code` only: the ID token is taken from Apple's token endpoint, never
      // from the browser-posted form.
      const params = new URLSearchParams({
        client_id: apple.clientId,
        redirect_uri: apple.redirectUri,
        response_type: 'code',
        response_mode: 'form_post',
        scope: 'name email',
        state,
        nonce,
      });
      url = `https://appleid.apple.com/auth/authorize?${params}`;
    }

    return { url, flowCookie: this.sealFlow(flow) };
  }

  private notConfigured(name: string) {
    return new ServiceUnavailableException({
      code: 'oauth_not_configured',
      message: `Sign in with ${name} is not available on this server.`,
    });
  }

  /* --- Callback ----------------------------------------------------------- */

  /**
   * Finishes a provider redirect. Never throws: every failure becomes a
   * redirect back to where the user started, with an `error` code.
   */
  async handleCallback(
    provider: OAuthProvider,
    input: OAuthCallbackQueryInput | AppleCallbackBodyInput,
    sealedFlow: string | undefined,
    context: SessionContext,
  ): Promise<OAuthCallbackOutcome> {
    const flow = this.openFlow(sealedFlow);

    try {
      if (input.error) {
        this.logger.warn({
          event: 'oauth_provider_error',
          provider,
          error: input.error,
        });
        const cancelled = [
          'access_denied',
          'user_cancelled_authorize',
        ].includes(input.error);
        throw new OAuthFlowError(
          cancelled ? 'oauth_cancelled' : 'oauth_provider_error',
        );
      }

      if (
        !flow ||
        flow.provider !== provider ||
        !input.state ||
        !safeEqual(flow.state, input.state)
      ) {
        this.logger.warn({
          event: 'oauth_state_mismatch',
          provider,
          ip: context.ipAddress,
        });
        throw new OAuthFlowError('oauth_state_mismatch');
      }
      if (!input.code) throw new OAuthFlowError('oauth_invalid_code');

      const identity =
        provider === 'google'
          ? await this.exchangeGoogle(input.code, flow)
          : await this.exchangeApple(
              input.code,
              flow,
              (input as AppleCallbackBodyInput).user,
            );

      if (flow.linkUserId) {
        await this.linkIdentity(flow.linkUserId, identity);
        return {
          redirectTo: this.webUrl(flow.returnTo ?? DEFAULT_LINK_RETURN, {
            linked: provider,
          }),
        };
      }

      const userId = await this.resolveUser(identity);
      const result = await this.auth.signInWithFederatedIdentity(
        userId,
        provider,
        context,
      );

      if ('twoFactor' in result) {
        // The login page picks the challenge up from the fragment, which never
        // reaches a server log or a Referer header.
        const fragment = new URLSearchParams({
          two_factor: result.twoFactor.challengeToken,
          expires_at: result.twoFactor.expiresAt,
        });
        return { redirectTo: `${this.loginUrl(flow)}#${fragment}` };
      }

      return {
        redirectTo: this.destinationAfterSignIn(flow),
        session: result.session,
      };
    } catch (error) {
      const code =
        error instanceof OAuthFlowError ? error.code : 'oauth_callback_failed';
      if (!(error instanceof OAuthFlowError)) {
        this.logger.error({
          event: 'oauth_callback_failed',
          provider,
          err: error,
        });
      }
      if (flow?.linkUserId) {
        return {
          redirectTo: this.webUrl(flow.returnTo ?? DEFAULT_LINK_RETURN, {
            oauth_error: code,
          }),
        };
      }
      return { redirectTo: this.loginUrl(flow, { error: code }) };
    }
  }

  /** Signed in: desktop handoff goes back through the login page, which mints the code. */
  private destinationAfterSignIn(flow: OAuthFlow): string {
    if (flow.desktop) return this.loginUrl(flow);
    if (flow.invitationToken) {
      return this.webUrl(`/invite/${encodeURIComponent(flow.invitationToken)}`);
    }
    return this.webUrl(flow.returnTo ?? '/');
  }

  /** `/login` carrying whatever the flow started with, so a retry or 2FA step resumes it. */
  private loginUrl(
    flow: OAuthFlow | null,
    extra: Record<string, string> = {},
  ): string {
    const params: Record<string, string> = {};
    if (flow?.desktop) {
      params['desktop'] = 'true';
      params['state'] = flow.desktop.state;
      params['code_challenge'] = flow.desktop.codeChallenge;
    }
    const returnTo = flow?.invitationToken
      ? `/invite/${encodeURIComponent(flow.invitationToken)}`
      : flow?.returnTo;
    if (returnTo) params['returnTo'] = returnTo;
    return this.webUrl('/login', { ...params, ...extra });
  }

  private webUrl(path: string, params: Record<string, string> = {}): string {
    const url = new URL(path, `${this.webAppUrl}/`);
    for (const [key, value] of Object.entries(params))
      url.searchParams.set(key, value);
    return url.toString();
  }

  /* --- Provider exchanges -------------------------------------------------- */

  private async exchangeGoogle(
    code: string,
    flow: OAuthFlow,
  ): Promise<ProviderIdentity> {
    const google = this.googleConfig();
    if (!google) throw new OAuthFlowError('oauth_config_error');

    const idToken = await this.postTokenEndpoint(
      'https://oauth2.googleapis.com/token',
      {
        code,
        client_id: google.clientId,
        client_secret: google.clientSecret,
        redirect_uri: google.redirectUri,
        grant_type: 'authorization_code',
        code_verifier: flow.pkceVerifier ?? '',
      },
    );

    const claims = await this.verify(idToken, {
      jwks: this.googleKeys,
      issuers: GOOGLE_ISSUERS,
      audience: google.clientId,
      nonce: flow.nonce,
    });
    return {
      provider: 'google',
      subject: claims.sub,
      email: normalizeEmail(claims.email),
      emailVerified: isEmailVerified(claims),
      name: claims.name,
      avatarUrl: claims.picture,
    };
  }

  private async exchangeApple(
    code: string,
    flow: OAuthFlow,
    rawUser: string | undefined,
  ): Promise<ProviderIdentity> {
    const apple = this.appleConfig();
    if (!apple) throw new OAuthFlowError('oauth_config_error');

    const idToken = await this.postTokenEndpoint(
      'https://appleid.apple.com/auth/token',
      {
        code,
        client_id: apple.clientId,
        client_secret: this.appleClientSecret(apple),
        redirect_uri: apple.redirectUri,
        grant_type: 'authorization_code',
      },
    );

    const claims = await this.verify(idToken, {
      jwks: this.appleKeys,
      issuers: APPLE_ISSUERS,
      audience: apple.clientId,
      nonce: flow.nonce,
    });
    return {
      provider: 'apple',
      subject: claims.sub,
      email: normalizeEmail(claims.email),
      emailVerified: isEmailVerified(claims),
      // Apple sends the name once, on first authorization, outside the token.
      name: parseAppleName(rawUser),
    };
  }

  private async postTokenEndpoint(
    url: string,
    body: Record<string, string>,
  ): Promise<string> {
    try {
      const res = await axios.post<{ id_token?: string }>(
        url,
        new URLSearchParams(body),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 10_000,
        },
      );
      if (!res.data?.id_token)
        throw new Error('token response had no id_token');
      return res.data.id_token;
    } catch (error: unknown) {
      const detail = axios.isAxiosError(error)
        ? (error.response?.data ?? error.message)
        : error;
      this.logger.warn({ event: 'oauth_code_exchange_failed', url, detail });
      throw new OAuthFlowError('oauth_invalid_code');
    }
  }

  private async verify(
    idToken: string,
    options: Parameters<typeof verifyIdToken>[1],
  ): Promise<IdTokenClaims> {
    try {
      return await verifyIdToken(idToken, options);
    } catch (error) {
      this.logger.warn({
        event: 'oauth_id_token_rejected',
        reason: error instanceof IdTokenError ? error.message : String(error),
      });
      throw new OAuthFlowError('oauth_invalid_token');
    }
  }

  /** Apple's client secret is a short-lived ES256 JWT signed with the team key. */
  private appleClientSecret(
    apple: NonNullable<ReturnType<OAuthAuthService['appleConfig']>>,
  ): string {
    const pem = apple.privateKey.includes('BEGIN PRIVATE KEY')
      ? apple.privateKey.replace(/\\n/g, '\n')
      : Buffer.from(apple.privateKey, 'base64').toString('utf8');
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(
      JSON.stringify({ alg: 'ES256', kid: apple.keyId }),
    ).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({
        iss: apple.teamId,
        iat: now,
        exp: now + 300,
        aud: 'https://appleid.apple.com',
        sub: apple.clientId,
      }),
    ).toString('base64url');
    const signature = createSign('SHA256')
      .update(`${header}.${payload}`)
      .sign({ key: pem, dsaEncoding: 'ieee-p1363' }, 'base64url');
    return `${header}.${payload}.${signature}`;
  }

  /* --- Account resolution -------------------------------------------------- */

  /**
   * Maps a verified provider identity to a user id:
   *  1. an identity already linked → that user;
   *  2. otherwise a *verified* provider email matching an account → link it;
   *  3. otherwise → a new account.
   */
  private async resolveUser(identity: ProviderIdentity): Promise<string> {
    const linked = await this.prisma.userIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: identity.provider,
          providerUserId: identity.subject,
        },
      },
      select: { id: true, userId: true, email: true },
    });
    if (linked) {
      if (identity.email && identity.email !== linked.email) {
        await this.prisma.userIdentity.update({
          where: { id: linked.id },
          data: { email: identity.email },
        });
      }
      return linked.userId;
    }

    // Anything below trusts the email, so the provider must vouch for it.
    if (!identity.email) throw new OAuthFlowError('oauth_email_required');
    if (!identity.emailVerified)
      throw new OAuthFlowError('oauth_email_unverified');
    const email = identity.email;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.user.findFirst({
          where: { email: { equals: email, mode: 'insensitive' } },
          select: {
            id: true,
            emailVerifiedAt: true,
            avatarUrl: true,
            passwordHash: true,
          },
        });

        if (existing) {
          await tx.userIdentity.create({
            data: {
              userId: existing.id,
              provider: identity.provider,
              providerUserId: identity.subject,
              email,
            },
          });

          // An unverified account was never proven to belong to this inbox — it
          // may have been pre-registered by someone else to sit in wait. The
          // provider just proved ownership, so whatever credentials the
          // squatter set up (password, live sessions) must not survive.
          const unverified = !existing.emailVerifiedAt;
          if (unverified) {
            await tx.refreshToken.updateMany({
              where: { userId: existing.id, revokedAt: null },
              data: { revokedAt: new Date() },
            });
          }
          await tx.user.update({
            where: { id: existing.id },
            data: {
              emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
              avatarUrl: existing.avatarUrl ?? identity.avatarUrl ?? null,
              ...(unverified && existing.passwordHash
                ? { passwordHash: null }
                : {}),
            },
          });

          this.logger.log({
            event: 'oauth_identity_linked_by_email',
            provider: identity.provider,
            userId: existing.id,
            clearedUnverifiedCredentials: unverified,
          });
          return existing.id;
        }

        const created = await tx.user.create({
          data: {
            email,
            name: identity.name?.trim() || email.split('@')[0] || email,
            avatarUrl: identity.avatarUrl ?? null,
            passwordHash: null,
            emailVerifiedAt: new Date(),
            identities: {
              create: {
                provider: identity.provider,
                providerUserId: identity.subject,
                email,
              },
            },
          },
          select: { id: true },
        });
        this.logger.log({
          event: 'oauth_user_created',
          provider: identity.provider,
          userId: created.id,
        });
        return created.id;
      });
    } catch (error) {
      // Two callbacks for the same person raced (double-click, two tabs): the
      // loser's insert hits a unique index. The winner's row is the answer.
      if (isUniqueViolation(error)) {
        const winner = await this.prisma.userIdentity.findUnique({
          where: {
            provider_providerUserId: {
              provider: identity.provider,
              providerUserId: identity.subject,
            },
          },
          select: { userId: true },
        });
        if (winner) return winner.userId;
      }
      throw error;
    }
  }

  /** Settings → "Connect": attach the identity to the signed-in user. */
  private async linkIdentity(
    userId: string,
    identity: ProviderIdentity,
  ): Promise<void> {
    const existing = await this.prisma.userIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: identity.provider,
          providerUserId: identity.subject,
        },
      },
      select: { userId: true },
    });
    if (existing) {
      if (existing.userId !== userId)
        throw new OAuthFlowError('oauth_account_linked_to_other');
      return; // already linked to this user
    }

    try {
      await this.prisma.userIdentity.create({
        data: {
          userId,
          provider: identity.provider,
          providerUserId: identity.subject,
          email: identity.email ?? null,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error))
        throw new OAuthFlowError('oauth_account_linked_to_other');
      throw error;
    }
    this.logger.log({
      event: 'oauth_identity_linked',
      provider: identity.provider,
      userId,
    });
  }

  /* --- Identity management (Settings) ------------------------------------- */

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
    if (!user) throw new NotFoundException('User not found.');

    return {
      identities: user.identities.map((i) => ({
        id: i.id,
        provider: i.provider as OAuthProvider,
        providerUserId: i.providerUserId,
        email: i.email,
        createdAt: i.createdAt.toISOString(),
      })),
      hasPassword: Boolean(user.passwordHash),
    };
  }

  async disconnectIdentity(
    userId: string,
    provider: string,
  ): Promise<{ success: boolean }> {
    if (!OAUTH_PROVIDERS.includes(provider as OAuthProvider)) {
      throw new BadRequestException(`Unknown sign-in provider: ${provider}.`);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        passwordHash: true,
        identities: { select: { id: true, provider: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found.');

    const target = user.identities.find((i) => i.provider === provider);
    if (!target)
      throw new NotFoundException(`No connected ${provider} account found.`);

    const othersRemain = user.identities.some((i) => i.provider !== provider);
    if (!user.passwordHash && !othersRemain) {
      throw new BadRequestException(
        'Cannot disconnect your only sign-in method. Set a password or connect another login method first.',
      );
    }

    await this.prisma.userIdentity.delete({ where: { id: target.id } });
    this.logger.log({ event: 'oauth_identity_disconnected', provider, userId });
    return { success: true };
  }
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

function normalizeEmail(email: string | undefined): string | undefined {
  const trimmed = email?.trim().toLowerCase();
  return trimmed || undefined;
}

function parseAppleName(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    const user = JSON.parse(raw) as {
      name?: { firstName?: string; lastName?: string };
    };
    const full =
      `${user.name?.firstName ?? ''} ${user.name?.lastName ?? ''}`.trim();
    return full ? full.slice(0, 100) : undefined;
  } catch {
    return undefined;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === 'P2002'
  );
}
