import { api } from '../support/api-client.js';

const suffix = Date.now();

async function signUp(label: string) {
  const email = `${label}-${suffix}@example.com`;
  const password = 'Correct1HorseBattery';

  const res = await api.post('/auth/register', {
    name: label,
    email,
    password,
    confirmPassword: password,
    acceptTerms: true,
  });

  return {
    email,
    userId: res.data.user.id as string,
    auth: { Authorization: `Bearer ${res.data.accessToken}` },
  };
}

describe('workspace and channel lifecycle', () => {
  let owner: Awaited<ReturnType<typeof signUp>>;
  let outsider: Awaited<ReturnType<typeof signUp>>;
  let workspaceId: string;
  const slug = `acme-${suffix}`;

  beforeAll(async () => {
    owner = await signUp('owner');
    outsider = await signUp('outsider');
  });

  it('creates a workspace with an owner membership and a #general channel', async () => {
    const res = await api.post(
      '/workspaces',
      { name: 'Acme', slug, description: 'e2e' },
      { headers: owner.auth },
    );

    expect(res.status).toBe(201);
    expect(res.data.role).toBe('OWNER');
    expect(res.data.memberCount).toBe(1);
    // The workspace is seeded with #general in the same transaction.
    expect(res.data.channelCount).toBe(1);

    workspaceId = res.data.id;
  });

  it('rejects a duplicate slug', async () => {
    const res = await api.post(
      '/workspaces',
      { name: 'Acme Again', slug },
      { headers: owner.auth },
    );

    expect(res.status).toBe(409);
    expect(res.data.errors.slug).toBeDefined();
  });

  it('hides the workspace from non-members with 404, not 403', async () => {
    const res = await api.get(`/workspaces/${slug}`, {
      headers: outsider.auth,
    });

    // 403 would confirm the workspace exists.
    expect(res.status).toBe(404);
  });

  it('does not list the workspace for a non-member', async () => {
    const res = await api.get('/workspaces', { headers: outsider.auth });

    expect(res.status).toBe(200);
    expect(res.data).toEqual([]);
  });

  it('creates a private channel', async () => {
    const res = await api.post(
      `/workspaces/${workspaceId}/channels`,
      { name: 'design-crit', visibility: 'PRIVATE', topic: 'Weekly critique' },
      { headers: owner.auth },
    );

    expect(res.status).toBe(201);
    expect(res.data.visibility).toBe('PRIVATE');
  });

  it('rejects an invalid channel name', async () => {
    const res = await api.post(
      `/workspaces/${workspaceId}/channels`,
      { name: 'Bad Name!', visibility: 'PUBLIC' },
      { headers: owner.auth },
    );

    expect(res.status).toBe(400);
    expect(res.data.errors.name).toBeDefined();
  });

  it('refuses to archive #general', async () => {
    const channels = await api.get(`/workspaces/${workspaceId}/channels`, {
      headers: owner.auth,
    });
    const general = channels.data.find(
      (c: { slug: string }) => c.slug === 'general',
    );

    const res = await api.post(
      `/workspaces/${workspaceId}/channels/${general.id}/archive`,
      {},
      { headers: owner.auth },
    );

    expect(res.status).toBe(409);
  });

  it('lets an invited member join, without exposing private channels', async () => {
    const invite = await api.post(
      `/workspaces/${workspaceId}/invitations`,
      { emails: [outsider.email], role: 'MEMBER' },
      { headers: owner.auth },
    );
    expect(invite.status).toBe(201);

    const token = invite.data.tokens[outsider.email];
    const accepted = await api.post(
      '/invitations/accept',
      { token },
      { headers: outsider.auth },
    );
    expect(accepted.status).toBe(200);

    const channels = await api.get(`/workspaces/${workspaceId}/channels`, {
      headers: outsider.auth,
    });
    const slugs = channels.data.map((c: { slug: string }) => c.slug);

    expect(slugs).toContain('general');
    expect(slugs).not.toContain('design-crit');
  });

  it('binds an invitation to the address it was sent to', async () => {
    const invite = await api.post(
      `/workspaces/${workspaceId}/invitations`,
      { emails: [`someone-else-${suffix}@example.com`], role: 'MEMBER' },
      { headers: owner.auth },
    );

    const token = invite.data.tokens[`someone-else-${suffix}@example.com`];
    const res = await api.post(
      '/invitations/accept',
      { token },
      { headers: outsider.auth },
    );

    expect(res.status).toBe(403);
  });

  it('blocks a MEMBER from admin-only actions', async () => {
    const invited = await api.post(
      `/workspaces/${workspaceId}/invitations`,
      { emails: ['x@example.com'], role: 'MEMBER' },
      { headers: outsider.auth },
    );
    expect(invited.status).toBe(403);

    const deleted = await api.delete(`/workspaces/${workspaceId}`, {
      headers: outsider.auth,
    });
    expect(deleted.status).toBe(403);
  });
});
