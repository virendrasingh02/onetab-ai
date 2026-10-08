import { BaseEmailProvider } from '../email.provider.js';
import type { EmailPayload, EmailProviderSendResult } from '../email.types.js';
import { EmailConfigurationError } from '../email.errors.js';

export interface SmtpProviderOptions {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  password?: string;
  defaultFrom?: string;
  defaultReplyTo?: string;
}

/**
 * Placeholder for a self-hosted SMTP relay.
 *
 * There is no SMTP client in the dependency tree yet, so this driver refuses to
 * send rather than report a success for mail that never left the process. It is
 * never auto-selected; `MAIL_PROVIDER=smtp` fails loudly until a real transport
 * (e.g. nodemailer) is wired in here.
 */
export class SmtpProvider extends BaseEmailProvider {
  readonly name = 'smtp';
  private readonly host?: string;
  private readonly port: number;
  private readonly secure: boolean;
  private readonly user?: string;
  private readonly defaultFrom: string;
  private readonly defaultReplyTo?: string;

  constructor(options: SmtpProviderOptions) {
    super();
    this.host = options.host;
    this.port = options.port ?? 587;
    this.secure = options.secure ?? false;
    this.user = options.user;
    this.defaultFrom = options.defaultFrom || 'noreply@onetab.ai';
    this.defaultReplyTo = options.defaultReplyTo;
  }

  override get configured(): boolean {
    return false;
  }

  async send(_payload: EmailPayload): Promise<EmailProviderSendResult> {
    throw new EmailConfigurationError(
      this.host
        ? 'SMTP delivery is not implemented yet; use MAIL_PROVIDER=resend or sendgrid.'
        : 'SMTP_HOST is not configured.',
    );
  }

  override async getStatus() {
    return {
      ready: false,
      provider: this.name,
      isProductionReady: false,
      defaultFrom: this.defaultFrom,
      defaultReplyTo: this.defaultReplyTo,
      error: 'SMTP transport not implemented',
      details: {
        host: this.host || null,
        port: this.port,
        secure: this.secure,
        user: this.user ? `${this.user.slice(0, 3)}***` : null,
      },
    };
  }
}
