import { useCurrentUser } from '@org/auth';
import {
  NotificationCenterList,
  useNotificationFeed,
  useNotificationUnread,
  useNotificationUnreadCount,
} from '@org/notifications';
import { TaskPriority, TaskStatus, type ActivityFeedItem } from '@org/types';
import {
  Badge,
  Button,
  EmptyState,
  ProjectGlyph,
  SkeletonList,
  Tabs,
  TabsContent,
  TabsTrigger,
  PageTabBar,
  UserAvatar,
} from '@org/ui';
import { cn, formatDate, formatRelative } from '@org/utils';
import {
  ArrowDown,
  ArrowUp,
  AtSign,
  Activity,
  Bell,
  Calendar,
  CheckCircle2,
  CheckSquare,
  FileText,
  FileUp,
  Flame,
  FolderPlus,
  Hash,
  Inbox,
  MessageSquare,
  Minus,
  Search,
  TriangleAlert,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useCurrentWorkspace,
  useTasks,
  useWorkspaceChannels,
} from './use-work-tools.js';

interface KindMeta {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  tone: string;
}

function getKindMeta(item: ActivityFeedItem): KindMeta {
  if (item.isMention) {
    return {
      icon: AtSign,
      label: 'Mention',
      tone: 'bg-brand/10 text-brand-text',
    };
  }

  switch (item.kind) {
    case 'TASK_ASSIGNED':
      return {
        icon: CheckSquare,
        label: 'Task Assigned',
        tone: 'bg-accent-violet-soft text-accent-violet',
      };
    case 'TASK_CREATED':
      return {
        icon: CheckSquare,
        label: 'Task Created',
        tone: 'bg-accent-blue-soft text-accent-blue',
      };
    case 'TASK_COMPLETED':
      return {
        icon: CheckCircle2,
        label: 'Task Completed',
        tone: 'bg-accent-green-soft text-accent-green',
      };
    case 'MESSAGE':
      return {
        icon: MessageSquare,
        label: 'Message',
        tone: 'bg-accent-violet-soft text-accent-violet',
      };
    case 'MEMBER_JOINED':
      return {
        icon: UserPlus,
        label: 'Member Joined',
        tone: 'bg-accent-green-soft text-accent-green',
      };
    case 'MEMBER_LEFT':
      return {
        icon: UserMinus,
        label: 'Member Left',
        tone: 'bg-muted text-muted-foreground',
      };
    case 'CHANNEL_CREATED':
      return {
        icon: Hash,
        label: 'Channel',
        tone: 'bg-accent-blue-soft text-accent-blue',
      };
    case 'DOCUMENT_CREATED':
      return {
        icon: FileText,
        label: 'Document',
        tone: 'bg-accent-amber-soft text-accent-amber',
      };
    case 'PROJECT_CREATED':
      return {
        icon: FolderPlus,
        label: 'Project',
        tone: 'bg-accent-violet-soft text-accent-violet',
      };
    case 'FILE_SHARED':
      return {
        icon: FileUp,
        label: 'File Shared',
        tone: 'bg-accent-blue-soft text-accent-blue',
      };
    default:
      return {
        icon: Bell,
        label: item.kind.toLowerCase().replace(/_/g, ' '),
        tone: 'bg-muted text-muted-foreground',
      };
  }
}

