import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppEvent } from '@org/api-common';
import { CoworkersService } from './coworkers.service.js';

function makeService() {
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
  };
  const entitiesService = {
    getEntity: vi.fn().mockResolvedValue({ id: 'coworker-1' }),
  } as any;
  const events = { emit: vi.fn() };
  const service = new CoworkersService(prisma, entitiesService, events as any);
  return { service, prisma, events };
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
      expect.objectContaining({ entityType: 'coworker' }),
    );
  });
});
