import { BaseEmailProvider } from '../email.provider.js';
import type { EmailPayload, EmailProviderSendResult } from '../email.types.js';
import {
  EmailAuthenticationError,
  EmailRateLimitError,
  EmailTransientError,
  EmailValidationError,
} from '../email.errors.js';

/** Splits `"Name <addr@x>"` into SendGrid's `{ name, email }` shape. */
export function parseAddress(value: string): { email: string; name?: string } {
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(value);
  if (!match) return { email: value.trim() };
  const name = match[1].trim();
  return name ? { email: match[2].trim(), name } : { email: match[2].trim() };
}

export interface SendGridProviderOptions {
  apiKey?: string;
  defaultFrom?: string;
  defaultReplyTo?: string;
  timeoutMs?: number;
}

export class SendGridProvider extends BaseEmailProvider {
  readonly name = 'sendgrid';
  private readonly apiKey?: string;
  private readonly defaultFrom: string;
  private readonly defaultReplyTo?: string;
  private readonly timeoutMs: number;

  constructor(options: SendGridProviderOptions) {
    super();
    this.apiKey = options.apiKey;
    this.defaultFrom = options.defaultFrom || 'Mie <noreply@askmie.ai>';
    this.defaultReplyTo = options.defaultReplyTo;
    this.timeoutMs = options.timeoutMs ?? 15000;
  }

  override get configured(): boolean {
    return Boolean(this.apiKey);
  }

  async send(payload: EmailPayload): Promise<EmailProviderSendResult> {
    if (!this.apiKey) {
      throw new EmailAuthenticationError('SENDGRID_API_KEY is not configured.');
    }

    const recipients = Array.isArray(payload.to) ? payload.to : [payload.to];
    const from = payload.from || this.defaultFrom;

    const body: Record<string, unknown> = {
      personalizations: [
        {
          to: recipients.map((email) => ({ email })),
          subject: payload.subject,
        },
      ],
      from: parseAddress(from),
      content: [
        ...(payload.text ? [{ type: 'text/plain', value: payload.text }] : []),
        ...(payload.html ? [{ type: 'text/html', value: payload.html }] : []),
      ],
    };

    const replyTo = payload.replyTo || this.defaultReplyTo;
    if (replyTo) {
      body['reply_to'] = parseAddress(replyTo);
    }
    if (payload.headers && Object.keys(payload.headers).length > 0) {
      body['headers'] = payload.headers;
    }
    if (payload.tags?.length) {
      // Echoed back on SendGrid event webhooks, like Resend tags.
      body['custom_args'] = Object.fromEntries(payload.tags.map((t) => [t.name, t.value]));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          throw new EmailAuthenticationError(`SendGrid auth failed (HTTP ${res.status})`);
        }
        if (res.status === 429) {
          throw new EmailRateLimitError('SendGrid rate limit exceeded');
        }
        if (res.status >= 400 && res.status < 500) {
          throw new EmailValidationError(`SendGrid validation error (HTTP ${res.status})`, res.status);
        }
        throw new EmailTransientError(`SendGrid server error (HTTP ${res.status})`, res.status);
      }

      return {
        id: res.headers.get('x-message-id') || '',
        provider: this.name,
      };
    } catch (err: unknown) {
      if (
        err instanceof EmailAuthenticationError ||
        err instanceof EmailRateLimitError ||
        err instanceof EmailValidationError ||
        err instanceof EmailTransientError
      ) {
        throw err;
      }
      if (err instanceof Error && err.name === 'AbortError') {
        throw new EmailTransientError(`SendGrid request timed out after ${this.timeoutMs}ms.`);
      }
      throw new EmailTransientError(
        `SendGrid error: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  override async verify(): Promise<boolean> {
    if (!this.apiKey) return false;
    try {
      const res = await fetch('https://api.sendgrid.com/v3/scopes', {
        headers: { authorization: `Bearer ${this.apiKey}` },
      });
      return res.status < 400;
    } catch {
      return false;
    }
  }

  override async getStatus() {
    return {
      ready: Boolean(this.apiKey),
      provider: this.name,
      isProductionReady: Boolean(this.apiKey),
      defaultFrom: this.defaultFrom,
      defaultReplyTo: this.defaultReplyTo,
      details: {
        hasApiKey: Boolean(this.apiKey),
      },
    };
  }
}