function renderHeadlineDescription(
  item: ActivityFeedItem,
  userName: string,
): React.ReactNode {
  const where = item.channel ? ` in #${item.channel.name}` : '';

  if (item.isMention) {
    return (
      <span>
        <strong className="font-semibold text-foreground">{userName}</strong>{' '}
        mentioned you{where}
      </span>
    );
  }

  switch (item.kind) {
    case 'TASK_ASSIGNED': {
      const taskTitle = item.summary
        ? item.summary.replace(/^assigned\s*/i, '')
        : 'a task';
      return (
        <span>
          <strong className="font-semibold text-foreground">{userName}</strong>{' '}
          assigned you to{' '}
          <span className="font-medium text-foreground">{taskTitle}</span>
        </span>
      );
    }
    case 'TASK_CREATED': {
      const taskTitle = item.summary
        ? item.summary.replace(/^created task\s*/i, '')
        : 'a task';
      return (
        <span>
          <strong className="font-semibold text-foreground">{userName}</strong>{' '}
          created task{' '}
          <span className="font-semibold text-foreground/90">{taskTitle}</span>
        </span>
      );
    }
    case 'TASK_COMPLETED': {
      const taskTitle = item.summary
        ? item.summary.replace(/^completed task\s*/i, '')
        : 'a task';
      return (
        <span>
          <strong className="font-semibold text-foreground">{userName}</strong>{' '}
          completed task{' '}
          <span className="font-semibold text-foreground/90">{taskTitle}</span>
        </span>
      );
    }
    case 'MESSAGE':
      return (
        <span>
          <strong className="font-semibold text-foreground">{userName}</strong>{' '}
          posted a message{where}
        </span>
      );
    case 'MEMBER_JOINED':
      return (
        <span>
          <strong className="font-semibold text-foreground">{userName}</strong>{' '}
          joined the workspace
        </span>
      );
    case 'MEMBER_LEFT':
      return (
        <span>
          <strong className="font-semibold text-foreground">{userName}</strong>{' '}
          left the workspace
        </span>
      );
    case 'CHANNEL_CREATED':
      return (
        <span>
          <strong className="font-semibold text-foreground">{userName}</strong>{' '}
          created channel{' '}
          <span className="font-semibold text-foreground">
            #{item.channel?.name ?? 'new-channel'}
          </span>
        </span>
      );
    case 'DOCUMENT_CREATED': {
      const docTitle = item.summary
        ? item.summary.replace(/^created document\s*/i, '')
        : 'a document';
      return (
        <span>
          <strong className="font-semibold text-foreground">{userName}</strong>{' '}
          created document{' '}
          <span className="font-semibold text-foreground">{docTitle}</span>
        </span>
      );
    }
    case 'PROJECT_CREATED': {
      const projTitle = item.summary
        ? item.summary.replace(/^created project\s*/i, '')
        : 'a project';
      return (
        <span>
          <strong className="font-semibold text-foreground">{userName}</strong>{' '}
          created project{' '}
          <span className="font-semibold text-foreground">{projTitle}</span>
        </span>
      );
    }
    default:
      return (
        <span>
          <strong className="font-semibold text-foreground">{userName}</strong>{' '}
          {item.summary || item.kind.toLowerCase().replace(/_/g, ' ')}
        </span>
      );
  }
}

/**
 * Where a feed row opens. A chat row jumps to the exact message via `?msg=`.
 * Task rows jump to the board with `?card=`.
 * Document rows jump to `/docs/:docId`.
 */
function feedItemHref(
  item: ActivityFeedItem,
  workspaceSlug: string,
): string | null {
  if (item.channel) {
    const base = `/w/${workspaceSlug}/channels/${item.channel.slug}`;
    return item.messageEventId ? `${base}?msg=${item.messageEventId}` : base;
  }
  if (
    item.resourceType === 'task' ||
    item.kind === 'TASK_CREATED' ||
    item.kind === 'TASK_ASSIGNED' ||
    item.kind === 'TASK_COMPLETED'
  ) {
    return `/w/${workspaceSlug}/tasks${
      item.resourceId ? `?card=${item.resourceId}` : ''
    }`;
  }
  if (item.resourceType === 'document') {
    return `/w/${workspaceSlug}/docs${
      item.resourceId ? `/${item.resourceId}` : ''
    }`;
  }
  if (item.resourceType === 'project') {
    return `/w/${workspaceSlug}/tasks${
      item.resourceId ? `/${item.resourceId}` : ''
    }`;
  }
  return `/w/${workspaceSlug}/projects`;
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  switch (priority) {
    case TaskPriority.URGENT:
      return (
        <Badge
          variant="neutral"
          className="gap-1 px-1.5 py-0 h-4 font-semibold border-accent-rose/30 bg-accent-rose-soft text-2xs text-accent-rose"
        >
          <Flame className="size-2.5 shrink-0" />
          <span>Urgent</span>
        </Badge>
      );
    case TaskPriority.HIGH:
      return (
        <Badge
          variant="neutral"
          className="gap-1 px-1.5 py-0 h-4 font-semibold border-accent-amber/30 bg-accent-amber-soft text-2xs text-accent-amber"
        >
          <ArrowUp className="size-2.5 shrink-0" />
          <span>High</span>
        </Badge>
      );
    case TaskPriority.MEDIUM:
      return (
        <Badge
          variant="neutral"
          className="gap-1 px-1.5 py-0 h-4 font-semibold border-accent-blue/30 bg-accent-blue-soft text-2xs text-accent-blue"
        >
          <Minus className="size-2.5 shrink-0" />
          <span>Medium</span>
        </Badge>
      );
    case TaskPriority.LOW:
      return (
        <Badge
          variant="neutral"
          className="gap-1 px-1.5 py-0 h-4 font-semibold bg-muted text-2xs text-muted-foreground"
        >
          <ArrowDown className="size-2.5 shrink-0" />
          <span>Low</span>
        </Badge>
      );
    default:
      return null;
  }
}

