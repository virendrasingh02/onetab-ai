import type { RenderedEmail } from '../email.types.js';
import { EmailButton } from './components/email-button.js';
import { EmailLayout } from './components/email-layout.js';
import { EmailNotice } from './components/email-notice.js';

export interface MagicSignInEmailVars {
  verifyUrl: string;
  expiresInMinutes?: number;
  appName?: string;
}

export function magicSignInEmail(vars: MagicSignInEmailVars): RenderedEmail {
  const appName = vars.appName || 'Mie';
  const minutes = vars.expiresInMinutes || 15;

  const subject = `Sign in to ${appName}`;

  const text = [
    `Sign in to ${appName}`,
    '',
    'Click the button below to securely sign in.',
    '',
    vars.verifyUrl,
    '',
    `This link expires in ${minutes} minutes.`,
    '',
    "If you didn't request this link, you can safely ignore this email.",
  ].join('\n');

  const html = EmailLayout(
    [
      `<h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.3;">`,
      `Sign in to ${appName}`,
      `</h1>`,
      `<p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #334155;">`,
      `Click the button below to securely sign in.`,
      `</p>`,
      EmailButton(`Sign in to ${appName}`, vars.verifyUrl),
      EmailNotice(`This link expires in ${minutes} minutes.`),
      `<p style="margin: 16px 0 0; font-size: 13px; color: #64748b;">`,
      `If you didn't request this link, you can safely ignore this email.`,
      `</p>`,
    ].join(''),
    {
      appName,
      preheader: `Click to securely sign in to ${appName}.`,
    },
  );

  return { subject, html, text };
}

/** Legacy template helper for backward compatibility */
export function magicLinkEmail(vars: MagicSignInEmailVars): RenderedEmail {
  return magicSignInEmail({ appName: vars.appName || 'OneTab AI', ...vars });
}
