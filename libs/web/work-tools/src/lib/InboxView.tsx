import { useCurrentUser } from '@org/auth';
import { useNotificationFeed, useNotificationUnread } from '@org/notifications';
import { TaskPriority, TaskStatus, type ActivityFeedItem } from '@org/types';
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
  ArrowDown,
  ArrowRight,
  ArrowUp,
  AtSign,
  Bell,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
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
      tone: 'bg-primary/10 text-primary',
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
          <span className="font-semibold text-primary underline underline-offset-2">
            {taskTitle}
          </span>
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
 * Document rows jump to `/docs?doc=`.
 */
function feedItemHref(
  item: ActivityFeedItem,
  workspaceSlug: string,
): string | null {
  if (item.channel) {
    const base = `/w/${workspaceSlug}/c/${item.channel.slug}`;
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
      item.resourceId ? `?doc=${item.resourceId}` : ''
    }`;
  }
  if (item.resourceType === 'project') {
    return `/w/${workspaceSlug}/tasks${
      item.resourceId ? `?project=${item.resourceId}` : ''
    }`;
  }
  return `/w/${workspaceSlug}/tasks`;
}

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  switch (priority) {
    case TaskPriority.URGENT:
      return (
        <Badge
          variant="neutral"
          className="bg-accent-rose-soft text-accent-rose border-accent-rose/30 gap-1 text-[10px] px-1.5 py-0 h-4 font-semibold"
        >
          <Flame className="size-2.5 shrink-0" />
          <span>Urgent</span>
        </Badge>
      );
    case TaskPriority.HIGH:
      return (
        <Badge
          variant="neutral"
          className="bg-accent-amber-soft text-accent-amber border-accent-amber/30 gap-1 text-[10px] px-1.5 py-0 h-4 font-semibold"
        >
          <ArrowUp className="size-2.5 shrink-0" />
          <span>High</span>
        </Badge>
      );
    case TaskPriority.MEDIUM:
      return (
        <Badge
          variant="neutral"
          className="bg-accent-blue-soft text-accent-blue border-accent-blue/30 gap-1 text-[10px] px-1.5 py-0 h-4 font-semibold"
        >
          <Minus className="size-2.5 shrink-0" />
          <span>Medium</span>
        </Badge>
      );
    case TaskPriority.LOW:
      return (
        <Badge
          variant="neutral"
          className="bg-muted text-muted-foreground gap-1 text-[10px] px-1.5 py-0 h-4 font-semibold"
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
    <li>
      <Card
        className={cn(
          'group relative p-3.5 sm:p-4 transition-all duration-(--duration-fast) rounded-xl border',
          isUnread
            ? 'border-primary/40 bg-primary/5 shadow-xs'
            : 'border-border/70 bg-surface hover:bg-surface-raised hover:border-border-strong',
          href && 'cursor-pointer hover:shadow-md',
        )}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0 flex-1">
            {/* User Avatar with action badge overlay */}
            <div className="relative shrink-0 mt-0.5">
              {user ? (
                <UserAvatar
                  name={userName}
                  src={user.avatarUrl}
                  seed={user.id}
                  size="sm"
                  indicator={false}
                  className="font-bold ring-2 ring-background shadow-xs"
                />
              ) : (
                <div
                  className={cn(
                    'size-8 rounded-full flex items-center justify-center',
                    tone,
                  )}
                >
                  <KindIcon className="size-4" />
                </div>
              )}
              {user ? (
                <span
                  className={cn(
                    'absolute -bottom-1 -right-1 size-4 rounded-full flex items-center justify-center border-2 border-background shadow-xs',
                    tone,
                  )}
                  title={kindLabel}
                >
                  <KindIcon className="size-2.5" />
                </span>
              ) : null}
            </div>

            {/* Content Details */}
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-foreground truncate">
                  {userName}
                </span>
                <Badge
                  variant="neutral"
                  className="text-[10px] px-1.5 py-0 h-4 font-semibold tracking-wide uppercase"
                >
                  {kindLabel}
                </Badge>
                {isUnread && (
                  <Badge variant="primary" className="text-[10px] px-1.5 py-0 h-4 font-bold">
                    New
                  </Badge>
                )}
              </div>

              {/* Main descriptive headline */}
              <div className="text-xs text-foreground/90 leading-snug">
                {renderHeadlineDescription(item, userName)}
              </div>

              {/* Meta information: Channel / Timestamp */}
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground pt-0.5 flex-wrap">
                {item.channel ? (
                  <span className="inline-flex items-center gap-1 font-medium text-primary">
                    <Hash className="size-3" aria-hidden />
                    <span>{item.channel.name}</span>
                  </span>
                ) : null}
                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground/80">
                  <Clock className="size-3 text-muted-foreground/60" />
                  <span>{formatRelative(item.occurredAt)}</span>
                </span>
              </div>
            </div>
          </div>

          {/* Right Redirection Button */}
          {href ? (
            <div className="shrink-0 flex items-center self-center pl-2">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs gap-1.5 rounded-lg border-border/80 group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary transition-all cursor-pointer font-medium"
              >
                <Link to={href}>
                  <span>Open</span>
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </Button>
            </div>
          ) : null}
        </div>
      </Card>
    </li>
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

  const [activeTab, setActiveTab] = useState('notifications');

  // Search & category filters
  const [notificationCategory, setNotificationCategory] = useState<string>('all');
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
    if (activeTab !== 'notifications' || !snapshot || unreadCount === 0) return;
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
        const userName = (item.user?.displayName ?? item.user?.name ?? '').toLowerCase();
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
          (item.summary && user && (item.summary.includes(`@${user.name}`) || item.summary.includes(`@${user.displayName}`))),
      ),
    [feed.data, user],
  );

  const myTasks = useMemo(() => {
    if (!user) return [];
    let list = (tasks.data ?? []).filter((task) => {
      const memberIds = Array.isArray(
        (task.customFields as Record<string, unknown> | null)?.assigneeIds,
      )
        ? ((task.customFields as Record<string, unknown>).assigneeIds as string[])
        : task.assigneeIds ?? (task.assigneeId ? [task.assigneeId] : []);
      return (
        memberIds.includes(user.id) &&
        task.status !== TaskStatus.DONE &&
        task.status !== TaskStatus.CANCELLED
      );
    });

    if (taskStatusFilter === 'in_progress') {
      list = list.filter((t) => t.status === TaskStatus.IN_PROGRESS);
    } else if (taskStatusFilter === 'todo') {
      list = list.filter((t) => t.status === TaskStatus.TODO || t.status === TaskStatus.BACKLOG);
    } else if (taskStatusFilter === 'in_review') {
      list = list.filter((t) => t.status === TaskStatus.IN_REVIEW);
    } else if (taskStatusFilter === 'overdue') {
      list = list.filter((t) => t.dueDate && Date.parse(t.dueDate) < Date.now());
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
      <div className="top-0 backdrop-blur-md sticky z-20 shrink-0 border-b border-border bg-background/95">
        <div className="gap-2.5 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between">
          <div className="min-w-0 gap-2 flex items-center">
            <div className="min-w-0 gap-1.5 flex items-center">
              <Inbox
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <h2 className="text-sm font-semibold tracking-tight truncate text-foreground">
                Inbox
              </h2>
            </div>
          </div>

          <div className="gap-2 flex items-center">
            {newCount > 0 ? (
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

        {/* Tab Navigation directly below header */}
        <div className="px-3 sm:px-6 border-t border-border/40 bg-surface-muted/30">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="h-9 p-0 gap-4 border-b-0 bg-transparent">
              <TabsTrigger
                value="notifications"
                className="h-8 gap-1.5 px-2 text-xs font-medium cursor-pointer rounded-none border-b-2 border-transparent bg-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                <Bell className="size-3.5" />
                <span>Notifications</span>
                {newCount > 0 ? (
                  <Badge
                    variant="count"
                    className="px-1 py-0 h-3.5 text-[10px]"
                  >
                    {newCount}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger
                value="mentions"
                className="h-8 gap-1.5 px-2 text-xs font-medium cursor-pointer rounded-none border-b-2 border-transparent bg-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                <AtSign className="size-3.5" />
                <span>Mentions</span>
                {mentions.length > 0 ? (
                  <Badge
                    variant="count"
                    className="px-1 py-0 h-3.5 text-[10px]"
                  >
                    {mentions.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger
                value="unreads"
                className="h-8 gap-1.5 px-2 text-xs font-medium cursor-pointer rounded-none border-b-2 border-transparent bg-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                <MessageSquare className="size-3.5" />
                <span>Unread channels</span>
                {unreadChannels.length > 0 ? (
                  <Badge
                    variant="count"
                    className="px-1 py-0 h-3.5 text-[10px]"
                  >
                    {unreadChannels.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
              <TabsTrigger
                value="tasks"
                className="h-8 gap-1.5 px-2 text-xs font-medium cursor-pointer rounded-none border-b-2 border-transparent bg-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent"
              >
                <CheckSquare className="size-3.5" />
                <span>Assigned to you</span>
                {myTasks.length > 0 ? (
                  <Badge
                    variant="neutral"
                    className="px-1 py-0 h-3.5 text-[10px]"
                  >
                    {myTasks.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="min-h-0 p-3 sm:p-6 flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {/* 1. NOTIFICATIONS TAB */}
            <TabsContent value="notifications" className="space-y-3.5 mt-0">
              {/* Category & Search Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-1">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
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
                        'px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer shrink-0',
                        notificationCategory === cat.id
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <div className="relative flex items-center min-w-48 sm:w-60">
                  <Search className="size-3.5 absolute left-2.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={notificationSearch}
                    onChange={(e) => setNotificationSearch(e.target.value)}
                    placeholder="Filter notifications..."
                    className="w-full pl-8 pr-7 py-1 text-xs rounded-lg border border-border/80 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {notificationSearch && (
                    <button
                      type="button"
                      onClick={() => setNotificationSearch('')}
                      className="absolute right-2 text-muted-foreground hover:text-foreground p-0.5"
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
                  title={notificationSearch ? 'No matching notifications' : 'You are all caught up!'}
                  description={
                    notificationSearch
                      ? 'Try clearing your search query.'
                      : 'No workspace activity in this category yet.'
                  }
                />
              ) : (
                <ul className="space-y-2.5">
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
                </ul>
              )}
            </TabsContent>

            {/* 2. MENTIONS TAB */}
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
                <ul className="space-y-2.5">
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
                </ul>
              )}
            </TabsContent>

            {/* 3. UNREAD CHANNELS TAB */}
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
                <ul className="space-y-2.5">
                  {unreadChannels.map(({ channel, unread, latest }) => (
                    <li key={channel.id}>
                      <Card className="group p-4 bg-surface transition-all duration-(--duration-fast) rounded-xl border border-border/70 hover:border-border-strong hover:bg-surface-raised hover:shadow-md">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary">
                                <Hash className="size-3.5" />
                                <span>{channel.name}</span>
                              </span>
                              <Badge variant="count" className="font-bold">
                                {unread} unread
                              </Badge>
                            </div>

                            {latest ? (
                              <div className="mt-1.5 flex items-center gap-2 min-w-0">
                                {latest.user ? (
                                  <UserAvatar
                                    name={
                                      latest.user.displayName ??
                                      latest.user.name
                                    }
                                    src={latest.user.avatarUrl}
                                    seed={latest.user.id}
                                    size="xs"
                                    indicator={false}
                                    className="shrink-0 font-bold"
                                  />
                                ) : null}
                                <p className="text-xs truncate text-muted-foreground min-w-0">
                                  <span className="font-semibold text-foreground/90 mr-1">
                                    {latest.user?.displayName ??
                                      latest.user?.name ??
                                      'A teammate'}:
                                  </span>
                                  <span>
                                    {latest.summary || 'sent a message'}
                                  </span>
                                </p>
                              </div>
                            ) : null}

                            {latest ? (
                              <span className="mt-1 block font-mono text-[10px] text-muted-foreground/70">
                                {formatRelative(latest.occurredAt)}
                              </span>
                            ) : null}
                          </div>

                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-8 px-3 text-xs gap-1.5 rounded-lg border-border/80 group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary transition-all shrink-0 cursor-pointer font-medium"
                          >
                            <Link to={`/w/${slug}/c/${channel.slug}`}>
                              <span>Open channel</span>
                              <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                            </Link>
                          </Button>
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </TabsContent>

            {/* 4. ASSIGNED TO YOU TAB */}
            <TabsContent value="tasks" className="space-y-3.5 mt-0">
              {/* Task Filters & Search */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-1">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
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
                        'px-2.5 py-1 text-xs rounded-lg font-medium transition-colors cursor-pointer shrink-0',
                        taskStatusFilter === filter.id
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>

                <div className="relative flex items-center min-w-48 sm:w-60">
                  <Search className="size-3.5 absolute left-2.5 text-muted-foreground pointer-events-none" />
                  <input
                    type="text"
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    placeholder="Search assigned tasks..."
                    className="w-full pl-8 pr-7 py-1 text-xs rounded-lg border border-border/80 bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  {taskSearch && (
                    <button
                      type="button"
                      onClick={() => setTaskSearch('')}
                      className="absolute right-2 text-muted-foreground hover:text-foreground p-0.5"
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
                  title={taskSearch ? 'No matching tasks' : 'Nothing assigned to you'}
                  description={
                    taskSearch
                      ? 'Try clearing your search query.'
                      : 'Tasks assigned to you across all projects will show up here.'
                  }
                  action={
                    <Button asChild size="sm" variant="outline" className="rounded-lg">
                      <Link to={`/w/${slug}/tasks`}>Open the board</Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="space-y-2.5">
                  {myTasks.map((task) => {
                    const isOverdue =
                      !!task.dueDate && Date.parse(task.dueDate) < Date.now();
                    const taskHref = `/w/${slug}/tasks?card=${task.id}`;

                    return (
                      <li key={task.id}>
                        <Card className="group p-3.5 sm:p-4 gap-4 flex items-center justify-between bg-surface transition-all duration-(--duration-fast) rounded-xl border border-border/70 hover:border-border-strong hover:bg-surface-raised hover:shadow-md">
                          <Link to={taskHref} className="min-w-0 flex-1 block">
                            <div className="flex items-center gap-2 flex-wrap">
                              {task.identifier ? (
                                <span className="font-mono text-[11px] font-bold text-primary px-1.5 py-0.2 rounded bg-primary/10">
                                  {task.identifier}
                                </span>
                              ) : null}
                              <h4 className="text-xs font-semibold truncate text-foreground group-hover:text-primary transition-colors">
                                {task.title}
                              </h4>
                              <Badge
                                variant="neutral"
                                className="capitalize text-[10px] px-1.5 py-0 h-4 font-medium"
                              >
                                {task.status.toLowerCase().replace(/_/g, ' ')}
                              </Badge>
                              {task.priority ? (
                                <PriorityBadge priority={task.priority} />
                              ) : null}
                            </div>

                            <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              {task.project ? (
                                <span className="gap-1 inline-flex items-center align-middle font-medium">
                                  <ProjectGlyph
                                    icon={task.project.icon}
                                    iconColor={task.project.iconColor}
                                    color={task.project.color}
                                    size="xs"
                                  />
                                  <span>{task.project.name}</span>
                                </span>
                              ) : (
                                <span>No project</span>
                              )}

                              {task.dueDate ? (
                                <span
                                  className={cn(
                                    'inline-flex items-center gap-1 font-medium',
                                    isOverdue
                                      ? 'text-destructive font-semibold'
                                      : 'text-muted-foreground',
                                  )}
                                >
                                  <Calendar className="size-3" />
                                  <span>
                                    Due {formatDate(task.dueDate)}
                                    {isOverdue ? ' (Overdue)' : ''}
                                  </span>
                                </span>
                              ) : null}

                              {task._count?.comments ? (
                                <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground/80">
                                  <MessageSquare className="size-3" />
                                  <span>{task._count.comments}</span>
                                </span>
                              ) : null}
                            </div>
                          </Link>

                          <div className="flex items-center gap-2 shrink-0">
                            {task.assignee ? (
                              <UserAvatar
                                name={
                                  task.assignee.displayName ??
                                  task.assignee.name
                                }
                                src={task.assignee.avatarUrl}
                                seed={task.assignee.id}
                                size="xs"
                                indicator={false}
                                className="shrink-0 font-bold"
                              />
                            ) : null}
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="h-7 px-2.5 text-xs gap-1 rounded-lg border-border/80 group-hover:border-primary/40 group-hover:bg-primary/10 group-hover:text-primary transition-all font-medium cursor-pointer"
                            >
                              <Link to={taskHref}>
                                <span>View task</span>
                                <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                              </Link>
                            </Button>
                          </div>
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
