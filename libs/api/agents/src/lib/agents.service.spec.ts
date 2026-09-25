import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppEvent } from '@org/api-common';
import { AgentsService } from './agents.service.js';

function makeService() {
  const prisma: any = {
    channel: { findFirst: vi.fn().mockResolvedValue({ id: 'chan-1' }) },
    aIAgent: { findFirst: vi.fn().mockResolvedValue({ id: 'agent-1' }) },
    channelAgent: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue(undefined),
      update: vi.fn().mockResolvedValue(undefined),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };
  const entitiesService = {} as any;
  const runtimeService = {} as any;
  const mcpRegistry = {} as any;
  const events = { emit: vi.fn() };
  const service = new AgentsService(
    prisma,
    entitiesService,
    runtimeService,
    mcpRegistry,
    events as any,
  );
  return { service, prisma, events };
}

describe('AgentsService — channel-agent system/activity events (brief §3, §22, §30)', () => {
  let ctx: ReturnType<typeof makeService>;

  beforeEach(() => {
    ctx = makeService();
  });

  it('emits ChannelAiEntityLinked(entityType: agent) the first time an agent is added', async () => {
    await ctx.service.addChannelAgent('ws-1', 'chan-1', 'agent-1', 'admin-1');

    expect(ctx.events.emit).toHaveBeenCalledWith(
      AppEvent.ChannelAiEntityLinked,
      expect.objectContaining({
        workspaceId: 'ws-1',
        actorId: 'admin-1',
        channelId: 'chan-1',
        entityId: 'agent-1',
        entityType: 'agent',
      }),
    );
  });

  it('does not re-emit when the link already exists and is enabled (brief §30 — no duplicate)', async () => {
    ctx.prisma.channelAgent.findUnique.mockResolvedValue({ isEnabled: true });

    await ctx.service.addChannelAgent('ws-1', 'chan-1', 'agent-1', 'admin-1');

    expect(ctx.events.emit).not.toHaveBeenCalled();
  });

  it('emits ChannelAiEntityEnabledChanged(isEnabled: true) when re-adding a disabled link', async () => {
    ctx.prisma.channelAgent.findUnique.mockResolvedValue({ isEnabled: false });

    await ctx.service.addChannelAgent('ws-1', 'chan-1', 'agent-1', 'admin-1');

    expect(ctx.events.emit).toHaveBeenCalledWith(
      AppEvent.ChannelAiEntityEnabledChanged,
      expect.objectContaining({ entityType: 'agent', isEnabled: true }),
    );
  });

  it('emits ChannelAiEntityEnabledChanged only when the enabled flag actually flips', async () => {
    ctx.prisma.channelAgent.findUnique.mockResolvedValue({ id: 'link-1', isEnabled: true });

    await ctx.service.setChannelAgentEnabled('ws-1', 'chan-1', 'agent-1', true, 'admin-1');
    expect(ctx.events.emit).not.toHaveBeenCalled();

    await ctx.service.setChannelAgentEnabled('ws-1', 'chan-1', 'agent-1', false, 'admin-1');
    expect(ctx.events.emit).toHaveBeenCalledWith(
      AppEvent.ChannelAiEntityEnabledChanged,
      expect.objectContaining({ isEnabled: false }),
    );
  });

  it('emits ChannelAiEntityUnlinked only when a row was actually removed', async () => {
    ctx.prisma.channelAgent.deleteMany.mockResolvedValue({ count: 0 });
    await ctx.service.removeChannelAgent('ws-1', 'chan-1', 'agent-1', 'admin-1');
    expect(ctx.events.emit).not.toHaveBeenCalled();

    ctx.prisma.channelAgent.deleteMany.mockResolvedValue({ count: 1 });
    await ctx.service.removeChannelAgent('ws-1', 'chan-1', 'agent-1', 'admin-1');
    expect(ctx.events.emit).toHaveBeenCalledWith(
      AppEvent.ChannelAiEntityUnlinked,
      expect.objectContaining({ entityType: 'agent', entityId: 'agent-1' }),
    );
  });
});
