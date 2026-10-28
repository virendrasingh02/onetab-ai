import { cn } from '@org/utils';
import { Blocks } from 'lucide-react';
import { useState } from 'react';

const SIZES = {
  sm: 'size-7 p-1.5',
  md: 'size-10 p-2',
} as const;

/**
 * A connected app's brand logo in the same bordered round tile the app chat
 * header uses — shared by system-event rows and app replies so an app looks
 * the same everywhere in the timeline. Falls back to the violet blocks glyph
 * when there's no logo or it fails to load.
 */
export function AppLogoAvatar({
  logoUrl,
  size = 'md',
  className,
}: {
  logoUrl?: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!logoUrl && !imageFailed;
  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border shadow-xs',
        SIZES[size],
        showImage
          ? 'border-border/80 bg-surface'
          : 'border-accent-violet/30 bg-accent-violet/10 text-accent-violet',
        className,
      )}
    >
      {showImage ? (
        <img
          src={logoUrl}
          alt=""
          className="size-full object-contain dark:brightness-110"
          loading="lazy"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <Blocks aria-hidden className="size-full" />
      )}
    </span>
  );
}
