import { workToolsApi } from '@org/api-client';
import type { CalendarEvent } from '@org/types';
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
  UserAvatar,
} from '@org/ui';
import { cn, formatDateTime } from '@org/utils';
import { useIntegrationMutations, useIntegrations } from '@org/web-integrations';
import {
  CalendarClock,
  Check,
  ExternalLink,
  FileText,
  Link2,
  MoreHorizontal,
  Plus,
  Radio,
  Share2,
  Trash2,
  TriangleAlert,
  Video,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useCalendarEvents,
  useCalendarMutations,
  useCurrentWorkspace,
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
  MEETING_APP_CATALOG.flatMap((app) => [app.provider as string, ...(app.aliases ?? [])]),
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

/** How far ahead the meeting list reaches. */
const HORIZON_DAYS = 30;

function isoOffsetDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/**
 * The join link for an event, when there is one.
 *
 * `CalendarEvent` has no dedicated field, so the convention is the same one
 * every other calendar uses: a URL in `location` is the way in.
 */
function joinUrlOf(event: CalendarEvent): string | null {
  const location = event.location?.trim();
  if (!location) return null;
  return /^https?:\/\//i.test(location) ? location : null;
}

function isLive(event: CalendarEvent): boolean {
  const now = Date.now();
  return Date.parse(event.startAt) <= now && now < Date.parse(event.endAt);
}

function durationLabel(event: CalendarEvent): string {
  if (event.isAllDay) return 'All day';
  const minutes = Math.round(
    (Date.parse(event.endAt) - Date.parse(event.startAt)) / 60_000,
  );
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

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
        <div className="flex items-center gap-3 mb-3">
          <span
            className={cn(
              'size-10 flex items-center justify-center rounded-lg font-bold text-sm',
              accentClasses[app.accent].soft,
            )}
            aria-hidden
          >
            {app.name.charAt(0)}
          </span>
          <div>
            <h4 className="text-sm font-semibold text-foreground">{app.name}</h4>
            <p className="text-xs text-muted-foreground">
              {isInbuilt
                ? 'Built-in native'
                : connected
                  ? 'Connected to this workspace'
                  : 'Not connected'}
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mb-4">
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
          leadingIcon={connected ? <Check className="text-success" /> : <Plus />}
        >
          {connected ? 'Disconnect' : 'Connect app'}
        </Button>
      )}
    </Card>
  );
}

