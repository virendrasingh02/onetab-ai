import { beforeEach, describe, expect, it } from 'vitest';
import { CacheService } from '@org/api-cache';
import {
  PendingDeliveryService,
  isValidDeliveryId,
  retryDelayMs,
} from './pending-delivery.service.js';

/** A real CacheService that never connects, i.e. its in-memory fallback. */
function memoryCache(): CacheService {
  return new CacheService({ get: () => undefined } as any);
}

const entry = (id: string, userId = 'user-1') => ({
  id,
  userId,
  workspaceId: 'ws-1',
  type: 'notification.created',
  data: JSON.stringify({ id, secret: 'payload' }),
});

describe('PendingDeliveryService', () => {
  let cache: CacheService;
  let svc: PendingDeliveryService;
  const t0 = 1_000_000;

  beforeEach(() => {
    cache = memoryCache();
    svc = new PendingDeliveryService(cache);
    svc.configure({
      ttlMs: 60_000,
      maxAttempts: 3,
      retryBaseMs: 1_000,
      retryMaxMs: 8_000,
      maxPendingPerUser: 5,
      statusTtlMs: 60_000,
    });
  });

  it('keeps a delivery pending until the recipient acks, then deletes the payload', async () => {
    expect(await svc.enqueue(entry('d1'), t0)).toBe('pending');
    expect(await svc.countPending('user-1')).toBe(1);
    expect((await svc.getStatus('user-1', 'd1', t0))?.status).toBe('pending');

    expect(await svc.ack('user-1', ['d1'], t0 + 10)).toEqual(['d1']);
    expect(await svc.countPending('user-1')).toBe(0);
    const { due } = await svc.collectDue('user-1', { now: t0 + 20, includeNotDue: true });
    expect(due).toEqual([]);
    expect((await svc.getStatus('user-1', 'd1'))?.status).toBe('delivered');
  });

  it('survives an offline period: undelivered entries stay recoverable until expiry', async () => {
    await svc.enqueue(entry('d1'), t0);
    await svc.enqueue(entry('d2'), t0 + 1);
    const { due } = await svc.collectDue('user-1', { now: t0 + 30_000, includeNotDue: true });
    expect(due.map((d) => d.id)).toEqual(['d1', 'd2']);
  });

  it('expires undelivered entries per the retention policy (and only then)', async () => {
    await svc.enqueue(entry('d1'), t0);
    let res = await svc.collectDue('user-1', { now: t0 + 59_999 });
    expect(res.remaining).toBe(1);

    res = await svc.collectDue('user-1', { now: t0 + 60_000 });
    expect(res.remaining).toBe(0);
    expect(await svc.countPending('user-1')).toBe(0);
    expect((await svc.getStatus('user-1', 'd1', t0 + 60_000))?.status).toBe('expired');
  });

  it('reports a still-stored pending record as expired once past its deadline', async () => {
    await svc.enqueue(entry('d1'), t0);
    expect((await svc.getStatus('user-1', 'd1', t0 + 61_000))?.status).toBe('expired');
  });

  it('retries with bounded exponential backoff and fails after max attempts', async () => {
    await svc.enqueue(entry('d1'), t0);
    let now = t0;
    const gaps: number[] = [];
    for (let i = 0; i < 3; i++) {
      const { due } = await svc.collectDue('user-1', { now });
      expect(due).toHaveLength(1);
      await svc.recordAttempt(due[0], now);
      gaps.push(due[0].nextAttemptAt - now);
      // Not due again before its backoff.
      expect((await svc.collectDue('user-1', { now: now + 1 })).due).toHaveLength(0);
      now = due[0].nextAttemptAt;
    }
    // ~1s, ~2s, ~4s (±20% jitter), never above the cap.
    expect(gaps[0]).toBeGreaterThanOrEqual(800);
    expect(gaps[1]).toBeGreaterThan(gaps[0] * 1.2);
    expect(gaps.every((g) => g <= 8_000 * 1.2)).toBe(true);

    const res = await svc.collectDue('user-1', { now });
    expect(res.remaining).toBe(0);
    expect((await svc.getStatus('user-1', 'd1'))).toMatchObject({
      status: 'failed',
      reason: 'max_attempts',
    });
  });

  it('caps the backoff delay', () => {
    const cfg = { retryBaseMs: 1_000, retryMaxMs: 5_000 };
    expect(retryDelayMs(20, cfg, () => 0.5)).toBe(5_000);
    expect(retryDelayMs(1, cfg, () => 0.5)).toBe(1_000);
  });

  it('does not resurrect an entry acked while an attempt was in flight', async () => {
    await svc.enqueue(entry('d1'), t0);
    const { due } = await svc.collectDue('user-1', { now: t0 });
    await svc.ack('user-1', ['d1'], t0);
    expect(await svc.recordAttempt(due[0], t0)).toBe(false);
    expect(await svc.countPending('user-1')).toBe(0);
  });

  it('de-duplicates a re-enqueued id into one pending entry', async () => {
    await svc.enqueue(entry('d1'), t0);
    await svc.enqueue(entry('d1'), t0 + 5);
    expect(await svc.countPending('user-1')).toBe(1);
  });

  it('never lets one user ack, read, or see another user’s deliveries', async () => {
    await svc.enqueue(entry('d1', 'alice'), t0);
    expect(await svc.ack('mallory', ['d1'])).toEqual([]);
    expect(await svc.countPending('alice')).toBe(1);
    expect(await svc.getStatus('mallory', 'd1')).toBeNull();
    expect((await svc.collectDue('mallory', { includeNotDue: true })).due).toEqual([]);
  });

  it('rejects new entries when a user’s queue is full without evicting pending ones', async () => {
    for (let i = 0; i < 5; i++) await svc.enqueue(entry(`d${i}`), t0 + i);
    expect(await svc.enqueue(entry('d-over'), t0 + 10)).toBe('failed');
    expect(await svc.countPending('user-1')).toBe(5);
    expect(await svc.getStatus('user-1', 'd-over')).toMatchObject({
      status: 'failed',
      reason: 'queue_full',
    });
    // Other users are unaffected by user-1's full queue.
    expect(await svc.enqueue(entry('o1', 'user-2'), t0)).toBe('pending');
  });

  it('ignores malformed ack ids and is idempotent', async () => {
    await svc.enqueue(entry('d1'), t0);
    expect(await svc.ack('user-1', ['d1', 'd1', '../x', '' as string])).toEqual(['d1']);
    expect(await svc.ack('user-1', ['d1'])).toEqual([]);
    expect(isValidDeliveryId('ntf_abc-1')).toBe(true);
    expect(isValidDeliveryId('a b')).toBe(false);
    expect(isValidDeliveryId('x'.repeat(200))).toBe(false);
  });

  it('keeps payloads out of the status record', async () => {
    await svc.enqueue(entry('d1'), t0);
    await svc.ack('user-1', ['d1']);
    const status = await svc.getStatus('user-1', 'd1');
    expect(JSON.stringify(status)).not.toContain('secret');
  });
});
