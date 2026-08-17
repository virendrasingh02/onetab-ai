/**
 * Timezone helpers.
 *
 * Everything here goes through `Intl`, which reads the IANA database the
 * platform already ships. That is what makes "what time is it for them" correct
 * across DST without this app storing a single offset — an offset is only true
 * until the next transition, whereas `Asia/Kolkata` stays true.
 */

/** A curated fallback for browsers without `Intl.supportedValuesOf`. */
const FALLBACK_ZONES = [
  'UTC',
  'Africa/Cairo',
  'Africa/Johannesburg',
  'Africa/Lagos',
  'America/Bogota',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Mexico_City',
  'America/New_York',
  'America/Sao_Paulo',
  'America/Toronto',
  'Asia/Bangkok',
  'Asia/Dubai',
  'Asia/Hong_Kong',
  'Asia/Jakarta',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Manila',
  'Asia/Seoul',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Melbourne',
  'Australia/Perth',
  'Australia/Sydney',
  'Europe/Amsterdam',
  'Europe/Berlin',
  'Europe/Dublin',
  'Europe/Istanbul',
  'Europe/Lisbon',
  'Europe/London',
  'Europe/Madrid',
  'Europe/Moscow',
  'Europe/Paris',
  'Europe/Warsaw',
  'Europe/Zurich',
  'Pacific/Auckland',
  'Pacific/Honolulu',
] as const;

/** The viewer's own zone, as the browser reports it. */
export function getSystemTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

/** Whether `Intl` recognises this zone — cheap enough to call before saving. */
export function isValidTimezone(timezone: string): boolean {
  if (!timezone) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

/**
 * Every IANA zone the platform knows, alphabetically.
 *
 * `Intl.supportedValuesOf` is the real list (~420 zones); the fallback covers
 * older engines with enough coverage to stay usable rather than complete.
 */
export function listTimezones(): string[] {
  const supported =
    typeof Intl.supportedValuesOf === 'function'
      ? Intl.supportedValuesOf('timeZone')
      : undefined;
  const zones = supported?.length ? [...supported] : [...FALLBACK_ZONES];
  if (!zones.includes('UTC')) zones.push('UTC');
  return zones.sort((a, b) => a.localeCompare(b));
}

/** "Asia/Kolkata" → "Kolkata, Asia". The city is what people scan for. */
export function describeTimezone(timezone: string): string {
  const [area, ...rest] = timezone.split('/');
  if (rest.length === 0) return timezone;
  return `${rest.join('/').replace(/_/g, ' ')}, ${area.replace(/_/g, ' ')}`;
}

/**
 * Wall-clock time in a zone, e.g. "09:41" — or "09:41:07" with `seconds`.
 *
 * `hourCycle` is pinned to h23 rather than left to the locale: this app's
 * timestamps are 24-hour everywhere else (see `formatDateTime`), and a clock
 * that disagreed with the message list beside it would read as a bug.
 */
export function formatTimeInZone(
  value: Date | string | number,
  timezone: string,
  options: { seconds?: boolean } = {},
): string {
  const date = new Date(value);
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      ...(options.seconds ? { second: '2-digit' } : {}),
      hourCycle: 'h23',
    }).format(date);
  } catch {
    // An unknown zone must not take the surrounding view down with it.
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(date);
  }
}

/** Weekday and date in a zone, e.g. "Mon, 17 Aug" — the clock's second line. */
export function formatDateInZone(
  value: Date | string | number,
  timezone: string,
): string {
  const date = new Date(value);
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(date);
  } catch {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }).format(date);
  }
}

/**
 * A zone's offset from UTC in minutes, at a given instant.
 *
 * Derived by formatting the same instant twice — once in the zone, once in UTC —
 * and differencing, which is the only way to get this out of `Intl` without a
 * timezone library, and unlike a stored offset it is DST-correct by
 * construction.
 */
export function zoneOffsetMinutes(
  timezone: string,
  value: Date | string | number = Date.now(),
): number {
  const date = new Date(value);
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(date);

    const read = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value ?? '0');

    // `formatToParts` gives hour 24 for midnight in some engines; %24 folds it.
    const asUtc = Date.UTC(
      read('year'),
      read('month') - 1,
      read('day'),
      read('hour') % 24,
      read('minute'),
      read('second'),
    );

    // Seconds are the finest part available, so round to the nearest minute.
    return Math.round((asUtc - date.setMilliseconds(0)) / 60_000);
  } catch {
    return 0;
  }
}

/** "GMT+5:30", "GMT−7", "GMT" — the label beside a zone name. */
export function formatZoneOffset(
  timezone: string,
  value: Date | string | number = Date.now(),
): string {
  const minutes = zoneOffsetMinutes(timezone, value);
  if (minutes === 0) return 'GMT';

  const sign = minutes < 0 ? '−' : '+';
  const absolute = Math.abs(minutes);
  const hours = Math.floor(absolute / 60);
  const rest = absolute % 60;
  return rest === 0
    ? `GMT${sign}${hours}`
    : `GMT${sign}${hours}:${String(rest).padStart(2, '0')}`;
}

/**
 * How far another zone is from the viewer's, in words: "3h ahead", "1h 30m
 * behind", "same time as you". This is the part that actually stops someone
 * scheduling a call into a colleague's night.
 */
export function formatZoneDifference(
  timezone: string,
  viewerTimezone: string = getSystemTimezone(),
  value: Date | string | number = Date.now(),
): string {
  const delta =
    zoneOffsetMinutes(timezone, value) - zoneOffsetMinutes(viewerTimezone, value);
  if (delta === 0) return 'same time as you';

  const absolute = Math.abs(delta);
  const hours = Math.floor(absolute / 60);
  const minutes = absolute % 60;
  const parts = [hours ? `${hours}h` : null, minutes ? `${minutes}m` : null]
    .filter(Boolean)
    .join(' ');
  return `${parts} ${delta > 0 ? 'ahead' : 'behind'}`;
}

/** "Asia/Kolkata (GMT+5:30)" — for pickers and tooltips. */
export function formatZoneLabel(
  timezone: string,
  value: Date | string | number = Date.now(),
): string {
  return `${timezone.replace(/_/g, ' ')} (${formatZoneOffset(timezone, value)})`;
}
