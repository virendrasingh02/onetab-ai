import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppEvent } from '@org/api-common';
import { CoworkersService } from './coworkers.service.js';

function makeService() {
  let agentConfig: Record<string, unknown> = {
    capabilities: ['Monitor tasks', 'Detect meaningful changes'],
    monitors: [],
  };

  const prisma: any = {
    channel: { findFirst: vi.fn().mockResolvedValue({ id: 'chan-1' }) },
    channelCoworker: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([
        { id: 'link-1', channelId: 'chan-1', coworkerId: 'coworker-1', isEnabled: true, addedById: 'admin-1', createdAt: new Date(), coworker: {} },
      ]),
    },
    aIAgent: {
      findFirst: vi.fn().mockImplementation(() =>
        Promise.resolve({
          id: 'coworker-1',
          name: 'Tracker',
          configuration: { ...agentConfig },
          schedules: [
            { id: 'sched-1', cronExpression: '0 9 * * *', description: 'Daily morning report', isActive: true },
          ],
        }),
      ),
      update: vi.fn().mockImplementation((args: any) => {
        if (args.data?.configuration) {
          agentConfig = { ...args.data.configuration };
        }
        return Promise.resolve({ id: 'coworker-1', configuration: agentConfig });
      }),
    },
  };
  const entitiesService = {
    getEntity: vi.fn().mockResolvedValue({ id: 'coworker-1' }),
    initializeDefaultCoworkers: vi.fn().mockResolvedValue([
      { id: 'coworker-scheduler', name: 'Scheduler' },
      { id: 'coworker-tracker', name: 'Tracker' },
    ]),
    createSchedule: vi.fn().mockImplementation((_wsId, _coworkerId, data) =>
      Promise.resolve({ id: 'sched-new', ...data, isActive: true }),
    ),
    updateSchedule: vi.fn().mockImplementation((_wsId, _coworkerId, schedId, data) =>
      Promise.resolve({ id: schedId, ...data }),
    ),
    deleteSchedule: vi.fn().mockResolvedValue({ success: true }),
  } as any;
  const events = { emit: vi.fn() };
  const service = new CoworkersService(prisma, entitiesService, events as any);
  return { service, prisma, entitiesService, events };
}

describe('CoworkersService — channel-coworker system/activity events (brief §3, §5, §22, §30)', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
  });

  it('emits ChannelAiEntityLinked(entityType: coworker) the first time a coworker is added', async () => {
    await ctx.service.addChannelCoworker('ws-1', 'chan-1', 'coworker-1', 'admin-1');

    expect(ctx.events.emit).toHaveBeenCalledWith(
      AppEvent.ChannelAiEntityLinked,
      expect.objectContaining({ entityId: 'coworker-1', entityType: 'coworker', actorId: 'admin-1' }),
    );
  });

  it('does not re-emit when the link already exists and is enabled', async () => {
    ctx.prisma.channelCoworker.findUnique.mockResolvedValue({ isEnabled: true });

    await ctx.service.addChannelCoworker('ws-1', 'chan-1', 'coworker-1', 'admin-1');

    expect(ctx.events.emit).not.toHaveBeenCalled();
  });

  it('emits ChannelAiEntityUnlinked only when a row was actually removed', async () => {
    ctx.prisma.channelCoworker.deleteMany.mockResolvedValue({ count: 0 });
    await ctx.service.removeChannelCoworker('ws-1', 'chan-1', 'coworker-1', 'admin-1');
    expect(ctx.events.emit).not.toHaveBeenCalled();

    ctx.prisma.channelCoworker.deleteMany.mockResolvedValue({ count: 1 });
    await ctx.service.removeChannelCoworker('ws-1', 'chan-1', 'coworker-1', 'admin-1');
    expect(ctx.events.emit).toHaveBeenCalledWith(
      AppEvent.ChannelAiEntityUnlinked,
      expect.objectContaining({ entityId: 'coworker-1', entityType: 'coworker' }),
    );
  });
});

describe('CoworkersService — idempotent workspace coworker initialization', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
  });

  it('delegates to entitiesService.initializeDefaultCoworkers idempotently', async () => {
    const result = await ctx.service.initializeDefaultCoworkers('ws-1', 'creator-1');

    expect(ctx.entitiesService.initializeDefaultCoworkers).toHaveBeenCalledWith('ws-1', 'creator-1');
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe('Scheduler');
    expect(result[1].name).toBe('Tracker');
  });
});

describe('CoworkersService — Tracker monitor CRUD', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
  });

  it('creates, lists, updates, and deletes monitors', async () => {
    // 1. Create
    const created = await ctx.service.createMonitor('ws-1', 'coworker-1', 'user-1', {
      name: 'Task Completion Monitor',
      type: 'TASK_STATUS',
      target: 'project-1',
      condition: 'status == DONE',
      intervalMinutes: 15,
      enabled: true,
    });

    expect(created.id).toBeDefined();
    expect(created.name).toBe('Task Completion Monitor');
    expect(ctx.prisma.aIAgent.update).toHaveBeenCalled();

    // 2. List
    const monitors = await ctx.service.listMonitors('ws-1', 'coworker-1');
    expect(monitors).toHaveLength(1);
    expect(monitors[0].name).toBe('Task Completion Monitor');

    // 3. Update
    const updated = await ctx.service.updateMonitor('ws-1', 'coworker-1', created.id, {
      condition: 'status == IN_PROGRESS',
      enabled: false,
    });
    expect(updated.condition).toBe('status == IN_PROGRESS');
    expect(updated.enabled).toBe(false);

    // 4. Delete
    await ctx.service.deleteMonitor('ws-1', 'coworker-1', created.id);
    const afterDelete = await ctx.service.listMonitors('ws-1', 'coworker-1');
    expect(afterDelete).toHaveLength(0);
  });
});

describe('CoworkersService — Scheduler schedule CRUD', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
  });

  it('lists existing schedules from coworker entity', async () => {
    const schedules = await ctx.service.listSchedules('ws-1', 'coworker-1');
    expect(schedules).toHaveLength(1);
    expect(schedules[0].cronExpression).toBe('0 9 * * *');
  });

  it('delegates createSchedule, updateSchedule, and deleteSchedule to entitiesService', async () => {
    const created = await ctx.service.createSchedule('ws-1', 'coworker-1', {
      cronExpression: '0 12 * * *',
      description: 'Daily midday sweep',
    });
    expect(ctx.entitiesService.createSchedule).toHaveBeenCalledWith('ws-1', 'coworker-1', {
      cronExpression: '0 12 * * *',
      description: 'Daily midday sweep',
    });
    expect(created.id).toBe('sched-new');

    const updated = await ctx.service.updateSchedule('ws-1', 'coworker-1', 'sched-new', {
      isActive: false,
    });
    expect(ctx.entitiesService.updateSchedule).toHaveBeenCalledWith(
      'ws-1',
      'coworker-1',
      'sched-new',
      { isActive: false },
    );
    expect(updated.isActive).toBe(false);

    await ctx.service.deleteSchedule('ws-1', 'coworker-1', 'sched-new');
    expect(ctx.entitiesService.deleteSchedule).toHaveBeenCalledWith(
      'ws-1',
      'coworker-1',
      'sched-new',
    );
  });
});
