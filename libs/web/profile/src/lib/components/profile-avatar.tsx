import { UserAvatar, type PresenceInput } from '@org/ui';
import { Camera } from 'lucide-react';

export interface ProfileAvatarProps {
  name: string;
  avatarUrl?: string | null;
  seed?: string;
  /** Lowercase or the API's uppercase spelling — `UserAvatar` normalizes it. */
  presence?: PresenceInput | null;
  statusEmoji?: string | null;
  statusText?: string | null;
  editable?: boolean;
  onEditAvatar?: () => void;
  sizeClassName?: string;
}

/**
 * The large, editable avatar on the profile page. Sizing and the edit overlay
 * are its own; the status indicator is delegated to `UserAvatar` so it reads
 * exactly like the same person's avatar everywhere else.
 */
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
      <UserAvatar
        name={name}
        src={avatarUrl}
        seed={seed}
        size="xl"
        presence={presence}
        statusEmoji={statusEmoji}
        statusText={statusText}
        className={`${sizeClassName} rounded-full ring-4 ring-background shadow-2xl`}
      />

      {/* Hover Camera Action Overlay */}
      {editable && onEditAvatar && (
        <button
          type="button"
          onClick={onEditAvatar}
          aria-label="Change profile picture"
          className="absolute inset-0 rounded-full bg-black/60 backdrop-blur-2xs opacity-0 group-hover/avatar:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white cursor-pointer select-none"
        >
          <Camera className="size-6 text-white drop-shadow-md" />
          <span className="text-[10px] font-semibold tracking-wide uppercase">
            Edit
          </span>
        </button>
      )}
    </div>
  );
}
