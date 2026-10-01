import type { RenderedEmail } from '../email.types.js';
import { EmailButton } from './components/email-button.js';
import { EmailLayout } from './components/email-layout.js';
import { EmailNotice } from './components/email-notice.js';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface WorkspaceInvitationEmailVars {
  inviterName: string;
  workspaceName: string;
  acceptUrl: string;
  expiration?: string;
  role?: string;
  appName?: string;
}

export function workspaceInvitationEmail(
  vars: WorkspaceInvitationEmailVars,
): RenderedEmail {
  const appName = vars.appName || 'Mie';
  const roleText = vars.role ? ` as a ${vars.role}` : '';
  const expirationText = vars.expiration || '7 days';

  const subject = `You've been invited to join ${vars.workspaceName}`;

  const text = [
    `You've been invited to join ${vars.workspaceName}`,
    '',
    `${vars.inviterName} invited you to join ${vars.workspaceName}${roleText} on ${appName}.`,
    '',
    'Accept the invitation using the link below:',
    vars.acceptUrl,
    '',
    `Invitation expires on ${expirationText}.`,
    '',
    `If you did not expect this invitation, you can safely ignore this email.`,
  ].join('\n');

  const html = EmailLayout(
    [
      `<h1 style="margin: 0 0 16px; font-size: 20px; font-weight: 700; color: #0f172a; line-height: 1.3;">`,
      `You've been invited to join ${escapeHtml(vars.workspaceName)}`,
      `</h1>`,
      `<p style="margin: 0 0 16px; font-size: 14px; line-height: 1.6; color: #334155;">`,
      `<strong>${escapeHtml(vars.inviterName)}</strong> invited you to join <strong>${escapeHtml(vars.workspaceName)}</strong>${escapeHtml(roleText)} on ${escapeHtml(appName)}.`,
      `</p>`,
      EmailButton('Accept invitation', vars.acceptUrl),
      EmailNotice(`Invitation expires on ${escapeHtml(expirationText)}.`),
      `<p style="margin: 16px 0 0; font-size: 13px; color: #64748b;">`,
      `If you did not expect this invitation, you can safely ignore this email.`,
      `</p>`,
    ].join(''),
    {
      appName,
      preheader: `${vars.inviterName} invited you to join ${vars.workspaceName} on ${appName}.`,
    },
  );

  return { subject, html, text };
}
