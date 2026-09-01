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
import { Bell, Check, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NotificationAvatar } from './notification-avatar.js';
import {
  useNotificationList,
  useNotificationMutations,
  useNotificationUnreadCount,
} from './use-notification-center.js';

export interface NotificationBellProps {
  workspaceId: string;
  workspaceSlug: string;
}

/**
 * The header bell — server-backed unread count plus a menu of the caller's
 * notifications. Opening the menu does not mark anything read; clicking a row
 * does, and then routes to the thing it is about.
 */
export function NotificationBell({
  workspaceId,
  workspaceSlug,
}: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const unreadQuery = useNotificationUnreadCount(workspaceId);
  const unread = unreadQuery.data ?? 0;

  // The list is only fetched while the menu is open — the badge poll is enough
  // to know whether there is anything to show.
  const list = useNotificationList(workspaceId, { enabled: open });
  const { markRead, markAllRead, dismiss } = useNotificationMutations(workspaceId);

  const badge = unread > 9 ? '9+' : String(unread);

  const openRow = (n: NotificationView) => {
    if (!n.read) markRead.mutate(n.id);
    if (n.deepLink) {
      setOpen(false);
      navigate(`/w/${workspaceSlug}/${n.deepLink.replace(/^\/+/, '')}`);
    }
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
            className="relative size-7 p-0 text-muted-foreground hover:text-foreground"
          >
            <Bell className="size-4" />
            {unread > 0 ? (
              <span
                className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
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
        className="w-[22rem] p-0 overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
          <span className="text-sm font-semibold">Notifications</span>
          <button
            type="button"
            onClick={() => markAllRead.mutate()}
            disabled={unread === 0 || markAllRead.isPending}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40 disabled:hover:text-muted-foreground"
          >
            <Check className="size-3.5" />
            Mark all read
          </button>
        </div>

        <ScrollArea className="max-h-96">
          {list.isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex gap-3">
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
                className="ml-1 font-medium text-primary hover:underline"
              >
                Retry
              </button>
            </div>
          ) : list.items.length === 0 ? (
            <EmptyState
              size="sm"
              icon={<Bell className="size-5" />}
              title="You’re all caught up"
              description="New activity assigned to you shows up here."
              className="bg-transparent"
            />
          ) : (
            <ul className="divide-y divide-border/50">
              {list.items.map((n) => (
                <li key={n.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => openRow(n)}
                    className={cn(
                      'flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50',
                      !n.read && 'bg-primary/[0.04]',
                    )}
                  >
                    <span className="relative mt-0.5 shrink-0">
                      <NotificationAvatar notification={n} size="sm" />
                      {!n.read ? (
                        <span className="absolute -left-1 top-1/2 size-2 -translate-y-1/2 rounded-full bg-primary" />
                      ) : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs leading-snug text-foreground">
                        {n.title}
                      </span>
                      {n.body ? (
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                          {n.body}
                        </span>
                      ) : null}
                      <span className="mt-1 block text-[11px] text-subtle">
                        {formatRelative(n.createdAt)}
                      </span>
                    </span>
                  </button>
                  <Hint label="Dismiss">
                    <button
                      type="button"
                      onClick={() => dismiss.mutate(n.id)}
                      aria-label="Dismiss notification"
                      className="absolute right-2 top-2 hidden rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:flex group-hover:opacity-100"
                    >
                      <X className="size-3.5" />
                    </button>
                  </Hint>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>

        {list.hasNextPage ? (
          <div className="border-t border-border/60 p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs"
              onClick={() => list.fetchNextPage()}
              disabled={list.isFetchingNextPage}
            >
              {list.isFetchingNextPage ? 'Loading…' : 'Load older'}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
