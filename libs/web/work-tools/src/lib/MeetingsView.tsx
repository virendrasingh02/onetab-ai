import type { Meeting } from '@org/types';
import {
  accentClasses,
  Badge,
  Button,
  Card,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Panel,
  SkeletonList,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
  UserAvatarGroup,
} from '@org/ui';
import { cn, formatDateTime } from '@org/utils';
import {
  useIntegrationMutations,
  useIntegrations,
} from '@org/web-integrations';
import {
  CalendarClock,
  Check,
  ExternalLink,
  Link2,
  MoreHorizontal,
  Pencil,
  Plus,
  Radio,
  Share2,
  Trash2,
  TriangleAlert,
  Video,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { MeetingDetailSheet } from './meetings/meeting-detail-sheet.js';
import { MeetingScheduleDialog } from './meetings/meeting-schedule-dialog.js';
import {
  useCurrentWorkspace,
  useMeetingMutations,
  useMeetings,
} from './use-work-tools.js';

interface MeetingApp {
  id: string;
  /** Provider code stored by the integrations API, or `null` when inbuilt. */
  provider: string | null;
  /** Other codes the same app is stored under, so a match is never missed. */
  aliases?: string[];
  name: string;
  blurb: string;
  accent: keyof typeof accentClasses;
}

/**
 * The inbuilt huddle. It needs no integration, so it is always listed and can
 * never be disconnected.
 */
const INBUILT_HUDDLE: MeetingApp = {
  id: 'huddle',
  provider: null,
  name: 'OneTab Inbuilt Huddle',
  blurb: 'Natively built-in high performance Matrix video and voice huddles.',
  accent: 'teal',
};

/**
 * Meeting and calendar apps the workspace can link.
 *
 * `provider` is the key the integrations API stores, upper-cased on the way
 * in by the controller — the same string `useIntegrations` reports back. The
 * app hub connects some of these under a shorter code (Google Calendar goes in
 * as `GCAL`), which is what `aliases` covers.
 */
const MEETING_APP_CATALOG: MeetingApp[] = [
  {
    id: 'zoom',
    provider: 'ZOOM',
    aliases: ['ZOOM_MEETINGS'],
    name: 'Zoom Meetings',
    blurb:
      'Connect Zoom to sync calls, calendar invitations and meeting links into OneTab.',
    accent: 'blue',
  },
  {
    id: 'gmeet',
    provider: 'GOOGLE_MEET',
    aliases: ['GMEET'],
    name: 'Google Meet',
    blurb:
      'Connect Google Meet to sync calls, calendar invitations and meeting links into OneTab.',
    accent: 'green',
  },
  {
    id: 'msteams',
    provider: 'MICROSOFT_TEAMS',
    aliases: ['TEAMS', 'MS_TEAMS'],
    name: 'Microsoft Teams',
    blurb:
      'Connect Teams to sync calls, calendar invitations and meeting links into OneTab.',
    accent: 'indigo',
  },
  {
    id: 'gcal',
    provider: 'GCAL',
    aliases: ['GOOGLE_CALENDAR'],
    name: 'Google Calendar',
    blurb:
      'Pull Google Calendar invitations in so their events and join links land on this page.',
    accent: 'amber',
  },
  {
    id: 'outlook',
    provider: 'OUTLOOK',
    aliases: ['MICROSOFT_OUTLOOK', 'MS_OUTLOOK', 'OUTLOOK_CALENDAR'],
    name: 'Microsoft Outlook',
    blurb:
      'Pull Outlook calendar invitations in so their events and join links land on this page.',
    accent: 'cyan',
  },
  {
    id: 'webex',
    provider: 'WEBEX',
    aliases: ['CISCO_WEBEX'],
    name: 'Cisco Webex',
    blurb:
      'Connect Webex to sync calls, calendar invitations and meeting links into OneTab.',
    accent: 'violet',
  },
];

/** Every provider code the catalogue answers to. */
const CATALOG_CODES = new Set(
  MEETING_APP_CATALOG.flatMap((app) => [
    app.provider as string,
    ...(app.aliases ?? []),
  ]),
);

/**
 * Provider codes that read as a meeting or calendar app.
 *
 * Anything connected outside the catalogue is matched against this so a
 * workspace that links a meeting app we do not ship a card for still sees it
 * here rather than nowhere.
 */
const MEETING_PROVIDER_HINT =
  /MEET|CALENDAR|CALL|CONFERENC|HUDDLE|WEBINAR|VIDEO|ZOOM|TEAMS|WEBEX|OUTLOOK|CAL$/;

/** `OUTLOOK_CALENDAR` → `Outlook Calendar`, for apps with no catalogue entry. */
function humanizeProvider(provider: string): string {
  return provider
    .toLowerCase()
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** How far ahead the "past" list reaches back and the "upcoming" list looks. */
const HORIZON_DAYS = 60;

function isoOffsetDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/** The join link for a meeting, when `location` is a URL. */
function joinUrlOf(meeting: Meeting): string | null {
  const location = meeting.location?.trim();
  if (!location) return null;
  return /^https?:\/\//i.test(location) ? location : null;
}

function isLive(meeting: Meeting): boolean {
  if (meeting.status !== 'SCHEDULED') return false;
  const now = Date.now();
  return Date.parse(meeting.startAt) <= now && now < Date.parse(meeting.endAt);
}

function durationLabel(meeting: Meeting): string {
  const minutes = Math.round(
    (Date.parse(meeting.endAt) - Date.parse(meeting.startAt)) / 60_000,
  );
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

const STATUS_META: Record<
  Meeting['status'],
  { label: string; variant: 'primary' | 'neutral' | 'destructive' }
> = {
  SCHEDULED: { label: 'Scheduled', variant: 'primary' },
  LIVE: { label: 'Live now', variant: 'destructive' },
  ENDED: { label: 'Ended', variant: 'neutral' },
  CANCELLED: { label: 'Cancelled', variant: 'destructive' },
};

/**
 * One meeting app, connected or not.
 *
 * The inbuilt huddle has no provider to disconnect, so it shows a badge in
 * place of the toggle.
 */
function MeetingAppCard({
  app,
  connected,
  busy,
  onToggle,
}: {
  app: MeetingApp;
  connected: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  const isInbuilt = !app.provider;

  return (
    <Card className="p-5 flex flex-col justify-between">
      <div>
        <div className="gap-3 mb-3 flex items-center">
          <span
            className={cn(
              'size-10 font-bold text-sm flex items-center justify-center rounded-lg',
              accentClasses[app.accent].soft,
            )}
            aria-hidden
          >
            {app.name.charAt(0)}
          </span>
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              {app.name}
            </h4>
            <p className="text-xs text-muted-foreground">
              {isInbuilt
                ? 'Built-in native'
                : connected
                  ? 'Connected to this workspace'
                  : 'Not connected'}
            </p>
          </div>
        </div>
        <p className="text-xs leading-relaxed mb-4 text-muted-foreground">
          {app.blurb}
        </p>
      </div>

      {isInbuilt ? (
        <Badge variant="primary" className="w-fit">
          Natively active
        </Badge>
      ) : (
        <Button
          variant={connected ? 'outline' : 'primary'}
          size="sm"
          className="w-full"
          loading={busy}
          onClick={onToggle}
          leadingIcon={
            connected ? <Check className="text-success" /> : <Plus />
          }
        >
          {connected ? 'Disconnect' : 'Connect app'}
        </Button>
      )}
    </Card>
  );
}

function MeetingCard({
  meeting,
  onOpen,
  onEdit,
  onCancel,
  onDelete,
}: {
  meeting: Meeting;
  onOpen: () => void;
  onEdit: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const joinUrl = joinUrlOf(meeting);
  const live = isLive(meeting);
  const status = live ? STATUS_META.LIVE : STATUS_META[meeting.status];
  const attendees = meeting.participants.map((p) => p.user);

  return (
    <Panel className="flex flex-col justify-between">
      <div>
        <div className="gap-2 flex items-start justify-between">
          <button type="button" onClick={onOpen} className="min-w-0 text-left">
            <h3 className="text-sm font-semibold truncate text-foreground hover:underline">
              {meeting.title}
            </h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {formatDateTime(meeting.startAt)} · {durationLabel(meeting)}
            </p>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Actions for ${meeting.title}`}
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={onOpen}>
                <CalendarClock className="size-4" aria-hidden />
                Open details
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={onEdit}
                disabled={
                  meeting.status === 'CANCELLED' || meeting.status === 'ENDED'
                }
              >
                <Pencil className="size-4" aria-hidden />
                Edit meeting
              </DropdownMenuItem>
              {joinUrl ? (
                <DropdownMenuItem
                  onSelect={() => {
                    void navigator.clipboard.writeText(joinUrl);
                    toast.success('Join link copied');
                  }}
                >
                  <Link2 className="size-4" aria-hidden />
                  Copy join link
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={onCancel}
                disabled={meeting.status === 'CANCELLED'}
              >
                <X className="size-4" aria-hidden />
                Cancel meeting
              </DropdownMenuItem>
              <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                <Trash2 className="size-4" aria-hidden />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {meeting.description ? (
          <p className="mt-2 text-xs line-clamp-2 text-muted-foreground">
            {meeting.description}
          </p>
        ) : null}

        <div className="mt-3 gap-2 flex flex-wrap items-center">
          <Badge
            variant={status.variant}
            className={cn(live && 'animate-pulse')}
          >
            {status.label}
          </Badge>
          {meeting.project ? (
            <Badge variant="outline">{meeting.project.name}</Badge>
          ) : null}
          {attendees.length > 0 ? (
            <UserAvatarGroup users={attendees} size="xs" max={5} />
          ) : null}
          {meeting._count.actionItems > 0 ? (
            <span className="text-[11px] text-muted-foreground">
              {meeting._count.actionItems} action item
              {meeting._count.actionItems === 1 ? '' : 's'}
            </span>
          ) : null}
        </div>
      </div>

      {joinUrl ? (
        <Button
          asChild
          className="mt-4 w-full"
          variant={live ? 'primary' : 'outline'}
        >
          <a href={joinUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" aria-hidden />
            {live ? 'Join now' : 'Open meeting link'}
          </a>
        </Button>
      ) : (
        <Button variant="outline" className="mt-4 w-full" onClick={onOpen}>
          Open details
        </Button>
      )}
    </Panel>
  );
}

/** Scheduled and live meetings for the workspace, with connected meeting apps. */
export function MeetingsView() {
  const { workspaceId } = useCurrentWorkspace();
  const meetingsQuery = useMeetings(workspaceId, {
    from: isoOffsetDays(-HORIZON_DAYS),
    to: isoOffsetDays(HORIZON_DAYS),
  });
  const { cancel, remove } = useMeetingMutations(workspaceId);
  const integrations = useIntegrations(workspaceId);
  const { connect, disconnect } = useIntegrationMutations(workspaceId);

  const [activeTab, setActiveTab] = useState('upcoming');
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [editMeeting, setEditMeeting] = useState<Meeting | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const connectedProviders = useMemo(
    () =>
      new Set(
        (integrations.data ?? [])
          .filter((row) => row.status === 'CONNECTED')
          .map((row) => row.provider.toUpperCase()),
      ),
    [integrations.data],
  );

  const meetings = meetingsQuery.data ?? [];
  const now = Date.now();
  const upcoming = meetings.filter(
    (mtg) =>
      mtg.status !== 'CANCELLED' &&
      mtg.status !== 'ENDED' &&
      Date.parse(mtg.endAt) >= now,
  );
  const liveMeetings = meetings.filter(isLive);
  const past = meetings.filter(
    (mtg) => mtg.status === 'ENDED' || Date.parse(mtg.endAt) < now,
  );

  const visibleMeetings =
    activeTab === 'live'
      ? liveMeetings
      : activeTab === 'past'
        ? past
        : upcoming;

  const openEdit = (meeting: Meeting) => {
    setDetailId(null);
    setEditMeeting(meeting);
    setScheduleOpen(true);
  };

  const confirmCancel = (meeting: Meeting) => {
    void (async () => {
      await cancel.mutateAsync(meeting.id);
      toast.success('Meeting cancelled');
    })();
  };

  const confirmDelete = (meeting: Meeting) => {
    void (async () => {
      await remove.mutateAsync(meeting.id);
      toast.success('Meeting deleted');
    })();
  };

  /** Catalogue apps this workspace has actually linked. */
  const connectedCatalogApps = useMemo(
    () =>
      MEETING_APP_CATALOG.filter((app) =>
        [app.provider as string, ...(app.aliases ?? [])].some((code) =>
          connectedProviders.has(code),
        ),
      ),
    [connectedProviders],
  );

  const connectedOtherApps = useMemo<MeetingApp[]>(
    () =>
      [...connectedProviders]
        .filter(
          (code) =>
            !CATALOG_CODES.has(code) && MEETING_PROVIDER_HINT.test(code),
        )
        .sort()
        .map((code) => ({
          id: code.toLowerCase(),
          provider: code,
          name: humanizeProvider(code),
          blurb:
            'Linked to this workspace. Its invitations and join links show up on the meetings below.',
          accent: 'rose' as const,
        })),
    [connectedProviders],
  );

  const activeApps = [
    INBUILT_HUDDLE,
    ...connectedCatalogApps,
    ...connectedOtherApps,
  ];
  const availableApps = MEETING_APP_CATALOG.filter(
    (app) => !connectedCatalogApps.includes(app),
  );

  const emptyCopy: Record<string, string> = {
    upcoming: 'Nothing scheduled. Use “Schedule meeting” to set one up.',
    live: 'No meetings are happening right now.',
    past: 'No meetings have wrapped up in the last 60 days.',
  };

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      <div className="border-b border-border bg-background">
        <div className="gap-2.5 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between">
          <div className="min-w-0 gap-2 flex items-center">
            <div className="min-w-0 gap-1.5 flex items-center">
              <Video
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <h2 className="text-sm font-semibold tracking-tight truncate text-foreground">
                Meetings &amp; Huddles
              </h2>
            </div>
          </div>

          <div className="gap-2 flex items-center">
            <Button
              size="sm"
              className="h-7 text-xs gap-1"
              leadingIcon={<Plus className="size-3.5" />}
              onClick={() => {
                setEditMeeting(null);
                setScheduleOpen(true);
              }}
            >
              Schedule meeting
            </Button>
          </div>
        </div>

        <div className="px-3 sm:px-6 border-t border-border/40 bg-surface-muted/30">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList variant="underline" size="sm" className="border-b-0">
              <TabsTrigger
                value="upcoming"
                icon={<CalendarClock className="size-3.5" />}
                count={upcoming.length > 0 ? upcoming.length : undefined}
              >
                Upcoming
              </TabsTrigger>
              <TabsTrigger
                value="live"
                icon={<Radio className="size-3.5 text-accent-teal" />}
                count={liveMeetings.length > 0 ? liveMeetings.length : undefined}
              >
                Happening now
              </TabsTrigger>
              <TabsTrigger
                value="past"
                icon={<Check className="size-3.5 text-accent-blue" />}
                count={past.length > 0 ? past.length : undefined}
              >
                Past
              </TabsTrigger>
              <TabsTrigger
                value="apps-hub"
                icon={<Share2 className="size-3.5" />}
                count={activeApps.length > 0 ? activeApps.length : undefined}
              >
                Meeting apps
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="min-h-0 p-4 sm:p-6 flex-1 overflow-y-auto">
        <div className="max-w-6xl space-y-6 mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {(['upcoming', 'live', 'past'] as const).map((tab) => (
              <TabsContent key={tab} value={tab} className="mt-4 space-y-4">
                {meetingsQuery.isLoading ? (
                  <Panel>
                    <SkeletonList rows={4} />
                  </Panel>
                ) : meetingsQuery.isError ? (
                  <Panel>
                    <EmptyState
                      icon={<TriangleAlert />}
                      title="Could not load meetings"
                      description="Something went wrong fetching this workspace's meetings."
                      action={
                        <Button
                          variant="outline"
                          onClick={() => void meetingsQuery.refetch()}
                        >
                          Try again
                        </Button>
                      }
                    />
                  </Panel>
                ) : visibleMeetings.length === 0 ? (
                  <Panel>
                    <EmptyState
                      icon={<CalendarClock />}
                      title="No meetings here"
                      description={emptyCopy[tab]}
                      action={
                        tab === 'upcoming' ? (
                          <Button
                            onClick={() => {
                              setEditMeeting(null);
                              setScheduleOpen(true);
                            }}
                            leadingIcon={<Plus className="size-4" />}
                          >
                            Schedule meeting
                          </Button>
                        ) : undefined
                      }
                    />
                  </Panel>
                ) : (
                  <div className="gap-4 sm:grid-cols-2 xl:grid-cols-3 grid">
                    {visibleMeetings.map((meeting) => (
                      <MeetingCard
                        key={meeting.id}
                        meeting={meeting}
                        onOpen={() => setDetailId(meeting.id)}
                        onEdit={() => openEdit(meeting)}
                        onCancel={() => confirmCancel(meeting)}
                        onDelete={() => confirmDelete(meeting)}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}

            <TabsContent value="apps-hub" className="mt-4 space-y-6">
              <section className="space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">
                    Active in this workspace
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    The inbuilt huddle is always on. Everything else here is a
                    meeting or calendar app someone connected.
                  </p>
                </div>
                <div className="gap-4 md:grid-cols-2 xl:grid-cols-3 grid">
                  {activeApps.map((app) => (
                    <MeetingAppCard
                      key={app.id}
                      app={app}
                      connected
                      busy={
                        disconnect.isPending &&
                        disconnect.variables === app.provider
                      }
                      onToggle={() => disconnect.mutate(app.provider as string)}
                    />
                  ))}
                </div>
              </section>

              {availableApps.length > 0 ? (
                <section className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">
                      Available to connect
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Link one and its meetings show up on this page straight
                      away.
                    </p>
                  </div>
                  <div className="gap-4 md:grid-cols-2 xl:grid-cols-3 grid">
                    {availableApps.map((app) => (
                      <MeetingAppCard
                        key={app.id}
                        app={app}
                        connected={false}
                        busy={
                          connect.isPending &&
                          connect.variables?.provider === app.provider
                        }
                        onToggle={() =>
                          connect.mutate({ provider: app.provider as string })
                        }
                      />
                    ))}
                  </div>
                </section>
              ) : null}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <MeetingScheduleDialog
        workspaceId={workspaceId}
        open={scheduleOpen}
        onOpenChange={(open) => {
          setScheduleOpen(open);
          if (!open) setEditMeeting(null);
        }}
        meeting={editMeeting}
        onSaved={(id) => setDetailId(id)}
      />

      <MeetingDetailSheet
        workspaceId={workspaceId}
        meetingId={detailId}
        open={detailId !== null}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
        onEdit={(meeting) => openEdit(meeting)}
      />
    </div>
  );
}
