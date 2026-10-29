import { cn } from '@org/utils';
import { BellOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

/**
 * What the activity-list layout of a sidebar row shows. The channel, DM and
 * group-DM rows take this as an optional prop: present, they draw the
 * two-line activity layout; absent, their usual compact one. Either way the
 * row keeps its own ⋯ menu, right-click menu, favorite star and dialogs, so
 * both sidebar views offer exactly the same actions.
 */
export interface ActivityRowContent {
  avatar: ReactNode;
  /** Last message, e.g. "You: see you then". */
  preview?: string;
  /** Epoch ms of the last message. */
  lastActivityAt?: number;
  /** Shown when there is no preview. */
  emptyPreview?: string;
  /**
   * Overrides the router's match — group DMs share `/dms` and differ only by
   * `?room=`, which NavLink ignores.
   */
  isActive?: boolean;
}

/** Pins a row's ⋯ / star to its first line, over the time. */
export const ACTIVITY_ROW_ACTIONS_CLASS = 'top-2.5 translate-y-0';

/** "now", "5m ago", "6:26 PM", "Yesterday", "Mon", "Oct 3". */
export function formatActivityTime(
  timestamp: number,
  now = Date.now(),
): string {
  const diff = now - timestamp;
  if (diff < 60_000) return 'now';
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}m ago`;
  const date = new Date(timestamp);
  const today = new Date(now);
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  if (diff < 6 * 24 * 60 * 60_000) {
    return date.toLocaleDateString(undefined, { weekday: 'short' });
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() !== today.getFullYear()
      ? { year: 'numeric' as const }
      : {}),
  });
}

/**
 * The two-line activity-list link: avatar, name + time, preview + unread mark.
 * Rendered inside a row's `<li className="group/row">`, next to its
 * `NavRowActions`; the time steps aside while those actions are showing.
 */
export function ActivityRowLink({
  to,
  name,
  content,
  hasUnread,
  isMuted,
  isPinned = false,
  dimmed = false,
  indicator,
}: {
  to: string;
  name: string;
  content: ActivityRowContent;
  hasUnread: boolean;
  isMuted: boolean;
  /** Row actions always visible (a favorite's star) — keep room for them. */
  isPinned?: boolean;
  /** Archived channels read faded. */
  dimmed?: boolean;
  /** The row's own `SidebarActivityIndicator`. */
  indicator: ReactNode;
}) {
  const time = content.lastActivityAt ? (
    <time
      dateTime={new Date(content.lastActivityAt).toISOString()}
      className={cn(
        'shrink-0 text-[11px] text-muted-foreground tabular-nums transition-opacity',
        // The ⋯ / star sit over this corner while they show.
        isPinned
          ? 'opacity-0'
          : 'group-focus-within/row:opacity-0 group-hover/row:opacity-0 pointer-coarse:opacity-0',
      )}
    >
      {formatActivityTime(content.lastActivityAt)}
    </time>
  ) : null;

  return (
    <NavLink
      to={to}
      aria-current={content.isActive ? 'page' : undefined}
      className={({ isActive: routeActive }) => {
        const isActive = content.isActive ?? routeActive;
        return cn(
          'group gap-2.5 px-2 py-2 relative flex items-center rounded-xl',
          'outline-none focus-visible:ring-1 focus-visible:ring-ring',
          'transition-colors duration-(--duration-fast)',
          isActive
            ? 'nav-row-active bg-primary/12 ring-1 ring-primary/20 ring-inset'
            : 'hover:bg-accent/70',
          dimmed && 'opacity-65',
        );
      }}
    >
      {({ isActive: routeActive }) => {
        const isActive = content.isActive ?? routeActive;
        return (
          <>
            {content.avatar}
            <span className="min-w-0 flex-1">
              <span className="gap-2 flex items-baseline">
                <span
                  className={cn(
                    'min-w-0 text-sm flex-1 truncate',
                    isActive
                      ? 'font-semibold text-primary-text'
                      : hasUnread
                        ? 'font-semibold text-foreground'
                        : 'font-medium text-foreground/90',
                    isMuted && !isActive && 'text-muted-foreground',
                  )}
                >
                  {name}
                </span>
                {time}
              </span>
              <span className="gap-2 flex items-center">
                <span
                  className={cn(
                    'min-w-0 text-xs flex-1 truncate',
                    hasUnread ? 'text-foreground/85' : 'text-muted-foreground',
                  )}
                >
                  {content.preview ?? content.emptyPreview ?? ''}
                </span>
                {isMuted ? (
                  <BellOff
                    className="size-3 shrink-0 text-muted-foreground/70"
                    aria-label="Notifications muted"
                  />
                ) : null}
                {indicator}
              </span>
            </span>
          </>
        );
      }}
    </NavLink>
  );
}
