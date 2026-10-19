import type { NotificationView } from '@org/types';
import { Button, EmptyState, Hint, Skeleton } from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import {
  AtSign,
  Bell,
  Bot,
  Calendar,
  Check,
  CheckCheck,
  CheckSquare,
  FileText,
  Phone,
  Sparkles,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationAvatar } from './notification-avatar.js';
import {
  useNotificationList,
  useNotificationMutations,
  useNotificationUnreadCount,
} from './use-notification-center.js';

export type NotificationFilterTab = 'all' | 'unread' | 'mentions' | 'activity';

export interface NotificationCenterListProps {
  workspaceId: string;
  workspaceSlug: string;
  className?: string;
}

const FILTER_TABS: Array<{ id: NotificationFilterTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'mentions', label: 'Mentions' },
  { id: 'activity', label: 'Updates' },
];

function getCategoryIcon(kind?: string) {
  if (!kind) return null;
  if (/^AI_/i.test(kind)) return <Bot className="size-3 text-primary" />;
  if (/MENTION/i.test(kind)) return <AtSign className="size-3 text-sky-500" />;
  if (/^TASK_/i.test(kind)) return <CheckSquare className="size-3 text-emerald-500" />;
  if (/^CALL_/i.test(kind)) return <Phone className="size-3 text-violet-500" />;
  if (/^MEETING_/i.test(kind)) return <Calendar className="size-3 text-amber-500" />;
  if (/DOCUMENT|FILE/i.test(kind)) return <FileText className="size-3 text-blue-500" />;
  return <Sparkles className="size-3 text-muted-foreground" />;
}

function getCategoryLabel(kind?: string) {
  if (!kind) return null;
  if (kind === 'AI_APPROVAL_REQUIRED') return 'Approval';
  if (kind === 'AI_RUN_COMPLETED') return 'Agent Done';
  if (kind === 'AI_RUN_FAILED') return 'Agent Failed';
  if (kind === 'AI_AGENT_MESSAGE') return 'Agent Message';
  if (kind === 'MENTION') return 'Mention';
  if (kind === 'TASK_ASSIGNED') return 'Task Assigned';
  if (kind === 'TASK_COMPLETED') return 'Task Done';
  if (/CALL/i.test(kind)) return 'Call';
  if (/MEETING/i.test(kind)) return 'Meeting';
  if (/INVITE/i.test(kind)) return 'Invite';
  return null;
}

/**
 * The personal notification centre — server-backed rows addressed to this
 * user (mentions, assignments, approvals, agent runs, calls…) with real read
 * state, filters, mark-as-read, dismiss and deep links. It lives in the Inbox
 * (the "For you" tab), the one destination for every kind of notification;
 * the sidebar Inbox row carries its unread count.
 */
