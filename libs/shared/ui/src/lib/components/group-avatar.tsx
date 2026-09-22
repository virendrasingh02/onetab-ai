import { cn } from '@org/utils';
import type { AvatarProps } from './avatar.js';
import { UserAvatar } from './avatar.js';
import type { AvatarGroupUser } from './avatar-group.js';
import { UserAvatarGroup } from './avatar-group.js';

export interface GroupAvatarMember {
  userId: string;
  displayName: string;
  avatarUrl?: string | null;
}

export interface GroupAvatarProps {
  name: string;
  avatarUrl?: string | null;
  members?: GroupAvatarMember[];
  size?: AvatarProps['size'];
  shape?: AvatarProps['shape'];
  className?: string;
  /** Max avatars in the fallback stack (default: 3, or 2 for 'xs') */
  max?: number;
}

/**
 * Renders a group avatar. If a custom avatar URL is provided, renders the
 * image via UserAvatar. Otherwise, presents a deterministic avatar stack
 * representing the group's members with automatic overflow (+N).
 */
export function GroupAvatar({
  name,
  avatarUrl,
  members = [],
  size = 'sm',
  shape = 'rounded',
  className,
  max,
}: GroupAvatarProps) {
  if (avatarUrl) {
    return (
      <UserAvatar
        name={name}
        src={avatarUrl}
        size={size}
        shape={shape}
        className={className}
        indicator={false}
      />
    );
  }

  const stackUsers: AvatarGroupUser[] = members.map((m) => ({
    id: m.userId,
    name: m.displayName || m.userId,
    displayName: m.displayName || m.userId,
    avatarUrl: m.avatarUrl,
  }));

  const effectiveMax = max ?? (size === 'xs' ? 2 : 3);

  if (stackUsers.length === 0) {
    return (
      <UserAvatar
        name={name}
        size={size}
        shape={shape}
        className={className}
        indicator={false}
      />
    );
  }

  return (
    <UserAvatarGroup
      users={stackUsers}
      max={effectiveMax}
      size={size}
      className={className}
    />
  );
}
