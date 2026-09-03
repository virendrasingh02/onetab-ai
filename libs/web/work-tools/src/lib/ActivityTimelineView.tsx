import { useNotificationFeed } from '@org/notifications';
import type { ActivityFeedItem } from '@org/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Panel,
  SearchInput,
  SkeletonList,
  Tabs,
  TabsList,
  TabsTrigger,
  UserAvatar,
} from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import {
  Activity,
  ArrowRight,
  Clock,
  FileUp,
  Hash,
  MessageSquare,
  RefreshCw,
  TriangleAlert,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentWorkspace } from './use-work-tools.js';

/**
 * Tabs over `ActivityKind`.
 *
 * Grouped rather than one tab per enum value: "people" covers both the join
 * and the leave, which is how someone scanning the feed thinks about them.
 */
type ActivityTab = 'all' | 'messages' | 'people' | 'channels' | 'files';

const TABS: ReadonlyArray<{ id: ActivityTab; label: string }> = [
  { id: 'all', label: 'All activity' },
  { id: 'messages', label: 'Messages' },
  { id: 'people', label: 'People' },
  { id: 'channels', label: 'Channels' },
  { id: 'files', label: 'Files' },
];

const KIND_TAB: Record<string, ActivityTab> = {
  MESSAGE: 'messages',
  MEMBER_JOINED: 'people',
  MEMBER_LEFT: 'people',
  CHANNEL_CREATED: 'channels',
  FILE_SHARED: 'files',
};

const KIND_ICON = {
  MESSAGE: MessageSquare,
  MEMBER_JOINED: UserPlus,
  MEMBER_LEFT: UserMinus,
  CHANNEL_CREATED: Hash,
  FILE_SHARED: FileUp,
} as const;

const KIND_STYLE: Record<string, string> = {
  MESSAGE: 'text-accent-amber bg-accent-amber-soft',
  MEMBER_JOINED: 'text-accent-green bg-accent-green-soft',
  MEMBER_LEFT: 'text-muted-foreground bg-muted',
  CHANNEL_CREATED: 'text-primary bg-primary/10',
  FILE_SHARED: 'text-accent-blue bg-accent-blue-soft',
};

function actionText(item: ActivityFeedItem): string {
  switch (item.kind) {
    case 'MESSAGE':
      return 'posted a message in';
    case 'MEMBER_JOINED':
      return 'joined the workspace';
    case 'MEMBER_LEFT':
      return 'left the workspace';
    case 'CHANNEL_CREATED':
      return 'created the channel';
    case 'FILE_SHARED':
      return 'shared a file in';
    default:
      return item.kind.toLowerCase().replace(/_/g, ' ');
  }
}