export function NotificationCenterList({
  workspaceId,
  workspaceSlug,
  className,
}: NotificationCenterListProps) {
  const [activeTab, setActiveTab] = useState<NotificationFilterTab>('all');
  const navigate = useNavigate();

  const unreadQuery = useNotificationUnreadCount(workspaceId);
  const unread = unreadQuery.data ?? 0;

  const list = useNotificationList(workspaceId, {
    unreadOnly: activeTab === 'unread',
  });

  const { markRead, markAllRead, dismiss } = useNotificationMutations(workspaceId);

  const badge = unread > 99 ? '99+' : String(unread);

  const filteredItems = useMemo(() => {
    const raw = list.items;
    if (activeTab === 'unread') return raw.filter((item) => !item.read);
    if (activeTab === 'mentions') return raw.filter((item) => item.kind === 'MENTION');
    if (activeTab === 'activity') return raw.filter((item) => item.kind !== 'MENTION');
    return raw;
  }, [list.items, activeTab]);

  const openRow = (n: NotificationView) => {
    if (!n.read) markRead.mutate(n.id);
    if (n.deepLink) {
      navigate(`/w/${workspaceSlug}/${n.deepLink.replace(/^\/+/, '')}`);
    }
  };

  const handleMarkItemRead = (e: React.MouseEvent, n: NotificationView) => {
    e.stopPropagation();
    if (!n.read) markRead.mutate(n.id);
  };

  const handleDismissItem = (e: React.MouseEvent, n: NotificationView) => {
    e.stopPropagation();
    dismiss.mutate(n.id);
  };

  return (
    <div className={cn('space-y-3.5', className)}>
      {/* Filter strip + mark all */}
      <div className="gap-2.5 pb-1 flex flex-wrap items-center justify-between">
        <div className="gap-1.5 py-0.5 no-scrollbar flex items-center overflow-x-auto">
          {FILTER_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium shrink-0 cursor-pointer rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
              >
                <span>{tab.label}</span>
                {tab.id === 'unread' && unread > 0 ? (
                  <span
                    className={cn(
                      'ml-1.5 px-1.5 text-[10px] font-bold inline-flex items-center justify-center rounded-full',
                      isActive
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-primary text-primary-foreground',
                    )}
                  >
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => markAllRead.mutate()}
          disabled={unread === 0 || markAllRead.isPending}
          className="h-7 gap-1.5 text-xs cursor-pointer rounded-lg"
        >
          <CheckCheck className="size-3.5" />
          Mark all as read
        </Button>
      </div>

      {list.isLoading ? (
        <div className="space-y-3 p-4 rounded-xl border border-border/70 bg-surface">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="gap-3 flex items-start">
              <Skeleton className="size-8 shrink-0 rounded-full" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="h-2.5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : list.isError ? (
        <div className="px-4 py-8 text-sm text-center text-muted-foreground">
          Couldn’t load notifications.
          <button
            type="button"
            onClick={() => list.refetch()}
            className="ml-1 font-medium cursor-pointer text-primary hover:underline"
          >
            Retry
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon={<Bell />}
          title={
            activeTab === 'unread'
              ? 'No unread notifications'
              : activeTab === 'mentions'
                ? 'No mentions yet'
                : activeTab === 'activity'
                  ? 'No updates yet'
                  : 'You’re all caught up'
          }
          description={
            activeTab === 'unread'
              ? 'All notifications have been read.'
              : activeTab === 'mentions'
                ? 'When someone mentions you with @, it will show up here.'
                : activeTab === 'activity'
                  ? 'Task updates, agent executions, and calls will appear here.'
                  : 'Mentions, assignments, approvals and agent runs for you show up here.'
          }
        />
      ) : (
        <ul className="divide-y divide-border/40 overflow-hidden rounded-xl border border-border/70 bg-surface">
          {filteredItems.map((n) => {
            const categoryIcon = getCategoryIcon(n.kind);
            const categoryLabel = getCategoryLabel(n.kind);

            return (
              <li
                key={n.id}
                className={cn(
                  'group gap-3 px-4 py-3 relative flex cursor-pointer items-start transition-colors hover:bg-accent/40',
                  !n.read && 'bg-primary/[0.04]',
                )}
                onClick={() => openRow(n)}
              >
                <div className="pt-1 flex shrink-0 flex-col items-center justify-center">
                  {!n.read ? (
                    <span
                      className="size-2 shadow-xs rounded-full bg-primary"
                      title="Unread"
                      aria-label="Unread"
                    />
                  ) : (
                    <span className="size-2 opacity-0" />
                  )}
                </div>

                <span className="relative shrink-0">
                  <NotificationAvatar notification={n} size="sm" />
                </span>

                <span className="min-w-0 flex-1">
                  <div className="gap-2 flex items-center justify-between">
                    <span
                      className={cn(
                        'text-sm leading-snug block truncate text-foreground',
                        n.read ? 'font-normal' : 'font-medium',
                      )}
                    >
                      {n.title}
                    </span>
                    <span className="text-[11px] shrink-0 whitespace-nowrap text-muted-foreground">
                      {formatRelative(n.createdAt)}
                    </span>
                  </div>

                  {n.body ? (
                    <span className="mt-0.5 text-xs leading-relaxed line-clamp-2 block text-muted-foreground">
                      {n.body}
                    </span>
                  ) : null}

                  {categoryLabel ? (
                    <div className="mt-1.5 gap-1.5 flex items-center">
                      <span className="gap-1 px-1.5 py-0.5 text-[10px] font-medium inline-flex items-center rounded-md bg-muted text-muted-foreground">
                        {categoryIcon}
                        <span>{categoryLabel}</span>
                      </span>
                    </div>
                  ) : null}
                </span>

                {/* Quick actions (mark as read & dismiss) */}
                <div className="right-3 top-3 gap-1 p-0.5 shadow-xs backdrop-blur-xs absolute hidden items-center rounded-lg border border-border/50 bg-popover/90 opacity-0 transition-opacity group-focus-within:flex group-focus-within:opacity-100 group-hover:flex group-hover:opacity-100">
                  {!n.read ? (
                    <Hint label="Mark as read">
                      <button
                        type="button"
                        onClick={(e) => handleMarkItemRead(e, n)}
                        aria-label="Mark notification read"
                        className="p-1 cursor-pointer rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        <Check className="size-3.5" />
                      </button>
                    </Hint>
                  ) : null}
                  <Hint label="Dismiss">
                    <button
                      type="button"
                      onClick={(e) => handleDismissItem(e, n)}
                      aria-label="Dismiss notification"
                      className="p-1 cursor-pointer rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </Hint>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {list.hasNextPage ? (
        <Button
          variant="ghost"
          size="sm"
          className="text-xs w-full"
          onClick={() => list.fetchNextPage()}
          disabled={list.isFetchingNextPage}
        >
          {list.isFetchingNextPage ? 'Loading…' : 'Load older notifications'}
        </Button>
      ) : null}
    </div>
  );
}
