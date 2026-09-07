import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface MailSendResult {
  /** `true` when the message was handed to a transport without error. */
  delivered: boolean;
  transport: 'log' | 'http';
  /** Provider message id, when the transport returns one. */
  id?: string;
}

/**
 * Transactional email.
 *
 * Two transports, chosen by `MAIL_TRANSPORT`:
 *   - `log` (default): renders the message to the logger. No external service —
 *     safe in every environment, including CI and local dev.
 *   - `http`: POSTs `{ from, to, subject, html, text }` to `MAIL_API_URL` with
 *     `Authorization: Bearer ${MAIL_API_KEY}`. This is the shape Resend,
 *     Postmark and SendGrid's v3 "mail/send" all accept, so a real provider is
 *     a config change, not a code change.
 *
 * `send` never throws for a transport failure — a bounced reset email must not
 * 500 the request that triggered it. Failures are logged and reflected in
 * `delivered: false`.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {}

  private get from(): string {
    return this.config.get<string>('MAIL_FROM') ?? 'noreply@onetab.ai';
  }

  private get transport(): 'log' | 'http' {
    return this.config.get<string>('MAIL_TRANSPORT') === 'http' ? 'http' : 'log';
  }

  async send(message: MailMessage): Promise<MailSendResult> {
    if (this.transport === 'http') {
      return this.sendViaHttp(message);
    }
    this.logger.log(
      `[mail:log] to=${message.to} subject=${JSON.stringify(
        message.subject,
      )}\n${message.text}`,
    );
    return { delivered: true, transport: 'log' };
  }

  private async sendViaHttp(message: MailMessage): Promise<MailSendResult> {
    const url = this.config.get<string>('MAIL_API_URL');
    const key = this.config.get<string>('MAIL_API_KEY');
    if (!url) {
      this.logger.error(
        'MAIL_TRANSPORT=http but MAIL_API_URL is unset — email not sent.',
      );
      return { delivered: false, transport: 'http' };
    }
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(key ? { authorization: `Bearer ${key}` } : {}),
        },
        body: JSON.stringify({
          from: this.from,
          to: message.to,
          subject: message.subject,
          html: message.html,
          text: message.text,
        }),
      });
      if (!res.ok) {
        this.logger.error(
          `Mail provider returned HTTP ${res.status} for ${message.to}`,
        );
        return { delivered: false, transport: 'http' };
      }
      const body = (await res.json().catch(() => ({}))) as { id?: string };
      return { delivered: true, transport: 'http', id: body.id };
    } catch (err) {
      this.logger.error(
        `Mail provider request failed for ${message.to}`,
        err instanceof Error ? err.stack : String(err),
      );
      return { delivered: false, transport: 'http' };
    }
  }
}
