import { useCurrentUser } from '@org/auth';
import { useNotificationFeed, useNotificationUnread } from '@org/notifications';
import { TaskStatus, type ActivityFeedItem } from '@org/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ProjectGlyph,
  SkeletonList,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  UserAvatar,
} from '@org/ui';
import { cn, formatDate, formatRelative } from '@org/utils';
import {
  Bell,
  CheckSquare,
  FileUp,
  Hash,
  Inbox,
  MessageSquare,
  TriangleAlert,
  UserPlus,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useCurrentWorkspace,
  useTasks,
  useWorkspaceChannels,
} from './use-work-tools.js';

const KIND_ICON = {
  MESSAGE: MessageSquare,
  MEMBER_JOINED: UserPlus,
  MEMBER_LEFT: UserPlus,
  CHANNEL_CREATED: Hash,
  FILE_SHARED: FileUp,
} as const;

const KIND_TONE: Record<string, string> = {
  MESSAGE: 'bg-accent-violet-soft text-accent-violet',
  MEMBER_JOINED: 'bg-accent-green-soft text-accent-green',
  MEMBER_LEFT: 'bg-muted text-muted-foreground',
  CHANNEL_CREATED: 'bg-accent-blue-soft text-accent-blue',
  FILE_SHARED: 'bg-accent-blue-soft text-accent-blue',
};

function headline(item: ActivityFeedItem): string {
  const who = item.user?.displayName ?? item.user?.name ?? 'Someone';
  const where = item.channel ? ` in #${item.channel.name}` : '';

  switch (item.kind) {
    case 'MESSAGE':
      return `${who} posted a message${where}`;
    case 'MEMBER_JOINED':
      return `${who} joined the workspace`;
    case 'MEMBER_LEFT':
      return `${who} left the workspace`;
    case 'CHANNEL_CREATED':
      return `${who} created${where || ' a channel'}`;
    case 'FILE_SHARED':
      return `${who} shared a file${where}`;
    default:
      return `${who} · ${item.kind.toLowerCase().replace(/_/g, ' ')}`;
  }
}

