export { MailModule } from './lib/mail.module.js';
export { EmailService, MailService } from './lib/email.service.js';
export { BaseEmailProvider, type EmailProviderStatus, type EmailWebhookResult } from './lib/email.provider.js';
export { ResendProvider } from './lib/providers/resend.provider.js';
export { LogEmailProvider, type CapturedEmail } from './lib/providers/log.provider.js';
export { SendGridProvider } from './lib/providers/sendgrid.provider.js';
export { SmtpProvider } from './lib/providers/smtp.provider.js';
export { EmailProviderManager } from './lib/providers/provider-manager.js';
export { TemplateRegistry, ALL_SYSTEM_TEMPLATES } from './lib/templates/registry.js';
export { TemplateRenderer, type RenderTemplateOptions } from './lib/templates/template-renderer.js';
export { EmailQueue, type EmailJob } from './lib/queue/email-queue.js';
export {
  OtpManager,
  type GenerateOtpOptions,
  type VerifyOtpOptions,
  type VerifyOtpResult,
} from './lib/otp/otp.manager.js';
export {
  NotificationPreferenceManager,
  type CanSendEmailOptions,
  type CanSendEmailResult,
} from './lib/preferences/notification-preference.manager.js';
export {
  EmailEventRegistry,
  PLATFORM_EVENT_MAPPINGS,
  type EventMapping,
} from './lib/events/email-event.registry.js';
export { ResendWebhookService } from './lib/webhooks/resend-webhook.service.js';
export { ResendWebhookController } from './lib/webhooks/resend-webhook.controller.js';
export { resolveEmailConfig, type EmailConfig } from './lib/email.config.js';
export {
  EmailError,
  EmailConfigurationError,
  EmailAuthenticationError,
  EmailRateLimitError,
  EmailValidationError,
  EmailTransientError,
} from './lib/email.errors.js';
export {
  EMAIL_TYPES,
  type EmailType,
  type EmailPayload,
  type EmailSendResult,
  type EmailProvider,
  type EmailProviderSendResult,
  type MailMessage,
  type MailSendResult,
  type SendEmailOptions,
  type RenderedEmail,
} from './lib/email.types.js';

export {
  resolveVariables,
  getByPath,
  formatDate,
  formatCurrency,
  formatNumber,
  extractVariablePaths,
  type ResolveVariablesOptions,
} from './lib/variables/index.js';

export {
  EmailLayout,
  EmailButton,
  EmailHeader,
  EmailFooter,
  EmailNotice,
  EmailLogo,
  EmailContent,
  EmailHeading,
  EmailText,
  EmailAlert,
  EmailCode,
  EmailCard,
  EmailDivider,
  EmailSecurityNotice,
  safeColor,
  type EmailLayoutOptions,
  type EmailFooterOptions,
  type WorkspaceBrandingOptions,
} from './lib/components/index.js';

export * from './lib/templates/index.js';
