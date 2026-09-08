/**
 * Scheduled status multi-queue (brief §9) — pure resolution logic.
 *
 * A user can queue up to {@link MAX_SCHEDULED_STATUSES} status entries. A
 * per-minute server applier calls {@link pickActiveScheduledStatus} to decide
 * which enabled entry, if any, is active *right now* and writes it onto the
 * user. Everything here is pure (no `Date.now()`, no timers) so the API and the
 * web client resolve identically and the applier is trivially testable.
 *
 * Conflict rule for overlapping entries: **highest `priority` wins; ties break
 * to the most recently updated entry, then by id.** The newest edit reflects
 * the user's latest intent.
 */

export const MAX_SCHEDULED_STATUSES = 5;
export const MINUTES_IN_DAY = 1440;

export type ScheduledStatusRecurrenceValue =
  | 'ONE_TIME'
  | 'DAILY'
  | 'WEEKDAYS'
  | 'WEEKLY';

/** The subset of a `ScheduledStatus` row the resolver needs (dates as ISO). */
export interface ScheduledStatusRule {
  id: string;
  isEnabled: boolean;
  priority: number;
  recurrence: ScheduledStatusRecurrenceValue;
  /** ONE_TIME only. */
  startAt: string | null;
  endAt: string | null;
  /** Recurring only — minutes past local midnight, 0–1439, `end` > `start`. */
  startMinute: number | null;
  endMinute: number | null;
  /** WEEKLY only — 0 = Sunday … 6 = Saturday. */
  daysOfWeek: number[];
  /** Recurring only — absolute instants bounding the recurrence, inclusive. */
  activeFrom: string | null;
  activeUntil: string | null;
  /** IANA time zone for the minute-of-day maths. */
  timezone: string;
  updatedAt: string;
}

/** A scheduled-status row as the API returns it and the manage UI edits it. */
export interface ScheduledStatusView extends ScheduledStatusRule {
  label: string;
  statusText: string;
  statusEmoji: string | null;
  /** Also apply this presence while active; null = leave presence alone. */
  presence: 'ONLINE' | 'AWAY' | 'BUSY' | 'OFFLINE' | null;
  createdAt: string;
}

export interface LocalWallClock {
  /** 0–1439. */
  minuteOfDay: number;
  /** 0 = Sunday … 6 = Saturday. */
  dayOfWeek: number;
  /** `YYYY-MM-DD` in the given zone. */
  ymd: string;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Wall-clock time in `timeZone` for the instant `now`. */
export function localWallClock(now: Date, timeZone: string): LocalWallClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now);

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? '';

  const hour = Number(get('hour'));
  const minute = Number(get('minute'));

  return {
    minuteOfDay: (Number.isFinite(hour) ? hour : 0) * 60 + (minute || 0),
    dayOfWeek: WEEKDAY_INDEX[get('weekday')] ?? 0,
    ymd: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

/** Whether a single rule is active at `now`. */
export function isScheduledStatusActive(
  rule: ScheduledStatusRule,
  now: Date,
): boolean {
  if (!rule.isEnabled) return false;

  if (rule.recurrence === 'ONE_TIME') {
    if (!rule.startAt || !rule.endAt) return false;
    const t = now.getTime();
    return Date.parse(rule.startAt) <= t && t < Date.parse(rule.endAt);
  }

  if (rule.startMinute == null || rule.endMinute == null) return false;
  // No midnight-wrapping windows in v1.
  if (rule.endMinute <= rule.startMinute) return false;

  const t = now.getTime();
  if (rule.activeFrom && t < Date.parse(rule.activeFrom)) return false;
  if (rule.activeUntil && t > Date.parse(rule.activeUntil)) return false;

  const local = localWallClock(now, rule.timezone);

  if (
    rule.recurrence === 'WEEKDAYS' &&
    (local.dayOfWeek === 0 || local.dayOfWeek === 6)
  ) {
    return false;
  }
  if (
    rule.recurrence === 'WEEKLY' &&
    !rule.daysOfWeek.includes(local.dayOfWeek)
  ) {
    return false;
  }

  return (
    rule.startMinute <= local.minuteOfDay &&
    local.minuteOfDay < rule.endMinute
  );
}

/**
 * The one rule that should drive the user's status at `now`, or null. Applies
 * the conflict rule (priority ↓, then updatedAt ↓, then id ↑).
 */
export function pickActiveScheduledStatus(
  rules: ScheduledStatusRule[],
  now: Date,
): ScheduledStatusRule | null {
  const active = rules.filter((rule) => isScheduledStatusActive(rule, now));
  if (active.length === 0) return null;

  active.sort(
    (a, b) =>
      b.priority - a.priority ||
      Date.parse(b.updatedAt) - Date.parse(a.updatedAt) ||
      a.id.localeCompare(b.id),
  );
  return active[0];
}

/**
 * When the currently-active window closes — used to set `statusExpiresAt` so
 * the UI can say "until 11:00 AM". The per-minute applier is the real expiry;
 * a small DST skew here is cosmetic.
 */
export function scheduledStatusWindowEnd(
  rule: ScheduledStatusRule,
  now: Date,
): Date {
  if (rule.recurrence === 'ONE_TIME') {
    return new Date(rule.endAt ?? now);
  }
  const local = localWallClock(now, rule.timezone);
  const minutesLeft = (rule.endMinute ?? local.minuteOfDay) - local.minuteOfDay;
  return new Date(now.getTime() + Math.max(1, minutesLeft) * 60_000);
}
