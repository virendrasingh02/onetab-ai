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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  CalendarClock,
  Camera,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Globe,
  Link2,
  MoreHorizontal,
  Plus,
  Radio,
  Share2,
  Trash2,
  Video,
} from 'lucide-react';
import { useState } from 'react';

export interface MeetingProviderApp {
  id: string;
  name: string;
  category: 'INBUILT' | 'CONNECTED' | 'AVAILABLE';
  connected: boolean;
  account?: string;
  iconColor: string;
}

const MEETING_APPS: MeetingProviderApp[] = [
  {
    id: 'onetab-huddle',
    name: 'OneTab Inbuilt Huddle',
    category: 'INBUILT',
    connected: true,
    account: 'Workspace Native Matrix Huddle',
    iconColor: accentClasses.teal.soft,
  },
  {
    id: 'zoom',
    name: 'Zoom Meetings',
    category: 'CONNECTED',
    connected: true,
    account: 'dev-team@workspace.zoom.us',
    iconColor: accentClasses.blue.soft,
  },
  {
    id: 'gmeet',
    name: 'Google Meet',
    category: 'CONNECTED',
    connected: true,
    account: 'calendar-sync@workspace.gsuite.com',
    iconColor: accentClasses.green.soft,
  },
  {
    id: 'msteams',
    name: 'Microsoft Teams',
    category: 'AVAILABLE',
    connected: false,
    account: 'Not connected',
    iconColor: accentClasses.indigo.soft,
  },
  {
    id: 'webex',
    name: 'Cisco Webex',
    category: 'AVAILABLE',
    connected: false,
    account: 'Not connected',
    iconColor: accentClasses.cyan.soft,
  },
];

export interface MeetingItem {
  id: string;
  title: string;
  when: string;
  duration: string;
  host: string;
  participants: number;
  live: boolean;
  providerId: string;
  providerName: string;
  providerType: 'INBUILT' | 'CONNECTED';
  joinUrl?: string;
}

const sampleMeetings: MeetingItem[] = [
  {
    id: 'm-standup',
    title: 'Daily Engineering Standup',
    when: 'Today, 9:30 AM',
    duration: '15 min',
    host: 'Admin',
    participants: 6,
    live: true,
    providerId: 'onetab-huddle',
    providerName: 'OneTab Inbuilt Huddle',
    providerType: 'INBUILT',
    joinUrl: 'https://onetab.ai/huddle/standup',
  },
  {
    id: 'm-zoom-review',
    title: 'Vector Database Architecture Review',
    when: 'Today, 2:00 PM',
    duration: '45 min',
    host: 'Dev User',
    participants: 4,
    live: false,
    providerId: 'zoom',
    providerName: 'Zoom Meetings',
    providerType: 'CONNECTED',
    joinUrl: 'https://zoom.us/j/987654321',
  },
  {
    id: 'm-gmeet-sync',
    title: 'Workspace Roadmap & Product Sync',
    when: 'Tomorrow, 11:00 AM',
    duration: '30 min',
    host: 'Priya Raman',
    participants: 9,
    live: false,
    providerId: 'gmeet',
    providerName: 'Google Meet',
    providerType: 'CONNECTED',
    joinUrl: 'https://meet.google.com/abc-defg-hij',
  },
  {
    id: 'm-msteams-audit',
    title: 'Enterprise Security Compliance Review',
    when: 'Friday, 3:00 PM',
    duration: '60 min',
    host: 'Security Lead',
    participants: 5,
    live: false,
    providerId: 'msteams',
    providerName: 'Microsoft Teams',
    providerType: 'CONNECTED',
    joinUrl: 'https://teams.microsoft.com/l/meetup-join/12345',
  },
];

