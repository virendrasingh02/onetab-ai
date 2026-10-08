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
  type EmailLayoutOptions,
  type EmailFooterOptions,
  type WorkspaceBrandingOptions,
} from '../components/index.js';

export { TemplateRegistry, ALL_SYSTEM_TEMPLATES } from './registry.js';
export { TemplateRenderer, type RenderTemplateOptions } from './template-renderer.js';

export * from './definitions/auth.templates.js';
export * from './definitions/workspace.templates.js';
export * from './definitions/team.templates.js';
export * from './definitions/project-task.templates.js';
export * from './definitions/docs.templates.js';
export * from './definitions/messaging.templates.js';
export * from './definitions/meetings.templates.js';
export * from './definitions/ai-agents.templates.js';
export * from './definitions/hire.templates.js';
export * from './definitions/voice.templates.js';
export * from './definitions/billing.templates.js';
export * from './definitions/security.templates.js';
export * from './definitions/system.templates.js';

// Legacy template helpers for full backward compatibility
export {
  workspaceInvitationEmail,
  workspaceInvitationEmail as workspaceInviteEmail,
  type WorkspaceInvitationEmailVars,
} from './workspace-invitation.template.js';

export {
  magicSignInEmail,
  magicLinkEmail,
  type MagicSignInEmailVars,
} from './magic-sign-in.template.js';

export {
  passwordResetEmail,
  type PasswordResetEmailVars,
} from './password-reset.template.js';

export {
  emailVerificationEmail,
  type EmailVerificationEmailVars,
} from './email-verification.template.js';

export {
  welcomeEmail,
  type WelcomeEmailVars,
} from './welcome.template.js';

export {
  passwordChangedEmail,
  type PasswordChangedEmailVars,
} from './password-changed.template.js';

export {
  securityAlertEmail,
  type SecurityAlertEmailVars,
} from './security-alert.template.js';
