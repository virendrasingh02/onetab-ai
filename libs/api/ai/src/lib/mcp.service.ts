import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { assertPublicHttpUrl, UnsafeUrlError } from '@org/api-common';
import { PrismaService } from '@org/database';
import type {
  CreateMCPConnectionInput,
  UpdateMCPConnectionInput,
} from '@org/types';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { AIEncryptionService } from './ai-encryption.service.js';
import {
  callMCPTool,
  discoverMCPTools,
  MCPAuthRequiredError,
  mcpToolNeedsApproval,
  type MCPCallResult,
  type MCPEndpoint,
  type MCPToolDescriptor,
} from './mcp-client.js';
import {
  buildAuthorizeUrl,
  createPkce,
  discoverOAuthServer,
  exchangeCode,
  refreshAccessToken,
  registerClient,
  type MCPAuthHint,
  type MCPOAuthClient,
  type MCPOAuthServer,
  type MCPTokenSet,
} from './mcp-oauth.js';

/** How long a started sign-in stays valid. */
const OAUTH_PENDING_TTL_MS = 15 * 60_000;
/** Refresh an access token this long before it expires. */
const REFRESH_SKEW_MS = 60_000;

/** What the API returns for a connection — never the token. */
export interface MCPConnectionView {
  id: string;
  workspaceId: string;
  name: string;
  serverUrl: string;
  transport: string;
  status: string;
  isEnabled: boolean;
  hasToken: boolean;
  maskedToken: string | null;
  /** NONE, a pasted bearer TOKEN, or an OAUTH sign-in. */
  authMode: 'NONE' | 'TOKEN' | 'OAUTH';
  /** Signed in through OAuth and holding an access token. */
  oauthConnected: boolean;
  /** The OAuth client in use — entered by a member or registered automatically. */
  oauthClientId: string | null;
  oauthClientSource: 'MANUAL' | 'DYNAMIC' | null;
  /** Register this as the redirect URI when creating an OAuth app by hand. */
  oauthRedirectUri: string;
  discoveredToolsJson: MCPToolDescriptor[];
  lastError: string | null;
  lastSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A tool an agent may call, bound to the connection that serves it. The
 * function name is what the model sees: OpenAI-style tool names allow
 * `[a-zA-Z0-9_-]{1,64}`, so it is derived, and mapped back on call.
 */
export interface MCPToolBinding {
  functionName: string;
  connectionId: string;
  connectionName: string;
  toolName: string;
  requiresApproval: boolean;
  schema: Record<string, unknown>;
}

interface StoredOAuth {
  clientId?: string;
  encryptedClientSecret?: string;
  clientSource?: 'MANUAL' | 'DYNAMIC';
  /** The redirect URI a dynamic client was registered with. */
  registeredRedirectUri?: string;
  /** Discovered at sign-in; reused for refreshes. */
  server?: MCPOAuthServer;
  /** What the server's last 401 said. */
  hint?: MCPAuthHint;
  encryptedAccessToken?: string;
  encryptedRefreshToken?: string;
  expiresAt?: number;
  scope?: string;
  /** An in-flight sign-in. */
  pending?: { state: string; encryptedVerifier: string; createdAt: number };
}

interface StoredAuth {
  encryptedToken?: string;
  maskedToken?: string;
  /** Rows written before tokens were encrypted. Migrated on first use. */
  token?: string;
  oauth?: StoredOAuth;
}

export interface MCPOAuthOutcome {
  ok: boolean;
  connectionName?: string;
  message: string;
}

type ConnectionRow = Awaited<
  ReturnType<PrismaService['mCPConnection']['findFirst']>
> &
  object;

/** `mcp_<first 6 of id>_<tool>` — stable, unique per connection, within 64 chars. */
export function mcpFunctionName(
  connectionId: string,
  toolName: string,
): string {
  const safeTool = toolName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `mcp_${connectionId.slice(-6)}_${safeTool}`.slice(0, 64);
}

/**
 * Workspace MCP servers: a real Streamable-HTTP handshake on create and sync,
 * discovered tools stored for agents to use, the bearer token encrypted at
 * rest. This used to mark every connection CONNECTED with invented tool names
 * and store the token in plain text, without contacting the server.
 */
@Injectable()
export class MCPService {
  private readonly logger = new Logger(MCPService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: AIEncryptionService,
    private readonly config: ConfigService,
  ) {}

