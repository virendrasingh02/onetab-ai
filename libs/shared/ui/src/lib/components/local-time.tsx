import {
  cn,
  formatDateInZone,
  formatTimeInZone,
  formatZoneDifference,
  formatZoneOffset,
  getSystemTimezone,
} from '@org/utils';
import { Clock } from 'lucide-react';
import { useEffect, useState, type ComponentProps } from 'react';
import { Hint } from './tooltip.js';

/**
 * A clock that stays right.
 *
 * Rather than one interval per clock, each tick is scheduled for the *next*
 * minute boundary, so the displayed minute changes when the wall clock does
 * instead of up to 59s late — and a tab that was asleep for an hour corrects on
 * its first frame back rather than after another full interval.
 */
export function useMinuteTick(): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const schedule = () => {
      const current = new Date();
      setNow(current);
      // +50ms of slack so we land just after the boundary, never just before.
      const untilNextMinute =
        60_000 - (current.getSeconds() * 1000 + current.getMilliseconds()) + 50;
      timer = setTimeout(schedule, untilNextMinute);
    };

    schedule();
    return () => clearTimeout(timer);
  }, []);

  return now;
}

export interface LocalTimeProps extends Omit<ComponentProps<'time'>, 'children'> {
  /** IANA zone, e.g. `Asia/Kolkata`. Defaults to the viewer's own. */
  timezone?: string;
  /** Show a clock glyph before the time. */
  icon?: boolean;
  /** Append the offset, e.g. "09:41 GMT+5:30". */
  showOffset?: boolean;
  /**
   * Wrap in a tooltip naming the zone, its date, and how far it is from the
   * viewer. Off by default — inside a tooltip or a menu it would nest.
   */
  withHint?: boolean;
  /** Label for the hint, when this clock is someone else's. */
  hintName?: string;
}

/**
 * Live wall-clock time in one timezone.
 *
 * Renders a `<time>` with a machine-readable `dateTime`, so the value is still
 * meaningful to anything reading the markup rather than looking at it.
 */
export function LocalTime({
  timezone,
  icon = false,
  showOffset = false,
  withHint = false,
  hintName,
  className,
  ...props
}: LocalTimeProps) {
  const now = useMinuteTick();
  const viewerZone = getSystemTimezone();
  const zone = timezone || viewerZone;

  const time = formatTimeInZone(now, zone);
  const element = (
    <time
      dateTime={now.toISOString()}
      className={cn('inline-flex items-center gap-1.5 tabular-nums', className)}
      {...props}
    >
      {icon ? <Clock className="size-3.5 shrink-0 opacity-70" aria-hidden /> : null}
      <span>{time}</span>
      {showOffset ? (
        <span className="text-subtle">{formatZoneOffset(zone, now)}</span>
      ) : null}
    </time>
  );

  if (!withHint) return element;

  const difference =
    zone === viewerZone ? null : formatZoneDifference(zone, viewerZone, now);

  return (
    <Hint
      label={
        <span className="block text-left">
          <span className="block font-medium">
            {hintName ? `${hintName} · ` : ''}
            {formatDateInZone(now, zone)}, {time}
          </span>
          <span className="block text-[11px] opacity-80">
            {zone.replace(/_/g, ' ')} · {formatZoneOffset(zone, now)}
            {difference ? ` · ${difference}` : ''}
          </span>
        </span>
      }
    >
      {element}
    </Hint>
  );
}
