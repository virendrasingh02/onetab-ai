import { Injectable, Logger, Optional, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService, type Prisma } from '@org/database';
import type { SendTransactionalEmailOptions } from '@org/types';
import { resolveEmailConfig, type EmailConfig } from './email.config.js';
import { EmailProviderManager } from './providers/provider-manager.js';
import { TemplateRegistry } from './templates/registry.js';
import { TemplateRenderer } from './templates/template-renderer.js';
import { EmailQueue } from './queue/email-queue.js';
import { OtpManager, type GenerateOtpOptions, type VerifyOtpOptions, type VerifyOtpResult } from './otp/otp.manager.js';
import { NotificationPreferenceManager } from './preferences/notification-preference.manager.js';
import { EmailEventRegistry } from './events/email-event.registry.js';
import {
  EMAIL_TYPES,
  type EmailPayload,
  type EmailSendResult,
  type MailMessage,
  type SendEmailOptions,
} from './email.types.js';
import { EmailConfigurationError, EmailError } from './email.errors.js';
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

/** Statuses meaning the provider already accepted this message. */
const ALREADY_SENT = new Set(['SENT', 'DELIVERED', 'OPENED', 'CLICKED']);

function maskRecipient(address: string): string {
  const [local, domain] = address.split('@');
  return domain ? `${local.slice(0, 2)}***@${domain}` : '***';
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private readonly emailConfig: EmailConfig;

  readonly templateRegistry: TemplateRegistry;
  readonly templateRenderer: TemplateRenderer;
  readonly providerManager: EmailProviderManager;
  readonly queue: EmailQueue;
  readonly otp: OtpManager;
  readonly preferences: NotificationPreferenceManager;
  readonly events: EmailEventRegistry;

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly prisma?: PrismaService,
    @Optional() templateRegistry?: TemplateRegistry,
    @Optional() templateRenderer?: TemplateRenderer,
    @Optional() providerManager?: EmailProviderManager,
    @Optional() queue?: EmailQueue,
    @Optional() otpManager?: OtpManager,
    @Optional() preferenceManager?: NotificationPreferenceManager,
    @Optional() eventRegistry?: EmailEventRegistry,
  ) {
    this.emailConfig = resolveEmailConfig(this.config);

    // Collaborators come from DI in the app; the fallbacks keep the service
    // constructible on its own (tests, scripts).
    this.templateRegistry = templateRegistry ?? new TemplateRegistry(this.prisma);
    this.templateRenderer = templateRenderer ?? new TemplateRenderer();
    this.providerManager = providerManager ?? new EmailProviderManager(this.config);
    this.queue = queue ?? new EmailQueue();
    this.otp = otpManager ?? new OtpManager(this.config, this.prisma);
    this.preferences = preferenceManager ?? new NotificationPreferenceManager(this.prisma);
    this.events = eventRegistry ?? new EmailEventRegistry();

    this.queue.setProcessor((opts) => this.send(opts));
  }

  onModuleInit(): void {
    if (this.emailConfig.isProduction && this.emailConfig.transport === 'http') {
      if (!this.providerManager.getPrimaryProvider().configured) {
        throw new EmailConfigurationError(
          `MAIL_TRANSPORT=http in production but email provider "${this.providerManager.primaryName}" is not configured ` +
            '(set RESEND_API_KEY or SENDGRID_API_KEY, optionally MAIL_PROVIDER).',
        );
      }
      if (!this.config.get<string>('MAIL_FROM')) {
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
   * Primary low-level entry point for sending emails.
   * Never throws to the caller — failures are logged, recorded in audit records,
   * and reflected in `delivered: false`.
   */
  async send(options: SendEmailOptions | MailMessage): Promise<EmailSendResult> {
    const recipients = Array.isArray(options.to) ? options.to : [options.to];
    const type = options.type || 'CUSTOM';
    const userId = options.userId ?? null;
    const workspaceId = options.workspaceId ?? null;
    const idempotencyKey = options.idempotencyKey || undefined;
    const metadata = options.metadata as Prisma.InputJsonValue | undefined;

    // Idempotency: a key the provider already accepted is not sent twice. A
    // previous FAILED attempt is remembered so the retry updates that row
    // (the key is unique) instead of failing to record it.
    let priorAttemptId: string | undefined;
    if (idempotencyKey && this.prisma) {
      try {
        const existing = await this.prisma.emailDelivery.findUnique({
          where: { idempotencyKey },
          select: { id: true, status: true, providerMessageId: true, provider: true },
        });
        if (existing && ALREADY_SENT.has(existing.status)) {
          this.logger.log({ event: 'email.deduplicated', idempotencyKey, type });
          const dedupeResult: EmailSendResult = {
            delivered: true,
            transport: this.transport,
            skippedDuplicate: true,
            deliveryId: existing.id,
          };
          if (existing.providerMessageId) dedupeResult.id = existing.providerMessageId;
          if (existing.provider) dedupeResult.provider = existing.provider;
          return dedupeResult;
        }
        priorAttemptId = existing?.id;
      } catch (err) {
        this.logger.warn(`Idempotency check query failed: ${errorMessage(err)}`);
      }
    }

    const payload: EmailPayload = {
      to: options.to,
      subject: options.subject || '',
      html: options.html || '',
      text: options.text || '',
      from: options.from || this.from,
      replyTo: options.replyTo || this.replyTo,
      headers: options.headers,
      idempotencyKey,
      tags: [
        // Resend tag values only allow [A-Za-z0-9_-].
        { name: 'type', value: String(type).replace(/[^A-Za-z0-9_-]/g, '_') },
        ...(workspaceId ? [{ name: 'workspace_id', value: workspaceId }] : []),
      ],
    };
    const base = { type, recipient: recipients.join(','), userId, workspaceId, metadata };

    try {
      const sent = await this.providerManager.send(payload);
      const deliveryId = await this.recordDelivery(priorAttemptId, idempotencyKey, {
        ...base,
        provider: sent.provider,
        providerMessageId: sent.id || null,
        status: 'SENT',
        errorCode: null,
        errorMessage: null,
        sentAt: new Date(),
      });

      this.logger.log({
        event: 'email.sent',
        type,
        provider: sent.provider,
        providerMessageId: sent.id,
        workspaceId,
        recipient: recipients.map(maskRecipient).join(', '),
      });

      const response: EmailSendResult = { delivered: true, transport: this.transport };
      if (this.transport === 'http' && sent.id) response.id = sent.id;
      if (deliveryId) response.deliveryId = deliveryId;
      return response;
    } catch (err: unknown) {
      const message = errorMessage(err);
      const errorCode = err instanceof EmailError ? err.code : 'SEND_ERROR';

      await this.recordDelivery(priorAttemptId, idempotencyKey, {
        ...base,
        provider: this.providerManager.primaryName,
        status: 'FAILED',
        errorCode,
        errorMessage: message.slice(0, 500),
      });

      this.logger.error({
        event: 'email.failed',
        type,
        provider: this.providerManager.primaryName,
        workspaceId,
        errorCode,
        error: message,
      });

      return { delivered: false, transport: this.transport };
    }
  }

  /** Writes the audit row; best-effort, never fails the send. */
  private async recordDelivery(
    priorAttemptId: string | undefined,
    idempotencyKey: string | undefined,
    data: Omit<Prisma.EmailDeliveryUncheckedCreateInput, 'idempotencyKey'>,
  ): Promise<string | undefined> {
    if (!this.prisma) return undefined;
    try {
      const record = priorAttemptId
        ? await this.prisma.emailDelivery.update({
            where: { id: priorAttemptId },
            data,
            select: { id: true },
          })
        : await this.prisma.emailDelivery.create({
            data: { ...data, idempotencyKey: idempotencyKey ?? null },
            select: { id: true },
          });
      return record.id;
    } catch (err) {
      this.logger.warn(`Failed to persist email delivery record: ${errorMessage(err)}`);
      return undefined;
    }
  }

  /**
   * Universal transactional email pipeline: preference gate → template
   * resolution (workspace override → platform override → system default) →
   * render → send.
   */
  async sendTransactionalEmail(options: SendTransactionalEmailOptions): Promise<EmailSendResult> {
    const { templateKey, recipient, data, workspaceId, userId, idempotencyKey, metadata, branding, forceSend } = options;

    const prefResult = await this.preferences.canSendEmail({ templateKey, userId, workspaceId, forceSend });
    if (!prefResult.shouldSend) {
      this.logger.log({
        event: 'email.suppressed_by_preference',
        templateKey,
        userId,
        workspaceId,
        reason: prefResult.reason,
      });
      return {
        delivered: false,
        transport: this.transport,
        skippedDuplicate: false,
        error: `Email delivery suppressed by user preferences (${prefResult.reason})`,
      };
    }

    const template = await this.templateRegistry.getTemplate(templateKey, workspaceId);
    if (!template) {
      this.logger.error(`Template "${templateKey}" not found in registry.`);
      return { delivered: false, transport: this.transport, error: `Template "${templateKey}" not found` };
    }

    const workspace = (data.workspace ?? {}) as { name?: string; logo?: string };
    const rendered = this.templateRenderer.render(template, {
      data: { appName: this.emailConfig.appName, ...data },
      branding: {
        workspaceName: branding?.workspaceName || workspace.name,
        workspaceLogo: branding?.workspaceLogo || workspace.logo,
        primaryColor: branding?.primaryColor,
        customFooter: branding?.customFooter,
      },
      timezone: branding?.timezone,
      locale: branding?.language,
      appUrl: this.emailConfig.appUrl,
    });

    return this.send({
      type: template.templateKey,
      to: recipient,
      userId: userId ?? null,
      workspaceId: workspaceId ?? null,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      replyTo: branding?.replyTo,
      idempotencyKey,
      metadata: {
        ...metadata,
        templateVersion: template.version,
        isCustomTemplate: !template.isSystemTemplate,
      },
    });
  }

  /**
   * Issues a one-time code and mails it to the identifier it was issued for.
   * The code only ever goes to that address, so whoever can read the inbox is
   * who can verify it.
   */
  async sendOtp(options: GenerateOtpOptions & { appName?: string; loginUrl?: string }): Promise<{
    recordId: string;
    expiresInMinutes: number;
    delivery: EmailSendResult;
  }> {
    const otpResult = await this.otp.createOtp(options);
    const delivery = await this.sendTransactionalEmail({
      templateKey: 'AUTH_OTP',
      recipient: options.identifier.trim().toLowerCase(),
      data: {
        otp: {
          code: otpResult.code,
          expiresIn: `${otpResult.expiresInMinutes} minutes`,
        },
        appName: options.appName || this.emailConfig.appName,
        security: {
          loginUrl: options.loginUrl || `${this.emailConfig.appUrl}/login`,
        },
      },
      idempotencyKey: `otp:${otpResult.recordId}`,
      forceSend: true,
    });

    return {
      recordId: otpResult.recordId,
      expiresInMinutes: otpResult.expiresInMinutes,
      delivery,
    };
  }

  async verifyOtp(options: VerifyOtpOptions): Promise<VerifyOtpResult> {
    return this.otp.verifyOtp(options);
  }

  // --- High-Level Transactional Email Helpers (Backward Compatibility) ---

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
