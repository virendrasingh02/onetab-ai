import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../generated/client.js';

/**
 * Application-wide Prisma client with enterprise connection pooling.
 *
 * Prisma 7 connects through a driver adapter (node-postgres pg.Pool).
 * Pool sizing is tuned for 1,000+ concurrent users with configurable
 * min/max connections, timeouts, and slow query monitoring.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private pool: pg.Pool;

  constructor() {
    const connectionString = process.env['DATABASE_URL'];
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is not set. Copy .env.example to .env and configure it.',
      );
    }

    const minPool = Number(process.env['DATABASE_POOL_MIN'] ?? 5);
    const maxPool = Number(process.env['DATABASE_POOL_MAX'] ?? 30);
    const idleTimeoutMillis = Number(process.env['DATABASE_POOL_IDLE_TIMEOUT_MS'] ?? 30000);
    const connectionTimeoutMillis = Number(process.env['DATABASE_POOL_CONNECTION_TIMEOUT_MS'] ?? 5000);
    const maxUses = Number(process.env['DATABASE_POOL_MAX_USES'] ?? 7500);

    const pool = new pg.Pool({
      connectionString,
      min: minPool,
      max: maxPool,
      idleTimeoutMillis,
      connectionTimeoutMillis,
      maxUses,
      allowExitOnIdle: false,
    });

    pool.on('error', (err: Error) => {
      Logger.error(`Unexpected error on idle database pool client: ${err.message}`, err.stack, 'PrismaService');
    });

    const isDev = process.env['NODE_ENV'] === 'development';

    super({
      adapter: new PrismaPg(pool, {
        disposeExternalPool: true,
        onPoolError: (err) => {
          Logger.error(`PrismaPg Pool Error: ${err.message}`, err.stack, 'PrismaService');
        },
      }),
      log: isDev
        ? [{ emit: 'event', level: 'query' }, 'warn', 'error']
        : ['warn', 'error'],
    });

    this.pool = pool;

    if (isDev) {
      // Slow query monitoring
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this as any).$on('query', (e: any) => {
        if (e.duration > 200) {
          this.logger.warn(`Slow query (${e.duration}ms): ${e.query.slice(0, 150)}... [Params: ${e.params}]`);
        }
      });
    }
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log(
        `Database connection established (Pool size: min=${process.env['DATABASE_POOL_MIN'] ?? 5}, max=${process.env['DATABASE_POOL_MAX'] ?? 30})`,
      );
    } catch (error) {
      this.logger.warn(
        `Could not connect to database at startup: ${String(error)}`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
      if (this.pool) {
        await this.pool.end();
      }
      this.logger.log('Database connection pool closed');
    } catch (err) {
      this.logger.error('Error closing database connection pool', err);
    }
  }

  /**
   * Returns current connection pool metrics.
   */
  getPoolMetrics() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  /**
   * Truncates every table. Test-only — refuses to run outside `test`, because
   * pointing this at a real database would be unrecoverable.
   */
  async truncateAll(): Promise<void> {
    if (process.env['NODE_ENV'] !== 'test') {
      throw new Error('truncateAll() is only available when NODE_ENV=test');
    }

    const tables = await this.$queryRaw<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename != '_prisma_migrations'
    `;

    for (const { tablename } of tables) {
      await this.$executeRawUnsafe(
        `TRUNCATE TABLE "public"."${tablename}" CASCADE;`,
      );
    }
  }
}

