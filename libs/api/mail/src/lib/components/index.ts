export interface WorkspaceBrandingOptions {
  workspaceName?: string;
  workspaceLogo?: string;
  primaryColor?: string;
  senderName?: string;
  replyTo?: string;
  customFooter?: string;
  timezone?: string;
  language?: string;
}

export function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Accepts only plain CSS colors (`#abc`, `#aabbcc`, `rgb(...)`, a named color)
 * so workspace-supplied branding cannot break out of a `style` attribute.
 */
export function safeColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const v = value.trim();
  return /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]{3,20})$/i.test(v) ? v : fallback;
}

export interface EmailLayoutOptions {
  appName?: string;
  preheader?: string;
  branding?: WorkspaceBrandingOptions;
  footerOptions?: EmailFooterOptions;
}

export function EmailLayout(
  bodyHtml: string,
  options: EmailLayoutOptions = {},
): string {
  const appName = options.branding?.workspaceName || options.appName || 'OneTab AI';
  const primaryColor = safeColor(options.branding?.primaryColor, '#0f172a');
  const preheader = options.preheader
    ? `
    <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
      ${escapeHtml(options.preheader)}
    </div>
  `
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(appName)}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; -webkit-text-size-adjust: 100%;">
  ${preheader}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; margin: 0; padding: 32px 16px;">
    <tr>
      <td align="center">
        <!-- Main Card Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 560px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          ${EmailHeader({ appName, logoUrl: options.branding?.workspaceLogo, primaryColor })}
          <tr>
            <td style="padding: 0 32px 28px; text-align: left; font-size: 14px; line-height: 1.6; color: #1e293b;">
              ${bodyHtml}
            </td>
          </tr>
          ${EmailFooter({
            appName,
            customFooter: options.branding?.customFooter,
            ...options.footerOptions,
          })}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export interface EmailHeaderOptions {
  appName: string;
  logoUrl?: string;
  primaryColor?: string;
}

export function EmailHeader(options: EmailHeaderOptions | string): string {
  const opts: EmailHeaderOptions =
    typeof options === 'string'
      ? { appName: options }
      : options;

  const appName = opts.appName || 'OneTab AI';
  const logoHtml = opts.logoUrl
    ? `<img src="${escapeHtml(opts.logoUrl)}" alt="${escapeHtml(appName)}" style="height: 32px; max-width: 180px; object-fit: contain; display: inline-block; vertical-align: middle;" />`
    : `<span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 18px; font-weight: 700; color: #0f172a; letter-spacing: -0.02em;">${escapeHtml(appName)}</span>`;

  return `
    <tr>
      <td style="padding: 28px 32px 20px; border-bottom: 1px solid #f1f5f9;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td align="left">
              ${logoHtml}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

export function EmailLogo(logoUrl?: string, altText?: string): string {
  if (!logoUrl) return '';
  return `<img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(altText || 'Logo')}" style="height: 32px; max-width: 180px; object-fit: contain;" />`;
}

export function EmailContent(contentHtml: string): string {
  return `<div style="padding-top: 16px;">${contentHtml}</div>`;
}

export function EmailHeading(text: string, level: 1 | 2 | 3 = 1): string {
  const fontSize = level === 1 ? '20px' : level === 2 ? '17px' : '15px';
  return `<h${level} style="margin: 0 0 16px 0; font-size: ${fontSize}; font-weight: 600; color: #0f172a; letter-spacing: -0.015em; line-height: 1.3;">${escapeHtml(text)}</h${level}>`;
}

export function EmailText(
  text: string,
  variant: 'body' | 'lead' | 'muted' = 'body',
): string {
  const color = variant === 'muted' ? '#64748b' : variant === 'lead' ? '#0f172a' : '#334155';
  const fontSize = variant === 'lead' ? '15px' : '14px';
  const fontWeight = variant === 'lead' ? '500' : '400';
  return `<p style="margin: 0 0 14px 0; font-size: ${fontSize}; font-weight: ${fontWeight}; color: ${color}; line-height: 1.6;">${escapeHtml(text)}</p>`;
}

export interface EmailButtonOptions {
  label: string;
  href: string;
  color?: string;
  textColor?: string;
}

