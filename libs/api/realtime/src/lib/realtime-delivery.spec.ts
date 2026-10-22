import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { Subject } from 'rxjs';
import { CacheService } from '@org/api-cache';
import { PendingDeliveryService } from './pending-delivery.service.js';
import {
  RealtimeGatewayService,
  type ClientTransport,
  type SseMessageEvent,
} from './realtime-gateway.service.js';

/**
 * Gateway-level reliability: deliver-then-delete, retries, reconnect
 * recovery, per-user failure isolation, multi-node fan-out, and a
 * concurrent-connection load check. Uses a real (in-memory fallback)
 * CacheService so pending storage and pub/sub behave as on one Redis.
 */

function memoryCache(): CacheService {
  return new CacheService({ get: () => undefined } as any);
}

function makeNode(
  cache: CacheService,
  prisma: any,
  limits: Partial<RealtimeGatewayService['limits']> = {},
) {
  const deliveries = new PendingDeliveryService(cache);
  deliveries.configure({
    ttlMs: 60_000,
    maxAttempts: 3,
    retryBaseMs: 1_000,
    retryMaxMs: 8_000,
    maxPendingPerUser: 100,
  });
  const gateway = new RealtimeGatewayService(prisma, cache, deliveries);
  Object.assign(gateway.limits, limits);
  return { gateway, deliveries };
}

interface Sink {
  frames: Array<{ id?: string; type: string; payload: any; requiresAck?: boolean }>;
  subject: Subject<SseMessageEvent>;
}

