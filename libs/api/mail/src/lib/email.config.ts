import type { ConfigService } from '@nestjs/config';

export interface EmailConfig {
  transport: 'log' | 'http';
  mode: 'live' | 'test';
  from: string;
  replyTo: string;
  resendApiKey?: string;
  resendApiUrl: string;
  resendWebhookSecret?: string;
  appName: string;
  appUrl: string;
  magicLinkExpiresMinutes: number;
  passwordResetExpiresMinutes: number;
  inviteExpiresDays: number;
  isProduction: boolean;
}

export function resolveEmailConfig(config: ConfigService): EmailConfig {
  const nodeEnv = config.get<string>('NODE_ENV') ?? 'development';
  const isProduction = nodeEnv === 'production';

  const transport = (config.get<string>('MAIL_TRANSPORT') === 'http' ? 'http' : 'log') as 'log' | 'http';
  const mode = (config.get<string>('MAIL_MODE') === 'test' ? 'test' : 'live') as 'live' | 'test';

  const resendApiKey =
    config.get<string>('RESEND_API_KEY') ||
    config.get<string>('MAIL_API_KEY') ||
    undefined;

  const resendApiUrl =
    config.get<string>('RESEND_API_URL') ||
    config.get<string>('MAIL_API_URL') ||
    'https://api.resend.com/emails';

  const resendWebhookSecret = config.get<string>('RESEND_WEBHOOK_SECRET') || undefined;

  const appName = config.get<string>('APP_NAME') || 'Mie';
  const appUrl = (config.get<string>('APP_URL') || 'http://localhost:4200').replace(/\/+$/, '');

  const from = config.get<string>('MAIL_FROM') || `${appName} <noreply@askmie.ai>`;
  const replyTo = config.get<string>('MAIL_REPLY_TO') || 'support@askmie.ai';

  const magicLinkExpiresMinutes = Number(
    config.get<number>('AUTH_MAGIC_LINK_EXPIRES_MINUTES') ?? 15,
  );
  const passwordResetExpiresMinutes = Number(
    config.get<number>('PASSWORD_RESET_EXPIRES_MINUTES') ?? 30,
  );
  const inviteExpiresDays = Number(
    config.get<number>('INVITE_EXPIRES_DAYS') ?? 7,
  );

  return {
    transport,
    mode,
    from,
    replyTo,
    resendApiKey,
    resendApiUrl,
    resendWebhookSecret,
    appName,
    appUrl,
    magicLinkExpiresMinutes,
    passwordResetExpiresMinutes,
    inviteExpiresDays,
    isProduction,
  };
}
