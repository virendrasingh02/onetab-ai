function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function EmailButton(label: string, href: string): string {
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0 20px;">
      <tr>
        <td align="center" style="border-radius: 8px; background: #0f172a;">
          <a href="${safeHref}"
             target="_blank"
             style="display: inline-block; padding: 12px 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px; line-height: 1.2;">
            ${safeLabel}
          </a>
        </td>
      </tr>
    </table>
  `;
}
