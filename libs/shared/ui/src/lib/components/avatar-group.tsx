import { cn } from '@org/utils';
import type { AvatarProps } from './avatar.js';
import { UserAvatar } from './avatar.js';
import { Hint } from './tooltip.js';

export interface AvatarGroupUser {
  id: string;
  name: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
}

export interface UserAvatarGroupProps {
  users: AvatarGroupUser[];
  /** Maximum number of avatars shown before displaying the +N overflow count. Default: 3. */
  max?: number;
  size?: AvatarProps['size'];
  className?: string;
  /** Optional custom class for the +N overflow pill. */
  overflowClassName?: string;
}

const OVERFLOW_SIZES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: 'size-5 text-[9px]',
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
  xl: 'size-16 text-base',
};

const SPACING_SIZES: Record<NonNullable<AvatarProps['size']>, string> = {
  xs: '-space-x-1.5',
  sm: '-space-x-2',
  md: '-space-x-2.5',
  lg: '-space-x-3',
  xl: '-space-x-4',
};

/**
 * A compact, overlapping stack of user avatars with automatic overflow counter
 * and name tooltips.
 */
export function UserAvatarGroup({
  users,
  max = 3,
  size = 'xs',
  className,
  overflowClassName,
}: UserAvatarGroupProps) {
  if (!users.length) return null;

  const visibleUsers = users.slice(0, max);
  const overflow = users.length - max;
  const remainingNames = users
    .slice(max)
    .map((u) => u.displayName ?? u.name)
    .join(', ');

  const allNames = users.map((u) => u.displayName ?? u.name).join(', ');

  return (
    <div
      role="group"
      aria-label={`Assigned to: ${allNames}`}
      className={cn(
        'inline-flex items-center',
        SPACING_SIZES[size ?? 'xs'],
        className,
      )}
    >
      {visibleUsers.map((user, index) => {
        const name = user.displayName ?? user.name;
        return (
          <Hint key={user.id || index} label={name} side="top">
            <span
              className="inline-flex shrink-0 transition-transform duration-150 ease-out hover:z-10 hover:scale-110"
              style={{ zIndex: visibleUsers.length - index }}
            >
              <UserAvatar
                name={name}
                src={user.avatarUrl}
                seed={user.id}
                size={size}
                indicator={false}
                className="ring-2 ring-background shadow-xs font-bold"
              />
            </span>
          </Hint>
        );
      })}

      {overflow > 0 && (
        <Hint label={remainingNames ? `+${overflow} more: ${remainingNames}` : `+${overflow} more`} side="top">
          <span
            style={{ zIndex: 0 }}
            className={cn(
              'relative inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold tabular-nums',
              'border border-border/80 bg-muted/90 text-muted-foreground ring-2 ring-background',
              OVERFLOW_SIZES[size ?? 'xs'],
              overflowClassName,
            )}
            aria-label={`${overflow} more users`}
          >
            +{overflow}
          </span>
        </Hint>
      )}
    </div>
  );
}
