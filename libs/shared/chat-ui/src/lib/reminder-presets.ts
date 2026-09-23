export interface ReminderPreset {
  id: '20m' | '1h' | '3h' | 'tomorrow' | 'next-week';
  label: string;
  /** Short absolute time shown beside the label — "9:00 AM", "Mon". */
  hint: string;
  at: Date;
}

/** Morning reminders land at the start of the working day. */
const MORNING_HOUR = 9;

function atMorning(day: Date): Date {
  const next = new Date(day);
  next.setHours(MORNING_HOUR, 0, 0, 0);
  return next;
}

const timeHint = (date: Date) =>
  date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/**
 * The "Remind me about this" choices, resolved against `now`: three relative
 * times, tomorrow morning, and next Monday morning (the Monday after this
 * week, even when today is Sunday).
 */
export function reminderPresets(now: Date = new Date()): ReminderPreset[] {
  const inMinutes = (minutes: number) => new Date(now.getTime() + minutes * 60_000);

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const nextMonday = new Date(now);
  const daysUntilMonday = ((8 - now.getDay()) % 7) || 7;
  nextMonday.setDate(now.getDate() + daysUntilMonday);

  const presets: ReminderPreset[] = [
    { id: '20m', label: 'In 20 minutes', at: inMinutes(20), hint: '' },
    { id: '1h', label: 'In 1 hour', at: inMinutes(60), hint: '' },
    { id: '3h', label: 'In 3 hours', at: inMinutes(180), hint: '' },
    { id: 'tomorrow', label: 'Tomorrow', at: atMorning(tomorrow), hint: '' },
    { id: 'next-week', label: 'Next week', at: atMorning(nextMonday), hint: '' },
  ];

  return presets.map((preset) => ({
    ...preset,
    hint:
      preset.id === 'next-week'
        ? preset.at.toLocaleDateString(undefined, { weekday: 'short' }) +
          ' ' +
          timeHint(preset.at)
        : timeHint(preset.at),
  }));
}

/** "today at 3:40 PM", "tomorrow at 9:00 AM", "Mon at 9:00 AM" — for confirmations. */
export function describeReminderTime(at: Date, now: Date = new Date()): string {
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  const day = sameDay(at, now)
    ? 'today'
    : sameDay(at, tomorrow)
      ? 'tomorrow'
      : at.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} at ${timeHint(at)}`;
}
