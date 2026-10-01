import { Logger } from '@nestjs/common';
import type { BaseEmailProvider } from '../email.provider.js';
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

export class ResendProvider implements BaseEmailProvider {
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
    this.apiKey = options.apiKey;
    this.apiUrl = options.apiUrl;
    this.defaultFrom = options.defaultFrom || 'Mie <noreply@askmie.ai>';
    this.defaultReplyTo = options.defaultReplyTo;
    this.timeoutMs = options.timeoutMs ?? 15000;
    this.maxRetries = options.maxRetries ?? 3;
    this.initialBackoffMs = options.initialBackoffMs ?? 200;
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
}
