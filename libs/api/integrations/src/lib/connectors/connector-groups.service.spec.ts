import { describe, expect, it, vi } from 'vitest';
import { ConnectorGroupsService } from './connector-groups.service.js';

const manifests: Record<string, { name: string; capabilities: Array<{ id: string }> }> = {
  SHOPIFY: { name: 'Shopify', capabilities: [{ id: 'list_orders' }, { id: 'refund_order' }] },
  SLACK: { name: 'Slack', capabilities: [{ id: 'send_message' }] },
};

function setup(role = 'MEMBER') {
  const rows: any[] = [];
  const prisma = {
    connectorGroup: {
      count: vi.fn(async () => rows.length),
      create: vi.fn(async ({ data }: any) => {
        const row = { id: `g${rows.length + 1}`, createdAt: new Date(), updatedAt: new Date(), description: null, ...data };
        rows.push(row);
        return row;
      }),
      findFirst: vi.fn(async ({ where }: any) => rows.find((r) => r.id === where.id) ?? null),
      findMany: vi.fn(async () => rows),
      update: vi.fn(async ({ where, data }: any) => Object.assign(rows.find((r) => r.id === where.id), data)),
      delete: vi.fn(async () => undefined),
    },
    externalIntegration: { findFirst: vi.fn(async ({ where }: any) => (where.id === 'int-ok' ? { id: 'int-ok' } : null)) },
    workspaceMember: { findUnique: vi.fn(async () => ({ role })) },
  };
  const registry = {
    manifest: vi.fn((p: string) => {
      if (!manifests[p]) throw new Error('unknown');
      return manifests[p];
    }),
  };
  return { service: new ConnectorGroupsService(prisma as any, registry as any), prisma, rows };
}

describe('ConnectorGroupsService', () => {
  it('stores a group of apps with the actions that are on', async () => {
    const { service } = setup();
    const group = await service.create('ws', 'u1', {
      name: ' Store ops ',
      members: [
        { provider: 'shopify', enabled: true, actions: ['list_orders'], askBefore: ['refund_order'] },
        { provider: 'SLACK', enabled: false, actions: null },
      ],
    });
    expect(group).toMatchObject({ name: 'Store ops', mine: true, isTemplate: false });
    expect(group.members[0]).toMatchObject({ provider: 'SHOPIFY', actions: ['list_orders'], askBefore: ['refund_order'] });
    expect(group.members[1]).toMatchObject({ provider: 'SLACK', enabled: false, actions: null });
  });

  it('refuses unknown apps, unknown actions, duplicates and empty groups', async () => {
    const { service } = setup();
    const base = { name: 'x' };
    await expect(service.create('ws', 'u', { ...base, members: [{ provider: 'NOPE', enabled: true, actions: null }] })).rejects.toThrow(/known app/);
    await expect(service.create('ws', 'u', { ...base, members: [{ provider: 'SLACK', enabled: true, actions: ['delete_world'] }] })).rejects.toThrow(/no action/);
    await expect(
      service.create('ws', 'u', { ...base, members: [{ provider: 'SLACK', enabled: true, actions: null }, { provider: 'slack', enabled: true, actions: null }] }),
    ).rejects.toThrow(/twice/);
    await expect(service.create('ws', 'u', { ...base, members: [] })).rejects.toThrow(/at least one app/);
    await expect(service.create('ws', 'u', { name: ' ', members: [{ provider: 'SLACK', enabled: true, actions: null }] })).rejects.toThrow(/name/);
  });

  it('only accepts a connection the caller may use', async () => {
    const { service } = setup();
    await expect(service.create('ws', 'u', { name: 'x', members: [{ provider: 'SLACK', integrationId: 'someone-elses', enabled: true, actions: null }] })).rejects.toThrow(/isn’t available/);
    const ok = await service.create('ws', 'u', { name: 'x', members: [{ provider: 'SLACK', integrationId: 'int-ok', enabled: true, actions: null }] });
    expect(ok.members[0].integrationId).toBe('int-ok');
  });

  it('lets only the creator or an admin change a group', async () => {
    const { service, rows } = setup('MEMBER');
    const group = await service.create('ws', 'creator', { name: 'x', members: [{ provider: 'SLACK', enabled: true, actions: null }] });
    expect(rows).toHaveLength(1);
    await expect(service.remove('ws', 'other', group.id)).rejects.toThrow(/creator or a workspace admin/);
    await expect(service.remove('ws', 'creator', group.id)).resolves.toEqual({ deleted: true });

    const admin = setup('ADMIN');
    const g2 = await admin.service.create('ws', 'creator', { name: 'y', members: [{ provider: 'SLACK', enabled: true, actions: null }] });
    await expect(admin.service.update('ws', 'boss', g2.id, { name: 'renamed', members: [{ provider: 'SLACK', enabled: true, actions: null }] })).resolves.toMatchObject({ name: 'renamed', mine: false });
  });

  it('duplicating a template gives the caller their own copy without its connections', async () => {
    const { service } = setup();
    const t = await service.create('ws', 'creator', { name: 'Shared', isTemplate: true, members: [{ provider: 'SLACK', integrationId: 'int-ok', enabled: true, actions: null }] });
    const copy = await service.duplicate('ws', 'someone', t.id);
    expect(copy).toMatchObject({ name: 'Shared copy', isTemplate: false, mine: true });
    expect(copy.members[0].integrationId).toBeNull();
  });
});
