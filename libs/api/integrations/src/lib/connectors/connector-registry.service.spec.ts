import { describe, expect, it, vi } from 'vitest';
import type { ProviderAdapter } from '../core/provider-adapter.interface.js';
import { ConnectorRegistryService } from './connector-registry.service.js';

const adapter = (over: Partial<ProviderAdapter> & { providerId: string; caps?: Record<string, unknown> }): ProviderAdapter =>
  ({
    getCapabilities: () => ({
      provider: over.providerId,
      displayName: over.providerId.charAt(0) + over.providerId.slice(1).toLowerCase(),
      description: '',
      category: 'Communication',
      authType: 'OAUTH2',
      supportsSync: false,
      supportsWebhooks: false,
      supportsMessaging: false,
      supportsCustomEndpoints: false,
      ...(over.caps ?? {}),
    }),
    getAccount: vi.fn(),
    disconnect: vi.fn(),
    sync: vi.fn(),
    handleWebhook: vi.fn(),
    testConnection: vi.fn(),
    ...over,
  }) as unknown as ProviderAdapter;

function setup(adapters: ProviderAdapter[], rows: Array<Record<string, unknown>> = [], logs: Array<Record<string, unknown>> = []) {
  const prisma = {
    externalIntegration: {
      findMany: vi.fn().mockResolvedValue(rows),
      update: vi.fn().mockResolvedValue({}),
    },
    integrationAuditLog: { findMany: vi.fn().mockResolvedValue(logs) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const manager = { listAdapters: () => adapters, resolveCredential: vi.fn() };
  const permissions = { assertIntegrationAccess: vi.fn().mockResolvedValue({}) };
  const audit = { logAudit: vi.fn().mockResolvedValue(undefined) };
  const service = new ConnectorRegistryService(prisma as never, manager as never, permissions as never, audit as never);
  return { service, prisma, manager, permissions, audit };
}

const row = (over: Record<string, unknown>) => ({
  id: 'int-1',
  provider: 'SLACK',
  scopeType: 'USER',
  status: 'CONNECTED',
  displayName: 'me@acme.test',
  userId: 'u1',
  scopes: '["chat:write"]',
  metadata: '{"accountEmail":"me@acme.test","encryptedSecret":"x"}',
  lastSyncAt: null,
  lastErrorAt: null,
  lastErrorMessage: null,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  ...over,
});

describe('ConnectorRegistryService', () => {
  const slack = adapter({
    providerId: 'SLACK',
    getActions: () => [
      { id: 'list_messages', label: 'List messages', description: '', inputSchema: {}, permissionLevel: 'read', requiresConfirmation: false },
      { id: 'send_message', label: 'Send a message', description: '', inputSchema: {}, permissionLevel: 'write', requiresConfirmation: false },
    ],
    getTriggers: () => [{ id: 'new_message', label: 'New message', description: '', pollActionId: 'list_messages', itemsPath: 'messages', idField: 'ts' }],
  });
  const internal = adapter({ providerId: 'ONETAB_INTERNAL', caps: { authType: 'NONE' } });
  const github = adapter({ providerId: 'GITHUB', isServerConfigured: () => false });

  it('lists every real adapter as a connector, hiding internal plumbing', () => {
    const { service } = setup([slack, internal, github]);
    expect(service.manifests().map((m) => m.provider)).toEqual(['GITHUB', 'SLACK']);
  });

  it('merges the caller’s connections and real usage into each connector', async () => {
    const { service } = setup(
      [slack, github],
      [row({})],
      [
        { integrationId: 'int-1', action: 'APP_ACTION_SEND_MESSAGE', status: 'SUCCESS', durationMs: 120, createdAt: new Date('2026-10-08T10:00:00Z') },
        { integrationId: 'other', action: 'APP_ACTION_SEND_MESSAGE', status: 'SUCCESS', durationMs: 1, createdAt: new Date('2026-10-08T09:00:00Z') },
      ],
    );
    const [gh, sl] = await service.list('ws-1', 'u1');
    expect(gh.status).toBe('unavailable');
    expect(gh.unavailableReason).toMatch(/OAuth app credentials/);
    expect(sl.status).toBe('connected');
    expect(sl.connections[0]).toMatchObject({ id: 'int-1', mine: true, accountEmail: 'me@acme.test', scopes: ['chat:write'] });
    // Only this connector's own calls count.
    expect(sl.usage).toMatchObject({ calls: 1, failures: 0, avgDurationMs: 120, topAction: 'Send a message' });
    expect(sl.counts).toEqual({ actions: 1, queries: 1, triggers: 1 });
  });

  it('reports a passing connection test from the app’s own account endpoint', async () => {
    const { service, manager, prisma, audit } = setup([slack]);
    const getAccount = vi.fn().mockResolvedValue({ accountId: 'U1', name: 'Priya', email: 'p@acme.test' });
    manager.resolveCredential.mockResolvedValue({ adapter: { getAccount }, credential: { provider: 'SLACK' } });
    const res = await service.testConnection('ws-1', 'u1', 'int-1');
    expect(res).toMatchObject({ success: true, message: 'Connected as Priya.' });
    expect(prisma.externalIntegration.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CONNECTED', lastErrorMessage: null }) }),
    );
    expect(audit.logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'CONNECTION_TESTED', status: 'SUCCESS' }));
  });

  it('marks a refused sign-in as needing a reconnect', async () => {
    const { service, manager, prisma } = setup([slack]);
    manager.resolveCredential.mockResolvedValue({
      adapter: { getAccount: vi.fn().mockRejectedValue(new Error('Slack API error: invalid_auth (401 Unauthorized)')) },
      credential: { provider: 'SLACK' },
    });
    const res = await service.testConnection('ws-1', 'u1', 'int-1');
    expect(res.success).toBe(false);
    expect(res.reconnect).toBe(true);
    expect(prisma.externalIntegration.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'ERROR' }) }));
  });

  it('checks access before testing', async () => {
    const { service, permissions } = setup([slack]);
    permissions.assertIntegrationAccess.mockRejectedValue(new Error('Forbidden'));
    await expect(service.testConnection('ws-1', 'u2', 'int-1')).rejects.toThrow('Forbidden');
  });
});
