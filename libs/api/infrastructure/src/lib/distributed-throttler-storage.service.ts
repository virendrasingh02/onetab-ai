import { Injectable, Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { CacheService } from '@org/api-cache';

interface RateLimitRecord {
  totalHits: number;
  expiresAt: number;
}

/**
 * Distributed rate-limit storage backed by the shared cache (Redis) so the
 * limit is enforced across every API replica.
 *
 * If the cache is briefly unreachable the storage degrades to a per-process
 * in-memory map rather than throwing — a rate limiter that 500s the whole API
 * when Redis blips is worse than one that is momentarily replica-local.
 */
@Injectable()
export class DistributedThrottlerStorageService implements ThrottlerStorage {
  private readonly logger = new Logger(DistributedThrottlerStorageService.name);
  private readonly inMemoryStore = new Map<string, RateLimitRecord>();
  private readonly inMemoryBlocks = new Map<string, number>();
  /** Rate-limit the "cache unavailable" warning so a Redis outage can't flood logs. */
  private lastDegradedWarnAt = 0;

  constructor(private readonly cache: CacheService) {}

  async increment(
    key: string,
    ttl: number, // ttl in milliseconds
    limit: number,
    blockDuration: number, // blockDuration in milliseconds
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    const rateLimitKey = `ratelimit:${throttlerName}:${key}`;
    const blockKey = `ratelimit:block:${throttlerName}:${key}`;
    const now = Date.now();

    // 1. Check if key is currently blocked
    const blockedUntil = await this.readBlock(blockKey);
    if (blockedUntil && blockedUntil > now) {
      const timeToBlockExpire = Math.ceil((blockedUntil - now) / 1000);
      return {
        totalHits: limit + 1,
        timeToExpire: timeToBlockExpire,
        isBlocked: true,
        timeToBlockExpire,
      };
    }

    // 2. Fetch current hit count
    const record = await this.readRecord(rateLimitKey);

    let totalHits = 1;
    let expiresAt = now + ttl;

    if (record && record.expiresAt > now) {
      totalHits = record.totalHits + 1;
      expiresAt = record.expiresAt;
    }

    const timeToExpire = Math.max(1, Math.ceil((expiresAt - now) / 1000));
    const isBlocked = totalHits > limit;
    let timeToBlockExpire = 0;

    // 3. Save updated hits
    await this.writeRecord(
      rateLimitKey,
      { totalHits, expiresAt },
      Math.max(ttl, expiresAt - now),
    );

    // 4. Handle blocking if limit exceeded
    if (isBlocked && blockDuration > 0) {
      timeToBlockExpire = Math.ceil(blockDuration / 1000);
      await this.writeBlock(blockKey, now + blockDuration, blockDuration);
    }

    return {
      totalHits,
      timeToExpire,
      isBlocked,
      timeToBlockExpire,
    };
  }

  private warnDegraded(err: unknown): void {
    const now = Date.now();
    if (now - this.lastDegradedWarnAt > 30_000) {
      this.lastDegradedWarnAt = now;
      this.logger.warn(
        `Rate-limit cache unavailable, falling back to in-process store: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async readRecord(key: string): Promise<RateLimitRecord | null> {
    try {
      const cached = await this.cache.get<RateLimitRecord>(key);
      if (cached) return cached;
    } catch (err) {
      this.warnDegraded(err);
    }
    return this.inMemoryStore.get(key) ?? null;
  }

  private async writeRecord(
    key: string,
    value: RateLimitRecord,
    ttlMs: number,
  ): Promise<void> {
    this.inMemoryStore.set(key, value);
    // Bound the in-memory map: drop entries whose window has fully elapsed.
    if (this.inMemoryStore.size > 10_000) {
      const now = Date.now();
      for (const [k, v] of this.inMemoryStore) {
        if (v.expiresAt <= now) this.inMemoryStore.delete(k);
      }
    }
    try {
      await this.cache.set(key, value, ttlMs);
    } catch (err) {
      this.warnDegraded(err);
    }
  }

  private async readBlock(key: string): Promise<number | null> {
    try {
      const cached = await this.cache.get<number>(key);
      if (cached) return cached;
    } catch (err) {
      this.warnDegraded(err);
    }
    return this.inMemoryBlocks.get(key) ?? null;
  }

  private async writeBlock(
    key: string,
    blockedUntil: number,
    ttlMs: number,
  ): Promise<void> {
    this.inMemoryBlocks.set(key, blockedUntil);
    try {
      await this.cache.set(key, blockedUntil, ttlMs);
    } catch (err) {
      this.warnDegraded(err);
    }
  }
}
