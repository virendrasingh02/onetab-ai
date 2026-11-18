/**
 * Due-date quick picks for the task detail sheet. Native date pickers need an
 * extra native module, so mobile offers the presets people actually use; any
 * other date can still be set on the web. Dates resolve to the end of the
 * chosen local day so a task "due today" is not overdue at lunchtime.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export interface DueDatePreset {
  label: string;
  date: Date;
}

export function dueDatePresets(now: Date): DueDatePreset[] {
  const day = now.getDay(); // 0 Sun … 6 Sat
  const presets: DueDatePreset[] = [
    { label: 'Today', date: endOfDay(now) },
    { label: 'Tomorrow', date: endOfDay(addDays(now, 1)) },
  ];
  // "This Friday" only while Friday is still ahead and not already tomorrow.
  const toFriday = 5 - day;
  if (toFriday >= 2) {
    presets.push({
      label: 'This Friday',
      date: endOfDay(addDays(now, toFriday)),
    });
  }
  const toMonday = (8 - day) % 7 || 7;
  if (toMonday > 1) {
    presets.push({
      label: 'Next Monday',
      date: endOfDay(addDays(now, toMonday)),
    });
  }
  presets.push({ label: 'In 2 weeks', date: endOfDay(addDays(now, 14)) });
  return presets;
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
});

/** "Today", "Tomorrow", "Overdue · Mon, Nov 17", or "Wed, Nov 19". */
export function formatDueDate(iso: string, now: Date = new Date()): string {
  const due = new Date(iso);
  if (Number.isNaN(due.getTime())) return 'No due date';
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(due) - startOf(now)) / DAY_MS);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 0) return `Overdue · ${dateFormat.format(due)}`;
  return dateFormat.format(due);
}
