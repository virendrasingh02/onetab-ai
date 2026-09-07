/**
 * Built-in transactional email templates.
 *
 * Kept as plain functions returning `{ subject, html, text }` — no template
 * engine, no file loading. Every email must have a text part; the HTML is a
 * light wrapper around the same content so it degrades cleanly.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function layout(bodyHtml: string): string {
  return [
    '<!doctype html>',
    '<html><body style="margin:0;background:#f5f5f4;padding:24px;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;color:#1c1917">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">',
    '<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fff;border:1px solid #e7e5e4;border-radius:12px;overflow:hidden">',
    '<tr><td style="padding:28px 32px 8px;font-size:15px;font-weight:600">OneTab AI</td></tr>',
    `<tr><td style="padding:8px 32px 32px;font-size:14px;line-height:1.6">${bodyHtml}</td></tr>`,
    '</table></td></tr></table></body></html>',
  ].join('');
}

function button(href: string, label: string): string {
  return `<a href="${escapeHtml(
    href,
  )}" style="display:inline-block;margin:16px 0;padding:10px 18px;background:#1c1917;color:#fff;border-radius:8px;text-decoration:none;font-weight:500">${escapeHtml(
    label,
  )}</a>`;
}

export function passwordResetEmail(vars: {
  resetUrl: string;
  expiresInMinutes: number;
}): RenderedEmail {
  const subject = 'Reset your OneTab AI password';
  const text = [
    'We received a request to reset your OneTab AI password.',
    '',
    `Reset it here (link expires in ${vars.expiresInMinutes} minutes):`,
    vars.resetUrl,
    '',
    'If you did not request this, you can ignore this email — your password will not change.',
  ].join('\n');
  const html = layout(
    [
      '<p>We received a request to reset your OneTab AI password.</p>',
      button(vars.resetUrl, 'Reset password'),
      `<p style="color:#78716c">This link expires in ${vars.expiresInMinutes} minutes. If you did not request this, you can ignore this email.</p>`,
    ].join(''),
  );
  return { subject, html, text };
}

export function workspaceInviteEmail(vars: {
  inviterName: string;
  workspaceName: string;
  role: string;
  acceptUrl: string;
}): RenderedEmail {
  const subject = `${vars.inviterName} invited you to ${vars.workspaceName} on OneTab AI`;
  const text = [
    `${vars.inviterName} invited you to join the "${vars.workspaceName}" workspace as ${vars.role}.`,
    '',
    'Accept the invitation:',
    vars.acceptUrl,
  ].join('\n');
  const html = layout(
    [
      `<p><strong>${escapeHtml(vars.inviterName)}</strong> invited you to join the <strong>${escapeHtml(
        vars.workspaceName,
      )}</strong> workspace as ${escapeHtml(vars.role)}.</p>`,
      button(vars.acceptUrl, 'Accept invitation'),
    ].join(''),
  );
  return { subject, html, text };
}