export function InboxView() {
  const user = useCurrentUser();
  const { slug, workspaceId } = useCurrentWorkspace();

  const feed = useNotificationFeed(workspaceId);
  const { count: unreadCount, markAllSeen } = useNotificationUnread(
    workspaceId,
    feed.data,
  );
  const channels = useWorkspaceChannels(workspaceId);
  const tasks = useTasks(workspaceId);

  const [activeTab, setActiveTab] = useState('notifications');

  /*
   * The read marker as it stood when this page opened, frozen.
   *
   * This page is now the only place the activity feed is rendered — the header
   * bell used to open a sheet over the same rows — so visiting it is what
   * clears the badge. Deriving the boundary live from `unreadCount` would then
   * be self-defeating: marking everything seen drops the count to zero, and the
   * "New" pills would vanish from the very rows the visit was meant to show.
   *
   * `null` inside the snapshot means "no marker yet, treat everything as new";
   * a `null` snapshot means the feed has not arrived.
   */
  const [snapshot, setSnapshot] = useState<{ seenAt: string | null } | null>(
    null,
  );

  useEffect(() => {
    if (snapshot || !feed.data) return;
    // The feed is newest-first, so the (unreadCount)th row is the boundary.
    setSnapshot({ seenAt: feed.data[unreadCount]?.occurredAt ?? null });
  }, [feed.data, snapshot, unreadCount]);

  /*
   * Reading the activity tab is what marks it read, including rows that poll in
   * while the page is open. Those still land above the frozen boundary, so they
   * arrive highlighted rather than silently.
   */
  useEffect(() => {
    if (activeTab !== 'notifications' || !snapshot || unreadCount === 0) return;
    markAllSeen();
  }, [activeTab, snapshot, unreadCount, markAllSeen]);

  const seenThreshold = snapshot?.seenAt ?? null;

  /**
   * How many rows are highlighted right now.
   *
   * Not `unreadCount`: that goes to zero the moment the tab is read, which
   * would leave the header reading "0 new" over a list of "New" pills.
   */
  const newCount = useMemo(() => {
    if (!feed.data?.length || !snapshot) return 0;
    if (!seenThreshold) return feed.data.length;
    const since = Date.parse(seenThreshold);
    return feed.data.filter((item) => Date.parse(item.occurredAt) > since)
      .length;
  }, [feed.data, seenThreshold, snapshot]);

  /** Clears both the badge and the highlighting on this page. */
  const markAllRead = useCallback(() => {
    markAllSeen();
    setSnapshot({
      seenAt: feed.data?.[0]?.occurredAt ?? new Date().toISOString(),
    });
  }, [feed.data, markAllSeen]);

  /**
   * Channels carrying messages the viewer has not read.
   *
   * Derived rather than fetched: the API exposes `membership.lastReadAt` and
   * an activity log, but no per-channel unread counter, so the count is the
   * number of feed messages in that channel since the member last read it.
   */
  const unreadChannels = useMemo(() => {
    const messages = (feed.data ?? []).filter(
      (item) => item.kind === 'MESSAGE' && item.channel,
    );

    return (channels.data ?? [])
      .filter((channel) => channel.membership)
      .map((channel) => {
        const lastReadAt = channel.membership?.lastReadAt;
        const since = lastReadAt ? Date.parse(lastReadAt) : 0;
        const unread = messages.filter(
          (item) =>
            item.channel?.id === channel.id &&
            Date.parse(item.occurredAt) > since,
        );
        return { channel, unread: unread.length, latest: unread[0] };
      })
      .filter((entry) => entry.unread > 0)
      .sort((a, b) => b.unread - a.unread);
  }, [channels.data, feed.data]);

  const myTasks = useMemo(() => {
    if (!user) return [];
    return (tasks.data ?? [])
      .filter(
        (task) =>
          task.assigneeId === user.id &&
          task.status !== TaskStatus.DONE &&
          task.status !== TaskStatus.CANCELLED,
      )
      .sort((a, b) => {
        // Dated work first, soonest at the top; undated sinks to the bottom.
        if (a.dueDate && b.dueDate) {
          return Date.parse(a.dueDate) - Date.parse(b.dueDate);
        }
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return a.orderIndex - b.orderIndex;
      });
  }, [tasks.data, user]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Channel-style Header */}
      <div className="sticky top-0 z-20 shrink-0 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 sm:px-6 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <Inbox className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
                Inbox
              </h2>
              <Badge
                variant={newCount > 0 ? 'primary' : 'neutral'}
                className="text-[11px] px-1.5 py-0 h-4.5"
              >
                {newCount > 0 ? `${newCount} new` : 'Caught up'}
              </Badge>
            </div>

            <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

            <p className="hidden min-w-0 max-w-[48ch] truncate text-xs text-muted-foreground sm:block">
              Notifications, unreads and assigned tasks
            </p>
          </div>

          <div className="flex items-center gap-2">
            {newCount > 0 ? (
              <Button variant="outline" size="sm" onClick={markAllRead} className="h-7 text-xs">
                Mark all read
              </Button>
            ) : null}
          </div>
        </div>

        {/* Tab Navigation directly below header */}
        <div className="px-3 sm:px-6 border-t border-border/40 bg-surface-muted/30">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-9 bg-transparent border-b-0 p-0 gap-4">
              <TabsTrigger
                value="notifications"
                className="h-8 gap-1.5 px-2 text-xs font-medium border-b-2 rounded-none border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent cursor-pointer"
              >
                <Bell className="size-3.5" />
                <span>Notifications</span>
                {newCount > 0 ? <Badge variant="count" className="text-[10px] px-1 py-0 h-3.5">{newCount}</Badge> : null}
              </TabsTrigger>
              <TabsTrigger
                value="unreads"
                className="h-8 gap-1.5 px-2 text-xs font-medium border-b-2 rounded-none border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent cursor-pointer"
              >
                <MessageSquare className="size-3.5" />
                <span>Unread channels</span>
                {unreadChannels.length > 0 ? (
                  <Badge variant="neutral" className="text-[10px] px-1 py-0 h-3.5">{unreadChannels.length}</Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger
                value="tasks"
                className="h-8 gap-1.5 px-2 text-xs font-medium border-b-2 rounded-none border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent bg-transparent cursor-pointer"
              >
                <CheckSquare className="size-3.5" />
                <span>Assigned to you</span>
                {myTasks.length > 0 ? (
                  <Badge variant="neutral" className="text-[10px] px-1 py-0 h-3.5">{myTasks.length}</Badge>
                ) : null}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6">
        <div className="mx-auto max-w-5xl">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsContent value="notifications" className="space-y-3 mt-0">
          {feed.isLoading ? (
            <SkeletonList rows={5} withAvatar />
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
          ) : !feed.data?.length ? (
            <EmptyState
              icon={<Bell />}
              title="You are all caught up!"
              description="No workspace activity yet."
            />
          ) : (
            <ul className="space-y-2.5">
              {feed.data.map((item) => {
                const Icon =
                  KIND_ICON[item.kind as keyof typeof KIND_ICON] ?? Bell;
                const isUnread =
                  !seenThreshold ||
                  Date.parse(item.occurredAt) > Date.parse(seenThreshold);

                return (
                  <li key={item.id}>
                    <Card
                      className={cn(
                        'p-4 transition-colors duration-(--duration-fast) flex items-start justify-between gap-4',
                        isUnread
                          ? 'bg-selected/40 border-primary/30'
                          : 'bg-surface',
                      )}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span
                          className={cn(
                            'p-2 rounded-lg shrink-0 mt-0.5',
                            KIND_TONE[item.kind] ??
                              'bg-muted text-muted-foreground',
                          )}
                          aria-hidden
                        >
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-semibold text-foreground truncate">
                              {headline(item)}
                            </h4>
                            {isUnread ? <Badge variant="primary">New</Badge> : null}
                          </div>
                          {item.channel ? (
                            <Link
                              to={`/w/${slug}/c/${item.channel.slug}`}
                              className="mt-1 gap-1 text-xs text-muted-foreground inline-flex items-center hover:text-foreground"
                            >
                              <Hash className="size-3" aria-hidden />
                              {item.channel.name}
                            </Link>
                          ) : null}
                          <span className="mt-1.5 block text-[10px] text-subtle font-mono">
                            {formatRelative(item.occurredAt)}
                          </span>
                        </div>
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="unreads" className="mt-4 space-y-3">
          {channels.isLoading || feed.isLoading ? (
            <SkeletonList rows={4} />
          ) : unreadChannels.length === 0 ? (
            <EmptyState
              icon={<MessageSquare />}
              title="No unread channels"
              description="Every channel you have joined is up to date."
            />
          ) : (
            <ul className="space-y-2.5">
              {unreadChannels.map(({ channel, unread, latest }) => (
                <li key={channel.id}>
                  <Card className="p-4 bg-surface hover:border-border-strong transition-colors">
                    <Link
                      to={`/w/${slug}/c/${channel.slug}`}
                      className="flex items-center justify-between gap-4"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-primary">
                            #{channel.name}
                          </span>
                          <Badge variant="count">{unread}</Badge>
                        </div>
                        {latest ? (
                          <p className="mt-1 text-xs text-muted-foreground truncate">
                            Latest from{' '}
                            {latest.user?.displayName ??
                              latest.user?.name ??
                              'a teammate'}
                          </p>
                        ) : null}
                      </div>
                      {latest ? (
                        <span className="text-[10px] text-subtle font-mono ml-4 shrink-0">
                          {formatRelative(latest.occurredAt)}
                        </span>
                      ) : null}
                    </Link>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="tasks" className="mt-4 space-y-3">
          {tasks.isLoading ? (
            <SkeletonList rows={4} />
          ) : myTasks.length === 0 ? (
            <EmptyState
              icon={<CheckSquare />}
              title="Nothing assigned to you"
              description="Tasks assigned to you across every project will show up here."
              action={
                <Button asChild size="sm" variant="outline">
                  <Link to={`/w/${slug}/tasks`}>Open the board</Link>
                </Button>
              }
            />
          ) : (
            <ul className="space-y-2.5">
              {myTasks.map((task) => {
                const isOverdue =
                  !!task.dueDate && Date.parse(task.dueDate) < Date.now();

                return (
                  <li key={task.id}>
                    <Card className="p-4 bg-surface hover:border-border-strong transition-colors flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-semibold text-foreground truncate">
                            {task.title}
                          </h4>
                          <Badge variant="neutral" className="capitalize">
                            {task.status.toLowerCase().replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground truncate">
                          {task.project ? (
                            <span className="inline-flex items-center gap-1 align-middle">
                              <ProjectGlyph
                                icon={task.project.icon}
                                iconColor={task.project.iconColor}
                                color={task.project.color}
                                size="xs"
                              />
                              {task.project.name}
                            </span>
                          ) : (
                            'No project'
                          )}
                          {task.dueDate ? (
                            <>
                              {' · '}
                              <span
                                className={cn(
                                  isOverdue && 'font-medium text-destructive',
                                )}
                              >
                                Due {formatDate(task.dueDate)}
                              </span>
                            </>
                          ) : null}
                        </p>
                      </div>
                      {task.assignee ? (
                        <UserAvatar
                          name={task.assignee.displayName ?? task.assignee.name}
                          src={task.assignee.avatarUrl}
                          seed={task.assignee.id}
                          size="xs"
                          className="shrink-0"
                        />
                      ) : null}
                    </Card>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </div>
  </div>
</div>
  );
}
