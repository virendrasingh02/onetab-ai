import { BadRequestException, Logger, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import axios from 'axios';
import type { TokenResult } from '../core/provider-adapter.interface.js';

const logger = new Logger('GoogleOAuth');

/**
 * Shared Google OAuth 2.0 helpers reused by every Google Workspace provider
 * (Gmail, Calendar, Drive, Docs, Sheets). Each provider still owns its own
 * scopes, redirect-URI env var and default callback path — this only removes
 * the boilerplate of the token exchange / refresh / revoke calls, which are
 * identical across every Google product.
 *
 * Gmail predates this helper and keeps its own inline implementation
 * deliberately unchanged — it is a working, tested reference and touching it
 * is out of scope here.
 */
export interface GoogleOAuthConfig {
  /** e.g. 'GOOGLE_CALENDAR_REDIRECT_URI' */
  redirectUriEnvKey: string;
  /** e.g. 'google_calendar' — must match the provider's controller path segment. */
  defaultCallbackPath: string;
}

export function resolveGoogleClientCredentials(config: ConfigService): {
  clientId: string;
  clientSecret: string;
} {
  const clientId = config.get<string>('GOOGLE_CLIENT_ID');
  const clientSecret = config.get<string>('GOOGLE_CLIENT_SECRET');
  if (!clientId || !clientSecret) {
    throw new BadRequestException(
      'Google OAuth is not configured on this server (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing). ' +
        'An administrator must register an OAuth app in Google Cloud Console and set these environment variables before this app can be connected.',
    );
  }
  return { clientId, clientSecret };
}

export function resolveGoogleRedirectUri(
  config: ConfigService,
  opts: GoogleOAuthConfig,
  override?: string,
): string {
  return (
    override ||
    config.get<string>(opts.redirectUriEnvKey) ||
    `http://localhost:3000/api/v1/integrations/${opts.defaultCallbackPath}/callback`
  );
}

export async function buildGoogleAuthorizationUrl(
  config: ConfigService,
  opts: GoogleOAuthConfig,
  scopes: string[],
  state: string,
  options?: { redirectUri?: string; scopes?: string[]; loginHint?: string },
): Promise<string> {
  const { clientId } = resolveGoogleClientCredentials(config);
  const redirectUri = resolveGoogleRedirectUri(config, opts, options?.redirectUri);
  const requestedScopes = options?.scopes?.length ? options.scopes : scopes;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: requestedScopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
    include_granted_scopes: 'true',
  });
  if (options?.loginHint) params.append('login_hint', options.loginHint);

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleAuthorizationCode(
  config: ConfigService,
  opts: GoogleOAuthConfig,
  code: string,
  defaultScopes: string[],
  options?: { redirectUri?: string },
): Promise<TokenResult> {
  const { clientId, clientSecret } = resolveGoogleClientCredentials(config);
  const redirectUri = resolveGoogleRedirectUri(config, opts, options?.redirectUri);

  try {
    const tokenResponse = await axios.post<{
      access_token: string;
      refresh_token?: string;
      expires_in: number;
      scope: string;
      token_type: string;
    }>(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    const { access_token, refresh_token, expires_in, scope } = tokenResponse.data;
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    const profileResponse = await axios.get<{
      id: string;
      email: string;
      name: string;
      picture?: string;
    }>('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    return {
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresIn: expires_in,
      tokenExpiresAt,
      scopes: scope ? scope.split(' ') : defaultScopes,
      accountId: profileResponse.data.id || profileResponse.data.email,
      accountEmail: profileResponse.data.email,
      accountName: profileResponse.data.name,
      metadata: {
        picture: profileResponse.data.picture,
        email: profileResponse.data.email,
      },
    };
  } catch (err: any) {
    logger.error(
      `Google OAuth token exchange failed: ${err.response?.data ? JSON.stringify(err.response.data) : err.message}`,
    );
    throw new UnauthorizedException(
      err.response?.data?.error_description || 'Failed to exchange OAuth authorization code.',
    );
  }
}

export async function refreshGoogleAccessToken(
  config: ConfigService,
  refreshToken: string,
): Promise<TokenResult> {
  const { clientId, clientSecret } = resolveGoogleClientCredentials(config);

  try {
    const response = await axios.post<{
      access_token: string;
      expires_in: number;
      scope?: string;
    }>(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );

    return {
      accessToken: response.data.access_token,
      expiresIn: response.data.expires_in,
      tokenExpiresAt: new Date(Date.now() + response.data.expires_in * 1000),
      scopes: response.data.scope ? response.data.scope.split(' ') : undefined,
    };
  } catch (err: any) {
    logger.error(
      `Google refresh token request failed: ${err.response?.data ? JSON.stringify(err.response.data) : err.message}`,
    );
    throw new UnauthorizedException(
      'Failed to refresh Google access token. Authorization may have been revoked.',
    );
  }
}

export async function revokeGoogleToken(accessToken: string): Promise<void> {
  try {
    await axios.post(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`,
      {},
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
  } catch (err: any) {
    logger.warn(`Google token revocation notice: ${err.message}`);
  }
}

/**
 * Runs `fn` with the credential's current access token, transparently
 * refreshing and retrying once on a 401 — the same pattern Gmail uses.
 */
export async function executeWithGoogleAuth<T>(
  config: ConfigService,
  credential: { accessToken: string; refreshToken?: string | null; id: string },
  fn: (token: string) => Promise<T>,
): Promise<T> {
  try {
    return await fn(credential.accessToken);
  } catch (err: any) {
    if (err.response?.status === 401 && credential.refreshToken) {
      logger.log(`Google token expired, refreshing for integration ${credential.id}`);
      const refreshed = await refreshGoogleAccessToken(config, credential.refreshToken);
      credential.accessToken = refreshed.accessToken;
      return await fn(refreshed.accessToken);
    }
    throw err;
  }
}

/**
 * Lists Drive files, optionally scoped to a mimeType — the primitive Docs and
 * Sheets providers reuse to list "their" files, since only the Drive API can
 * list files at all (the Docs/Sheets APIs only read a single file's content).
 */
export async function listGoogleDriveFiles(
  token: string,
  params: {
    q?: string;
    mimeType?: string;
    pageSize?: number;
    pageToken?: string;
    orderBy?: string;
    spaces?: string;
  },
): Promise<{
  files: Array<{
    id: string;
    name: string;
    mimeType: string;
    iconLink?: string;
    webViewLink?: string;
    webContentLink?: string;
    thumbnailLink?: string;
    modifiedTime?: string;
    createdTime?: string;
    size?: string;
    owners?: Array<{ displayName?: string; emailAddress?: string }>;
    shared?: boolean;
    parents?: string[];
    trashed?: boolean;
  }>;
  nextPageToken?: string;
}> {
  const qParts: string[] = ['trashed = false'];
  if (params.mimeType) qParts.push(`mimeType = '${params.mimeType}'`);
  if (params.q) qParts.push(params.q);

  const res = await axios.get('https://www.googleapis.com/drive/v3/files', {
    headers: { Authorization: `Bearer ${token}` },
    params: {
      q: qParts.join(' and '),
      pageSize: params.pageSize ?? 25,
      pageToken: params.pageToken,
      orderBy: params.orderBy,
      spaces: params.spaces ?? 'drive',
      fields:
        'nextPageToken, files(id, name, mimeType, iconLink, webViewLink, webContentLink, thumbnailLink, modifiedTime, createdTime, size, owners(displayName, emailAddress), shared, parents, trashed)',
    },
  });

  return {
    files: res.data.files ?? [],
    nextPageToken: res.data.nextPageToken,
  };
}
