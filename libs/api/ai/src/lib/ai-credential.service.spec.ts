import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@org/database';
import { AICredentialService } from './ai-credential.service.js';
import { AIEncryptionService } from './ai-encryption.service.js';
import { ModelRegistryService } from './model-registry.service.js';
import { ProviderRegistryService } from './provider-registry.service.js';

describe('AICredentialService', () => {
  let service: AICredentialService;
  let encryption: AIEncryptionService;
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

    const providerRegistry = new ProviderRegistryService(configService);
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
