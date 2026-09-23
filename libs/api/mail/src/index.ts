export { MailModule } from './lib/mail.module.js';
export { MailService } from './lib/mail.service.js';
export type { MailMessage, MailSendResult } from './lib/mail.service.js';
export {
  magicLinkEmail,
  passwordResetEmail,
  workspaceInviteEmail,
  type RenderedEmail,
} from './lib/templates.js';
