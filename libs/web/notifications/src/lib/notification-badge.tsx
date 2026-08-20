import { Badge } from '@org/ui';

/**
 * The unread count that rides on the header bell.
 *
 * Positioned absolutely, so the trigger it sits inside has to be `relative`.
 */
export function NotificationBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Badge
      variant="primary"
      className="-right-0.5 -top-0.5 min-w-4 px-1 py-0 leading-4 absolute justify-center text-[10px]"
    >
      {count > 99 ? '99+' : count}
    </Badge>
  );
}
