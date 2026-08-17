import type { ActivityFeedItem } from '@org/types';
import {
  Badge,
  Button,
  EmptyState,
  ScrollArea,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SkeletonList,
  UserAvatar,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import { Bell, Hash, TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  useNotificationFeed,
  useNotificationUnread,
} from './use-notifications.js';

/**
 * Human wording for an `ActivityKind`.
 *
 * The API sends the raw enum so the copy stays a client concern; unknown
 * kinds fall through to a readable form of the enum rather than blank text,
 * which keeps a newly added kind from rendering as an empty row.
 */
function describe(item: ActivityFeedItem): string {
  const who = item.user?.displayName ?? item.user?.name ?? 'Someone';

  switch (item.kind) {
    case 'MESSAGE':
      return `${who} posted a message`;
    case 'MEMBER_JOINED':
      return `${who} joined the workspace`;
    case 'MEMBER_LEFT':
      return `${who} left the workspace`;
    case 'CHANNEL_CREATED':
      return `${who} created a channel`;
    case 'FILE_SHARED':
      return `${who} shared a file`;
    default:
      return `${who} · ${item.kind.toLowerCase().replace(/_/g, ' ')}`;
  }
}

export interface NotificationCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
  workspaceSlug: string;
}

/**
 * The activity feed for the current workspace.
 *
 * Opening the sheet marks everything currently listed as seen, which is what
 * clears the header badge — see `useNotificationUnread` for why read state is
 * tracked here rather than on the server.
 */
export function NotificationCenter({
  open,
  onOpenChange,
  workspaceId,
  workspaceSlug,
}: NotificationCenterProps) {
  const feed = useNotificationFeed(workspaceId);
  const { markAllSeen } = useNotificationUnread(workspaceId, feed.data);

  useEffect(() => {
    if (open && feed.data) markAllSeen();
  }, [open, feed.data, markAllSeen]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-sm w-full">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>
            Mentions, invitations and channel activity.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1" contentClassName="px-6 pb-6">
          {feed.isLoading ? (
            <SkeletonList rows={6} withAvatar />
          ) : feed.isError ? (
            <EmptyState
              icon={<TriangleAlert />}
              title="Could not load activity"
              description="Something went wrong fetching the feed."
              action={
                <Button variant="outline" onClick={() => void feed.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : !feed.data?.length ? (
            <EmptyState
              icon={<Bell />}
              title="You are all caught up"
              description="New activity will show up here."
            />
          ) : (
            <ul className="divide-y">
              {feed.data.map((item) => (
                <li key={item.id} className="gap-3 py-3 flex">
                  <UserAvatar
                    name={item.user?.displayName ?? item.user?.name ?? 'Unknown'}
                    src={item.user?.avatarUrl}
                    seed={item.user?.id ?? item.id}
                    size="sm"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{describe(item)}</p>
                    {item.channel ? (
                      <Link
                        to={`/w/${workspaceSlug}/c/${item.channel.slug}`}
                        onClick={() => onOpenChange(false)}
                        className="mt-0.5 gap-1 text-sm text-muted-foreground inline-flex items-center hover:text-foreground"
                      >
                        <Hash className="size-3" aria-hidden />
                        <span className="truncate">{item.channel.name}</span>
                      </Link>
                    ) : null}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatRelative(item.occurredAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export type NotificationItem = ActivityFeedItem;

/** Standalone badge for the header bell. */
export function NotificationBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Badge
      variant="primary"
      className="absolute -right-0.5 -top-0.5 min-w-4 justify-center px-1 py-0 text-[10px] leading-4"
    >
      {count > 99 ? '99+' : count}
    </Badge>
  );
}
