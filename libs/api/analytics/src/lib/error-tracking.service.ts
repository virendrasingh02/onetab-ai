import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';
import type {
  BreakdownSlice,
  ErrorGroup,
  ErrorSeverity,
  ErrorTrackingReport,
  TimeSeriesPoint,
  TrackedError,
} from '@org/types';
import { createHash, randomUUID } from 'node:crypto';

/** Errors kept in memory for the global (non-workspace) view. */
const MAX_BUFFERED_ERRORS = 1_000;

/** Event type used when an error is persisted to the analytics events table. */
export const ERROR_EVENT_TYPE = 'ERROR';

export interface ErrorContext {
  route: string;
  method: string;
  statusCode: number;
  userId?: string | null;
  workspaceId?: string | null;
}

function severityFor(statusCode: number): ErrorSeverity {
  if (statusCode >= 500) return 'CRITICAL';
  if (statusCode >= 400) return 'ERROR';
  return 'WARNING';
}

/**
 * Groups errors that are "the same problem" even when the message carries
 * request-specific detail — ids, quoted values and numbers are normalised away
 * before hashing so a single broken query does not appear as 400 distinct
 * issues.
 */
function fingerprintOf(name: string, message: string, route: string): string {
  const normalised = message
    .replace(/[0-9a-f]{8,}/gi, '<id>')
    .replace(/\d+/g, '<n>')
    .replace(/"[^"]*"/g, '<str>')
    .slice(0, 200);
  return createHash('sha1')
    .update(`${name}|${normalised}|${route}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Captures unhandled request failures and answers the error-tracking screen.
 *
 * Two tiers on purpose: every error lands in an in-memory ring buffer so the
 * platform-wide view works even for failures that happen outside a workspace
 * (auth, health probes, bad routes), and workspace-attributable errors are
 * additionally written to `AnalyticsEvent` so a workspace's error history
 * survives a restart.
 */
@Injectable()
export class ErrorTrackingService {
  private readonly logger = new Logger(ErrorTrackingService.name);
  private readonly buffer: TrackedError[] = [];

  constructor(private readonly prisma: PrismaService) {}

  capture(error: unknown, context: ErrorContext): TrackedError {
    const err = error instanceof Error ? error : new Error(String(error));
    const message = err.message || 'Unknown error';
    const name = err.name || 'Error';

    const tracked: TrackedError = {
      id: randomUUID(),
      fingerprint: fingerprintOf(name, message, context.route),
      message,
      name,
      statusCode: context.statusCode,
      severity: severityFor(context.statusCode),
      route: context.route,
      method: context.method,
      stack: err.stack ?? null,
      userId: context.userId ?? null,
      workspaceId: context.workspaceId ?? null,
      occurredAt: new Date().toISOString(),
    };

    this.buffer.push(tracked);
    if (this.buffer.length > MAX_BUFFERED_ERRORS) {
      this.buffer.splice(0, this.buffer.length - MAX_BUFFERED_ERRORS);
    }

    void this.persist(tracked);
    return tracked;
  }

  /**
   * Persistence is best-effort and off the request path: an analytics write
   * must never turn a handled 404 into a failed response.
   */
  private async persist(tracked: TrackedError): Promise<void> {
    if (!tracked.workspaceId || !tracked.userId) return;
    try {
      await this.prisma.analyticsEvent.create({
        data: {
          workspaceId: tracked.workspaceId,
          userId: tracked.userId,
          eventType: ERROR_EVENT_TYPE,
          metadata: JSON.stringify(tracked),
        },
      });
    } catch (error) {
      this.logger.debug(
        `Could not persist error event: ${error instanceof Error ? error.message : error}`,
      );
    }
  }

  /**
   * @param workspaceId when given, merges the workspace's persisted errors with
   *   anything still only in memory; otherwise reports the whole process.
   */
  async getReport(
    workspaceId: string | null,
    hours: number,
  ): Promise<ErrorTrackingReport> {
    const since = new Date(Date.now() - hours * 3_600_000);
    const errors = workspaceId
      ? await this.loadWorkspaceErrors(workspaceId, since)
      : this.buffer.filter((e) => new Date(e.occurredAt) >= since);

    const sorted = [...errors].sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    );

    return {
      rangeHours: hours,
      totalErrors: sorted.length,
      uniqueGroups: new Set(sorted.map((e) => e.fingerprint)).size,
      errorRate: this.errorRate(sorted.length, hours),
      bySeverity: this.severityBreakdown(sorted),
      series: this.hourlySeries(sorted, hours),
      groups: this.group(sorted),
      recent: sorted.slice(0, 50),
    };
  }

  /** Clears the in-memory buffer — the "mark all resolved" action. */
  clearBuffer(): { cleared: number } {
    const cleared = this.buffer.length;
    this.buffer.length = 0;
    return { cleared };
  }

  private async loadWorkspaceErrors(
    workspaceId: string,
    since: Date,
  ): Promise<TrackedError[]> {
    const rows = await this.prisma.analyticsEvent.findMany({
      where: {
        workspaceId,
        eventType: ERROR_EVENT_TYPE,
        createdAt: { gte: since },
      },
      orderBy: { createdAt: 'desc' },
      take: 2_000,
    });

    const persisted = rows.flatMap((row) => {
      try {
        return [JSON.parse(row.metadata ?? '{}') as TrackedError];
      } catch {
        return [];
      }
    });

    // The write is asynchronous, so the newest errors may exist only in memory.
    const seen = new Set(persisted.map((e) => e.id));
    const buffered = this.buffer.filter(
      (e) =>
        e.workspaceId === workspaceId &&
        !seen.has(e.id) &&
        new Date(e.occurredAt) >= since,
    );

    return [...persisted, ...buffered];
  }

  private errorRate(total: number, hours: number): number {
    if (hours <= 0) return 0;
    return Math.round((total / hours) * 10) / 10;
  }

  private severityBreakdown(errors: TrackedError[]): BreakdownSlice[] {
    const counts = new Map<ErrorSeverity, number>([
      ['CRITICAL', 0],
      ['ERROR', 0],
      ['WARNING', 0],
    ]);
    for (const error of errors) {
      counts.set(error.severity, (counts.get(error.severity) ?? 0) + 1);
    }
    const total = errors.length || 1;
    return [...counts.entries()].map(([label, value]) => ({
      label,
      value,
      percentage: Math.round((value / total) * 1000) / 10,
    }));
  }

  private hourlySeries(
    errors: TrackedError[],
    hours: number,
  ): TimeSeriesPoint[] {
    const span = Math.min(hours, 48);
    const now = Date.now();
    const buckets = new Map<string, number>();

    for (let i = span - 1; i >= 0; i -= 1) {
      buckets.set(this.hourLabel(now - i * 3_600_000), 0);
    }
    for (const error of errors) {
      const label = this.hourLabel(new Date(error.occurredAt).getTime());
      if (buckets.has(label)) buckets.set(label, (buckets.get(label) ?? 0) + 1);
    }

    return [...buckets.entries()].map(([date, value]) => ({ date, value }));
  }

  private hourLabel(timestamp: number): string {
    const date = new Date(timestamp);
    return `${String(date.getHours()).padStart(2, '0')}:00`;
  }

  private group(errors: TrackedError[]): ErrorGroup[] {
    const groups = new Map<string, TrackedError[]>();
    for (const error of errors) {
      const bucket = groups.get(error.fingerprint);
      if (bucket) bucket.push(error);
      else groups.set(error.fingerprint, [error]);
    }

    return [...groups.entries()]
      .map(([fingerprint, group]) => {
        const times = group.map((e) => new Date(e.occurredAt).getTime());
        const sample = group[0];
        return {
          fingerprint,
          name: sample.name,
          message: sample.message,
          statusCode: sample.statusCode,
          severity: sample.severity,
          route: sample.route,
          count: group.length,
          firstSeenAt: new Date(Math.min(...times)).toISOString(),
          lastSeenAt: new Date(Math.max(...times)).toISOString(),
          sample,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 25);
  }
}
