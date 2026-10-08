import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type {
  AppActionDefinition,
  AppActionResult,
  ConnectorTriggerDefinition,
  IntegrationAccount,
  IntegrationCapabilities,
  IntegrationCustomApiConfig,
  IntegrationExecuteRequestInput,
  IntegrationExecuteResponse,
} from '@org/types';
import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import type {
  ProviderAdapter,
  ResolvedCredential,
  SyncResult,
  WebhookProcessResult,
} from '../core/provider-adapter.interface.js';
import { IntegrationEncryptionService } from '../core/integration-encryption.service.js';
import { SSRFGuardService } from '../core/ssrf-guard.service.js';

/**
 * A custom API connection's request config from its stored metadata, with
 * the encrypted key / token / password / headers decrypted.
 */
export function customApiConfigFromMetadata(
  metadata: Record<string, unknown>,
  decrypt: (ciphertext: string) => string,
): IntegrationCustomApiConfig {
  const m = metadata as Record<string, any>;
  return {
    baseUrl: m.baseUrl,
    authType: m.authType,
    apiKey: m.encryptedApiKey ? decrypt(m.encryptedApiKey) : m.apiKey,
    apiKeyHeader: m.apiKeyHeader,
    apiKeyQueryParam: m.apiKeyQueryParam,
    bearerToken: m.encryptedBearer ? decrypt(m.encryptedBearer) : m.bearerToken,
    basicUsername: m.basicUsername,
    basicPassword: m.encryptedBasicPass ? decrypt(m.encryptedBasicPass) : m.basicPassword,
    customHeaders: m.encryptedCustomHeaders
      ? (JSON.parse(decrypt(m.encryptedCustomHeaders)) as Record<string, string>)
      : m.customHeaders,
    queryParams: m.queryParams,
    timeoutMs: m.timeoutMs,
    retryAttempts: m.retryAttempts,
  };
}

const asRecord = (value: unknown): Record<string, string> | undefined => {
  if (!value) return undefined;
  if (typeof value === 'string') {
    try {
      return asRecord(JSON.parse(value));
    } catch {
      return undefined;
    }
  }
  if (typeof value !== 'object' || Array.isArray(value)) return undefined;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, String(v)]));
};

@Injectable()
export class CustomApiProvider implements ProviderAdapter {
  readonly providerId = 'CUSTOM_API';
  private readonly logger = new Logger(CustomApiProvider.name);

  constructor(
    private readonly ssrfGuard: SSRFGuardService,
    private readonly encryption: IntegrationEncryptionService,
  ) {}

