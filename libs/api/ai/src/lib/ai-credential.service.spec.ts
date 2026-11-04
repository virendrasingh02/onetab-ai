import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@org/database';
import { AICredentialService } from './ai-credential.service.js';
import { AIEncryptionService } from './ai-encryption.service.js';
import { ModelRegistryService } from './model-registry.service.js';
import { ProviderRegistryService } from './provider-registry.service.js';

describe('AICredentialService', () => {
  let service: AICredentialService;
  let encryption: AIEncryptionService;
  let providerRegistry: ProviderRegistryService;
  let mockPrisma: any;
  let mockConfig: Record<string, string | undefined>;

  beforeEach(() => {
    mockConfig = {
      ENCRYPTION_KEY: 'test-encryption-key-for-unit-testing-32b',
      NVIDIA_API_KEY: 'nvapi-env-fallback-key-9999',
    };

    const configService = {
      get: vi.fn((key: string) => mockConfig[key]),
    } as unknown as ConfigService;

    encryption = new AIEncryptionService(configService);

    providerRegistry = new ProviderRegistryService(configService);
    const modelRegistry = new ModelRegistryService(providerRegistry);

    mockPrisma = {
      aIProviderCredential: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn(),
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      aIModelSetting: {
        findMany: vi.fn().mockResolvedValue([]),
        upsert: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    service = new AICredentialService(
      mockPrisma as unknown as PrismaService,
      configService,
      encryption,
      providerRegistry,
      modelRegistry
    );
  });

  /** Stands in for the provider: resolves, or rejects with `failure`. */
  const stubProviderReply = (failure?: Error) => {
    const chat = vi.spyOn(providerRegistry.getAdapter('anthropic'), 'chat');
    if (failure) chat.mockRejectedValue(failure);
    else chat.mockResolvedValue({} as never);
    return chat;
  };

  describe('resolveCredential hierarchy', () => {
    it('falls back to environment variable when no DB credential exists', async () => {
      mockPrisma.aIProviderCredential.findFirst.mockResolvedValue(null);

      const resolved = await service.resolveCredential('nvidia', {
        workspaceId: 'ws-123',
      });

      expect(resolved.source).toBe('environment');
      expect(resolved.apiKey).toBe('nvapi-env-fallback-key-9999');
      expect(resolved.isCustom).toBe(false);
    });

    it('prioritizes workspace database credential over environment variable', async () => {
      const encryptedKey = encryption.encrypt('nvapi-workspace-custom-key-1111');
      mockPrisma.aIProviderCredential.findFirst.mockResolvedValue({
        id: 'cred-1',
        provider: 'nvidia',
        scopeType: 'workspace',
        scopeId: 'ws-123',
        encryptedApiKey: encryptedKey,
        maskedKey: '••••••••••••1111',
        enabled: true,
        baseUrl: 'https://custom-nim.internal/v1',
      });

      const resolved = await service.resolveCredential('nvidia', {
        workspaceId: 'ws-123',
      });

      expect(resolved.source).toBe('database');
      expect(resolved.apiKey).toBe('nvapi-workspace-custom-key-1111');
      expect(resolved.baseUrl).toBe('https://custom-nim.internal/v1');
      expect(resolved.isCustom).toBe(true);
    });
  });

  describe('listWorkspaceProviders', () => {
    it('returns providers with masked keys and never exposes plaintext', async () => {
      const encryptedKey = encryption.encrypt('sk-openai-custom-secret-key-4321');
      mockPrisma.aIProviderCredential.findMany.mockResolvedValue([
        {
          provider: 'openai',
          scopeType: 'workspace',
          scopeId: 'ws-123',
          encryptedApiKey: encryptedKey,
          maskedKey: '••••••••••••4321',
          enabled: true,
          status: 'CONNECTED',
        },
      ]);

      const providers = await service.listWorkspaceProviders('ws-123');
      const openai = providers.find((p) => p.id === 'openai');

      expect(openai).toBeDefined();
      expect(openai?.configured).toBe(true);
      expect(openai?.maskedKey).toBe('••••••••••••4321');
      expect(openai?.status).toBe('CONNECTED');
      // Verify raw key is never present in metadata
      expect((openai as any).apiKey).toBeUndefined();
      expect((openai as any).encryptedApiKey).toBeUndefined();
    });
  });

  describe('saveCredential', () => {
    it('encrypts the key and returns masked metadata without exposing plaintext', async () => {
      mockPrisma.aIProviderCredential.findFirst.mockResolvedValue(null);
      mockPrisma.aIProviderCredential.upsert.mockResolvedValue({});
      stubProviderReply();

      // Mock subsequent list query
      mockPrisma.aIProviderCredential.findMany.mockResolvedValue([
        {
          provider: 'anthropic',
          scopeType: 'workspace',
          scopeId: 'ws-123',
          encryptedApiKey: 'enc-tag',
          maskedKey: '••••••••••••7777',
          enabled: true,
          status: 'CONNECTED',
        },
      ]);

      const result = await service.saveCredential(
        'ws-123',
        'anthropic',
        {
          apiKey: 'sk-ant-test-super-secret-key-7777',
          enabled: true,
        },
        'user-1'
      );

      expect(mockPrisma.aIProviderCredential.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            provider_scopeType_scopeId: {
              provider: 'anthropic',
              scopeType: 'workspace',
              scopeId: 'ws-123',
            },
          },
          create: expect.objectContaining({
            maskedKey: '••••••••••••7777',
            status: 'CONNECTED',
          }),
        })
      );

      expect(result.id).toBe('anthropic');
      expect(result.maskedKey).toBe('••••••••••••7777');
      expect((result as any).apiKey).toBeUndefined();
    });

    it('with verify, writes nothing when the provider rejects the key', async () => {
      mockPrisma.aIProviderCredential.findFirst.mockResolvedValue(null);
      stubProviderReply(new HttpException('Invalid key', 401));

      await expect(
        service.saveCredential('ws-123', 'anthropic', { apiKey: 'sk-ant-bad', verify: true })
      ).rejects.toThrow('Invalid key');
      expect(mockPrisma.aIProviderCredential.upsert).not.toHaveBeenCalled();
    });

    it('without verify, saves what the provider actually answered', async () => {
      mockPrisma.aIProviderCredential.findFirst.mockResolvedValue(null);
      mockPrisma.aIProviderCredential.findMany.mockResolvedValue([]);
      stubProviderReply(new HttpException('Invalid key', 401));

      await service.saveCredential('ws-123', 'anthropic', { apiKey: 'sk-ant-bad' });

      const { create } = mockPrisma.aIProviderCredential.upsert.mock.calls[0][0];
      expect(create.status).toBe('AUTH_ERROR');
      expect(JSON.parse(create.metadata).lastError).toContain('Invalid key');
    });

    it('does not re-check when nothing about the connection changed', async () => {
      mockPrisma.aIProviderCredential.findFirst.mockResolvedValue({
        encryptedApiKey: 'enc',
        maskedKey: '••••7777',
        baseUrl: null,
        defaultModel: 'claude-sonnet-4-5',
      });
      const chat = stubProviderReply();

      await service.saveCredential('ws-123', 'anthropic', {
        defaultModel: 'claude-sonnet-4-5',
        enabled: false,
      });

      expect(chat).not.toHaveBeenCalled();
    });

    it('refuses a provider this deployment does not offer, before writing', async () => {
      mockConfig['AI_ENABLED_PROVIDERS'] = 'nvidia';
      const narrowed = new AICredentialService(
        mockPrisma as unknown as PrismaService,
        { get: (key: string) => mockConfig[key] } as unknown as ConfigService,
        encryption,
        new ProviderRegistryService({ get: (key: string) => mockConfig[key] } as unknown as ConfigService)
      );

      await expect(
        narrowed.saveCredential('ws-123', 'groq', { apiKey: 'gsk_x' })
      ).rejects.toThrow("'groq' not found");
      expect(mockPrisma.aIProviderCredential.upsert).not.toHaveBeenCalled();
    });
  });

  describe('testWorkspaceConnection', () => {
    it('never stores a key the provider echoes back in its error', async () => {
      const key = 'sk-ant-echoed-secret';
      mockPrisma.aIProviderCredential.findFirst.mockImplementation(({ where }: any) =>
        where.scopeType === 'workspace'
          ? { encryptedApiKey: encryption.encrypt(key), enabled: true }
          : null
      );
      stubProviderReply(new HttpException(`Bad key ${key}`, 401));

      const result = await service.testWorkspaceConnection('ws-123', 'anthropic');

      expect(result.status).toBe('AUTH_ERROR');
      expect(result.detail).not.toContain(key);
      expect(JSON.stringify(mockPrisma.aIProviderCredential.updateMany.mock.calls)).not.toContain(key);
    });
  });

  describe('workspace settings without a key', () => {
    it('keeps the workspace endpoint and default model on the platform key', async () => {
      mockPrisma.aIProviderCredential.findFirst.mockImplementation(({ where }: any) =>
        where.scopeType === 'workspace'
          ? { encryptedApiKey: '', baseUrl: 'https://proxy.example.com/v1', defaultModel: 'm-1', enabled: true }
          : null
      );

      const resolved = await service.resolveCredential('nvidia', { workspaceId: 'ws-123' });

      expect(resolved.apiKey).toBe('nvapi-env-fallback-key-9999');
      expect(resolved.baseUrl).toBe('https://proxy.example.com/v1');
      expect(resolved.defaultModel).toBe('m-1');
    });

    it('applies workspace model choices to the model list', async () => {
      mockPrisma.aIModelSetting.findMany.mockResolvedValue([
        { modelId: 'claude-sonnet', enabled: false, isDefault: false },
      ]);

      const models = await service.listWorkspaceModels('ws-123');

      expect(models.find((m) => m.id === 'claude-sonnet')?.enabled).toBe(false);
    });
  });

  describe('deleteCredential', () => {
    it('deletes the workspace-scoped credential record', async () => {
      await service.deleteCredential('ws-123', 'nvidia', 'user-1');

      expect(mockPrisma.aIProviderCredential.deleteMany).toHaveBeenCalledWith({
        where: {
          provider: 'nvidia',
          scopeType: 'workspace',
          scopeId: 'ws-123',
        },
      });
    });
  });
});
