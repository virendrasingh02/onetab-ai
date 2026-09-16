import type { CalendarEvent } from '@org/types';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Panel,
  SkeletonList,
  toast,
  usePromptDialog,
  UserAvatar,
} from '@org/ui';
import { cn, formatDateTime, formatRelative } from '@org/utils';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  Edit3,
  MapPin,
  MessageSquare,
  Plus,
  Send,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useScheduledMessagesStore, type ScheduledMessage } from '@org/chat-ui';
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

  const {
    messages: allScheduledMessages,
    rescheduleMessage,
    markAsSent,
    deleteScheduledMessage,
  } = useScheduledMessagesStore();

  const [activeTab, setActiveTab] = useState<'messages' | 'events'>('messages');
  const [reschedulingMessage, setReschedulingMessage] =
    useState<ScheduledMessage | null>(null);
  const [newScheduleDatetime, setNewScheduleDatetime] = useState('');

  const scheduledMessages = useMemo(() => {
    return allScheduledMessages
      .filter(
        (m) => !m.workspaceId || !workspaceId || m.workspaceId === workspaceId,
      )
      .sort(
        (a, b) =>
          new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
      );
  }, [allScheduledMessages, workspaceId]);

  const pendingCount = useMemo(
    () => scheduledMessages.filter((m) => m.status === 'pending').length,
    [scheduledMessages],
  );

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
    <div className="min-h-0 flex flex-1 flex-col">
      {/* Channel-style Header */}
      <div className="border-b border-border bg-background">
        <div className="gap-2.5 px-3 sm:px-6 py-2 min-h-12 flex flex-wrap items-center justify-between">
          <div className="min-w-0 gap-3 sm:gap-6 flex flex-wrap items-center">
            <div className="min-w-0 gap-1.5 flex items-center">
              <CalendarClock
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <h2 className="text-sm font-semibold tracking-tight truncate text-foreground">
                Schedule
              </h2>
            </div>

            {/* View Switcher: Scheduled Messages vs Calendar Events */}
            <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('messages')}
                className={cn(
                  'px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5',
                  activeTab === 'messages'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span>Scheduled Messages</span>
                {pendingCount > 0 ? (
                  <Badge
                    variant="primary"
                    className="text-[10px] px-1.5 py-0 h-4 min-w-4 justify-center"
                  >
                    {pendingCount}
                  </Badge>
                ) : null}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('events')}
                className={cn(
                  'px-2.5 py-1 rounded-md font-medium transition-colors flex items-center gap-1.5',
                  activeTab === 'events'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <span>Calendar Events</span>
                {(events.data?.length ?? 0) > 0 ? (
                  <Badge
                    variant="neutral"
                    className="text-[10px] px-1.5 py-0 h-4 min-w-4 justify-center"
                  >
                    {events.data?.length}
                  </Badge>
                ) : null}
              </button>
            </div>
          </div>

          <div className="gap-2 flex items-center">
            {activeTab === 'events' ? (
              <Button
                asChild
                size="sm"
                className="h-7 text-xs gap-1"
                leadingIcon={<Plus className="size-3.5" />}
              >
                <Link to={`/w/${slug}/meetings`}>New event</Link>
              </Button>
            ) : (
              <Button
                asChild
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
              >
                <Link to={`/w/${slug}/threads`}>Go to Chat</Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="min-h-0 p-4 sm:p-6 flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'messages' ? (
            <Panel>
              {scheduledMessages.length === 0 ? (
                <EmptyState
                  icon={<CalendarClock className="size-6" />}
                  title="No scheduled messages"
                  description="Schedule a message to be sent later from any chat composer using the schedule icon next to the send button."
                  action={
                    <Button asChild size="sm">
                      <Link to={`/w/${slug}/threads`}>Open Conversations</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-border">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      All Scheduled Messages ({scheduledMessages.length})
                    </h3>
                  </div>

                  <ul className="divide-y divide-border">
                    {scheduledMessages.map((msg) => (
                      <li
                        key={msg.id}
                        className="py-4 first:pt-0 last:pb-0 gap-4 flex flex-col sm:flex-row sm:items-start justify-between"
                      >
                        <div className="gap-3 min-w-0 flex items-start flex-1">
                          <span
                            className={cn(
                              'p-2 mt-0.5 shrink-0 rounded-lg',
                              msg.status === 'sent'
                                ? 'bg-success/10 text-success'
                                : msg.status === 'cancelled'
                                ? 'bg-muted text-muted-foreground'
                                : 'bg-primary/10 text-primary',
                            )}
                          >
                            <MessageSquare className="size-4" aria-hidden />
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="gap-2 flex flex-wrap items-center">
                              <h3 className="text-sm font-semibold truncate text-foreground">
                                {msg.channelName
                                  ? `#${msg.channelName}`
                                  : 'Conversation'}
                              </h3>
                              {msg.status === 'pending' ? (
                                <Badge variant="primary" className="text-[10px]">
                                  Scheduled
                                </Badge>
                              ) : msg.status === 'sent' ? (
                                <Badge variant="success" className="text-[10px]">
                                  Sent
                                </Badge>
                              ) : (
                                <Badge variant="neutral" className="text-[10px]">
                                  Cancelled
                                </Badge>
                              )}
                            </div>

                            <p className="mt-1.5 text-xs text-foreground bg-accent/40 rounded-md p-2.5 whitespace-pre-wrap line-clamp-3">
                              {msg.body}
                            </p>

                            <div className="mt-2 gap-3 flex flex-wrap items-center text-[11px] text-muted-foreground">
                              <span className="gap-1 flex items-center font-medium">
                                <Clock className="size-3" aria-hidden />
                                <span>
                                  Scheduled for: {formatDateTime(msg.scheduledFor)}
                                </span>
                                <span className="text-muted-foreground/70">
                                  ({formatRelative(msg.scheduledFor)})
                                </span>
                              </span>
                              {msg.sentAt ? (
                                <span className="gap-1 flex items-center text-success">
                                  <CheckCircle2 className="size-3" aria-hidden />
                                  Delivered {formatDateTime(msg.sentAt)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="gap-1.5 flex shrink-0 items-center self-end sm:self-center">
                          {msg.status === 'pending' ? (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => {
                                  markAsSent(msg.id);
                                  toast.success('Message sent!');
                                }}
                              >
                                <Send className="size-3" />
                                <span>Send now</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => {
                                  setReschedulingMessage(msg);
                                  const d = new Date(msg.scheduledFor);
                                  setNewScheduleDatetime(
                                    new Date(
                                      d.getTime() - d.getTimezoneOffset() * 60000,
                                    )
                                      .toISOString()
                                      .slice(0, 16),
                                  );
                                }}
                              >
                                <Edit3 className="size-3" />
                                <span>Reschedule</span>
                              </Button>
                            </>
                          ) : null}

                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Delete scheduled message"
                            onClick={async () => {
                              const confirmed = await prompts.confirmAction({
                                title: 'Delete scheduled message?',
                                description:
                                  msg.status === 'pending'
                                    ? 'This scheduled message will be cancelled and removed from the schedule.'
                                    : 'This message entry will be removed.',
                                confirmLabel: 'Delete',
                                destructive: true,
                              });
                              if (confirmed) {
                                deleteScheduledMessage(msg.id);
                                toast.success('Scheduled message removed');
                              }
                            }}
                          >
                            <Trash2 className="size-4 text-subtle hover:text-destructive" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Panel>
          ) : (
            <Panel>
              {events.isLoading ? (
                <SkeletonList rows={5} />
              ) : events.isError ? (
                <EmptyState
                  icon={<TriangleAlert />}
                  title="Could not load the schedule"
                  description="Something went wrong fetching this workspace's calendar."
                  action={
                    <Button
                      variant="outline"
                      onClick={() => void events.refetch()}
                    >
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
                      <h2 className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        {day}
                      </h2>
                      <ul className="divide-y divide-border">
                        {dayEvents.map((event) => (
                          <li
                            key={event.id}
                            className="py-4 first:pt-0 last:pb-0 gap-4 flex items-center justify-between"
                          >
                            <div className="gap-3 min-w-0 flex items-start">
                              <span className="p-2 mt-0.5 shrink-0 rounded-lg bg-primary/10 text-primary">
                                <Clock className="size-4" aria-hidden />
                              </span>
                              <div className="min-w-0">
                                <div className="gap-2 flex items-center">
                                  <h3 className="text-sm font-semibold truncate text-foreground">
                                    {event.title}
                                  </h3>
                                  {event.isAllDay ? (
                                    <Badge variant="neutral">All day</Badge>
                                  ) : null}
                                </div>
                                {event.description ? (
                                  <p className="mt-1 text-xs line-clamp-2 text-muted-foreground">
                                    {event.description}
                                  </p>
                                ) : null}
                                <div className="mt-1 gap-3 flex flex-wrap items-center font-mono text-[11px] text-subtle">
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

                            <div className="gap-2 flex shrink-0 items-center">
                              <UserAvatar
                                name={
                                  event.organizer.displayName ??
                                  event.organizer.name
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
                                onClick={() =>
                                  confirmDelete(event.title, event.id)
                                }
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
          )}

          {reschedulingMessage ? (
            <Dialog
              open={Boolean(reschedulingMessage)}
              onOpenChange={(open) => !open && setReschedulingMessage(null)}
            >
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <CalendarClock className="size-4 text-primary" />
                    <span>Reschedule message</span>
                  </DialogTitle>
                  <DialogDescription>
                    Choose a new delivery time for this scheduled message.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3 py-2">
                  <div className="p-2.5 rounded bg-muted/60 text-xs text-foreground line-clamp-3">
                    {reschedulingMessage.body}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      New scheduled date & time
                    </label>
                    <input
                      type="datetime-local"
                      value={newScheduleDatetime}
                      min={new Date().toISOString().slice(0, 16)}
                      onChange={(e) => setNewScheduleDatetime(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                <DialogFooter className="gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setReschedulingMessage(null)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!newScheduleDatetime) return;
                      const date = new Date(newScheduleDatetime);
                      if (isNaN(date.getTime()) || date.getTime() <= Date.now()) {
                        toast.error('Please pick a future date and time');
                        return;
                      }
                      rescheduleMessage(
                        reschedulingMessage.id,
                        date.toISOString(),
                      );
                      toast.success(
                        `Rescheduled for ${date.toLocaleString([], {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}`,
                      );
                      setReschedulingMessage(null);
                    }}
                  >
                    Save Schedule
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}

          {prompts.dialog}
        </div>
      </div>
    </div>
  );
}
