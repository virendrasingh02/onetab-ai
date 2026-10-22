import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@org/api-cache';

/**
 * Deliver-then-delete store for user-targeted realtime events.
 *
 * A reliable event is parked here, keyed by recipient, *before* it is pushed
 * down any socket. It stays until the recipient's client explicitly acks it
 * (`POST /realtime/ack`), it expires, or it exhausts its delivery attempts —
 * and then the payload is deleted. Only a small payload-free status record
 * (`pending | delivered | expired | failed`) outlives it, for observability.
 *
 * Storage is one hash per user in the shared cache (Redis, or the in-memory
 * fallback), so every API node sees the same pending set, a reconnect to any
 * node can recover it, and an ack can only ever touch the acking user's own
 * hash. Payloads never go to the logs — only ids, counts and statuses do.
 */

export type DeliveryStatus = 'pending' | 'delivered' | 'expired' | 'failed';

export interface PendingDelivery {
  id: string;
  userId: string;
  workspaceId: string | null;
  type: string;
  /** The serialized SSE frame, exactly as it is sent. */
  data: string;
  createdAt: number;
  expiresAt: number;
  /** Times it has been pushed to a live connection. */
  attempts: number;
  nextAttemptAt: number;
}

export interface DeliveryStatusRecord {
  status: DeliveryStatus;
  userId: string;
  type: string;
  expiresAt: number;
  updatedAt: number;
  reason?: string;
}

export interface PendingDeliveryConfig {
  /** How long an undelivered event is kept before it expires. */
  ttlMs: number;
  /** Pushes to a live connection without an ack before giving up. */
  maxAttempts: number;
  retryBaseMs: number;
  retryMaxMs: number;
  /** Cap per recipient, so one never-acking user cannot grow without bound. */
  maxPendingPerUser: number;
  /** How long the payload-free status record survives a terminal state. */
  statusTtlMs: number;
}

export const DEFAULT_PENDING_DELIVERY_CONFIG: PendingDeliveryConfig = {
  ttlMs: 24 * 60 * 60_000,
  maxAttempts: 8,
  retryBaseMs: 2_000,
  retryMaxMs: 60_000,
  maxPendingPerUser: 500,
  statusTtlMs: 60 * 60_000,
};

/** Max ids accepted in one ack call. */
export const MAX_ACK_BATCH = 200;
const MAX_DELIVERY_ID_LENGTH = 128;

export function isValidDeliveryId(id: unknown): id is string {
  return (
    typeof id === 'string' &&
    id.length > 0 &&
    id.length <= MAX_DELIVERY_ID_LENGTH &&
    /^[A-Za-z0-9_:.-]+$/.test(id)
  );
}

/** Bounded exponential backoff with ±20% jitter. */
export function retryDelayMs(
  attempts: number,
  config: Pick<PendingDeliveryConfig, 'retryBaseMs' | 'retryMaxMs'>,
  random: () => number = Math.random,
): number {
  const exp = Math.min(
    config.retryBaseMs * Math.pow(2, Math.max(0, attempts - 1)),
    config.retryMaxMs,
  );
  const jitter = exp * 0.2 * (random() * 2 - 1);
  return Math.max(0, Math.round(exp + jitter));
}

