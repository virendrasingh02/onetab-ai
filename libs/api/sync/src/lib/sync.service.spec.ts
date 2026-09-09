import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SyncService } from './sync.service.js';

const WS = 'ws_1';
const USER = 'user_1';

/** Records the `where` each findMany was called with, for assertions. */
function makePrisma() {
  const calls: Record<string, unknown> = {};
  const model = (name: string, rows: unknown[]) => ({
    findMany: vi.fn(async (args: { where: unknown }) => {
      calls[name] = args.where;
      return rows;
    }),
    count: vi.fn(async () => 0),
  });
  return {
    calls,
    prisma: {
      channel: model('channel', [{ id: 'c1', updatedAt: new Date('2022-01-02') }]),
      workspaceMember: model('workspaceMember', []),
      notification: {
        findMany: vi.fn(async (args: { where: unknown }) => {
          calls['notification'] = args.where;
          return [{ id: 'n1', createdAt: new Date('2022-01-03') }];
        }),
        count: vi.fn(async () => 7),
      },
      task: model('task', []),
      project: model('project', []),
      meeting: model('meeting', []),
    },
  };
}

describe('SyncService.getChanges', () => {
  let service: SyncService;
  let harness: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    harness = makePrisma();
    service = new SyncService(harness.prisma as never);
  });

  it('scopes every query to the workspace and, for notifications, the caller', async () => {
    await service.getChanges(WS, USER, '2022-01-01T00:00:00.000Z');

    expect(harness.calls['channel']).toMatchObject({ workspaceId: WS });
    expect(harness.calls['task']).toMatchObject({ workspaceId: WS });
    expect(harness.calls['notification']).toMatchObject({
      workspaceId: WS,
      recipientId: USER,
    });
  });

  it('honours a recent `since` cursor and returns serverTime + unreadCount', async () => {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1h ago
    const digest = await service.getChanges(WS, USER, since);

    expect((harness.calls['channel'] as { updatedAt: { gt: Date } }).updatedAt.gt)
      .toEqual(new Date(since));
    expect(digest.workspaceId).toBe(WS);
    expect(digest.since).toBe(since);
    expect(digest.hasMore).toBe(false);
    expect(Date.parse(digest.serverTime)).not.toBeNaN();
    expect(digest.unreadCount).toBe(7);
    expect(digest.changed.channels).toEqual([
      { id: 'c1', updatedAt: new Date('2022-01-02').toISOString() },
    ]);
  });

  it('clamps a `since` older than the max lookback and forces hasMore', async () => {
    const digest = await service.getChanges(WS, USER, '1990-01-01T00:00:00.000Z');
    const sinceMs = Date.parse(digest.since);
    expect(Date.now() - sinceMs).toBeLessThanOrEqual(
      7 * 24 * 60 * 60 * 1000 + 5_000,
    );
    expect(digest.hasMore).toBe(true);
  });

  it('reports hasMore when a category exceeds the row cap', async () => {
    const many = Array.from({ length: 201 }, (_, i) => ({
      id: `t${i}`,
      updatedAt: new Date(),
    }));
    harness.prisma.task.findMany.mockResolvedValueOnce(many);
    const digest = await service.getChanges(WS, USER);
    expect(digest.hasMore).toBe(true);
    expect(digest.changed.tasks).toHaveLength(200);
  });
});

describe('SyncService.getState', () => {
  it('returns unread + mention counts and a server clock', async () => {
    const harness = makePrisma();
    harness.prisma.notification.count = vi
      .fn()
      .mockResolvedValueOnce(9) // unread
      .mockResolvedValueOnce(2); // mentions
    const service = new SyncService(harness.prisma as never);

    const state = await service.getState(WS, USER);
    expect(state).toMatchObject({ workspaceId: WS, unreadCount: 9, mentionCount: 2 });
    expect(Date.parse(state.serverTime)).not.toBeNaN();
  });
});
