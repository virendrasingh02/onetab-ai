export const EMAIL_TYPES = {
  WORKSPACE_INVITATION: 'WORKSPACE_INVITATION',
  MAGIC_SIGN_IN: 'MAGIC_SIGN_IN',
  PASSWORD_RESET: 'PASSWORD_RESET',
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  WELCOME: 'WELCOME',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  SECURITY_ALERT: 'SECURITY_ALERT',
} as const;

export type EmailType = (typeof EMAIL_TYPES)[keyof typeof EMAIL_TYPES] | (string & {});

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  idempotencyKey?: string;
  tags?: Array<{ name: string; value: string }>;
}

export interface EmailProviderSendResult {
  id: string;
  provider: string;
}

export interface EmailProvider {
  readonly name: string;
  send(payload: EmailPayload): Promise<EmailProviderSendResult>;
}

export interface SendEmailOptions extends Partial<EmailPayload> {
  to: string | string[];
  type?: EmailType;
  subject?: string;
  html?: string;
  text?: string;
  userId?: string | null;
  workspaceId?: string | null;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface EmailSendResult {
  /** `true` when the message was accepted by the transport/provider. */
  delivered: boolean;
  transport: 'log' | 'http';
  /** Provider message id returned by Resend/provider. */
  id?: string;
  provider?: string;
  deliveryId?: string;
  skippedDuplicate?: boolean;
  error?: string;
}

/** Legacy shape for backward compatibility */
export type MailMessage = SendEmailOptions;
export type MailSendResult = EmailSendResult;

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}
