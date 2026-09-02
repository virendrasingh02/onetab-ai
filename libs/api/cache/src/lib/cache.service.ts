import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis, { type RedisOptions } from 'ioredis';

export interface CacheEntry<T = unknown> {
  value: T;
  expiresAt?: number;
}

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private redisClient: Redis | null = null;
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private isConnected = false;
  private isSubConnected = false;

  // Resilient in-memory fallback store when Redis is unavailable or in test mode
  private readonly inMemoryStore = new Map<string, CacheEntry>();
  private readonly inMemoryQueues = new Map<string, unknown[]>();
  private readonly localSubscribers = new Map<string, Set<(message: string) => void>>();

  private readonly redisUrl: string;
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
  }

  async onModuleInit(): Promise<void> {
    await this.initRedis();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  private async initRedis(): Promise<void> {
    try {
      const redisOptions: RedisOptions = {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 10) {
            this.logger.warn(
              'Redis connection retry limit reached. Operating in in-memory fallback mode.',
            );
            return null; // Stop retrying automatically to prevent log spam
          }
          return Math.min(times * 100, 3000);
        },
        enableReadyCheck: true,
        lazyConnect: true,
      };

      this.redisClient = new Redis(this.redisUrl, redisOptions);
      this.pubClient = new Redis(this.redisUrl, redisOptions);
      this.subClient = new Redis(this.redisUrl, redisOptions);

      this.redisClient.on('connect', () => {
        this.isConnected = true;
        this.logger.log(`Redis primary client connected (${this.redisUrl})`);
      });

      this.redisClient.on('error', (err) => {
        if (this.isConnected) {
          this.logger.warn(`Redis connection error: ${err.message}. Falling back to in-memory store.`);
        }
        this.isConnected = false;
      });

      this.pubClient.on('connect', () => {
        // Connected
      });

      this.pubClient.on('error', () => {
        // Suppress unhandled event error when offline
      });

      this.subClient.on('connect', () => {
        this.isSubConnected = true;
      });

      this.subClient.on('error', () => {
        this.isSubConnected = false;
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
    } catch (error) {
      this.logger.warn(
        `Could not connect to Redis at startup (${this.redisUrl}). CacheService will operate with resilient in-memory fallback.`,
      );
      this.isConnected = false;
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
    if (this.isConnected && this.redisClient) {
      try {
        const keys = await this.redisClient.keys(`${this.keyPrefix}*`);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      } catch (err) {
        this.logger.warn('Redis clear operation failed.', err);
      }
    }
    this.inMemoryStore.clear();
    this.inMemoryQueues.clear();
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

  // --- Distributed Locks (e.g. for cluster-wide cron jobs / migrations) ---

  async acquireLock(resource: string, ttlMs = 10_000): Promise<string | null> {
    const fullKey = this.formatKey(`lock:${resource}`);
    const token = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

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
