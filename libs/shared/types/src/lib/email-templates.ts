export type EmailTemplateCategory =
  | 'AUTHENTICATION'
  | 'WORKSPACE'
  | 'TEAM'
  | 'PROJECTS'
  | 'TASKS'
  | 'DOCS'
  | 'MESSAGING'
  | 'MEETINGS'
  | 'AI_AGENTS'
  | 'HIRE'
  | 'VOICE'
  | 'BILLING'
  | 'SECURITY'
  | 'SYSTEM';

export type EmailTemplateStatus = 'ACTIVE' | 'INACTIVE' | 'DRAFT';

export interface EmailVariableDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'url' | 'currency' | 'object' | 'array';
  description: string;
  required?: boolean;
  defaultValue?: string | number | boolean;
  sampleValue?: string | number | boolean;
}

export interface EmailVariablesSchema {
  variables: EmailVariableDefinition[];
  samplePayload?: Record<string, unknown>;
}

export interface EmailTemplateDefinition {
  id?: string;
  templateKey: string;
  name: string;
  category: EmailTemplateCategory;
  description: string;
  subject: string;
  previewText?: string;
  htmlBody: string;
  textBody?: string;
  variablesSchema?: EmailVariablesSchema;
  status: EmailTemplateStatus;
  version: number;
  workspaceId?: string | null;
  isSystemTemplate: boolean;
  isDefault: boolean;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface WorkspaceBranding {
  workspaceName?: string;
  workspaceLogo?: string;
  primaryColor?: string;
  senderName?: string;
  replyTo?: string;
  customFooter?: string;
  timezone?: string;
  language?: string;
}

export interface SendTransactionalEmailOptions {
  templateKey: string;
  recipient: string | string[];
  data: Record<string, unknown>;
  workspaceId?: string | null;
  userId?: string | null;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
  branding?: WorkspaceBranding;
  forceSend?: boolean;
}

export interface RenderedTemplateResult {
  subject: string;
  html: string;
  text: string;
  previewText?: string;
  metadata?: Record<string, unknown>;
}

export interface EmailProviderInfo {
  name: string;
  type: 'resend' | 'log' | 'smtp' | 'sendgrid';
  status: 'active' | 'configured' | 'unconfigured' | 'error';
  defaultFrom: string;
  defaultReplyTo?: string;
  isProductionReady: boolean;
  latencyMs?: number;
  error?: string;
}

/** Live status of one outbound driver, as reported by the API. */
export interface EmailProviderStatus {
  provider: string;
  ready: boolean;
  isProductionReady: boolean;
  defaultFrom: string;
  defaultReplyTo?: string;
  latencyMs?: number;
  error?: string;
  details?: Record<string, unknown>;
}

/** `GET /admin/mail/providers`. */
export interface EmailProvidersOverview {
  primary: string;
  fallback: string[];
  providers: EmailProviderStatus[];
  queue: { pendingCount: number; deadLetterCount: number; isProcessing: boolean };
}

export interface EmailDomainInfo {
  id: string;
  domain: string;
  status: 'verified' | 'pending' | 'failed' | 'not_started';
  dnsRecords: Array<{
    type: 'TXT' | 'CNAME' | 'MX';
    name: string;
    value: string;
    status: 'verified' | 'pending';
  }>;
  verifiedAt?: string | null;
  createdAt: string;
}

export interface OtpRequestInput {
  identifier: string;
  purpose?: 'LOGIN' | '2FA' | 'VERIFY_EMAIL' | 'PASSWORD_RESET';
  userId?: string;
  workspaceId?: string;
  expiresInMinutes?: number;
}

export interface OtpVerifyInput {
  identifier: string;
  code: string;
  purpose?: 'LOGIN' | '2FA' | 'VERIFY_EMAIL' | 'PASSWORD_RESET';
}

export interface OtpResult {
  success: boolean;
  message: string;
  remainingAttempts?: number;
  expiresInSeconds?: number;
}

export interface EmailSendResult {
  delivered: boolean;
  transport?: 'log' | 'http';
  id?: string;
  provider?: string;
  deliveryId?: string;
  skippedDuplicate?: boolean;
  error?: string;
}

