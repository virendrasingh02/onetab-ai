import { BadRequestException, Injectable } from '@nestjs/common';
import {
  customActionDefinition,
  customTriggerDefinitions,
  renderCustomRequest,
  type AppActionDefinition,
  type AppActionResult,
  type ConnectorTriggerDefinition,
  type CustomConnectorAction,
  type CustomConnectorDefinition,
  type IntegrationAccount,
  type IntegrationCapabilities,
} from '@org/types';
import { IntegrationEncryptionService } from '../core/integration-encryption.service.js';
import type {
  ProviderAdapter,
  ResolvedCredential,
  SyncResult,
  WebhookProcessResult,
} from '../core/provider-adapter.interface.js';
import { CustomApiProvider, customApiConfigFromMetadata } from './custom-api.provider.js';

/** The metadata key a custom connector's definition (no secrets) is stored under. */
export const CUSTOM_CONNECTOR_KEY = 'customConnector';

export function customDefinitionFromMetadata(metadata: Record<string, unknown>): CustomConnectorDefinition | null {
  const def = metadata[CUSTOM_CONNECTOR_KEY] as CustomConnectorDefinition | undefined;
  return def && typeof def === 'object' && Array.isArray(def.actions) ? def : null;
}

/**
 * One adapter for every connector a workspace defined itself. Each connection
 * carries its own definition (name, base URL, actions, events), so the actions
 * are per connection (`getActionsFor`); the HTTP itself — auth, SSRF checks,
 * retries — is the Custom API provider's.
 *
 * It is not in the manager's adapter map: the manager hands it out for any
 * provider key made by `customConnectorProviderKey`.
 */
@Injectable()
export class CustomConnectorProvider implements ProviderAdapter {
  readonly providerId = 'CUSTOM_CONNECTOR';

  constructor(
    private readonly http: CustomApiProvider,
    private readonly encryption: IntegrationEncryptionService,
  ) {}

  getCapabilities(): IntegrationCapabilities {
    return {
      provider: this.providerId,
      displayName: 'Custom connector',
      description: 'An app this workspace described itself: a REST API and the actions it offers.',
      category: 'Custom Apps',
      connectorCategory: 'custom',
      authType: 'API_KEY_HEADER',
      supportsSync: false,
      supportsWebhooks: false,
      supportsMessaging: false,
      supportsCustomEndpoints: true,
    };
  }

  getActionsFor(credential: ResolvedCredential): AppActionDefinition[] {
    return (customDefinitionFromMetadata(credential.metadata)?.actions ?? []).map(customActionDefinition);
  }

  getTriggersFor(credential: ResolvedCredential): ConnectorTriggerDefinition[] {
    return customTriggerDefinitions(customDefinitionFromMetadata(credential.metadata)?.triggers ?? []);
  }

  async executeAction(
    credential: ResolvedCredential,
    actionId: string,
    input: Record<string, unknown>,
  ): Promise<AppActionResult> {
    const definition = customDefinitionFromMetadata(credential.metadata);
    const action = definition?.actions.find((a) => a.id === actionId);
    if (!definition || !action) throw new BadRequestException(`This connector has no action '${actionId}'.`);
    return this.run(credential, action, input);
  }

  /** Sends one action's request — also what the builder's "Test run" uses. */
  async run(
    credential: ResolvedCredential,
    action: CustomConnectorAction,
    input: Record<string, unknown>,
  ): Promise<AppActionResult> {
    let request;
    try {
      request = renderCustomRequest(action, input);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : String(error));
    }
    const config = customApiConfigFromMetadata(credential.metadata, (c) => this.encryption.decrypt(c));
    const res = await this.http.executeCustomRequest(config, {
      method: request.method,
      path: request.path,
      query: request.query,
      ...(request.body !== undefined ? { body: request.body } : {}),
    });
    const ok = res.status >= 200 && res.status < 300;
    const target = `${request.method} ${request.path || '/'}`;
    return {
      success: ok,
      message: ok ? `${target} → ${res.status} ${res.statusText}` : `${target} failed: ${res.status} ${res.statusText}`,
      data: res.data,
    };
  }

  /** Asks the API's root for an answer: throws only when it can't be reached (network, SSRF block). */
  async probe(credential: ResolvedCredential): Promise<{ status: number }> {
    const config = customApiConfigFromMetadata(credential.metadata, (c) => this.encryption.decrypt(c));
    const res = await this.http.executeCustomRequest(config, { method: 'GET', path: '' });
    return { status: res.status };
  }

  /**
   * "Is it reachable and does it accept this sign-in?" Many APIs 404 their
   * root, so only a refused credential or a server error counts as a failure.
   */
  async getAccount(credential: ResolvedCredential): Promise<IntegrationAccount> {
    const definition = customDefinitionFromMetadata(credential.metadata);
    const { status } = await this.probe(credential);
    if (status === 401 || status === 403) {
      throw new Error(`The API refused the saved sign-in (HTTP ${status}). Check the key or token.`);
    }
    if (status >= 500) throw new Error(`The API answered with HTTP ${status}.`);
    const baseUrl = String(credential.metadata['baseUrl'] ?? '');
    return {
      id: credential.id,
      provider: this.providerId,
      accountId: baseUrl,
      name: definition?.name ?? 'Custom connector',
      scopes: [],
      status: 'CONNECTED',
      connectedAt: new Date().toISOString(),
      metadata: { baseUrl, authType: credential.metadata['authType'], status },
    };
  }

  async disconnect(): Promise<void> {
    // Nothing to revoke: the credentials only ever lived here.
  }

  async sync(): Promise<SyncResult> {
    return { success: true, itemsProcessed: 0 };
  }

  async handleWebhook(payload: unknown): Promise<WebhookProcessResult> {
    return { success: true, eventType: 'custom_connector.event', data: payload };
  }

  async testConnection(
    _config: Record<string, unknown>,
    credential?: ResolvedCredential,
  ): Promise<{ success: boolean; message: string }> {
    if (!credential) return { success: false, message: 'Create the connector first, then test it.' };
    try {
      const account = await this.getAccount(credential);
      return { success: true, message: `Reached ${account.accountId}.` };
    } catch (error) {
      return { success: false, message: error instanceof Error ? error.message : String(error) };
    }
  }
}
