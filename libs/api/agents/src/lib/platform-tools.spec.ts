import { describe, expect, it, vi } from 'vitest';
import { buildPlatformTools, parseTaskList, resolveRange } from './platform-tools.js';

function tools(prisma: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const list = buildPlatformTools({ prisma: prisma as never, ...extra });
  return Object.fromEntries(list.map((t) => [t.name, t]));
}

const ctx = { workspaceId: 'ws_1', actingUserId: 'u_1', timezone: 'UTC' };

describe('parseTaskList', () => {
  it('reads JSON arrays, JSON text, wrapped lists and markdown bullets', () => {
    expect(parseTaskList([{ title: 'A', priority: 'HIGH' }, 'B'])).toEqual([{ title: 'A', priority: 'HIGH' }, { title: 'B' }]);
    expect(parseTaskList('```json\n[{"title":"C","dueDate":"2026-10-02"}]\n```')).toEqual([{ title: 'C', dueDate: '2026-10-02' }]);
    expect(parseTaskList('{"tasks":[{"title":"D"}]}')).toEqual([{ title: 'D' }]);
    expect(parseTaskList('- Call Sam\n2. Send the deck\n* [ ] Book room')).toEqual([
      { title: 'Call Sam' },
      { title: 'Send the deck' },
      { title: 'Book room' },
    ]);
    expect(parseTaskList('[]')).toEqual([]);
    expect(parseTaskList(42)).toEqual([]);
  });
});

describe('resolveRange', () => {
  const now = new Date('2026-09-30T20:00:00Z'); // Wednesday; already Thursday in Kolkata.
  it('reads days in the given zone', () => {
    expect(resolveRange('today', 'UTC', now).from.toISOString()).toBe('2026-09-30T00:00:00.000Z');
    expect(resolveRange('today', 'Asia/Kolkata', now).from.toISOString()).toBe('2026-09-30T18:30:00.000Z');
  });
  it('starts weeks on Monday', () => {
    const week = resolveRange('this_week', 'UTC', now);
    expect(week.from.toISOString()).toBe('2026-09-28T00:00:00.000Z');
    expect(week.to.toISOString()).toBe('2026-10-05T00:00:00.000Z');
  });
  it('falls back to today for an unknown range', () => {
    expect(resolveRange('fortnight', 'UTC', now).label).toBe('today');
  });
});

describe('find_tasks', () => {
  it('defaults to the owner’s open tasks and reports what blocks them', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 't1',
        identifier: 'WEB-1',
        title: 'Ship it',
        status: 'IN_PROGRESS',
        priority: 'HIGH',
        dueDate: new Date('2020-01-01'),
        completedAt: null,
        updatedAt: new Date(),
        timeSpent: 45,
        labels: [],
        projectId: 'p1',
        project: { name: 'Web' },
        assignee: { name: 'Priya', displayName: null },
        sourceRelations: [{ target: { identifier: 'WEB-0', title: 'Design', status: 'TODO' } }],
        targetRelations: [],
      },
    ]);
    const t = tools({ task: { findMany } });
    const result = (await t['find_tasks']!.handler({}, ctx)) as any;
    const where = findMany.mock.calls[0][0].where.AND;
    expect(where).toContainEqual({ OR: [{ assigneeId: 'u_1' }, { assigneeIds: { has: 'u_1' } }] });
    expect(where).toContainEqual({ status: { in: ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW'] } });
    expect(result.tasks[0]).toMatchObject({ overdue: true, blocked: true, blockedBy: [{ identifier: 'WEB-0' }], link: 'tasks?taskId=t1' });
    expect(result.totalTimeSpentMinutes).toBe(45);
  });
});

describe('create_tasks', () => {
  it('skips titles that already exist as open tasks', async () => {
    const createTask = vi.fn().mockImplementation(async (_ws, input) => ({ id: 'new', identifier: null, title: input.title, projectId: null }));
    const t = tools(
      {
        workspaceMember: { findFirst: vi.fn().mockResolvedValue({ id: 'm' }) },
        task: { findMany: vi.fn().mockResolvedValue([{ title: 'call sam' }]) },
      },
      { createTask },
    );
    const result = (await t['create_tasks']!.handler({ tasks: '- Call Sam\n- Send deck', assignToMe: true }, ctx)) as any;
    expect(result).toMatchObject({ created: 1, skipped: 1, skippedTitles: ['Call Sam'] });
    expect(createTask).toHaveBeenCalledWith('ws_1', expect.objectContaining({ title: 'Send deck', assigneeId: 'u_1' }), 'u_1');
  });
});

