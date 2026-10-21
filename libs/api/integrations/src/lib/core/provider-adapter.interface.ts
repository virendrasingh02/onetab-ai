import type {
  AppActionDefinition,
  AppActionResult,
  ConnectorTriggerDefinition,
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

/** Who an action runs as; see `ProviderAdapter.executeAction`. */
export interface ActionContext {
  actingUserId?: string;
  /** The workspace the action runs in (a personal credential has none of its own). */
  workspaceId?: string;
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

/** One event an app pushed to the connector webhook, ready to start agents. */
export interface ConnectorInboundEvent {
  /** The app's own id for the delivery — used to drop repeats. */
  eventId: string;
  /** Which of the adapter's `getTriggers()` (delivery: 'webhook') this is. */
  triggerId: string;
  item: Record<string, unknown>;
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
    /** `params`: extra callback query values some apps send (QuickBooks' `realmId`). */
    options?: { redirectUri?: string; params?: Record<string, string> },
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

  /**
   * The named actions this app exposes to a chat conversation (an
   * `mie.app.response` card's buttons, `/<actionId>` in an app's DM). Optional
   * so existing providers keep working unchanged; a provider with none simply
   * has no actions to trigger from chat yet.
   */
  getActions?(): AppActionDefinition[];

  /**
   * Actions that depend on the connection itself — a custom connector's are
   * defined per connection. When present it wins over `getActions()`.
   */
  getActionsFor?(credential: ResolvedCredential): AppActionDefinition[];

  /** Per-connection counterpart of `getTriggers()`. */
  getTriggersFor?(credential: ResolvedCredential): ConnectorTriggerDefinition[];

  /**
   * Runs one named action. `IntegrationsService.executeAction` looks the
   * definition up via `getActions()` first — the adapter can assume `actionId`
   * is one of its own and `input` has already cleared the definition's
   * permission/confirmation checks server-side. `context.actingUserId` is the
   * person the action runs as (already access-checked) — an adapter that acts
   * *for a person* (e.g. an attendance punch) must use it, never `input`.
   */
  executeAction?(
    credential: ResolvedCredential,
    actionId: string,
    input: Record<string, unknown>,
    context?: ActionContext,
  ): Promise<AppActionResult>;

  /**
   * Events that can start an agent. Each one watches one of this adapter's own
   * read actions (`pollActionId`) — the platform polls it and fires once per
   * new item — so a trigger needs no per-app webhook subscription.
   */
  getTriggers?(): ConnectorTriggerDefinition[];

  /**
   * Checks that a push really came from the app, using the secret stored with
   * the connection. Required for `delivery: 'webhook'` triggers; an adapter
   * without it never accepts pushed events.
   */
  verifyWebhook?(credential: ResolvedCredential, rawBody: string, headers: Record<string, string>): boolean;

  /** Turns a verified push into trigger events (zero or more). */
  parseWebhookEvents?(
    credential: ResolvedCredential,
    payload: unknown,
    headers: Record<string, string>,
  ): ConnectorInboundEvent[];

  /** Answers an app's subscription handshake (a GET with a challenge), or null to refuse it. */
  webhookChallenge?(credential: ResolvedCredential, query: Record<string, string>): string | null;

  /**
   * Credential fields that are secrets (masked in stored metadata). When
   * omitted every string field is masked; a connector with plain fields such as
   * a shop domain lists only its secrets so the rest stays readable.
   */
  secretFields?(): string[];

  /**
   * Whether this server has what the adapter needs before anyone can connect
   * (an OAuth app's client id/secret). Omitted = always connectable.
   */
  isServerConfigured?(): boolean;
}
