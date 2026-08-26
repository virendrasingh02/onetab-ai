import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '@org/database';
import type { IntegrationCapabilities } from '@org/types';
import { CustomApiProvider } from '../providers/custom-api.provider.js';
import { GmailProvider } from '../providers/gmail.provider.js';
import { OneTabAppProvider } from '../providers/onetab-app.provider.js';
import { IntegrationEncryptionService } from './integration-encryption.service.js';
import type { ProviderAdapter, ResolvedCredential } from './provider-adapter.interface.js';
import { WebhookService } from './webhook.service.js';

@Injectable()
export class IntegrationManagerService implements OnModuleInit {
  private readonly logger = new Logger(IntegrationManagerService.name);
  private readonly adapters = new Map<string, ProviderAdapter>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: IntegrationEncryptionService,
    private readonly webhookService: WebhookService,
    private readonly gmailProvider: GmailProvider,
    private readonly customApiProvider: CustomApiProvider,
    private readonly oneTabAppProvider: OneTabAppProvider,
  ) {}

  onModuleInit() {
    this.registerAdapter(this.gmailProvider);
    this.registerAdapter(this.customApiProvider);
    this.registerAdapter(this.oneTabAppProvider);
    this.logger.log(`Initialized IntegrationManager with ${this.adapters.size} providers.`);
  }

  registerAdapter(adapter: ProviderAdapter) {
    const key = adapter.providerId.toUpperCase();
    this.adapters.set(key, adapter);
    this.webhookService.registerAdapter(adapter);
    this.logger.log(`Registered adapter for provider: ${key}`);
  }

  getAdapter(provider: string): ProviderAdapter {
    const key = provider.toUpperCase();
    const adapter = this.adapters.get(key);
    if (!adapter) {
      throw new BadRequestException(`Unsupported integration provider '${provider}'.`);
    }
    return adapter;
  }

  getAllCapabilities(): IntegrationCapabilities[] {
    return Array.from(this.adapters.values()).map((adapter) =>
      adapter.getCapabilities(),
    );
  }

  /**
   * Resolves and decrypts credentials for an integration, auto-refreshing expired tokens.
   */
  async resolveCredential(integrationId: string): Promise<{
    adapter: ProviderAdapter;
    credential: ResolvedCredential;
  }> {
    const integration = await this.prisma.externalIntegration.findUnique({
      where: { id: integrationId },
    });

    if (!integration) {
      throw new NotFoundException(`Integration '${integrationId}' not found.`);
    }

    const adapter = this.getAdapter(integration.provider);

    let accessToken = '';
    if (integration.encryptedAccessToken) {
      accessToken = this.encryption.decrypt(integration.encryptedAccessToken);
    } else if (integration.accessToken) {
      accessToken = integration.accessToken;
    }

    let refreshToken: string | null = null;
    if (integration.encryptedRefreshToken) {
      refreshToken = this.encryption.decrypt(integration.encryptedRefreshToken);
    }

    let parsedMetadata: Record<string, unknown>;
    try {
      parsedMetadata = JSON.parse(integration.metadata || integration.configJson || '{}');
    } catch {
      parsedMetadata = {};
    }

    let parsedScopes: string[];
    try {
      parsedScopes = JSON.parse(integration.scopes || '[]');
    } catch {
      parsedScopes = [];
    }

    const credential: ResolvedCredential = {
      id: integration.id,
      provider: integration.provider,
      scopeType: (integration.scopeType as 'WORKSPACE' | 'USER') || 'WORKSPACE',
      workspaceId: integration.workspaceId,
      userId: integration.userId,
      accessToken,
      refreshToken,
      tokenExpiresAt: integration.tokenExpiresAt,
      metadata: parsedMetadata,
      scopes: parsedScopes,
    };

    // Auto-refresh token if within 5 minutes of expiration and refresh token exists
    if (
      credential.refreshToken &&
      credential.tokenExpiresAt &&
      credential.tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000 &&
      adapter.refreshToken
    ) {
      try {
        this.logger.log(`Proactively refreshing token for integration ${integration.id}`);
        const refreshed = await adapter.refreshToken(credential.refreshToken);
        credential.accessToken = refreshed.accessToken;
        credential.tokenExpiresAt = refreshed.tokenExpiresAt;

        await this.prisma.externalIntegration.update({
          where: { id: integration.id },
          data: {
            encryptedAccessToken: this.encryption.encrypt(refreshed.accessToken),
            tokenExpiresAt: refreshed.tokenExpiresAt,
          },
        });
      } catch (err) {
        this.logger.warn(`Failed proactive token refresh: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { adapter, credential };
  }
}
