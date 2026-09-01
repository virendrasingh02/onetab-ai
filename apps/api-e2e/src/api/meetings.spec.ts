import { api } from '../support/api-client.js';

const suffix = Date.now();

async function signUp(label: string) {
  const email = `${label}-mtg-${suffix}@example.com`;
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

const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

describe('meetings', () => {
  let owner: Awaited<ReturnType<typeof signUp>>;
  let member: Awaited<ReturnType<typeof signUp>>;
  let workspaceId: string;
  let meetingId: string;
  let calendarEventId: string | null;
  let actionItemId: string;

  const base = () => `/workspaces/${workspaceId}/work-tools/meetings`;

  beforeAll(async () => {
    owner = await signUp('owner');
    member = await signUp('member');

    const ws = await api.post(
      '/workspaces',
      { name: 'Meetings E2E', slug: `mtg-e2e-${suffix}`, description: 'e2e' },
      { headers: owner.auth },
    );
    workspaceId = ws.data.id;

    const invite = await api.post(
      `/workspaces/${workspaceId}/invitations`,
      { emails: [member.email], role: 'MEMBER' },
      { headers: owner.auth },
    );
    await api.post(
      '/invitations/accept',
      { token: invite.data.tokens[member.email] },
      { headers: member.auth },
    );
  });

  it('schedules a meeting with a participant and a linked calendar event', async () => {
    const res = await api.post(
      base(),
      {
        title: 'Kickoff',
        agenda: '1. scope\n2. owners',
        location: 'https://meet.example.com/kickoff',
        startAt: inHours(24),
        endAt: inHours(25),
        participantIds: [member.userId],
        addToCalendar: true,
      },
      { headers: owner.auth },
    );

    expect(res.status).toBe(201);
    expect(res.data.status).toBe('SCHEDULED');
    // organizer + one invitee
    expect(res.data.participants).toHaveLength(2);
    expect(
      res.data.participants.some(
        (p: { role: string; rsvp: string }) =>
          p.role === 'ORGANIZER' && p.rsvp === 'ACCEPTED',
      ),
    ).toBe(true);
    expect(res.data.calendarEventId).toBeTruthy();
    expect(res.data._count).toMatchObject({
      notes: 0,
      decisions: 0,
      actionItems: 0,
    });

    meetingId = res.data.id;
    calendarEventId = res.data.calendarEventId;
  });

  it('rejects a meeting that ends before it starts', async () => {
    const res = await api.post(
      base(),
      { title: 'Bad window', startAt: inHours(5), endAt: inHours(2) },
      { headers: owner.auth },
    );
    expect(res.status).toBe(400);
    expect(res.data.errors.endAt).toBeDefined();
  });

  it('shows the linked event on the calendar endpoint', async () => {
    const res = await api.get(
      `/workspaces/${workspaceId}/work-tools/calendar/events`,
      { headers: owner.auth },
    );
    expect(res.status).toBe(200);
    expect(
      res.data.some((e: { id: string }) => e.id === calendarEventId),
    ).toBe(true);
  });

  it('lists the meeting and returns its detail', async () => {
    const list = await api.get(base(), { headers: member.auth });
    expect(list.status).toBe(200);
    expect(list.data.some((m: { id: string }) => m.id === meetingId)).toBe(true);

    const detail = await api.get(`${base()}/${meetingId}`, {
      headers: member.auth,
    });
    expect(detail.status).toBe(200);
    expect(detail.data).toHaveProperty('notes');
    expect(detail.data).toHaveProperty('decisions');
    expect(detail.data).toHaveProperty('actionItems');
  });

  it('captures notes, decisions and an action item that becomes a task', async () => {
    const note = await api.post(
      `${base()}/${meetingId}/notes`,
      { body: 'Agreed on the plan.' },
      { headers: owner.auth },
    );
    expect(note.status).toBe(201);
    expect(note.data.author).toBeDefined();

    const decision = await api.post(
      `${base()}/${meetingId}/decisions`,
      { text: 'Ship in two weeks' },
      { headers: owner.auth },
    );
    expect(decision.status).toBe(201);

    const item = await api.post(
      `${base()}/${meetingId}/action-items`,
      { title: 'Draft the RFC', assigneeId: member.userId },
      { headers: owner.auth },
    );
    expect(item.status).toBe(201);
    expect(item.data.meetingId).toBe(meetingId);
    expect(item.data.assigneeId).toBe(member.userId);
    actionItemId = item.data.id;

    const itemsList = await api.get(`${base()}/${meetingId}/action-items`, {
      headers: owner.auth,
    });
    expect(itemsList.data.map((t: { id: string }) => t.id)).toContain(
      actionItemId,
    );

    const detail = await api.get(`${base()}/${meetingId}`, {
      headers: owner.auth,
    });
    expect(detail.data._count).toMatchObject({
      notes: 1,
      decisions: 1,
      actionItems: 1,
    });
  });

  it('the action item is a real task carrying its meeting id', async () => {
    const task = await api.get(
      `/workspaces/${workspaceId}/work-tools/tasks/${actionItemId}`,
      { headers: owner.auth },
    );
    expect(task.status).toBe(200);
    expect(task.data.meetingId).toBe(meetingId);
    expect(task.data.meeting?.id).toBe(meetingId);
  });

  it('cannot remove the organizer from their own meeting', async () => {
    const res = await api.delete(
      `${base()}/${meetingId}/participants/${owner.userId}`,
      { headers: owner.auth },
    );
    expect(res.status).toBe(400);
  });

  it('hides the meeting from a non-member (404, not 403)', async () => {
    const outsider = await signUp('outsider');
    const res = await api.get(`${base()}/${meetingId}`, {
      headers: outsider.auth,
    });
    expect(res.status).toBe(404);
  });

  it('lets a MEMBER cancel but not delete', async () => {
    const cancelled = await api.post(
      `${base()}/${meetingId}/cancel`,
      {},
      { headers: member.auth },
    );
    expect(cancelled.status).toBe(201);
    expect(cancelled.data.status).toBe('CANCELLED');

    const forbidden = await api.delete(`${base()}/${meetingId}`, {
      headers: member.auth,
    });
    expect(forbidden.status).toBe(403);
  });

  it('lets the OWNER delete, then restore from the trash', async () => {
    const del = await api.delete(`${base()}/${meetingId}`, {
      headers: owner.auth,
    });
    expect(del.status).toBe(204);

    const gone = await api.get(base(), { headers: owner.auth });
    expect(gone.data.some((m: { id: string }) => m.id === meetingId)).toBe(
      false,
    );

    const trash = await api.get(`${base()}/trash`, { headers: owner.auth });
    expect(trash.data.some((m: { id: string }) => m.id === meetingId)).toBe(
      true,
    );

    const restored = await api.post(
      `${base()}/${meetingId}/restore`,
      {},
      { headers: owner.auth },
    );
    expect(restored.status).toBe(201);
    expect(restored.data.id).toBe(meetingId);
  });
});
