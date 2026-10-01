import { Logger } from '@nestjs/common';
import type { BaseEmailProvider } from '../email.provider.js';
import type { EmailPayload, EmailProviderSendResult } from '../email.types.js';

export interface CapturedEmail extends EmailPayload {
  sentAt: Date;
  id: string;
}

export class LogEmailProvider implements BaseEmailProvider {
  readonly name = 'log';
  private readonly logger = new Logger(LogEmailProvider.name);
  private static readonly sentEmails: CapturedEmail[] = [];

  constructor(private readonly mode: 'live' | 'test' = 'live') {}

  async send(payload: EmailPayload): Promise<EmailProviderSendResult> {
    const id = 'log_' + Math.random().toString(36).slice(2, 10);
    const recipients = Array.isArray(payload.to) ? payload.to.join(', ') : payload.to;

    LogEmailProvider.sentEmails.push({
      ...payload,
      sentAt: new Date(),
      id,
    });

    if (this.mode !== 'test') {
      this.logger.log(
        `[mail:log] [${id}] to=${recipients} subject=${JSON.stringify(payload.subject)}\n${payload.text}`,
      );
    }

    return {
      id,
      provider: this.name,
    };
  }

  static getSentEmails(): ReadonlyArray<CapturedEmail> {
    return [...this.sentEmails];
  }

  static getLastEmail(): CapturedEmail | undefined {
    return this.sentEmails[this.sentEmails.length - 1];
  }

  static clear(): void {
    this.sentEmails.length = 0;
  }
}
