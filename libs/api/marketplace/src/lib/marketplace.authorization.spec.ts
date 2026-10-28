import 'reflect-metadata';
import {
  SYSTEM_ROLES_KEY,
  WORKSPACE_PERMISSIONS_KEY,
} from '@org/api-common';
import { SystemRole, WorkspacePermission } from '@org/types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@org/api-ai', () => ({ AISecretsService: class {} }));
import { AgentInstallController } from './agent-install.controller';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';

const proto = MarketplaceController.prototype as unknown as Record<string, () => void>;
const meta = (key: string, name: string) => Reflect.getMetadata(key, proto[name]);

describe('marketplace authorization (privilege escalation regressions)', () => {
  it.each(['install', 'updateInstallation', 'uninstall', 'resolveApproval'])(
    '%s needs MANAGE_SETTINGS, so guests and plain members cannot call it',
    (name) => {
      expect(meta(WORKSPACE_PERMISSIONS_KEY, name)).toContain(
        WorkspacePermission.MANAGE_SETTINGS,
      );
    },
  );

  it('publishing into the global catalogue is operator-only', () => {
    expect(meta(SYSTEM_ROLES_KEY, 'publishCustom')).toEqual([SystemRole.SUPERADMIN]);
  });
});

describe('agent install authorization', () => {
  const agentProto = AgentInstallController.prototype as unknown as Record<string, () => void>;
  const agentMeta = (name: string) => Reflect.getMetadata(WORKSPACE_PERMISSIONS_KEY, agentProto[name]);

  it.each(['resolve', 'updateAccess'])('%s is admin-only (MANAGE_SETTINGS)', (name) => {
    expect(agentMeta(name)).toContain(WorkspacePermission.MANAGE_SETTINGS);
  });

  it.each(['install', 'request', 'update', 'setEnabled', 'health', 'uninstall'])(
    '%s needs at least CREATE, so guests/viewers cannot call it',
    (name) => {
      expect(agentMeta(name)).toContain(WorkspacePermission.CREATE);
    },
  );

  it('sits behind WorkspaceRoleGuard so non-members are rejected before any handler', () => {
    const guards = Reflect.getMetadata('__guards__', AgentInstallController) as unknown[];
    expect(guards.map((g) => (g as { name: string }).name)).toContain('WorkspaceRoleGuard');
  });

  it('the generic install path refuses AGENT listings so it cannot bypass approval', async () => {
    const service = new MarketplaceService({
      marketplaceListing: {
        findUnique: async () => ({ id: 'l', kind: 'AGENT', slug: 'a', status: 'PUBLISHED', visibility: 'PUBLIC' }),
      },
    } as never);
    await expect(service.install({ workspaceId: 'w', listingSlug: 'a' })).rejects.toMatchObject({
      response: { code: 'USE_AGENT_INSTALL_FLOW' },
    });
    await expect(service.uninstall('w', 'a')).rejects.toMatchObject({ response: { code: 'USE_AGENT_INSTALL_FLOW' } });
  });
});

describe('installation view', () => {
  const service = new MarketplaceService({} as never);
  const row = (healthJson: string) =>
    service.toInstallation({
      id: 'i', listingId: 'l', workspaceId: 'w', version: '1.0.0', status: 'ACTIVE', settingsJson: '{}',
      grantedScopes: '[]', installedAt: new Date(), healthJson,
      listing: {
        id: 'l', kind: 'AGENT', slug: 'a', name: 'A', tagline: '', category: 'x', version: '1.0.0', iconUrl: null,
        previewUrl: null, tags: '[]', pricingModel: 'FREE', priceCents: 0, status: 'PUBLISHED', isOfficial: false,
        isFeatured: false, installCount: 0, ratingSum: 0, ratingCount: 0, manifestJson: '{}',
      },
    } as never);

  it('reports a never-checked install (default "{}") as no health result, not an empty one', () => {
    expect(row('{}').health).toBeNull();
    expect(row('not json').health).toBeNull();
  });

  it('passes a real health result through', () => {
    const health = { ok: true, checkedAt: 'now', checks: [{ name: 'Agent exists', ok: true }] };
    expect(row(JSON.stringify(health)).health).toEqual(health);
  });
});

describe('listing owner', () => {
  const listingRow = (id: string, extra: Record<string, unknown> = {}) => ({
    id, kind: 'AGENT', slug: id, name: id, tagline: '', category: 'x', version: '1.0.0', iconUrl: null,
    previewUrl: null, tags: '[]', pricingModel: 'FREE', priceCents: 0, status: 'PUBLISHED', isOfficial: false,
    isFeatured: false, installCount: 0, ratingSum: 0, ratingCount: 0, manifestJson: '{}', publisher: null,
    visibility: 'PUBLIC', ownerWorkspaceId: null, sourceAgentId: null, ...extra,
  });

  it('names the Studio builder over the installer, the installer otherwise, and nobody for unowned rows', async () => {
    const rows = [
      listingRow('built', { visibility: 'WORKSPACE', ownerWorkspaceId: 'w', sourceAgentId: 'agent-1' }),
      listingRow('installed'),
      listingRow('plain'),
    ];
    const userFindMany = vi.fn(async () => [
      { id: 'u-builder', name: 'builder', displayName: 'Bea Builder', avatarUrl: null },
      { id: 'u-installer', name: 'ian', displayName: null, avatarUrl: 'data:image/png;base64,x' },
    ]);
    const service = new MarketplaceService({
      marketplaceListing: { findMany: async () => rows, count: async () => rows.length },
      marketplaceInstallation: {
        findMany: async (args: { select: Record<string, boolean> }) =>
          args.select['installedById']
            ? [
                { listingId: 'built', installedById: 'u-installer' },
                { listingId: 'installed', installedById: 'u-installer' },
              ]
            : [{ listingId: 'installed' }],
      },
      aIAgent: { findMany: async () => [{ id: 'agent-1', creatorId: 'u-builder' }] },
      user: { findMany: userFindMany },
    } as never);

    const page = await service.browse({}, 'w');
    const owners = Object.fromEntries(page.items.map((i) => [i.slug, i.owner]));

    expect(owners['built']).toEqual({ id: 'u-builder', name: 'Bea Builder', avatarUrl: null, relation: 'BUILT' });
    expect(owners['installed']).toMatchObject({ id: 'u-installer', name: 'ian', relation: 'INSTALLED' });
    expect(owners['plain']).toBeNull();
    expect(userFindMany).toHaveBeenCalledTimes(1);
  });

  it('leaves owner off anonymous browse calls', async () => {
    const service = new MarketplaceService({
      marketplaceListing: { findMany: async () => [listingRow('a')], count: async () => 1 },
    } as never);
    const page = await service.browse({});
    expect(page.items[0]).not.toHaveProperty('owner');
  });
});
