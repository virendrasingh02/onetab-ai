import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { type RedisOptions } from 'ioredis';
import { generateId } from '@org/utils';

export interface CacheEntry<T = unknown> {
  value: T;
  expiresAt?: number;
}

export interface CacheStatus {
  mode: 'redis' | 'memory';
  /** Connection URL with any password masked — safe to log or return. */
  url: string;
  latencyMs: number | null;
  subscriber: boolean;
}

/** Max backoff between reconnect attempts. Reconnects never stop for good. */
const MAX_RECONNECT_DELAY_MS = 30_000;
/** A stalled Redis must fail fast (and fall back) rather than hang requests. */
const COMMAND_TIMEOUT_MS = 2_000;
const MEMORY_SWEEP_INTERVAL_MS = 60_000;

/** Masks the password in a Redis URL so it never reaches logs or health output. */
function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '***';
    return parsed.toString();
  } catch {
    return '<invalid REDIS_URL>';
  }
}

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redisClient: Redis | null = null;
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private isConnected = false;
  private isSubConnected = false;
  /** Whether the primary client was ever ready — drives "lost"/"recovered" logs. */
  private hasBeenReady = false;
  private sweepTimer: NodeJS.Timeout | null = null;

  // Resilient in-memory fallback store when Redis is unavailable or in test mode
  private readonly inMemoryStore = new Map<string, CacheEntry>();
  private readonly inMemoryQueues = new Map<string, unknown[]>();
  private readonly localSubscribers = new Map<string, Set<(message: string) => void>>();

  private readonly redisUrl: string;
  private readonly safeUrl: string;
  private readonly keyPrefix: string;

  constructor(private readonly config: ConfigService) {
    this.redisUrl =
      this.config.get<string>('REDIS_URL') ??
      process.env['REDIS_URL'] ??
      'redis://localhost:6379';
    this.keyPrefix =
      this.config.get<string>('REDIS_KEY_PREFIX') ??
      process.env['REDIS_KEY_PREFIX'] ??
      'onetab:';
    this.safeUrl = redactUrl(this.redisUrl);
  }

  async onModuleInit(): Promise<void> {
    this.sweepTimer = setInterval(() => this.sweepMemory(), MEMORY_SWEEP_INTERVAL_MS);
    this.sweepTimer.unref();
    await this.initRedis();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
    this.sweepTimer = null;
    await this.disconnect();
  }

  private async initRedis(): Promise<void> {
    try {
      const redisOptions: RedisOptions = {
        maxRetriesPerRequest: 1,
        // Keep retrying with capped backoff: a Redis that comes back after a
        // long outage is picked up again instead of leaving this replica stuck
        // on the per-process fallback until restart.
        retryStrategy: (times) => Math.min(times * 200, MAX_RECONNECT_DELAY_MS),
        // Fail commands immediately while disconnected; callers fall back to
        // the in-memory store rather than waiting on a queued command.
        enableOfflineQueue: false,
        commandTimeout: COMMAND_TIMEOUT_MS,
        connectTimeout: 5_000,
        enableReadyCheck: true,
        lazyConnect: true,
      };

      this.redisClient = new Redis(this.redisUrl, redisOptions);
      this.pubClient = new Redis(this.redisUrl, redisOptions);
      this.subClient = new Redis(this.redisUrl, redisOptions);

      this.redisClient.on('ready', () => {
        this.isConnected = true;
        this.logger.log(
          this.hasBeenReady
            ? `Redis connection recovered (${this.safeUrl}). Distributed cache re-enabled.`
            : `Redis primary client connected (${this.safeUrl})`,
        );
        this.hasBeenReady = true;
      });

      this.redisClient.on('close', () => {
        if (this.isConnected) {
          this.logger.warn(
            `Redis connection lost (${this.safeUrl}). Falling back to in-memory store while reconnecting.`,
          );
        }
        this.isConnected = false;
      });

      this.redisClient.on('error', () => {
        // State changes are tracked on ready/close; reconnect errors repeat
        // every attempt, so they are not logged individually.
      });

      this.pubClient.on('error', () => {
        // Suppress unhandled event error when offline
      });

      this.subClient.on('ready', () => {
        this.isSubConnected = true;
        void this.resubscribeAll();
      });

      this.subClient.on('close', () => {
        this.isSubConnected = false;
      });

      this.subClient.on('error', () => {
        // Suppress unhandled event error when offline
      });

      this.subClient.on('message', (channel: string, message: string) => {
        const subscribers = this.localSubscribers.get(channel);
        if (subscribers) {
          for (const handler of subscribers) {
            try {
              handler(message);
            } catch (err) {
              this.logger.error(`Error in subscriber handler for channel "${channel}":`, err);
            }
          }
        }
      });

      await Promise.allSettled([
        this.redisClient.connect(),
        this.pubClient.connect(),
        this.subClient.connect(),
      ]);
      if (!this.isConnected) {
        this.logger.warn(
          `Could not connect to Redis at startup (${this.safeUrl}). Using in-memory fallback; will keep retrying in the background.`,
        );
      }
    } catch {
      this.logger.warn(
        `Could not connect to Redis at startup (${this.safeUrl}). CacheService will operate with resilient in-memory fallback.`,
      );
      this.isConnected = false;
    }
  }

  /**
   * Re-subscribes every channel that has local handlers. Covers channels
   * registered while the subscriber was offline — ioredis only restores
   * subscriptions it actually made.
   */
  private async resubscribeAll(): Promise<void> {
    const channels = [...this.localSubscribers.keys()];
    if (!this.subClient || channels.length === 0) return;
    try {
      await this.subClient.subscribe(...channels);
    } catch (err) {
      this.logger.warn('Redis resubscribe failed.', err);
    }
  }

  /** Drops expired fallback entries so an outage can't grow memory without bound. */
  private sweepMemory(): void {
    const now = Date.now();
    for (const [key, entry] of this.inMemoryStore) {
      if (entry.expiresAt && now > entry.expiresAt) this.inMemoryStore.delete(key);
    }
  }

  /**
   * Health and connectivity status for readiness checks.
   */
  async ping(): Promise<boolean> {
    if (!this.isConnected || !this.redisClient) {
      return false;
    }
    try {
      const response = await this.redisClient.ping();
      return response === 'PONG';
    } catch {
      return false;
    }
  }

  isRedisActive(): boolean {
    return this.isConnected;
  }

  /** Connection snapshot for readiness/health endpoints. */
  async status(): Promise<CacheStatus> {
    const started = Date.now();
    const up = await this.ping();
    return {
      mode: up ? 'redis' : 'memory',
      url: this.safeUrl,
      latencyMs: up ? Date.now() - started : null,
      subscriber: this.isSubConnected,
    };
  }

  private formatKey(key: string): string {
    return key.startsWith(this.keyPrefix) ? key : `${this.keyPrefix}${key}`;
  }

  // --- Core Key-Value Operations ---

  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.formatKey(key);

    if (this.isConnected && this.redisClient) {
      try {
        const raw = await this.redisClient.get(fullKey);
        if (!raw) return null;
        return JSON.parse(raw) as T;
      } catch (err) {
        this.logger.warn(`Redis GET failed for key "${fullKey}", checking fallback store.`, err);
      }
    }

    // In-memory fallback
    const entry = this.inMemoryStore.get(fullKey);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.inMemoryStore.delete(fullKey);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const fullKey = this.formatKey(key);
    const serialized = JSON.stringify(value);

    if (this.isConnected && this.redisClient) {
      try {
        if (ttlMs && ttlMs > 0) {
          await this.redisClient.set(fullKey, serialized, 'PX', ttlMs);
        } else {
          await this.redisClient.set(fullKey, serialized);
        }
        return;
      } catch (err) {
        this.logger.warn(`Redis SET failed for key "${fullKey}", writing to fallback store.`, err);
      }
    }

    // In-memory fallback
    const expiresAt = ttlMs && ttlMs > 0 ? Date.now() + ttlMs : undefined;
    this.inMemoryStore.set(fullKey, { value, expiresAt });
  }

  async del(key: string): Promise<boolean> {
    const fullKey = this.formatKey(key);

    if (this.isConnected && this.redisClient) {
      try {
        const result = await this.redisClient.del(fullKey);
        this.inMemoryStore.delete(fullKey);
        return result > 0;
      } catch (err) {
        this.logger.warn(`Redis DEL failed for key "${fullKey}".`, err);
      }
    }

    return this.inMemoryStore.delete(fullKey);
  }

  async clear(): Promise<void> {
    // SCAN-based sweep: KEYS blocks the whole Redis server on a large keyspace.
    await this.deletePattern('*');
    this.inMemoryStore.clear();
    this.inMemoryQueues.clear();
  }

  /**
   * Atomically reads and deletes a key — for one-time values (auth codes,
   * nonces) that must be redeemable exactly once across every replica.
   */
  async take<T>(key: string): Promise<T | null> {
    const fullKey = this.formatKey(key);

    if (this.isConnected && this.redisClient) {
      try {
        const raw = await this.redisClient.getdel(fullKey);
        this.inMemoryStore.delete(fullKey);
        return raw ? (JSON.parse(raw) as T) : null;
      } catch (err) {
        this.logger.warn(`Redis GETDEL failed for key "${fullKey}", checking fallback store.`, err);
      }
    }

    const value = await this.get<T>(key);
    this.inMemoryStore.delete(fullKey);
    return value;
  }

  /** Sets the key only if it does not exist yet; `true` when this call wrote it. */
  async setIfAbsent<T>(key: string, value: T, ttlMs: number): Promise<boolean> {
    const fullKey = this.formatKey(key);

    if (this.isConnected && this.redisClient) {
      try {
        const result = await this.redisClient.set(fullKey, JSON.stringify(value), 'PX', ttlMs, 'NX');
        return result === 'OK';
      } catch (err) {
        this.logger.warn(`Redis SET NX failed for key "${fullKey}", writing to fallback store.`, err);
      }
    }

    if ((await this.get(key)) !== null) return false;
    this.inMemoryStore.set(fullKey, { value, expiresAt: Date.now() + ttlMs });
    return true;
  }

  /**
   * Atomic counter with a fixed window: the first increment starts a `ttlMs`
   * window, later ones keep its expiry. Returns the new count and the time
   * left in the window — the building block for rate limits across replicas.
   */
  async increment(key: string, ttlMs: number): Promise<{ count: number; ttlMs: number }> {
    const fullKey = this.formatKey(key);

    if (this.isConnected && this.redisClient) {
      try {
        const luaScript = `
          local count = redis.call("incr", KEYS[1])
          local ttl = redis.call("pttl", KEYS[1])
          if ttl < 0 then
            redis.call("pexpire", KEYS[1], ARGV[1])
            ttl = tonumber(ARGV[1])
          end
          return { count, ttl }
        `;
        const [count, ttl] = (await this.redisClient.eval(
          luaScript,
          1,
          fullKey,
          String(Math.max(1, Math.ceil(ttlMs))),
        )) as [number, number];
        return { count, ttlMs: ttl };
      } catch (err) {
        this.logger.warn(`Redis INCR failed for key "${fullKey}", using fallback store.`, err);
      }
    }

    const now = Date.now();
    const entry = this.inMemoryStore.get(fullKey);
    if (entry && entry.expiresAt && now <= entry.expiresAt && typeof entry.value === 'number') {
      entry.value += 1;
      return { count: entry.value, ttlMs: entry.expiresAt - now };
    }
    this.inMemoryStore.set(fullKey, { value: 1, expiresAt: now + ttlMs });
    return { count: 1, ttlMs };
  }

  /**
   * Read-through cache: returns the cached value, or runs `loader`, caches its
   * result for `ttlMs` and returns it. `null`/`undefined` results are not cached.
   */
  async getOrSet<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;
    const value = await loader();
    if (value !== null && value !== undefined) await this.set(key, value, ttlMs);
    return value;
  }

  /**
   * Delete every key matching a glob-style pattern (e.g. `app_version:*`).
   * The pattern is matched against the un-prefixed key space; the internal
   * key prefix is applied automatically. Safe to call when Redis is down —
   * it still sweeps the in-memory fallback store.
   */
  async deletePattern(pattern: string): Promise<number> {
    const fullPattern = this.formatKey(pattern);
    let deleted = 0;

    if (this.isConnected && this.redisClient) {
      try {
        let cursor = '0';
        do {
          const [next, keys] = await this.redisClient.scan(
            cursor,
            'MATCH',
            fullPattern,
            'COUNT',
            100,
          );
          cursor = next;
          if (keys.length > 0) {
            deleted += await this.redisClient.del(...keys);
            for (const key of keys) this.inMemoryStore.delete(key);
          }
        } while (cursor !== '0');
      } catch (err) {
        this.logger.warn(`Redis deletePattern failed for "${fullPattern}".`, err);
      }
    }

    // In-memory fallback sweep (also covers the case where Redis is unavailable).
    const regex = new RegExp(
      '^' +
        fullPattern
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*') +
        '$',
    );
    for (const key of this.inMemoryStore.keys()) {
      if (regex.test(key)) {
        this.inMemoryStore.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  // --- Session Management ---

  async setSession(sessionId: string, sessionData: unknown, ttlMs = 86_400_000): Promise<void> {
    await this.set(`session:${sessionId}`, sessionData, ttlMs);
  }

  async getSession<T>(sessionId: string): Promise<T | null> {
    return this.get<T>(`session:${sessionId}`);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    return this.del(`session:${sessionId}`);
  }

  // --- Queue Operations (for Background Processing) ---

  async pushQueue(queueName: string, item: unknown): Promise<void> {
    const fullKey = this.formatKey(`queue:${queueName}`);
    const serialized = JSON.stringify(item);

    if (this.isConnected && this.redisClient) {
      try {
        await this.redisClient.rpush(fullKey, serialized);
        return;
      } catch (err) {
        this.logger.warn(`Redis pushQueue failed for "${fullKey}".`, err);
      }
    }

    // In-memory fallback queue
    let queue = this.inMemoryQueues.get(fullKey);
    if (!queue) {
      queue = [];
      this.inMemoryQueues.set(fullKey, queue);
    }
    queue.push(item);
  }

  async popQueue<T>(queueName: string): Promise<T | null> {
    const fullKey = this.formatKey(`queue:${queueName}`);

    if (this.isConnected && this.redisClient) {
      try {
        const raw = await this.redisClient.lpop(fullKey);
        if (!raw) return null;
        return JSON.parse(raw) as T;
      } catch (err) {
        this.logger.warn(`Redis popQueue failed for "${fullKey}".`, err);
      }
    }

    // In-memory fallback
    const queue = this.inMemoryQueues.get(fullKey);
    if (!queue || queue.length === 0) return null;
    return queue.shift() as T;
  }

  async getQueueLength(queueName: string): Promise<number> {
    const fullKey = this.formatKey(`queue:${queueName}`);

    if (this.isConnected && this.redisClient) {
      try {
        return await this.redisClient.llen(fullKey);
      } catch (err) {
        this.logger.warn(`Redis llen failed for "${fullKey}".`, err);
      }
    }

    const queue = this.inMemoryQueues.get(fullKey);
    return queue ? queue.length : 0;
  }

  // --- Distributed Pub/Sub for Realtime Clustered Nodes ---

  async publish(channel: string, message: unknown): Promise<number> {
    const fullChannel = this.formatKey(`pubsub:${channel}`);
    const payload = typeof message === 'string' ? message : JSON.stringify(message);

    // Always dispatch to local subscribers first
    const subscribers = this.localSubscribers.get(fullChannel);
    if (subscribers) {
      for (const handler of subscribers) {
        try {
          handler(payload);
        } catch (err) {
          this.logger.error(`Error in local pubsub handler for channel "${channel}":`, err);
        }
      }
    }

    if (this.isConnected && this.pubClient) {
      try {
        return await this.pubClient.publish(fullChannel, payload);
      } catch (err) {
        this.logger.warn(`Redis publish failed for channel "${fullChannel}".`, err);
      }
    }

    return subscribers ? subscribers.size : 0;
  }

  async subscribe(channel: string, handler: (message: string) => void): Promise<void> {
    const fullChannel = this.formatKey(`pubsub:${channel}`);

    let subscribers = this.localSubscribers.get(fullChannel);
    if (!subscribers) {
      subscribers = new Set();
      this.localSubscribers.set(fullChannel, subscribers);
    }
    subscribers.add(handler);

    if (this.isSubConnected && this.subClient && subscribers.size === 1) {
      try {
        await this.subClient.subscribe(fullChannel);
      } catch (err) {
        this.logger.warn(`Redis subscribe failed for channel "${fullChannel}".`, err);
      }
    }
  }

  async unsubscribe(channel: string, handler?: (message: string) => void): Promise<void> {
    const fullChannel = this.formatKey(`pubsub:${channel}`);

    if (handler) {
      const subscribers = this.localSubscribers.get(fullChannel);
      if (subscribers) {
        subscribers.delete(handler);
        if (subscribers.size === 0) {
          this.localSubscribers.delete(fullChannel);
          if (this.isSubConnected && this.subClient) {
            await this.subClient.unsubscribe(fullChannel);
          }
        }
      }
    } else {
      this.localSubscribers.delete(fullChannel);
      if (this.isSubConnected && this.subClient) {
        await this.subClient.unsubscribe(fullChannel);
      }
    }
  }

  // --- Hash Operations (per-field atomic keyed sets, e.g. pending deliveries) ---

  private getMemoryHash(fullKey: string, create: boolean): Map<string, string> | null {
    const entry = this.inMemoryStore.get(fullKey);
    if (entry && (!entry.expiresAt || Date.now() <= entry.expiresAt)) {
      return entry.value as Map<string, string>;
    }
    if (entry) this.inMemoryStore.delete(fullKey);
    if (!create) return null;
    const hash = new Map<string, string>();
    this.inMemoryStore.set(fullKey, { value: hash });
    return hash;
  }

  private touchMemoryHash(fullKey: string, ttlMs?: number): void {
    const entry = this.inMemoryStore.get(fullKey);
    if (entry && ttlMs && ttlMs > 0) entry.expiresAt = Date.now() + ttlMs;
  }

  /**
   * Sets one field of a hash. With `onlyIfExists` the write is skipped (and
   * `false` returned) when the field is gone — so a concurrent delete is never
   * resurrected by a late update. `ttlMs` refreshes the whole hash's expiry.
   */
  async hashSet(
    key: string,
    field: string,
    value: unknown,
    options: { ttlMs?: number; onlyIfExists?: boolean } = {},
  ): Promise<boolean> {
    const fullKey = this.formatKey(key);
    const serialized = JSON.stringify(value);
    const ttlMs = options.ttlMs && options.ttlMs > 0 ? Math.ceil(options.ttlMs) : 0;

    if (this.isConnected && this.redisClient) {
      try {
        const luaScript = `
          if ARGV[3] == "1" and redis.call("hexists", KEYS[1], ARGV[1]) == 0 then
            return 0
          end
          redis.call("hset", KEYS[1], ARGV[1], ARGV[2])
          if tonumber(ARGV[4]) > 0 then
            redis.call("pexpire", KEYS[1], ARGV[4])
          end
          return 1
        `;
        const result = await this.redisClient.eval(
          luaScript,
          1,
          fullKey,
          field,
          serialized,
          options.onlyIfExists ? '1' : '0',
          String(ttlMs),
        );
        return result === 1;
      } catch (err) {
        this.logger.warn(`Redis HSET failed for key "${fullKey}", writing to fallback store.`, err);
      }
    }

    const existing = this.getMemoryHash(fullKey, false);
    if (options.onlyIfExists && !existing?.has(field)) return false;
    const hash = existing ?? (this.getMemoryHash(fullKey, true) as Map<string, string>);
    hash.set(field, serialized);
    this.touchMemoryHash(fullKey, ttlMs);
    return true;
  }

  async hashGetAll<T>(key: string): Promise<Record<string, T>> {
    const fullKey = this.formatKey(key);
    let raw: Record<string, string> | null = null;

    if (this.isConnected && this.redisClient) {
      try {
        raw = await this.redisClient.hgetall(fullKey);
      } catch (err) {
        this.logger.warn(`Redis HGETALL failed for key "${fullKey}", checking fallback store.`, err);
      }
    }
    if (!raw) {
      const hash = this.getMemoryHash(fullKey, false);
      raw = hash ? Object.fromEntries(hash) : {};
    }

    const out: Record<string, T> = {};
    for (const [field, value] of Object.entries(raw)) {
      try {
        out[field] = JSON.parse(value) as T;
      } catch {
        // A corrupt field is skipped rather than failing the whole read.
      }
    }
    return out;
  }

  /** Deletes one hash field; `true` only if it existed (the delete "won"). */
  async hashDel(key: string, field: string): Promise<boolean> {
    const fullKey = this.formatKey(key);

    if (this.isConnected && this.redisClient) {
      try {
        return (await this.redisClient.hdel(fullKey, field)) > 0;
      } catch (err) {
        this.logger.warn(`Redis HDEL failed for key "${fullKey}".`, err);
      }
    }

    const hash = this.getMemoryHash(fullKey, false);
    if (!hash) return false;
    const removed = hash.delete(field);
    if (hash.size === 0) this.inMemoryStore.delete(fullKey);
    return removed;
  }

  async hashLen(key: string): Promise<number> {
    const fullKey = this.formatKey(key);

    if (this.isConnected && this.redisClient) {
      try {
        return await this.redisClient.hlen(fullKey);
      } catch (err) {
        this.logger.warn(`Redis HLEN failed for key "${fullKey}".`, err);
      }
    }

    return this.getMemoryHash(fullKey, false)?.size ?? 0;
  }

  // --- Distributed Locks (e.g. for cluster-wide cron jobs / migrations) ---

  async acquireLock(resource: string, ttlMs = 10_000): Promise<string | null> {
    const fullKey = this.formatKey(`lock:${resource}`);
    const token = generateId();

    if (this.isConnected && this.redisClient) {
      try {
        const result = await this.redisClient.set(fullKey, token, 'PX', ttlMs, 'NX');
        return result === 'OK' ? token : null;
      } catch (err) {
        this.logger.warn(`Redis lock acquisition failed for "${fullKey}".`, err);
      }
    }

    // In-memory fallback
    const existing = this.inMemoryStore.get(fullKey);
    if (existing && (!existing.expiresAt || Date.now() < existing.expiresAt)) {
      return null;
    }
    this.inMemoryStore.set(fullKey, { value: token, expiresAt: Date.now() + ttlMs });
    return token;
  }

  async releaseLock(resource: string, token: string): Promise<boolean> {
    const fullKey = this.formatKey(`lock:${resource}`);

    if (this.isConnected && this.redisClient) {
      try {
        // Lua script ensures atomic check and release
        const luaScript = `
          if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
          else
            return 0
          end
        `;
        const result = await this.redisClient.eval(luaScript, 1, fullKey, token);
        return result === 1;
      } catch (err) {
        this.logger.warn(`Redis lock release failed for "${fullKey}".`, err);
      }
    }

    const existing = this.inMemoryStore.get(fullKey);
    if (existing && existing.value === token) {
      this.inMemoryStore.delete(fullKey);
      return true;
    }
    return false;
  }

  // --- Shutdown Cleanup ---

  private async disconnect(): Promise<void> {
    const clients = [this.redisClient, this.pubClient, this.subClient];
    for (const client of clients) {
      if (client) {
        try {
          client.disconnect();
        } catch {
          // Ignore
        }
      }
    }
    this.isConnected = false;
    this.isSubConnected = false;
    this.logger.log('Redis connections closed cleanly.');
  }
}
