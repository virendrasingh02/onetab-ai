import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CacheService implements OnModuleInit {
  private readonly logger = new Logger(CacheService.name);
  private store = new Map<string, { value: unknown; expiresAt?: number }>();
  private redisUrl: string;

  constructor(private readonly config: ConfigService) {
    this.redisUrl = this.config.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
  }

  onModuleInit(): void {
    this.logger.log(`CacheService initialized (Redis URL: ${this.redisUrl})`);
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const expiresAt = ttlMs ? Date.now() + ttlMs : undefined;
    this.store.set(key, { value, expiresAt });
  }

  async del(key: string): Promise<boolean> {
    return this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }

  async setSession(sessionId: string, sessionData: unknown, ttlMs = 86400000): Promise<void> {
    await this.set(`session:${sessionId}`, sessionData, ttlMs);
  }

  async getSession<T>(sessionId: string): Promise<T | null> {
    return this.get<T>(`session:${sessionId}`);
  }

  async pushQueue(queueName: string, item: unknown): Promise<void> {
    const key = `queue:${queueName}`;
    const list = (await this.get<unknown[]>(key)) ?? [];
    list.push(item);
    await this.set(key, list);
  }

  async popQueue<T>(queueName: string): Promise<T | null> {
    const key = `queue:${queueName}`;
    const list = await this.get<unknown[]>(key);
    if (!list || list.length === 0) return null;
    const item = list.shift();
    await this.set(key, list);
    return item as T;
  }
}
