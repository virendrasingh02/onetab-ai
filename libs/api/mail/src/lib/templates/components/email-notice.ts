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
