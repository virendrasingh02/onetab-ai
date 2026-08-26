import { Button } from '@org/ui';
import { Camera, Image as ImageIcon, Trash2 } from 'lucide-react';

export interface ProfileCoverProps {
  coverUrl?: string | null;
  name: string;
  seed?: string;
  onChangeCover?: () => void;
  onRemoveCover?: () => void;
  editable?: boolean;
  className?: string;
}

export function ProfileCover({
  coverUrl,
  name: _name,
  seed: _seed,
  onChangeCover,
  onRemoveCover,
  editable = true,
  className = '',
}: ProfileCoverProps) {
  // Deterministic gradient fallback if no cover image
  const defaultGradient = 'linear-gradient(135deg, #1e293b 0%, #0f172a 50%, #022c22 100%)';

  return (
    <div
      className={`group/cover relative w-full h-44 sm:h-56 md:h-64 rounded-2xl overflow-hidden border border-border/80 shadow-xs select-none ${className}`}
      style={{
        backgroundImage: coverUrl ? `url(${coverUrl})` : defaultGradient,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Subtle overlay shading for contrast */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

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

      {/* Default banner aesthetic indicator if no image */}
      {!coverUrl && (
        <div className="absolute bottom-3 right-3 hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 backdrop-blur-xs text-[11px] font-medium text-white/70">
          <ImageIcon className="size-3.5 text-primary" />
          <span>Profile Banner</span>
        </div>
      )}
    </div>
  );
}
