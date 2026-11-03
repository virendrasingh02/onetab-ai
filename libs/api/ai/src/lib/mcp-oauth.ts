/**
 * The MCP authorization flow (spec 2025-06-18): OAuth 2.1 with PKCE against
 * the authorization server a remote MCP server names.
 *
 * Discovery order follows the spec: the `resource_metadata` URL from the
 * server's 401 `WWW-Authenticate`, else the well-known Protected Resource
 * Metadata (RFC 9728) → its first authorization server → that server's
 * RFC 8414 / OIDC metadata. Servers that predate RFC 9728 (2025-03-26 spec)
 * fall back to metadata, or default endpoints, at the MCP server's origin.
 *
 * A client is registered dynamically (RFC 7591) when the server allows it;
 * otherwise the member supplies a client ID/secret from the provider's
 * developer console. Every request goes through the SSRF guard.
 */

import { createHash, randomBytes } from 'node:crypto';
import { safeFetch } from '@org/api-common';

const TIMEOUT_MS = 15_000;

export interface MCPAuthHint {
  /** From `WWW-Authenticate: Bearer resource_metadata="…"`. */
  resourceMetadataUrl?: string;
  /** From `WWW-Authenticate: Bearer scope="…"`. */
  scope?: string;
}

export interface MCPOAuthServer {
  issuer?: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  registrationEndpoint?: string;
  /** The `resource` parameter (RFC 8707) — the MCP server's canonical URI. */
  resource: string;
  scope?: string;
  tokenAuthMethods: string[];
}

export interface MCPOAuthClient {
  clientId: string;
  clientSecret?: string;
}

export interface MCPTokenSet {
  accessToken: string;
  refreshToken?: string;
  /** Epoch ms, when the server said. */
  expiresAt?: number;
  scope?: string;
}

export class MCPOAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MCPOAuthError';
  }
}

interface HttpReply {
  status: number;
  body: string;
}

