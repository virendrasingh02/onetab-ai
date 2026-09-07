import { describe, expect, it } from 'vitest';
import { resolveDeepLinkRoute } from './deep-link-route.js';

const ctx = { workspaceSlug: 'acme' };

describe('resolveDeepLinkRoute', () => {
  it('returns a miss for empty input', () => {
    expect(resolveDeepLinkRoute('', ctx).route).toBeNull();
    expect(resolveDeepLinkRoute(null, ctx).route).toBeNull();
  });

  it('prefixes a workspace-relative notification deepLink with the current workspace', () => {
    expect(resolveDeepLinkRoute('c/general', ctx).route).toBe('/w/acme/c/general');
    expect(resolveDeepLinkRoute('inbox', ctx).route).toBe('/w/acme/inbox');
    expect(resolveDeepLinkRoute('directory', ctx).route).toBe('/w/acme/directory');
  });

  it('preserves the query string on relative targets', () => {
    expect(resolveDeepLinkRoute('tasks?taskId=t_1', ctx).route).toBe(
      '/w/acme/tasks?taskId=t_1',
    );
    expect(resolveDeepLinkRoute('meetings?meetingId=m1', ctx).route).toBe(
      '/w/acme/meetings?meetingId=m1',
    );
  });

  it('passes an already-absolute /w/ route straight through', () => {
    expect(resolveDeepLinkRoute('/w/acme/inbox', ctx).route).toBe('/w/acme/inbox');
    expect(resolveDeepLinkRoute('/login', ctx).route).toBe('/login');
    expect(resolveDeepLinkRoute('/invite/tok', ctx).route).toBe('/invite/tok');
  });

  it('treats a bare absolute path with no /w/ as workspace-relative', () => {
    expect(resolveDeepLinkRoute('/c/general', ctx).route).toBe('/w/acme/c/general');
  });

  it('strips a custom scheme and resolves the target', () => {
    expect(resolveDeepLinkRoute('onetab://c/general', ctx).route).toBe(
      '/w/acme/c/general',
    );
    expect(resolveDeepLinkRoute('mie://inbox', ctx).route).toBe('/w/acme/inbox');
    expect(resolveDeepLinkRoute('mie://w/acme/tasks', ctx).route).toBe(
      '/w/acme/tasks',
    );
  });

  it('flags the auth callback so the caller skips navigation', () => {
    const r = resolveDeepLinkRoute('onetab://auth/callback?code=x&state=y', ctx);
    expect(r.isAuthCallback).toBe(true);
    expect(r.route).toBeNull();
  });

  it('maps the id-style workspace/channel link shape onto real routes', () => {
    expect(resolveDeepLinkRoute('onetab://workspace/acme/channel/456', ctx).route).toBe(
      '/w/acme/c/456',
    );
    expect(
      resolveDeepLinkRoute('onetab://workspace/acme/project/p1/issue/i9', ctx).route,
    ).toBe('/w/acme/tasks/p1?taskId=i9');
    expect(resolveDeepLinkRoute('onetab://workspace/acme/dm/u_7', ctx).route).toBe(
      '/w/acme/dms/u_7',
    );
    expect(resolveDeepLinkRoute('onetab://workspace/acme/files', ctx).route).toBe(
      '/w/acme/files',
    );
  });

  it('marks a link naming another workspace as cross-workspace', () => {
    const r = resolveDeepLinkRoute('onetab://workspace/other/channel/x', ctx);
    expect(r.crossWorkspace).toBe(true);
    expect(r.route).toBe('/w/acme/c/x');
  });

  it('uses the named workspace when the context has no slug', () => {
    const r = resolveDeepLinkRoute('onetab://workspace/beta/inbox', {});
    expect(r.route).toBe('/w/beta/inbox');
  });

  it('misses on a relative target when there is no workspace context', () => {
    expect(resolveDeepLinkRoute('c/general', {}).route).toBeNull();
  });
});
