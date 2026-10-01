export { MailModule } from './lib/mail.module.js';
export { EmailService, MailService } from './lib/email.service.js';
export { BaseEmailProvider } from './lib/email.provider.js';
export { ResendProvider } from './lib/providers/resend.provider.js';
export { LogEmailProvider } from './lib/providers/log.provider.js';
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
  EmailLayout,
  EmailButton,
  EmailHeader,
  EmailFooter,
  EmailNotice,
  workspaceInvitationEmail,
  workspaceInviteEmail,
  magicSignInEmail,
  magicLinkEmail,
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
} from './lib/templates/index.js';
