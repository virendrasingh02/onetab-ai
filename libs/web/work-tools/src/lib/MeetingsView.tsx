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
  Page,
  PageHeader,
  Panel,
  SkeletonList,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  UserAvatar,
} from '@org/ui';
import { cn, formatDateTime } from '@org/utils';
import { useIntegrationMutations, useIntegrations } from '@org/web-integrations';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  CalendarClock,
  Check,
  ExternalLink,
  Link2,
  MoreHorizontal,
  Plus,
  Radio,
  Share2,
  Trash2,
  TriangleAlert,
  Video,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useCalendarEvents, useCalendarMutations } from './use-work-tools.js';

/**
 * Meeting apps the workspace can link.
 *
 * `provider` is the key the integrations API stores, upper-cased on the way
 * in by the controller — the same string `useIntegrations` reports back.
 */
const MEETING_APPS = [
  {
    id: 'huddle',
    provider: null,
    name: 'OneTab Inbuilt Huddle',
    blurb:
      'Natively built-in high performance Matrix video and voice huddles.',
    iconColor: accentClasses.teal.soft,
  },
  {
    id: 'zoom',
    provider: 'ZOOM',
    name: 'Zoom Meetings',
    blurb:
      'Connect Zoom to sync calls, calendar invitations and meeting links into OneTab.',
    iconColor: accentClasses.blue.soft,
  },
  {
    id: 'gmeet',
    provider: 'GOOGLE_MEET',
    name: 'Google Meet',
    blurb:
      'Connect Google Meet to sync calls, calendar invitations and meeting links into OneTab.',
    iconColor: accentClasses.green.soft,
  },
  {
    id: 'msteams',
    provider: 'MICROSOFT_TEAMS',
    name: 'Microsoft Teams',
    blurb:
      'Connect Teams to sync calls, calendar invitations and meeting links into OneTab.',
    iconColor: accentClasses.indigo.soft,
  },
] as const;

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

/** Scheduled and live calls for the workspace, with connected meeting apps. */
export function MeetingsView() {
  const { workspaceId } = useCurrentWorkspace();
  const events = useCalendarEvents(
    workspaceId,
    new Date().toISOString(),
    isoOffsetDays(HORIZON_DAYS),
  );
  const { remove } = useCalendarMutations(workspaceId);
  const integrations = useIntegrations(workspaceId);
  const { connect, disconnect } = useIntegrationMutations(workspaceId);

  const [activeTab, setActiveTab] = useState('all');

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

  const connectedAppsCount =
    MEETING_APPS.filter(
      (app) => !app.provider || connectedProviders.has(app.provider),
    ).length;

  return (
    <Page>
      <PageHeader
        title="Meetings & Huddles"
        description="Everything on the workspace calendar, plus the video apps you have linked."
        icon={<Video />}
        accent="green"
        actions={
          <Button leadingIcon={<Plus />} disabled>
            Schedule meeting
          </Button>
        }
      />

      <Card className="p-4 bg-surface-raised border-border flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
            <Share2 className="size-5" aria-hidden />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span>Meeting apps</span>
              <Badge variant="primary">{connectedAppsCount} active</Badge>
            </h3>
            <p className="text-xs text-muted-foreground">
              Inbuilt OneTab Matrix huddles run natively. Linked apps appear on
              calendar events as a join link.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {MEETING_APPS.map((app) => {
            const linked = !app.provider || connectedProviders.has(app.provider);
            return (
              <span
                key={app.id}
                title={`${app.name}: ${linked ? 'Connected' : 'Not connected'}`}
                className={cn(
                  'px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 border',
                  linked
                    ? 'bg-selected/60 border-primary/30 text-foreground'
                    : 'bg-surface text-subtle border-border',
                )}
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full',
                    linked ? 'bg-success' : 'bg-subtle',
                  )}
                />
                <span>{app.name}</span>
              </span>
            );
          })}
        </div>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" className="gap-1.5">
            <Video className="size-4" />
            <span>All meetings</span>
            <Badge variant="neutral">{meetings.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="live" className="gap-1.5">
            <Radio className="size-4 text-accent-teal" />
            <span>Happening now</span>
            <Badge variant="neutral">{liveMeetings.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="linked" className="gap-1.5">
            <Link2 className="size-4 text-accent-blue" />
            <span>With a join link</span>
            <Badge variant="neutral">{linkedMeetings.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="apps-hub" className="gap-1.5">
            <Share2 className="size-4" />
            <span>Meeting apps</span>
          </TabsTrigger>
        </TabsList>

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
                          <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem
                              disabled={!joinUrl}
                              onSelect={() => {
                                if (joinUrl) {
                                  void navigator.clipboard.writeText(joinUrl);
                                }
                              }}
                            >
                              <Link2 className="size-4" aria-hidden />
                              Copy join link
                            </DropdownMenuItem>
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

        <TabsContent value="apps-hub" className="mt-4">
          <div className="gap-4 grid md:grid-cols-2 xl:grid-cols-3">
            {MEETING_APPS.map((app) => {
              const isInbuilt = !app.provider;
              const linked = !!app.provider && connectedProviders.has(app.provider);
              const isBusy =
                (connect.isPending && connect.variables?.provider === app.provider) ||
                (disconnect.isPending && disconnect.variables === app.provider);

              return (
                <Card key={app.id} className="p-5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-3">
                      <span
                        className={cn(
                          'size-10 flex items-center justify-center rounded-lg font-bold text-sm',
                          app.iconColor,
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
                            : linked
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
                      variant={linked ? 'outline' : 'primary'}
                      size="sm"
                      className="w-full"
                      loading={isBusy}
                      onClick={() => {
                        if (linked) {
                          disconnect.mutate(app.provider);
                        } else {
                          connect.mutate({ provider: app.provider });
                        }
                      }}
                      leadingIcon={
                        linked ? <Check className="text-success" /> : <Plus />
                      }
                    >
                      {linked ? 'Disconnect' : 'Connect app'}
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </Page>
  );
}