  private get allowPrivateNetwork(): boolean {
    return this.config.get<string>('AI_ALLOW_PRIVATE_NETWORK') === 'true';
  }

  async listConnections(workspaceId: string): Promise<MCPConnectionView[]> {
    const rows = await this.prisma.mCPConnection.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toView(row));
  }

  async getConnection(workspaceId: string, id: string) {
    const conn = await this.prisma.mCPConnection.findFirst({
      where: { id, workspaceId },
    });
    if (!conn) throw new NotFoundException('MCP connection not found');
    return conn;
  }

  async createConnection(
    workspaceId: string,
    userId: string | undefined,
    data: CreateMCPConnectionInput,
  ) {
    await this.assertReachableUrl(data.serverUrl);
    const token = data.token?.trim();
    const row = await this.prisma.mCPConnection.create({
      data: {
        workspaceId,
        createdById: userId,
        name: data.name.trim(),
        serverUrl: data.serverUrl.trim(),
        transport: 'HTTP',
        status: 'DISCONNECTED',
        authConfig: {
          ...(token
            ? {
                encryptedToken: this.encryption.encrypt(token),
                maskedToken: this.encryption.maskApiKey(token),
              }
            : {}),
          ...this.manualClient({}, data.oauthClientId, data.oauthClientSecret),
        } as any,
        discoveredToolsJson: [],
      },
    });
    return this.handshake(row);
  }

  /** `{ oauth }` with a member-entered client applied; `{}` when nothing changes. */
  private manualClient(
    current: StoredAuth,
    clientId: string | undefined,
    clientSecret: string | undefined,
  ): { oauth?: StoredOAuth } {
    if (clientId === undefined && clientSecret === undefined) return {};
    const id = clientId?.trim();
    const prev = current.oauth ?? {};
    if (clientId !== undefined && !id) {
      // Clearing the client also drops its tokens; a dynamic one is re-registered.
      return { oauth: {} };
    }
    const changed = !!id && id !== prev.clientId;
    return {
      oauth: {
        ...(changed ? {} : prev),
        clientId: id ?? prev.clientId,
        clientSource: 'MANUAL',
        ...(clientSecret !== undefined
          ? clientSecret.trim()
            ? {
                encryptedClientSecret: this.encryption.encrypt(
                  clientSecret.trim(),
                ),
              }
            : { encryptedClientSecret: undefined }
          : changed
            ? {}
            : { encryptedClientSecret: prev.encryptedClientSecret }),
      },
    };
  }

