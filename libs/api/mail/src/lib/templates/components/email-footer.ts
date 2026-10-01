export interface EmailFooterOptions {
  appName?: string;
  supportEmail?: string;
  appUrl?: string;
  extraNote?: string;
}

export function EmailFooter(options: EmailFooterOptions = {}): string {
  const appName = options.appName || 'Mie';
  const supportEmail = options.supportEmail || 'support@askmie.ai';
  const appUrl = options.appUrl || 'https://askmie.ai';

  return `
    <tr>
      <td style="padding: 24px 32px 32px; border-top: 1px solid #f1f5f9; text-align: left;">
        ${options.extraNote ? `<p style="margin: 0 0 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.5; color: #64748b;">${options.extraNote}</p>` : ''}
        <p style="margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 12px; line-height: 1.5; color: #94a3b8;">
          Sent by <a href="${appUrl}" style="color: #64748b; text-decoration: underline;">${appName}</a> &bull; Need help? Contact <a href="mailto:${supportEmail}" style="color: #64748b; text-decoration: underline;">${supportEmail}</a>
        </p>
      </td>
    </tr>
  `;
}
