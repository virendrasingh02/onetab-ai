import {
  Badge,
  EmptyState,
  ScrollArea,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import { Bell } from 'lucide-react';

export interface NotificationItem {
  id: string;
  title: string;
  body?: string;
  createdAt: string;
  read: boolean;
}

export interface NotificationCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Phase 2 ships the surface; the feed arrives with the realtime service. */
  notifications?: NotificationItem[];
}

export function NotificationCenter({
  open,
  onOpenChange,
  notifications = [],
}: NotificationCenterProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-sm w-full">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>
            Mentions, invitations and channel activity.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="scrollbar-subtle px-6 pb-6 flex-1">
          {notifications.length === 0 ? (
            <EmptyState
              icon={<Bell />}
              title="You are all caught up"
              description="New activity will show up here."
            />
          ) : (
            <ul className="divide-y">
              {notifications.map((notification) => (
                <li key={notification.id} className="gap-3 py-3 flex">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{notification.title}</p>
                    {notification.body ? (
                      <p className="text-sm text-muted-foreground">
                        {notification.body}
                      </p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatRelative(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.read ? (
                    <Badge variant="primary">New</Badge>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