async function request(
  url: string,
  init: {
    method: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: string;
  },
  allowPrivateNetwork: boolean,
): Promise<HttpReply> {
  const headers = { accept: 'application/json', ...init.headers };
  if (!allowPrivateNetwork) {
    const res = await safeFetch(url, {
      ...init,
      headers,
      timeoutMs: TIMEOUT_MS,
      maxBytes: 1024 * 1024,
    });
    return { status: res.status, body: res.text() };
  }
  const res = await fetch(url, {
    ...init,
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return { status: res.status, body: await res.text() };
}

async function getJson(
  url: string,
  allowPrivateNetwork: boolean,
): Promise<Record<string, unknown> | null> {
  try {
    const reply = await request(url, { method: 'GET' }, allowPrivateNetwork);
    if (reply.status < 200 || reply.status >= 300) return null;
    const parsed = JSON.parse(reply.body);
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Parses `Bearer realm="x", resource_metadata="…", scope="a b"`. */
export function parseWwwAuthenticate(header: string | undefined): MCPAuthHint {
  if (!header) return {};
  const hint: MCPAuthHint = {};
  for (const match of header.matchAll(
    /([a-z_]+)\s*=\s*(?:"([^"]*)"|([^\s,]+))/gi,
  )) {
    const key = match[1].toLowerCase();
    const value = match[2] ?? match[3];
    if (key === 'resource_metadata') hint.resourceMetadataUrl = value;
    else if (key === 'scope') hint.scope = value;
  }
  return hint;
}

/** The canonical resource URI: no fragment, no trailing slash on a bare origin. */
export function canonicalResource(serverUrl: string): string {
  const url = new URL(serverUrl);
  url.hash = '';
  const s = url.toString();
  return url.pathname === '/' && !url.search ? s.replace(/\/$/, '') : s;
}

function wellKnown(base: string, suffix: string): string[] {
  const url = new URL(base);
  const path = url.pathname.replace(/\/$/, '');
  const urls = [
    `${url.origin}/.well-known/${suffix}${path === '' ? '' : path}`,
  ];
  if (path) urls.push(`${url.origin}/.well-known/${suffix}`);
  return urls;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v ? v : undefined;
}

export async function discoverOAuthServer(
  serverUrl: string,
  hint: MCPAuthHint,
  allowPrivateNetwork: boolean,
): Promise<MCPOAuthServer> {
  let resourceMeta: Record<string, unknown> | null = null;
  for (const url of [
    ...(hint.resourceMetadataUrl ? [hint.resourceMetadataUrl] : []),
    ...wellKnown(serverUrl, 'oauth-protected-resource'),
  ]) {
    resourceMeta = await getJson(url, allowPrivateNetwork);
    if (resourceMeta) break;
  }

  const servers = Array.isArray(resourceMeta?.['authorization_servers'])
    ? (resourceMeta?.['authorization_servers'] as unknown[]).filter(
        (s): s is string => typeof s === 'string',
      )
    : [];
  const issuer = servers[0] ?? new URL(serverUrl).origin;

  let asMeta: Record<string, unknown> | null = null;
  const issuerUrl = new URL(issuer);
  const issuerPath = issuerUrl.pathname.replace(/\/$/, '');
  for (const url of [
    `${issuerUrl.origin}/.well-known/oauth-authorization-server${issuerPath}`,
    `${issuerUrl.origin}/.well-known/openid-configuration${issuerPath}`,
    ...(issuerPath
      ? [`${issuerUrl.origin}${issuerPath}/.well-known/openid-configuration`]
      : []),
  ]) {
    asMeta = await getJson(url, allowPrivateNetwork);
    if (asMeta) break;
  }

  // 2025-03-26 servers with no metadata: endpoints default to the origin.
  const origin = issuerUrl.origin;
  const authorizationEndpoint =
    str(asMeta?.['authorization_endpoint']) ??
    (asMeta ? undefined : `${origin}/authorize`);
  const tokenEndpoint =
    str(asMeta?.['token_endpoint']) ?? (asMeta ? undefined : `${origin}/token`);
  if (!authorizationEndpoint || !tokenEndpoint) {
    throw new MCPOAuthError(
      "The server's authorization metadata has no authorization or token endpoint.",
    );
  }
  const methods = asMeta?.['code_challenge_methods_supported'];
  if (Array.isArray(methods) && methods.length && !methods.includes('S256')) {
    throw new MCPOAuthError(
      'The authorization server does not support PKCE (S256), which MCP requires.',
    );
  }

  const scopesSupported = resourceMeta?.['scopes_supported'];
  const scope =
    hint.scope ??
    (Array.isArray(scopesSupported) && scopesSupported.length
      ? scopesSupported.filter((s) => typeof s === 'string').join(' ')
      : undefined);
  const authMethods = asMeta?.['token_endpoint_auth_methods_supported'];

  return {
    issuer: str(asMeta?.['issuer']) ?? issuer,
    authorizationEndpoint,
    tokenEndpoint,
    registrationEndpoint:
      str(asMeta?.['registration_endpoint']) ??
      (asMeta ? undefined : `${origin}/register`),
    resource: str(resourceMeta?.['resource']) ?? canonicalResource(serverUrl),
    ...(scope ? { scope } : {}),
    tokenAuthMethods: Array.isArray(authMethods)
      ? authMethods.filter((m): m is string => typeof m === 'string')
      : ['client_secret_basic'],
  };
}

/** RFC 7591 dynamic client registration. */
export async function registerClient(
  server: MCPOAuthServer,
  redirectUri: string,
  allowPrivateNetwork: boolean,
): Promise<MCPOAuthClient> {
  if (!server.registrationEndpoint) {
    throw new MCPOAuthError(
      "This server doesn't allow automatic app registration. Create an OAuth app in the provider's developer console, then add its client ID and secret on this connection.",
    );
  }
  const reply = await request(
    server.registrationEndpoint,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        client_name: 'Onetab AI',
        redirect_uris: [redirectUri],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        ...(server.scope ? { scope: server.scope } : {}),
      }),
    },
    allowPrivateNetwork,
  );
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(reply.body);
  } catch {
    /* handled below */
  }
  const clientId = str(body['client_id']);
  if (reply.status < 200 || reply.status >= 300 || !clientId) {
    throw new MCPOAuthError(
      `Automatic app registration failed (HTTP ${reply.status}${str(body['error_description']) ? `: ${body['error_description']}` : ''}). Add a client ID and secret from the provider's developer console on this connection.`,
    );
  }
  return {
    clientId,
    ...(str(body['client_secret'])
      ? { clientSecret: str(body['client_secret']) }
      : {}),
  };
}

