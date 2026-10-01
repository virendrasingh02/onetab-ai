import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppEvent } from '@org/api-common';
import { TrackerMonitorSweepService } from './tracker-monitor-sweep.service.js';
import { buildTrackerMonitor } from './tracker-monitors.js';

const NOW = new Date('2026-10-01T12:00:00Z');

function overdueTask(id: string, assignee: string, daysLate: number) {
  return {
    id,
    title: `Task ${id}`,
    identifier: `LAU-${id}`,
    status: 'IN_PROGRESS',
    dueDate: new Date(NOW.getTime() - daysLate * 86_400_000),
    projectId: 'proj-1',
    assigneeId: null,
    assigneeIds: [assignee],
    project: { name: 'Product Launch' },
  };
}

function setup(monitorInput: Parameters<typeof buildTrackerMonitor>[0]) {
  const monitor = buildTrackerMonitor(
    monitorInput,
    { workspaceId: 'ws-1', coworkerId: 'tracker-1', createdBy: 'owner-1' },
    new Date(NOW.getTime() - 3_600_000),
  );
  let configuration: Record<string, unknown> = { coworkerType: 'tracker', monitors: [monitor] };
  const coworker = {
    id: 'tracker-1',
    workspaceId: 'ws-1',
    name: 'Tracker',
    type: 'coworker',
    creatorId: null,
    matrixUserId: null,
    get configuration() {
      return configuration;
    },
  };
  const prisma: any = {
    aIAgent: {
      findMany: vi.fn().mockImplementation(() => Promise.resolve([coworker])),
      findFirst: vi.fn().mockImplementation(() => Promise.resolve(coworker)),
      findUnique: vi.fn().mockImplementation(() => Promise.resolve({ configuration })),
      update: vi.fn().mockImplementation((args: any) => {
        if (args.data?.configuration) configuration = args.data.configuration;
        return Promise.resolve({});
      }),
    },
    workspaceMember: {
      count: vi.fn().mockResolvedValue(1),
      findMany: vi.fn().mockImplementation((args: any) =>
        Promise.resolve((args.where.userId.in as string[]).map((userId) => ({ userId }))),
      ),
    },
    user: { findUnique: vi.fn().mockResolvedValue({ timezone: 'UTC' }) },
    project: {
      findFirst: vi.fn().mockResolvedValue({ id: 'proj-1', name: 'Product Launch' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
    task: {
      findMany: vi.fn().mockResolvedValue([overdueTask('1', 'alice', 2), overdueTask('2', 'bob', 1)]),
      count: vi.fn().mockResolvedValue(0),
    },
    channel: { findFirst: vi.fn().mockResolvedValue({ id: 'chan-1', name: 'launch' }) },
    agentExecutionLog: { create: vi.fn().mockResolvedValue({ id: 'log-1' }) },
  };
  const delivery = { postText: vi.fn().mockResolvedValue('channel: posted to #launch') };
  const events = { emit: vi.fn(), emitAsync: vi.fn().mockResolvedValue([]) };
  const service = new TrackerMonitorSweepService(prisma, delivery as any, events as any);
  return { service, prisma, delivery, events, monitor, config: () => configuration };
}

describe('TrackerMonitorSweepService', () => {
  let ctx: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup({ target: 'Product Launch', condition: 'becomes overdue', destinations: ['me', 'assignees', '#launch'] });
  });

  it('reports every overdue task on the first check — to the owner, each assignee and the channel', async () => {
    const checked = await ctx.service.sweep(NOW);
    expect(checked).toBe(1);

    // First check: no lower bound on the due date.
    const where = ctx.prisma.task.findMany.mock.calls[0][0].where;
    expect(where.AND[1].dueDate).toEqual({ lt: NOW });

    const messages = ctx.events.emitAsync.mock.calls
      .filter(([name]: [string]) => name === AppEvent.AiAgentMessage)
      .map(([, e]: [string, any]) => e);
    expect(messages.map((m: any) => m.recipientId).sort()).toEqual(['alice', 'bob', 'owner-1']);
    const owner = messages.find((m: any) => m.recipientId === 'owner-1');
    expect(owner.title).toBe('Tracker: 2 overdue tasks in Product Launch');
    expect(owner.body).toContain('LAU-1 Task 1 — due Sep 29, 2 days overdue');
    expect(owner.deepLink).toBe('tasks/proj-1');
    const alice = messages.find((m: any) => m.recipientId === 'alice');
    expect(alice.body).toContain('LAU-1');
    expect(alice.body).not.toContain('LAU-2');

    expect(ctx.delivery.postText).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'tracker-1' }),
      'chan-1',
      expect.stringContaining('2 overdue tasks'),
      'owner-1',
    );
    expect(ctx.prisma.agentExecutionLog.create).toHaveBeenCalled();
    expect(ctx.events.emit).toHaveBeenCalledWith(
      AppEvent.CoworkerMonitorTriggered,
      expect.objectContaining({ count: 2, check: 'overdue', projectId: 'proj-1', taskIds: ['1', '2'] }),
    );

    const saved = (ctx.config()['monitors'] as any[])[0];
    expect(saved.lastCheckedAt).toBe(NOW.toISOString());
    expect(saved.lastResult).toEqual({ count: 2, summary: '2 overdue tasks in Product Launch' });
  });

  it('only looks at what became overdue since the last check afterwards', async () => {
    await ctx.service.sweep(NOW);
    ctx.prisma.task.findMany.mockClear();
    const later = new Date(NOW.getTime() + 2 * 3_600_000);
    await ctx.service.sweep(later);
    const where = ctx.prisma.task.findMany.mock.calls[0][0].where;
    expect(where.AND[1].dueDate).toEqual({ gte: NOW, lt: later });
  });

  it('records a quiet check without notifying anyone', async () => {
    ctx.prisma.task.findMany.mockResolvedValue([]);
    await ctx.service.sweep(NOW);
    expect(ctx.events.emitAsync).not.toHaveBeenCalled();
    const saved = (ctx.config()['monitors'] as any[])[0];
    expect(saved.lastResult.count).toBe(0);
  });

  it('stops reporting for someone who left the workspace', async () => {
    ctx.prisma.workspaceMember.count.mockResolvedValue(0);
    await ctx.service.sweep(NOW);
    expect(ctx.prisma.task.findMany).not.toHaveBeenCalled();
    expect((ctx.config()['monitors'] as any[])[0].lastError).toMatch(/no longer in the workspace/);
  });

  it('explains an unknown project instead of watching the whole workspace', async () => {
    ctx.prisma.project.findFirst.mockResolvedValue(null);
    await ctx.service.sweep(NOW);
    expect(ctx.prisma.task.findMany).not.toHaveBeenCalled();
    expect((ctx.config()['monitors'] as any[])[0].lastError).toMatch(/No project matches/);
  });

  it('checks a monitor on demand', async () => {
    const result = await ctx.service.checkNow('ws-1', 'tracker-1', ctx.monitor.id);
    expect(result?.lastResult?.count).toBe(2);
    expect(await ctx.service.checkNow('ws-1', 'tracker-1', 'nope')).toBeNull();
  });
});
