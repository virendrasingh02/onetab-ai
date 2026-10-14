import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VercelProvider } from './vercel.provider.js';
import type { ResolvedCredential } from '../core/provider-adapter.interface.js';
import type { SSRFGuardService } from '../core/ssrf-guard.service.js';

vi.mock('axios', () => ({ default: { request: vi.fn() } }));
const request = axios.request as unknown as ReturnType<typeof vi.fn>;
const reply = (status: number, data: unknown = {}) => ({ status, data, headers: {} });

const credential = (extra: Record<string, string> = {}): ResolvedCredential => ({
  id: 'int-v',
  provider: 'VERCEL',
  scopeType: 'WORKSPACE',
  accessToken: JSON.stringify({ token: 'tok_secret', ...extra }),
  metadata: {},
  scopes: [],
});

describe('VercelProvider', () => {
  let provider: VercelProvider;
  beforeEach(() => {
    provider = new VercelProvider({ agents: {} } as unknown as SSRFGuardService);
  });
  afterEach(() => request.mockReset());

  it('sends the bearer token and scopes calls to the team when one is set', async () => {
    request.mockResolvedValueOnce(reply(200, { deployments: [] }));
    await provider.executeAction(credential({ teamId: 'team_abc' }), 'list_deployments', { projectId: 'web' });
    const call = request.mock.calls[0][0];
    expect(call.url).toBe('https://api.vercel.com/v6/deployments');
    expect(call.headers.Authorization).toBe('Bearer tok_secret');
    expect(call.params).toMatchObject({ teamId: 'team_abc', projectId: 'web', limit: 20 });
  });

  it('omits teamId for a personal account', async () => {
    request.mockResolvedValueOnce(reply(200, { projects: [] }));
    await provider.executeAction(credential(), 'list_projects', {});
    expect(request.mock.calls[0][0].params).not.toHaveProperty('teamId');
  });

  it('never returns environment variable values', async () => {
    request.mockResolvedValueOnce(
      reply(200, { envs: [{ key: 'DATABASE_URL', value: 'postgres://secret', target: ['production'], type: 'encrypted' }] }),
    );
    const result = await provider.executeAction(credential(), 'list_env_vars', { projectId: 'web' });
    expect(JSON.stringify(result.data)).not.toContain('postgres://secret');
    expect((result.data as any).variables[0].key).toBe('DATABASE_URL');
  });

  it('redeploys from an existing deployment, keeping its name and target', async () => {
    request
      .mockResolvedValueOnce(reply(200, { id: 'dpl_1', name: 'web', target: 'production', readyState: 'READY' }))
      .mockResolvedValueOnce(reply(200, { id: 'dpl_2', name: 'web', readyState: 'QUEUED', url: 'web-2.vercel.app' }));
    const result = await provider.executeAction(credential(), 'redeploy', { deploymentId: 'dpl_1' });
    expect(result.success).toBe(true);
    const post = request.mock.calls[1][0];
    expect(post.method).toBe('POST');
    expect(post.data).toEqual({ name: 'web', deploymentId: 'dpl_1', target: 'production' });
    expect(post.params.forceNew).toBe(1);
  });

  it('reports a rejected token as a failed connection test, without echoing it', async () => {
    request.mockResolvedValueOnce(reply(403, { error: { message: 'Not authorized' } }));
    const result = await provider.testConnection({ token: 'tok_secret' });
    expect(result.success).toBe(false);
    expect(result.message).not.toContain('tok_secret');
  });

  it('rejects a malformed team id before calling Vercel', async () => {
    const result = await provider.testConnection({ token: 'tok_secret', teamId: 'my-team' });
    expect(result.success).toBe(false);
    expect(request).not.toHaveBeenCalled();
  });

  it('asks approval for writes only', () => {
    const writes = provider.getActions().filter((a) => a.permissionLevel === 'write');
    expect(writes.map((a) => a.id).sort()).toEqual(['cancel_deployment', 'redeploy']);
    expect(writes.every((a) => a.requiresConfirmation)).toBe(true);
  });
});
