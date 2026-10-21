import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AppActionDefinition,
  AppActionResult,
  ConnectorTriggerDefinition,
  IntegrationAccount,
  IntegrationCapabilities,
} from '@org/types';
import { connectorRequest, ConnectorHttpError } from './connector-http.js';
import { oauthEnv } from './oauth-app-context.js';
import { formEncode, type HttpMethod, type RestCallOptions, type RestTarget } from './rest-connector.js';
import { SSRFGuardService } from './ssrf-guard.service.js';
import type {
  ProviderAdapter,
  ResolvedCredential,
  SyncResult,
  TokenResult,
  WebhookProcessResult,
} from './provider-adapter.interface.js';

export type OAuthCall = <T = any>(method: HttpMethod, path: string, options?: RestCallOptions) => Promise<T>;

/** What an action sees: the connection's account details (realm, tenant, base URI…) and a bound HTTP caller. */
export interface OAuthActionContext {
  metadata: Record<string, unknown>;
  input: Record<string, unknown>;
  call: OAuthCall;
}

export interface OAuthAction extends AppActionDefinition {
  run(ctx: OAuthActionContext): Promise<{ message: string; data?: unknown }>;
}

/** Same shape as `action()` in rest-connector, for OAuth connectors. */
export function oauthAction(
  spec: {
    id: string;
    label: string;
    description: string;
    level: 'read' | 'write' | 'destructive';
    properties?: Record<string, unknown>;
    required?: string[];
  },
  run: OAuthAction['run'],
): OAuthAction {
  return {
    id: spec.id,
    label: spec.label,
    description: spec.description,
    inputSchema: {
      type: 'object',
      properties: spec.properties ?? {},
      ...(spec.required?.length ? { required: spec.required } : {}),
    },
    permissionLevel: spec.level,
    // Anything that changes data in the app asks for approval first.
    requiresConfirmation: spec.level !== 'read',
    run,
  };
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

/**
 * Base for apps that only offer OAuth 2.0 authorization-code access
 * (QuickBooks, Xero, DocuSign). The client id/secret come from the server env
 * or the workspace's own OAuth app (`oauthEnv`), the tokens are stored
 * encrypted by the integration manager, which also refreshes them and keeps
 * a rotated refresh token. A subclass says where to authorize, how to find
 * the account the token belongs to (a realm, tenant or base URI kept in the
 * connection's metadata) and lists its actions.
 */
@Injectable()
export abstract class OAuthRestConnector implements ProviderAdapter {
  abstract readonly providerId: string;
  /** Name used in messages. */
  protected abstract readonly app: string;
  /** Env var prefix: `<PREFIX>_CLIENT_ID`, `<PREFIX>_CLIENT_SECRET`, `<PREFIX>_REDIRECT_URI`. */
  protected abstract readonly envPrefix: string;
  /** `/api/v1/integrations/<callbackPath>/callback`. */
  protected abstract readonly callbackPath: string;
  protected abstract readonly authorizeUrl: string;
  protected abstract readonly tokenUrl: string;
  protected abstract readonly defaultScopes: readonly string[];

  protected abstract capabilities(): Omit<
    IntegrationCapabilities,
    'provider' | 'authType' | 'supportsSync' | 'supportsWebhooks' | 'supportsMessaging' | 'supportsCustomEndpoints'
  >;
  /** Where API calls for this connection go. */
  protected abstract target(accessToken: string, metadata: Record<string, unknown>): RestTarget;
  /**
   * Who the token belongs to, right after authorization: a display label plus
   * anything later calls need (`realmId`, `tenantId`, `baseUri`), stored in metadata.
   */
  protected abstract describeAccount(
    accessToken: string,
    callbackParams: Record<string, string>,
  ): Promise<{ label: string; accountId?: string; email?: string; metadata?: Record<string, unknown> }>;
  /** A cheap authenticated read for "Test connection"; returns a label. */
  protected abstract ping(call: OAuthCall, metadata: Record<string, unknown>): Promise<string>;
  protected abstract actions(): OAuthAction[];
  protected triggers(): ConnectorTriggerDefinition[] {
    return [];
  }
  /** Extra query parameters for the consent screen. */
  protected authorizeParams(): Record<string, string> {
    return {};
  }

  constructor(
    protected readonly ssrf: SSRFGuardService,
    protected readonly config: ConfigService,
  ) {}

  getCapabilities(): IntegrationCapabilities {
    return {
      provider: this.providerId,
      authType: 'OAUTH2',
      supportsSync: false,
      supportsWebhooks: false,
      supportsMessaging: false,
      supportsCustomEndpoints: false,
      ...this.capabilities(),
    };
  }

  isServerConfigured(): boolean {
    return Boolean(this.env('CLIENT_ID') && this.env('CLIENT_SECRET'));
  }

  getActions(): AppActionDefinition[] {
    return this.actions().map(({ run: _run, ...definition }) => definition);
  }

  getTriggers(): ConnectorTriggerDefinition[] {
    return this.triggers();
  }

  private env(key: string) {
    return oauthEnv(this.config, `${this.envPrefix}_${key}`);
  }

  private client() {
    const clientId = this.env('CLIENT_ID');
    const clientSecret = this.env('CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new BadRequestException(
        `${this.app} isn’t set up on this server (${this.envPrefix}_CLIENT_ID / ${this.envPrefix}_CLIENT_SECRET missing). ` +
          `A workspace admin can add their own ${this.app} OAuth app in Connectors → OAuth apps.`,
      );
    }
    return { clientId, clientSecret };
  }

  protected redirectUri(override?: string) {
    return (
      override ||
      this.config.get<string>(`${this.envPrefix}_REDIRECT_URI`) ||
      `http://localhost:3000/api/v1/integrations/${this.callbackPath}/callback`
    );
  }

  async getAuthorizationUrl(state: string, options?: { redirectUri?: string; scopes?: string[] }): Promise<string> {
    const { clientId } = this.client();
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: this.redirectUri(options?.redirectUri),
      scope: (options?.scopes?.length ? options.scopes : this.defaultScopes).join(' '),
      state,
      ...this.authorizeParams(),
    });
    return `${this.authorizeUrl}?${params.toString()}`;
  }

  private async token(body: Record<string, string>): Promise<TokenResponse> {
    const { clientId, clientSecret } = this.client();
    try {
      const res = await connectorRequest<TokenResponse>(this.app, {
        method: 'POST',
        url: this.tokenUrl,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        auth: { username: clientId, password: clientSecret },
        data: formEncode(body),
        // A code or refresh token is single-use: never resend it.
        retries: 0,
        httpAgent: this.ssrf.agents.httpAgent,
        httpsAgent: this.ssrf.agents.httpsAgent,
      });
      if (!res.data?.access_token) {
        throw new UnauthorizedException(res.data?.error_description || res.data?.error || `${this.app} returned no access token.`);
      }
      return res.data;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException(`${this.app} refused the authorization: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private toTokenResult(token: TokenResponse): TokenResult {
    return {
      accessToken: token.access_token as string,
      refreshToken: token.refresh_token,
      expiresIn: token.expires_in,
      tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : undefined,
      scopes: token.scope ? token.scope.split(/[ ,]+/).filter(Boolean) : [...this.defaultScopes],
    };
  }

  async handleCallback(
    code: string,
    _state: string,
    options?: { redirectUri?: string; params?: Record<string, string> },
  ): Promise<TokenResult> {
    const token = await this.token({
      grant_type: 'authorization_code',
      code,
      redirect_uri: this.redirectUri(options?.redirectUri),
    });
    const result = this.toTokenResult(token);
    const account = await this.describeAccount(result.accessToken, options?.params ?? {});
    return {
      ...result,
      accountId: account.accountId,
      accountEmail: account.email,
      accountName: account.label,
      metadata: account.metadata,
    };
  }

  async refreshToken(refreshToken: string): Promise<TokenResult> {
    return this.toTokenResult(await this.token({ grant_type: 'refresh_token', refresh_token: refreshToken }));
  }

  protected caller(accessToken: string, metadata: Record<string, unknown>): OAuthCall {
    return async (method, path, options = {}) => {
      const target = this.target(accessToken, metadata);
      const headers: Record<string, string> = { Accept: 'application/json', ...target.headers };
      let data = options.data;
      if (options.form && data && typeof data === 'object') {
        data = formEncode(data as Record<string, unknown>);
        headers['Content-Type'] = 'application/x-www-form-urlencoded';
      }
      const res = await connectorRequest(this.app, {
        method,
        url: `${target.baseUrl}${path}`,
        headers,
        params: { ...target.params, ...options.params },
        data,
        httpAgent: this.ssrf.agents.httpAgent,
        httpsAgent: this.ssrf.agents.httpsAgent,
      });
      return res.data;
    };
  }

  async getAccount(credential: ResolvedCredential): Promise<IntegrationAccount> {
    const label = await this.ping(this.caller(credential.accessToken, credential.metadata), credential.metadata);
    return {
      id: credential.id,
      provider: this.providerId,
      accountId: String(credential.metadata['accountId'] ?? credential.id),
      email: (credential.metadata['accountEmail'] as string) || undefined,
      name: label,
      scopes: credential.scopes,
      status: 'CONNECTED',
      connectedAt: new Date().toISOString(),
      metadata: {},
    };
  }

  async disconnect(): Promise<void> {
    // The person revokes access in the app; the stored tokens are deleted with the connection.
  }

  async sync(): Promise<SyncResult> {
    return { success: true, itemsProcessed: 0 };
  }

  async handleWebhook(payload: unknown): Promise<WebhookProcessResult> {
    return { success: true, eventType: `${this.providerId.toLowerCase()}.webhook`, data: payload };
  }

  async testConnection(
    _config: Record<string, unknown>,
    credential?: ResolvedCredential,
  ): Promise<{ success: boolean; message: string; details?: unknown }> {
    if (!credential) return { success: false, message: `Connect ${this.app} first — it signs in with OAuth.` };
    try {
      const label = await this.ping(this.caller(credential.accessToken, credential.metadata), credential.metadata);
      return { success: true, message: `Connected to ${this.app} (${label}).`, details: { displayName: `${this.app} · ${label}` } };
    } catch (error) {
      return { success: false, message: `${this.app} connection failed: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  async executeAction(
    credential: ResolvedCredential,
    actionId: string,
    input: Record<string, unknown>,
  ): Promise<AppActionResult> {
    const definition = this.actions().find((a) => a.id === actionId);
    if (!definition) throw new BadRequestException(`Unknown ${this.app} action '${actionId}'.`);
    try {
      const out = await definition.run({
        metadata: credential.metadata,
        input,
        call: this.caller(credential.accessToken, credential.metadata),
      });
      return { success: true, message: out.message, data: out.data };
    } catch (error) {
      if (error instanceof ConnectorHttpError) return { success: false, message: error.message };
      throw error;
    }
  }
}
