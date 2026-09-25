import {
  addDays,
  differenceInCalendarDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
  subWeeks,
} from 'date-fns';

/**
 * The one date-range model every analytics surface (web, admin, API) shares.
 *
 * Ranges are *calendar days* in the viewer's local time zone, inclusive at both
 * ends, and cross the wire only as date-only `YYYY-MM-DD` strings. A range is
 * never serialised as an ISO timestamp: `new Date('2026-09-01').toISOString()`
 * silently shifts to the previous day anywhere west of UTC, which is exactly
 * the off-by-one this module exists to avoid.
 */

export type DateRangePreset =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'last_90_days'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month';

export type DateRangeValue =
  | { preset: DateRangePreset }
  | {
      preset: 'custom';
      /** Inclusive first day, `YYYY-MM-DD`. */
      from: string;
      /** Inclusive last day, `YYYY-MM-DD`. */
      to: string;
    };

export interface ResolvedDateRange {
  /** Local midnight at the start of the first day. */
  from: Date;
  /** Local 23:59:59.999 at the end of the last day. */
  to: Date;
  /** Number of calendar days covered, at least 1. */
  days: number;
}

export interface DateRangeOptions {
  /** Reference "now"; injectable so resolution is deterministic in tests. */
  now?: Date;
  /** 0 = Sunday (matches `Calendar`), 1 = Monday. */
  weekStartsOn?: 0 | 1;
}

export const DATE_RANGE_PRESETS: ReadonlyArray<{
  id: DateRangePreset;
  label: string;
}> = [
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'last_7_days', label: 'Last 7 days' },
  { id: 'last_30_days', label: 'Last 30 days' },
  { id: 'last_90_days', label: 'Last 90 days' },
  { id: 'this_week', label: 'This week' },
  { id: 'last_week', label: 'Last week' },
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Last month' },
];

export const DEFAULT_DATE_RANGE: DateRangeValue = { preset: 'last_30_days' };

const PRESET_IDS = new Set<string>(DATE_RANGE_PRESETS.map((p) => p.id));
const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDateRangePreset(value: unknown): value is DateRangePreset {
  return typeof value === 'string' && PRESET_IDS.has(value);
}