function FeedRow({
  item,
  workspaceSlug,
  isUnread,
}: {
  item: ActivityFeedItem;
  workspaceSlug: string;
  isUnread: boolean;
}) {
  const user = item.user;
  const userName = user?.displayName ?? user?.name ?? 'Someone';
  const href = feedItemHref(item, workspaceSlug);
  const { icon: KindIcon, label: kindLabel, tone } = getKindMeta(item);

  return (
    <InboxRow href={href} unread={isUnread}>
      {/* User Avatar with action badge overlay */}
      <div className="relative shrink-0">
        {user ? (
          <UserAvatar
            name={userName}
            src={user.avatarUrl}
            seed={user.id}
            size="sm"
            indicator={false}
            className="font-bold shadow-xs ring-2 ring-background"
          />
        ) : (
          <div
            className={cn(
              'size-8 flex items-center justify-center rounded-full',
              tone,
            )}
          >
            <KindIcon className="size-4" />
          </div>
        )}
        {user ? (
          <span
            className={cn(
              '-bottom-1 -right-1 size-4 absolute flex items-center justify-center rounded-full border-2 border-background shadow-xs',
              tone,
            )}
            title={kindLabel}
          >
            <KindIcon className="size-2.5" />
          </span>
        ) : null}
      </div>

      <span className="min-w-0 flex-1">
        <div className="gap-2 flex items-center justify-between">
          <span
            className={cn(
              'text-sm leading-snug block truncate text-foreground',
              isUnread ? 'font-medium' : 'font-normal',
            )}
          >
            {userName}
          </span>
          <span className="shrink-0 text-meta whitespace-nowrap text-muted-foreground">
            {formatRelative(item.occurredAt)}
          </span>
        </div>

        <span className="mt-0.5 text-xs leading-relaxed line-clamp-2 block text-muted-foreground">
          {renderHeadlineDescription(item, userName)}
        </span>

        <div className="mt-1.5 gap-1.5 flex flex-wrap items-center">
          <InboxChip icon={<KindIcon className="size-3" />}>
            {kindLabel}
          </InboxChip>
          {item.channel ? (
            <InboxChip icon={<Hash className="size-3" aria-hidden />}>
              {item.channel.name}
            </InboxChip>
          ) : null}
        </div>
      </span>
    </InboxRow>
  );
}

/** Grouped list container — same shell as the "For you" notification list. */
function InboxList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/70 bg-surface">
      {children}
    </ul>
  );
}

/**
 * One inbox row, matching NotificationCenterList: unread dot gutter, tinted
 * background while unread, whole row is the link.
 */
function InboxRow({
  href,
  unread = false,
  children,
}: {
  href?: string | null;
  unread?: boolean;
  children: React.ReactNode;
}) {
  const className = cn(
    'group gap-3 px-4 py-3 relative flex items-start transition-colors',
    href && 'cursor-pointer hover:bg-accent/40',
    unread && 'bg-primary/[0.04]',
  );
  const content = (
    <>
      <div className="pt-1 flex shrink-0 flex-col items-center justify-center">
        <span
          className={cn(
            'size-2 rounded-full',
            unread ? 'bg-activity shadow-xs' : 'opacity-0',
          )}
          title={unread ? 'Unread' : undefined}
          aria-label={unread ? 'Unread' : undefined}
        />
      </div>
      {children}
    </>
  );
  return (
    <li>
      {href ? (
        <Link to={href} className={className}>
          {content}
        </Link>
      ) : (
        <div className={className}>{content}</div>
      )}
    </li>
  );
}

