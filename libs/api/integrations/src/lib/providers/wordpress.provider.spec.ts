import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeSiteUrl, WordPressProvider } from './wordpress.provider.js';
import type { ResolvedCredential } from '../core/provider-adapter.interface.js';
import type { SSRFGuardService } from '../core/ssrf-guard.service.js';

vi.mock('axios', () => ({ default: { request: vi.fn() } }));
const request = axios.request as unknown as ReturnType<typeof vi.fn>;
const reply = (status: number, data: unknown = {}) => ({ status, data, headers: {} });

const credential: ResolvedCredential = {
  id: 'int-3',
  provider: 'WORDPRESS',
  scopeType: 'WORKSPACE',
  accessToken: JSON.stringify({ siteUrl: 'https://Blog.example.com/', username: 'editor', applicationPassword: 'abcd efgh ijkl' }),
  metadata: {},
  scopes: [],
};

describe('WordPressProvider', () => {
  let provider: WordPressProvider;
  let validateUrl: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    validateUrl = vi.fn(async (u: string) => new URL(u));
    provider = new WordPressProvider({ validateUrl, agents: {} } as unknown as SSRFGuardService);
  });
  afterEach(() => request.mockReset());

  it('requires https and keeps only the origin and path', () => {
    expect(normalizeSiteUrl('Blog.Example.com')).toBe('https://blog.example.com');
    expect(normalizeSiteUrl('https://example.com/blog/')).toBe('https://example.com/blog');
    expect(() => normalizeSiteUrl('http://example.com')).toThrow(/HTTPS/);
  });

  it('checks the site against the SSRF guard before every request', async () => {
    validateUrl.mockRejectedValueOnce(new Error('private address'));
    await expect(provider.executeAction(credential, 'list_posts', {})).rejects.toThrow(/private/);
    expect(request).not.toHaveBeenCalled();
  });

  it('creates posts only as drafts, even if asked for more', async () => {
    request.mockResolvedValueOnce(reply(201, { id: 7, status: 'draft', title: { rendered: 'Hello' }, link: 'https://blog.example.com/?p=7' }));
    const result = await provider.executeAction(credential, 'create_draft_post', { title: 'Hello', content: '<p>Hi</p>', status: 'publish' });
    expect(result.success).toBe(true);
    const call = request.mock.calls[0][0];
    expect(call.url).toBe('https://blog.example.com/wp-json/wp/v2/posts');
    expect(call.data.status).toBe('draft');
    expect(call.auth).toEqual({ username: 'editor', password: 'abcd efgh ijkl' });
  });

  it('publishing is its own confirmed action, and deleting only moves to the trash', async () => {
    const actions = provider.getActions();
    expect(actions.find((a) => a.id === 'publish_post')).toMatchObject({ permissionLevel: 'write', requiresConfirmation: true });
    expect(actions.find((a) => a.id === 'trash_post')).toMatchObject({ permissionLevel: 'destructive', requiresConfirmation: true });
    request.mockResolvedValueOnce(reply(200, {}));
    await provider.executeAction(credential, 'trash_post', { postId: '7' });
    const call = request.mock.calls[0][0];
    expect(call.method).toBe('DELETE');
    expect(call.params ?? {}).not.toHaveProperty('force');
  });

  it('declares triggers that watch its own read actions and reports a clear permission error', async () => {
    const reads = new Set(provider.getActions().filter((a) => a.permissionLevel === 'read').map((a) => a.id));
    for (const t of provider.getTriggers()) expect(reads.has(t.pollActionId as string)).toBe(true);

    request.mockResolvedValueOnce(reply(401, { code: 'rest_cannot_create', message: 'Sorry, you are not allowed to create posts.' }));
    const result = await provider.executeAction(credential, 'create_draft_post', { title: 'x', content: 'y' });
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/Reconnect WordPress/);
  });

  it('strips markup from titles and comments', async () => {
    request.mockResolvedValueOnce(reply(200, [{ id: 3, status: 'approved', author_name: 'Sam', content: { rendered: '<p>Great &amp; useful</p>' }, date_gmt: '2026-10-14T10:00:00' }]));
    const result = await provider.executeAction(credential, 'list_comments', {});
    expect((result.data as any).comments[0]).toMatchObject({ content: 'Great & useful', author: 'Sam', date: '2026-10-14T10:00:00Z' });
  });
});
