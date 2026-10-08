import { Logger } from '@nestjs/common';
import { BaseEmailProvider } from '../email.provider.js';
import type { EmailPayload, EmailProviderSendResult } from '../email.types.js';

export interface CapturedEmail extends EmailPayload {
  sentAt: Date;
  id: string;
}

/** Captured mail is for tests and local inspection; keep only the tail so a
 * long-running log-transport process does not hoard message bodies (which
 * carry sign-in links and codes). */
const MAX_CAPTURED = 200;

export class LogEmailProvider extends BaseEmailProvider {
  readonly name = 'log';
  private readonly logger = new Logger(LogEmailProvider.name);
  private static readonly sentEmails: CapturedEmail[] = [];

  constructor(private readonly mode: 'live' | 'test' = 'live') {
    super();
  }

  async send(payload: EmailPayload): Promise<EmailProviderSendResult> {
    const id = 'log_' + Math.random().toString(36).slice(2, 10);
    const recipients = Array.isArray(payload.to) ? payload.to.join(', ') : payload.to;

    LogEmailProvider.sentEmails.push({
      ...payload,
      sentAt: new Date(),
      id,
    });
    if (LogEmailProvider.sentEmails.length > MAX_CAPTURED) {
      LogEmailProvider.sentEmails.splice(0, LogEmailProvider.sentEmails.length - MAX_CAPTURED);
    }

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

  override async verify(): Promise<boolean> {
    return true;
  }

  override async getStatus() {
    return {
      ready: true,
      provider: this.name,
      isProductionReady: false,
      defaultFrom: 'dev@onetab.local',
      details: {
        mode: this.mode,
        sentCount: LogEmailProvider.sentEmails.length,
      },
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