function readNumber(
  config: ConfigService | undefined,
  key: string,
  fallback: number,
): number {
  const raw = config?.get<string | number>(key) ?? process.env[key];
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

@Injectable()
export class PendingDeliveryService {
  private readonly logger = new Logger(PendingDeliveryService.name);
  readonly config: PendingDeliveryConfig;

  constructor(
    private readonly cache: CacheService,
    @Optional() configService?: ConfigService,
  ) {
    const d = DEFAULT_PENDING_DELIVERY_CONFIG;
    this.config = {
      ttlMs: readNumber(configService, 'REALTIME_DELIVERY_TTL_MS', d.ttlMs),
      maxAttempts: readNumber(configService, 'REALTIME_DELIVERY_MAX_ATTEMPTS', d.maxAttempts),
      retryBaseMs: readNumber(configService, 'REALTIME_DELIVERY_RETRY_BASE_MS', d.retryBaseMs),
      retryMaxMs: readNumber(configService, 'REALTIME_DELIVERY_RETRY_MAX_MS', d.retryMaxMs),
      maxPendingPerUser: readNumber(
        configService,
        'REALTIME_DELIVERY_MAX_PENDING_PER_USER',
        d.maxPendingPerUser,
      ),
      statusTtlMs: readNumber(configService, 'REALTIME_DELIVERY_STATUS_TTL_MS', d.statusTtlMs),
    };
  }

  /** Test/ops hook to override retention without env vars. */
  configure(overrides: Partial<PendingDeliveryConfig>): void {
    Object.assign(this.config, overrides);
  }

  private pendingKey(userId: string): string {
    return `rt:pending:${userId}`;
  }

  private statusKey(id: string): string {
    return `rt:delivery:${id}`;
  }

  /**
   * Parks an event for `userId` until acked. Re-enqueueing the same id (a
   * retried domain event) overwrites the one entry instead of duplicating it.
   * Returns `failed` without storing when the recipient's queue is full —
   * nothing already pending is ever evicted to make room.
   */
  async enqueue(
    entry: Pick<PendingDelivery, 'id' | 'userId' | 'workspaceId' | 'type' | 'data'>,
    now = Date.now(),
  ): Promise<DeliveryStatus> {
    const key = this.pendingKey(entry.userId);
    const size = await this.cache.hashLen(key);
    if (size >= this.config.maxPendingPerUser) {
      this.logger.warn(
        `Pending delivery queue full for user ${entry.userId} (${size}); rejecting ${entry.type} ${entry.id}`,
      );
      await this.writeStatus(entry, 'failed', now + this.config.ttlMs, now, 'queue_full');
      return 'failed';
    }

    const pending: PendingDelivery = {
      ...entry,
      createdAt: now,
      expiresAt: now + this.config.ttlMs,
      attempts: 0,
      nextAttemptAt: now,
    };
    await this.cache.hashSet(key, entry.id, pending, {
      ttlMs: this.config.ttlMs + this.config.statusTtlMs,
    });
    await this.writeStatus(entry, 'pending', pending.expiresAt, now);
    return 'pending';
  }

  /**
   * Returns the recipient's deliveries that are due for a (re)send, and
   * finalizes the ones that expired or ran out of attempts (payload deleted,
   * status recorded). `includeNotDue` returns every live entry — used on a
   * fresh connection, which has seen none of them.
   */
  async collectDue(
    userId: string,
    options: { now?: number; includeNotDue?: boolean } = {},
  ): Promise<{ due: PendingDelivery[]; remaining: number }> {
    const now = options.now ?? Date.now();
    const all = await this.cache.hashGetAll<PendingDelivery>(this.pendingKey(userId));
    const due: PendingDelivery[] = [];
    let remaining = 0;

    for (const entry of Object.values(all)) {
      if (!entry || entry.userId !== userId) continue;
      if (now >= entry.expiresAt) {
        await this.finalize(entry, 'expired', now);
        continue;
      }
      if (entry.attempts >= this.config.maxAttempts) {
        await this.finalize(entry, 'failed', now, 'max_attempts');
        continue;
      }
      remaining++;
      if (options.includeNotDue || entry.nextAttemptAt <= now) due.push(entry);
    }

    due.sort((a, b) => a.createdAt - b.createdAt);
    return { due, remaining };
  }

  /**
   * Records one push to a live connection and schedules the next retry. A
   * no-op if the entry was acked meanwhile — it is never resurrected.
   */
  async recordAttempt(entry: PendingDelivery, now = Date.now()): Promise<boolean> {
    const attempts = entry.attempts + 1;
    const next: PendingDelivery = {
      ...entry,
      attempts,
      nextAttemptAt: now + retryDelayMs(attempts, this.config),
    };
    const stillPending = await this.cache.hashSet(this.pendingKey(entry.userId), entry.id, next, {
      onlyIfExists: true,
    });
    if (stillPending) Object.assign(entry, next);
    return stillPending;
  }

  /**
   * The recipient confirms it processed these deliveries. Only the caller's
   * own pending entries can be removed — an id belonging to anyone else is
   * simply not in this user's hash. Returns the ids actually removed.
   */
  async ack(userId: string, ids: string[], now = Date.now()): Promise<string[]> {
    const removed: string[] = [];
    const unique = Array.from(new Set(ids.filter(isValidDeliveryId))).slice(0, MAX_ACK_BATCH);
    const key = this.pendingKey(userId);
    for (const id of unique) {
      if (await this.cache.hashDel(key, id)) {
        removed.push(id);
        const prior = await this.cache.get<DeliveryStatusRecord>(this.statusKey(id));
        await this.cache.set<DeliveryStatusRecord>(
          this.statusKey(id),
          {
            status: 'delivered',
            userId,
            type: prior?.type ?? 'unknown',
            expiresAt: prior?.expiresAt ?? now,
            updatedAt: now,
          },
          this.config.statusTtlMs,
        );
      }
    }
    return removed;
  }

  /** Status for the recipient only; `null` for unknown ids or anyone else's. */
  async getStatus(
    userId: string,
    id: string,
    now = Date.now(),
  ): Promise<{ id: string; status: DeliveryStatus; type: string; updatedAt: number; reason?: string } | null> {
    if (!isValidDeliveryId(id)) return null;
    const record = await this.cache.get<DeliveryStatusRecord>(this.statusKey(id));
    if (!record || record.userId !== userId) return null;
    const status: DeliveryStatus =
      record.status === 'pending' && now >= record.expiresAt ? 'expired' : record.status;
    return { id, status, type: record.type, updatedAt: record.updatedAt, reason: record.reason };
  }

  async countPending(userId: string): Promise<number> {
    return this.cache.hashLen(this.pendingKey(userId));
  }

  private async finalize(
    entry: PendingDelivery,
    status: Exclude<DeliveryStatus, 'pending' | 'delivered'>,
    now: number,
    reason?: string,
  ): Promise<void> {
    if (await this.cache.hashDel(this.pendingKey(entry.userId), entry.id)) {
      await this.writeStatus(entry, status, entry.expiresAt, now, reason);
      this.logger.debug(`Delivery ${entry.id} (${entry.type}) for user ${entry.userId} ${status}`);
    }
  }

  private async writeStatus(
    entry: Pick<PendingDelivery, 'id' | 'userId' | 'type'>,
    status: DeliveryStatus,
    expiresAt: number,
    now: number,
    reason?: string,
  ): Promise<void> {
    const ttl =
      status === 'pending'
        ? Math.max(1, expiresAt - now) + this.config.statusTtlMs
        : this.config.statusTtlMs;
    await this.cache.set<DeliveryStatusRecord>(
      this.statusKey(entry.id),
      { status, userId: entry.userId, type: entry.type, expiresAt, updatedAt: now, reason },
      ttl,
    );
  }
}