  /**
   * Renames, re-points, re-keys or toggles a server. A new URL or token
   * re-runs the handshake so the stored tools always match what is saved.
   */
  async updateConnection(
    workspaceId: string,
    id: string,
    data: UpdateMCPConnectionInput,
  ) {
    const conn = await this.getConnection(workspaceId, id);
    const serverUrl = data.serverUrl?.trim();
    const urlChanged = !!serverUrl && serverUrl !== conn.serverUrl;
    if (urlChanged) await this.assertReachableUrl(serverUrl);

    const token = data.token?.trim();
    const tokenChanged = data.token !== undefined;
    const current = (conn.authConfig ?? {}) as StoredAuth;
    const clientPatch = this.manualClient(
      current,
      data.oauthClientId,
      data.oauthClientSecret,
    );
    const clientChanged = 'oauth' in clientPatch;
    let authConfig: StoredAuth | undefined;
    if (tokenChanged || clientChanged || urlChanged) {
      const { encryptedToken, maskedToken, token: legacy, oauth } = current;
      authConfig = {
        ...(tokenChanged
          ? token
            ? {
                encryptedToken: this.encryption.encrypt(token),
                maskedToken: this.encryption.maskApiKey(token),
              }
            : {}
          : { encryptedToken, maskedToken, token: legacy }),
        // A new URL is a different resource: its tokens don't carry over.
        oauth: clientChanged
          ? clientPatch.oauth
          : urlChanged
            ? oauth?.clientSource === 'MANUAL'
              ? {
                  clientId: oauth.clientId,
                  encryptedClientSecret: oauth.encryptedClientSecret,
                  clientSource: 'MANUAL',
                }
              : {}
            : oauth,
      };
    }
    const updated = await this.prisma.mCPConnection.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(urlChanged ? { serverUrl } : {}),
        ...(data.isEnabled !== undefined ? { isEnabled: data.isEnabled } : {}),
        ...(authConfig ? { authConfig: authConfig as any } : {}),
      },
    });
    // Re-enabling a server that never connected is a good moment to retry too.
    const reconnect =
      urlChanged ||
      tokenChanged ||
      clientChanged ||
      (data.isEnabled === true && updated.status !== 'CONNECTED');
    return reconnect ? this.handshake(updated) : this.toView(updated);
  }

  /** Runs one tool by hand, from the registry page. Same path agents use. */
  async testTool(
    workspaceId: string,
    id: string,
    toolName: string,
    args: Record<string, unknown>,
  ) {
    try {
      return await this.callTool(workspaceId, id, toolName, args);
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      )
        throw err;
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(
        `The server did not run '${toolName}': ${message}`,
      );
    }
  }

  async deleteConnection(workspaceId: string, id: string) {
    await this.getConnection(workspaceId, id);
    await this.prisma.mCPConnection.delete({ where: { id } });
  }

  async syncTools(workspaceId: string, id: string) {
    const conn = await this.getConnection(workspaceId, id);
    return this.handshake(conn);
  }

  /** Every tool on this workspace's enabled, connected servers. */
  async getToolBindings(workspaceId: string): Promise<MCPToolBinding[]> {
    const rows = await this.prisma.mCPConnection.findMany({
      where: { workspaceId, isEnabled: true, status: 'CONNECTED' },
    });
    const bindings: MCPToolBinding[] = [];
    for (const row of rows) {
      for (const tool of this.tools(row)) {
        const functionName = mcpFunctionName(row.id, tool.name);
        bindings.push({
          functionName,
          connectionId: row.id,
          connectionName: row.name,
          toolName: tool.name,
          requiresApproval: mcpToolNeedsApproval(tool),
          schema: {
            type: 'function',
            function: {
              name: functionName,
              description:
                `[${row.name}] ${tool.description ?? tool.name}`.slice(0, 1024),
              parameters: tool.inputSchema ?? {
                type: 'object',
                properties: {},
              },
            },
          },
        });
      }
    }
    return bindings;
  }

  async callTool(
    workspaceId: string,
    connectionId: string,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<MCPCallResult> {
    const conn = await this.getConnection(workspaceId, connectionId);
    if (!conn.isEnabled)
      throw new BadRequestException(`MCP server '${conn.name}' is disabled.`);
    if (!this.tools(conn).some((t) => t.name === toolName)) {
      throw new BadRequestException(
        `'${toolName}' is not a tool on MCP server '${conn.name}'.`,
      );
    }
    try {
      return await callMCPTool(await this.endpointFor(conn), toolName, args);
    } catch (err) {
      if (!(err instanceof MCPAuthRequiredError)) throw err;
      // An access token can be revoked before it expires: refresh once.
      let authErr: MCPAuthRequiredError = err;
      const refreshed = await this.refreshTokens(conn, true);
      if (refreshed) {
        try {
          return await callMCPTool(
            await this.endpointFor(refreshed),
            toolName,
            args,
          );
        } catch (retryErr) {
          if (!(retryErr instanceof MCPAuthRequiredError)) throw retryErr;
          authErr = retryErr;
        }
      }
      await this.markNeedsAuth(refreshed ?? conn, authErr.hint);
      throw new BadRequestException(
        `MCP server '${conn.name}' needs you to sign in again. Open Tools → MCP servers and choose Sign in.`,
      );
    }
  }

  /* -------------------------------------------------------------- OAuth ---- */

  /** Where the authorization server sends the member back. */
  get oauthRedirectUri(): string {
    const base = (
      this.config.get<string>('API_URL') || 'http://localhost:3000'
    ).replace(/\/+$/, '');
    return `${base}/api/v1/mcp-oauth/callback`;
  }

  /**
   * Discovers the server's authorization server, registers a client when the
   * server allows it (else uses the one a member entered), and returns the URL
   * to open. The PKCE verifier stays here, encrypted, until the callback.
   */
  async startOAuth(
    workspaceId: string,
    id: string,
  ): Promise<{ authorizeUrl: string }> {
    const conn = await this.getConnection(workspaceId, id);
    const auth = (conn.authConfig ?? {}) as StoredAuth;
    const oauth: StoredOAuth = { ...(auth.oauth ?? {}) };
    const redirectUri = this.oauthRedirectUri;

    try {
      const server = await discoverOAuthServer(
        conn.serverUrl,
        oauth.hint ?? {},
        this.allowPrivateNetwork,
      );
      let client = this.clientOf(oauth);
      const stale =
        oauth.clientSource === 'DYNAMIC' &&
        oauth.registeredRedirectUri !== redirectUri;
      if (!client || stale) {
        client = await registerClient(
          server,
          redirectUri,
          this.allowPrivateNetwork,
        );
        oauth.clientId = client.clientId;
        oauth.encryptedClientSecret = client.clientSecret
          ? this.encryption.encrypt(client.clientSecret)
          : undefined;
        oauth.clientSource = 'DYNAMIC';
        oauth.registeredRedirectUri = redirectUri;
      }

      const { verifier, challenge } = createPkce();
      const nonce = randomBytes(24).toString('base64url');
      oauth.server = server;
      oauth.pending = {
        state: nonce,
        encryptedVerifier: this.encryption.encrypt(verifier),
        createdAt: Date.now(),
      };
      await this.saveOAuth(conn, auth, oauth);
      return {
        authorizeUrl: buildAuthorizeUrl(
          server,
          client,
          redirectUri,
          `${conn.id}.${nonce}`,
          challenge,
        ),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(
        `Could not start sign-in for '${conn.name}': ${message}`,
      );
    }
  }

  /** The public callback: checks state, swaps the code, re-runs the handshake. */
  async completeOAuth(query: {
    state?: string;
    code?: string;
    error?: string;
    error_description?: string;
  }): Promise<MCPOAuthOutcome> {
    const [connId, nonce] = (query.state ?? '').split('.');
    if (!connId || !nonce) {
      return {
        ok: false,
        message: 'This sign-in link is invalid. Start again from Onetab AI.',
      };
    }
    const conn = await this.prisma.mCPConnection.findUnique({
      where: { id: connId },
    });
    const auth = (conn?.authConfig ?? {}) as StoredAuth;
    const pending = auth.oauth?.pending;
    if (
      !conn ||
      !pending ||
      !safeEqual(pending.state, nonce) ||
      Date.now() - pending.createdAt > OAUTH_PENDING_TTL_MS
    ) {
      return {
        ok: false,
        message:
          'This sign-in expired or was already used. Start again from Onetab AI.',
      };
    }
    // One use only, whatever happens next.
    const oauth: StoredOAuth = { ...auth.oauth, pending: undefined };
    if (query.error || !query.code) {
      await this.saveOAuth(conn, auth, oauth);
      return {
        ok: false,
        connectionName: conn.name,
        message:
          query.error_description ||
          query.error ||
          'The server did not return an authorization code.',
      };
    }

    const client = this.clientOf(oauth);
    if (!client || !oauth.server) {
      await this.saveOAuth(conn, auth, oauth);
      return {
        ok: false,
        connectionName: conn.name,
        message: 'The sign-in lost its client. Start again.',
      };
    }
    try {
      const tokens = await exchangeCode(
        oauth.server,
        client,
        query.code,
        this.encryption.decrypt(pending.encryptedVerifier),
        this.oauthRedirectUri,
        this.allowPrivateNetwork,
      );
      const saved = await this.saveOAuth(
        conn,
        auth,
        this.withTokens(oauth, tokens),
      );
      const view = await this.handshake(saved);
      return view.status === 'CONNECTED'
        ? {
            ok: true,
            connectionName: conn.name,
            message: `${conn.name} is connected with ${view.discoveredToolsJson.length} tools.`,
          }
        : {
            ok: false,
            connectionName: conn.name,
            message:
              view.lastError ?? 'Signed in, but the MCP handshake failed.',
          };
    } catch (err) {
      await this.saveOAuth(conn, auth, oauth);
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`MCP OAuth for '${conn.name}' failed: ${message}`);
      return { ok: false, connectionName: conn.name, message };
    }
  }

  /** Forgets the OAuth tokens (keeps the client, so signing in again is one click). */
  async signOutOAuth(workspaceId: string, id: string) {
    const conn = await this.getConnection(workspaceId, id);
    const auth = (conn.authConfig ?? {}) as StoredAuth;
    const prev = auth.oauth ?? {};
    const saved = await this.saveOAuth(conn, auth, {
      clientId: prev.clientId,
      encryptedClientSecret: prev.encryptedClientSecret,
      clientSource: prev.clientSource,
      registeredRedirectUri: prev.registeredRedirectUri,
    });
    return this.handshake(saved);
  }

  /* ------------------------------------------------------------ internal ---- */

  private clientOf(oauth: StoredOAuth): MCPOAuthClient | null {
    if (!oauth.clientId) return null;
    return {
      clientId: oauth.clientId,
      ...(oauth.encryptedClientSecret
        ? { clientSecret: this.encryption.decrypt(oauth.encryptedClientSecret) }
        : {}),
    };
  }

  private withTokens(oauth: StoredOAuth, tokens: MCPTokenSet): StoredOAuth {
    return {
      ...oauth,
      encryptedAccessToken: this.encryption.encrypt(tokens.accessToken),
      // Servers that don't rotate refresh tokens omit it on refresh.
      encryptedRefreshToken: tokens.refreshToken
        ? this.encryption.encrypt(tokens.refreshToken)
        : oauth.encryptedRefreshToken,
      expiresAt: tokens.expiresAt,
      scope: tokens.scope ?? oauth.scope,
    };
  }

  private saveOAuth(
    conn: ConnectionRow,
    auth: StoredAuth,
    oauth: StoredOAuth,
  ): Promise<ConnectionRow> {
    return this.prisma.mCPConnection.update({
      where: { id: conn.id },
      data: { authConfig: { ...auth, oauth } as any },
    });
  }

  /**
   * Swaps the refresh token for a new access token when it is about to expire
   * (or always, with `force`). The saved row, or null when there is nothing to
   * refresh with or the server refused.
   */
  private async refreshTokens(
    conn: ConnectionRow,
    force = false,
  ): Promise<ConnectionRow | null> {
    const auth = (conn.authConfig ?? {}) as StoredAuth;
    const oauth = auth.oauth;
    if (!oauth?.encryptedRefreshToken || !oauth.server) return null;
    if (
      !force &&
      (!oauth.expiresAt || oauth.expiresAt - REFRESH_SKEW_MS > Date.now())
    )
      return null;
    const client = this.clientOf(oauth);
    if (!client) return null;
    try {
      const tokens = await refreshAccessToken(
        oauth.server,
        client,
        this.encryption.decrypt(oauth.encryptedRefreshToken),
        this.allowPrivateNetwork,
      );
      return await this.saveOAuth(conn, auth, this.withTokens(oauth, tokens));
    } catch (err) {
      this.logger.warn(
        `MCP token refresh for '${conn.name}' failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }

  private async markNeedsAuth(conn: ConnectionRow, hint: MCPAuthHint) {
    const auth = (conn.authConfig ?? {}) as StoredAuth;
    const oauth = auth.oauth ?? {};
    return this.prisma.mCPConnection.update({
      where: { id: conn.id },
      data: {
        status: 'NEEDS_AUTH',
        discoveredToolsJson: [],
        lastError: oauth.encryptedAccessToken
          ? 'Your sign-in expired or was revoked. Sign in again to reconnect.'
          : auth.encryptedToken || auth.token
            ? 'The server refused the saved token. Sign in with OAuth, or replace the token.'
            : 'This server needs you to sign in before its tools can be used.',
        authConfig: {
          ...auth,
          oauth: {
            ...oauth,
            hint,
            // A refused access token is useless; keep the refresh token.
            encryptedAccessToken: undefined,
            expiresAt: undefined,
          },
        } as any,
        lastSyncedAt: new Date(),
      },
    });
  }

  private async handshake(conn: ConnectionRow): Promise<MCPConnectionView> {
    try {
      let tools: MCPToolDescriptor[];
      try {
        ({ tools } = await discoverMCPTools(await this.endpointFor(conn)));
      } catch (err) {
        const refreshed =
          err instanceof MCPAuthRequiredError
            ? await this.refreshTokens(conn, true)
            : null;
        if (!refreshed) throw err;
        conn = refreshed;
        ({ tools } = await discoverMCPTools(await this.endpointFor(conn)));
      }
      const updated = await this.prisma.mCPConnection.update({
        where: { id: conn.id },
        data: {
          status: 'CONNECTED',
          discoveredToolsJson: tools as any,
          lastError: null,
          lastSyncedAt: new Date(),
        },
      });
      return this.toView(updated);
    } catch (err) {
      if (err instanceof MCPAuthRequiredError) {
        return this.toView(await this.markNeedsAuth(conn, err.hint));
      }
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`MCP handshake with '${conn.name}' failed: ${message}`);
      const updated = await this.prisma.mCPConnection.update({
        where: { id: conn.id },
        data: {
          status: 'ERROR',
          discoveredToolsJson: [],
          lastError: message.slice(0, 500),
          lastSyncedAt: new Date(),
        },
      });
      return this.toView(updated);
    }
  }

  private async endpointFor(conn: ConnectionRow): Promise<MCPEndpoint> {
    // A token about to expire is refreshed first.
    conn = (await this.refreshTokens(conn)) ?? conn;
    const auth = (conn.authConfig ?? {}) as StoredAuth;
    let token: string | undefined;
    if (auth.oauth?.encryptedAccessToken) {
      token = this.encryption.decrypt(auth.oauth.encryptedAccessToken);
    } else if (auth.encryptedToken) {
      token = this.encryption.decrypt(auth.encryptedToken);
    } else if (auth.token) {
      // Encrypt a legacy plaintext token the first time it is used.
      token = auth.token;
      const { token: _legacy, ...rest } = auth;
      await this.prisma.mCPConnection.update({
        where: { id: conn.id },
        data: {
          authConfig: {
            ...rest,
            encryptedToken: this.encryption.encrypt(token),
            maskedToken: this.encryption.maskApiKey(token),
          } as any,
        },
      });
    }
    return {
      url: conn.serverUrl,
      token,
      allowPrivateNetwork: this.allowPrivateNetwork,
    };
  }

  private async assertReachableUrl(url: string) {
    if (this.allowPrivateNetwork) return;
    try {
      await assertPublicHttpUrl(url);
    } catch (err) {
      if (err instanceof UnsafeUrlError) {
        throw new BadRequestException(
          `That server URL can't be used: ${err.message} Private MCP servers need AI_ALLOW_PRIVATE_NETWORK=true on the API.`,
        );
      }
      throw err;
    }
  }

  private tools(row: ConnectionRow): MCPToolDescriptor[] {
    return Array.isArray(row.discoveredToolsJson)
      ? (row.discoveredToolsJson as unknown as MCPToolDescriptor[])
      : [];
  }

  private toView(row: ConnectionRow): MCPConnectionView {
    const auth = (row.authConfig ?? {}) as StoredAuth;
    const hasToken = !!(auth.encryptedToken || auth.token);
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      name: row.name,
      serverUrl: row.serverUrl,
      transport: row.transport,
      status: row.status,
      isEnabled: row.isEnabled,
      hasToken,
      maskedToken:
        auth.maskedToken ??
        (auth.token ? this.encryption.maskApiKey(auth.token) : null),
      authMode:
        auth.oauth?.encryptedAccessToken || auth.oauth?.encryptedRefreshToken
          ? 'OAUTH'
          : hasToken
            ? 'TOKEN'
            : 'NONE',
      oauthConnected: !!auth.oauth?.encryptedAccessToken,
      oauthClientId: auth.oauth?.clientId ?? null,
      oauthClientSource: auth.oauth?.clientSource ?? null,
      oauthRedirectUri: this.oauthRedirectUri,
      discoveredToolsJson: this.tools(row),
      lastError: row.lastError ?? null,
      lastSyncedAt: row.lastSyncedAt ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
