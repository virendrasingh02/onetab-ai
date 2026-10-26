import { HttpException } from '@nestjs/common';
import { PolicySubjectRole, WorkspacePermission, WorkspaceRole } from '@org/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@org/api-ai', () => ({ AISecretsService: class {} }));
vi.mock('@org/database', () => ({ PrismaService: class {} }));

import { AgentInstallService, type InstallActor } from './agent-install.service';

// --- in-memory stand-in for the slice of Prisma the service uses --------------

type Row = Record<string, any>;

function matches(row: Row, where: Row, ctx: { listings: Row[] }): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'OR') return (cond as Row[]).some((c) => matches(row, c, ctx));
    if (key === 'listing') {
      const listing = ctx.listings.find((l) => l.id === row.listingId);
      return !cond.kind || listing?.kind === cond.kind;
    }
    if (key === 'configuration') return row.configuration?.marketplace?.listingSlug === cond.equals;
    const value = row[key];
    if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('in' in cond) return cond.in.includes(value);
      if ('not' in cond) return value !== cond.not;
      if ('lt' in cond) return value !== null && value < cond.lt;
      if ('startsWith' in cond) return String(value).startsWith(cond.startsWith);
    }
    return value === cond;
  });
}

function makeDb() {
  const state = { installs: [] as Row[], agents: [] as Row[], audits: [] as Row[], listings: [] as Row[], integrations: [] as Row[], members: [] as Row[] };
  let seq = 0;
  const nextId = (p: string) => `${p}${++seq}`;
  const join = (r: Row | undefined) => (r ? { ...r, listing: state.listings.find((l) => l.id === r.listingId) } : r);
  const installDefaults = {
    status: 'ACTIVE', settingsJson: '{}', grantedScopes: '[]', scope: 'WORKSPACE', accessJson: '{}', agentId: null,
    approvedPermissions: '[]', pinnedManifestJson: '{}', rollbackJson: null, lastError: null, lastErrorCode: null,
    healthJson: '{}', lockedAt: null, installedAt: new Date(), installedById: null,
  };

  const db: any = {
    marketplaceInstallation: {
      findUnique: async ({ where: { listingId_workspaceId: k } }: Row) =>
        join(state.installs.find((r) => r.listingId === k.listingId && r.workspaceId === k.workspaceId)),
      findFirst: async ({ where }: Row) => join(state.installs.find((r) => matches(r, where, state))),
      findMany: async ({ where }: Row) => state.installs.filter((r) => matches(r, where, state)).map(join),
      create: async ({ data }: Row) => {
        if (state.installs.some((r) => r.listingId === data.listingId && r.workspaceId === data.workspaceId)) {
          throw Object.assign(new Error('unique'), { code: 'P2002' });
        }
        const row = { ...installDefaults, id: nextId('inst'), ...data };
        state.installs.push(row);
        return join(row);
      },
      update: async ({ where, data }: Row) => {
        const row = state.installs.find((r) => r.id === where.id)!;
        Object.assign(row, data);
        return join(row);
      },
      updateMany: async ({ where, data }: Row) => {
        const hits = state.installs.filter((r) => matches(r, where, state));
        hits.forEach((r) => Object.assign(r, data));
        return { count: hits.length };
      },
      upsert: async ({ where: { listingId_workspaceId: k }, create, update }: Row) => {
        const row = state.installs.find((r) => r.listingId === k.listingId && r.workspaceId === k.workspaceId);
        if (row) return join(Object.assign(row, update));
        const made = { ...installDefaults, id: nextId('inst'), ...create };
        state.installs.push(made);
        return join(made);
      },
    },
    aIAgent: {
      findFirst: async ({ where }: Row) => state.agents.find((a) => matches(a, where, state)) ?? null,
      create: async ({ data }: Row) => {
        const row = { id: nextId('agent'), ...data };
        state.agents.push(row);
        return row;
      },
      update: async ({ where, data }: Row) => Object.assign(state.agents.find((a) => a.id === where.id)!, data),
      updateMany: async ({ where, data }: Row) => {
        const hits = state.agents.filter((a) => matches(a, where, state));
        hits.forEach((a) => Object.assign(a, data));
        return { count: hits.length };
      },
      deleteMany: async ({ where }: Row) => {
        const before = state.agents.length;
        state.agents = state.agents.filter((a) => !matches(a, where, state));
        return { count: before - state.agents.length };
      },
    },
    marketplaceListing: {
      update: async ({ where, data }: Row) => {
        const l = state.listings.find((x) => x.id === where.id)!;
        if (data.installCount?.increment) l.installCount += data.installCount.increment;
        if (data.installCount?.decrement) l.installCount -= data.installCount.decrement;
        return l;
      },
    },
    workspaceAuditLog: {
      create: async ({ data }: Row) => {
        state.audits.push(data);
        return data;
      },
      findMany: async () => state.audits.map((a) => ({ ...a, id: 'a', createdAt: new Date(), actor: null })),
    },
    externalIntegration: {
      findMany: async ({ where }: Row) => state.integrations.filter((i) => i.workspaceId === where.workspaceId && where.provider.in.includes(i.provider)),
      count: async ({ where }: Row) => state.integrations.filter((i) => i.workspaceId === where.workspaceId && where.provider.in.includes(i.provider)).length,
    },
    workspaceMember: {
      findFirst: async ({ where }: Row) => state.members.find((m) => m.workspaceId === where.workspaceId && m.userId === where.userId) ?? null,
    },
    $transaction: async (cb: (tx: unknown) => unknown) => cb(db),
  };
  return { db, state };
}

