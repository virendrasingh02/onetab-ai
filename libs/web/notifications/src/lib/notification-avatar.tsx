import type { NotificationView } from '@org/types';
import {
  UserAvatar,
  WorkspaceAvatar,
  type AvatarProps,
} from '@org/ui';

export interface NotificationAvatarProps {
  notification: Partial<NotificationView> & {
    id?: string;
    workspaceId?: string;
  };
  size?: AvatarProps['size'];
  shape?: AvatarProps['shape'];
  className?: string;
}

/**
 * Renders the avatar/icon for a notification.
 *
 * Dynamically resolves the workspace icon/avatar associated with the notification
 * (Notification → Workspace → Workspace Icon).
 * If the notification does not belong to a workspace, it gracefully falls back
 * to the actor/user avatar or system icon.
 */
export function NotificationAvatar({
  notification,
  size = 'sm',
  shape = 'rounded',
  className,
}: NotificationAvatarProps) {
  const ws = notification.workspace;
  const hasWorkspace = Boolean(
    ws || notification.workspaceId || notification.workspaceName,
  );

  if (hasWorkspace) {
    const name = ws?.name ?? notification.workspaceName ?? 'Workspace';
    const src = ws?.avatarUrl ?? undefined;
    const icon = ws?.icon ?? notification.workspaceIcon ?? undefined;
    const iconColor = ws?.iconColor ?? undefined;
    const seed = ws?.id ?? notification.workspaceId ?? notification.id ?? name;

    return (
      <WorkspaceAvatar
        name={name}
        src={src}
        icon={icon}
        iconColor={iconColor}
        seed={seed}
        size={size}
        shape={shape}
        className={className}
      />
    );
  }

  // Graceful fallback for notifications not associated with a workspace
  const actorName =
    notification.actor?.displayName ?? notification.actor?.name ?? 'System';
  const actorSrc = notification.actor?.avatarUrl ?? undefined;
  const actorSeed =
    notification.actor?.id ?? notification.id ?? actorName;

  return (
    <UserAvatar
      name={actorName}
      src={actorSrc}
      seed={actorSeed}
      size={size}
      className={className}
    />
  );
}
