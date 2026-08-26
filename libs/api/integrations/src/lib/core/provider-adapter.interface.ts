import type {
  IntegrationAccount,
  IntegrationCapabilities,
  IntegrationCustomApiConfig,
  IntegrationExecuteRequestInput,
  IntegrationExecuteResponse,
  IntegrationMessage,
  IntegrationThread,
  ReplyMessageInput,
  SendMessageInput,
} from '@org/types';

export interface TokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenExpiresAt?: Date;
  scopes?: string[];
  accountId?: string;
  accountEmail?: string;
  accountName?: string;
  metadata?: Record<string, unknown>;
}

export interface ResolvedCredential {
  id: string;
  provider: string;
  scopeType: 'WORKSPACE' | 'USER';
  workspaceId?: string | null;
  userId?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  tokenExpiresAt?: Date | null;
  metadata: Record<string, unknown>;
  scopes: string[];
}

export interface SyncResult {
  success: boolean;
  itemsProcessed: number;
  totalItems?: number;
  newCursor?: string;
  hasMore?: boolean;
  syncedMessages?: IntegrationMessage[];
  syncedAccounts?: IntegrationAccount[];
  metadata?: Record<string, unknown>;
}

export interface WebhookProcessResult {
  success: boolean;
  eventType: string;
  eventId?: string;
  data?: unknown;
  shouldRetry?: boolean;
}

export interface MessageQuery {
  query?: string;
  maxResults?: number;
  pageToken?: string;
  labelIds?: string[];
  includeSpamTrash?: boolean;
}

export interface ProviderAdapter {
  readonly providerId: string;
  getCapabilities(): IntegrationCapabilities;

  getAuthorizationUrl?(
    state: string,
    options?: { redirectUri?: string; scopes?: string[]; loginHint?: string },
  ): Promise<string>;

  handleCallback?(
    code: string,
    state: string,
    options?: { redirectUri?: string },
  ): Promise<TokenResult>;

  refreshToken?(refreshToken: string): Promise<TokenResult>;

  getAccount(credential: ResolvedCredential): Promise<IntegrationAccount>;

  disconnect(credential: ResolvedCredential): Promise<void>;

  sync(credential: ResolvedCredential, cursor?: string): Promise<SyncResult>;

  handleWebhook(
    payload: unknown,
    headers: Record<string, string>,
    secret?: string,
  ): Promise<WebhookProcessResult>;

  testConnection(
    config: Record<string, unknown>,
    credential?: ResolvedCredential,
  ): Promise<{ success: boolean; message: string; details?: unknown }>;

  getMessages?(
    credential: ResolvedCredential,
    query?: MessageQuery,
  ): Promise<{ messages: IntegrationMessage[]; nextPageToken?: string }>;

  getThread?(
    credential: ResolvedCredential,
    threadId: string,
  ): Promise<IntegrationThread>;

  sendMessage?(
    credential: ResolvedCredential,
    message: SendMessageInput,
  ): Promise<IntegrationMessage>;

  replyMessage?(
    credential: ResolvedCredential,
    reply: ReplyMessageInput,
  ): Promise<IntegrationMessage>;

  createDraft?(
    credential: ResolvedCredential,
    draft: SendMessageInput,
  ): Promise<IntegrationMessage>;

  modifyMessageLabels?(
    credential: ResolvedCredential,
    messageId: string,
    addLabelIds?: string[],
    removeLabelIds?: string[],
  ): Promise<IntegrationMessage>;

  executeCustomRequest?(
    config: IntegrationCustomApiConfig,
    req: IntegrationExecuteRequestInput,
  ): Promise<IntegrationExecuteResponse>;
}
