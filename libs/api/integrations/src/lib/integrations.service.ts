import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '@org/database';
import type {
  IntegrationCustomApiConfig,
  IntegrationExecuteRequestInput,
  ReplyMessageInput,
  SendMessageInput,
} from '@org/types';
import { IntegrationEncryptionService } from './core/integration-encryption.service.js';
import { IntegrationLoggerService } from './core/integration-logger.service.js';
import { IntegrationManagerService } from './core/integration-manager.service.js';
import { IntegrationPermissionService } from './core/integration-permission.service.js';
import { IntegrationSyncService } from './core/integration-sync.service.js';
import { OAuthService } from './core/oauth.service.js';
import type { MessageQuery } from './core/provider-adapter.interface.js';

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
    const scopeType = params.scopeType ?? (providerKey === 'GMAIL' ? 'USER' : 'WORKSPACE');

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

      const authUrl = await adapter.getAuthorizationUrl(state, {
        redirectUri: params.redirectUri,
      });

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

      // Encrypt sensitive secrets in config
      let encryptedApiKey: string | undefined;
      let encryptedBearer: string | undefined;
      let encryptedBasicPass: string | undefined;

      if (customConfig.apiKey) {
        encryptedApiKey = this.encryption.encrypt(customConfig.apiKey);
      }
      if (customConfig.bearerToken) {
        encryptedBearer = this.encryption.encrypt(customConfig.bearerToken);
      }
      if (customConfig.basicPassword) {
        encryptedBasicPass = this.encryption.encrypt(customConfig.basicPassword);
      }

      // Store masked metadata for safe retrieval
      const safeMetadata: Record<string, unknown> = {
        ...customConfig,
        apiKey: this.encryption.maskSecret(customConfig.apiKey),
        bearerToken: this.encryption.maskSecret(customConfig.bearerToken),
        basicPassword: this.encryption.maskSecret(customConfig.basicPassword),
        encryptedApiKey,
        encryptedBearer,
        encryptedBasicPass,
      };

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
          configJson: JSON.stringify(params.config || {}),
        },
        update: {
          status: 'CONNECTED',
          metadata: JSON.stringify(safeMetadata),
          configJson: JSON.stringify(params.config || {}),
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

    // Generic direct connect fallback (for backward compatibility)
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
        configJson: JSON.stringify(params.config || {}),
      },
      update: {
        status: 'CONNECTED',
        configJson: JSON.stringify(params.config || {}),
      },
    });

    return this.formatSafeIntegration(saved);
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

    const tokenResult = await adapter.handleCallback(code, state, {
      redirectUri: statePayload.redirectUrl,
    });

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

    // Decrypt any stored encrypted credentials in metadata
    const rawConfig = credential.metadata as Record<string, any>;
    const resolvedConfig: IntegrationCustomApiConfig = {
      baseUrl: rawConfig.baseUrl,
      authType: rawConfig.authType,
      apiKey: rawConfig.encryptedApiKey ? this.encryption.decrypt(rawConfig.encryptedApiKey) : rawConfig.apiKey,
      apiKeyHeader: rawConfig.apiKeyHeader,
      apiKeyQueryParam: rawConfig.apiKeyQueryParam,
      bearerToken: rawConfig.encryptedBearer ? this.encryption.decrypt(rawConfig.encryptedBearer) : rawConfig.bearerToken,
      basicUsername: rawConfig.basicUsername,
      basicPassword: rawConfig.encryptedBasicPass ? this.encryption.decrypt(rawConfig.encryptedBasicPass) : rawConfig.basicPassword,
      customHeaders: rawConfig.customHeaders,
      queryParams: rawConfig.queryParams,
      timeoutMs: rawConfig.timeoutMs,
      retryAttempts: rawConfig.retryAttempts,
    };

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
      configJson: row.configJson,
      lastSyncAt: row.lastSyncAt ? row.lastSyncAt.toISOString() : null,
      lastErrorAt: row.lastErrorAt ? row.lastErrorAt.toISOString() : null,
      lastErrorMessage: row.lastErrorMessage,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
