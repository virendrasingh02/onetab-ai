import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import type {
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
import { SSRFGuardService } from '../core/ssrf-guard.service.js';

@Injectable()
export class CustomApiProvider implements ProviderAdapter {
  readonly providerId = 'CUSTOM_API';
  private readonly logger = new Logger(CustomApiProvider.name);

  constructor(private readonly ssrfGuard: SSRFGuardService) {}

  getCapabilities(): IntegrationCapabilities {
    return {
      provider: this.providerId,
      displayName: 'Custom External API',
      description:
        'Connect any external REST API with flexible authentication, SSRF protection, custom headers, and request execution.',
      category: 'Developer Tools',
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
