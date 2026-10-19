import type { NotificationView } from '@org/types';
import {
  Button,
  EmptyState,
  Hint,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
  Skeleton,
} from '@org/ui';
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

export interface NotificationBellProps {
  workspaceId: string;
  workspaceSlug: string;
  className?: string;
}

const FILTER_TABS: Array<{ id: NotificationFilterTab; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'mentions', label: 'Mentions' },
  { id: 'activity', label: 'Activity' },
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
 * The header bell — server-backed unread count plus a polished dropdown notification center
 * with All, Unread, Mentions, and Activity filters, timestamps, previews, mark-as-read,
 * and deep link navigation.
 */
export function NotificationBell({
  workspaceId,
  workspaceSlug,
  className,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NotificationFilterTab>('all');
  const navigate = useNavigate();

  const unreadQuery = useNotificationUnreadCount(workspaceId);
  const unread = unreadQuery.data ?? 0;

  // Query server list: when unread tab is active, query server-side unread filter
  const list = useNotificationList(workspaceId, {
    unreadOnly: activeTab === 'unread',
    enabled: open,
  });

  const { markRead, markAllRead, dismiss } = useNotificationMutations(workspaceId);

  const badge = unread > 99 ? '99+' : String(unread);

  // Filter items in memory according to the selected tab
  const filteredItems = useMemo(() => {
    const raw = list.items;
    if (activeTab === 'unread') {
      return raw.filter((item) => !item.read);
    }
    if (activeTab === 'mentions') {
      return raw.filter((item) => item.kind === 'MENTION');
    }
    if (activeTab === 'activity') {
      return raw.filter((item) => item.kind !== 'MENTION');
    }
    return raw;
  }, [list.items, activeTab]);

  const openRow = (n: NotificationView) => {
    if (!n.read) markRead.mutate(n.id);
    if (n.deepLink) {
      setOpen(false);
      navigate(`/w/${workspaceSlug}/${n.deepLink.replace(/^\/+/, '')}`);
    }
  };

  const handleMarkItemRead = (e: React.MouseEvent, n: NotificationView) => {
    e.stopPropagation();
    if (!n.read) {
      markRead.mutate(n.id);
    }
  };

  const handleDismissItem = (e: React.MouseEvent, n: NotificationView) => {
    e.stopPropagation();
    dismiss.mutate(n.id);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Hint label="Notifications">
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={
              unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'
            }
            className={cn(
              'relative size-7 p-0 text-muted-foreground hover:text-foreground cursor-pointer',
              className,
            )}
          >
            <Bell className="size-4" />
            {unread > 0 ? (
              <span
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#007AFF] px-1 text-[10px] font-bold leading-none text-white shadow-xs"
                aria-hidden
              >
                {badge}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
      </Hint>

      <PopoverContent
        align="end"
        sideOffset={8}
        className="w-[24rem] sm:w-[27rem] p-0 overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5 bg-card/40">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unread > 0 ? (
              <span className="inline-flex items-center justify-center rounded-full bg-[#007AFF]/15 text-[#007AFF] px-2 py-0.5 text-[11px] font-semibold">
                {unread} new
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => markAllRead.mutate()}
            disabled={unread === 0 || markAllRead.isPending}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <CheckCheck className="size-3.5" />
            Mark all as read
          </button>
        </div>

        {/* Filter Strip: All, Unread, Mentions, Activity */}
        <div className="flex items-center gap-1 border-b border-border/50 px-3 py-1.5 bg-muted/30">
          {FILTER_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'relative px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer',
                  isActive
                    ? 'bg-background text-foreground shadow-xs font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60',
                )}
              >
                <span>{tab.label}</span>
                {tab.id === 'unread' && unread > 0 ? (
                  <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-[#007AFF] px-1.5 py-0.2 text-[10px] font-bold text-white">
                    {badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Notifications List Area */}
        <ScrollArea className="max-h-[26rem]">
          {list.isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3 items-start">
                  <Skeleton className="size-8 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-2.5 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : list.isError ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Couldn’t load notifications.
              <button
                type="button"
                onClick={() => list.refetch()}
                className="ml-1 font-medium text-primary hover:underline cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : filteredItems.length === 0 ? (
            <EmptyState
              size="sm"
              icon={<Bell className="size-5" />}
              title={
                activeTab === 'unread'
                  ? 'No unread notifications'
                  : activeTab === 'mentions'
                    ? 'No mentions yet'
                    : activeTab === 'activity'
                      ? 'No recent activity'
                      : 'You’re all caught up'
              }
              description={
                activeTab === 'unread'
                  ? 'All notifications have been read.'
                  : activeTab === 'mentions'
                    ? 'When someone mentions you with @, it will show up here.'
                    : activeTab === 'activity'
                      ? 'Task updates, agent executions, and calls will appear here.'
                      : 'New activity assigned to you shows up here.'
              }
              className="bg-transparent py-10"
            />
          ) : (
            <ul className="divide-y divide-border/40">
              {filteredItems.map((n) => {
                const categoryIcon = getCategoryIcon(n.kind);
                const categoryLabel = getCategoryLabel(n.kind);

                return (
                  <li
                    key={n.id}
                    className={cn(
                      'group relative flex items-start gap-3 px-4 py-3 transition-colors hover:bg-accent/40 cursor-pointer',
                      !n.read && 'bg-[#007AFF]/[0.04]',
                    )}
                    onClick={() => openRow(n)}
                  >
                    {/* Slack-style blue indicator dot for unread */}
                    <div className="flex flex-col items-center justify-center shrink-0 pt-1">
                      {!n.read ? (
                        <span
                          className="size-2 rounded-full bg-[#007AFF] shadow-xs"
                          title="Unread"
                          aria-label="Unread"
                        />
                      ) : (
                        <span className="size-2 opacity-0" />
                      )}
                    </div>

                    {/* Avatar / Icon */}
                    <span className="relative shrink-0">
                      <NotificationAvatar notification={n} size="sm" />
                    </span>

                    {/* Body content */}
                    <span className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="block text-xs font-medium leading-snug text-foreground truncate">
                          {n.title}
                        </span>
                        <span className="shrink-0 text-[11px] text-muted-foreground whitespace-nowrap">
                          {formatRelative(n.createdAt)}
                        </span>
                      </div>

                      {n.body ? (
                        <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                          {n.body}
                        </span>
                      ) : null}

                      {categoryLabel ? (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                            {categoryIcon}
                            <span>{categoryLabel}</span>
                          </span>
                        </div>
                      ) : null}
                    </span>

                    {/* Quick Action Buttons (Mark as read & Dismiss) */}
                    <div className="absolute right-3 top-3 hidden items-center gap-1 opacity-0 transition-opacity group-hover:flex group-hover:opacity-100 bg-popover/90 backdrop-blur-xs rounded-lg p-0.5 shadow-xs border border-border/50">
                      {!n.read ? (
                        <Hint label="Mark as read">
                          <button
                            type="button"
                            onClick={(e) => handleMarkItemRead(e, n)}
                            aria-label="Mark notification read"
                            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
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
                          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground cursor-pointer"
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
        </ScrollArea>

        {list.hasNextPage ? (
          <div className="border-t border-border/60 p-2 bg-card/20">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => list.fetchNextPage()}
              disabled={list.isFetchingNextPage}
            >
              {list.isFetchingNextPage ? 'Loading…' : 'Load older notifications'}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