export function EmailButton(
  labelOrOptions: string | EmailButtonOptions,
  hrefUrl?: string,
  style: Pick<EmailButtonOptions, 'color' | 'textColor'> = {},
): string {
  const opts: EmailButtonOptions =
    typeof labelOrOptions === 'string'
      ? { label: labelOrOptions, href: hrefUrl || '#', ...style }
      : labelOrOptions;

  const safeHref = escapeHtml(opts.href);
  const safeLabel = escapeHtml(opts.label);
  const bgColor = safeColor(opts.color, '#0f172a');
  const txtColor = safeColor(opts.textColor, '#ffffff');

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0 20px;">
      <tr>
        <td align="center" style="border-radius: 8px; background: ${bgColor};">
          <a href="${safeHref}"
             target="_blank"
             style="display: inline-block; padding: 12px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; color: ${txtColor}; text-decoration: none; border-radius: 8px; line-height: 1.2;">
            ${safeLabel}
          </a>
        </td>
      </tr>
    </table>
  `;
}

export function EmailAlert(
  message: string,
  type: 'info' | 'warning' | 'danger' | 'success' = 'info',
): string {
  const config = {
    info: { bg: '#f0f9ff', border: '#bae6fd', color: '#0369a1' },
    warning: { bg: '#fffbeb', border: '#fde68a', color: '#b45309' },
    danger: { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c' },
    success: { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d' },
  }[type];

  return `
    <div style="margin: 16px 0; padding: 14px 16px; background-color: ${config.bg}; border: 1px solid ${config.border}; border-radius: 8px; font-size: 13px; line-height: 1.5; color: ${config.color};">
      ${escapeHtml(message)}
    </div>
  `;
}

export function EmailCode(code: string, subtext?: string): string {
  const safeCode = escapeHtml(code);
  const safeSubtext = subtext
    ? `<div style="margin-top: 8px; font-size: 12px; color: #64748b;">${escapeHtml(subtext)}</div>`
    : '';

  return `
    <div style="margin: 24px 0; text-align: center;">
      <div style="display: inline-block; padding: 16px 32px; background-color: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 8px; font-family: 'SF Mono', Consolas, Menlo, Monaco, monospace; font-size: 32px; font-weight: 700; letter-spacing: 0.25em; color: #0f172a;">
        ${safeCode}
      </div>
      ${safeSubtext}
    </div>
  `;
}

export function EmailCard(
  rows: Array<{ label: string; value: string }>,
  title?: string,
): string {
  const titleHtml = title
    ? `<div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 12px;">${escapeHtml(title)}</div>`
    : '';

  const rowsHtml = rows
    .map(
      (r, idx) => `
      <tr>
        <td style="padding: 8px ${idx === 0 ? '0' : '0'}; font-size: 13px; color: #64748b; width: 38%; vertical-align: top;">
          ${escapeHtml(r.label)}
        </td>
        <td style="padding: 8px 0; font-size: 13px; font-weight: 500; color: #0f172a; text-align: right; vertical-align: top;">
          ${escapeHtml(r.value)}
        </td>
      </tr>
    `,
    )
    .join('');

  return `
    <div style="margin: 20px 0; padding: 16px 20px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
      ${titleHtml}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rowsHtml}
      </table>
    </div>
  `;
}

export function EmailDivider(): string {
  return `<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />`;
}

export interface EmailFooterOptions {
  appName?: string;
  supportEmail?: string;
  preferencesUrl?: string;
  customFooter?: string;
}

export function EmailFooter(options: EmailFooterOptions = {}): string {
  const appName = options.appName || 'OneTab AI';
  const customFooterHtml = options.customFooter
    ? `<div style="margin-bottom: 8px; color: #475569;">${escapeHtml(options.customFooter)}</div>`
    : '';

  const preferencesLink = options.preferencesUrl
    ? ` · <a href="${escapeHtml(options.preferencesUrl)}" style="color: #64748b; text-decoration: underline;">Notification Preferences</a>`
    : '';

  return `
    <tr>
      <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9; text-align: center; font-size: 12px; color: #94a3b8; line-height: 1.5;">
        ${customFooterHtml}
        <div>&copy; ${new Date().getFullYear()} ${escapeHtml(appName)}. All rights reserved.${preferencesLink}</div>
        <div style="margin-top: 4px; font-size: 11px; color: #cbd5e1;">This is a system transactional message.</div>
      </td>
    </tr>
  `;
}

export function EmailSecurityNotice(
  customMessage?: string,
): string {
  const msg =
    customMessage ||
    'If you did not make this request, please contact your administrator or change your password immediately.';

  return `
    <div style="margin-top: 24px; padding: 12px 16px; background-color: #f8fafc; border-left: 3px solid #cbd5e1; font-size: 12px; color: #64748b; line-height: 1.5;">
      <strong>Security notice:</strong> ${escapeHtml(msg)}
    </div>
  `;
}

export function EmailNotice(text: string, type: 'info' | 'warning' = 'info'): string {
  const bg = type === 'warning' ? '#fffbeb' : '#f8fafc';
  const border = type === 'warning' ? '#fde68a' : '#e2e8f0';
  const color = type === 'warning' ? '#92400e' : '#475569';

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 20px 0; background: ${bg}; border: 1px solid ${border}; border-radius: 8px;">
      <tr>
        <td style="padding: 12px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 13px; line-height: 1.5; color: ${color};">
          ${text}
        </td>
      </tr>
    </table>
  `;
}