function sink(): Sink {
  const subject = new Subject<SseMessageEvent>();
  const frames: Sink['frames'] = [];
  subject.subscribe((e) => {
    if (e.type === 'event') frames.push(JSON.parse(e.data as string));
  });
  return { frames, subject };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('Realtime reliable delivery', () => {
  let cache: CacheService;
  let prisma: any;
  let node: ReturnType<typeof makeNode>;

  beforeAll(() => Logger.overrideLogger(false));
  afterAll(() => Logger.overrideLogger(['log', 'error', 'warn', 'debug', 'verbose']));

  beforeEach(async () => {
    cache = memoryCache();
    prisma = {
      workspaceMember: {
        findMany: vi.fn().mockResolvedValue([{ userId: 'alice' }, { userId: 'bob' }]),
      },
    };
    node = makeNode(cache, prisma);
    await node.gateway.onModuleInit();
  });

  afterEach(() => node.gateway.onModuleDestroy());

  it('holds a delivery for an offline recipient and flushes it on connect', async () => {
    const { id } = await node.gateway.deliverToUser('alice', {
      type: 'notification.created',
      payload: { n: 1 },
    });
    expect(await node.deliveries.countPending('alice')).toBe(1);

    const a = sink();
    node.gateway.registerClient('a1', 'alice', 'ws-1', a.subject);
    expect(await node.gateway.flushPendingToClient('a1')).toBe(1);
    expect(a.frames).toHaveLength(1);
    expect(a.frames[0]).toMatchObject({ id, requiresAck: true, payload: { n: 1 } });

    // Sending to the socket is not delivery: still pending until acked.
    expect(await node.deliveries.countPending('alice')).toBe(1);
    expect(await node.deliveries.ack('alice', [id])).toEqual([id]);
    expect(await node.deliveries.countPending('alice')).toBe(0);
    expect((await node.deliveries.getStatus('alice', id))?.status).toBe('delivered');

    // A later reconnect does not see an acked delivery again.
    const a2 = sink();
    node.gateway.registerClient('a2', 'alice', 'ws-1', a2.subject);
    expect(await node.gateway.flushPendingToClient('a2')).toBe(0);
  });

  it('re-delivers an unacked event under the same id after a reconnect', async () => {
    const a = sink();
    node.gateway.registerClient('a1', 'alice', null, a.subject);
    const { id } = await node.gateway.deliverToUser('alice', { type: 'mention.created', payload: {} });
    expect(a.frames.map((f) => f.id)).toEqual([id]);

    node.gateway.unregisterClient('a1'); // dropped before acking
    const a2 = sink();
    node.gateway.registerClient('a2', 'alice', null, a2.subject);
    await node.gateway.flushPendingToClient('a2');
    expect(a2.frames.map((f) => f.id)).toEqual([id]); // same id → client de-dupes
  });

  it('retries unacked deliveries with backoff, then marks them failed', async () => {
    const a = sink();
    node.gateway.registerClient('a1', 'alice', null, a.subject);
    const { id } = await node.gateway.deliverToUser('alice', { type: 'x', payload: {} });
    await tick(); // first push's attempt is recorded asynchronously

    const t = Date.now();
    await node.gateway.sweepPendingDeliveries(t + 100); // backoff not elapsed
    expect(a.frames).toHaveLength(1);

    await node.gateway.sweepPendingDeliveries(t + 2_000); // ~1s backoff elapsed
    expect(a.frames).toHaveLength(2);
    await node.gateway.sweepPendingDeliveries(t + 10_000);
    expect(a.frames).toHaveLength(3);

    // maxAttempts (3) exhausted — finalized, not retried forever.
    await node.gateway.sweepPendingDeliveries(t + 30_000); // well inside retention
    expect(a.frames).toHaveLength(3);
    expect((await node.deliveries.getStatus('alice', id))?.status).toBe('failed');
    expect(node.gateway.hasPendingTracked('alice')).toBe(false);
  });

  it('stops retrying once acked', async () => {
    const a = sink();
    node.gateway.registerClient('a1', 'alice', null, a.subject);
    const { id } = await node.gateway.deliverToUser('alice', { type: 'x', payload: {} });
    await node.deliveries.ack('alice', [id]);
    await node.gateway.sweepPendingDeliveries(Date.now() + 30_000);
    expect(a.frames).toHaveLength(1);
  });

  it('expires an undelivered event per retention and never flushes it afterwards', async () => {
    const { id } = await node.gateway.deliverToUser('alice', { type: 'x', payload: {} });
    node.deliveries.configure({ ttlMs: 0 });
    // Retention is fixed at enqueue time; simulate the clock passing it.
    const res = await node.deliveries.collectDue('alice', { now: Date.now() + 61_000 });
    expect(res.remaining).toBe(0);
    expect((await node.deliveries.getStatus('alice', id))?.status).toBe('expired');
  });

  it('a duplicate domain event with the same id notifies once', async () => {
    const a = sink();
    await node.gateway.deliverToUser('alice', { id: 'ntf_1', type: 'notification.created', payload: {} });
    await node.gateway.deliverToUser('alice', { id: 'ntf_1', type: 'notification.created', payload: {} });
    expect(await node.deliveries.countPending('alice')).toBe(1);
    node.gateway.registerClient('a1', 'alice', null, a.subject);
    await node.gateway.flushPendingToClient('a1');
    expect(a.frames.map((f) => f.id)).toEqual(['ntf_1']);
  });

  it('never routes one user’s delivery to another user’s connection', async () => {
    const a = sink();
    const b = sink();
    node.gateway.registerClient('a1', 'alice', 'ws-1', a.subject);
    node.gateway.registerClient('b1', 'bob', 'ws-1', b.subject);
    const { id } = await node.gateway.deliverToUser('alice', { type: 'x', payload: { secret: 1 } });
    await node.gateway.flushPendingToClient('b1');
    expect(a.frames.map((f) => f.id)).toEqual([id]);
    expect(b.frames).toEqual([]);
    // Bob cannot ack Alice's delivery away.
    expect(await node.deliveries.ack('bob', [id])).toEqual([]);
    expect(await node.deliveries.countPending('alice')).toBe(1);
  });

  describe('per-user failure isolation', () => {
    it('a connection whose push throws does not block other users', async () => {
      const broken = { next: () => { throw new Error('socket exploded'); }, complete: () => undefined };
      const b = sink();
      node.gateway.registerClient('a1', 'alice', 'ws-1', broken as any);
      node.gateway.registerClient('b1', 'bob', 'ws-1', b.subject);
      await node.gateway.broadcastToWorkspace('ws-1', { type: 'task.created', payload: {} });
      await node.gateway.deliverToUser('bob', { type: 'x', payload: {} });
      expect(b.frames).toHaveLength(2);
    });

    it('drops a stalled consumer (backpressure) without affecting others', async () => {
      const a = sink();
      const b = sink();
      const close = vi.fn();
      const stalled: ClientTransport = { bufferedBytes: () => 10 * 1024 * 1024, close };
      node.gateway.registerClient('a1', 'alice', 'ws-1', a.subject, stalled);
      node.gateway.registerClient('b1', 'bob', 'ws-1', b.subject, { bufferedBytes: () => 0, close: vi.fn() });

      await node.gateway.broadcastToWorkspace('ws-1', { type: 'task.created', payload: {} });
      expect(close).toHaveBeenCalledTimes(1);
      expect(a.frames).toHaveLength(0);
      expect(b.frames).toHaveLength(1);
      expect(node.gateway.getConnectionCount()).toBe(1);
    });

    it('one user’s pending-store failure does not stop other users’ retries', async () => {
      const a = sink();
      const b = sink();
      node.gateway.registerClient('a1', 'alice', null, a.subject);
      node.gateway.registerClient('b1', 'bob', null, b.subject);
      await node.gateway.deliverToUser('alice', { type: 'x', payload: {} });
      await node.gateway.deliverToUser('bob', { type: 'x', payload: {} });
      await tick();

      const real = cache.hashGetAll.bind(cache);
      vi.spyOn(cache, 'hashGetAll').mockImplementation(async (key: string) => {
        if (key.includes('alice')) throw new Error('store down for alice');
        return real(key);
      });
      await node.gateway.sweepPendingDeliveries(Date.now() + 5_000);
      expect(b.frames).toHaveLength(2);
      expect(a.frames).toHaveLength(1);
    });

    it('evicts a user’s oldest connection beyond their cap, leaving others alone', () => {
      node.gateway.limits.maxConnectionsPerUser = 2;
      const closes = [vi.fn(), vi.fn(), vi.fn()];
      ['a1', 'a2', 'a3'].forEach((id, i) =>
        node.gateway.registerClient(id, 'alice', null, sink().subject, { bufferedBytes: () => 0, close: closes[i] }),
      );
      node.gateway.registerClient('b1', 'bob', null, sink().subject);
      expect(closes[0]).toHaveBeenCalled();
      expect(closes[1]).not.toHaveBeenCalled();
      expect(node.gateway.getConnectionCount()).toBe(3);
    });

    it('refuses new connections at node capacity with 503', () => {
      node.gateway.limits.maxConnections = 1;
      node.gateway.registerClient('a1', 'alice', null, sink().subject);
      expect(() => node.gateway.assertCapacity()).toThrow(ServiceUnavailableException);
    });

    it('a failed cross-node dispatch never becomes an unhandled rejection', async () => {
      const unhandled = vi.fn();
      process.on('unhandledRejection', unhandled);
      try {
        const nodeB = makeNode(cache, {
          workspaceMember: { findMany: vi.fn().mockRejectedValue(new Error('db blip')) },
        });
        await nodeB.gateway.onModuleInit();
        nodeB.gateway.registerClient('b1', 'bob', 'ws-1', sink().subject);
        await node.gateway.broadcastToWorkspace('ws-1', { type: 'x', payload: {} });
        await new Promise((r) => setTimeout(r, 20));
        nodeB.gateway.onModuleDestroy();
        expect(unhandled).not.toHaveBeenCalled();
      } finally {
        process.off('unhandledRejection', unhandled);
      }
    });
  });

  describe('multi-node', () => {
    it('frames a workspace event with the same id on every node', async () => {
      const nodeB = makeNode(cache, prisma);
      await nodeB.gateway.onModuleInit();
      const b = sink();
      nodeB.gateway.registerClient('b1', 'bob', 'ws-1', b.subject);

      await node.gateway.broadcastToWorkspace('ws-1', { type: 'task.created', payload: {} });
      await tick();
      const originId = JSON.parse(node.gateway.getReplaySince('ws-1', null)[0].data as string).id;
      expect(b.frames[0].id).toBe(originId);
      // So a cursor from node A is understood by node B: nothing to replay.
      expect(nodeB.gateway.getReplaySince('ws-1', originId)).toEqual([]);
      nodeB.gateway.onModuleDestroy();
    });

    it('delivers to a user connected on another node, and an ack there clears it everywhere', async () => {
      const nodeB = makeNode(cache, prisma);
      await nodeB.gateway.onModuleInit();
      const b = sink();
      nodeB.gateway.registerClient('a-on-b', 'alice', null, b.subject);

      const { id } = await node.gateway.deliverToUser('alice', { type: 'x', payload: {} });
      expect(b.frames.map((f) => f.id)).toEqual([id]);
      expect(nodeB.gateway.hasPendingTracked('alice')).toBe(true);

      await nodeB.deliveries.ack('alice', [id]);
      expect(await node.deliveries.countPending('alice')).toBe(0);
      nodeB.gateway.onModuleDestroy();
    });
  });

  it('handles thousands of concurrent connections with isolated per-user delivery', async () => {
    const USERS = 1_000;
    const TABS = 5;
    node.gateway.limits.maxConnections = USERS * TABS;
    node.deliveries.configure({ maxPendingPerUser: 10 });
    prisma.workspaceMember.findMany.mockResolvedValue(
      Array.from({ length: USERS }, (_, u) => ({ userId: `u${u}` })),
    );

    const sinks = new Map<string, Sink[]>();
    for (let u = 0; u < USERS; u++) {
      const userSinks: Sink[] = [];
      for (let t = 0; t < TABS; t++) {
        const s = sink();
        node.gateway.registerClient(`u${u}-t${t}`, `u${u}`, 'ws-1', s.subject);
        userSinks.push(s);
      }
      sinks.set(`u${u}`, userSinks);
    }
    expect(node.gateway.getConnectionCount()).toBe(USERS * TABS);

    const startBroadcast = performance.now();
    await node.gateway.broadcastToWorkspace('ws-1', { type: 'task.created', payload: {} });
    const broadcastMs = performance.now() - startBroadcast;

    const startDeliver = performance.now();
    const results = await Promise.all(
      Array.from({ length: USERS }, (_, u) =>
        node.gateway.deliverToUser(`u${u}`, { type: 'x', payload: { to: `u${u}` } }),
      ),
    );
    const deliverMs = performance.now() - startDeliver;

    // Every tab got exactly the workspace event + its own user's delivery.
    for (const [userId, userSinks] of sinks) {
      for (const s of userSinks) {
        expect(s.frames).toHaveLength(2);
        expect(s.frames[1].payload.to).toBe(userId);
      }
    }

    await Promise.all(results.map((r, u) => node.deliveries.ack(`u${u}`, [r.id])));
    const pending = await Promise.all(
      Array.from({ length: USERS }, (_, u) => node.deliveries.countPending(`u${u}`)),
    );
    expect(pending.every((n) => n === 0)).toBe(true);

    for (let u = 0; u < USERS; u++) for (let t = 0; t < TABS; t++) node.gateway.unregisterClient(`u${u}-t${t}`);
    expect(node.gateway.getConnectionCount()).toBe(0);

    console.info(
      `[capacity] ${USERS * TABS} connections: workspace fan-out ${broadcastMs.toFixed(1)}ms, ` +
        `${USERS} reliable deliveries ${deliverMs.toFixed(1)}ms (in-memory store)`,
    );
    expect(broadcastMs).toBeLessThan(2_000);
  });
});
