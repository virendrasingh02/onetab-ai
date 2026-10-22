/**
 * Parses the argument of `/remind [who] [what] [when]` — e.g.
 * `me to call Bob in 30 minutes`, `me submit report tomorrow at 9am`,
 * `@Ana send the deck at 3:30pm`, `me stretch in 2h`.
 *
 * Deliberately small: relative offsets (`in 10 minutes`), `today|tomorrow` with
 * an optional time, bare `at 5pm`, and weekday names. Anything else is reported
 * as "no time found" so the caller can say so instead of guessing.
 */

export interface ParsedReminder {
  /** `me` unless the sentence starts with `@someone`. */
  who: 'me' | { mention: string };
  what: string;
  remindAt: Date;
}

const UNIT_MS: Record<string, number> = {
  m: 60_000,
  min: 60_000,
  mins: 60_000,
  minute: 60_000,
  minutes: 60_000,
  h: 3_600_000,
  hr: 3_600_000,
  hrs: 3_600_000,
  hour: 3_600_000,
  hours: 3_600_000,
  d: 86_400_000,
  day: 86_400_000,
  days: 86_400_000,
  w: 604_800_000,
  week: 604_800_000,
  weeks: 604_800_000,
};

const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const TIME = String.raw`(\d{1,2})(?::(\d{2}))?\s*(am|pm)?`;

function atTime(base: Date, h: number, m: number, meridiem?: string): Date {
  let hour = h;
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  const out = new Date(base);
  out.setHours(hour, m, 0, 0);
  return out;
}

export function parseReminder(
  input: string,
  now: Date = new Date(),
): ParsedReminder | null {
  let text = input.trim().replace(/\s+/g, ' ');
  if (!text) return null;

  let who: ParsedReminder['who'] = 'me';
  const whoMatch = /^(me|@\S+)\s*/i.exec(text);
  if (whoMatch) {
    const token = whoMatch[1];
    who = token.toLowerCase() === 'me' ? 'me' : { mention: token.slice(1) };
    text = text.slice(whoMatch[0].length);
  }

  let remindAt: Date | null = null;
  const cut = (match: RegExpExecArray) => {
    text = (text.slice(0, match.index) + ' ' + text.slice(match.index + match[0].length))
      .replace(/\s+/g, ' ')
      .trim();
  };

  const rel = /\bin (\d+(?:\.\d+)?)\s*([a-z]+)\b/i.exec(text);
  const relMs = rel ? UNIT_MS[rel[2].toLowerCase()] : undefined;
  if (rel && relMs) {
    remindAt = new Date(now.getTime() + Number(rel[1]) * relMs);
    cut(rel);
  }

  if (!remindAt) {
    const day = new RegExp(
      String.raw`\b(today|tomorrow|tonight|(?:next )?(${WEEKDAYS.join('|')}))(?: at ${TIME})?`,
      'i',
    ).exec(text);
    if (day) {
      const word = day[1].toLowerCase();
      const base = new Date(now);
      let defaultHour = 9;
      if (word === 'tomorrow') base.setDate(base.getDate() + 1);
      else if (word === 'tonight') defaultHour = 20;
      else if (word !== 'today') {
        const target = WEEKDAYS.indexOf(day[2].toLowerCase());
        let delta = (target - base.getDay() + 7) % 7;
        if (delta === 0) delta = 7;
        base.setDate(base.getDate() + delta);
      }
      remindAt = day[3]
        ? atTime(base, Number(day[3]), Number(day[4] ?? 0), day[5]?.toLowerCase())
        : atTime(base, defaultHour, 0);
      cut(day);
    }
  }

  if (!remindAt) {
    const at = new RegExp(String.raw`\bat ${TIME}\b`, 'i').exec(text);
    if (at) {
      const candidate = atTime(
        new Date(now),
        Number(at[1]),
        Number(at[2] ?? 0),
        at[3]?.toLowerCase(),
      );
      if (candidate.getTime() <= now.getTime()) {
        candidate.setDate(candidate.getDate() + 1);
      }
      remindAt = candidate;
      cut(at);
    }
  }

  if (!remindAt || Number.isNaN(remindAt.getTime())) return null;

  const what = text.replace(/^(to|about|that)\s+/i, '').trim();
  return { who, what, remindAt };
}
