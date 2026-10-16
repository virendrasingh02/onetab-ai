import type { CalendarEvent, ScheduledMessageView } from '@org/types';
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogBody,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Panel,
  SkeletonList,
  toast,
  usePromptDialog,
  UserAvatar,
  PageBar,
  PageTabBar,
  Tabs,
  TabsTrigger,
  DateTimePicker,
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
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useScheduledMessages,
  useScheduledMessageMutations,
} from '@org/web-chat';
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

  const scheduledMessagesQuery = useScheduledMessages(workspaceId);
  const scheduledMessageMutations = useScheduledMessageMutations(workspaceId);

  const [activeTab, setActiveTab] = useState<'messages' | 'events'>('messages');
  const [reschedulingMessage, setReschedulingMessage] =
    useState<ScheduledMessageView | null>(null);
  const [newScheduleDatetime, setNewScheduleDatetime] = useState('');

  const scheduledMessages = useMemo(() => {
    return [...(scheduledMessagesQuery.data ?? [])].sort(
      (a, b) =>
        new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
    );
  }, [scheduledMessagesQuery.data]);

  const pendingCount = useMemo(
    () => scheduledMessages.filter((m) => m.status === 'PENDING').length,
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
      <PageBar
        icon={<CalendarClock />}
        title="Schedule"
        hasTabs
        actions={
          activeTab === 'events' ? (
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
          )
        }
      />

      {/* Scheduled messages vs calendar events */}
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as 'messages' | 'events')}
      >
        <PageTabBar>
          <TabsTrigger
            value="messages"
            count={pendingCount > 0 ? pendingCount : undefined}
          >
            Scheduled Messages
          </TabsTrigger>
          <TabsTrigger
            value="events"
            count={
              (events.data?.length ?? 0) > 0 ? events.data?.length : undefined
            }
          >
            Calendar Events
          </TabsTrigger>
        </PageTabBar>
      </Tabs>

      <div className="min-h-0 p-4 sm:p-6 flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          {activeTab === 'messages' ? (
            <Panel>
              {scheduledMessagesQuery.isLoading ? (
                <SkeletonList rows={3} />
              ) : scheduledMessages.length === 0 ? (
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
                  <div className="pb-2 flex items-center justify-between border-b border-border">
                    <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                      All Scheduled Messages ({scheduledMessages.length})
                    </h3>
                  </div>

                  <ul className="divide-y divide-border">
                    {scheduledMessages.map((msg) => (
                      <li
                        key={msg.id}
                        className="py-4 first:pt-0 last:pb-0 gap-4 sm:flex-row sm:items-start flex flex-col justify-between"
                      >
                        <div className="gap-3 min-w-0 flex flex-1 items-start">
                          <span
                            className={cn(
                              'p-2 mt-0.5 shrink-0 rounded-lg',
                              msg.status === 'SENT'
                                ? 'bg-success/10 text-success'
                                : msg.status === 'FAILED'
                                  ? 'bg-destructive/10 text-destructive'
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
                              {msg.status === 'PENDING' ? (
                                <Badge
                                  variant="primary"
                                  className="text-[10px]"
                                >
                                  Scheduled
                                </Badge>
                              ) : msg.status === 'SENT' ? (
                                <Badge
                                  variant="success"
                                  className="text-[10px]"
                                >
                                  Sent
                                </Badge>
                              ) : (
                                <Badge
                                  variant="destructive"
                                  className="text-[10px]"
                                >
                                  Failed
                                </Badge>
                              )}
                            </div>

                            <p className="mt-1.5 text-xs p-2.5 line-clamp-3 rounded-md bg-accent/40 whitespace-pre-wrap text-foreground">
                              {msg.body}
                            </p>

                            <div className="mt-2 gap-3 flex flex-wrap items-center text-[11px] text-muted-foreground">
                              <span className="gap-1 font-medium flex items-center">
                                <Clock className="size-3" aria-hidden />
                                <span>
                                  Scheduled for:{' '}
                                  {formatDateTime(msg.scheduledFor)}
                                </span>
                                <span className="text-muted-foreground/70">
                                  ({formatRelative(msg.scheduledFor)})
                                </span>
                              </span>
                              {msg.sentAt ? (
                                <span className="gap-1 flex items-center text-success">
                                  <CheckCircle2
                                    className="size-3"
                                    aria-hidden
                                  />
                                  Delivered {formatDateTime(msg.sentAt)}
                                </span>
                              ) : null}
                              {msg.status === 'FAILED' && msg.errorMessage ? (
                                <span className="text-destructive">
                                  {msg.errorMessage}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="gap-1.5 sm:self-center flex shrink-0 items-center self-end">
                          {msg.status === 'PENDING' ? (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => {
                                  setReschedulingMessage(msg);
                                  const d = new Date(msg.scheduledFor);
                                  setNewScheduleDatetime(
                                    new Date(
                                      d.getTime() -
                                        d.getTimezoneOffset() * 60000,
                                    )
                                      .toISOString()
                                      .slice(0, 16),
                                  );
                                }}
                              >
                                <Edit3 className="size-3" />
                                <span>Reschedule</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label="Cancel scheduled message"
                                onClick={async () => {
                                  const confirmed = await prompts.confirmAction(
                                    {
                                      title: 'Cancel scheduled message?',
                                      description:
                                        'It will not be sent, and is removed from this list.',
                                      confirmLabel: 'Cancel message',
                                      destructive: true,
                                    },
                                  );
                                  if (confirmed) {
                                    scheduledMessageMutations.cancel.mutate(
                                      msg.id,
                                    );
                                  }
                                }}
                              >
                                <Trash2 className="size-4 text-subtle hover:text-destructive" />
                              </Button>
                            </>
                          ) : null}
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
                  <DialogTitle className="gap-2 flex items-center">
                    <CalendarClock className="size-4 text-primary" />
                    <span>Reschedule message</span>
                  </DialogTitle>
                  <DialogDescription>
                    Choose a new delivery time for this scheduled message.
                  </DialogDescription>
                </DialogHeader>

                <DialogBody className="space-y-3">
                  <div className="p-2.5 rounded text-xs line-clamp-3 bg-muted/60 text-foreground">
                    {reschedulingMessage.body}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      New scheduled date & time
                    </label>
                    <DateTimePicker
                      disablePast
                      value={newScheduleDatetime}
                      onChange={(v) => setNewScheduleDatetime(v ?? '')}
                    />
                  </div>
                </DialogBody>

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
                    loading={scheduledMessageMutations.update?.isPending}
                    onClick={() => {
                      if (!newScheduleDatetime || !reschedulingMessage) return;
                      const date = new Date(newScheduleDatetime);
                      if (
                        isNaN(date.getTime()) ||
                        date.getTime() <= Date.now()
                      ) {
                        toast.error('Please pick a future date and time');
                        return;
                      }
                      scheduledMessageMutations.update.mutate(
                        {
                          id: reschedulingMessage.id,
                          input: { scheduledFor: date.toISOString() },
                        },
                        {
                          onSuccess: () => {
                            toast.success(
                              `Rescheduled for ${date.toLocaleString([], {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })}`,
                            );
                            setReschedulingMessage(null);
                          },
                        },
                      );
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
