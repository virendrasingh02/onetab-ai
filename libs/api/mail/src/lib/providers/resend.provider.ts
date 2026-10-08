import { Logger } from '@nestjs/common';
import { BaseEmailProvider } from '../email.provider.js';
import type { EmailPayload, EmailProviderSendResult } from '../email.types.js';
import {
  EmailAuthenticationError,
  EmailConfigurationError,
  EmailRateLimitError,
  EmailTransientError,
  EmailValidationError,
} from '../email.errors.js';

export interface ResendProviderOptions {
  apiKey?: string;
  apiUrl?: string;
  defaultFrom?: string;
  defaultReplyTo?: string;
  timeoutMs?: number;
  maxRetries?: number;
  initialBackoffMs?: number;
}

export class ResendProvider extends BaseEmailProvider {
  readonly name = 'resend';
  private readonly logger = new Logger(ResendProvider.name);
  private readonly apiKey?: string;
  private readonly apiUrl?: string;
  private readonly defaultFrom: string;
  private readonly defaultReplyTo?: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;

  constructor(options: ResendProviderOptions) {
    super();
    this.apiKey = options.apiKey;
    this.apiUrl = options.apiUrl;
    this.defaultFrom = options.defaultFrom || 'Mie <noreply@askmie.ai>';
    this.defaultReplyTo = options.defaultReplyTo;
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.maxRetries = options.maxRetries ?? 3;
    this.initialBackoffMs = options.initialBackoffMs ?? 200;
  }

  override get configured(): boolean {
    return Boolean(this.apiKey || this.apiUrl);
  }

  async send(payload: EmailPayload): Promise<EmailProviderSendResult> {
    const url = this.apiUrl || 'https://api.resend.com/emails';
    if (!this.apiUrl && !this.apiKey) {
      throw new EmailConfigurationError(
        'MAIL_TRANSPORT=http but neither RESEND_API_KEY nor MAIL_API_URL is configured.',
      );
    }

    const from = payload.from || this.defaultFrom;
    const replyTo = payload.replyTo || this.defaultReplyTo;

    const requestBody: Record<string, unknown> = {
      from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
    };

    if (replyTo) {
      requestBody['reply_to'] = replyTo;
    }
    if (payload.headers && Object.keys(payload.headers).length > 0) {
      requestBody['headers'] = payload.headers;
    }
    if (payload.tags && payload.tags.length > 0) {
      requestBody['tags'] = payload.tags;
    }

    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= this.maxRetries) {
      attempt++;
      try {
        return await this.executeHttpRequest(url, requestBody, payload.idempotencyKey);
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const isTransient =
          err instanceof EmailTransientError ||
          err instanceof EmailRateLimitError ||
          (err instanceof Error &&
            (err.name === 'AbortError' ||
              err.message.includes('network down') ||
              err.message.includes('fetch failed') ||
              err.message.includes('ECONNRESET') ||
              err.message.includes('ETIMEDOUT') ||
              err.message.includes('ENOTFOUND')));

        // If permanent error or max retries reached, do not retry
        if (!isTransient || attempt > this.maxRetries) {
          throw err;
        }

        const jitter = Math.random() * 50;
        const delay = this.initialBackoffMs * Math.pow(2, attempt - 1) + jitter;
        this.logger.warn(
          `Transient failure sending email to ${JSON.stringify(payload.to)} (attempt ${attempt}/${this.maxRetries}): ${lastError.message}. Retrying in ${Math.round(delay)}ms...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    throw lastError || new EmailTransientError('Failed to send email after max retries.');
  }

  private async executeHttpRequest(
    url: string,
    body: Record<string, unknown>,
    idempotencyKey?: string,
  ): Promise<EmailProviderSendResult> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
      };

      if (idempotencyKey) {
        headers['Idempotency-Key'] = idempotencyKey;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok) {
        let resData: { message?: string; error?: string; name?: string } = {};
        try {
          resData = (await res.json()) as { message?: string; error?: string; name?: string };
        } catch {
          // ignore parsing error
        }

        const rawMessage = resData.message || resData.error || `HTTP ${res.status} ${res.statusText}`;

        if (res.status === 401 || res.status === 403) {
          throw new EmailAuthenticationError(
            `Resend authentication failed (HTTP ${res.status}): ${rawMessage}`,
          );
        }

        if (res.status === 429) {
          const retryAfter = res.headers.get('retry-after');
          const retrySec = retryAfter ? parseInt(retryAfter, 10) : undefined;
          throw new EmailRateLimitError(
            `Resend rate limit exceeded (HTTP 429): ${rawMessage}`,
            retrySec,
          );
        }

        if (res.status >= 400 && res.status < 500) {
          throw new EmailValidationError(
            `Resend rejected email payload (HTTP ${res.status}): ${rawMessage}`,
            res.status,
          );
        }

        throw new EmailTransientError(
          `Resend server error (HTTP ${res.status}): ${rawMessage}`,
          res.status,
        );
      }

      const responseJson = (await res.json().catch(() => ({}))) as { id?: string };
      const id = responseJson.id;

      return {
        id: id || '',
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
        throw new EmailTransientError(`Resend request timed out after ${this.timeoutMs}ms.`);
      }

      throw new EmailTransientError(
        `Resend network error: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  override async verify(): Promise<boolean> {
    if (!this.apiKey && !this.apiUrl) return false;
    try {
      const statusUrl = (this.apiUrl || 'https://api.resend.com/emails').replace(/\/emails\/?$/, '/api-keys');
      const res = await fetch(statusUrl, {
        method: 'GET',
        headers: {
          authorization: `Bearer ${this.apiKey}`,
        },
      });
      return res.status < 500;
    } catch {
      return false;
    }
  }

  override async getStatus() {
    const isConfigured = Boolean(this.apiKey || this.apiUrl);
    return {
      ready: isConfigured,
      provider: this.name,
      isProductionReady: Boolean(this.apiKey),
      defaultFrom: this.defaultFrom,
      defaultReplyTo: this.defaultReplyTo,
      details: {
        apiUrl: this.apiUrl || 'https://api.resend.com/emails',
        hasApiKey: Boolean(this.apiKey),
        timeoutMs: this.timeoutMs,
        maxRetries: this.maxRetries,
      },
    };
  }

  override async handleWebhook(
    raw: unknown,
  ): Promise<{ handled: boolean; event: string; providerMessageId?: string; status?: string }> {
    if (!raw || typeof raw !== 'object') return { handled: false, event: 'unknown' };
    const body = raw as { type?: string; data?: { email_id?: string; id?: string } };
    const eventType = body.type || 'unknown';
    const emailData = body.data || {};
    const messageId = emailData.email_id || emailData.id;

    let status = 'SENT';
    if (eventType === 'email.delivered') status = 'DELIVERED';
    else if (eventType === 'email.bounced') status = 'BOUNCED';
    else if (eventType === 'email.complained') status = 'COMPLAINED';
    else if (eventType === 'email.opened') status = 'OPENED';
    else if (eventType === 'email.clicked') status = 'CLICKED';

    return {
      handled: true,
      event: eventType,
      providerMessageId: messageId,
      status,
    };
  }
}
