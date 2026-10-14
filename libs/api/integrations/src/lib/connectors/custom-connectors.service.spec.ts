import { ConfigService } from '@nestjs/config';
import { isCustomConnectorProvider, type CustomConnectorInput } from '@org/types';
import { describe, expect, it, vi } from 'vitest';
import { IntegrationEncryptionService } from '../core/integration-encryption.service.js';
import { IntegrationManagerService } from '../core/integration-manager.service.js';
import { SSRFGuardService } from '../core/ssrf-guard.service.js';
import { CustomApiProvider } from '../providers/custom-api.provider.js';
import { CustomConnectorProvider } from '../providers/custom-connector.provider.js';
import { ConnectorRegistryService } from './connector-registry.service.js';
import { CustomConnectorsService } from './custom-connectors.service.js';

type Row = Record<string, any>;

/** A tiny in-memory `externalIntegration` table behind the real services. */
function setup() {
  const rows = new Map<string, Row>();
  const prisma = {
    externalIntegration: {
      create: vi.fn(async ({ data }: { data: Row }) => {
        const row = { createdAt: new Date(), updatedAt: new Date(), lastSyncAt: null, lastErrorAt: null, lastErrorMessage: null, scopes: '[]', ...data };
        rows.set(row['id'], row);
        return row;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = { ...rows.get(where.id), ...data };
        rows.set(where.id, row);
        return row;
      }),
      delete: vi.fn(async ({ where }: { where: { id: string } }) => {
        rows.delete(where.id);
      }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => rows.get(where.id) ?? null),
      findMany: vi.fn(async () => [...rows.values()]),
    },
    integrationAuditLog: { findMany: vi.fn().mockResolvedValue([]) },
    user: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const encryption = new IntegrationEncryptionService(new ConfigService({ ENCRYPTION_KEY: 'test-key' }));
  const http = new CustomApiProvider(new SSRFGuardService(), encryption);
  const provider = new CustomConnectorProvider(http, encryption);
  const manager = new IntegrationManagerService(
    prisma as never,
    encryption,
    { registerAdapter: vi.fn() } as never,
    ...(Array(11).fill(undefined) as [never, never, never, never, never, never, never, never, never, never, never]),
    undefined as never,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    provider,
  );
  const permissions = { assertIntegrationAccess: vi.fn().mockResolvedValue({}) };
  const audit = { logAudit: vi.fn().mockResolvedValue(undefined) };
  const registry = new ConnectorRegistryService(prisma as never, manager, permissions as never, audit as never);
  const service = new CustomConnectorsService(prisma as never, encryption, permissions as never, audit as never, registry, provider);
  const reach = (status = 200) =>
    vi.spyOn(http, 'executeCustomRequest').mockResolvedValue({ status, statusText: 'OK', headers: {}, data: { orders: [{ id: 1 }] }, durationMs: 2 });
  return { rows, prisma, encryption, http, provider, manager, registry, service, permissions, reach };
}

const input: CustomConnectorInput = {
  name: 'Acme Orders',
  description: 'Orders in Acme',
  category: 'commerce',
  baseUrl: 'https://api.acme.test/v1/',
  authType: 'BEARER',
  bearerToken: 'super-secret-token',
  customHeaders: { 'X-Version': '2' },
  actions: [
    { id: '', label: 'List orders', description: 'List orders.', method: 'GET', path: '/orders', params: [] },
    {
      id: 'cancel_order',
      label: 'Cancel order',
      description: 'Cancel one.',
      method: 'DELETE',
      path: '/orders/{{id}}',
      params: [{ name: 'id', type: 'string', required: true }],
    },
  ],
  triggers: [{ id: 'new_order', label: 'New order', actionId: 'list_orders', itemsPath: 'orders', idField: 'id' }],
};

describe('CustomConnectorsService', () => {
  it('creates a connector that shows up as its own connected card with tools and an event', async () => {
    const { service, registry, reach, rows } = setup();
    reach();
    const { provider, integrationId } = await service.create('w1', 'u1', input, true);

    expect(isCustomConnectorProvider(provider)).toBe(true);
    const card = (await registry.list('w1', 'u1')).find((c) => c.provider === provider);
    expect(card).toMatchObject({
      name: 'Acme Orders',
      custom: true,
      category: 'commerce',
      status: 'connected',
      counts: { actions: 1, queries: 1, triggers: 1 },
    });
    expect(card?.capabilities.map((c) => [c.id, c.toolName, c.requiresConfirmation])).toEqual([
      ['list_orders', `${provider.toLowerCase()}_list_orders`, false],
      ['cancel_order', `${provider.toLowerCase()}_cancel_order`, true],
    ]);
    expect(registry.trigger(provider, 'new_order')).toMatchObject({ pollActionId: 'list_orders', itemsPath: 'orders' });
    expect(rows.get(integrationId)?.['status']).toBe('CONNECTED');
  });

  it('keeps secrets encrypted and out of the stored definition', async () => {
    const { service, rows, reach } = setup();
    reach();
    const { integrationId } = await service.create('w1', 'u1', input, true);
    expect(JSON.stringify(rows.get(integrationId))).not.toContain('super-secret-token');
    expect(JSON.parse(rows.get(integrationId)?.['metadata']).customConnector.customHeaderNames).toEqual(['X-Version']);
  });

  it('runs the connector’s action through the manager like any other app', async () => {
    const { service, manager, reach, http } = setup();
    reach();
    const { integrationId } = await service.create('w1', 'u1', input, true);
    const { adapter, credential } = await manager.resolveCredential(integrationId);
    expect(adapter.getActionsFor?.(credential).map((a) => a.id)).toEqual(['list_orders', 'cancel_order']);

    const spy = vi.spyOn(http, 'executeCustomRequest').mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, data: { ok: 1 }, durationMs: 1 });
    const result = await adapter.executeAction?.(credential, 'cancel_order', { id: '42' });
    expect(result).toMatchObject({ success: true });
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ bearerToken: 'super-secret-token', customHeaders: { 'X-Version': '2' } }),
      { method: 'DELETE', path: '/orders/42', query: {} },
    );
  });

  it('keeps the saved secret and header values when an edit leaves them blank', async () => {
    const { service, manager, reach, http } = setup();
    reach();
    const { integrationId, provider } = await service.create('w1', 'u1', input, true);
    const edited = await service.update('w1', 'u1', integrationId, { ...input, bearerToken: '', customHeaders: { 'X-Version': '••••' }, name: 'Acme Orders v2' }, true);
    expect(edited.provider).toBe(provider);

    const { adapter, credential } = await manager.resolveCredential(integrationId);
    const spy = vi.spyOn(http, 'executeCustomRequest').mockResolvedValue({ status: 200, statusText: 'OK', headers: {}, data: [], durationMs: 1 });
    await adapter.executeAction?.(credential, 'list_orders', {});
    expect(spy.mock.calls[0][0]).toMatchObject({ bearerToken: 'super-secret-token', customHeaders: { 'X-Version': '2' } });
  });

  it('rejects an unreachable API and refused credentials, saving nothing', async () => {
    const { service, rows, http, reach } = setup();
    vi.spyOn(http, 'executeCustomRequest').mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));
    await expect(service.create('w1', 'u1', input, true)).rejects.toThrow('Couldn’t reach');
    reach(401);
    await expect(service.create('w1', 'u1', input, true)).rejects.toThrow('refused these credentials');
    expect(rows.size).toBe(0);
  });

  it('explains an invalid definition and enforces the install policy for workspace-wide connectors', async () => {
    const { service, reach } = setup();
    reach();
    await expect(service.create('w1', 'u1', { ...input, actions: [] }, true)).rejects.toThrow('at least one action');
    await expect(service.create('w1', 'u1', input, false)).rejects.toThrow('permission to install apps');
    await expect(service.create('w1', 'u1', { ...input, scopeType: 'USER' }, false)).resolves.toBeDefined();
  });

  it('tests an unsaved action against the real API, and makes a write confirm first', async () => {
    const { service, reach } = setup();
    reach();
    await expect(service.preview('w1', 'u1', { connector: input, actionId: 'list_orders' }, true)).resolves.toMatchObject({ success: true, data: { orders: [{ id: 1 }] } });
    await expect(service.preview('w1', 'u1', { connector: input, actionId: 'cancel_order', values: { id: '1' } }, true)).rejects.toThrow('Confirm to run it');
    await expect(service.preview('w1', 'u1', { connector: input, actionId: 'cancel_order', values: { id: '1' }, confirm: true }, true)).resolves.toMatchObject({ success: true });
  });

  it('deletes the connector for good and drops it from the registry', async () => {
    const { service, registry, rows, reach } = setup();
    reach();
    const { integrationId, provider } = await service.create('w1', 'u1', input, true);
    await service.remove('w1', 'u1', integrationId, true);
    expect(rows.size).toBe(0);
    expect((await registry.list('w1', 'u1')).some((c) => c.provider === provider)).toBe(false);
    await expect(registry.detail('w1', 'u1', provider)).rejects.toThrow();
  });

  it('refuses to edit a built-in connection through the custom API', async () => {
    const { service, rows } = setup();
    rows.set('x', { id: 'x', provider: 'SLACK', scopeType: 'WORKSPACE', metadata: '{}' });
    await expect(service.remove('w1', 'u1', 'x', true)).rejects.toThrow('isn’t a custom connector');
  });
});