/** Local midnight, so "today" means the viewer's today rather than UTC's. */
function startOfToday(): number {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

export function ActivityTimelineView() {
  const { slug, workspaceId } = useCurrentWorkspace();
  const feed = useNotificationFeed(workspaceId);

  const [activeTab, setActiveTab] = useState<ActivityTab>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const items = useMemo(() => feed.data ?? [], [feed.data]);

  const metrics = useMemo(() => {
    const since = startOfToday();
    const today = items.filter((item) => Date.parse(item.occurredAt) >= since);
    return {
      eventsToday: today.length,
      // Distinct actors in the window the feed covers, not a presence count.
      activePeople: new Set(items.map((item) => item.user?.id).filter(Boolean))
        .size,
      messages: items.filter((item) => item.kind === 'MESSAGE').length,
      files: items.filter((item) => item.kind === 'FILE_SHARED').length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return items.filter((item) => {
      if (activeTab !== 'all' && KIND_TAB[item.kind] !== activeTab)
        return false;
      if (!query) return true;

      const name = item.user?.displayName ?? item.user?.name ?? '';
      return (
        name.toLowerCase().includes(query) ||
        item.channel?.name.toLowerCase().includes(query) ||
        actionText(item).toLowerCase().includes(query)
      );
    });
  }, [items, activeTab, searchQuery]);

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      {/* Channel-style Header */}
      <div className="border-b border-border bg-background">
        <div className="gap-2.5 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between">
          <div className="min-w-0 gap-2 flex items-center">
            <div className="min-w-0 gap-1.5 flex items-center">
              <Activity
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <h2 className="text-sm font-semibold tracking-tight truncate text-foreground">
                Pulse
              </h2>
              {/* <Badge variant="neutral" className="text-[11px] px-1.5 py-0 h-4.5">
                {metrics.eventsToday} events today
              </Badge> */}
            </div>

            {/* <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

            <p className="hidden min-w-0 max-w-[48ch] truncate text-xs text-muted-foreground sm:block">
              Recent activity across channels, members and uploaded files
            </p> */}
          </div>

          <div className="gap-2 flex items-center">
            <SearchInput
              value={searchQuery}
              onValueChange={setSearchQuery}
              placeholder="Search feed…"
              className="h-7 text-xs"
              wrapperClassName="w-36 sm:w-48"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => void feed.refetch()}
              loading={feed.isFetching}
              className="h-7 text-xs gap-1"
            >
              <RefreshCw className="size-3" />
              <span>Refresh</span>
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-3 sm:px-6 border-t border-border/40 bg-surface-muted/30">
          <Tabs
            value={activeTab}
            onValueChange={(next) => setActiveTab(next as ActivityTab)}
          >
            <TabsList variant="underline" size="sm" className="border-b-0">
              {TABS.map((tab) => (
                <TabsTrigger key={tab.id} value={tab.id}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="min-h-0 p-4 sm:p-6 flex-1 overflow-y-auto">
        <div className="max-w-5xl space-y-6 mx-auto">
          {/* Metrics Bar */}
          <div className="sm:grid-cols-4 gap-3 grid grid-cols-2">
            <MetricTile
              icon={<Users className="size-4" />}
              tone="bg-primary/10 text-primary"
              value={metrics.activePeople}
              label="People active"
            />
            <MetricTile
              icon={<Activity className="size-4" />}
              tone="bg-accent-violet-soft text-accent-violet"
              value={metrics.eventsToday}
              label="Events today"
            />
            <MetricTile
              icon={<MessageSquare className="size-4" />}
              tone="bg-accent-amber-soft text-accent-amber"
              value={metrics.messages}
              label="Messages"
            />
            <MetricTile
              icon={<FileUp className="size-4" />}
              tone="bg-accent-blue-soft text-accent-blue"
              value={metrics.files}
              label="Files shared"
            />
          </div>

          <Panel>
            {/* Timeline Feed */}
            {feed.isLoading ? (
              <SkeletonList rows={6} withAvatar />
            ) : feed.isError ? (
              <EmptyState
                icon={<TriangleAlert />}
                title="Could not load activity"
                description="Something went wrong fetching this workspace's feed."
                action={
                  <Button variant="outline" onClick={() => void feed.refetch()}>
                    Try again
                  </Button>
                }
              />
            ) : filteredItems.length === 0 ? (
              <EmptyState
                icon={<Activity />}
                title={
                  items.length
                    ? 'Nothing matches that filter'
                    : 'No activity yet'
                }
                description={
                  items.length
                    ? 'Try another tab or clear the search query.'
                    : 'Messages, joins and uploads will appear here as they happen.'
                }
              />
            ) : (
              <ol className="space-y-6 pl-6 relative border-l border-border/60">
                {filteredItems.map((entry) => {
                  const Icon =
                    KIND_ICON[entry.kind as keyof typeof KIND_ICON] ?? Activity;
                  const name =
                    entry.user?.displayName ?? entry.user?.name ?? 'Someone';

                  return (
                    <li key={entry.id} className="group relative">
                      {/* Category Marker Dot */}
                      <span
                        aria-hidden
                        className={cn(
                          'top-1 size-7 -left-8.75 absolute flex items-center justify-center rounded-full border border-border shadow-sm transition-transform group-hover:scale-110',
                          KIND_STYLE[entry.kind] ??
                            'bg-surface text-muted-foreground',
                        )}
                      >
                        <Icon className="size-3.5" />
                      </span>

                      {/* Card Container */}
                      <div className="p-4 space-y-2 rounded-card border border-border bg-surface transition-colors hover:bg-surface-raised/40">
                        <div className="gap-2 flex flex-wrap items-center justify-between">
                          <div className="gap-2 flex items-center">
                            <UserAvatar
                              name={name}
                              src={entry.user?.avatarUrl}
                              seed={entry.user?.id ?? entry.id}
                              size="sm"
                            />
                            <div>
                              <div className="gap-2 flex items-center">
                                <span className="text-xs font-semibold text-foreground">
                                  {name}
                                </span>
                                <Badge
                                  variant="neutral"
                                  className="py-0 px-1.5 font-normal text-[10px]"
                                >
                                  {entry.kind.toLowerCase().replace(/_/g, ' ')}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {actionText(entry)}{' '}
                                {entry.channel ? (
                                  <span className="font-medium text-foreground">
                                    #{entry.channel.name}
                                  </span>
                                ) : null}
                              </p>
                            </div>
                          </div>

                          <div className="gap-1.5 flex items-center text-[11px] text-subtle">
                            <Clock className="size-3" />
                            <span>{formatRelative(entry.occurredAt)}</span>
                          </div>
                        </div>

                        {entry.channel ? (
                          <div className="pt-1 flex justify-end">
                            <Button
                              asChild
                              variant="ghost"
                              size="sm"
                              className="gap-1 text-xs h-7 px-2 text-primary"
                            >
                              <Link to={`/w/${slug}/c/${entry.channel.slug}`}>
                                <span>Open channel</span>
                                <ArrowRight className="size-3" />
                              </Link>
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

function MetricTile({
  icon,
  tone,
  value,
  label,
}: {
  icon: React.ReactNode;
  tone: string;
  value: number;
  label: string;
}) {
  return (
    <Card className="p-3.5 gap-3 flex items-center border-border bg-surface">
      <div
        className={cn(
          'size-9 flex shrink-0 items-center justify-center rounded-full',
          tone,
        )}
        aria-hidden
      >
        {icon}
      </div>
      <div>
        <div className="text-xl font-semibold tracking-tight text-foreground tabular-nums">
          {value}
        </div>
        <div className="font-medium text-[11px] text-muted-foreground">
          {label}
        </div>
      </div>
    </Card>
  );
}
