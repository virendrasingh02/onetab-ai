import { Hint } from '@org/ui';
import { serverNow, subscribeServerClock } from '@org/utils';
import { useEffect, useState } from 'react';

const JUST_NOW_MS = 60_000;

function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function formatFull(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
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