describe('search_email', () => {
  it('says plainly when Gmail is not connected', async () => {
    const t = tools(
      { externalIntegration: { findFirst: vi.fn().mockResolvedValue(null) } },
      { integrations: { getMessages: vi.fn() } },
    );
    await expect(t['search_email']!.handler({ query: 'is:unread' }, ctx)).rejects.toThrow(/Gmail isn’t connected/);
  });

  it('asks for a reconnect when the connection lapsed', async () => {
    const t = tools(
      { externalIntegration: { findFirst: vi.fn().mockResolvedValue({ id: 'i1', status: 'EXPIRED' }) } },
      { integrations: { getMessages: vi.fn() } },
    );
    await expect(t['search_email']!.handler({}, ctx)).rejects.toThrow(/Reconnect Gmail/);
  });
});

describe('read_doc and search_docs', () => {
  it('only reads docs shared with the workspace or written by the owner', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const t = tools({ workDocument: { findFirst } });
    await expect(t['read_doc']!.handler({ docId: 'd1' }, ctx)).rejects.toThrow(/No doc/);
    expect(findFirst.mock.calls[0][0].where.OR).toEqual([{ isPublic: true }, { authorId: 'u_1' }]);
  });
});

describe('create_doc', () => {
  const member = { workspaceMember: { findFirst: vi.fn().mockResolvedValue({ id: 'm' }) } };

  it('files the doc as a page in the agent docs folder, as editor blocks', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const createDocument = vi
      .fn()
      .mockResolvedValueOnce({ id: 'folder_1', title: 'AI agent docs' })
      .mockResolvedValueOnce({ id: 'doc_1', title: 'Daily report' });
    const t = tools({ ...member, workDocument: { findFirst } }, { createDocument });
    const result = await t['create_doc']!.handler({ title: 'Daily report', content: '# Done\n- **RCS-8** shipped' }, ctx);

    expect(result).toEqual({ created: true, id: 'doc_1', title: 'Daily report', link: 'docs/doc_1' });
    expect(createDocument.mock.calls[0]).toEqual(['ws_1', 'u_1', { title: 'AI agent docs', content: '', parentId: null, kind: 'WIKI' }]);
    const page = createDocument.mock.calls[1][2];
    expect(page).toMatchObject({ title: 'Daily report', parentId: 'folder_1', kind: 'DOC' });
    expect(JSON.parse(page.content).blocks.map((b: { type: string; content: string }) => [b.type, b.content])).toEqual([
      ['h1', 'Done'],
      ['bullet_list', 'RCS-8 shipped'],
    ]);
  });

  it('reuses a folder that already exists, by name', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 'reports' });
    const createDocument = vi.fn().mockResolvedValue({ id: 'doc_2', title: 'Weekly' });
    const t = tools({ ...member, workDocument: { findFirst } }, { createDocument });
    await t['create_doc']!.handler({ title: 'Weekly', content: 'x', folder: 'Reports' }, ctx);
    expect(findFirst.mock.calls[0][0].where).toMatchObject({ parentId: null, title: { equals: 'Reports', mode: 'insensitive' } });
    expect(createDocument).toHaveBeenCalledTimes(1);
    expect(createDocument.mock.calls[0][2].parentId).toBe('reports');
  });

  it('reads an editor doc back as text', async () => {
    const content = JSON.stringify({ kind: 'onetab.doc', v: 1, meta: {}, blocks: [{ id: 'b', type: 'h2', content: 'Blockers' }], comments: [] });
    const findFirst = vi.fn().mockResolvedValue({ id: 'd', title: 'T', content, updatedAt: new Date(0), author: { name: 'P', displayName: null } });
    const t = tools({ workDocument: { findFirst } });
    expect(await t['read_doc']!.handler({ docId: 'd' }, ctx)).toMatchObject({ content: '## Blockers', truncated: false });
  });
});
