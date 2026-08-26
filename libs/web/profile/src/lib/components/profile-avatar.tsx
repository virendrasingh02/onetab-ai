import { UserAvatar, type PresenceStatus } from '@org/ui';
import { Camera } from 'lucide-react';

export interface ProfileAvatarProps {
  name: string;
  avatarUrl?: string | null;
  seed?: string;
  presence?: PresenceStatus;
  statusEmoji?: string | null;
  statusText?: string | null;
  editable?: boolean;
  onEditAvatar?: () => void;
  sizeClassName?: string;
}

export function ProfileAvatar({
  name,
  avatarUrl,
  seed,
  presence = 'online',
  statusEmoji,
  statusText,
  editable = true,
  onEditAvatar,
  sizeClassName = 'size-28 sm:size-32',
}: ProfileAvatarProps) {
  return (
    <div className="relative group/avatar inline-block shrink-0">
      {/* Base Radix Avatar */}
      <div className="relative rounded-full ring-4 ring-background shadow-2xl overflow-hidden bg-surface">
        <UserAvatar
          name={name}
          src={avatarUrl}
          seed={seed}
          size="xl"
          className={`${sizeClassName} rounded-full`}
        />

        {/* Hover Camera Action Overlay */}
        {editable && onEditAvatar && (
          <button
            type="button"
            onClick={onEditAvatar}
            aria-label="Change profile picture"
            className="absolute inset-0 bg-black/60 backdrop-blur-2xs opacity-0 group-hover/avatar:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white cursor-pointer select-none"
          >
            <Camera className="size-6 text-white drop-shadow-md" />
            <span className="text-[10px] font-semibold tracking-wide uppercase">Edit</span>
          </button>
        )}
      </div>

      {/* Online / Presence Badge */}
      <span
        role="status"
        title={`Presence: ${presence}`}
        className={`absolute bottom-2 right-2 size-5 rounded-full border-3 border-background shadow-sm ${
          presence === 'online'
            ? 'bg-success'
            : presence === 'away'
              ? 'bg-warning'
              : presence === 'busy'
                ? 'bg-destructive'
                : 'bg-muted-foreground'
        }`}
      />

      {/* Status Emoji Badge */}
      {statusEmoji && (
        <span
          title={statusText || 'Status set'}
          className="absolute -top-1 -right-1 size-7 bg-surface border border-border shadow-md rounded-full flex items-center justify-center text-sm select-none"
        >
          {statusEmoji}
        </span>
      )}
    </div>
  );
}