/** Scheduled and live calls for the workspace with connected meeting apps. */
export function MeetingsView() {
  const [meetings, setMeetings] = useState<MeetingItem[]>(sampleMeetings);
  const [apps, setApps] = useState<MeetingProviderApp[]>(MEETING_APPS);
  const [activeTab, setActiveTab] = useState('all');

  const toggleAppConnection = (id: string) => {
    setApps((prev) =>
      prev.map((app) =>
        app.id === id
          ? {
              ...app,
              connected: !app.connected,
              category: app.connected ? 'AVAILABLE' : 'CONNECTED',
              account: app.connected ? 'Not connected' : 'Connected to workspace',
            }
          : app,
      ),
    );
  };

  const filteredMeetings = meetings.filter((meeting) => {
    if (activeTab === 'inbuilt') return meeting.providerType === 'INBUILT';
    if (activeTab === 'connected') return meeting.providerType === 'CONNECTED';
    return true;
  });

  const connectedAppsCount = apps.filter((a) => a.connected).length;

  return (
    <Page>
      <PageHeader
        title="Meetings & Huddles"
        description="Launch in-built huddles or connect third-party video call apps like Zoom, Google Meet, and MS Teams."
        icon={<Video />}
        accent="green"
        actions={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button leadingIcon={<Video />} trailingIcon={<ChevronDown />}>
                  Start a Meeting
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 p-1.5">
                <DropdownMenuItem
                  onClick={() => {
                    const newHuddle: MeetingItem = {
                      id: `m-${Date.now()}`,
                      title: 'Instant OneTab Huddle',
                      when: 'Just now',
                      duration: '30 min',
                      host: 'You',
                      participants: 1,
                      live: true,
                      providerId: 'onetab-huddle',
                      providerName: 'OneTab Inbuilt Huddle',
                      providerType: 'INBUILT',
                    };
                    setMeetings([newHuddle, ...meetings]);
                  }}
                  className="text-xs flex items-center gap-2 font-medium"
                >
                  <Radio className="size-4 text-accent-teal" />
                  <span>Start Inbuilt OneTab Huddle</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="my-1" />
                <DropdownMenuItem
                  onClick={() => {
                    const newZoom: MeetingItem = {
                      id: `m-${Date.now()}`,
                      title: 'Instant Zoom Meeting',
                      when: 'Just now',
                      duration: '45 min',
                      host: 'You',
                      participants: 1,
                      live: true,
                      providerId: 'zoom',
                      providerName: 'Zoom Meetings',
                      providerType: 'CONNECTED',
                    };
                    setMeetings([newZoom, ...meetings]);
                  }}
                  className="text-xs flex items-center gap-2"
                >
                  <Camera className="size-4 text-accent-blue" />
                  <span>Start via Zoom App</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    const newGMeet: MeetingItem = {
                      id: `m-${Date.now()}`,
                      title: 'Instant Google Meet',
                      when: 'Just now',
                      duration: '30 min',
                      host: 'You',
                      participants: 1,
                      live: true,
                      providerId: 'gmeet',
                      providerName: 'Google Meet',
                      providerType: 'CONNECTED',
                    };
                    setMeetings([newGMeet, ...meetings]);
                  }}
                  className="text-xs flex items-center gap-2"
                >
                  <Globe className="size-4 text-accent-green" />
                  <span>Start via Google Meet App</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {/* Connected Meeting Apps Summary Bar */}
      <Card className="p-4 bg-surface-raised border-border mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Share2 className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <span>Meeting Integrations Hub</span>
                <Badge variant="primary">{connectedAppsCount} Apps Active</Badge>
              </h3>
              <p className="text-xs text-muted-foreground">
                Inbuilt OneTab matrix huddles run natively. Connected apps (Zoom, Google Meet, MS Teams) sync automatically.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {apps.map((app) => (
              <span
                key={app.id}
                title={`${app.name}: ${app.connected ? 'Connected' : 'Not Connected'}`}
                className={cn(
                  'px-2 py-1 rounded-md text-[11px] font-medium flex items-center gap-1 border',
                  app.connected
                    ? 'bg-selected/60 border-primary/30 text-foreground'
                    : 'bg-surface text-subtle border-border',
                )}
              >
                <span className={cn('size-1.5 rounded-full', app.connected ? 'bg-success' : 'bg-subtle')} />
                <span>{app.name}</span>
              </span>
            ))}
          </div>
        </div>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all" className="gap-1.5">
            <Video className="size-4" />
            <span>All Meetings</span>
            <Badge variant="neutral">{meetings.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="inbuilt" className="gap-1.5">
            <Radio className="size-4 text-accent-teal" />
            <span>Inbuilt Huddles</span>
            <Badge variant="neutral">
              {meetings.filter((m) => m.providerType === 'INBUILT').length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="connected" className="gap-1.5">
            <Share2 className="size-4 text-accent-blue" />
            <span>Connected Apps</span>
            <Badge variant="neutral">
              {meetings.filter((m) => m.providerType === 'CONNECTED').length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="apps-hub" className="gap-1.5">
            <Share2 className="size-4" />
            <span>Connected Meeting Apps</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-4">
          {filteredMeetings.length === 0 ? (
            <Panel>
              <EmptyState
                icon={<CalendarClock />}
                title="No meetings scheduled"
                description="Start a huddle now, or schedule one using your connected apps."
              />
            </Panel>
          ) : (
            <div className="gap-4 grid sm:grid-cols-2 xl:grid-cols-3">
              {filteredMeetings.map((meeting) => (
                <Panel key={meeting.id} className="flex flex-col justify-between">
                  <div>
                    <div className="gap-2 flex items-start justify-between">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Badge
                            variant={
                              meeting.providerType === 'INBUILT'
                                ? 'primary'
                                : 'outline'
                            }
                            className="text-[10px] uppercase font-mono tracking-wider"
                          >
                            {meeting.providerName}
                          </Badge>
                        </div>
                        <h3 className="text-sm font-semibold truncate text-foreground">
                          {meeting.title}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {meeting.when} · {meeting.duration}
                        </p>
                      </div>

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
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem>
                            <Link2 className="size-4" aria-hidden />
                            Copy join link
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Copy className="size-4" aria-hidden />
                            Duplicate meeting
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() =>
                              setMeetings((prev) =>
                                prev.filter((entry) => entry.id !== meeting.id),
                              )
                            }
                          >
                            <Trash2 className="size-4" aria-hidden />
                            Cancel meeting
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="mt-3 gap-2 flex flex-wrap items-center">
                      {meeting.live ? (
                        <Badge variant="destructive" className="animate-pulse">
                          Live now
                        </Badge>
                      ) : (
                        <Badge variant="neutral">Scheduled</Badge>
                      )}
                      <Badge variant="outline">{meeting.participants} invited</Badge>
                      <span className="text-xs text-muted-foreground">
                        Hosted by {meeting.host}
                      </span>
                    </div>
                  </div>

                  <Button
                    className="mt-4 w-full"
                    variant={meeting.live ? 'primary' : 'outline'}
                    leadingIcon={<Video className="size-4" />}
                  >
                    {meeting.live ? 'Join now' : 'Join when it starts'}
                  </Button>
                </Panel>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="inbuilt" className="mt-4 space-y-4">
          <div className="gap-4 grid sm:grid-cols-2 xl:grid-cols-3">
            {filteredMeetings.map((meeting) => (
              <Panel key={meeting.id} className="flex flex-col justify-between">
                <div>
                  <Badge variant="primary" className="mb-2 text-[10px]">
                    OneTab Native Huddle
                  </Badge>
                  <h3 className="text-sm font-semibold truncate text-foreground">
                    {meeting.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {meeting.when} · {meeting.duration}
                  </p>
                </div>
                <Button className="mt-4 w-full" leadingIcon={<Video />}>
                  {meeting.live ? 'Join Huddle Now' : 'Join Huddle'}
                </Button>
              </Panel>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="connected" className="mt-4 space-y-4">
          <div className="gap-4 grid sm:grid-cols-2 xl:grid-cols-3">
            {filteredMeetings.map((meeting) => (
              <Panel key={meeting.id} className="flex flex-col justify-between">
                <div>
                  <Badge variant="outline" className="mb-2 text-[10px]">
                    {meeting.providerName}
                  </Badge>
                  <h3 className="text-sm font-semibold truncate text-foreground">
                    {meeting.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {meeting.when} · {meeting.duration}
                  </p>
                </div>
                <Button className="mt-4 w-full" variant="outline" leadingIcon={<ExternalLink />}>
                  Launch in {meeting.providerName}
                </Button>
              </Panel>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="apps-hub" className="mt-4">
          <div className="gap-4 grid md:grid-cols-2 xl:grid-cols-3">
            {apps.map((app) => (
              <Card key={app.id} className="p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <span
                      className={cn(
                        'size-10 flex items-center justify-center rounded-lg font-bold text-sm',
                        app.iconColor,
                      )}
                    >
                      {app.name.charAt(0)}
                    </span>
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">
                        {app.name}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {app.category === 'INBUILT'
                          ? 'Built-in Native'
                          : app.account}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">
                    {app.category === 'INBUILT'
                      ? 'Natively built-in high performance matrix video & voice huddles.'
                      : `Connect ${app.name} to sync calls, calendar invitations, and meeting links directly into OneTab.`}
                  </p>
                </div>

                {app.category === 'INBUILT' ? (
                  <Badge variant="primary" className="w-fit">
                    Natively Active
                  </Badge>
                ) : (
                  <Button
                    variant={app.connected ? 'outline' : 'primary'}
                    size="sm"
                    className="w-full"
                    onClick={() => toggleAppConnection(app.id)}
                    leadingIcon={app.connected ? <Check className="text-success" /> : <Plus />}
                  >
                    {app.connected ? 'Connected' : 'Connect App'}
                  </Button>
                )}
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </Page>
  );
}
