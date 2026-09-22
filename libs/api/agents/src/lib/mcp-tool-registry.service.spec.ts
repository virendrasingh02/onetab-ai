import { describe, expect, it, vi } from 'vitest';
import { MCPToolRegistryService } from './mcp-tool-registry.service.js';

/**
 * Focused coverage for the `send_channel_message` tool — the one write tool
 * that speaks in chat as the bot, so its guard rails matter.
 */
function makeRegistry(overrides?: {
  channel?: { id: string; name: string; matrixRoomId: string | null } | null;
  member?: { id: string } | null;
}) {
  const joinRoomAs = vi.fn().mockResolvedValue(undefined);
  const sendText = vi.fn().mockResolvedValue('$evt:server');

  const prisma = {
    workspaceMember: {
      findFirst: vi
        .fn()
        .mockResolvedValue(
          overrides?.member === undefined ? { id: 'wm_1' } : overrides.member,
        ),
    },
    channel: {
      findFirst: vi
        .fn()
        .mockResolvedValue(
          overrides?.channel === undefined
            ? { id: 'ch_1', name: 'general', matrixRoomId: '!room:server' }
            : overrides.channel,
        ),
    },
    aIMemory: {
      upsert: vi.fn().mockResolvedValue({ id: 'mem_1' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
  };

  const registry = new MCPToolRegistryService(
    prisma as never,
    { joinRoomAs } as never,
    { sendText } as never,
  );

  const run = (params: unknown, ctx: Record<string, unknown>) =>
    registry.executeTool('send_channel_message', params, {
      workspaceId: 'ws_1',
      actingUserId: 'user_1',
      agentMatrixUserId: '@onetab_agent-a1:server',
      ...ctx,
    } as never);

  return { registry, run, joinRoomAs, sendText, prisma };
}

describe('send_channel_message tool', () => {
  it('rejects a missing channelSlug or messageText', async () => {
    const { run } = makeRegistry();
    await expect(run({ messageText: 'hi' }, {})).rejects.toThrow(/required/i);
    await expect(run({ channelSlug: 'general' }, {})).rejects.toThrow(/required/i);
  });

  it('refuses when the agent has no chat identity yet', async () => {
    const { run } = makeRegistry();
    await expect(
      run({ channelSlug: 'general', messageText: 'hi' }, {
        agentMatrixUserId: null,
      }),
    ).rejects.toThrow(/no chat identity/i);
  });

  it('refuses a channel the acting user is not a member of', async () => {
    const { run } = makeRegistry({ channel: null });
    await expect(
      run({ channelSlug: 'secret', messageText: 'hi' }, {}),
    ).rejects.toThrow(/not a member/i);
  });

  it('refuses a channel with no linked Matrix room', async () => {
    const { run } = makeRegistry({
      channel: { id: 'ch_1', name: 'general', matrixRoomId: null },
    });
    await expect(
      run({ channelSlug: 'general', messageText: 'hi' }, {}),
    ).rejects.toThrow(/not linked to a chat room/i);
  });

  it('joins the room then posts as the agent bot on the happy path', async () => {
    const { run, joinRoomAs, sendText } = makeRegistry();
    const result = await run(
      { channelSlug: 'general', messageText: '  hello team  ' },
      {},
    );

    expect(joinRoomAs).toHaveBeenCalledWith(
      '@onetab_agent-a1:server',
      '!room:server',
    );
    expect(sendText).toHaveBeenCalledWith(
      '!room:server',
      '@onetab_agent-a1:server',
      'hello team',
    );
    expect(result).toEqual({
      delivered: true,
      channel: 'general',
      eventId: '$evt:server',
    });
  });
});

describe('save_memory / list_memory tools', () => {
  it('upserts a fact by key', async () => {
    const { registry, prisma } = makeRegistry();
    const result = await registry.executeTool(
      'save_memory',
      { key: 'preferred_deploy_day', value: 'Tuesdays' },
      { workspaceId: 'ws_1', actingUserId: 'user_1' } as never,
    );

    expect(prisma.aIMemory.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { workspaceId_key: { workspaceId: 'ws_1', key: 'preferred_deploy_day' } },
      }),
    );
    expect(result).toEqual({ saved: true, key: 'preferred_deploy_day' });
  });

  it('rejects a missing key or value', async () => {
    const { registry } = makeRegistry();
    await expect(
      registry.executeTool('save_memory', { key: 'x' }, { workspaceId: 'ws_1', actingUserId: 'user_1' } as never),
    ).rejects.toThrow(/required/i);
  });

  it('lists saved memory for the workspace', async () => {
    const { registry, prisma } = makeRegistry();
    prisma.aIMemory.findMany.mockResolvedValue([
      { key: 'preferred_deploy_day', value: 'Tuesdays', updatedAt: new Date() },
    ]);

    const result = await registry.executeTool(
      'list_memory',
      {},
      { workspaceId: 'ws_1', actingUserId: 'user_1' } as never,
    );

    expect(result).toHaveLength(1);
    expect(prisma.aIMemory.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: 'ws_1' } }),
    );
  });
});
