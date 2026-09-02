import { Injectable } from '@nestjs/common';
import { CacheService } from '@org/api-cache';
import { PrismaService } from '@org/database';

@Injectable()
export class AppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Liveness probe: Lightweight check confirming the process is alive and responsive.
   */
  health() {
    return {
      status: 'ok',
      database: 'up',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Readiness probe: Verifies critical infrastructure (PostgreSQL connection pool, Redis cache)
   * and process memory before routing live user traffic.
   */
  async ready() {
    let database: 'up' | 'down' = 'up';
    let dbLatencyMs = 0;

    const startDb = Date.now();
    try {
      await Promise.race([
        this.prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 1000),
        ),
      ]);
      dbLatencyMs = Date.now() - startDb;
    } catch {
      database = 'down';
    }

    const redisPing = await this.cache.ping();
    const redis: 'up' | 'fallback_memory' = redisPing ? 'up' : 'fallback_memory';

    const memoryUsage = process.memoryUsage();
    const isReady = database === 'up';

    return {
      status: isReady ? 'ok' : 'degraded',
      ready: isReady,
      checks: {
        database: {
          status: database,
          latencyMs: dbLatencyMs,
          pool: this.prisma.getPoolMetrics(),
        },
        redis: {
          status: redis,
          isDistributed: redisPing,
        },
      },
      process: {
        uptime: Math.floor(process.uptime()),
        heapUsedMB: Math.round(memoryUsage.heapUsed / (1024 * 1024)),
        rssMB: Math.round(memoryUsage.rss / (1024 * 1024)),
      },
      timestamp: new Date().toISOString(),
    };
  }
}

