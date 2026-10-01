import { Injectable, Logger, Optional, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@org/database';
import { resolveEmailConfig, type EmailConfig } from './email.config.js';
import { BaseEmailProvider } from './email.provider.js';
import { ResendProvider } from './providers/resend.provider.js';
import { LogEmailProvider } from './providers/log.provider.js';
import {
  EMAIL_TYPES,
  type EmailPayload,
  type EmailSendResult,
  type MailMessage,
  type SendEmailOptions,
} from './email.types.js';
import {
  EmailConfigurationError,
  EmailError,
} from './email.errors.js';
import {
  workspaceInvitationEmail,
  magicSignInEmail,
  passwordResetEmail,
  emailVerificationEmail,
  welcomeEmail,
  passwordChangedEmail,
  securityAlertEmail,
  type WorkspaceInvitationEmailVars,
  type MagicSignInEmailVars,
  type PasswordResetEmailVars,
  type EmailVerificationEmailVars,
  type WelcomeEmailVars,
  type PasswordChangedEmailVars,
  type SecurityAlertEmailVars,
} from './templates/index.js';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private readonly emailConfig: EmailConfig;
  private readonly provider: BaseEmailProvider;

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
  ) {
    this.emailConfig = resolveEmailConfig(this.config);

    if (this.emailConfig.transport === 'http' && this.emailConfig.mode !== 'test') {
      const url = this.config.get<string>('RESEND_API_URL') || this.config.get<string>('MAIL_API_URL');
      this.provider = new ResendProvider({
        apiKey: this.emailConfig.resendApiKey,
        apiUrl: url,
        defaultFrom: this.emailConfig.from,
        defaultReplyTo: this.emailConfig.replyTo,
        maxRetries: 0, // default no extra retries in direct call; transient retry enabled in production
      });
    } else {
      this.provider = new LogEmailProvider(this.emailConfig.mode);
    }
  }

  onModuleInit(): void {
    if (this.emailConfig.isProduction && this.emailConfig.transport === 'http') {
      if (!this.emailConfig.resendApiKey) {
        throw new EmailConfigurationError(
          'RESEND_API_KEY is missing. In production with MAIL_TRANSPORT=http, a valid Resend API key is required.',
        );
      }
      if (!this.emailConfig.from) {
        throw new EmailConfigurationError(
          'MAIL_FROM is missing. In production with MAIL_TRANSPORT=http, MAIL_FROM must be configured.',
        );
      }
    }
  }

  get from(): string {
    return this.emailConfig.from;
  }

  get replyTo(): string {
    return this.emailConfig.replyTo;
  }

  get transport(): 'log' | 'http' {
    return this.emailConfig.transport;
  }

  /**
   * Primary entry point for sending emails.
   * Never throws to the caller — failures are logged, recorded in audit records,
   * and reflected in `delivered: false`.
   */
  async send(options: SendEmailOptions | MailMessage): Promise<EmailSendResult> {
    const to = options.to;
    const recipients = Array.isArray(to) ? to : [to];
    const recipientStr = recipients.join(',');
    const subject = options.subject || '';
    const html = options.html || '';
    const text = options.text || '';
    const type = 'type' in options && options.type ? options.type : 'CUSTOM';
    const userId = 'userId' in options ? options.userId ?? null : null;
    const workspaceId = 'workspaceId' in options ? options.workspaceId ?? null : null;
    const idempotencyKey = 'idempotencyKey' in options ? options.idempotencyKey : undefined;

    // Idempotency check: if an email with this idempotency key was already sent, avoid duplicate send
    if (idempotencyKey && this.prisma) {
      try {
        const existing = await this.prisma.emailDelivery.findUnique({
          where: { idempotencyKey },
          select: { id: true, status: true, providerMessageId: true, provider: true },
        });

        if (existing && (existing.status === 'SENT' || existing.status === 'DELIVERED')) {
          this.logger.log({
            event: 'email.deduplicated',
            idempotencyKey,
            providerMessageId: existing.providerMessageId,
            type,
            status: 'skipped_duplicate',
          });
          const dedupeResult: EmailSendResult = {
            delivered: true,
            transport: this.transport,
            skippedDuplicate: true,
          };
          if (existing.providerMessageId) dedupeResult.id = existing.providerMessageId;
          if (existing.provider) dedupeResult.provider = existing.provider;
          if (existing.id) dedupeResult.deliveryId = existing.id;
          return dedupeResult;
        }
      } catch (err) {
        this.logger.warn(`Idempotency check query failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    const payload: EmailPayload = {
      to,
      subject,
      html,
      text,
      from: options.from || this.from,
      replyTo: options.replyTo || this.replyTo,
      headers: options.headers,
      idempotencyKey,
      tags: [
        { name: 'type', value: type },
        ...(workspaceId ? [{ name: 'workspace_id', value: workspaceId }] : []),
      ],
    };

    try {
      const sendResult = await this.provider.send(payload);

      // Persist delivery audit record
      let deliveryRecordId: string | undefined;
      if (this.prisma) {
        try {
          const record = await this.prisma.emailDelivery.create({
            data: {
              type,
              recipient: recipientStr,
              userId,
              workspaceId,
              provider: sendResult.provider,
              providerMessageId: sendResult.id,
              status: 'SENT',
              idempotencyKey: idempotencyKey ?? null,
              sentAt: new Date(),
              metadata: 'metadata' in options && options.metadata ? (options.metadata as any) : undefined,
            },
            select: { id: true },
          });
          deliveryRecordId = record.id;
        } catch (dbErr) {
          this.logger.warn(`Failed to persist email delivery record: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
        }
      }

      // Structured observability log (masking recipient address for privacy)
      const maskedRecipient = recipients.map((r) => {
        const parts = r.split('@');
        return parts.length === 2 ? `${parts[0].slice(0, 2)}***@${parts[1]}` : '***';
      }).join(', ');

      this.logger.log({
        event: 'email.sent',
        type,
        provider: sendResult.provider,
        providerMessageId: sendResult.id,
        workspaceId,
        recipient: maskedRecipient,
        status: 'sent',
      });

      const response: EmailSendResult = {
        delivered: true,
        transport: this.transport,
      };
      if (this.transport === 'http' && sendResult.id) {
        response.id = sendResult.id;
      }
      if (deliveryRecordId) {
        response.deliveryId = deliveryRecordId;
      }
      return response;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const errorCode = err instanceof EmailError ? err.code : 'SEND_ERROR';

      // Persist failed delivery attempt
      if (this.prisma) {
        try {
          await this.prisma.emailDelivery.create({
            data: {
              type,
              recipient: recipientStr,
              userId,
              workspaceId,
              provider: this.provider.name,
              status: 'FAILED',
              idempotencyKey: idempotencyKey ?? null,
              errorCode,
              errorMessage: errorMsg.slice(0, 500),
              metadata: 'metadata' in options && options.metadata ? (options.metadata as any) : undefined,
            },
          });
        } catch (dbErr) {
          this.logger.warn(`Failed to persist failed email delivery record: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
        }
      }

      this.logger.error({
        event: 'email.failed',
        type,
        provider: this.provider.name,
        workspaceId,
        errorCode,
        error: errorMsg,
      });

      return {
        delivered: false,
        transport: this.transport,
      };
    }
  }

  // --- High-Level Transactional Email Helpers ---

  async sendWorkspaceInvitation(
    vars: WorkspaceInvitationEmailVars & {
      to: string;
      workspaceId: string;
      invitedById: string;
      invitationId: string;
      version?: number;
    },
  ): Promise<EmailSendResult> {
    const rendered = workspaceInvitationEmail({
      ...vars,
      appName: this.emailConfig.appName,
    });
    const idempotencyKey = `workspace-invite:${vars.invitationId}:${vars.version || 1}`;

    return this.send({
      type: EMAIL_TYPES.WORKSPACE_INVITATION,
      to: vars.to,
      userId: null,
      workspaceId: vars.workspaceId,
      idempotencyKey,
      ...rendered,
    });
  }

  async sendMagicSignIn(
    vars: MagicSignInEmailVars & {
      to: string;
      userId?: string | null;
      tokenId: string;
    },
  ): Promise<EmailSendResult> {
    const rendered = magicSignInEmail({
      ...vars,
      appName: this.emailConfig.appName,
      expiresInMinutes: vars.expiresInMinutes || this.emailConfig.magicLinkExpiresMinutes,
    });
    const idempotencyKey = `magic-login:${vars.tokenId}`;

    return this.send({
      type: EMAIL_TYPES.MAGIC_SIGN_IN,
      to: vars.to,
      userId: vars.userId ?? null,
      idempotencyKey,
      ...rendered,
    });
  }

  async sendPasswordReset(
    vars: PasswordResetEmailVars & {
      to: string;
      userId?: string | null;
      tokenId: string;
    },
  ): Promise<EmailSendResult> {
    const rendered = passwordResetEmail({
      ...vars,
      appName: this.emailConfig.appName,
      expiresInMinutes: vars.expiresInMinutes || this.emailConfig.passwordResetExpiresMinutes,
    });
    const idempotencyKey = `password-reset:${vars.tokenId}`;

    return this.send({
      type: EMAIL_TYPES.PASSWORD_RESET,
      to: vars.to,
      userId: vars.userId ?? null,
      idempotencyKey,
      ...rendered,
    });
  }

  async sendEmailVerification(
    vars: EmailVerificationEmailVars & {
      to: string;
      userId: string;
      tokenId: string;
    },
  ): Promise<EmailSendResult> {
    const rendered = emailVerificationEmail({
      ...vars,
      appName: this.emailConfig.appName,
    });
    const idempotencyKey = `email-verification:${vars.tokenId}`;

    return this.send({
      type: EMAIL_TYPES.EMAIL_VERIFICATION,
      to: vars.to,
      userId: vars.userId,
      idempotencyKey,
      ...rendered,
    });
  }

  async sendWelcome(
    vars: WelcomeEmailVars & {
      to: string;
      userId: string;
    },
  ): Promise<EmailSendResult> {
    const rendered = welcomeEmail({
      ...vars,
      appName: this.emailConfig.appName,
    });
    const idempotencyKey = `welcome:${vars.userId}`;

    return this.send({
      type: EMAIL_TYPES.WELCOME,
      to: vars.to,
      userId: vars.userId,
      idempotencyKey,
      ...rendered,
    });
  }

  async sendPasswordChanged(
    vars: PasswordChangedEmailVars & {
      to: string;
      userId: string;
    },
  ): Promise<EmailSendResult> {
    const rendered = passwordChangedEmail({
      ...vars,
      appName: this.emailConfig.appName,
    });
    const idempotencyKey = `password-changed:${vars.userId}:${Date.now()}`;

    return this.send({
      type: EMAIL_TYPES.PASSWORD_CHANGED,
      to: vars.to,
      userId: vars.userId,
      idempotencyKey,
      ...rendered,
    });
  }

  async sendSecurityAlert(
    vars: SecurityAlertEmailVars & {
      to: string;
      userId: string;
    },
  ): Promise<EmailSendResult> {
    const rendered = securityAlertEmail({
      ...vars,
      appName: this.emailConfig.appName,
    });

    return this.send({
      type: EMAIL_TYPES.SECURITY_ALERT,
      to: vars.to,
      userId: vars.userId,
      ...rendered,
    });
  }
}

/** Legacy alias for backward compatibility */
@Injectable()
export class MailService extends EmailService {}
