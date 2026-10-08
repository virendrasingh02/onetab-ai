import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BaseEmailProvider, EmailProviderStatus } from '../email.provider.js';
import { resolveEmailConfig, type EmailConfig } from '../email.config.js';
import { EmailValidationError } from '../email.errors.js';
import type { EmailPayload, EmailProviderSendResult } from '../email.types.js';
import { LogEmailProvider } from './log.provider.js';
import { ResendProvider } from './resend.provider.js';
import { SendGridProvider } from './sendgrid.provider.js';
import { SmtpProvider } from './smtp.provider.js';

/** Real drivers in auto-selection order. SMTP is excluded until it can send. */
const AUTO_ORDER = ['resend', 'sendgrid'] as const;

/**
 * Owns every outbound email driver and decides which one a send goes through.
 *
 * - `MAIL_TRANSPORT=log` (or `MAIL_MODE=test`) → everything goes to the log driver.
 * - `MAIL_TRANSPORT=http` → `MAIL_PROVIDER` if set, otherwise the first configured
 *   real driver; the remaining configured drivers form the failover chain.
 *   The log driver is never a fallback: "delivered" must mean the mail left.
 */
@Injectable()
export class EmailProviderManager {
  private readonly logger = new Logger(EmailProviderManager.name);
  private readonly providers = new Map<string, BaseEmailProvider>();
  private readonly config: EmailConfig;
  readonly primaryName: string;
  readonly fallbackNames: string[];

  constructor(private readonly configService: ConfigService) {
    this.config = resolveEmailConfig(this.configService);
    const { from, replyTo } = this.config;

    this.register(new LogEmailProvider(this.config.mode));
    this.register(
      new ResendProvider({
        apiKey: this.config.resendApiKey,
        // Only an explicit URL counts as configuration; the default endpoint
        // alone cannot authenticate.
        apiUrl:
          this.configService.get<string>('RESEND_API_URL') ||
          this.configService.get<string>('MAIL_API_URL'),
        defaultFrom: from,
        defaultReplyTo: replyTo,
        // The queue retries whole sends; keep in-request retries short so
        // synchronous callers (sign-in links) are not held for long.
        maxRetries: 2,
      }),
    );
    this.register(
      new SendGridProvider({
        apiKey: this.configService.get<string>('SENDGRID_API_KEY'),
        defaultFrom: from,
        defaultReplyTo: replyTo,
      }),
    );
    this.register(
      new SmtpProvider({
        host: this.configService.get<string>('SMTP_HOST'),
        port: Number(this.configService.get<string>('SMTP_PORT') ?? 587),
        user: this.configService.get<string>('SMTP_USER'),
        password: this.configService.get<string>('SMTP_PASS'),
        secure: this.configService.get<string>('SMTP_SECURE') === 'true',
        defaultFrom: from,
        defaultReplyTo: replyTo,
      }),
    );

    this.primaryName = this.resolvePrimary();
    this.fallbackNames = this.resolveFallbacks();
    this.logger.log(
      `Email provider: ${this.primaryName}` +
        (this.fallbackNames.length ? ` (fallback: ${this.fallbackNames.join(' → ')})` : ''),
    );
  }

  /** True when mail actually leaves the process (anything but the log driver). */
  get isLive(): boolean {
    return this.primaryName !== 'log';
  }

  getPrimaryProvider(): BaseEmailProvider {
    return this.providers.get(this.primaryName) ?? this.providers.get('log')!;
  }

  getProvider(name?: string): BaseEmailProvider | undefined {
    if (!name) return this.getPrimaryProvider();
    return this.providers.get(name.toLowerCase());
  }

  async listProviders(): Promise<EmailProviderStatus[]> {
    return Promise.all([...this.providers.values()].map((p) => p.getStatus()));
  }

  async verifyProvider(name: string): Promise<boolean> {
    const provider = this.getProvider(name);
    return provider ? provider.verify() : false;
  }

  /**
   * Sends through the primary driver, failing over along the chain. A payload
   * the provider rejected as invalid is not retried elsewhere: another driver
   * would reject it too, and the caller needs the real reason.
   */
  async send(payload: EmailPayload, preferredProvider?: string): Promise<EmailProviderSendResult> {
    const first = (preferredProvider && this.getProvider(preferredProvider)) || this.getPrimaryProvider();
    const chain = [first.name, ...this.fallbackNames.filter((n) => n !== first.name)];

    let lastError: unknown;
    for (const name of chain) {
      const provider = this.providers.get(name)!;
      try {
        return await provider.send(payload);
      } catch (err) {
        lastError = err;
        if (err instanceof EmailValidationError) throw err;
        const next = chain[chain.indexOf(name) + 1];
        if (next) {
          this.logger.warn(
            `Email provider ${name} failed (${err instanceof Error ? err.message : String(err)}); trying ${next}.`,
          );
        }
      }
    }
    throw lastError;
  }

  private register(provider: BaseEmailProvider): void {
    this.providers.set(provider.name, provider);
  }

  private resolvePrimary(): string {
    if (this.config.transport !== 'http' || this.config.mode === 'test') return 'log';

    const requested = this.config.provider;
    if (requested) {
      if (this.providers.has(requested)) return requested;
      this.logger.warn(`MAIL_PROVIDER="${requested}" is not a known email provider; auto-selecting.`);
    }
    // Nothing configured: stay on Resend so sends fail with a configuration
    // error instead of quietly landing in the log as "delivered".
    return AUTO_ORDER.find((n) => this.providers.get(n)?.configured) ?? 'resend';
  }

  private resolveFallbacks(): string[] {
    if (this.primaryName === 'log') return [];
    return AUTO_ORDER.filter((n) => n !== this.primaryName && this.providers.get(n)?.configured);
  }
}
