export function EmailHeader(appName = 'Mie'): string {
  return `
    <tr>
      <td style="padding: 32px 32px 24px; text-align: left;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="display: inline-table;">
          <tr>
            <td style="vertical-align: middle;">
              <div style="display: inline-block; width: 32px; height: 32px; background: #0f172a; border-radius: 8px; text-align: center; line-height: 32px; color: #ffffff; font-weight: 700; font-size: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                M
              </div>
            </td>
            <td style="vertical-align: middle; padding-left: 12px;">
              <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 18px; font-weight: 700; letter-spacing: -0.02em; color: #0f172a;">
                ${appName}
              </span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}
