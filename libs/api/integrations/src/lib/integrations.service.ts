import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvent } from '@org/api-common';
import { MatrixBotMessagingService } from '@org/api-matrix';
import { PrismaService } from '@org/database';
import type {
  AppActionDefinition,
  AppActionResult,
  IntegrationCustomApiConfig,
  IntegrationExecuteRequestInput,
  ReplyMessageInput,
  SendMessageInput,
} from '@org/types';
import { validateActionInput } from './core/action-input.js';
import { IntegrationEncryptionService } from './core/integration-encryption.service.js';
import { IntegrationLoggerService } from './core/integration-logger.service.js';
import { IntegrationManagerService } from './core/integration-manager.service.js';
import { IntegrationPermissionService } from './core/integration-permission.service.js';
import { IntegrationSyncService } from './core/integration-sync.service.js';
import { OAuthAppCredentialsService } from './core/oauth-app-credentials.service.js';
import { OAuthService } from './core/oauth.service.js';
import type { MessageQuery } from './core/provider-adapter.interface.js';
import { customApiConfigFromMetadata, customApiMetadataWithEncryptedSecrets } from './providers/custom-api.provider.js';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly manager: IntegrationManagerService,
    private readonly encryption: IntegrationEncryptionService,
    private readonly oauth: OAuthService,
    private readonly syncService: IntegrationSyncService,
    private readonly permissions: IntegrationPermissionService,
    private readonly auditLogger: IntegrationLoggerService,
    private readonly botMessaging: MatrixBotMessagingService,
    private readonly events: EventEmitter2,
    @Optional() private readonly oauthApps?: OAuthAppCredentialsService,
  ) {}

  /**
   * Retrieves all integrations accessible to the caller in a workspace (workspace + user scoped).
   */
  async getConnectedIntegrations(workspaceId: string, userId?: string) {
    const rows = await this.prisma.externalIntegration.findMany({
      where: {
        OR: [
          { workspaceId, scopeType: 'WORKSPACE' },
          ...(userId ? [{ userId, scopeType: 'USER' }] : []),
        ],
      },
      orderBy: { updatedAt: 'desc' },
    });

    return rows.map((row) => this.formatSafeIntegration(row));
  }

  /**
   * Gets detail of a specific integration with access assert.
   */
  async getIntegrationDetail(integrationId: string, userId: string, workspaceId?: string) {
    const row = await this.permissions.assertIntegrationAccess(integrationId, userId, workspaceId, 'view');
    return this.formatSafeIntegration(row);
  }

  /**
   * Gets all available provider capabilities in the system.
   */
  getAvailableProviders() {
    return this.manager.getAllCapabilities();
  }

  /**
   * Initiates connection: for OAuth, generates authorization URL; for API keys, saves encrypted config.
   */
  async initiateConnect(params: {
    provider: string;
    workspaceId?: string;
    userId: string;
    scopeType?: 'WORKSPACE' | 'USER';
    config?: Record<string, unknown>;
    redirectUri?: string;
  }) {
    const startTime = Date.now();
    const providerKey = params.provider.toUpperCase();
    const adapter = this.manager.getAdapter(providerKey);
    const USER_SCOPED_PROVIDERS = new Set([
      'GMAIL',
      'GOOGLE_CALENDAR',
      'GOOGLE_DRIVE',
      'GOOGLE_DOCS',
      'GOOGLE_SHEETS',
      'GITHUB',
      'LINEAR',
      'NOTION',
      'SLACK',
      'MICROSOFT_TEAMS',
      'TEAMS',
      'TRELLO',
    ]);
    const scopeType = params.scopeType ?? (USER_SCOPED_PROVIDERS.has(providerKey) ? 'USER' : 'WORKSPACE');

    // OAuth flow
    if (adapter.getCapabilities().authType === 'OAUTH2') {
      if (!adapter.getAuthorizationUrl) {
        throw new BadRequestException(`Provider '${providerKey}' does not support OAuth authorization.`);
      }

      const state = this.oauth.generateState({
        provider: providerKey,
        workspaceId: params.workspaceId,
        userId: params.userId,
        scopeType,
        redirectUrl: params.redirectUri,
      });

      // The workspace's own OAuth app (if it set one up) builds the consent URL.
      const authorize = adapter.getAuthorizationUrl.bind(adapter);
      const authUrl = await this.withWorkspaceOAuth(params.workspaceId, () =>
        authorize(state, { redirectUri: params.redirectUri }),
      );

      await this.auditLogger.logAudit({
        workspaceId: params.workspaceId,
        userId: params.userId,
        action: 'OAUTH_INITIATED',
        status: 'SUCCESS',
        durationMs: Date.now() - startTime,
        details: { provider: providerKey, scopeType },
      });

      return { authUrl, state };
    }

    // Custom API / direct configuration flow
    if (providerKey === 'CUSTOM_API') {
      const customConfig = (params.config || {}) as unknown as IntegrationCustomApiConfig;

      // Test connection before saving
      const testResult = await adapter.testConnection(params.config || {});
      if (!testResult.success) {
        throw new BadRequestException(`Failed to connect to Custom API: ${testResult.message}`);
      }

      // Masked metadata for safe retrieval, with every secret kept encrypted beside it.
      const safeMetadata = customApiMetadataWithEncryptedSecrets(customConfig, this.encryption);

      const integrationId =
        scopeType === 'USER'
          ? `user_${params.userId}_${providerKey}`
          : `${params.workspaceId}_${providerKey}`;

      const saved = await this.prisma.externalIntegration.upsert({
        where: { id: integrationId },
        create: {
          id: integrationId,
          workspaceId: scopeType === 'WORKSPACE' ? params.workspaceId : null,
          userId: params.userId,
          scopeType,
          provider: providerKey,
          displayName: customConfig.baseUrl || 'Custom API',
          status: 'CONNECTED',
          metadata: JSON.stringify(safeMetadata),
          // Never the raw config: its key / token / password live encrypted in `metadata`.
          configJson: JSON.stringify(this.withoutSecrets(params.config)),
        },
        update: {
          status: 'CONNECTED',
          metadata: JSON.stringify(safeMetadata),
          configJson: JSON.stringify(this.withoutSecrets(params.config)),
          lastErrorAt: null,
          lastErrorMessage: null,
        },
      });

      await this.auditLogger.logAudit({
        integrationId: saved.id,
        workspaceId: params.workspaceId,
        userId: params.userId,
        action: 'CUSTOM_API_CONNECTED',
        status: 'SUCCESS',
        durationMs: Date.now() - startTime,
        details: { provider: providerKey, baseUrl: customConfig.baseUrl },
      });

      return this.formatSafeIntegration(saved);
    }

    // Manual credential flow — any provider that isn't OAuth2 and isn't the
    // generic Custom API connector (e.g. Trello's personal API key + token,
    // or a future provider that only issues a static API token). The whole
    // config is validated against the real API before it is ever saved, then
    // stored through the same encrypted column an OAuth access token uses —
    // `resolveCredential` hands it back to the adapter verbatim as
    // `credential.accessToken` for it to parse. Never persisted in plaintext.
    if (adapter.getCapabilities().authType !== 'NONE') {
      const config = params.config || {};
      const testResult = await adapter.testConnection(config);
      if (!testResult.success) {
        throw new BadRequestException(`Failed to connect to ${providerKey}: ${testResult.message}`);
      }

      const encryptedAccessToken = this.encryption.encrypt(JSON.stringify(config));
      // The account the app reported (a shop name, a verified WhatsApp name), so the connection is recognisable.
      const accountName = (testResult.details as { displayName?: unknown } | undefined)?.displayName;
      // Only the adapter's secrets are masked; a shop address or username stays readable.
      const secretKeys = adapter.secretFields?.() ?? null;
      const safeMetadata: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(config)) {
        const isSecret = secretKeys ? secretKeys.includes(key) : typeof value === 'string';
        safeMetadata[key] = isSecret && typeof value === 'string' ? this.encryption.maskSecret(value) : value;
      }

      const integrationId =
        scopeType === 'USER'
          ? `user_${params.userId}_${providerKey}`
          : `${params.workspaceId}_${providerKey}`;

      const saved = await this.prisma.externalIntegration.upsert({
        where: { id: integrationId },
        create: {
          id: integrationId,
          workspaceId: scopeType === 'WORKSPACE' ? params.workspaceId : null,
          userId: params.userId,
          scopeType,
          provider: providerKey,
          status: 'CONNECTED',
          displayName: typeof accountName === 'string' ? accountName : null,
          encryptedAccessToken,
          metadata: JSON.stringify(safeMetadata),
        },
        update: {
          status: 'CONNECTED',
          ...(typeof accountName === 'string' ? { displayName: accountName } : {}),
          encryptedAccessToken,
          metadata: JSON.stringify(safeMetadata),
          lastErrorAt: null,
          lastErrorMessage: null,
        },
      });

      await this.auditLogger.logAudit({
        integrationId: saved.id,
        workspaceId: params.workspaceId,
        userId: params.userId,
        action: 'MANUAL_CREDENTIAL_CONNECTED',
        status: 'SUCCESS',
        durationMs: Date.now() - startTime,
        details: { provider: providerKey },
      });

      return this.formatSafeIntegration(saved);
    }

    // Generic direct connect fallback — providers with authType 'NONE' (e.g.
    // the internal OneTab bridge), which hold no credential to validate.
    const integrationId = `${params.workspaceId}_${providerKey}`;
    const saved = await this.prisma.externalIntegration.upsert({
      where: { id: integrationId },
      create: {
        id: integrationId,
        workspaceId: params.workspaceId,
        userId: params.userId,
        scopeType: 'WORKSPACE',
        provider: providerKey,
        status: 'CONNECTED',
        configJson: JSON.stringify(this.withoutSecrets(params.config)),
      },
      update: {
        status: 'CONNECTED',
        configJson: JSON.stringify(this.withoutSecrets(params.config)),
      },
    });

    return this.formatSafeIntegration(saved);
  }

  private withWorkspaceOAuth<T>(workspaceId: string | undefined, fn: () => Promise<T>): Promise<T> {
    return this.oauthApps ? this.oauthApps.runFor(workspaceId, fn) : fn();
  }

  /**
   * Handles OAuth callback from external provider.
   */
  async handleOAuthCallback(code: string, state: string) {
    const startTime = Date.now();
    const statePayload = this.oauth.verifyState(state);
    const adapter = this.manager.getAdapter(statePayload.provider);

    if (!adapter.handleCallback) {
      throw new BadRequestException(`Provider '${statePayload.provider}' does not support OAuth callback.`);
    }

    const handleCallback = adapter.handleCallback.bind(adapter);
    const tokenResult = await this.withWorkspaceOAuth(statePayload.workspaceId, () =>
      handleCallback(code, state, { redirectUri: statePayload.redirectUrl }),
    );

    const encryptedAccessToken = this.encryption.encrypt(tokenResult.accessToken);
    const encryptedRefreshToken = tokenResult.refreshToken
      ? this.encryption.encrypt(tokenResult.refreshToken)
      : undefined;

    const integrationId =
      statePayload.scopeType === 'USER'
        ? `user_${statePayload.userId}_${statePayload.provider}`
        : `${statePayload.workspaceId}_${statePayload.provider}`;

    const metadata: Record<string, unknown> = {
      accountId: tokenResult.accountId,
      accountEmail: tokenResult.accountEmail,
      accountName: tokenResult.accountName,
      ...(tokenResult.metadata || {}),
      // Remembered so refreshes and revokes keep using the OAuth app this was made with.
      ...(statePayload.workspaceId ? { oauthWorkspaceId: statePayload.workspaceId } : {}),
    };

    const saved = await this.prisma.externalIntegration.upsert({
      where: { id: integrationId },
      create: {
        id: integrationId,
        workspaceId: statePayload.scopeType === 'WORKSPACE' ? statePayload.workspaceId : null,
        userId: statePayload.userId,
        scopeType: statePayload.scopeType,
        provider: statePayload.provider,
        providerAccountId: tokenResult.accountId || tokenResult.accountEmail,
        displayName: tokenResult.accountEmail || tokenResult.accountName || statePayload.provider,
        status: 'CONNECTED',
        scopes: JSON.stringify(tokenResult.scopes || []),
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt: tokenResult.tokenExpiresAt,
        metadata: JSON.stringify(metadata),
      },
      update: {
        status: 'CONNECTED',
        providerAccountId: tokenResult.accountId || tokenResult.accountEmail,
        displayName: tokenResult.accountEmail || tokenResult.accountName || statePayload.provider,
        scopes: JSON.stringify(tokenResult.scopes || []),
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt: tokenResult.tokenExpiresAt,
        metadata: JSON.stringify(metadata),
        lastErrorAt: null,
        lastErrorMessage: null,
      },
    });

    await this.auditLogger.logAudit({
      integrationId: saved.id,
      workspaceId: statePayload.workspaceId,
      userId: statePayload.userId,
      action: 'OAUTH_CONNECTED',
      status: 'SUCCESS',
      durationMs: Date.now() - startTime,
      details: { provider: statePayload.provider, account: tokenResult.accountEmail },
    });

    // Enqueue initial sync in background
    await this.syncService.enqueueSyncJob({
      integrationId: saved.id,
      jobType: 'INITIAL_SYNC',
    });

    this.events.emit(AppEvent.IntegrationConnected, {
      workspaceId: saved.workspaceId,
      actorId: statePayload.userId,
      integrationId: saved.id,
    });

    return {
      success: true,
      integration: this.formatSafeIntegration(saved),
      redirectUrl: statePayload.redirectUrl,
    };
  }

  /**
   * Disconnects an integration and revokes third-party credentials.
   */
  async disconnectIntegration(integrationId: string, userId: string, workspaceId?: string) {
    const startTime = Date.now();
    await this.permissions.assertIntegrationAccess(integrationId, userId, workspaceId, 'disconnect');

    try {
      const { adapter, credential } = await this.manager.resolveCredential(integrationId);
      await adapter.disconnect(credential);
    } catch (err) {
      this.logger.warn(`Provider disconnect notice for ${integrationId}: ${err instanceof Error ? err.message : String(err)}`);
    }

    const updated = await this.prisma.externalIntegration.update({
      where: { id: integrationId },
      data: {
        status: 'DISCONNECTED',
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        accessToken: null,
      },
    });

    await this.auditLogger.logAudit({
      integrationId,
      workspaceId,
      userId,
      action: 'INTEGRATION_DISCONNECTED',
      status: 'SUCCESS',
      durationMs: Date.now() - startTime,
    });

    this.events.emit(AppEvent.IntegrationDisconnected, {
      workspaceId: updated.workspaceId,
      actorId: userId,
      integrationId,
    });

    return this.formatSafeIntegration(updated);
  }

  /**
   * Triggers a manual or automated sync job.
   */
  async triggerSync(integrationId: string, userId: string, workspaceId?: string) {
    await this.permissions.assertIntegrationAccess(integrationId, userId, workspaceId, 'sync');
    const { adapter, credential } = await this.manager.resolveCredential(integrationId);

    const job = await this.syncService.enqueueSyncJob({
      integrationId,
      jobType: 'INCREMENTAL_SYNC',
    });

    // Also trigger execution asynchronously
    this.syncService.executeJob(job.id, adapter, credential).catch((err) =>
      this.logger.error(`Sync execution failed: ${err.message}`),
    );

    return {
      message: 'Synchronization triggered successfully.',
      jobId: job.id,
    };
  }

  /**
   * Retrieves messages for an email or messaging integration.
   */
  async getMessages(
    integrationId: string,
    userId: string,
    workspaceId?: string,
    query?: MessageQuery,
  ) {
    await this.permissions.assertIntegrationAccess(integrationId, userId, workspaceId, 'view');
    const { adapter, credential } = await this.manager.resolveCredential(integrationId);

    if (!adapter.getMessages) {
      throw new BadRequestException(`Provider '${credential.provider}' does not support reading messages.`);
    }

    return adapter.getMessages(credential, query);
  }

  /**
   * Retrieves a message thread.
   */
  async getThread(
    integrationId: string,
    threadId: string,
    userId: string,
    workspaceId?: string,
  ) {
    await this.permissions.assertIntegrationAccess(integrationId, userId, workspaceId, 'view');
    const { adapter, credential } = await this.manager.resolveCredential(integrationId);

    if (!adapter.getThread) {
      throw new BadRequestException(`Provider '${credential.provider}' does not support threads.`);
    }

    return adapter.getThread(credential, threadId);
  }

  /**
   * Sends a message / email.
   */
  async sendMessage(
    integrationId: string,
    message: SendMessageInput,
    userId: string,
    workspaceId?: string,
  ) {
    await this.permissions.assertIntegrationAccess(integrationId, userId, workspaceId, 'manage');
    const { adapter, credential } = await this.manager.resolveCredential(integrationId);

    if (!adapter.sendMessage) {
      throw new BadRequestException(`Provider '${credential.provider}' does not support sending messages.`);
    }

    return adapter.sendMessage(credential, message);
  }

  /**
   * Replies to an existing email / thread.
   */
  async replyMessage(
    integrationId: string,
    reply: ReplyMessageInput,
    userId: string,
    workspaceId?: string,
  ) {
    await this.permissions.assertIntegrationAccess(integrationId, userId, workspaceId, 'manage');
    const { adapter, credential } = await this.manager.resolveCredential(integrationId);

    if (!adapter.replyMessage) {
      throw new BadRequestException(`Provider '${credential.provider}' does not support replies.`);
    }

    return adapter.replyMessage(credential, reply);
  }

  /**
   * Creates a draft message.
   */
  async createDraft(
    integrationId: string,
    draft: SendMessageInput,
    userId: string,
    workspaceId?: string,
  ) {
    await this.permissions.assertIntegrationAccess(integrationId, userId, workspaceId, 'manage');
    const { adapter, credential } = await this.manager.resolveCredential(integrationId);

    if (!adapter.createDraft) {
      throw new BadRequestException(`Provider '${credential.provider}' does not support drafts.`);
    }

    return adapter.createDraft(credential, draft);
  }

  /**
   * Modifies labels (e.g. toggle read / star).
   */
  async modifyLabels(
    integrationId: string,
    messageId: string,
    addLabels: string[] = [],
    removeLabels: string[] = [],
    userId: string,
    workspaceId?: string,
  ) {
    await this.permissions.assertIntegrationAccess(integrationId, userId, workspaceId, 'manage');
    const { adapter, credential } = await this.manager.resolveCredential(integrationId);

    if (!adapter.modifyMessageLabels) {
      throw new BadRequestException(`Provider '${credential.provider}' does not support label modifications.`);
    }

    return adapter.modifyMessageLabels(credential, messageId, addLabels, removeLabels);
  }

  /**
   * Lists the actions a connected app exposes to chat (a card's buttons, an
   * app's DM slash-commands) — empty for a provider that hasn't registered any.
   */
  async getActions(integrationId: string, userId: string, workspaceId?: string) {
    await this.permissions.assertIntegrationAccess(integrationId, userId, workspaceId, 'view');
    const { adapter, credential } = await this.manager.resolveCredential(integrationId);
    return adapter.getActionsFor?.(credential) ?? adapter.getActions?.() ?? [];
  }

  /**
   * Runs a *read* action for an app trigger's poll. Same access check as any
   * action, but it refuses anything that writes, and only failures reach the
   * audit log — a poll every few minutes would otherwise bury real activity.
   */
  async pollAction(
    integrationId: string,
    actionId: string,
    input: Record<string, unknown>,
    userId: string,
    workspaceId?: string,
  ): Promise<AppActionResult> {
    await this.permissions.assertIntegrationAccess(integrationId, userId, workspaceId, 'view');
    const { adapter, credential } = await this.manager.resolveCredential(integrationId);
    const definition = (adapter.getActionsFor?.(credential) ?? adapter.getActions?.())?.find((action) => action.id === actionId);
    if (!definition || !adapter.executeAction) {
      throw new NotFoundException(`Provider '${credential.provider}' has no action '${actionId}'.`);
    }
    if (definition.permissionLevel !== 'read') {
      throw new BadRequestException(`'${actionId}' changes data, so it can't be polled.`);
    }
    const startedAt = Date.now();
    try {
      return await adapter.executeAction(credential, actionId, input, { actingUserId: userId, workspaceId });
    } catch (error) {
      await this.auditLogger.logAudit({
        integrationId,
        workspaceId,
        userId,
        action: 'TRIGGER_POLL_FAILED',
        status: 'FAILURE',
        durationMs: Date.now() - startedAt,
        details: { provider: credential.provider, actionId, error: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    }
  }

  /**
   * Runs one of a provider's registered actions.
   *
   * Confirmation is enforced here, not just trusted from the client: a card's
   * `requiresConfirmation` only gates whether the browser shows a dialog first
   * — the request that actually runs the action must carry `confirm: true`
   * itself, or a `requiresConfirmation` action is refused outright.
   */
  async executeAction(
    integrationId: string,
    actionId: string,
    input: Record<string, unknown>,
    confirm: boolean | undefined,
    userId: string,
    workspaceId?: string,
    roomId?: string,
    options: { idempotencyKey?: string } = {},
  ): Promise<AppActionResult> {
    await this.permissions.assertIntegrationAccess(integrationId, userId, workspaceId, 'manage');
    const { adapter, credential } = await this.manager.resolveCredential(integrationId);

    if (!(adapter.getActionsFor || adapter.getActions) || !adapter.executeAction) {
      throw new BadRequestException(`Provider '${credential.provider}' does not support actions.`);
    }

    const definition = (adapter.getActionsFor?.(credential) ?? adapter.getActions?.() ?? []).find((action) => action.id === actionId);
    if (!definition) {
      throw new NotFoundException(`Provider '${credential.provider}' has no action '${actionId}'.`);
    }

    if (definition.requiresConfirmation && confirm !== true) {
      throw new BadRequestException(
        `Action '${actionId}' requires confirmation — resend with confirm: true.`,
      );
    }

    const checked = validateActionInput(definition.inputSchema, input);
    if (!checked.ok) {
      throw new BadRequestException(`${definition.label}: ${checked.errors.join(' ')}`);
    }
    input = checked.input;

    // A write that already ran under this key is never repeated — a retried
    // step, a resumed run or a redelivered event gets the original outcome.
    const keyed = definition.permissionLevel !== 'read' && options.idempotencyKey ? options.idempotencyKey : undefined;
    if (keyed) {
      const earlier = await this.claimIdempotencyKey(integrationId, actionId, keyed);
      if (earlier) return earlier;
    }

    const startedAt = Date.now();
    try {
      const result = await adapter.executeAction(credential, actionId, input, { actingUserId: userId, workspaceId });
      if (keyed) await this.settleIdempotencyKey(integrationId, keyed, result);
      await this.auditLogger.logAudit({
        integrationId,
        workspaceId,
        userId,
        action: `APP_ACTION_${actionId.toUpperCase()}`,
        status: result.success ? 'SUCCESS' : 'FAILURE',
        durationMs: Date.now() - startedAt,
        details: { provider: credential.provider, actionId },
      });

      if (roomId) {
        await this.postActionResult(integrationId, roomId, definition, result).catch(
          (error) =>
            this.logger.warn(
              `Failed to post action result into room ${roomId}: ${String(error)}`,
            ),
        );
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (keyed) await this.settleIdempotencyKey(integrationId, keyed, { success: false, message });
      await this.auditLogger.logAudit({
        integrationId,
        workspaceId,
        userId,
        action: `APP_ACTION_${actionId.toUpperCase()}`,
        status: 'FAILURE',
        durationMs: Date.now() - startedAt,
        details: { provider: credential.provider, actionId, error: message },
      });

      if (roomId) {
        await this.postActionResult(
          integrationId,
          roomId,
          definition,
          { success: false, message },
        ).catch((postError) =>
          this.logger.warn(
            `Failed to post action failure into room ${roomId}: ${String(postError)}`,
          ),
        );
      }

      throw error;
    }
  }

  /**
   * Reserves an idempotency key for a write. Returns the earlier outcome when
   * the same key already succeeded (the action is then not run again), throws
   * when it is still running, and returns null when this call should run it —
   * including when an earlier try with the key failed, which did nothing.
   */
  private async claimIdempotencyKey(integrationId: string, actionId: string, key: string): Promise<AppActionResult | null> {
    try {
      await this.prisma.connectorActionExecution.create({ data: { integrationId, actionId, idempotencyKey: key } });
      return null;
    } catch {
      // The key exists already (unique constraint): decide by its state.
    }
    const row = await this.prisma.connectorActionExecution.findUnique({
      where: { integrationId_idempotencyKey: { integrationId, idempotencyKey: key } },
    });
    if (!row) return null;
    if (row.status === 'SUCCESS') {
      const stored = (row.result ?? {}) as unknown as AppActionResult;
      return { ...stored, success: true, message: `${stored.message ?? 'Done'} (already done earlier — not repeated)`.trim() };
    }
    const stale = Date.now() - row.createdAt.getTime() > 10 * 60_000;
    if (row.status === 'RUNNING' && !stale) {
      throw new ConflictException('This action is already running for this step. It was not started a second time.');
    }
    await this.prisma.connectorActionExecution.update({
      where: { id: row.id },
      data: { status: 'RUNNING', createdAt: new Date(), finishedAt: null },
    });
    return null;
  }

  private async settleIdempotencyKey(integrationId: string, key: string, result: AppActionResult): Promise<void> {
    await this.prisma.connectorActionExecution
      .update({
        where: { integrationId_idempotencyKey: { integrationId, idempotencyKey: key } },
        data: { status: result.success ? 'SUCCESS' : 'FAILED', result: result as any, finishedAt: new Date() },
      })
      .catch((error) => this.logger.warn(`Could not record the outcome for idempotency key: ${String(error)}`));
  }

  /**
   * Posts the outcome of a chat-triggered action back into the room it came
   * from, as the app's own bot identity — a success becomes an
   * `mie.app.response` card, a failure an `mie.system` error notice. Posting
   * is best-effort: the action itself has already succeeded or failed by the
   * time this runs, so a failure here is logged, never thrown.
   */
  private async postActionResult(
    integrationId: string,
    roomId: string,
    definition: AppActionDefinition,
    result: AppActionResult,
  ): Promise<void> {
    const integration = await this.prisma.externalIntegration.findUnique({
      where: { id: integrationId },
      select: { matrixUserId: true, provider: true, displayName: true },
    });
    if (!integration?.matrixUserId) return;

    const appName = integration.displayName ?? integration.provider;
    const data =
      result.data && typeof result.data === 'object'
        ? (result.data as Record<string, unknown>)
        : undefined;

    if (result.success) {
      await this.botMessaging.sendStructured(roomId, integration.matrixUserId, {
        type: 'mie.app.response',
        appId: integrationId,
        appName,
        eventType: definition.id,
        title: definition.label,
        subtitle: result.message,
        data,
        timestamp: Date.now(),
      });
    } else {
      await this.botMessaging.sendStructured(roomId, integration.matrixUserId, {
        type: 'mie.system',
        severity: 'error',
        title: `${definition.label} failed`,
        details: result.message,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Tests a custom API configuration prior to or after connecting.
   */
  async testCustomApi(config: Record<string, unknown>) {
    const adapter = this.manager.getAdapter('CUSTOM_API');
    return adapter.testConnection(config);
  }

  /**
   * Safely executes an HTTP request against a configured Custom API connector.
   */
  async executeCustomRequest(
    integrationId: string,
    req: IntegrationExecuteRequestInput,
    userId: string,
    workspaceId?: string,
  ) {
    await this.permissions.assertIntegrationAccess(integrationId, userId, workspaceId, 'manage');
    const { adapter, credential } = await this.manager.resolveCredential(integrationId);

    if (!adapter.executeCustomRequest) {
      throw new BadRequestException(`Provider '${credential.provider}' does not support custom request execution.`);
    }

    // The stored metadata keeps every secret encrypted; decrypt only for the call.
    const resolvedConfig = customApiConfigFromMetadata(credential.metadata, (c) => this.encryption.decrypt(c));

    return adapter.executeCustomRequest(resolvedConfig, req);
  }

  /**
   * Retrieves sync jobs for an integration.
   */
  async getSyncJobs(integrationId: string, userId: string, workspaceId?: string) {
    await this.permissions.assertIntegrationAccess(integrationId, userId, workspaceId, 'view');
    return this.syncService.getSyncJobs(integrationId);
  }

  // --- Helper to scrub tokens from output ------------------------------------

  /** A connect config with every credential field dropped — safe to store in plain text. */
  private withoutSecrets(config: Record<string, unknown> | undefined): Record<string, unknown> {
    const SECRET = /key|token|secret|password|authorization|credential/i;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(config ?? {})) {
      if (SECRET.test(k)) continue;
      if (k === 'customHeaders' && v && typeof v === 'object') {
        // Header names only; their values are often credentials.
        out[k] = Object.fromEntries(Object.keys(v as Record<string, unknown>).map((h) => [h, '••••']));
        continue;
      }
      out[k] = v;
    }
    return out;
  }

  private formatSafeIntegration(row: any) {
    let parsedMetadata: Record<string, unknown>;
    try {
      parsedMetadata = JSON.parse(row.metadata || '{}');
    } catch {
      parsedMetadata = {};
    }

    // Clean any encrypted keys out of returned metadata
    const safeMeta: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(parsedMetadata)) {
      if (!k.toLowerCase().startsWith('encrypted')) {
        safeMeta[k] = v;
      }
    }

    let parsedScopes: string[];
    try {
      parsedScopes = JSON.parse(row.scopes || '[]');
    } catch {
      parsedScopes = [];
    }

    return {
      id: row.id,
      workspaceId: row.workspaceId,
      userId: row.userId,
      scopeType: row.scopeType,
      provider: row.provider,
      providerAccountId: row.providerAccountId,
      displayName: row.displayName,
      status: row.status,
      scopes: parsedScopes,
      metadata: safeMeta,
      lastSyncAt: row.lastSyncAt ? row.lastSyncAt.toISOString() : null,
      lastErrorAt: row.lastErrorAt ? row.lastErrorAt.toISOString() : null,
      lastErrorMessage: row.lastErrorMessage,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // ---------------------------------------------------------------------------
  // Channel ↔ app links — mirrors `ChannelAgentsService`/`CoworkersService`'s
  // channel-link methods exactly, so "Outlook Calendar APP was added to
  // #agent45" (brief §4) is a real, first-class installation rather than
  // decoration: `ChannelIntegration` gates which apps `AppMatrixBridgeService`
  // lets answer in a channel's room, the same way `ChannelAgent` does for agents.
  // ---------------------------------------------------------------------------

  async listChannelApps(workspaceId: string, channelId: string) {
    await this.assertChannel(workspaceId, channelId);
    const rows = await this.prisma.channelIntegration.findMany({
      where: { channelId },
      include: {
        integration: {
          select: { id: true, provider: true, displayName: true, status: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      channelId: row.channelId,
      integrationId: row.integrationId,
      isEnabled: row.isEnabled,
      addedById: row.addedById,
      createdAt: row.createdAt.toISOString(),
      integration: row.integration,
    }));
  }

  async addChannelApp(
    workspaceId: string,
    channelId: string,
    integrationId: string,
    addedById: string,
  ) {
    await this.assertChannel(workspaceId, channelId);
    await this.assertIntegration(workspaceId, integrationId);

    // Checked before the upsert so re-adding an already-enabled link never
    // posts a duplicate `app_added` system event (brief §30).
    const existing = await this.prisma.channelIntegration.findUnique({
      where: { channelId_integrationId: { channelId, integrationId } },
      select: { isEnabled: true },
    });

    await this.prisma.channelIntegration.upsert({
      where: { channelId_integrationId: { channelId, integrationId } },
      create: { channelId, integrationId, addedById },
      update: { isEnabled: true },
    });

    if (!existing) {
      this.events.emit(AppEvent.ChannelAppLinked, {
        workspaceId,
        actorId: addedById,
        channelId,
        integrationId,
      });
    } else if (!existing.isEnabled) {
      this.events.emit(AppEvent.ChannelAppEnabledChanged, {
        workspaceId,
        actorId: addedById,
        channelId,
        integrationId,
        isEnabled: true,
      });
    }

    return this.listChannelApps(workspaceId, channelId);
  }

  async setChannelAppEnabled(
    workspaceId: string,
    channelId: string,
    integrationId: string,
    isEnabled: boolean,
    actorId?: string,
  ) {
    await this.assertChannel(workspaceId, channelId);
    const link = await this.prisma.channelIntegration.findUnique({
      where: { channelId_integrationId: { channelId, integrationId } },
      select: { id: true, isEnabled: true },
    });
    if (!link) throw new NotFoundException('App is not linked to this channel.');

    await this.prisma.channelIntegration.update({
      where: { id: link.id },
      data: { isEnabled },
    });

    if (link.isEnabled !== isEnabled) {
      this.events.emit(AppEvent.ChannelAppEnabledChanged, {
        workspaceId,
        actorId: actorId ?? null,
        channelId,
        integrationId,
        isEnabled,
      });
    }

    return this.listChannelApps(workspaceId, channelId);
  }

  async removeChannelApp(
    workspaceId: string,
    channelId: string,
    integrationId: string,
    actorId?: string,
  ): Promise<void> {
    await this.assertChannel(workspaceId, channelId);
    const { count } = await this.prisma.channelIntegration.deleteMany({
      where: { channelId, integrationId },
    });

    if (count > 0) {
      this.events.emit(AppEvent.ChannelAppUnlinked, {
        workspaceId,
        actorId: actorId ?? null,
        channelId,
        integrationId,
      });
    }
  }

  private async assertChannel(workspaceId: string, channelId: string): Promise<void> {
    const found = await this.prisma.channel.findFirst({
      where: { id: channelId, workspaceId },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('Channel not found.');
  }

  private async assertIntegration(workspaceId: string, integrationId: string): Promise<void> {
    const found = await this.prisma.externalIntegration.findFirst({
      where: {
        id: integrationId,
        OR: [{ workspaceId }, { workspaceId: null }],
      },
      select: { id: true },
    });
    if (!found) throw new NotFoundException('App not found.');
  }
}
