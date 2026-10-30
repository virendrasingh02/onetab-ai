import { Injectable } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { CacheService } from '@org/api-cache';

/**
 * Distributed rate-limit storage backed by the shared cache (Redis) so the
 * limit is enforced across every API replica.
 *
 * Hits are counted with an atomic INCR (fixed window), so concurrent requests
 * on different replicas can't overwrite each other's counts. If Redis is
 * briefly unreachable, CacheService degrades to its per-process store rather
 * than throwing — a rate limiter that 500s the whole API when Redis blips is
 * worse than one that is momentarily replica-local.
 */
@Injectable()
export class DistributedThrottlerStorageService implements ThrottlerStorage {
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
    const blockedUntil = await this.cache.get<number>(blockKey);
    if (blockedUntil && blockedUntil > now) {
      const timeToBlockExpire = Math.ceil((blockedUntil - now) / 1000);
      return {
        totalHits: limit + 1,
        timeToExpire: timeToBlockExpire,
        isBlocked: true,
        timeToBlockExpire,
      };
    }

    // 2. Count this hit atomically within the current window
    const { count: totalHits, ttlMs } = await this.cache.increment(rateLimitKey, ttl);
    const timeToExpire = Math.max(1, Math.ceil(ttlMs / 1000));
    const isBlocked = totalHits > limit;
    let timeToBlockExpire = 0;

    // 3. Handle blocking if limit exceeded
    if (isBlocked && blockDuration > 0) {
      timeToBlockExpire = Math.ceil(blockDuration / 1000);
      await this.cache.set(blockKey, now + blockDuration, blockDuration);
    }

    return {
      totalHits,
      timeToExpire,
      isBlocked,
      timeToBlockExpire,
    };
  }
}
