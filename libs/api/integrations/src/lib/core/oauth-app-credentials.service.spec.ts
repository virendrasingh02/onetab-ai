import { describe, expect, it, vi } from 'vitest';
import { oauthEnv, runWithOAuthOverrides } from './oauth-app-context.js';
import { OAuthAppCredentialsService } from './oauth-app-credentials.service.js';
import type { ProviderAdapter } from './provider-adapter.interface.js';

const encryption = { encrypt: (v: string) => `enc(${v})`, decrypt: (v: string) => v.slice(4, -1) };

function build(rows: Array<Record<string, unknown>> = [], env: Record<string, string> = {}) {
  const prisma = {
    workspaceOAuthApp: {
      findMany: vi.fn(async () => rows),
      findUnique: vi.fn(async () => rows[0] ?? null),
      upsert: vi.fn(async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => ({
        ...create,
        ...update,
        updatedAt: new Date(),
      })),
      deleteMany: vi.fn(async () => ({ count: 1 })),
    },
  };
  const config = { get: (k: string) => env[k] };
  const audit = { logAudit: vi.fn(async () => undefined) };
  const service = new OAuthAppCredentialsService(prisma as never, encryption as never, config as never, audit as never);
  return { service, prisma, audit, config };
}

describe('oauthEnv', () => {
  const config = { get: (k: string) => (k === 'GITHUB_CLIENT_ID' ? 'server-id' : undefined) };

  it('falls back to the server config outside an override scope', () => {
    expect(oauthEnv(config, 'GITHUB_CLIENT_ID')).toBe('server-id');
  });

  it('prefers the workspace override inside the scope, including across awaits', async () => {
    const overrides = new Map([['GITHUB_CLIENT_ID', 'ws-id']]);
    const seen = await runWithOAuthOverrides(overrides, async () => {
      await Promise.resolve();
      return oauthEnv(config, 'GITHUB_CLIENT_ID');
    });
    expect(seen).toBe('ws-id');
    expect(oauthEnv(config, 'GITHUB_CLIENT_ID')).toBe('server-id');
  });
});

describe('OAuthAppCredentialsService', () => {
  it('loads only enabled apps under the env names adapters read, decrypting the secret', async () => {
    const { service } = build([{ appKey: 'GITHUB', clientId: 'gh-id', encryptedClientSecret: 'enc(gh-secret)', enabled: true }]);
    const overrides = await service.load('ws1');
    expect(overrides.get('GITHUB_CLIENT_ID')).toBe('gh-id');
    expect(overrides.get('GITHUB_CLIENT_SECRET')).toBe('gh-secret');
  });

  it('binds an adapter so every call — even a later one — sees the workspace app', async () => {
    const { service, config } = build();
    const adapter = {
      isServerConfigured: () => Boolean(oauthEnv(config, 'GITHUB_CLIENT_ID')),
      refreshToken: async () => ({ accessToken: String(oauthEnv(config, 'GITHUB_CLIENT_ID')) }),
    } as unknown as ProviderAdapter;
    const bound = service.bind(adapter, new Map([['GITHUB_CLIENT_ID', 'ws-id']]));
    expect(adapter.isServerConfigured?.()).toBe(false);
    expect(bound.isServerConfigured?.()).toBe(true);
    await expect(bound.refreshToken?.('r')).resolves.toEqual({ accessToken: 'ws-id' });
  });

  it('reports the source and never returns the secret', async () => {
    const { service } = build(
      [{ appKey: 'GOOGLE', clientId: 'g-id', encryptedClientSecret: 'enc(x)', enabled: true, updatedAt: new Date() }],
      { GITHUB_CLIENT_ID: 'a', GITHUB_CLIENT_SECRET: 'b' },
    );
    const apps = await service.list('ws1');
    const google = apps.find((a) => a.appKey === 'GOOGLE');
    const github = apps.find((a) => a.appKey === 'GITHUB');
    expect(google).toMatchObject({ source: 'workspace', configured: true, clientId: 'g-id', secretSet: true });
    expect(google?.callbackUrls).toHaveLength(5);
    expect(github).toMatchObject({ source: 'server', configured: true, secretSet: false });
    expect(apps.find((a) => a.appKey === 'SLACK')).toMatchObject({ source: 'none', configured: false });
    expect(JSON.stringify(apps)).not.toContain('enc(');
  });

  it('requires a secret on first save, encrypts it, and keeps it when omitted on edit', async () => {
    const created = build();
    created.prisma.workspaceOAuthApp.findUnique.mockResolvedValueOnce(null);
    await expect(created.service.upsert('ws1', 'u1', 'github', { clientId: 'gh-id' })).rejects.toThrow(/secret/i);

    created.prisma.workspaceOAuthApp.findUnique.mockResolvedValueOnce(null);
    await created.service.upsert('ws1', 'u1', 'github', { clientId: ' gh-id ', clientSecret: 's3cret' });
    expect(created.prisma.workspaceOAuthApp.upsert.mock.calls[0]?.[0].create).toMatchObject({
      clientId: 'gh-id',
      encryptedClientSecret: 'enc(s3cret)',
    });
    expect(JSON.stringify(created.audit.logAudit.mock.calls)).not.toContain('s3cret');

    const edited = build([{ appKey: 'GITHUB', clientId: 'old', encryptedClientSecret: 'enc(old)', enabled: true }]);
    await edited.service.upsert('ws1', 'u1', 'github', { clientId: 'new-id', enabled: false });
    expect(edited.prisma.workspaceOAuthApp.upsert.mock.calls[0]?.[0].update).toEqual({ clientId: 'new-id', enabled: false });
  });

  it('rejects malformed client ids and unknown apps', async () => {
    const { service } = build();
    await expect(service.upsert('ws1', 'u1', 'github', { clientId: 'has space', clientSecret: 'x' })).rejects.toThrow(/client ID/);
    await expect(service.upsert('ws1', 'u1', 'nope', { clientId: 'abc', clientSecret: 'x' })).rejects.toThrow(/no OAuth app/);
  });
});
