import type { CalendarEvent } from '@org/types';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  Panel,
  SkeletonList,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useCalendarEvents, useCurrentWorkspace } from './use-work-tools.js';

/** Monday-first, matching the column headers. */
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MONTH_LABEL = new Intl.DateTimeFormat(undefined, {
  month: 'long',
  year: 'numeric',
});
const DAY_LABEL = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const TIME_LABEL = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Leading blanks so the 1st lands under its weekday.
 *
 * `getDay()` is Sunday-first but the grid is Monday-first, so Sunday shifts
 * from 0 to 6.
 */
function leadingBlanks(monthStart: Date): number {
  return (monthStart.getDay() + 6) % 7;
}

export function CalendarView() {
  const { workspaceId } = useCurrentWorkspace();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));

  // Ask only for the visible month. The API treats the window as an overlap,
  // so an event spanning the boundary still comes back.
  const [from, to] = useMemo(() => {
    const next = addMonths(month, 1);
    return [month.toISOString(), new Date(next.getTime() - 1).toISOString()];
  }, [month]);

  const query = useCalendarEvents(workspaceId, from, to);

  const today = new Date();
  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
  ).getDate();
  const dates = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const blanks = Array.from({ length: leadingBlanks(month) }, (_, i) => i);

  /** Events grouped by day-of-month so each cell can show a marker. */
  const byDate = useMemo(() => {
    const map = new Map<number, CalendarEvent[]>();
    for (const event of query.data ?? []) {
      const start = new Date(event.startAt);
      if (
        start.getFullYear() !== month.getFullYear() ||
        start.getMonth() !== month.getMonth()
      ) {
        continue;
      }
      const bucket = map.get(start.getDate());
      if (bucket) bucket.push(event);
      else map.set(start.getDate(), [event]);
    }
    return map;
  }, [query.data, month]);

  const agenda = (query.data ?? []).filter((event) =>
    isSameDay(new Date(event.startAt), today),
  );

  const showingCurrentMonth =
    month.getFullYear() === today.getFullYear() &&
    month.getMonth() === today.getMonth();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Channel-style Header */}
      <div className="border-b border-border bg-background">
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 sm:px-6 py-1.5 min-h-12">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <CalendarIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
                Calendar
              </h2>
              <Badge variant="neutral" className="text-[11px] px-1.5 py-0 h-4.5">
                {MONTH_LABEL.format(month)}
              </Badge>
            </div>

            <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

            <p className="hidden min-w-0 max-w-[48ch] truncate text-xs text-muted-foreground sm:block">
              Meetings, due dates and milestones across your workspace
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="p-0.5 flex items-center rounded-lg border border-border bg-surface">
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-6"
                aria-label="Previous month"
                onClick={() => setMonth((current) => addMonths(current, -1))}
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="px-2 text-xs font-medium">
                {MONTH_LABEL.format(month)}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-6"
                aria-label="Next month"
                onClick={() => setMonth((current) => addMonths(current, 1))}
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
            <Button size="sm" className="h-7 text-xs gap-1" leadingIcon={<Plus className="size-3.5" />}>
              Schedule event
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-7xl">

      <div className="gap-6 lg:grid-cols-3 grid flex-1 grid-cols-1">
        <Panel className="lg:col-span-2">
          <div
            role="grid"
            aria-label={MONTH_LABEL.format(month)}
            aria-rowcount={6}
            aria-colcount={7}
          >
            <div
              role="row"
              className="mb-2 gap-2 text-xs font-medium grid grid-cols-7 text-center text-muted-foreground"
            >
              {DAYS.map((day) => (
                <div key={day} role="columnheader">
                  {day}
                </div>
              ))}
            </div>

            <div role="row" className="gap-2 grid grid-cols-7">
              {blanks.map((blank) => (
                <div key={`blank-${blank}`} aria-hidden />
              ))}
              {dates.map((date) => {
                const isToday = showingCurrentMonth && date === today.getDate();
                const dayEvents = byDate.get(date);
                return (
                  <div
                    key={date}
                    role="gridcell"
                    aria-current={isToday ? 'date' : undefined}
                    aria-label={
                      dayEvents
                        ? `${date}: ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`
                        : String(date)
                    }
                    className={cn(
                      'min-h-16 p-2 text-xs flex flex-col justify-between rounded-lg border',
                      'transition-colors duration-(--duration-fast)',
                      isToday
                        ? 'font-semibold border-success/40 bg-success/10 text-success'
                        : 'bg-background hover:border-border-strong',
                    )}
                  >
                    <span>{date}</span>
                    {dayEvents ? (
                      <span
                        aria-hidden
                        className={cn(
                          'size-1.5 self-end rounded-full',
                          isToday ? 'bg-success' : 'bg-primary',
                        )}
                      />
                    ) : isToday ? (
                      <span
                        aria-hidden
                        className="size-1.5 self-end rounded-full bg-success"
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </Panel>

        <Panel title="Today’s agenda" subtitle={DAY_LABEL.format(today)}>
          {query.isLoading ? (
            <SkeletonList rows={3} />
          ) : query.isError ? (
            <ErrorState
              title="Could not load the calendar"
              description="Something went wrong reaching the server."
              onRetry={() => query.refetch()}
            />
          ) : agenda.length === 0 ? (
            <EmptyState
              icon={<CalendarIcon />}
              title="Nothing scheduled today"
              description="Events you or your teammates schedule will show up here."
            />
          ) : (
            <ul className="space-y-3">
              {agenda.map((event) => (
                <li
                  key={event.id}
                  className="p-3 rounded-lg border bg-surface-muted"
                >
                  <div className="mb-1 gap-2 flex items-center justify-between">
                    <span className="gap-1 text-xs flex items-center font-mono text-success">
                      <Clock className="size-3" aria-hidden />{' '}
                      {event.isAllDay
                        ? 'All day'
                        : TIME_LABEL.format(new Date(event.startAt))}
                    </span>
                    <Badge variant="neutral" className="text-[10px] uppercase">
                      Meeting
                    </Badge>
                  </div>
                  <h3 className="text-sm font-medium text-foreground">
                    {event.title}
                  </h3>
                  {event.location ? (
                    <p className="mt-1 gap-1 text-xs flex items-center text-muted-foreground">
                      <MapPin className="size-3 shrink-0" aria-hidden />
                      {event.location}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
        </div>
      </div>
    </div>
  );
}
