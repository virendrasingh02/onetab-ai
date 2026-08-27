import { api } from '../support/api-client.js';

/**
 * Cross-workspace isolation.
 *
 * The attack these guard against is not "call another tenant's URL" — that is
 * already refused by membership. It is subtler: pass a workspace you *do*
 * belong to in the path, so the guard is satisfied, together with a resource id
 * from a workspace you do not. Every route that accepts a nested id has to bind
 * the two together, and each test below pins one route that previously did not.
 */

const suffix = Date.now();

async function signUp(label: string) {
  const email = `${label}-iso-${suffix}@example.com`;
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

async function createWorkspace(
  auth: Record<string, string>,
  slug: string,
): Promise<string> {
  const res = await api.post(
    '/workspaces',
    { name: slug, slug },
    { headers: auth },
  );
  expect(res.status).toBe(201);
  return res.data.id as string;
}

async function generalChannelId(
  auth: Record<string, string>,
  workspaceId: string,
): Promise<string> {
  const res = await api.get(`/workspaces/${workspaceId}/channels`, {
    headers: auth,
  });
  return res.data.find((c: { slug: string }) => c.slug === 'general').id;
}

/**
 * The only two accounts this file registers.
 *
 * `/auth/register` is throttled to 10 a minute and that budget is shared with
 * every other spec, so the three groups below reuse this pair rather than
 * signing up an actor each.
 */
let alice: Awaited<ReturnType<typeof signUp>>;
let bob: Awaited<ReturnType<typeof signUp>>;

beforeAll(async () => {
  [alice, bob] = await Promise.all([signUp('alice'), signUp('bob')]);
});

describe('cross-workspace isolation', () => {
  let workspaceA: string;
  let workspaceB: string;
  /** A channel in B. Alice has no membership of B at all. */
  let channelB: string;
  let projectB: string;
  let taskB: string;

  beforeAll(async () => {
    workspaceA = await createWorkspace(alice.auth, `alpha-${suffix}`);
    workspaceB = await createWorkspace(bob.auth, `bravo-${suffix}`);

    channelB = await generalChannelId(bob.auth, workspaceB);

    const project = await api.post(
      `/workspaces/${workspaceB}/work-tools/projects`,
      { name: 'Secret Project', slug: `secret-${suffix}` },
      { headers: bob.auth },
    );
    projectB = project.data.id;

    const task = await api.post(
      `/workspaces/${workspaceB}/work-tools/tasks`,
      { title: 'Confidential task' },
      { headers: bob.auth },
    );
    taskB = task.data.id;
  });

  describe('membership', () => {
    it('does not list another owner’s workspace', async () => {
      const res = await api.get('/workspaces', { headers: alice.auth });
      const ids = res.data.map((w: { id: string }) => w.id);

      expect(ids).toContain(workspaceA);
      expect(ids).not.toContain(workspaceB);
    });

    it('refuses a workspace the caller does not belong to', async () => {
      const res = await api.get(`/workspaces/${workspaceB}/channels`, {
        headers: alice.auth,
      });

      // 404, not 403 — that the workspace exists is itself private.
      expect(res.status).toBe(404);
    });
  });

  /*
   * The core of the suite. Alice puts *her own* workspace id in the path, so
   * `WorkspaceRoleGuard` passes, and Bob's resource id in the tail.
   */
  describe('a member of A cannot reach B by nesting B’s ids under A', () => {
    it('channel members', async () => {
      const res = await api.get(
        `/workspaces/${workspaceA}/channels/${channelB}/members`,
        { headers: alice.auth },
      );
      expect(res.status).toBe(404);
    });

    it('channel files', async () => {
      const res = await api.get(
        `/workspaces/${workspaceA}/channels/${channelB}/files`,
        { headers: alice.auth },
      );
      expect(res.status).toBe(404);
    });

    it('channel pins', async () => {
      const read = await api.get(
        `/workspaces/${workspaceA}/channels/${channelB}/pins`,
        { headers: alice.auth },
      );
      expect(read.status).toBe(404);

      const write = await api.post(
        `/workspaces/${workspaceA}/channels/${channelB}/pins`,
        { title: 'planted' },
        { headers: alice.auth },
      );
      expect(write.status).toBe(404);
    });

    it('joining a channel', async () => {
      const res = await api.post(
        `/workspaces/${workspaceA}/channels/${channelB}/join`,
        {},
        { headers: alice.auth },
      );
      expect(res.status).toBe(404);

      // And the join really did not happen.
      const members = await api.get(
        `/workspaces/${workspaceB}/channels/${channelB}/members`,
        { headers: bob.auth },
      );
      const memberIds = members.data.map(
        (m: { user: { id: string } }) => m.user.id,
      );
      expect(memberIds).not.toContain(alice.userId);
    });

    it('marking a channel read', async () => {
      const res = await api.post(
        `/workspaces/${workspaceA}/channels/${channelB}/read`,
        {},
        { headers: alice.auth },
      );
      expect(res.status).toBe(404);
    });

    it('channel preferences', async () => {
      const res = await api.patch(
        `/workspaces/${workspaceA}/channels/${channelB}/preferences`,
        { isMuted: true },
        { headers: alice.auth },
      );
      expect(res.status).toBe(404);
    });

    it('renaming a channel', async () => {
      const res = await api.patch(
        `/workspaces/${workspaceA}/channels/${channelB}`,
        { name: 'pwned' },
        { headers: alice.auth },
      );
      expect(res.status).toBe(404);

      const check = await api.get(
        `/workspaces/${workspaceB}/channels/by-slug/general`,
        { headers: bob.auth },
      );
      expect(check.data.name).toBe('general');
    });

    it('archiving a channel', async () => {
      const res = await api.post(
        `/workspaces/${workspaceA}/channels/${channelB}/archive`,
        {},
        { headers: alice.auth },
      );
      expect(res.status).toBe(404);
    });

    it('updating a project', async () => {
      const res = await api.patch(
        `/workspaces/${workspaceA}/work-tools/projects/${projectB}`,
        { name: 'pwned' },
        { headers: alice.auth },
      );
      expect(res.status).toBe(404);
    });

    it('deleting a project', async () => {
      const res = await api.delete(
        `/workspaces/${workspaceA}/work-tools/projects/${projectB}`,
        { headers: alice.auth },
      );
      expect(res.status).toBe(404);

      const still = await api.get(
        `/workspaces/${workspaceB}/work-tools/projects`,
        { headers: bob.auth },
      );
      expect(still.data.map((p: { id: string }) => p.id)).toContain(projectB);
    });

    it('updating a task', async () => {
      const res = await api.patch(
        `/workspaces/${workspaceA}/work-tools/tasks/${taskB}`,
        { title: 'pwned' },
        { headers: alice.auth },
      );
      expect(res.status).toBe(404);
    });

    it('reading task comments', async () => {
      const res = await api.get(
        `/workspaces/${workspaceA}/work-tools/tasks/${taskB}/comments`,
        { headers: alice.auth },
      );
      expect(res.status).toBe(404);
    });
  });

  /*
   * A member acting entirely inside their own workspace, but pointing a
   * foreign-key field at an id from a workspace they are not in. The guard is
   * satisfied — Bob owns B — so the check has to be in the service (audit S1).
   */
  describe('a member of B cannot attach A’s ids to B’s rows', () => {
    it('rejects a task assigned to a non-member on create', async () => {
      const res = await api.post(
        `/workspaces/${workspaceB}/work-tools/tasks`,
        { title: 'Planted assignee', assigneeId: alice.userId },
        { headers: bob.auth },
      );
      expect(res.status).toBe(404);
    });

    it('rejects a task reassigned to a non-member on update', async () => {
      const res = await api.patch(
        `/workspaces/${workspaceB}/work-tools/tasks/${taskB}`,
        { assigneeId: alice.userId },
        { headers: bob.auth },
      );
      expect(res.status).toBe(404);

      // And the assignee really did not change.
      const check = await api.get(
        `/workspaces/${workspaceB}/work-tools/tasks/${taskB}`,
        { headers: bob.auth },
      );
      expect(check.data.assigneeId ?? null).toBeNull();
    });

    it('rejects a project led by a non-member', async () => {
      const res = await api.post(
        `/workspaces/${workspaceB}/work-tools/projects`,
        {
          name: 'Planted lead',
          slug: `planted-lead-${suffix}`,
          leadId: alice.userId,
        },
        { headers: bob.auth },
      );
      expect(res.status).toBe(404);
    });
  });

  describe('a stranger cannot read a profile through the id route', () => {
    it('404s when the viewer shares no workspace with the target', async () => {
      // Alice and Bob share nothing at this point in the file.
      const res = await api.get(`/users/${bob.userId}`, { headers: alice.auth });
      expect(res.status).toBe(404);
    });

    it('still returns the caller’s own profile', async () => {
      const res = await api.get(`/users/${alice.userId}`, {
        headers: alice.auth,
      });
      expect(res.status).toBe(200);
      expect(res.data.id).toBe(alice.userId);
    });
  });

  describe('search and listings never cross the boundary', () => {
    it('does not return another workspace’s task', async () => {
      const res = await api.get(`/workspaces/${workspaceA}/search`, {
        headers: alice.auth,
        params: { q: 'Confidential' },
      });

      expect(res.status).toBe(200);
      expect(
        res.data.some((r: { id: string }) => r.id === taskB),
      ).toBe(false);
    });

    it('lists only the caller’s own tasks', async () => {
      const res = await api.get(`/workspaces/${workspaceA}/work-tools/tasks`, {
        headers: alice.auth,
      });

      expect(res.status).toBe(200);
      expect(res.data.map((t: { id: string }) => t.id)).not.toContain(taskB);
    });
  });

  describe('matrix room linking', () => {
    it('refuses to link a channel the caller cannot see', async () => {
      // This route sits outside /workspaces/:id, so it carries its own
      // membership check. A 404 or a "not configured" 503 both mean the
      // channel was never provisioned for Alice; a 200 with a roomId would be
      // a chat-history leak.
      const res = await api.post(
        `/matrix/channels/${channelB}/room`,
        {},
        { headers: alice.auth },
      );

      expect(res.status).not.toBe(200);
      expect(res.data?.roomId).toBeUndefined();
    });
  });
});

describe('role permissions', () => {
  let workspaceId: string;

  beforeAll(async () => {
    // Alice owns it; Bob joins as a GUEST.
    workspaceId = await createWorkspace(alice.auth, `perms-${suffix}`);

    const invite = await api.post(
      `/workspaces/${workspaceId}/invitations`,
      { emails: [bob.email], role: 'GUEST' },
      { headers: alice.auth },
    );
    expect(invite.status).toBe(201);

    const accepted = await api.post(
      '/invitations/accept',
      { token: invite.data.tokens[bob.email] },
      { headers: bob.auth },
    );
    expect(accepted.status).toBe(200);
  });

  it('lets a guest read', async () => {
    const res = await api.get(`/workspaces/${workspaceId}/work-tools/projects`, {
      headers: bob.auth,
    });
    expect(res.status).toBe(200);
  });

  it('stops a guest creating a project', async () => {
    const res = await api.post(
      `/workspaces/${workspaceId}/work-tools/projects`,
      { name: 'Guest project', slug: `guest-${suffix}` },
      { headers: bob.auth },
    );
    expect(res.status).toBe(403);
  });

  it('stops a guest editing a channel', async () => {
    const channelId = await generalChannelId(alice.auth, workspaceId);
    const res = await api.patch(
      `/workspaces/${workspaceId}/channels/${channelId}`,
      { name: 'guest-renamed' },
      { headers: bob.auth },
    );
    expect(res.status).toBe(403);
  });

  it('stops a guest managing members', async () => {
    const res = await api.post(
      `/workspaces/${workspaceId}/invitations`,
      { emails: ['someone@example.com'], role: 'MEMBER' },
      { headers: bob.auth },
    );
    expect(res.status).toBe(403);
  });

  it('still lets a guest mark a channel read', async () => {
    // Self-service: it changes only the guest's own view, so a read-only role
    // must not be locked out of it.
    const channelId = await generalChannelId(alice.auth, workspaceId);
    const res = await api.post(
      `/workspaces/${workspaceId}/channels/${channelId}/read`,
      {},
      { headers: bob.auth },
    );
    expect(res.status).toBe(204);
  });
});

describe('private channels stay private to non-members', () => {
  let workspaceId: string;
  let privateChannelName: string;

  beforeAll(async () => {
    // Alice owns it; Bob joins as a full MEMBER (so he can search).
    workspaceId = await createWorkspace(alice.auth, `priv-${suffix}`);

    const invite = await api.post(
      `/workspaces/${workspaceId}/invitations`,
      { emails: [bob.email], role: 'MEMBER' },
      { headers: alice.auth },
    );
    expect(invite.status).toBe(201);
    const accepted = await api.post(
      '/invitations/accept',
      { token: invite.data.tokens[bob.email] },
      { headers: bob.auth },
    );
    expect(accepted.status).toBe(200);

    privateChannelName = `secret-room-${suffix}`;
    const channel = await api.post(
      `/workspaces/${workspaceId}/channels`,
      { name: privateChannelName, visibility: 'PRIVATE' },
      { headers: alice.auth },
    );
    expect(channel.status).toBe(201);
  });

  it('a member not in the channel does not see it in search (audit S3)', async () => {
    const res = await api.get(`/workspaces/${workspaceId}/search`, {
      headers: bob.auth,
      params: { q: privateChannelName },
    });
    expect(res.status).toBe(200);
    expect(
      res.data.some(
        (r: { category: string; title: string }) =>
          r.category === 'channels' && r.title.includes(privateChannelName),
      ),
    ).toBe(false);
  });

  it('the owner, who is in the channel, still finds it', async () => {
    const res = await api.get(`/workspaces/${workspaceId}/search`, {
      headers: alice.auth,
      params: { q: privateChannelName },
    });
    expect(res.status).toBe(200);
    expect(
      res.data.some(
        (r: { category: string; title: string }) =>
          r.category === 'channels' && r.title.includes(privateChannelName),
      ),
    ).toBe(true);
  });
});

describe('archived workspaces', () => {
  let workspaceId: string;

  beforeAll(async () => {
    workspaceId = await createWorkspace(alice.auth, `archived-${suffix}`);
  });

  it('freezes writes but keeps reads working', async () => {
    const archived = await api.post(
      `/workspaces/${workspaceId}/archive`,
      {},
      { headers: alice.auth },
    );
    expect(archived.status).toBe(204);

    const read = await api.get(
      `/workspaces/${workspaceId}/work-tools/projects`,
      { headers: alice.auth },
    );
    expect(read.status).toBe(200);

    const write = await api.post(
      `/workspaces/${workspaceId}/work-tools/projects`,
      { name: 'After archive', slug: `after-${suffix}` },
      { headers: alice.auth },
    );
    expect(write.status).toBe(403);
  });

  it('can be restored, and accepts writes again', async () => {
    const restored = await api.post(
      `/workspaces/${workspaceId}/restore`,
      {},
      { headers: alice.auth },
    );
    expect(restored.status).toBe(204);

    const write = await api.post(
      `/workspaces/${workspaceId}/work-tools/projects`,
      { name: 'After restore', slug: `restored-${suffix}` },
      { headers: alice.auth },
    );
    expect(write.status).toBe(201);
  });
});
