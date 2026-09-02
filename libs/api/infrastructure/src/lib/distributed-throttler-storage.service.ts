import { Injectable, Logger } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';
import { CacheService } from '@org/api-cache';

interface InMemoryRateLimitRecord {
  totalHits: number;
  expiresAt: number;
  blockedUntil?: number;
}

@Injectable()
export class DistributedThrottlerStorageService implements ThrottlerStorage {
  private readonly logger = new Logger(DistributedThrottlerStorageService.name);
  private readonly inMemoryStore = new Map<string, InMemoryRateLimitRecord>();

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
    const isBlockedInCache = await this.cache.get<number>(blockKey);
    if (isBlockedInCache && isBlockedInCache > now) {
      const timeToBlockExpire = Math.ceil((isBlockedInCache - now) / 1000);
      return {
        totalHits: limit + 1,
        timeToExpire: timeToBlockExpire,
        isBlocked: true,
        timeToBlockExpire,
      };
    }

    // 2. Fetch current hit count
    const record = await this.cache.get<{ totalHits: number; expiresAt: number }>(rateLimitKey);

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
    await this.cache.set(rateLimitKey, { totalHits, expiresAt }, Math.max(ttl, expiresAt - now));

    // 4. Handle blocking if limit exceeded
    if (isBlocked && blockDuration > 0) {
      const blockedUntil = now + blockDuration;
      timeToBlockExpire = Math.ceil(blockDuration / 1000);
      await this.cache.set(blockKey, blockedUntil, blockDuration);
    }

    return {
      totalHits,
      timeToExpire,
      isBlocked,
      timeToBlockExpire,
    };
  }
}