/** Scheduled and live calls for the workspace, with connected meeting apps. */
export function MeetingsView() {
  const navigate = useNavigate();
  const { workspaceId, slug } = useCurrentWorkspace();
  const events = useCalendarEvents(
    workspaceId,
    new Date().toISOString(),
    isoOffsetDays(HORIZON_DAYS),
  );
  const { remove } = useCalendarMutations(workspaceId);
  const integrations = useIntegrations(workspaceId);
  const { connect, disconnect } = useIntegrationMutations(workspaceId);

  const [activeTab, setActiveTab] = useState('all');

  const handleCreateDocFromMeeting = useCallback(
    async (event: CalendarEvent) => {
      if (!workspaceId) return;
      try {
        const title = `Meeting Notes: ${event.title}`;
        const meetingDate = formatDateTime(event.startAt);
        const organizerName =
          event.organizer.displayName ?? event.organizer.name;
        const content = `# ${title}\n\n**Date & Time:** ${meetingDate}\n**Organizer:** ${organizerName}\n${
          event.description ? `\n**Description:**\n${event.description}\n` : ''
        }\n## 🎯 Agenda & Objectives\n- Item 1\n- Item 2\n\n## 📝 Discussion Notes\n- Key point discussed\n\n## ✅ Action Items\n- [ ] Action item 1\n- [ ] Action item 2\n`;
        const created = await workToolsApi.createDocument(workspaceId, {
          title,
          content,
          kind: 'NOTE',
        });
        toast.success('Meeting notes doc created', {
          description: `"${title}" added to Documents.`,
        });
        if (slug) {
          navigate(`/w/${slug}/docs?doc=${created.id}`);
        }
      } catch {
        toast.error('Failed to create meeting notes doc');
      }
    },
    [workspaceId, slug, navigate],
  );

  const connectedProviders = useMemo(
    () =>
      new Set(
        (integrations.data ?? [])
          .filter((row) => row.status === 'CONNECTED')
          .map((row) => row.provider.toUpperCase()),
      ),
    [integrations.data],
  );

  const meetings = events.data ?? [];
  const liveMeetings = meetings.filter(isLive);
  const linkedMeetings = meetings.filter((event) => joinUrlOf(event));

  const visibleMeetings =
    activeTab === 'live'
      ? liveMeetings
      : activeTab === 'linked'
        ? linkedMeetings
        : meetings;

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

  /**
   * Connected meeting apps with no catalogue card — anything else someone
   * links that looks like a meeting or calendar provider.
   */
  const connectedOtherApps = useMemo<MeetingApp[]>(
    () =>
      [...connectedProviders]
        .filter(
          (code) => !CATALOG_CODES.has(code) && MEETING_PROVIDER_HINT.test(code),
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

  /* Inbuilt first, then whatever the workspace connected. */
  const activeApps = [
    INBUILT_HUDDLE,
    ...connectedCatalogApps,
    ...connectedOtherApps,
  ];
  const availableApps = MEETING_APP_CATALOG.filter(
    (app) => !connectedCatalogApps.includes(app),
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Channel-style Header */}
      <div className="border-b border-border bg-background">
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 sm:px-6 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <Video className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
                Meetings & Huddles
              </h2>
              <Badge variant="neutral" className="text-[11px] px-1.5 py-0 h-4.5">
                {liveMeetings.length > 0 ? `${liveMeetings.length} live` : `${meetings.length} scheduled`}
              </Badge>
            </div>

            <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

            <p className="hidden min-w-0 max-w-[48ch] truncate text-xs text-muted-foreground sm:block">
              Workspace calendar meetings and native Matrix video/audio huddles
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button size="sm" className="h-7 text-xs gap-1" leadingIcon={<Plus className="size-3.5" />} disabled>
              Schedule meeting
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-3 sm:px-6 border-t border-border/40 bg-surface-muted/30">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-9 bg-transparent border-b-0 p-0 gap-4">
              <TabsTrigger
                value="all"
                className="h-8 gap-1.5 px-2 text-xs font-medium border-b-2 rounded-none border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent cursor-pointer"
              >
                <Video className="size-3.5" />
                <span>All meetings</span>
                <Badge variant="neutral" className="text-[10px] px-1 py-0 h-3.5">{meetings.length}</Badge>
              </TabsTrigger>
              <TabsTrigger
                value="live"
                className="h-8 gap-1.5 px-2 text-xs font-medium border-b-2 rounded-none border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent cursor-pointer"
              >
                <Radio className="size-3.5 text-accent-teal" />
                <span>Happening now</span>
                <Badge variant="neutral" className="text-[10px] px-1 py-0 h-3.5">{liveMeetings.length}</Badge>
              </TabsTrigger>
              <TabsTrigger
                value="linked"
                className="h-8 gap-1.5 px-2 text-xs font-medium border-b-2 rounded-none border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent cursor-pointer"
              >
                <Link2 className="size-3.5 text-accent-blue" />
                <span>With a join link</span>
                <Badge variant="neutral" className="text-[10px] px-1 py-0 h-3.5">{linkedMeetings.length}</Badge>
              </TabsTrigger>
              <TabsTrigger
                value="apps-hub"
                className="h-8 gap-1.5 px-2 text-xs font-medium border-b-2 rounded-none border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent cursor-pointer"
              >
                <Share2 className="size-3.5" />
                <span>Meeting apps</span>
                <Badge variant="neutral" className="text-[10px] px-1 py-0 h-3.5">{activeApps.length}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>

        {/*
          One body shared by the three list tabs: they differ only in which
          events they show, and `visibleMeetings` has already applied that.
        */}
        {(['all', 'live', 'linked'] as const).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4 space-y-4">
          {events.isLoading ? (
            <Panel>
              <SkeletonList rows={4} />
            </Panel>
          ) : events.isError ? (
            <Panel>
              <EmptyState
                icon={<TriangleAlert />}
                title="Could not load meetings"
                description="Something went wrong fetching the workspace calendar."
                action={
                  <Button variant="outline" onClick={() => void events.refetch()}>
                    Try again
                  </Button>
                }
              />
            </Panel>
          ) : visibleMeetings.length === 0 ? (
            <Panel>
              <EmptyState
                icon={<CalendarClock />}
                title="No meetings scheduled"
                description={`Nothing on the calendar in the next ${HORIZON_DAYS} days.`}
              />
            </Panel>
          ) : (
            <div className="gap-4 grid sm:grid-cols-2 xl:grid-cols-3">
              {visibleMeetings.map((event) => {
                const joinUrl = joinUrlOf(event);
                const live = isLive(event);

                return (
                  <Panel key={event.id} className="flex flex-col justify-between">
                    <div>
                      <div className="gap-2 flex items-start justify-between">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold truncate text-foreground">
                            {event.title}
                          </h3>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatDateTime(event.startAt)} ·{' '}
                            {durationLabel(event)}
                          </p>
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Actions for ${event.title}`}
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem
                              onSelect={() =>
                                void handleCreateDocFromMeeting(event)
                              }
                            >
                              <FileText className="size-4 text-accent-blue" aria-hidden />
                              Create meeting notes doc
                            </DropdownMenuItem>
                            {joinUrl ? (
                              <DropdownMenuItem
                                onSelect={() => {
                                  void navigator.clipboard.writeText(joinUrl);
                                }}
                              >
                                <Link2 className="size-4" aria-hidden />
                                Copy join link
                              </DropdownMenuItem>
                            ) : null}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => remove.mutate(event.id)}
                            >
                              <Trash2 className="size-4" aria-hidden />
                              Cancel meeting
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {event.description ? (
                        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                          {event.description}
                        </p>
                      ) : null}

                      <div className="mt-3 gap-2 flex flex-wrap items-center">
                        {live ? (
                          <Badge variant="destructive" className="animate-pulse">
                            Live now
                          </Badge>
                        ) : (
                          <Badge variant="neutral">Scheduled</Badge>
                        )}
                        <span className="gap-1.5 text-xs text-muted-foreground flex items-center">
                          <UserAvatar
                            name={
                              event.organizer.displayName ?? event.organizer.name
                            }
                            src={event.organizer.avatarUrl}
                            seed={event.organizer.id}
                            size="xs"
                          />
                          Hosted by{' '}
                          {event.organizer.displayName ?? event.organizer.name}
                        </span>
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
                      <p className="mt-4 text-center text-xs text-subtle">
                        No join link on this event
                      </p>
                    )}
                  </Panel>
                );
              })}
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
            <div className="gap-4 grid md:grid-cols-2 xl:grid-cols-3">
              {activeApps.map((app) => (
                <MeetingAppCard
                  key={app.id}
                  app={app}
                  connected
                  busy={
                    disconnect.isPending && disconnect.variables === app.provider
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
                  Link one and its meetings show up on this page straight away.
                </p>
              </div>
              <div className="gap-4 grid md:grid-cols-2 xl:grid-cols-3">
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
    </div>
  );
}
