import type { IsoDateString } from './entities.js';

export type IntegrationScopeType = 'WORKSPACE' | 'USER';

export type IntegrationStatus =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'ERROR'
  | 'EXPIRED'
  | 'REVOKED'
  | 'CONNECTING';

export type IntegrationAuthType =
  | 'OAUTH2'
  | 'BEARER'
  | 'API_KEY_HEADER'
  | 'API_KEY_QUERY'
  | 'BASIC'
  | 'CUSTOM_HEADERS'
  | 'NONE';

export interface IntegrationCapabilities {
  provider: string;
  displayName: string;
  description: string;
  category: string;
  authType: IntegrationAuthType;
  supportsSync: boolean;
  supportsWebhooks: boolean;
  supportsMessaging: boolean;
  supportsCustomEndpoints: boolean;
  scopes?: Array<{ scope: string; description: string; required?: boolean }>;
}

/**
 * One named action a connected app exposes — "send an email", "find a
 * customer" — discoverable independent of the underlying method, and carrying
 * enough metadata (`permissionLevel`, `requiresConfirmation`) for the caller
 * to decide whether to run it silently or ask first.
 */
export interface AppActionDefinition {
  id: string;
  label: string;
  description: string;
  /** JSON Schema for the action's input. */
  inputSchema: Record<string, unknown>;
  permissionLevel: 'read' | 'write' | 'destructive';
  requiresConfirmation: boolean;
}

export interface AppActionResult {
  success: boolean;
  message?: string;
  data?: unknown;
}

export interface ExternalIntegration {
  id: string;
  workspaceId: string | null;
  userId: string | null;
  scopeType: IntegrationScopeType;
  provider: string;
  providerAccountId: string | null;
  displayName: string | null;
  status: IntegrationStatus | string;
  scopes: string[];
  metadata: Record<string, unknown>;
  configJson?: string;
  lastSyncAt: IsoDateString | null;
  lastErrorAt: IsoDateString | null;
  lastErrorMessage: string | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface IntegrationAccount {
  id: string;
  provider: string;
  accountId: string;
  email?: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  scopes: string[];
  status: IntegrationStatus;
  connectedAt: IsoDateString;
  lastSyncAt?: IsoDateString | null;
  metadata?: Record<string, unknown>;
}

export interface IntegrationUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  provider: string;
}

export interface IntegrationAttachment {
  id: string;
  messageId: string;
  filename: string;
  mimeType: string;
  size: number;
  contentId?: string;
  url?: string;
  dataBase64?: string;
}

export interface IntegrationMessage {
  id: string;
  provider: string;
  integrationId: string;
  threadId?: string;
  from: { name?: string; email: string };
  to: Array<{ name?: string; email: string }>;
  cc?: Array<{ name?: string; email: string }>;
  bcc?: Array<{ name?: string; email: string }>;
  subject: string;
  snippet?: string;
  bodyText?: string;
  bodyHtml?: string;
  date: IsoDateString;
  isRead: boolean;
  isStarred?: boolean;
  labels: string[];
  attachments?: IntegrationAttachment[];
  metadata?: Record<string, unknown>;
}

export interface IntegrationThread {
  id: string;
  provider: string;
  integrationId: string;
  snippet: string;
  historyId?: string;
  messageCount: number;
  messages: IntegrationMessage[];
  participants: Array<{ name?: string; email: string }>;
  lastMessageDate: IsoDateString;
  isUnread: boolean;
}

export interface SendMessageInput {
  to: Array<{ name?: string; email: string }> | string[];
  cc?: Array<{ name?: string; email: string }> | string[];
  bcc?: Array<{ name?: string; email: string }> | string[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    contentBase64: string;
  }>;
}

export interface ReplyMessageInput extends SendMessageInput {
  threadId: string;
  inReplyToMessageId: string;
}

export interface IntegrationCustomApiConfig {
  baseUrl: string;
  authType: IntegrationAuthType;
  apiKey?: string;
  apiKeyHeader?: string;
  apiKeyQueryParam?: string;
  bearerToken?: string;
  basicUsername?: string;
  basicPassword?: string;
  customHeaders?: Record<string, string>;
  queryParams?: Record<string, string>;
  timeoutMs?: number;
  retryAttempts?: number;
}

export interface IntegrationExecuteRequestInput {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path?: string;
  headers?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
}

export interface IntegrationExecuteResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: unknown;
  durationMs: number;
}

export interface IntegrationSyncJobDto {
  id: string;
  integrationId: string;
  jobType: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  itemsProcessed: number;
  totalItems: number;
  cursor?: string | null;
  errorMessage?: string | null;
  retryCount: number;
  maxRetries: number;
  startedAt?: IsoDateString | null;
  completedAt?: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

export interface IntegrationWebhookEventDto {
  id: string;
  provider: string;
  eventId: string;
  eventType: string;
  status: 'RECEIVED' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'DUPLICATE';
  errorMessage?: string | null;
  processedAt?: IsoDateString | null;
  createdAt: IsoDateString;
}

export interface IntegrationAuditLogDto {
  id: string;
  integrationId?: string | null;
  workspaceId?: string | null;
  userId?: string | null;
  action: string;
  status: 'SUCCESS' | 'FAILURE';
  durationMs?: number | null;
  details?: Record<string, unknown> | null;
  createdAt: IsoDateString;
}
