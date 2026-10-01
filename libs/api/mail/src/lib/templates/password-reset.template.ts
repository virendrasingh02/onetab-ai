import type { RenderedEmail } from '../email.types.js';
import { EmailButton } from './components/email-button.js';
import { EmailLayout } from './components/email-layout.js';
import { EmailNotice } from './components/email-notice.js';

export interface PasswordResetEmailVars {
  resetUrl: string;
  expiresInMinutes?: number;
  appName?: string;
}

export function passwordResetEmail(vars: PasswordResetEmailVars): RenderedEmail {
  const appName = vars.appName || 'Mie';
  const minutes = vars.expiresInMinutes || 30;

  const subject = `Reset your ${appName} password`;

  const text = [
    `Reset your ${appName} password`,
    '',
    'We received a request to reset your password.',
    '',
    vars.resetUrl,
    '',
    `This link expires in ${minutes} minutes.`,
    '',
    "If you didn't request a password reset, you can safely ignore this email.",
  ].join('\n');

  const html = EmailLayout(
    [
      `<h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.3;">`,
      `Reset your ${appName} password`,
      `</h1>`,
      `<p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #334155;">`,
      `We received a request to reset your password.`,
      `</p>`,
      EmailButton('Reset password', vars.resetUrl),
      EmailNotice(`This link expires in ${minutes} minutes.`),
      `<p style="margin: 16px 0 0; font-size: 13px; color: #64748b;">`,
      `If you didn't request a password reset, you can safely ignore this email.`,
      `</p>`,
    ].join(''),
    {
      appName,
      preheader: `Instructions to reset your ${appName} password.`,
    },
  );

  return { subject, html, text };
}
