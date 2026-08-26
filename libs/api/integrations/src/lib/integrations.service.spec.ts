import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { IntegrationEncryptionService } from './core/integration-encryption.service.js';
import { IntegrationLoggerService } from './core/integration-logger.service.js';
import { IntegrationManagerService } from './core/integration-manager.service.js';
import { IntegrationPermissionService } from './core/integration-permission.service.js';
import { IntegrationSyncService } from './core/integration-sync.service.js';
import { OAuthService } from './core/oauth.service.js';
import { SSRFGuardService } from './core/ssrf-guard.service.js';
import { WebhookService } from './core/webhook.service.js';
import { IntegrationsService } from './integrations.service.js';
import { CustomApiProvider } from './providers/custom-api.provider.js';
import { GmailProvider } from './providers/gmail.provider.js';
import { OneTabAppProvider } from './providers/onetab-app.provider.js';

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let mockPrisma: any;
  let mockConfig: Record<string, string | undefined>;

  beforeEach(() => {
    mockConfig = {
      ENCRYPTION_KEY: 'test-32-byte-encryption-key-for-service',
      GOOGLE_CLIENT_ID: 'google-client-id.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: 'google-client-secret',
    };

    const configService = {
      get: vi.fn((key: string) => mockConfig[key]),
    } as unknown as ConfigService;

    mockPrisma = {
      externalIntegration: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'ws-1_GMAIL',
            workspaceId: 'ws-1',
            userId: 'user-1',
            scopeType: 'USER',
            provider: 'GMAIL',
            displayName: 'user@example.com',
            status: 'CONNECTED',
            scopes: '["https://www.googleapis.com/auth/gmail.readonly"]',
            metadata: '{"accountEmail":"user@example.com"}',
            encryptedAccessToken: 'enc-token-123',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ]),
        findUnique: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
      },
      integrationAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
      integrationSyncJob: {
        create: vi.fn().mockImplementation((args) => Promise.resolve({ id: 'job-1', ...args.data })),
        update: vi.fn(),
      },
    };

    const encryption = new IntegrationEncryptionService(configService);
    const auditLogger = new IntegrationLoggerService(mockPrisma);
    const ssrfGuard = new SSRFGuardService();
    const oauth = new OAuthService(encryption);
    const webhook = new WebhookService(mockPrisma, encryption, auditLogger);
    const sync = new IntegrationSyncService(mockPrisma, auditLogger);
    const permissions = new IntegrationPermissionService(mockPrisma);

    const gmailProvider = new GmailProvider(configService);
    const customApiProvider = new CustomApiProvider(ssrfGuard);
    const oneTabAppProvider = new OneTabAppProvider();

    const manager = new IntegrationManagerService(
      mockPrisma,
      encryption,
      webhook,
      gmailProvider,
      customApiProvider,
      oneTabAppProvider,
    );
    manager.onModuleInit();

    service = new IntegrationsService(
      mockPrisma,
      manager,
      encryption,
      oauth,
      sync,
      permissions,
      auditLogger,
    );
  });

  it('lists connected integrations with sensitive tokens sanitized', async () => {
    const list = await service.getConnectedIntegrations('ws-1', 'user-1');

    expect(list.length).toBe(1);
    expect(list[0].id).toBe('ws-1_GMAIL');
    expect(list[0].displayName).toBe('user@example.com');
    // Ensure plain or encrypted access token is never leaked
    expect((list[0] as any).accessToken).toBeUndefined();
    expect((list[0] as any).encryptedAccessToken).toBeUndefined();
  });

  it('initiates OAuth connect for Gmail and returns an authUrl with CSRF state', async () => {
    const res = await service.initiateConnect({
      provider: 'GMAIL',
      workspaceId: 'ws-1',
      userId: 'user-1',
      scopeType: 'USER',
    });

    expect(res.authUrl).toContain('https://accounts.google.com/o/oauth2/v2/auth');
    expect(res.state).toBeDefined();
  });
});
