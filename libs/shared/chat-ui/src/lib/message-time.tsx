import { Hint } from '@org/ui';
import { serverNow, subscribeServerClock } from '@org/utils';
import { format, isSameYear, isToday, isYesterday } from 'date-fns';
import { useEffect, useState } from 'react';

const JUST_NOW_MS = 60_000;

/**
 * The one clock label every message surface shows: "4:28 PM" (no leading
 * zero), matching the hover label ("Today at 4:28 PM") and "Last reply".
 */
export function formatClock(timestamp: number | string | Date): string {
  return format(new Date(timestamp), 'h:mm a');
}

/**
 * Compact hover label for a message time: "Today at 4:23 PM",
 * "Yesterday at 4:23 PM", "Tue, Nov 17 at 4:23 PM", and the year only once it
 * isn't this one ("Nov 17, 2025 at 4:23 PM").
 */
export function formatFull(timestamp: number): string {
  const date = new Date(timestamp);
  const time = format(date, 'h:mm a');
  if (isToday(date)) return `Today at ${time}`;
  if (isYesterday(date)) return `Yesterday at ${time}`;
  const day = isSameYear(date, new Date())
    ? format(date, 'EEE, MMM d')
    : format(date, 'MMM d, yyyy');
  return `${day} at ${time}`;
}

/**
 * Message time that stays truthful: "Just now" is measured on the server's
 * clock and flips to the wall-clock time on its own once a minute has passed
 * (the old inline check only ran at render, so it stuck), and a timestamp that
 * is slightly ahead of this device is treated as just-now instead of
 * contradicting its neighbours.
 */
export function MessageTime({
  timestamp,
  className,
}: {
  timestamp: number;
  className?: string;
}) {
  const [, force] = useState(0);
  const isRecent = serverNow() - timestamp < JUST_NOW_MS;

  useEffect(() => subscribeServerClock(() => force((n) => n + 1)), []);
  useEffect(() => {
    if (!isRecent) return;
    const remaining = Math.max(250, JUST_NOW_MS - (serverNow() - timestamp) + 50);
    const id = setTimeout(() => force((n) => n + 1), remaining);
    return () => clearTimeout(id);
  }, [isRecent, timestamp]);

  return (
    <Hint label={formatFull(timestamp)}>
      <time
        dateTime={new Date(timestamp).toISOString()}
        className={className}
      >
        {isRecent ? 'Just now' : formatClock(timestamp)}
      </time>
    </Hint>
  );
}
