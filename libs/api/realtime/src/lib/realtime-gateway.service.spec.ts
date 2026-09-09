import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Subject } from 'rxjs';
import { RealtimeGatewayService } from './realtime-gateway.service.js';

describe('RealtimeGatewayService', () => {
  let gateway: RealtimeGatewayService;
  let mockPrisma: any;
  let mockCache: any;

  beforeEach(() => {
    mockPrisma = {
      workspaceMember: {
        findMany: vi.fn().mockResolvedValue([
          { userId: 'user-1' },
          { userId: 'user-2' },
        ]),
      },
    };
    mockCache = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      del: vi.fn().mockResolvedValue(true),
      publish: vi.fn().mockResolvedValue(0),
      subscribe: vi.fn().mockResolvedValue(undefined),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
    };
    gateway = new RealtimeGatewayService(
      mockPrisma as any,
      mockCache as any,
    );
  });

  it('registers and unregisters clients', () => {
    const subject = new Subject<any>();
    gateway.registerClient('c1', 'user-1', 'ws-1', subject);

    expect(gateway.getConnectionCount()).toBe(1);

    gateway.unregisterClient('c1');
    expect(gateway.getConnectionCount()).toBe(0);
  });

  it('broadcasts events to authorized workspace members only', async () => {
    const s1 = new Subject<any>();
    const s2 = new Subject<any>();
    const received1: any[] = [];
    const received2: any[] = [];

    s1.subscribe((e) => received1.push(e));
    s2.subscribe((e) => received2.push(e));

    gateway.registerClient('c1', 'user-1', 'ws-1', s1);
    gateway.registerClient('c2', 'user-2', 'ws-1', s2);

    await gateway.broadcastToWorkspace('ws-1', {
      type: 'task.created',
      payload: { taskId: 't-1' },
    });

    expect(received1.length).toBe(1);
    expect(received2.length).toBe(1);
    expect(JSON.parse(received1[0].data).payload.taskId).toBe('t-1');
  });

  describe('reconnect replay buffer', () => {
    it('returns the events broadcast after a given lastEventId', async () => {
      const sink = new Subject<any>();
      gateway.registerClient('c1', 'user-1', 'ws-1', sink);

      await gateway.broadcastToWorkspace('ws-1', {
        id: 'evt-1',
        type: 'task.created',
        payload: { n: 1 },
      });
      await gateway.broadcastToWorkspace('ws-1', {
        id: 'evt-2',
        type: 'task.created',
        payload: { n: 2 },
      });
      await gateway.broadcastToWorkspace('ws-1', {
        id: 'evt-3',
        type: 'task.created',
        payload: { n: 3 },
      });

      const missed = gateway.getReplaySince('ws-1', 'evt-1');
      expect(missed.map((e) => JSON.parse(e.data as string).id)).toEqual([
        'evt-2',
        'evt-3',
      ]);
    });

    it('replays the whole buffer when the cursor is unknown', async () => {
      await gateway.broadcastToWorkspace('ws-1', {
        id: 'evt-a',
        type: 'x',
        payload: {},
      });
      const missed = gateway.getReplaySince('ws-1', 'evt-does-not-exist');
      expect(missed).toHaveLength(1);
    });

    it('returns nothing for a workspace with no recent events', () => {
      expect(gateway.getReplaySince('ws-empty', null)).toEqual([]);
    });

    it('does not leak one workspace’s events into another’s replay', async () => {
      await gateway.broadcastToWorkspace('ws-1', { id: 'w1', type: 'x', payload: {} });
      await gateway.broadcastToWorkspace('ws-2', { id: 'w2', type: 'x', payload: {} });
      const w2 = gateway.getReplaySince('ws-2', null);
      expect(w2.map((e) => JSON.parse(e.data as string).id)).toEqual(['w2']);
    });
  });
});
