import { describe, expect, it, vi } from 'vitest';
import { AgentMatrixBridgeService } from './agent-matrix-bridge.service.js';

const ADA = {
  id: 'ada',
  type: 'coworker',
  workspaceId: 'ws-1',
  name: 'Ada',
  role: 'Analyst',
  model: 'm',
  provider: null,
  avatarUrl: null,
  matrixUserId: '@onetab_coworker-ada:hs',
};

function setup(history: unknown[] = []) {
  const prisma = {
    aIAgent: {
      // The room lookup (`matrixRoomId`) finds no agent DM; id lookups find Ada.
      findFirst: vi.fn(async ({ where }: { where: { id?: string } }) => (where.id ? ADA : null)),
      findMany: vi.fn().mockResolvedValue([ADA]),
    },
    channel: {
      findFirst: vi.fn().mockResolvedValue({ id: 'ch-1', name: 'general', workspaceId: 'ws-1' }),
      findUnique: vi.fn().mockResolvedValue({ id: 'ch-1', name: 'general', matrixRoomId: '!r:hs' }),
    },
    user: { findUnique: vi.fn().mockResolvedValue({ id: 'u-1' }) },
    workspaceMember: { count: vi.fn().mockResolvedValue(1) },
  };
  const admin = {
    joinRoomAs: vi.fn().mockResolvedValue(undefined),
    getRecentRoomEvents: vi.fn().mockResolvedValue(history),
  };
  const messaging = {
    sendStructured: vi.fn().mockResolvedValue('$bot'),
    updateStructured: vi.fn().mockResolvedValue(undefined),
  };
  const runtime = { executeTurn: vi.fn().mockResolvedValue({ result: 'hi', tools: [] }) };
  const followUps = { suggest: vi.fn().mockResolvedValue([]) };
  let handler!: (e: unknown) => Promise<boolean>;
  const router = { register: (h: typeof handler) => (handler = h) };
  const service = new AgentMatrixBridgeService(
    prisma as never,
    router as never,
    messaging as never,
    admin as never,
    runtime as never,
    followUps as never,
  );
  service.onModuleInit();
  return { service, handler: (e: unknown) => handler(e), runtime, admin };
}

const message = (body: string, extra: object = {}) => ({
  type: 'm.room.message',
  room_id: '!r:hs',
  event_id: '$e1',
  sender: '@viru:hs',
  origin_server_ts: Date.now(),
  content: { body },
  ...extra,
});

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('AgentMatrixBridgeService', () => {
  it('answers a mention with the mention stripped', async () => {
    const { handler, runtime } = setup();
    expect(await handler(message('@Ada Hi'))).toBe(true);
    await flush();
    expect(runtime.executeTurn).toHaveBeenCalledWith(
      'ws-1',
      'ada',
      'Hi',
      expect.objectContaining({ channelId: 'ch-1' }),
      expect.any(Function),
    );
  });

  it('answers a bare mention instead of ignoring it', async () => {
    const { handler, runtime } = setup();
    expect(await handler(message('@Ada'))).toBe(true);
    await flush();
    expect(runtime.executeTurn.mock.calls[0][2]).toMatch(/mentioned without a message/);
  });

  it('replays the latest unanswered mention once the entity is linked', async () => {
    const { service, runtime } = setup([
      message('thanks', { event_id: '$later' }),
      message('@Ada what is up?', { event_id: '$ask' }),
    ]);
    await service.onEntityLinked({
      workspaceId: 'ws-1',
      actorId: 'u-1',
      channelId: 'ch-1',
      entityId: 'ada',
      entityType: 'coworker',
    });
    expect(runtime.executeTurn).toHaveBeenCalledTimes(1);
    expect(runtime.executeTurn.mock.calls[0][2]).toBe('what is up?');
    expect(runtime.executeTurn.mock.calls[0][3]).toMatchObject({ threadRootId: '$ask' });
  });

  it('does not replay a mention the entity already answered', async () => {
    const { service, runtime } = setup([
      message('done', { sender: ADA.matrixUserId }),
      message('@Ada what is up?'),
    ]);
    await service.onEntityLinked({
      workspaceId: 'ws-1',
      actorId: null,
      channelId: 'ch-1',
      entityId: 'ada',
      entityType: 'coworker',
    });
    expect(runtime.executeTurn).not.toHaveBeenCalled();
  });
});
