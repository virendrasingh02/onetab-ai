import type { CalendarEvent } from '@org/types';
import {
  Badge,
  Button,
  EmptyState,
  Panel,
  SkeletonList,
  usePromptDialog,
  UserAvatar,
} from '@org/ui';
import { formatDateTime, formatRelative } from '@org/utils';
import { CalendarClock, Clock, MapPin, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  useCalendarEvents,
  useCalendarMutations,
  useCurrentWorkspace,
} from './use-work-tools.js';

/** How far ahead the schedule looks. Beyond this it is a calendar, not a queue. */
const HORIZON_DAYS = 30;

function isoOffsetDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/** Groups events under a date heading in the viewer's own timezone. */
function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function ScheduleView() {
  const { slug, workspaceId } = useCurrentWorkspace();
  const events = useCalendarEvents(
    workspaceId,
    new Date().toISOString(),
    isoOffsetDays(HORIZON_DAYS),
  );
  const { remove } = useCalendarMutations(workspaceId);
  const prompts = usePromptDialog();

  /* Removing an event clears it for every attendee, so confirm first. */
  const confirmDelete = async (title: string, id: string) => {
    const confirmed = await prompts.confirmAction({
      title: `Delete “${title}”?`,
      description:
        'The event is removed from the schedule for everyone. This cannot be undone.',
      confirmLabel: 'Delete event',
      destructive: true,
    });
    if (confirmed) remove.mutate(id);
  };

  const groups = new Map<string, CalendarEvent[]>();
  for (const event of events.data ?? []) {
    const key = dayKey(event.startAt);
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Channel-style Header */}
      <div className="border-b border-border bg-background">
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 sm:px-6 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
                Schedule
              </h2>
              <Badge variant="neutral" className="text-[11px] px-1.5 py-0 h-4.5">
                {events.data?.length ?? 0} events
              </Badge>
            </div>

            <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

            <p className="hidden min-w-0 max-w-[48ch] truncate text-xs text-muted-foreground sm:block">
              Everything scheduled across the next {HORIZON_DAYS} days
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild size="sm" className="h-7 text-xs gap-1" leadingIcon={<Plus className="size-3.5" />}>
              <Link to={`/w/${slug}/meetings`}>New event</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-5xl">

      <Panel>
        {events.isLoading ? (
          <SkeletonList rows={5} />
        ) : events.isError ? (
          <EmptyState
            icon={<TriangleAlert />}
            title="Could not load the schedule"
            description="Something went wrong fetching this workspace's calendar."
            action={
              <Button variant="outline" onClick={() => void events.refetch()}>
                Try again
              </Button>
            }
          />
        ) : groups.size === 0 ? (
          <EmptyState
            icon={<Clock />}
            title="Nothing scheduled"
            description={`No events fall in the next ${HORIZON_DAYS} days.`}
            action={
              <Button asChild size="sm">
                <Link to={`/w/${slug}/meetings`}>Schedule something</Link>
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            {[...groups].map(([day, dayEvents]) => (
              <section key={day}>
                <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {day}
                </h2>
                <ul className="divide-y divide-border">
                  {dayEvents.map((event) => (
                    <li
                      key={event.id}
                      className="py-4 first:pt-0 last:pb-0 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span className="p-2 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                          <Clock className="size-4" aria-hidden />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-foreground truncate">
                              {event.title}
                            </h3>
                            {event.isAllDay ? (
                              <Badge variant="neutral">All day</Badge>
                            ) : null}
                          </div>
                          {event.description ? (
                            <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                              {event.description}
                            </p>
                          ) : null}
                          <div className="mt-1 gap-3 text-[11px] text-subtle flex flex-wrap items-center font-mono">
                            <span className="gap-1 flex items-center">
                              <Clock className="size-3" aria-hidden />
                              {event.isAllDay
                                ? formatRelative(event.startAt)
                                : formatDateTime(event.startAt)}
                            </span>
                            {event.location ? (
                              <span className="gap-1 flex items-center">
                                <MapPin className="size-3" aria-hidden />
                                {event.location}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <UserAvatar
                          name={
                            event.organizer.displayName ?? event.organizer.name
                          }
                          src={event.organizer.avatarUrl}
                          seed={event.organizer.id}
                          size="xs"
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete ${event.title}`}
                          disabled={remove.isPending}
                          onClick={() => confirmDelete(event.title, event.id)}
                        >
                          <Trash2 className="size-4 text-subtle hover:text-destructive" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Panel>

      {prompts.dialog}
        </div>
      </div>
    </div>
  );
}