export function createPkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  return {
    verifier,
    challenge: createHash('sha256').update(verifier).digest('base64url'),
  };
}

export function buildAuthorizeUrl(
  server: MCPOAuthServer,
  client: MCPOAuthClient,
  redirectUri: string,
  state: string,
  codeChallenge: string,
): string {
  const url = new URL(server.authorizationEndpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', client.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', codeChallenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('resource', server.resource);
  if (server.scope) url.searchParams.set('scope', server.scope);
  return url.toString();
}

async function tokenRequest(
  server: Pick<
    MCPOAuthServer,
    'tokenEndpoint' | 'tokenAuthMethods' | 'resource'
  >,
  client: MCPOAuthClient,
  params: Record<string, string>,
  allowPrivateNetwork: boolean,
): Promise<MCPTokenSet> {
  const form = new URLSearchParams({ ...params, resource: server.resource });
  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
  };
  if (
    client.clientSecret &&
    !server.tokenAuthMethods.includes('client_secret_post')
  ) {
    const basic = Buffer.from(
      `${encodeURIComponent(client.clientId)}:${encodeURIComponent(client.clientSecret)}`,
    ).toString('base64');
    headers['authorization'] = `Basic ${basic}`;
  } else {
    form.set('client_id', client.clientId);
    if (client.clientSecret) form.set('client_secret', client.clientSecret);
  }

  const reply = await request(
    server.tokenEndpoint,
    { method: 'POST', headers, body: form.toString() },
    allowPrivateNetwork,
  );
  let body: Record<string, unknown> = {};
  try {
    body = JSON.parse(reply.body);
  } catch {
    /* handled below */
  }
  const accessToken = str(body['access_token']);
  if (reply.status < 200 || reply.status >= 300 || !accessToken) {
    const reason =
      str(body['error_description']) ??
      str(body['error']) ??
      `HTTP ${reply.status}`;
    throw new MCPOAuthError(
      `The authorization server did not issue a token (${reason}).`,
    );
  }
  const expiresIn = Number(body['expires_in']);
  return {
    accessToken,
    ...(str(body['refresh_token'])
      ? { refreshToken: str(body['refresh_token']) }
      : {}),
    ...(Number.isFinite(expiresIn) && expiresIn > 0
      ? { expiresAt: Date.now() + expiresIn * 1000 }
      : {}),
    ...(str(body['scope']) ? { scope: str(body['scope']) } : {}),
  };
}

export function exchangeCode(
  server: Pick<
    MCPOAuthServer,
    'tokenEndpoint' | 'tokenAuthMethods' | 'resource'
  >,
  client: MCPOAuthClient,
  code: string,
  codeVerifier: string,
  redirectUri: string,
  allowPrivateNetwork: boolean,
): Promise<MCPTokenSet> {
  return tokenRequest(
    server,
    client,
    {
      grant_type: 'authorization_code',
      code,
      code_verifier: codeVerifier,
      redirect_uri: redirectUri,
    },
    allowPrivateNetwork,
  );
}

export function refreshAccessToken(
  server: Pick<
    MCPOAuthServer,
    'tokenEndpoint' | 'tokenAuthMethods' | 'resource'
  >,
  client: MCPOAuthClient,
  refreshToken: string,
  allowPrivateNetwork: boolean,
): Promise<MCPTokenSet> {
  return tokenRequest(
    server,
    client,
    { grant_type: 'refresh_token', refresh_token: refreshToken },
    allowPrivateNetwork,
  );
}
