export { EmailLayout, type EmailLayoutOptions } from './components/email-layout.js';
export { EmailButton } from './components/email-button.js';
export { EmailHeader } from './components/email-header.js';
export { EmailFooter, type EmailFooterOptions } from './components/email-footer.js';
export { EmailNotice } from './components/email-notice.js';

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
