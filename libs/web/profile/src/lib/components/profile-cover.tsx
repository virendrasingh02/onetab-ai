import { resolveMediaUrl } from '@org/api-client';
import { Button, UserCover } from '@org/ui';
import { Camera, Trash2 } from 'lucide-react';

export interface ProfileCoverProps {
  coverUrl?: string | null;
  name: string;
  /** The person's avatar seed (user id) — the no-cover gradient matches it. */
  seed?: string;
  onChangeCover?: () => void;
  onRemoveCover?: () => void;
  editable?: boolean;
  className?: string;
}

export function ProfileCover({
  coverUrl,
  name,
  seed,
  onChangeCover,
  onRemoveCover,
  editable = true,
  className = '',
}: ProfileCoverProps) {
  return (
    <UserCover
      src={resolveMediaUrl(coverUrl)}
      seed={seed?.trim() ? seed : name}
      className={`group/cover h-44 sm:h-56 md:h-64 rounded-2xl overflow-hidden border border-border/80 shadow-xs select-none ${className}`}
    >
      {/* Subtle overlay shading for contrast */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent pointer-events-none" />

      {/* Action Controls for Cover */}
      {editable && (
        <div className="absolute top-3 right-3 flex items-center gap-2 opacity-90 sm:opacity-0 sm:group-hover/cover:opacity-100 transition-opacity duration-150">
          {onChangeCover && (
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={onChangeCover}
              className="bg-black/60 hover:bg-black/80 text-white backdrop-blur-md border border-white/20 text-xs gap-1.5 shadow-md"
            >
              <Camera className="size-3.5" />
              <span>Change Cover</span>
            </Button>
          )}

          {coverUrl && onRemoveCover && (
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={onRemoveCover}
              className="bg-black/60 hover:bg-destructive/80 text-white backdrop-blur-md border border-white/20 text-xs px-2 shadow-md"
              title="Remove Cover"
            >
              <Trash2 className="size-3.5 text-destructive-foreground" />
            </Button>
          )}
        </div>
      )}

    </UserCover>
  );
}