/** `YYYY-MM-DD` for the *local* calendar day of `date`. */
export function toIsoDay(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/**
 * Parses `YYYY-MM-DD` as local midnight. Returns `null` for anything else,
 * including impossible dates like `2026-02-30` that `Date` would roll over.
 */
export function parseIsoDay(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = ISO_DAY.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (
    !isValid(date) ||
    date.getFullYear() !== Number(y) ||
    date.getMonth() !== Number(m) - 1 ||
    date.getDate() !== Number(d)
  ) {
    return null;
  }
  return date;
}

function span(from: Date, to: Date): ResolvedDateRange {
  const start = startOfDay(from);
  const end = endOfDay(to);
  return {
    from: start,
    to: end,
    days: Math.max(1, differenceInCalendarDays(end, start) + 1),
  };
}

/** Turns a preset or custom range into concrete local-day boundaries. */
export function resolveDateRange(
  value: DateRangeValue,
  { now = new Date(), weekStartsOn = 0 }: DateRangeOptions = {},
): ResolvedDateRange {
  const today = startOfDay(now);

  switch (value.preset) {
    case 'today':
      return span(today, today);
    case 'yesterday': {
      const y = subDays(today, 1);
      return span(y, y);
    }
    case 'last_7_days':
      return span(subDays(today, 6), today);
    case 'last_30_days':
      return span(subDays(today, 29), today);
    case 'last_90_days':
      return span(subDays(today, 89), today);
    case 'this_week':
      return span(startOfWeek(today, { weekStartsOn }), today);
    case 'last_week': {
      const lastWeek = subWeeks(today, 1);
      return span(
        startOfWeek(lastWeek, { weekStartsOn }),
        endOfWeek(lastWeek, { weekStartsOn }),
      );
    }
    case 'this_month':
      return span(startOfMonth(today), today);
    case 'last_month': {
      const lastMonth = subMonths(today, 1);
      return span(startOfMonth(lastMonth), endOfMonth(lastMonth));
    }
    case 'custom': {
      const from = parseIsoDay(value.from) ?? today;
      const to = parseIsoDay(value.to) ?? today;
      // A reversed pick is still an unambiguous interval.
      return from <= to ? span(from, to) : span(to, from);
    }
  }
}

/** The wire form every analytics endpoint accepts: `?from=&to=`. */
export function toDateRangeQuery(
  value: DateRangeValue,
  options?: DateRangeOptions,
): { from: string; to: string } {
  const resolved = resolveDateRange(value, options);
  return { from: toIsoDay(resolved.from), to: toIsoDay(resolved.to) };
}

/** `Sep 1, 2026 – Sep 24, 2026`, or a single day when both ends match. */
export function formatDateRangeSpan(range: { from: Date; to: Date }): string {
  const from = format(range.from, 'MMM d, yyyy');
  const to = format(range.to, 'MMM d, yyyy');
  return from === to ? from : `${from} – ${to}`;
}

/** Trigger label: the preset's name, or the formatted span for a custom range. */
export function getDateRangeLabel(
  value: DateRangeValue,
  options?: DateRangeOptions,
): string {
  if (value.preset === 'custom') {
    return formatDateRangeSpan(resolveDateRange(value, options));
  }
  return (
    DATE_RANGE_PRESETS.find((p) => p.id === value.preset)?.label ??
    value.preset
  );
}

export function isSameDateRange(a: DateRangeValue, b: DateRangeValue): boolean {
  if (a.preset !== b.preset) return false;
  if (a.preset === 'custom' && b.preset === 'custom') {
    return a.from === b.from && a.to === b.to;
  }
  return true;
}

/**
 * Reads a range back out of URL search params (`?range=last_7_days` or
 * `?range=custom&from=…&to=…`). Anything malformed falls back, so a stale or
 * hand-edited link never breaks a page.
 */
export function parseDateRangeParams(
  params: URLSearchParams,
  fallback: DateRangeValue = DEFAULT_DATE_RANGE,
): DateRangeValue {
  const range = params.get('range');
  if (isDateRangePreset(range)) return { preset: range };
  if (range === 'custom') {
    const from = params.get('from');
    const to = params.get('to');
    if (parseIsoDay(from) && parseIsoDay(to)) {
      return { preset: 'custom', from: from as string, to: to as string };
    }
  }
  return fallback;
}

/** Writes a range into a copy of `params`, clearing whatever it replaces. */
export function writeDateRangeParams(
  params: URLSearchParams,
  value: DateRangeValue,
): URLSearchParams {
  const next = new URLSearchParams(params);
  next.set('range', value.preset);
  if (value.preset === 'custom') {
    next.set('from', value.from);
    next.set('to', value.to);
  } else {
    next.delete('from');
    next.delete('to');
  }
  return next;
}

/**
 * Server-side counterpart: turns `?from=&to=` (or a legacy `?days=`) into a
 * half-open `[since, until)` window plus the equally long window before it,
 * for period-over-period trends. `maxDays` caps how far back a caller may
 * scan.
 */
export function resolveQueryWindow(
  query: { from?: string | null; to?: string | null; days?: number },
  { now = new Date(), maxDays = 366 }: { now?: Date; maxDays?: number } = {},
): {
  since: Date;
  until: Date;
  previousSince: Date;
  days: number;
} {
  const today = startOfDay(now);
  const parsedFrom = parseIsoDay(query.from);
  const parsedTo = parseIsoDay(query.to);

  let first: Date;
  let last: Date;
  if (parsedFrom && parsedTo) {
    [first, last] =
      parsedFrom <= parsedTo ? [parsedFrom, parsedTo] : [parsedTo, parsedFrom];
  } else {
    const days = Math.min(maxDays, Math.max(1, query.days ?? 30));
    last = today;
    first = subDays(today, days - 1);
  }

  let days = differenceInCalendarDays(last, first) + 1;
  if (days > maxDays) {
    first = subDays(last, maxDays - 1);
    days = maxDays;
  }

  const since = startOfDay(first);
  const until = startOfDay(addDays(last, 1));
  return { since, until, previousSince: subDays(since, days), days };
}