// --- fixtures -----------------------------------------------------------------

const WS = 'ws1';
const manifest = {
  capabilities: ['search_docs'],
  configSchema: [{ key: 'apiKey', label: 'API key', type: 'secret', required: true }],
};
const blueprint = { name: 'Helper', systemPrompt: 'Help.', provider: 'ollama', model: 'llama3', tools: ['search_docs'] };

function listing(over: Row = {}): Row {
  return {
    id: 'l1', kind: 'AGENT', slug: 'helper', name: 'Helper', tagline: '', description: '', category: 'Ops', version: '1.0.0',
    iconUrl: null, status: 'PUBLISHED', visibility: 'PUBLIC', ownerWorkspaceId: null, sourceAgentId: null, installCount: 0,
    manifestJson: JSON.stringify(manifest), payloadJson: JSON.stringify({ blueprint }), ...over,
  };
}

const admin: InstallActor = {
  id: 'admin', role: WorkspaceRole.ADMIN,
  permissions: [WorkspacePermission.VIEW, WorkspacePermission.CREATE, WorkspacePermission.MANAGE_SETTINGS],
};
const member = (policy: PolicySubjectRole = PolicySubjectRole.MEMBERS): InstallActor => ({
  id: 'm1', role: WorkspaceRole.MEMBER,
  permissions: [WorkspacePermission.VIEW, WorkspacePermission.CREATE],
  policies: { whoCanInstallApps: policy } as InstallActor['policies'],
});

async function code(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (err) {
    return (err as HttpException).getResponse && ((err as HttpException).getResponse() as Row).code;
  }
  return 'NO_ERROR';
}

