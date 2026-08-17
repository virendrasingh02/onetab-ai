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
      className="absolute -right-0.5 -top-0.5 min-w-4 justify-center px-1 py-0 text-[10px] leading-4"
    >
      {count > 99 ? '99+' : count}
    </Badge>
  );
}
