import {
  Button,
  confirm,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Field,
  Input,
  Spinner,
  Textarea,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  useIntegrationActionQuery,
  useExecuteIntegrationAction,
  useIntegrationMutations,
} from './use-integrations.js';

interface GCalEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: string;
  end?: string;
  allDay?: boolean;
  attendees?: Array<{ email: string; name?: string; responseStatus?: string }>;
  organizer?: { email?: string; displayName?: string };
  isRecurring?: boolean;
}

interface GoogleCalendarModalProps {
  workspaceId: string;
  integrationId: string;
  accountEmail?: string;
  isOpen: boolean;
  onClose: () => void;
}

const WINDOW_DAYS = 14;

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function formatDayHeading(d: Date) {
  const today = startOfDay(new Date());
  const diffDays = Math.round((startOfDay(d).getTime() - today.getTime()) / 86_400_000);
  const weekday = d.toLocaleDateString(undefined, { weekday: 'long' });
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (diffDays === 0) return `Today · ${date}`;
  if (diffDays === 1) return `Tomorrow · ${date}`;
  return `${weekday} · ${date}`;
}

function formatEventTime(event: GCalEvent) {
  if (event.allDay) return 'All day';
  if (!event.start) return '';
  const start = new Date(event.start);
  const end = event.end ? new Date(event.end) : undefined;
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  return end ? `${start.toLocaleTimeString(undefined, opts)} – ${end.toLocaleTimeString(undefined, opts)}` : start.toLocaleTimeString(undefined, opts);
}

