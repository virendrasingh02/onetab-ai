import type { RenderedEmail } from '../email.types.js';
import { EmailButton } from './components/email-button.js';
import { EmailLayout } from './components/email-layout.js';
import { EmailNotice } from './components/email-notice.js';

export interface EmailVerificationEmailVars {
  verifyUrl: string;
  appName?: string;
  expiresInMinutes?: number;
}

export function emailVerificationEmail(vars: EmailVerificationEmailVars): RenderedEmail {
  const appName = vars.appName || 'Mie';
  const minutes = vars.expiresInMinutes || 1440; // 24 hours default

  const subject = 'Verify your email';

  const text = [
    'Verify your email',
    '',
    `Please verify your email address to finish setting up your ${appName} account.`,
    '',
    vars.verifyUrl,
    '',
    `This link expires in ${Math.round(minutes / 60)} hours.`,
    '',
    `If you did not sign up for ${appName}, you can safely ignore this email.`,
  ].join('\n');

  const html = EmailLayout(
    [
      `<h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.3;">`,
      `Verify your email`,
      `</h1>`,
      `<p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #334155;">`,
      `Please verify your email address to finish setting up your ${appName} account.`,
      `</p>`,
      EmailButton('Verify email', vars.verifyUrl),
      EmailNotice(`This link expires in ${Math.round(minutes / 60)} hours.`),
      `<p style="margin: 16px 0 0; font-size: 13px; color: #64748b;">`,
      `If you did not sign up for ${appName}, you can safely ignore this email.`,
      `</p>`,
    ].join(''),
    {
      appName,
      preheader: `Finish setting up your ${appName} account.`,
    },
  );

  return { subject, html, text };
}
