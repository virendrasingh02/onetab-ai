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
    {} as any,
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

describe('AgentsService.checkReadiness — what the live environment lacks', () => {
  const graph = (nodes: Array<{ id: string; type: string; config?: Record<string, unknown> }>) =>
    JSON.stringify({
      nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: { x: 0, y: 0 }, data: { label: n.id, config: n.config ?? {} } })),
      edges: nodes.slice(1).map((n, i) => ({ id: `e${i}`, source: nodes[i].id, target: n.id })),
    });

  function setup(opts: { modelOk: boolean; connected: boolean }) {
    const prisma: any = { aIAgent: { findFirst: vi.fn().mockResolvedValue({ id: 'a1', graphJson: null, provider: 'openai', model: 'gpt-4o' }) } };
    const runtime: any = { modelReadiness: vi.fn().mockResolvedValue({ ok: opts.modelOk, provider: 'openai', model: 'gpt-4o' }) };
    const registry: any = { getToolDefinitions: () => [{ name: 'list_tasks' }] };
    const bridge: any = {
      getConnectionStatus: vi.fn().mockImplementation(async (_w: string, _a: string, _u: string, providers: string[]) =>
        providers.map((p) => ({ provider: p, label: p, connected: opts.connected, shared: false })),
      ),
    };
    return { service: new AgentsService(prisma, {} as any, runtime, registry, { emit: vi.fn() } as any, bridge), bridge };
  }

  it('is clean when the tool exists, the app is connected and the model has a key', async () => {
    const { service } = setup({ modelOk: true, connected: true });
    const g = graph([
      { id: 't', type: 'TRIGGER_SCHEDULE', config: { cron: '0 18 * * *' } },
      { id: 'tool', type: 'MCP_TOOL', config: { toolName: 'list_tasks' } },
    ]);
    expect(await service.checkReadiness('w', 'a1', 'u', g)).toEqual([]);
  });

  it('flags an unknown tool and a disconnected app on the step that uses them', async () => {
    const { service } = setup({ modelOk: true, connected: false });
    const g = graph([
      { id: 't', type: 'TRIGGER_SCHEDULE', config: { cron: '0 18 * * *' } },
      { id: 'bad', type: 'MCP_TOOL', config: { toolName: 'nope_tool' } },
      { id: 'slack', type: 'MCP_TOOL', config: { toolName: 'SLACK.send_message' } },
    ]);
    const checks = await service.checkReadiness('w', 'a1', 'u', g);
    expect(checks).toContainEqual(expect.objectContaining({ nodeId: 'bad', code: 'UNKNOWN_TOOL', level: 'error' }));
    expect(checks).toContainEqual(expect.objectContaining({ nodeId: 'slack', code: 'NOT_CONNECTED', connect: 'SLACK' }));
  });

  it('flags an agent whose model has no key', async () => {
    const { service } = setup({ modelOk: false, connected: true });
    const g = graph([
      { id: 't', type: 'TRIGGER_SCHEDULE', config: { cron: '0 18 * * *' } },
      { id: 'ag', type: 'AGENT', config: { instructions: 'Summarise.' } },
    ]);
    const checks = await service.checkReadiness('w', 'a1', 'u', g);
    expect(checks).toContainEqual(expect.objectContaining({ nodeId: 'ag', code: 'MODEL_UNAVAILABLE', level: 'error' }));
  });
});
