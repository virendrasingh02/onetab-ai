/**
 * Five-field cron (minute hour day-of-month month day-of-week), read in a time
 * zone. Shared by the schedule sweeps on the server and the Studio's "next
 * run" labels in the browser, so both agree on when an agent fires.
 *
 * Supports `*`, lists, ranges, steps and `L` (last day of the month) in the
 * day-of-month field — every expression the Studio and the canvas produce —
 * without a cron dependency.
 */

export interface ZonedParts {
  minute: number;
  hour: number;
  day: number;
  month: number;
  year: number;
  /** 0 = Sunday. */
  weekday: number;
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      weekday: 'short',
    });
    formatters.set(timeZone, fmt);
  }
  return fmt;
}

/** The wall-clock parts of `date` in `timeZone` (the host zone when omitted or invalid). */
export function zonedParts(date: Date, timeZone?: string | null): ZonedParts {
  if (timeZone) {
    try {
      const parts = formatterFor(timeZone).formatToParts(date);
      const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
      return {
        minute: Number(get('minute')),
        hour: Number(get('hour')) % 24,
        day: Number(get('day')),
        month: Number(get('month')),
        year: Number(get('year')),
        weekday: WEEKDAY_INDEX[get('weekday')] ?? date.getDay(),
      };
    } catch {
      // An unknown zone falls through to the host clock.
    }
  }
  return {
    minute: date.getMinutes(),
    hour: date.getHours(),
    day: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
    weekday: date.getDay(),
  };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function fieldMatches(field: string, value: number): boolean {
  return field.split(',').some((part) => {
    const [range, stepRaw] = part.split('/');
    const step = stepRaw ? Number(stepRaw) : 1;
    if (!Number.isFinite(step) || step <= 0 || range === undefined) return false;
    if (range === '*') return value % step === 0;
    if (range.includes('-')) {
      const [startRaw, endRaw] = range.split('-');
      const start = Number(startRaw);
      const end = Number(endRaw);
      if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
      return value >= start && value <= end && (value - start) % step === 0;
    }
    return Number(range) === value;
  });
}

function splitCron(expression: string): [string, string, string, string, string] | null {
  const parts = expression.trim().split(/\s+/);
  return parts.length === 5 ? (parts as [string, string, string, string, string]) : null;
}

export function isValidCron(expression: string | null | undefined): boolean {
  const parts = expression ? splitCron(expression) : null;
  if (!parts) return false;
  return parts.every((p) => /^(\*|L|\d+(-\d+)?)(\/\d+)?(,(\*|\d+(-\d+)?)(\/\d+)?)*$/.test(p));
}

function dayMatches(field: string, parts: ZonedParts): boolean {
  if (field === 'L') return parts.day === daysInMonth(parts.year, parts.month);
  return fieldMatches(field, parts.day);
}

/** Whether `expression` fires in the minute containing `at`, read in `timeZone`. */
export function cronMatches(expression: string, at: Date, timeZone?: string | null): boolean {
  const fields = splitCron(expression);
  if (!fields) return false;
  const [minute, hour, dom, month, dow] = fields;
  const p = zonedParts(at, timeZone);
  return (
    fieldMatches(minute, p.minute) &&
    fieldMatches(hour, p.hour) &&
    dayMatches(dom, p) &&
    fieldMatches(month, p.month) &&
    fieldMatches(dow, p.weekday)
  );
}

/**
 * The next minute (strictly after `from`) `expression` fires, or null when it
 * does not fire within `horizonDays`. Skips whole days and hours that cannot
 * match, so a yearly schedule costs a few hundred checks, not half a million.
 */
export function nextCronRun(
  expression: string,
  from: Date = new Date(),
  timeZone?: string | null,
  horizonDays = 400,
): Date | null {
  const fields = splitCron(expression);
  if (!fields) return null;
  const [minute, hour, dom, month, dow] = fields;
  let t = new Date(Math.floor(from.getTime() / 60_000) * 60_000 + 60_000);
  const limit = from.getTime() + horizonDays * 86_400_000;
  while (t.getTime() <= limit) {
    const p = zonedParts(t, timeZone);
    if (!(dayMatches(dom, p) && fieldMatches(month, p.month) && fieldMatches(dow, p.weekday))) {
      t = new Date(t.getTime() + ((23 - p.hour) * 60 + (60 - p.minute)) * 60_000);
      continue;
    }
    if (!fieldMatches(hour, p.hour)) {
      t = new Date(t.getTime() + (60 - p.minute) * 60_000);
      continue;
    }
    if (!fieldMatches(minute, p.minute)) {
      t = new Date(t.getTime() + 60_000);
      continue;
    }
    return t;
  }
  return null;
}

/* ------------------------------------------------- natural-language times -- */

const DAY_NAMES: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

export interface ParsedSchedule {
  cron: string;
  /** Whether a clock time was stated, or a default for "morning"/"evening" was used. */
  explicitTime: boolean;
  /**
   * Whether the words said when in the day at all — a clock time, a part of
   * the day, or an interval. False for plain "daily" or "every Monday", whose
   * hour in `cron` is only a 9 AM default.
   */
  timeGiven: boolean;
}

function parseClock(text: string): { hour: number; minute: number } | null {
  const ampm = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)/i.exec(text);
  if (ampm) {
    let hour = Number(ampm[1]) % 12;
    if (/^p/i.test(ampm[3]!)) hour += 12;
    return { hour, minute: Number(ampm[2] ?? 0) };
  }
  const h24 = /\b(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)\b/.exec(text);
  if (h24) return { hour: Number(h24[1]), minute: Number(h24[2]) };
  const oclock = /\bat\s+(\d{1,2})\s*(?:o'?clock)?\b/i.exec(text);
  if (oclock) {
    const hour = Number(oclock[1]);
    if (hour >= 0 && hour <= 23) return { hour: hour < 7 ? hour + 12 : hour, minute: 0 };
  }
  return null;
}

/**
 * A schedule described in words ("every weekday at 6 pm", "each Monday
 * morning", "month-end") as cron. Null when the text names no recurrence.
 */
export function parseScheduleText(input: string): ParsedSchedule | null {
  const text = input.toLowerCase();
  const clock = parseClock(text);
  const partOfDay = /\bmorning\b/.test(text)
    ? { hour: 8, minute: 0 }
    : /\b(evening|end of (the )?day|eod)\b/.test(text)
      ? { hour: 18, minute: 0 }
      : /\bafternoon\b/.test(text)
        ? { hour: 14, minute: 0 }
        : /\b(night|tonight)\b/.test(text)
          ? { hour: 21, minute: 0 }
          : /\b(noon|midday|lunch)\b/.test(text)
            ? { hour: 12, minute: 0 }
            : null;
  const time = clock ?? partOfDay;
  const explicitTime = Boolean(clock);
  const timeGiven = Boolean(time);

  const everyMinutes = /\bevery\s+(\d{1,2})\s*min/.exec(text);
  if (everyMinutes) return { cron: `*/${Math.max(5, Number(everyMinutes[1]))} * * * *`, explicitTime: true, timeGiven: true };
  const everyHours = /\bevery\s+(\d{1,2})\s*hours?\b/.exec(text);
  if (everyHours) return { cron: `0 */${Number(everyHours[1])} * * *`, explicitTime: true, timeGiven: true };
  if (/\b(hourly|every hour|each hour)\b/.test(text)) return { cron: '0 * * * *', explicitTime: true, timeGiven: true };

  const at = time ?? { hour: 9, minute: 0 };
  const hm = `${at.minute} ${at.hour}`;

  if (/\b(month[- ]end|end of (the )?month|last day of (the )?month)\b/.test(text)) {
    return { cron: `${time ? hm : '0 17'} L * *`, explicitTime, timeGiven };
  }
  if (/\b(monthly|every month|each month|once a month)\b/.test(text)) {
    return { cron: `${hm} 1 * *`, explicitTime, timeGiven };
  }

  const weekdays = /\b(weekdays?|every weekday|workdays?|business days?|monday (to|through|-) friday|mon-fri)\b/.test(text);
  const weekends = /\bweekends?\b/.test(text);
  const named = Object.entries(DAY_NAMES)
    .filter(([name]) => new RegExp(`\\b${name}s?\\b`).test(text))
    .map(([, day]) => day);
  const days = [...new Set(named)].sort();

  if (weekdays) return { cron: `${hm} * * 1-5`, explicitTime, timeGiven };
  if (weekends) return { cron: `${hm} * * 0,6`, explicitTime, timeGiven };
  if (days.length && /\b(every|each|on|weekly)\b/.test(text)) {
    return { cron: `${hm} * * ${days.join(',')}`, explicitTime, timeGiven };
  }
  if (/\b(weekly|every week|each week|once a week)\b/.test(text)) {
    return { cron: `${hm} * * ${days.length ? days.join(',') : '1'}`, explicitTime, timeGiven };
  }
  if (/\b(daily|every day|each day|everyday|every (morning|evening|afternoon|night)|each (morning|evening|afternoon|night))\b/.test(text)) {
    return { cron: `${hm} * * *`, explicitTime, timeGiven };
  }
  if (time && /\bevery\b/.test(text)) return { cron: `${hm} * * *`, explicitTime, timeGiven };
  return null;
}

/** Midnight at the start of `date`'s day in `timeZone`, as an instant. */
export function startOfZonedDay(date: Date, timeZone: string): Date {
  const p = zonedParts(date, timeZone);
  const utcMidnight = Date.UTC(p.year, p.month - 1, p.day);
  // The zone's offset at that midnight: the wall clock read there minus UTC.
  const guess = new Date(utcMidnight);
  const at = zonedParts(guess, timeZone);
  const offsetMinutes =
    (Date.UTC(at.year, at.month - 1, at.day, at.hour, at.minute) - utcMidnight) / 60_000;
  return new Date(utcMidnight - offsetMinutes * 60_000);
}
