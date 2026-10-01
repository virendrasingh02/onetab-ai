import type { EmailPayload, EmailProvider, EmailProviderSendResult } from './email.types.js';

export type { EmailPayload, EmailProvider, EmailProviderSendResult };

export abstract class BaseEmailProvider implements EmailProvider {
  abstract readonly name: string;
  abstract send(payload: EmailPayload): Promise<EmailProviderSendResult>;
}
