import { EmailHeader } from './email-header.js';
import { EmailFooter, type EmailFooterOptions } from './email-footer.js';

export interface EmailLayoutOptions {
  appName?: string;
  preheader?: string;
  footerOptions?: EmailFooterOptions;
}

export function EmailLayout(
  bodyHtml: string,
  options: EmailLayoutOptions = {},
): string {
  const appName = options.appName || 'Mie';
  const preheader = options.preheader ? `
    <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
      ${options.preheader}
    </div>
  ` : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${appName}</title>
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
        <!-- Main Container -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 520px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
          ${EmailHeader(appName)}
          <tr>
            <td style="padding: 0 32px 28px; text-align: left; font-size: 14px; line-height: 1.6; color: #1e293b;">
              ${bodyHtml}
            </td>
          </tr>
          ${EmailFooter({ appName, ...options.footerOptions })}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