describe('AgentInstallService', () => {
  let h: ReturnType<typeof makeDb>;
  let secretStore: Map<string, string>;
  let svc: AgentInstallService;
  let marketplace: Row;

  const build = (l: Row) => {
    h = makeDb();
    h.state.listings.push(l);
    secretStore = new Map();
    marketplace = {
      requireListing: async (slug: string) => {
        const found = h.state.listings.find((x) => x.slug === slug);
        if (!found) throw new Error('missing');
        return found;
      },
      canSee: (x: Row, ws: string) => x.visibility !== 'WORKSPACE' || x.ownerWorkspaceId === ws,
      toSummary: (x: Row, installed?: boolean) => ({ ...x, installed }),
      toInstallation: (row: Row) => ({ ...row, listing: undefined }),
    };
    const secrets = {
      createSecret: vi.fn(async (_w: string, _u: string, d: { key: string; value: string }) => void secretStore.set(d.key, d.value)),
      deleteSecret: vi.fn(async (_w: string, key: string) => void secretStore.delete(key)),
      getDecryptedSecret: vi.fn(async (_w: string, key: string) => secretStore.get(key) ?? null),
    };
    svc = new AgentInstallService(h.db, marketplace as never, secrets as never);
    return secrets;
  };

  beforeEach(() => void build(listing()));

  const install = (actor = admin, input: Row = {}, slug = 'helper', ws = WS) =>
    svc.install(ws, slug, actor, { settings: { apiKey: 'sk-secret' }, approvedPermissions: [], ...input });

  it('installs, provisions an agent, stores the secret encrypted-side only, audits and reports ACTIVE', async () => {
    const { installation, alreadyInstalled } = await install();
    expect(alreadyInstalled).toBe(false);
    expect(installation.status).toBe('ACTIVE');
    expect(h.state.agents).toHaveLength(1);
    expect(h.state.listings[0].installCount).toBe(1);
    expect(secretStore.get('AGENT_HELPER_APIKEY')).toBe('sk-secret');
    // The settings column keeps a reference, never the value.
    expect(JSON.stringify(h.state.installs[0])).not.toContain('sk-secret');
    expect(JSON.stringify(h.state.agents[0])).not.toContain('sk-secret');
    expect(JSON.parse(h.state.installs[0].healthJson).ok).toBe(true);
    expect(h.state.audits.map((a) => a.action)).toContain('agent.install.completed');
  });

  it('is idempotent: a second request returns the existing install without a duplicate', async () => {
    await install();
    const again = await install();
    expect(again.alreadyInstalled).toBe(true);
    expect(h.state.installs).toHaveLength(1);
    expect(h.state.agents).toHaveLength(1);
    expect(h.state.listings[0].installCount).toBe(1);
  });

  it('serialises concurrent installs: one wins, the other is told it is in progress or already done', async () => {
    const results = await Promise.allSettled([install(), install()]);
    expect(h.state.installs).toHaveLength(1);
    expect(h.state.agents).toHaveLength(1);
    const outcomes = results.map((r) => (r.status === 'fulfilled' ? (r.value.alreadyInstalled ? 'dup' : 'ok') : (r.reason as HttpException).getResponse()));
    expect(outcomes.filter((o) => o === 'ok')).toHaveLength(1);
    const other = outcomes.find((o) => o !== 'ok') as unknown;
    expect(other === 'dup' || (other as Row).code === 'INSTALL_IN_PROGRESS').toBe(true);
  });

  it('rejects an invalid manifest, missing config and incompatible platform with typed codes', async () => {
    build(listing({ manifestJson: JSON.stringify({ configSchema: [{ key: '1', label: 'x', type: 'text' }] }) }));
    expect(await code(install())).toBe('INVALID_PACKAGE');
    build(listing({ manifestJson: JSON.stringify({ ...manifest, minPlatformVersion: '9.0.0' }) }));
    expect(await code(install())).toBe('INCOMPATIBLE');
    build(listing());
    expect(await code(install(admin, { settings: {} }))).toBe('INVALID_CONFIG');
    expect(h.state.installs).toHaveLength(0);
  });

  it('fails with MISSING_DEPENDENCY when a required connector is not connected', async () => {
    build(listing({ manifestJson: JSON.stringify({ ...manifest, dependencies: { connectors: ['github'] } }) }));
    expect(await code(install(admin, { approvedPermissions: ['connector:github'] }))).toBe('MISSING_DEPENDENCY');
    h.state.integrations.push({ workspaceId: WS, provider: 'github' });
    expect((await install(admin, { approvedPermissions: ['connector:github'] })).installation.status).toBe('ACTIVE');
  });

  it('requires explicit approval of sensitive permissions', async () => {
    build(listing({ manifestJson: JSON.stringify({ ...manifest, capabilities: ['delete_task'] }) }));
    expect(await code(install())).toBe('PERMISSION_APPROVAL_REQUIRED');
    expect(h.state.installs).toHaveLength(0);
    const ok = await install(admin, { approvedPermissions: ['tool:delete_task'] });
    expect(ok.installation.status).toBe('ACTIVE');
  });

  it('hides workspace-private listings from other workspaces', async () => {
    build(listing({ visibility: 'WORKSPACE', ownerWorkspaceId: 'other', sourceAgentId: 'src' }));
    await expect(install()).rejects.toBeInstanceOf(Error);
    expect(h.state.installs).toHaveLength(0);
  });

  it('will not clone a workspace’s own Studio agent onto itself', async () => {
    build(listing({ visibility: 'WORKSPACE', ownerWorkspaceId: WS, sourceAgentId: 'src' }));
    expect(await code(install())).toBe('OWN_AGENT');
  });

  describe('failure recovery', () => {
    it('rolls back the agent and secrets and leaves a FAILED row when the health check fails', async () => {
      const secrets = build(listing());
      secrets.getDecryptedSecret.mockResolvedValue(null);
      expect(await code(install())).toBe('HEALTH_CHECK_FAILED');
      expect(h.state.agents).toHaveLength(0);
      expect(secretStore.size).toBe(0);
      expect(h.state.installs[0]).toMatchObject({ status: 'FAILED', lockedAt: null, lastErrorCode: 'HEALTH_CHECK_FAILED', agentId: null });
      expect(h.state.listings[0].installCount).toBe(0);
      expect(h.state.audits.map((a) => a.action)).toContain('agent.install.failed');
    });

    it('lets a failed install be retried (reinstall) once the cause is fixed', async () => {
      const secrets = build(listing());
      secrets.getDecryptedSecret.mockResolvedValueOnce(null);
      await code(install());
      secrets.getDecryptedSecret.mockImplementation(async (_w: string, k: string) => secretStore.get(k) ?? null);
      const retry = await install();
      expect(retry.installation.status).toBe('ACTIVE');
      expect(h.state.installs).toHaveLength(1);
      expect(h.state.agents).toHaveLength(1);
    });

    it('takes over a stale lease but not a live one', async () => {
      await install();
      const row = h.state.installs[0];
      Object.assign(row, { status: 'INSTALLING', lockedAt: new Date() });
      expect(await code(install())).toBe('INSTALL_IN_PROGRESS');
      row.lockedAt = new Date(Date.now() - 10 * 60_000);
      expect((await install()).installation.status).toBe('ACTIVE');
    });
  });

  describe('roles and policy', () => {
    it('refuses guests-by-policy and routes members to a request', async () => {
      expect(await code(install(member(PolicySubjectRole.ADMINS)))).toBe('INSTALL_NOT_PERMITTED');
    });

    it('lets a policy-allowed member install for themselves only, restricting access to them', async () => {
      const { installation } = await install(member(), { scope: 'WORKSPACE' });
      expect(installation.scope).toBe('PERSONAL');
      expect(JSON.parse(installation.accessJson)).toMatchObject({ mode: 'RESTRICTED', userIds: ['m1'] });
    });

    it('sends sensitive agents to admin approval, and an admin approval installs for the requester', async () => {
      build(listing({ manifestJson: JSON.stringify({ ...manifest, capabilities: ['delete_task'] }) }));
      expect(await code(install(member()))).toBe('APPROVAL_REQUIRED');
      const pending = await svc.requestApproval(WS, 'helper', member(), { reason: 'need it' });
      expect(pending.status).toBe('PENDING_APPROVAL');
      expect(await code(svc.resolveApproval(WS, 'helper', member(), { action: 'APPROVE' }))).toBe('FORBIDDEN');
      const done = await svc.resolveApproval(WS, 'helper', admin, {
        action: 'APPROVE', settings: { apiKey: 'k' }, approvedPermissions: ['tool:delete_task'],
      });
      expect(done.installation.status).toBe('ACTIVE');
      expect(done.installation.installedById).toBe('m1');
      expect(JSON.parse(done.installation.accessJson).userIds).toEqual(['m1']);
    });

    it('only admins can approve, view the audit trail or change access', async () => {
      await install();
      expect(await code(svc.updateAccess(WS, 'helper', member(), { scope: 'WORKSPACE' }))).toBe('FORBIDDEN');
      expect(() => svc.requireManager(member(), 'x')).toThrow(HttpException);
    });

    it('does not let a member manage someone else’s or a workspace-wide install', async () => {
      await install();
      expect(await code(svc.setEnabled(WS, 'helper', member(), false))).toBe('FORBIDDEN');
      expect(await code(svc.uninstall(WS, 'helper', member(), {}))).toBe('FORBIDDEN');
    });
  });

  describe('lifecycle', () => {
    it('disables and re-enables, switching the agent with it', async () => {
      await install();
      await svc.setEnabled(WS, 'helper', admin, false);
      expect(h.state.agents[0].isActive).toBe(false);
      expect(h.state.installs[0].status).toBe('DISABLED');
      await svc.setEnabled(WS, 'helper', admin, true);
      expect(h.state.agents[0].isActive).toBe(true);
      expect(h.state.installs[0].status).toBe('ACTIVE');
    });

    it('uninstall keeps the agent and settings; reinstall restores the same agent', async () => {
      await install();
      const agentId = h.state.agents[0].id;
      await svc.uninstall(WS, 'helper', admin, {});
      expect(h.state.agents[0].isActive).toBe(false);
      expect(h.state.installs[0].status).toBe('UNINSTALLED');
      const again = await install();
      expect(again.installation.status).toBe('ACTIVE');
      expect(h.state.agents).toHaveLength(1);
      expect(h.state.agents[0].id).toBe(agentId);
      expect(h.state.agents[0].isActive).toBe(true);
    });

    it('purge requires confirmation, then deletes the agent and its credentials', async () => {
      await install();
      expect(await code(svc.uninstall(WS, 'helper', admin, { purge: true }))).toBe('CONFIRMATION_REQUIRED');
      expect(h.state.agents).toHaveLength(1);
      await svc.uninstall(WS, 'helper', admin, { purge: true, confirm: true });
      expect(h.state.agents).toHaveLength(0);
      expect(secretStore.size).toBe(0);
      expect(h.state.audits.map((a) => a.action)).toContain('agent.purged');
    });
  });

  describe('updates', () => {
    const publishV2 = (extra: Row = {}) => {
      Object.assign(h.state.listings[0], {
        version: '2.0.0',
        payloadJson: JSON.stringify({ blueprint: { ...blueprint, systemPrompt: 'Help v2.', ...(extra.blueprint ?? {}) } }),
        ...(extra.manifest ? { manifestJson: JSON.stringify(extra.manifest) } : {}),
      });
    };

    it('does not change an installed version until the update is applied', async () => {
      await install();
      publishV2();
      expect(h.state.agents[0].systemPrompt).toBe('Help.');
      expect(h.state.installs[0].version).toBe('1.0.0');
      const view = await svc.preview(WS, 'helper', admin);
      expect(view.installation).toBeTruthy();
    });

    it('applies an update without new permissions and records a rollback snapshot', async () => {
      await install();
      publishV2();
      const { installation } = await svc.update(WS, 'helper', admin, {});
      expect(installation.version).toBe('2.0.0');
      expect(h.state.agents[0].systemPrompt).toBe('Help v2.');
      expect(JSON.parse(h.state.installs[0].rollbackJson).systemPrompt).toBe('Help.');
    });

    it('refuses an update that widens permissions until they are approved', async () => {
      await install();
      publishV2({ manifest: { ...manifest, capabilities: ['search_docs', 'delete_task'] } });
      expect(await code(svc.update(WS, 'helper', admin, {}))).toBe('PERMISSION_APPROVAL_REQUIRED');
      expect(h.state.installs[0].version).toBe('1.0.0');
      expect(h.state.agents[0].systemPrompt).toBe('Help.');
      const ok = await svc.update(WS, 'helper', admin, { approvedPermissions: ['tool:delete_task'] });
      expect(ok.installation.version).toBe('2.0.0');
      expect(JSON.parse(h.state.installs[0].approvedPermissions)).toContain('tool:delete_task');
    });

    it('rolls the agent back and keeps the old version when the post-update health check fails', async () => {
      const secrets = build(listing());
      await install();
      publishV2();
      secrets.getDecryptedSecret.mockResolvedValue(null);
      expect(await code(svc.update(WS, 'helper', admin, {}))).toBe('HEALTH_CHECK_FAILED');
      expect(h.state.agents[0].systemPrompt).toBe('Help.');
      expect(h.state.installs[0]).toMatchObject({ version: '1.0.0', status: 'ACTIVE', lockedAt: null });
      expect(h.state.audits.map((a) => a.action)).toContain('agent.update.failed');
    });

    it('reports NO_UPDATE when already current', async () => {
      await install();
      expect(await code(svc.update(WS, 'helper', admin, {}))).toBe('NO_UPDATE');
    });
  });

  describe('runtime access', () => {
    it('blocks users outside a restricted install and any run while disabled', async () => {
      await install(member(), {});
      const agentId = h.state.agents[0].id;
      h.state.members.push({ workspaceId: WS, userId: 'm1', role: 'MEMBER' }, { workspaceId: WS, userId: 'm2', role: 'MEMBER' }, { workspaceId: WS, userId: 'admin', role: 'ADMIN' });
      await expect(svc.assertCanRun(WS, agentId, 'm1')).resolves.toBeUndefined();
      expect(await code(svc.assertCanRun(WS, agentId, 'm2'))).toBe('AGENT_ACCESS_DENIED');
      await expect(svc.assertCanRun(WS, agentId, 'admin')).resolves.toBeUndefined();
      await svc.setEnabled(WS, 'helper', admin, false);
      expect(await code(svc.assertCanRun(WS, agentId, 'm1'))).toBe('AGENT_UNAVAILABLE');
    });

    it('ignores agents that were not installed from the marketplace and does not cross workspaces', async () => {
      await install();
      await expect(svc.assertCanRun(WS, 'not-an-install', 'm2')).resolves.toBeUndefined();
      await expect(svc.assertCanRun('ws2', h.state.agents[0].id, 'm2')).resolves.toBeUndefined();
      expect(await svc.list('ws2', admin)).toHaveLength(0);
    });

    it('hides restricted installs from the agent list for members without access', async () => {
      await install(member(), {});
      expect([...(await svc.hiddenAgentIds(WS, 'm2', WorkspaceRole.MEMBER))]).toEqual([h.state.agents[0].id]);
      expect((await svc.hiddenAgentIds(WS, 'm1', WorkspaceRole.MEMBER)).size).toBe(0);
      expect((await svc.hiddenAgentIds(WS, 'x', WorkspaceRole.ADMIN)).size).toBe(0);
    });
  });
});
