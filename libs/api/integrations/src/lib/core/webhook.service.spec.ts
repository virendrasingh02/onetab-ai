import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { IntegrationEncryptionService } from './integration-encryption.service.js';
import { IntegrationLoggerService } from './integration-logger.service.js';
import type { ProviderAdapter } from './provider-adapter.interface.js';
import { WebhookService } from './webhook.service.js';

describe('WebhookService', () => {
  let service: WebhookService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      integrationWebhookEvent: {
        findUnique: vi.fn(),
        create: vi.fn().mockImplementation((args) => Promise.resolve({ id: 'evt-1', ...args.data })),
        update: vi.fn().mockResolvedValue({ id: 'evt-1' }),
      },
      integrationAuditLog: {
        create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };

    const config = {
      get: (key: string) => (key === 'ENCRYPTION_KEY' ? 'test-32-byte-encryption-key-for-webhook' : undefined),
    } as unknown as ConfigService;

    const encryption = new IntegrationEncryptionService(config);
    const auditLogger = new IntegrationLoggerService(mockPrisma);
    service = new WebhookService(mockPrisma, encryption, auditLogger);
  });

  it('processes valid webhook events and updates status to PROCESSED', async () => {
    const mockAdapter: ProviderAdapter = {
      providerId: 'GMAIL',
      getCapabilities: vi.fn(),
      getAccount: vi.fn(),
      disconnect: vi.fn(),
      sync: vi.fn(),
      testConnection: vi.fn(),
      handleWebhook: vi.fn().mockResolvedValue({ success: true, eventType: 'gmail.notification' }),
    };

    service.registerAdapter(mockAdapter);
    mockPrisma.integrationWebhookEvent.findUnique.mockResolvedValue(null);

    const result = await service.processWebhook(
      'GMAIL',
      { historyId: '12345' },
      { 'x-event-id': 'google-evt-100' },
    );

    expect(result.status).toBe('PROCESSED');
    expect(result.isDuplicate).toBeUndefined();
    expect(mockAdapter.handleWebhook).toHaveBeenCalled();
    expect(mockPrisma.integrationWebhookEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PROCESSED' }),
      }),
    );
  });

  it('detects duplicate webhook events and skips re-execution', async () => {
    const mockAdapter: ProviderAdapter = {
      providerId: 'CUSTOM_API',
      getCapabilities: vi.fn(),
      getAccount: vi.fn(),
      disconnect: vi.fn(),
      sync: vi.fn(),
      testConnection: vi.fn(),
      handleWebhook: vi.fn(),
    };

    service.registerAdapter(mockAdapter);
    mockPrisma.integrationWebhookEvent.findUnique.mockResolvedValue({
      id: 'existing-event-1',
      provider: 'CUSTOM_API',
      eventId: 'duplicate-id-999',
      status: 'PROCESSED',
    });

    const result = await service.processWebhook(
      'CUSTOM_API',
      { some: 'payload' },
      { 'x-event-id': 'duplicate-id-999' },
    );

    expect(result.status).toBe('DUPLICATE');
    expect(result.isDuplicate).toBe(true);
    expect(mockAdapter.handleWebhook).not.toHaveBeenCalled();
  });
});
