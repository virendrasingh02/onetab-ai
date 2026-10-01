import type { RenderedEmail } from '../email.types.js';
import { EmailButton } from './components/email-button.js';
import { EmailLayout } from './components/email-layout.js';
import { EmailNotice } from './components/email-notice.js';

export interface SecurityAlertEmailVars {
  alertTitle: string;
  alertDetails: string;
  deviceOrLocation?: string;
  actionUrl?: string;
  appName?: string;
}

export function securityAlertEmail(vars: SecurityAlertEmailVars): RenderedEmail {
  const appName = vars.appName || 'Mie';
  const actionUrl = vars.actionUrl || 'https://askmie.ai/settings/security';

  const subject = `Security Alert: ${vars.alertTitle} - ${appName}`;

  const text = [
    `Security Alert: ${vars.alertTitle}`,
    '',
    `We noticed unusual activity or a security event on your ${appName} account:`,
    vars.alertDetails,
    '',
    vars.deviceOrLocation ? `Details: ${vars.deviceOrLocation}\n` : '',
    'If this was you, you can safely disregard this message.',
    '',
    'If you did not authorize this activity, review your security settings immediately:',
    actionUrl,
  ].join('\n');

  const html = EmailLayout(
    [
      `<h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #b91c1c; line-height: 1.3;">`,
      `Security Alert: ${vars.alertTitle}`,
      `</h1>`,
      `<p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #334155;">`,
      `${vars.alertDetails}`,
      `</p>`,
      vars.deviceOrLocation
        ? `<p style="margin: 0 0 16px; font-size: 13px; color: #475569; background: #f1f5f9; padding: 10px 14px; border-radius: 6px;"><strong>Location / Device:</strong> ${vars.deviceOrLocation}</p>`
        : '',
      EmailNotice(
        'If this was not you, please secure your account immediately by changing your password and revoking unknown active sessions.',
        'warning',
      ),
      EmailButton('Review Security Settings', actionUrl),
    ].join(''),
    {
      appName,
      preheader: `Security notification for your ${appName} account.`,
    },
  );

  return { subject, html, text };
}
