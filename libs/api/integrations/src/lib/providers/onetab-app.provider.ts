import { Injectable, Logger } from '@nestjs/common';
import type {
  IntegrationAccount,
  IntegrationCapabilities,
  IntegrationMessage,
  SendMessageInput,
} from '@org/types';
import type {
  ProviderAdapter,
  ResolvedCredential,
  SyncResult,
  WebhookProcessResult,
} from '../core/provider-adapter.interface.js';

@Injectable()
export class OneTabAppProvider implements ProviderAdapter {
  readonly providerId = 'ONETAB_INTERNAL';
  private readonly logger = new Logger(OneTabAppProvider.name);

  getCapabilities(): IntegrationCapabilities {
    return {
      provider: this.providerId,
      displayName: 'OneTab AI Platform',
      description:
        'Native OneTab platform integration for internal channel notifications, automations, and event dispatch.',
      category: 'Internal Apps',
      authType: 'NONE',
      supportsSync: true,
      supportsWebhooks: true,
      supportsMessaging: true,
      supportsCustomEndpoints: false,
    };
  }

  async getAccount(credential: ResolvedCredential): Promise<IntegrationAccount> {
    return {
      id: credential.id,
      provider: this.providerId,
      accountId: 'onetab-system',
      name: 'OneTab Workspace Host',
      scopes: ['channels:write', 'notifications:send'],
      status: 'CONNECTED',
      connectedAt: new Date().toISOString(),
    };
  }

  async disconnect(_credential: ResolvedCredential): Promise<void> {
    // Nothing to revoke: the internal provider holds no external token.
  }

  async testConnection(
    _config: Record<string, unknown>,
  ): Promise<{ success: boolean; message: string }> {
    return { success: true, message: 'OneTab Internal provider is active and healthy.' };
  }

  async sendMessage(
    credential: ResolvedCredential,
    message: SendMessageInput,
  ): Promise<IntegrationMessage> {
    this.logger.log(`OneTab Internal message dispatched: ${message.subject}`);
    return {
      id: `internal-msg-${Date.now()}`,
      provider: this.providerId,
      integrationId: credential.id,
      from: { name: 'OneTab System', email: 'system@onetab.internal' },
      to: (Array.isArray(message.to) ? message.to : []).map((t) =>
        typeof t === 'string' ? { email: t } : t,
      ),
      subject: message.subject,
      bodyText: message.bodyText,
      bodyHtml: message.bodyHtml,
      date: new Date().toISOString(),
      isRead: true,
      labels: ['INTERNAL'],
    };
  }

  async sync(
    _credential: ResolvedCredential,
    _cursor?: string,
  ): Promise<SyncResult> {
    return { success: true, itemsProcessed: 1 };
  }

  async handleWebhook(
    payload: unknown,
    _headers: Record<string, string>,
  ): Promise<WebhookProcessResult> {
    return {
      success: true,
      eventType: 'onetab.event',
      data: payload,
    };
  }
}