/** Muted meta chip — same recipe as the notification category chip. */
function InboxChip({
  icon,
  className,
  children,
}: {
  icon?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        'gap-1 px-1.5 py-0.5 font-medium inline-flex items-center rounded-md bg-muted text-2xs text-muted-foreground',
        className,
      )}
    >
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
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

  // Personal notifications (server read state) — the same count the sidebar
  // Inbox row shows.
  const personalUnread = useNotificationUnreadCount(workspaceId).data ?? 0;

  const [activeTab, setActiveTab] = useState('for-you');

  // Search & category filters
  const [notificationCategory, setNotificationCategory] =
    useState<string>('all');
  const [notificationSearch, setNotificationSearch] = useState<string>('');
  const [taskStatusFilter, setTaskStatusFilter] = useState<string>('all');
  const [taskSearch, setTaskSearch] = useState<string>('');

  /*
   * The read marker as it stood when this page opened, frozen.
   */
  const [snapshot, setSnapshot] = useState<{ seenAt: string | null } | null>(
    null,
  );

  useEffect(() => {
    if (snapshot || !feed.data) return;
    setSnapshot({ seenAt: feed.data[unreadCount]?.occurredAt ?? null });
  }, [feed.data, snapshot, unreadCount]);

  useEffect(() => {
    if (activeTab !== 'activity' || !snapshot || unreadCount === 0) return;
    markAllSeen();
  }, [activeTab, snapshot, unreadCount, markAllSeen]);

  const seenThreshold = snapshot?.seenAt ?? null;

  const newCount = useMemo(() => {
    if (!feed.data?.length || !snapshot) return 0;
    if (!seenThreshold) return feed.data.length;
    const since = Date.parse(seenThreshold);
    return feed.data.filter((item) => Date.parse(item.occurredAt) > since)
      .length;
  }, [feed.data, seenThreshold, snapshot]);

  const markAllRead = useCallback(() => {
    markAllSeen();
    setSnapshot({
      seenAt: feed.data?.[0]?.occurredAt ?? new Date().toISOString(),
    });
  }, [feed.data, markAllSeen]);

  const filteredFeed = useMemo(() => {
    let list = feed.data ?? [];

    if (notificationCategory === 'tasks') {
      list = list.filter(
        (item) => item.kind.startsWith('TASK_') || item.resourceType === 'task',
      );
    } else if (notificationCategory === 'mentions') {
      list = list.filter((item) => item.isMention);
    } else if (notificationCategory === 'channels') {
      list = list.filter(
        (item) => item.kind === 'MESSAGE' || item.kind === 'CHANNEL_CREATED',
      );
    }

    if (notificationSearch.trim()) {
      const q = notificationSearch.trim().toLowerCase();
      list = list.filter((item) => {
        const userName = (
          item.user?.displayName ??
          item.user?.name ??
          ''
        ).toLowerCase();
        const summary = (item.summary ?? '').toLowerCase();
        const channel = (item.channel?.name ?? '').toLowerCase();
        const kind = item.kind.toLowerCase();
        return (
          userName.includes(q) ||
          summary.includes(q) ||
          channel.includes(q) ||
          kind.includes(q)
        );
      });
    }

    return list;
  }, [feed.data, notificationCategory, notificationSearch]);

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

  const mentions = useMemo(
    () =>
      (feed.data ?? []).filter(
        (item) =>
          item.isMention ||
          item.kind === 'MENTION' ||
          (item.summary &&
            user &&
            (item.summary.includes(`@${user.name}`) ||
              item.summary.includes(`@${user.displayName}`))),
      ),
    [feed.data, user],
  );

  const myTasks = useMemo(() => {
    if (!user) return [];
    let list = (tasks.data ?? []).filter((task) => {
      const memberIds =
        task.assigneeIds && task.assigneeIds.length > 0
          ? task.assigneeIds
          : task.assigneeId
            ? [task.assigneeId]
            : [];
      return (
        memberIds.includes(user.id) &&
        task.status !== TaskStatus.DONE &&
        task.status !== TaskStatus.CANCELLED
      );
    });

    if (taskStatusFilter === 'in_progress') {
      list = list.filter((t) => t.status === TaskStatus.IN_PROGRESS);
    } else if (taskStatusFilter === 'todo') {
      list = list.filter(
        (t) => t.status === TaskStatus.TODO || t.status === TaskStatus.BACKLOG,
      );
    } else if (taskStatusFilter === 'in_review') {
      list = list.filter((t) => t.status === TaskStatus.IN_REVIEW);
    } else if (taskStatusFilter === 'overdue') {
      list = list.filter(
        (t) => t.dueDate && Date.parse(t.dueDate) < Date.now(),
      );
    }

    if (taskSearch.trim()) {
      const q = taskSearch.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.identifier && t.identifier.toLowerCase().includes(q)) ||
          (t.project?.name && t.project.name.toLowerCase().includes(q)),
      );
    }

    return list.sort((a, b) => {
      if (a.dueDate && b.dueDate) {
        return Date.parse(a.dueDate) - Date.parse(b.dueDate);
      }
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return a.orderIndex - b.orderIndex;
    });
  }, [tasks.data, user, taskStatusFilter, taskSearch]);

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      {/* Channel-style Header */}
      <div className="top-0 backdrop-blur-md sticky z-20 shrink-0 bg-background/95">
        <div className="gap-2.5 px-3 sm:px-6 pt-2 pb-1 min-h-11 flex flex-wrap items-center justify-between">
          <div className="min-w-0 gap-2 flex items-center">
            <div className="min-w-0 gap-1.5 flex items-center">
              <Inbox
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <h2 className="text-base font-medium truncate tracking-[-0.01em] text-foreground">
                Inbox
              </h2>
            </div>
          </div>

          <div className="gap-2 flex items-center">
            {activeTab === 'activity' && newCount > 0 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllRead}
                className="h-7 text-xs cursor-pointer rounded-lg"
              >
                Mark all read
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Tab Navigation directly below header */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <PageTabBar>
          <TabsTrigger
            value="for-you"
            icon={<Bell className="size-4" />}
            count={personalUnread > 0 ? personalUnread : undefined}
          >
            For you
          </TabsTrigger>
          <TabsTrigger
            value="activity"
            icon={<Activity className="size-4" />}
            count={newCount > 0 ? newCount : undefined}
          >
            Activity
          </TabsTrigger>
          <TabsTrigger
            value="mentions"
            icon={<AtSign className="size-4" />}
            count={mentions.length > 0 ? mentions.length : undefined}
          >
            Mentions
          </TabsTrigger>
          <TabsTrigger
            value="unreads"
            icon={<MessageSquare className="size-4" />}
            count={
              unreadChannels.length > 0 ? unreadChannels.length : undefined
            }
          >
            Unread channels
          </TabsTrigger>
          <TabsTrigger
            value="tasks"
            icon={<CheckSquare className="size-4" />}
            count={myTasks.length > 0 ? myTasks.length : undefined}
          >
            Assigned to you
          </TabsTrigger>
        </PageTabBar>
      </Tabs>

      <div className="min-h-0 p-3 sm:p-6 flex-1 overflow-y-auto">
        <div className="max-w-5xl space-y-4 mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {/* 1. FOR YOU — personal notifications (formerly the header bell) */}
            <TabsContent value="for-you" className="mt-0">
              {workspaceId ? (
                <NotificationCenterList
                  workspaceId={workspaceId}
                  workspaceSlug={slug ?? ''}
                />
              ) : (
                <SkeletonList rows={5} withAvatar />
              )}
            </TabsContent>

            {/* 2. ACTIVITY — workspace-wide feed */}
            <TabsContent value="activity" className="space-y-3.5 mt-0">
              {/* Category & Search Toolbar */}
              <div className="sm:flex-row sm:items-center gap-2.5 pb-1 flex flex-col items-stretch justify-between">
                <div className="gap-1.5 py-0.5 no-scrollbar flex items-center overflow-x-auto">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'tasks', label: 'Tasks' },
                    { id: 'mentions', label: 'Mentions' },
                    { id: 'channels', label: 'Channels & Chat' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setNotificationCategory(cat.id)}
                      className={cn(
                        'px-2.5 py-1 text-xs font-medium shrink-0 cursor-pointer rounded-lg transition-colors',
                        notificationCategory === cat.id
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="min-w-48 sm:w-60 relative flex items-center">
                  <Search className="size-3.5 left-2.5 pointer-events-none absolute text-muted-foreground" />
                  <input
                    type="text"
                    value={notificationSearch}
                    onChange={(e) => setNotificationSearch(e.target.value)}
                    placeholder="Filter activity..."
                    className="pl-8 pr-7 py-1 text-xs w-full rounded-lg border border-border/80 bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring focus:outline-none"
                  />
                  {notificationSearch && (
                    <button
                      type="button"
                      onClick={() => setNotificationSearch('')}
                      className="right-2 p-0.5 absolute text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              </div>

              {feed.isLoading ? (
                <SkeletonList rows={5} withAvatar />
              ) : feed.isError ? (
                <EmptyState
                  icon={<TriangleAlert />}
                  title="Could not load activity"
                  description="Something went wrong fetching this workspace's feed."
                  action={
                    <Button
                      variant="outline"
                      onClick={() => void feed.refetch()}
                    >
                      Try again
                    </Button>
                  }
                />
              ) : filteredFeed.length === 0 ? (
                <EmptyState
                  icon={<Bell />}
                  title={
                    notificationSearch
                      ? 'No matching notifications'
                      : 'You are all caught up!'
                  }
                  description={
                    notificationSearch
                      ? 'Try clearing your search query.'
                      : 'No workspace activity in this category yet.'
                  }
                />
              ) : (
                <InboxList>
                  {filteredFeed.map((item) => (
                    <FeedRow
                      key={item.id}
                      item={item}
                      workspaceSlug={slug ?? ''}
                      isUnread={
                        !seenThreshold ||
                        Date.parse(item.occurredAt) > Date.parse(seenThreshold)
                      }
                    />
                  ))}
                </InboxList>
              )}
            </TabsContent>

            {/* 3. MENTIONS TAB */}
            <TabsContent value="mentions" className="space-y-3.5 mt-0">
              {feed.isLoading ? (
                <SkeletonList rows={4} withAvatar />
              ) : mentions.length === 0 ? (
                <EmptyState
                  icon={<AtSign />}
                  title="No mentions yet"
                  description="When someone @mentions you in any channel or task comment, it will appear here."
                />
              ) : (
                <InboxList>
                  {mentions.map((item) => (
                    <FeedRow
                      key={item.id}
                      item={item}
                      workspaceSlug={slug ?? ''}
                      isUnread={
                        !seenThreshold ||
                        Date.parse(item.occurredAt) > Date.parse(seenThreshold)
                      }
                    />
                  ))}
                </InboxList>
              )}
            </TabsContent>

            {/* 4. UNREAD CHANNELS TAB */}
            <TabsContent value="unreads" className="space-y-3.5 mt-0">
              {channels.isLoading || feed.isLoading ? (
                <SkeletonList rows={4} />
              ) : unreadChannels.length === 0 ? (
                <EmptyState
                  icon={<MessageSquare />}
                  title="No unread channels"
                  description="All channels you have joined are completely up to date."
                />
              ) : (
                <InboxList>
                  {unreadChannels.map(({ channel, unread, latest }) => {
                    const latestName =
                      latest?.user?.displayName ??
                      latest?.user?.name ??
                      'A teammate';
                    return (
                      <InboxRow
                        key={channel.id}
                        href={`/w/${slug}/channels/${channel.slug}`}
                        unread
                      >
                        <span className="size-8 flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <Hash className="size-4" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <div className="gap-2 flex items-center justify-between">
                            <span className="gap-2 min-w-0 flex items-center">
                              <span className="text-sm leading-snug font-medium truncate text-foreground">
                                {channel.name}
                              </span>
                              <Badge variant="count" className="shrink-0">
                                {unread}
                              </Badge>
                            </span>
                            {latest ? (
                              <span className="shrink-0 text-meta whitespace-nowrap text-muted-foreground">
                                {formatRelative(latest.occurredAt)}
                              </span>
                            ) : null}
                          </div>
                          {latest ? (
                            <span className="mt-0.5 text-xs leading-relaxed line-clamp-2 block text-muted-foreground">
                              <span className="font-medium text-foreground/90">
                                {latestName}:
                              </span>{' '}
                              {latest.summary || 'sent a message'}
                            </span>
                          ) : null}
                        </span>
                      </InboxRow>
                    );
                  })}
                </InboxList>
              )}
            </TabsContent>

            {/* 5. ASSIGNED TO YOU TAB */}
            <TabsContent value="tasks" className="space-y-3.5 mt-0">
              {/* Task Filters & Search */}
              <div className="sm:flex-row sm:items-center gap-2.5 pb-1 flex flex-col items-stretch justify-between">
                <div className="gap-1.5 py-0.5 no-scrollbar flex items-center overflow-x-auto">
                  {[
                    { id: 'all', label: 'All Assigned' },
                    { id: 'in_progress', label: 'In Progress' },
                    { id: 'todo', label: 'Planned' },
                    { id: 'in_review', label: 'In Review' },
                    { id: 'overdue', label: 'Overdue' },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      type="button"
                      onClick={() => setTaskStatusFilter(filter.id)}
                      className={cn(
                        'px-2.5 py-1 text-xs font-medium shrink-0 cursor-pointer rounded-lg transition-colors',
                        taskStatusFilter === filter.id
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                <div className="min-w-48 sm:w-60 relative flex items-center">
                  <Search className="size-3.5 left-2.5 pointer-events-none absolute text-muted-foreground" />
                  <input
                    type="text"
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    placeholder="Search assigned tasks..."
                    className="pl-8 pr-7 py-1 text-xs w-full rounded-lg border border-border/80 bg-background text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-ring focus:outline-none"
                  />
                  {taskSearch && (
                    <button
                      type="button"
                      onClick={() => setTaskSearch('')}
                      className="right-2 p-0.5 absolute text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
              </div>

              {tasks.isLoading ? (
                <SkeletonList rows={4} />
              ) : myTasks.length === 0 ? (
                <EmptyState
                  icon={<CheckSquare />}
                  title={
                    taskSearch ? 'No matching tasks' : 'Nothing assigned to you'
                  }
                  description={
                    taskSearch
                      ? 'Try clearing your search query.'
                      : 'Tasks assigned to you across all projects will show up here.'
                  }
                  action={
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="rounded-lg"
                    >
                      <Link to={`/w/${slug}/projects`}>Open the board</Link>
                    </Button>
                  }
                />
              ) : (
                <InboxList>
                  {myTasks.map((task) => {
                    const isOverdue =
                      !!task.dueDate && Date.parse(task.dueDate) < Date.now();
                    const taskHref = `/w/${slug}/projects?card=${task.id}`;

                    return (
                      <InboxRow key={task.id} href={taskHref}>
                        {task.assignee ? (
                          <UserAvatar
                            name={
                              task.assignee.displayName ?? task.assignee.name
                            }
                            src={task.assignee.avatarUrl}
                            seed={task.assignee.id}
                            size="sm"
                            indicator={false}
                            className="shrink-0"
                          />
                        ) : (
                          <span className="size-8 flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                            <CheckSquare className="size-4" aria-hidden />
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <div className="gap-2 flex items-center justify-between">
                            <span className="gap-2 min-w-0 flex items-center">
                              {task.identifier ? (
                                <span className="shrink-0 font-mono text-meta text-muted-foreground">
                                  {task.identifier}
                                </span>
                              ) : null}
                              <span className="text-sm leading-snug truncate text-foreground">
                                {task.title}
                              </span>
                            </span>
                            {task.dueDate ? (
                              <span
                                className={cn(
                                  'gap-1 inline-flex shrink-0 items-center text-meta whitespace-nowrap',
                                  isOverdue
                                    ? 'font-medium text-destructive'
                                    : 'text-muted-foreground',
                                )}
                              >
                                <Calendar className="size-3" aria-hidden />
                                {isOverdue ? 'Overdue · ' : 'Due '}
                                {formatDate(task.dueDate)}
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-1.5 gap-1.5 flex flex-wrap items-center">
                            <InboxChip className="capitalize">
                              {task.status.toLowerCase().replace(/_/g, ' ')}
                            </InboxChip>
                            {task.priority ? (
                              <PriorityBadge priority={task.priority} />
                            ) : null}
                            {task.project ? (
                              <InboxChip
                                icon={
                                  <ProjectGlyph
                                    icon={task.project.icon}
                                    iconColor={task.project.iconColor}
                                    color={task.project.color}
                                    size="xs"
                                  />
                                }
                              >
                                {task.project.name}
                              </InboxChip>
                            ) : null}
                            {task._count?.comments ? (
                              <InboxChip
                                icon={
                                  <MessageSquare
                                    className="size-3"
                                    aria-hidden
                                  />
                                }
                              >
                                {task._count.comments}
                              </InboxChip>
                            ) : null}
                          </div>
                        </span>
                      </InboxRow>
                    );
                  })}
                </InboxList>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
