import type { RenderedEmail } from '../email.types.js';
import { EmailButton } from './components/email-button.js';
import { EmailLayout } from './components/email-layout.js';
import { EmailNotice } from './components/email-notice.js';

export interface PasswordChangedEmailVars {
  timestamp?: string;
  supportUrl?: string;
  appName?: string;
}

export function passwordChangedEmail(vars: PasswordChangedEmailVars = {}): RenderedEmail {
  const appName = vars.appName || 'Mie';
  const time = vars.timestamp || new Date().toUTCString();
  const supportUrl = vars.supportUrl || 'https://askmie.ai/support';

  const subject = `Your ${appName} password has been changed`;

  const text = [
    `Your ${appName} password has been changed`,
    '',
    `This is a confirmation that your password for ${appName} was changed on ${time}.`,
    '',
    'If you made this change, no further action is required.',
    '',
    'If you did NOT make this change, your account may be compromised. Please reset your password immediately and contact support:',
    supportUrl,
  ].join('\n');

  const html = EmailLayout(
    [
      `<h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.3;">`,
      `Your password has been changed`,
      `</h1>`,
      `<p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #334155;">`,
      `This is a confirmation that the password for your ${appName} account was successfully updated on <strong>${time}</strong>.`,
      `</p>`,
      EmailNotice(
        'If you did not perform this change, someone else may have accessed your account. Reset your password immediately.',
        'warning',
      ),
      EmailButton('Contact Support & Secure Account', supportUrl),
      `<p style="margin: 16px 0 0; font-size: 13px; color: #64748b;">`,
      `If you made this change, you can safely ignore this notification.`,
      `</p>`,
    ].join(''),
    {
      appName,
      preheader: `Security notice: Your ${appName} password has been updated.`,
    },
  );

  return { subject, html, text };
}