export function GoogleCalendarModal({
  workspaceId,
  integrationId,
  accountEmail,
  isOpen,
  onClose,
}: GoogleCalendarModalProps) {
  const [windowStart, setWindowStart] = useState(() => startOfDay(new Date()));
  const [selectedEvent, setSelectedEvent] = useState<GCalEvent | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState({
    summary: '',
    location: '',
    description: '',
    start: '',
    end: '',
    attendees: '',
  });

  const windowEnd = useMemo(
    () => new Date(windowStart.getTime() + WINDOW_DAYS * 86_400_000),
    [windowStart],
  );

  const eventsQuery = useIntegrationActionQuery<{ events: GCalEvent[] }>(
    workspaceId,
    integrationId,
    'list_events',
    { timeMin: windowStart.toISOString(), timeMax: windowEnd.toISOString(), maxResults: 100 },
    { enabled: isOpen },
  );

  const { sync } = useIntegrationMutations(workspaceId);
  const runAction = useExecuteIntegrationAction(workspaceId);

  const eventsByDay = useMemo(() => {
    const groups = new Map<string, GCalEvent[]>();
    for (const event of eventsQuery.data?.events ?? []) {
      if (!event.start) continue;
      const key = startOfDay(new Date(event.start)).toISOString();
      const list = groups.get(key) ?? [];
      list.push(event);
      groups.set(key, list);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [eventsQuery.data]);

  const resetForm = () =>
    setForm({ summary: '', location: '', description: '', start: '', end: '', attendees: '' });

  const handleCreate = async () => {
    if (!form.summary.trim() || !form.start || !form.end) {
      toast.error('Title, start, and end are required.');
      return;
    }
    const attendees = form.attendees
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);

    const ok = await confirm({
      title: `Create "${form.summary}"?`,
      description: `${new Date(form.start).toLocaleString()} → ${new Date(form.end).toLocaleString()}${attendees.length ? ` · Invites ${attendees.length} attendee(s)` : ''}`,
    });
    if (!ok) return;

    try {
      const result = await runAction.mutateAsync({
        integrationId,
        actionId: 'create_event',
        confirm: true,
        input: {
          summary: form.summary,
          description: form.description || undefined,
          location: form.location || undefined,
          start: new Date(form.start).toISOString(),
          end: new Date(form.end).toISOString(),
          attendees: attendees.length ? attendees : undefined,
        },
      });
      if (!result.success) throw new Error(result.message);
      toast.success('Event created.');
      setIsCreating(false);
      resetForm();
      eventsQuery.refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to create event.');
    }
  };

  const handleDelete = async (event: GCalEvent) => {
    const ok = await confirm({
      title: `Delete "${event.summary}"?`,
      description: 'Attendees will be notified this event was cancelled.',
      destructive: true,
      confirmLabel: 'Delete event',
    });
    if (!ok) return;

    try {
      const result = await runAction.mutateAsync({
        integrationId,
        actionId: 'delete_event',
        confirm: true,
        input: { eventId: event.id },
      });
      if (!result.success) throw new Error(result.message);
      toast.success('Event deleted.');
      setSelectedEvent(null);
      eventsQuery.refetch();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to delete event.');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 py-3.5 border-b border-border shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 gap-2 flex items-center">
              <CalendarDays className="size-4 shrink-0 text-muted-foreground" />
              <DialogTitle className="truncate text-sm">
                Google Calendar{accountEmail ? ` — ${accountEmail}` : ''}
              </DialogTitle>
            </div>
            <div className="gap-1.5 flex items-center">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setIsCreating((v) => !v);
                  setSelectedEvent(null);
                }}
              >
                <Plus className="size-3.5" /> New event
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Sync now"
                disabled={sync.isPending}
                onClick={() => sync.mutate(integrationId, { onSuccess: () => eventsQuery.refetch() })}
              >
                <RefreshCw className={cn('size-3.5', sync.isPending && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="px-5 py-2 border-b border-border flex items-center justify-between shrink-0">
          <Button size="icon-sm" variant="ghost" aria-label="Previous week" onClick={() => setWindowStart((d) => new Date(d.getTime() - 7 * 86_400_000))}>
            <ChevronLeft className="size-4" />
          </Button>
          <p className="text-xs font-semibold text-muted-foreground">
            {windowStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} –{' '}
            {new Date(windowEnd.getTime() - 86_400_000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </p>
          <Button size="icon-sm" variant="ghost" aria-label="Next week" onClick={() => setWindowStart((d) => new Date(d.getTime() + 7 * 86_400_000))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isCreating ? (
            <div className="p-5 space-y-3">
              <Field label="Title" required>
                <Input value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} placeholder="Team sync" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Starts" required>
                  <Input type="datetime-local" value={form.start} onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))} />
                </Field>
                <Field label="Ends" required>
                  <Input type="datetime-local" value={form.end} onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))} />
                </Field>
              </div>
              <Field label="Location" optional>
                <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
              </Field>
              <Field label="Attendees" optional hint="Comma-separated email addresses.">
                <Input value={form.attendees} onChange={(e) => setForm((f) => ({ ...f, attendees: e.target.value }))} placeholder="jane@example.com, sam@example.com" />
              </Field>
              <Field label="Description" optional>
                <Textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </Field>
              <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={() => { setIsCreating(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={runAction.isPending}>
                  {runAction.isPending ? <Spinner className="size-3.5" /> : 'Create event'}
                </Button>
              </div>
            </div>
          ) : selectedEvent ? (
            <div className="p-5 space-y-4">
              <button type="button" onClick={() => setSelectedEvent(null)} className="text-xs font-medium text-muted-foreground hover:text-foreground">
                ← Back to agenda
              </button>
              <div>
                <h3 className="text-base font-semibold text-foreground">{selectedEvent.summary}</h3>
                <p className="mt-1 gap-1.5 flex items-center text-xs text-muted-foreground">
                  <Clock className="size-3.5" /> {formatEventTime(selectedEvent)}
                </p>
                {selectedEvent.location ? (
                  <p className="mt-1 gap-1.5 flex items-center text-xs text-muted-foreground">
                    <MapPin className="size-3.5" /> {selectedEvent.location}
                  </p>
                ) : null}
              </div>
              {selectedEvent.description ? (
                <p className="text-sm whitespace-pre-wrap text-foreground/90">{selectedEvent.description}</p>
              ) : null}
              {selectedEvent.attendees?.length ? (
                <div>
                  <p className="mb-1.5 gap-1.5 flex items-center text-xs font-semibold text-muted-foreground">
                    <Users className="size-3.5" /> Attendees
                  </p>
                  <ul className="space-y-1">
                    {selectedEvent.attendees.map((a) => (
                      <li key={a.email} className="text-xs text-foreground/90">
                        {a.name || a.email} {a.responseStatus ? <span className="text-muted-foreground">· {a.responseStatus}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="pt-2 flex gap-2">
                {selectedEvent.htmlLink ? (
                  <Button variant="outline" size="sm" asChild>
                    <a href={selectedEvent.htmlLink} target="_blank" rel="noreferrer">
                      Open in Google Calendar
                    </a>
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" className="text-danger-text" onClick={() => handleDelete(selectedEvent)}>
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              </div>
            </div>
          ) : eventsQuery.isLoading ? (
            <div className="p-8 flex justify-center">
              <Spinner label="Loading events…" />
            </div>
          ) : eventsQuery.isError ? (
            <ErrorState
              title="Couldn't load your calendar"
              description={eventsQuery.error instanceof Error ? eventsQuery.error.message : 'Please try again.'}
              onRetry={() => eventsQuery.refetch()}
            />
          ) : eventsByDay.length === 0 ? (
            <EmptyState title="No events in this range" description="Try the next week, or create a new event." />
          ) : (
            <div className="divide-y divide-border">
              {eventsByDay.map(([dayKey, events]) => (
                <div key={dayKey} className="px-5 py-3">
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    {formatDayHeading(new Date(dayKey))}
                  </p>
                  <div className="space-y-1">
                    {events.map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => setSelectedEvent(event)}
                        className="w-full px-3 py-2 text-left rounded-lg border border-transparent transition-colors hover:border-border hover:bg-surface-inset"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-foreground">{event.summary}</span>
                          <span className="shrink-0 text-[11px] text-muted-foreground">{formatEventTime(event)}</span>
                        </div>
                        {event.location ? (
                          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{event.location}</span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
