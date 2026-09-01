import { cn } from '@org/utils';
import type { AvatarProps, PresenceStatus } from './avatar.js';
import { UserAvatar } from './avatar.js';

export interface UserIdentityProps {
  name: string;
  displayName?: string | null;
  src?: string | null;
  seed?: string;
  email?: string | null;
  handle?: string | null;
  subtitle?: React.ReactNode;
  size?: AvatarProps['size'];
  presence?: PresenceStatus;
  indicator?: boolean;
  statusEmoji?: string | null;
  statusText?: string | null;
  className?: string;
  avatarClassName?: string;
  nameClassName?: string;
  subtitleClassName?: string;
  badge?: React.ReactNode;
}

/**
 * Standardized identity block pairing a UserAvatar with name and secondary metadata
 * (email, handle, status, presence).
 */
export function UserIdentity({
  name,
  displayName,
  src,
  seed,
  email,
  handle,
  subtitle,
  size = 'sm',
  presence,
  indicator = true,
  statusEmoji,
  statusText,
  className,
  avatarClassName,
  nameClassName,
  subtitleClassName,
  badge,
}: UserIdentityProps) {
  const primaryName = displayName ?? name;
  const secondaryText =
    subtitle ??
    (handle ? `@${handle.replace(/^@/, '')}` : email ?? (displayName ? `@${name}` : null));

  return (
    <div className={cn('inline-flex items-center gap-2.5 min-w-0', className)}>
      <UserAvatar
        name={primaryName}
        src={src}
        seed={seed ?? name}
        size={size}
        presence={presence}
        indicator={indicator}
        statusEmoji={statusEmoji}
        statusText={statusText}
        className={avatarClassName}
      />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={cn(
              'font-semibold text-xs text-foreground truncate',
              nameClassName,
            )}
          >
            {primaryName}
          </span>
          {badge}
        </div>
        {secondaryText ? (
          <span
            className={cn(
              'block text-[11px] text-muted-foreground truncate font-mono',
              subtitleClassName,
            )}
          >
            {secondaryText}
          </span>
        ) : null}
      </div>
    </div>
  );
}
