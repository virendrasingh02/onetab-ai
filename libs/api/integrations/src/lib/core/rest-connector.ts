import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AppActionDefinition,
  AppActionResult,
  ConnectorTriggerDefinition,
  IntegrationAccount,
  IntegrationCapabilities,
} from '@org/types';
import { connectorRequest, ConnectorHttpError } from './connector-http.js';
import { SSRFGuardService } from './ssrf-guard.service.js';
import type {
  ProviderAdapter,
  ResolvedCredential,
  SyncResult,
  WebhookProcessResult,
} from './provider-adapter.interface.js';
import { parseCredentialBundle } from '../providers/credential-json.js';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/** How to reach the app for one connection. */
export interface RestTarget {
  baseUrl: string;
  headers?: Record<string, string>;
  basic?: { username: string; password: string };
  params?: Record<string, unknown>;
}

export interface RestCallOptions {
  params?: Record<string, unknown>;
  data?: unknown;
  /** Send `data` form-encoded (Stripe) instead of as JSON. */
  form?: boolean;
}

export type RestCall = <T = any>(method: HttpMethod, path: string, options?: RestCallOptions) => Promise<T>;

export interface RestActionContext<A> {
  auth: A;
  input: Record<string, unknown>;
  call: RestCall;
}

/** One action: its definition plus the code that runs it. */
export interface RestAction<A> extends AppActionDefinition {
  run(ctx: RestActionContext<A>): Promise<{ message: string; data?: unknown }>;
}

/** Action-definition shorthand so each connector stays a list of what it can do. */
export function action<A>(
  spec: {
    id: string;
    label: string;
    description: string;
    level: 'read' | 'write' | 'destructive';
    properties?: Record<string, unknown>;
    required?: string[];
  },
  run: RestAction<A>['run'],
): RestAction<A> {
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

export const str = (description: string, extra: Record<string, unknown> = {}) => ({ type: 'string', description, ...extra });
export const num = (description: string) => ({ type: 'number', description });

/** `application/x-www-form-urlencoded` with the bracket nesting Stripe expects (`metadata[k]=v`). */
export function formEncode(data: Record<string, unknown>, prefix = ''): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null || value === '') continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(value)) {
      value.forEach((v, i) =>
        parts.push(
          typeof v === 'object' && v !== null
            ? formEncode(v as Record<string, unknown>, `${name}[${i}]`)
            : `${encodeURIComponent(`${name}[${i}]`)}=${encodeURIComponent(String(v))}`,
        ),
      );
    } else if (typeof value === 'object') {
      parts.push(formEncode(value as Record<string, unknown>, name));
    } else {
      parts.push(`${encodeURIComponent(name)}=${encodeURIComponent(String(value))}`);
    }
  }
  return parts.filter(Boolean).join('&');
}

/** Drops empty values so optional inputs never overwrite data with blanks. */
export function compactObject<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, v]) => v !== undefined && v !== null && v !== ''),
  ) as Partial<T>;
}

/**
 * Base for connectors that talk to one REST API with a manually entered
 * credential. A subclass says how to reach the app (`target`), how to prove the
 * credential works (`ping`) and lists its actions — everything else (account
 * lookup, connection test, secret masking, error handling, SSRF-guarded HTTP,
 * the approval flag on writes) is shared, so a new app is only its actions.
 */
@Injectable()
export abstract class RestConnector<A extends Record<string, string>> implements ProviderAdapter {
  abstract readonly providerId: string;
  /** Name used in messages ("HubSpot"). */
  protected abstract readonly app: string;
  /** Credential keys that must be filled in. */
  protected abstract readonly requiredFields: ReadonlyArray<keyof A & string>;
  /** The subset of credential fields that are secrets. */
  protected abstract readonly secrets: string[];

  protected abstract capabilities(): Omit<
    IntegrationCapabilities,
    'provider' | 'supportsSync' | 'supportsWebhooks' | 'supportsMessaging' | 'supportsCustomEndpoints'
  >;
  protected abstract target(auth: A): RestTarget | Promise<RestTarget>;
  /** A cheap authenticated read; returns a label for "Connected to …". */
  protected abstract ping(auth: A, call: RestCall): Promise<{ label: string; accountId?: string; email?: string }>;
  protected abstract actions(): RestAction<A>[];
  /** Rejects a credential that can't work before any request is made (a malformed domain). */
  protected validate(_auth: A): void {
    // Most apps have nothing to check beyond the required fields.
  }
  protected triggers(): ConnectorTriggerDefinition[] {
    return [];
  }

  constructor(protected readonly ssrf: SSRFGuardService) {}

  getCapabilities(): IntegrationCapabilities {
    return {
      provider: this.providerId,
      supportsSync: false,
      supportsWebhooks: false,
      supportsMessaging: false,
      supportsCustomEndpoints: false,
      ...this.capabilities(),
    };
  }

  secretFields(): string[] {
    return this.secrets;
  }

  getTriggers(): ConnectorTriggerDefinition[] {
    return this.triggers();
  }

  getActions(): AppActionDefinition[] {
    // The `run` closure is server-only; callers get the plain definition.
    return this.actions().map(({ run: _run, ...definition }) => definition);
  }

  private read(accessToken: string): A {
    const auth = parseCredentialBundle<A>(accessToken, this.app, this.requiredFields);
    this.validate(auth);
    return auth;
  }

  private caller(auth: A): RestCall {
    return async (method, path, options = {}) => {
      const target = await this.target(auth);
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
        auth: target.basic,
        httpAgent: this.ssrf.agents.httpAgent,
        httpsAgent: this.ssrf.agents.httpsAgent,
      });
      return res.data;
    };
  }

  async getAccount(credential: ResolvedCredential): Promise<IntegrationAccount> {
    const auth = this.read(credential.accessToken);
    const me = await this.ping(auth, this.caller(auth));
    return {
      id: credential.id,
      provider: this.providerId,
      accountId: me.accountId ?? credential.id,
      email: me.email,
      name: me.label,
      scopes: credential.scopes,
      status: 'CONNECTED',
      connectedAt: new Date().toISOString(),
      metadata: {},
    };
  }

  async disconnect(): Promise<void> {
    // The key or token is revoked in the app itself by its owner.
  }

  async sync(): Promise<SyncResult> {
    return { success: true, itemsProcessed: 0 };
  }

  async handleWebhook(payload: unknown): Promise<WebhookProcessResult> {
    return { success: true, eventType: `${this.providerId.toLowerCase()}.webhook`, data: payload };
  }

  async testConnection(
    config: Record<string, unknown>,
    credential?: ResolvedCredential,
  ): Promise<{ success: boolean; message: string; details?: unknown }> {
    try {
      const auth = this.read(credential ? credential.accessToken : JSON.stringify(config));
      const me = await this.ping(auth, this.caller(auth));
      return {
        success: true,
        message: `Connected to ${this.app} (${me.label}).`,
        details: { displayName: `${this.app} · ${me.label}` },
      };
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
    const auth = this.read(credential.accessToken);
    try {
      const out = await definition.run({ auth, input, call: this.caller(auth) });
      return { success: true, message: out.message, data: out.data };
    } catch (error) {
      if (error instanceof ConnectorHttpError) return { success: false, message: error.message };
      throw error;
    }
  }
}
