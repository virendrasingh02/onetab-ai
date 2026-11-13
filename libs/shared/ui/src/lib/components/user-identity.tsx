import { cn } from '@org/utils';
import type { AvatarProps, PresenceInput } from './avatar.js';
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
  presence?: PresenceInput | null;
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
    (handle
      ? `@${handle.replace(/^@/, '')}`
      : (email ?? (displayName ? `@${name}` : null)));

  return (
    <div className={cn('gap-2.5 min-w-0 inline-flex items-center', className)}>
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
      <div className="min-w-0 leading-tight flex-1">
        <div className="gap-1.5 min-w-0 flex items-center">
          <span
            className={cn(
              'font-semibold text-xs truncate text-foreground',
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
              'block truncate font-mono text-meta text-muted-foreground',
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