  /**
   * Two generic actions make any connected REST API usable by agents and
   * workflows: a read (`get`) and a write (`send`). Paths are relative to the
   * connection's base URL, which SSRF checks guard on every call.
   */
  getActions(): AppActionDefinition[] {
    return [
      {
        id: 'get',
        label: 'Get data',
        description: 'Send a GET request to a path on this API and return the JSON it answers with.',
        inputSchema: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path after the base URL, e.g. /orders' },
            query: { type: 'object', description: 'Query parameters as JSON, e.g. {"status":"open"}' },
          },
          required: ['path'],
        },
        permissionLevel: 'read',
        requiresConfirmation: false,
      },
      {
        id: 'send',
        label: 'Send data',
        description: 'Send a POST, PUT, PATCH or DELETE request to a path on this API.',
        inputSchema: {
          type: 'object',
          properties: {
            method: { type: 'string', enum: ['POST', 'PUT', 'PATCH', 'DELETE'] },
            path: { type: 'string', description: 'Path after the base URL, e.g. /orders/42' },
            body: { type: 'object', description: 'JSON body' },
            query: { type: 'object', description: 'Query parameters as JSON' },
          },
          required: ['method', 'path'],
        },
        permissionLevel: 'write',
        requiresConfirmation: true,
      },
    ];
  }

  /** Any path that answers with a JSON list can start an agent. */
  getTriggers(): ConnectorTriggerDefinition[] {
    return [
      {
        id: 'new_item',
        label: 'New item',
        description: 'Starts the agent for each new item in a list this API returns (items need an "id").',
        pollActionId: 'get',
        itemsPath: '',
        idField: 'id',
      },
    ];
  }

  async executeAction(
    credential: ResolvedCredential,
    actionId: string,
    input: Record<string, unknown>,
  ): Promise<AppActionResult> {
    const config = customApiConfigFromMetadata(credential.metadata, (c) => this.encryption.decrypt(c));
    const path = typeof input['path'] === 'string' ? input['path'] : '';
    const method =
      actionId === 'get'
        ? 'GET'
        : String(input['method'] ?? '').toUpperCase();
    if (actionId !== 'get' && actionId !== 'send') {
      throw new BadRequestException(`Unknown custom API action '${actionId}'.`);
    }
    if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      throw new BadRequestException('Pick a method: POST, PUT, PATCH or DELETE.');
    }
    let body = input['body'];
    if (typeof body === 'string' && body.trim()) {
      try {
        body = JSON.parse(body);
      } catch {
        /* send it as text */
      }
    }
    const res = await this.executeCustomRequest(config, {
      method: method as IntegrationExecuteRequestInput['method'],
      path,
      query: asRecord(input['query']),
      ...(method === 'GET' ? {} : { body }),
    });
    const ok = res.status >= 200 && res.status < 300;
    return {
      success: ok,
      message: ok ? `${method} ${path || '/'} → ${res.status} ${res.statusText}` : `${method} ${path || '/'} failed: ${res.status} ${res.statusText}`,
      data: res.data,
    };
  }

  getCapabilities(): IntegrationCapabilities {
    return {
      provider: this.providerId,
      displayName: 'Custom External API',
      description:
        'Connect any external REST API with flexible authentication, SSRF protection, custom headers, and request execution.',
      category: 'Developer Tools',
      connectorCategory: 'custom',
      authType: 'API_KEY_HEADER',
      supportsSync: true,
      supportsWebhooks: true,
      supportsMessaging: false,
      supportsCustomEndpoints: true,
    };
  }

  async getAccount(credential: ResolvedCredential): Promise<IntegrationAccount> {
    const config = credential.metadata as unknown as IntegrationCustomApiConfig;
    return {
      id: credential.id,
      provider: this.providerId,
      accountId: config.baseUrl || 'custom-api',
      name: (credential.metadata['displayName'] as string) || 'Custom REST API',
      scopes: [],
      status: 'CONNECTED',
      connectedAt: new Date().toISOString(),
      metadata: {
        baseUrl: config.baseUrl,
        authType: config.authType,
      },
    };
  }

  async disconnect(_credential: ResolvedCredential): Promise<void> {
    // Custom API requires no external token revocation
  }

  async testConnection(
    config: Record<string, unknown>,
    _credential?: ResolvedCredential,
  ): Promise<{ success: boolean; message: string; details?: unknown }> {
    const customConfig = config as unknown as IntegrationCustomApiConfig;
    if (!customConfig.baseUrl) {
      return { success: false, message: 'Base URL is required to test custom API connection.' };
    }

    try {
      // Validate SSRF security
      await this.ssrfGuard.validateUrl(customConfig.baseUrl);

      const startTime = Date.now();
      const response = await this.executeHttpRequest(
        customConfig,
        'GET',
        '',
        undefined,
        undefined,
        customConfig.timeoutMs ?? 10000,
      );

      const durationMs = Date.now() - startTime;
      return {
        success: response.status >= 200 && response.status < 400,
        message: `Connection test responded with HTTP ${response.status} in ${durationMs}ms`,
        details: {
          status: response.status,
          durationMs,
          data: response.data,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Connection test failed: ${err.message}`,
        details: err.response ? { status: err.response.status, data: err.response.data } : undefined,
      };
    }
  }

  async executeCustomRequest(
    config: IntegrationCustomApiConfig,
    req: IntegrationExecuteRequestInput,
  ): Promise<IntegrationExecuteResponse> {
    if (!config.baseUrl) {
      throw new BadRequestException('Integration has no baseUrl configured.');
    }

    const startTime = Date.now();
    const response = await this.executeHttpRequest(
      config,
      req.method,
      req.path || '',
      req.query,
      req.body,
      config.timeoutMs ?? 15000,
      req.headers,
    );

    return {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers as Record<string, string>,
      data: response.data,
      durationMs: Date.now() - startTime,
    };
  }

  async sync(
    credential: ResolvedCredential,
    _cursor?: string,
  ): Promise<SyncResult> {
    const config = credential.metadata as unknown as IntegrationCustomApiConfig;
    const testResult = await this.testConnection(config as any, credential);

    return {
      success: testResult.success,
      itemsProcessed: testResult.success ? 1 : 0,
      metadata: { testResult },
    };
  }

  async handleWebhook(
    payload: unknown,
    _headers: Record<string, string>,
  ): Promise<WebhookProcessResult> {
    return {
      success: true,
      eventType: 'custom_api.event',
      data: payload,
    };
  }

  // --- HTTP Execution with SSRF Guard & Auth Synthesis ------------------------

  private async executeHttpRequest(
    config: IntegrationCustomApiConfig,
    method: string,
    path: string,
    query?: Record<string, string>,
    body?: unknown,
    timeoutMs = 15000,
    overrideHeaders?: Record<string, string>,
  ): Promise<AxiosResponse> {
    // Construct target URL
    const cleanBase = config.baseUrl.replace(/\/+$/, '');
    const cleanPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
    const fullUrl = `${cleanBase}${cleanPath}`;

    // SSRF validation
    await this.ssrfGuard.validateUrl(fullUrl);

    // Build headers
    const headers: Record<string, string> = {
      'User-Agent': 'OneTab-AI-Integration/1.0',
      Accept: 'application/json, text/plain, */*',
      ...(config.customHeaders || {}),
      ...(overrideHeaders || {}),
    };

    // Apply Authentication
    const queryParams: Record<string, string> = {
      ...(config.queryParams || {}),
      ...(query || {}),
    };

    if (config.authType === 'BEARER' && config.bearerToken) {
      headers['Authorization'] = `Bearer ${config.bearerToken}`;
    } else if (config.authType === 'API_KEY_HEADER' && config.apiKey) {
      const headerName = config.apiKeyHeader || 'X-API-Key';
      headers[headerName] = config.apiKey;
    } else if (config.authType === 'API_KEY_QUERY' && config.apiKey) {
      const paramName = config.apiKeyQueryParam || 'apiKey';
      queryParams[paramName] = config.apiKey;
    } else if (config.authType === 'BASIC' && config.basicUsername) {
      const authString = Buffer.from(
        `${config.basicUsername}:${config.basicPassword || ''}`,
      ).toString('base64');
      headers['Authorization'] = `Basic ${authString}`;
    }

    const axiosConfig: AxiosRequestConfig = {
      method: method.toLowerCase() as any,
      url: fullUrl,
      headers,
      params: queryParams,
      data: body,
      timeout: timeoutMs,
      validateStatus: () => true, // Don't throw for 4xx/5xx so caller receives full response
      // The URL was validated above; a redirect would swap in one that was
      // not, and a DNS answer could change before the socket opens. Return
      // redirects to the caller and re-check the address at connect time.
      maxRedirects: 0,
      httpAgent: this.ssrfGuard.agents.httpAgent,
      httpsAgent: this.ssrfGuard.agents.httpsAgent,
    };

    // Retry with exponential backoff on network errors
    const maxRetries = config.retryAttempts ?? 2;
    let attempt = 0;

    while (attempt <= maxRetries) {
      try {
        const response = await axios(axiosConfig);
        return response;
      } catch (err: any) {
        attempt++;
        if (attempt > maxRetries) {
          throw err;
        }
        const delay = Math.min(1000 * 2 ** attempt, 10000);
        this.logger.warn(`Custom API request failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries}): ${err.message}`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw new Error('Request failed after retries.');
  }
}
