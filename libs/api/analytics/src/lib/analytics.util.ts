import type { BreakdownSlice, TimeSeriesPoint, TrendDelta } from '@org/types';
import { resolveQueryWindow } from '@org/utils';

/** `YYYY-MM-DD` in local time — the key every daily series is bucketed by. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0',
  )}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Midnight, `days` days ago. Range queries start here. */
export function startOfRange(days: number): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

/**
 * Buckets timestamps into one point per day.
 *
 * Every day in the range is emitted, including empty ones — a chart with gaps
 * silently misreads as "activity was continuous but low".
 */
export function toDailySeries(
  timestamps: Array<Date | string>,
  range: number | Pick<AnalyticsWindow, 'since' | 'days'>,
): TimeSeriesPoint[] {
  const buckets = new Map<string, number>();
  const days = typeof range === 'number' ? range : range.days;
  const cursor =
    typeof range === 'number' ? startOfRange(range) : new Date(range.since);

  for (let i = 0; i < days; i += 1) {
    buckets.set(dayKey(cursor), 0);
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const timestamp of timestamps) {
    const key = dayKey(
      timestamp instanceof Date ? timestamp : new Date(timestamp),
    );
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  }

  return [...buckets.entries()].map(([date, value]) => ({ date, value }));
}

/** Turns raw counts into percentage slices, largest first. */
export function toBreakdown(
  counts: Record<string, number> | Map<string, number>,
  limit = 12,
): BreakdownSlice[] {
  const entries =
    counts instanceof Map ? [...counts.entries()] : Object.entries(counts);
  const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;

  return entries
    .map(([label, value]) => ({
      label,
      value,
      percentage: Math.round((value / total) * 1000) / 10,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

/** Period-over-period delta. A previous value of 0 has no meaningful percent. */
export function toTrend(current: number, previous: number): TrendDelta {
  const changePct =
    previous === 0
      ? null
      : Math.round(((current - previous) / previous) * 1000) / 10;

  return {
    current,
    previous,
    changePct,
    direction: current > previous ? 'up' : current < previous ? 'down' : 'flat',
  };
}

/** Clamps a caller-supplied `?days=` into a range the aggregations can serve. */
export function normaliseDays(value: string | number | undefined): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  if (!parsed || Number.isNaN(parsed)) return 30;
  return Math.min(365, Math.max(1, parsed));
}

/** Same for `?hours=` on the error views. */
export function normaliseHours(value: string | number | undefined): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : value;
  if (!parsed || Number.isNaN(parsed)) return 24;
  return Math.min(720, Math.max(1, parsed));
}

/** What a workspace analytics route accepts: `?from=&to=` days, or legacy `?days=`. */
export interface AnalyticsRangeQuery {
  days?: string | number;
  from?: string;
  to?: string;
}

/** Half-open `[since, until)` plus the equally long window before it. */
export interface AnalyticsWindow {
  since: Date;
  until: Date;
  previousSince: Date;
  days: number;
}

/**
 * Resolves the request window through the same `@org/utils` date-range code
 * the web `DateRangeFilter` uses, so "Last week" or a custom span means the
 * same calendar days on both sides. Accepts a bare `days` value for callers
 * that predate `from`/`to`; the span is capped at a year either way.
 */
export function resolveAnalyticsWindow(
  range?: AnalyticsRangeQuery | string | number,
): AnalyticsWindow {
  const query: AnalyticsRangeQuery =
    typeof range === 'object' && range !== null ? range : { days: range };
  return resolveQueryWindow(
    { from: query.from, to: query.to, days: normaliseDays(query.days) },
    { maxDays: 365 },
  );
}
