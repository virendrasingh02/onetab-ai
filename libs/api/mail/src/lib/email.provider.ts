import type { EmailPayload, EmailProvider, EmailProviderSendResult } from './email.types.js';

export type { EmailPayload, EmailProvider, EmailProviderSendResult };

export interface EmailProviderStatus {
  ready: boolean;
  provider: string;
  isProductionReady: boolean;
  defaultFrom: string;
  defaultReplyTo?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
  error?: string;
}

export interface EmailWebhookResult {
  handled: boolean;
  event: string;
  providerMessageId?: string;
  recipient?: string;
  status?: string;
  metadata?: Record<string, unknown>;
}

export abstract class BaseEmailProvider implements EmailProvider {
  abstract readonly name: string;
  abstract send(payload: EmailPayload): Promise<EmailProviderSendResult>;

  /** Whether the driver has the credentials it needs to attempt a real send. */
  get configured(): boolean {
    return true;
  }

  async verify(): Promise<boolean> {
    return this.configured;
  }

  async getStatus(): Promise<EmailProviderStatus> {
    return {
      ready: true,
      provider: this.name,
      isProductionReady: false,
      defaultFrom: 'noreply@onetab.ai',
    };
  }

  async handleWebhook(
    _body: unknown,
    _headers?: Record<string, string>,
  ): Promise<EmailWebhookResult> {
    return { handled: false, event: 'unknown' };
  }
}
