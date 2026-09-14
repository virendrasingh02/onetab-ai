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
import { GitHubProvider } from './providers/github.provider.js';
import { GmailProvider } from './providers/gmail.provider.js';
import { GoogleCalendarProvider } from './providers/google-calendar.provider.js';
import { GoogleDocsProvider } from './providers/google-docs.provider.js';
import { GoogleDriveProvider } from './providers/google-drive.provider.js';
import { GoogleSheetsProvider } from './providers/google-sheets.provider.js';
import { LinearProvider } from './providers/linear.provider.js';
import { NotionProvider } from './providers/notion.provider.js';
import { OneTabAppProvider } from './providers/onetab-app.provider.js';
import { SlackProvider } from './providers/slack.provider.js';
import { TrelloProvider } from './providers/trello.provider.js';

describe('IntegrationsService', () => {
  let service: IntegrationsService;
  let mockPrisma: any;
  let mockConfig: Record<string, string | undefined>;
  let mockEvents: { emit: ReturnType<typeof vi.fn> };

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
    mockPrisma.externalIntegration.findUnique = vi.fn().mockResolvedValue({
      id: 'int-1',
      workspaceId: 'ws-1',
      userId: null,
      scopeType: 'WORKSPACE',
      provider: 'SLACK',
      status: 'CONNECTED',
      encryptedAccessToken: null,
    });
    mockPrisma.externalIntegration.update = vi.fn().mockResolvedValue({
      id: 'int-1',
      workspaceId: 'ws-1',
      status: 'DISCONNECTED',
      scopes: '[]',
      metadata: '{}',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockPrisma.workspaceMember = {
      findUnique: vi.fn().mockResolvedValue({ role: 'ADMIN' }),
    };
    mockPrisma.channel = {
      findFirst: vi.fn().mockResolvedValue({ id: 'chan-1' }),
    };
    mockPrisma.externalIntegration.findFirst = vi.fn().mockResolvedValue({ id: 'int-1' });
    mockPrisma.channelIntegration = {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
    };

    mockEvents = { emit: vi.fn() };

    const encryption = new IntegrationEncryptionService(configService);
    const auditLogger = new IntegrationLoggerService(mockPrisma);
    const ssrfGuard = new SSRFGuardService();
    const oauth = new OAuthService(encryption);
    const webhook = new WebhookService(mockPrisma, encryption, auditLogger);
    const sync = new IntegrationSyncService(mockPrisma, auditLogger);
    const permissions = new IntegrationPermissionService(mockPrisma);

    const gmailProvider = new GmailProvider(configService);
    const googleCalendarProvider = new GoogleCalendarProvider(configService);
    const googleDriveProvider = new GoogleDriveProvider(configService);
    const googleDocsProvider = new GoogleDocsProvider(configService);
    const googleSheetsProvider = new GoogleSheetsProvider(configService);
    const githubProvider = new GitHubProvider(configService);
    const linearProvider = new LinearProvider(configService);
    const notionProvider = new NotionProvider(configService);
    const slackProvider = new SlackProvider(configService);
    const trelloProvider = new TrelloProvider();
    const customApiProvider = new CustomApiProvider(ssrfGuard);
    const oneTabAppProvider = new OneTabAppProvider();

    const manager = new IntegrationManagerService(
      mockPrisma,
      encryption,
      webhook,
      gmailProvider,
      googleCalendarProvider,
      googleDriveProvider,
      googleDocsProvider,
      googleSheetsProvider,
      githubProvider,
      linearProvider,
      notionProvider,
      slackProvider,
      trelloProvider,
      customApiProvider,
      oneTabAppProvider,
    );
    manager.onModuleInit();

    const botMessaging = { sendStructured: vi.fn() } as any;

    service = new IntegrationsService(
      mockPrisma,
      manager,
      encryption,
      oauth,
      sync,
      permissions,
      auditLogger,
      botMessaging,
      mockEvents as any,
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

  it('emits IntegrationDisconnected after a successful disconnect (brief §22)', async () => {
    await service.disconnectIntegration('int-1', 'user-1', 'ws-1');

    expect(mockEvents.emit).toHaveBeenCalledWith(
      'integration.disconnected',
      expect.objectContaining({ integrationId: 'int-1', workspaceId: 'ws-1', actorId: 'user-1' }),
    );
  });

  describe('channel ↔ app links (brief §4)', () => {
    it('emits ChannelAppLinked the first time an app is added to a channel', async () => {
      await service.addChannelApp('ws-1', 'chan-1', 'int-1', 'admin-1');

      expect(mockEvents.emit).toHaveBeenCalledWith(
        'channel.app.linked',
        expect.objectContaining({ channelId: 'chan-1', integrationId: 'int-1', actorId: 'admin-1' }),
      );
    });

    it('does not re-emit when the app is already linked and enabled (brief §30)', async () => {
      mockPrisma.channelIntegration.findUnique.mockResolvedValue({ isEnabled: true });

      await service.addChannelApp('ws-1', 'chan-1', 'int-1', 'admin-1');

      expect(mockEvents.emit).not.toHaveBeenCalledWith('channel.app.linked', expect.anything());
    });

    it('emits ChannelAppUnlinked only when a row was actually removed', async () => {
      mockPrisma.channelIntegration.deleteMany.mockResolvedValue({ count: 0 });
      await service.removeChannelApp('ws-1', 'chan-1', 'int-1', 'admin-1');
      expect(mockEvents.emit).not.toHaveBeenCalledWith('channel.app.unlinked', expect.anything());

      mockPrisma.channelIntegration.deleteMany.mockResolvedValue({ count: 1 });
      await service.removeChannelApp('ws-1', 'chan-1', 'int-1', 'admin-1');
      expect(mockEvents.emit).toHaveBeenCalledWith(
        'channel.app.unlinked',
        expect.objectContaining({ channelId: 'chan-1', integrationId: 'int-1' }),
      );
    });
  });
});
