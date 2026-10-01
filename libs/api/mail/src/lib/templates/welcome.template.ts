import type { RenderedEmail } from '../email.types.js';
import { EmailButton } from './components/email-button.js';
import { EmailLayout } from './components/email-layout.js';

export interface WelcomeEmailVars {
  name: string;
  loginUrl: string;
  appName?: string;
}

export function welcomeEmail(vars: WelcomeEmailVars): RenderedEmail {
  const appName = vars.appName || 'Mie';

  const subject = `Welcome to ${appName}!`;

  const text = [
    `Welcome to ${appName}, ${vars.name}!`,
    '',
    `We're excited to have you on board. ${appName} brings your team collaboration, workspace intelligence, and productivity tools together into one cohesive platform.`,
    '',
    'Get started with your account here:',
    vars.loginUrl,
    '',
    'If you have any questions, our support team is always here to help.',
  ].join('\n');

  const html = EmailLayout(
    [
      `<h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.3;">`,
      `Welcome to ${appName}, ${vars.name}!`,
      `</h1>`,
      `<p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #334155;">`,
      `We're excited to have you on board. ${appName} brings your team collaboration, workspace intelligence, and productivity tools together into one cohesive platform.`,
      `</p>`,
      EmailButton(`Open ${appName}`, vars.loginUrl),
      `<p style="margin: 16px 0 0; font-size: 13px; color: #64748b;">`,
      `If you have any questions, simply reply to this email or visit our help center.`,
      `</p>`,
    ].join(''),
    {
      appName,
      preheader: `Welcome to ${appName}! Get started with your account.`,
    },
  );

  return { subject, html, text };
}
