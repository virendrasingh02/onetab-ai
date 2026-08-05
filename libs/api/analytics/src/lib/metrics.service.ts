import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { PrismaService } from '@org/database';
import type {
  PerformanceMetrics,
  RouteMetric,
  TimeSeriesPoint,
} from '@org/types';

/** One observed HTTP request. Kept small — thousands live in memory at once. */
interface RequestSample {
  route: string;
  method: string;
  statusCode: number;
  durationMs: number;
  at: number;
}

/**
 * How many samples the ring buffer holds. At ~120 req/min (the configured
 * throttle ceiling) this covers roughly the last 40 minutes of traffic, which
 * is the window the performance dashboard renders.
 */
const MAX_SAMPLES = 5_000;

/** Buckets shown on the throughput chart, one per minute. */
const THROUGHPUT_MINUTES = 30;

/** How often the event-loop lag probe fires. */
const LAG_PROBE_MS = 2_000;

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.ceil((p / 100) * sortedValues.length) - 1,
  );
  return Math.round(sortedValues[Math.max(0, index)] ?? 0);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/**
 * In-process collector behind the performance dashboard.
 *
 * Deliberately memory-only: this is live operational telemetry, and writing a
 * row per request would put the analytics tables on the hot path of every
 * single API call. Durable history belongs in the events table, which
 * `AnalyticsService` owns.
 */
@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsService.name);

  private readonly samples: RequestSample[] = [];
  private readonly startedAt = Date.now();

  private eventLoopLagMs = 0;
  private lagTimer: NodeJS.Timeout | null = null;
  private lastCpu = process.cpuUsage();

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    // Compare the timer's actual delay against its scheduled delay: the excess
    // is time the loop spent blocked, which is what "lag" means here.
    let expected = Date.now() + LAG_PROBE_MS;
    this.lagTimer = setInterval(() => {
      const now = Date.now();
      this.eventLoopLagMs = Math.max(0, now - expected);
      expected = now + LAG_PROBE_MS;
    }, LAG_PROBE_MS);
    // Never keep the process alive just to measure it.
    this.lagTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.lagTimer) clearInterval(this.lagTimer);
    this.lagTimer = null;
  }

  record(sample: RequestSample): void {
    this.samples.push(sample);
    if (this.samples.length > MAX_SAMPLES) {
      this.samples.splice(0, this.samples.length - MAX_SAMPLES);
    }
  }

  /** Live snapshot. Safe to call often — everything is computed in memory. */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const dbLatencyMs = await this.probeDatabase();
    const samples = this.samples;
    const durations = samples.map((s) => s.durationMs).sort((a, b) => a - b);
    const errors = samples.filter((s) => s.statusCode >= 400).length;

    const windowMs = Math.max(1, Date.now() - this.startedAt);
    const memory = process.memoryUsage();
    const cpu = process.cpuUsage(this.lastCpu);

    return {
      collectedSinceMs: windowMs,
      totalRequests: samples.length,
      totalErrors: errors,
      errorRate:
        samples.length === 0
          ? 0
          : Math.round((errors / samples.length) * 1000) / 10,
      requestsPerMinute:
        Math.round((samples.length / (windowMs / 60_000)) * 10) / 10,
      latency: {
        avgMs: mean(durations),
        p50Ms: percentile(durations, 50),
        p95Ms: percentile(durations, 95),
        p99Ms: percentile(durations, 99),
      },
      eventLoopLagMs: this.eventLoopLagMs,
      memory: {
        heapUsedBytes: memory.heapUsed,
        heapTotalBytes: memory.heapTotal,
        rssBytes: memory.rss,
      },
      cpu: {
        userMs: Math.round(cpu.user / 1000),
        systemMs: Math.round(cpu.system / 1000),
      },
      dbLatencyMs,
      slowestRoutes: this.routeMetrics(),
      throughputSeries: this.throughputSeries(),
    };
  }

  /** Round-trips a trivial statement so the number reflects real DB latency. */
  async probeDatabase(): Promise<number> {
    const start = Date.now();
    try {
      await this.prisma.$queryRawUnsafe('SELECT 1');
      return Date.now() - start;
    } catch (error) {
      this.logger.warn(
        `Database probe failed: ${error instanceof Error ? error.message : error}`,
      );
      return -1;
    }
  }

  private routeMetrics(): RouteMetric[] {
    const byRoute = new Map<string, RequestSample[]>();
    for (const sample of this.samples) {
      const key = `${sample.method} ${sample.route}`;
      const bucket = byRoute.get(key);
      if (bucket) bucket.push(sample);
      else byRoute.set(key, [sample]);
    }

    return [...byRoute.entries()]
      .map(([route, group]) => {
        const durations = group
          .map((s) => s.durationMs)
          .sort((a, b) => a - b);
        const errors = group.filter((s) => s.statusCode >= 400).length;
        return {
          route,
          requests: group.length,
          errors,
          errorRate: Math.round((errors / group.length) * 1000) / 10,
          avgMs: mean(durations),
          p95Ms: percentile(durations, 95),
          maxMs: Math.round(durations[durations.length - 1] ?? 0),
        };
      })
      .sort((a, b) => b.p95Ms - a.p95Ms)
      .slice(0, 10);
  }

  private throughputSeries(): TimeSeriesPoint[] {
    const now = Date.now();
    const buckets = new Map<string, number>();

    for (let i = THROUGHPUT_MINUTES - 1; i >= 0; i -= 1) {
      buckets.set(this.minuteLabel(now - i * 60_000), 0);
    }

    for (const sample of this.samples) {
      const label = this.minuteLabel(sample.at);
      if (buckets.has(label)) {
        buckets.set(label, (buckets.get(label) ?? 0) + 1);
      }
    }

    return [...buckets.entries()].map(([date, value]) => ({ date, value }));
  }

  private minuteLabel(timestamp: number): string {
    const date = new Date(timestamp);
    return `${String(date.getHours()).padStart(2, '0')}:${String(
      date.getMinutes(),
    ).padStart(2, '0')}`;
  }
}
