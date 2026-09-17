import type { LinkPreview } from '@org/types';
import { Hint } from '@org/ui';
import { cn } from '@org/utils';
import { ExternalLink, Globe, X } from 'lucide-react';
import { useState } from 'react';

export interface LinkPreviewCardProps {
  preview: LinkPreview;
  /** Optional callback to remove or dismiss this preview (e.g. In the composer). */
  onRemove?: () => void;
  /** When true, renders a more compact variation for staging inside the composer. */
  compact?: boolean;
  className?: string;
}

export function LinkPreviewCard({
  preview,
  onRemove,
  compact = false,
  className,
}: LinkPreviewCardProps) {
  const [imageError, setImageError] = useState(false);
  const [faviconError, setFaviconError] = useState(false);

  const {
    url,
    title,
    description,
    image,
    favicon,
    domain,
    siteName,
  } = preview;

  const displayDomain = domain || siteName || 'external link';
  const showImage = !imageError && Boolean(image);
  const showFavicon = !faviconError && Boolean(favicon);

  return (
    <div
      data-slot="link-preview-card"
      className={cn(
        'group/preview relative flex overflow-hidden rounded-lg border border-border bg-surface-raised transition-colors',
        'border-l-4 border-l-primary/80 hover:bg-surface',
        compact ? 'max-w-xl p-2.5' : 'max-w-xl my-1.5 p-3',
        className,
      )}
    >
      <div className={cn('flex min-w-0 flex-1 flex-col gap-1', onRemove && 'pr-6')}>
        {/* Header: Favicon & Domain */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {showFavicon ? (
            <img
              src={favicon}
              alt=""
              aria-hidden="true"
              className="size-3.5 shrink-0 rounded-xs object-contain"
              onError={() => setFaviconError(true)}
            />
          ) : (
            <Globe className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}

          <span className="truncate font-medium text-foreground/80">
            {siteName || displayDomain}
          </span>

          <ExternalLink className="size-3 shrink-0 opacity-40 group-hover/preview:opacity-80" aria-hidden="true" />
        </div>

        {/* Title */}
        {title ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-semibold text-primary transition-colors hover:underline focus-visible:underline focus-visible:outline-hidden line-clamp-2"
          >
            {title}
          </a>
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-primary truncate hover:underline"
          >
            {url}
          </a>
        )}

        {/* Description */}
        {description ? (
          <p className={cn(
            'text-xs text-muted-foreground',
            compact ? 'line-clamp-2' : 'line-clamp-3',
          )}>
            {description}
          </p>
        ) : null}

        {/* Large inline image when not compact and wide */}
        {showImage && !compact ? (
          <div className="mt-2 max-w-md overflow-hidden rounded-md border border-border bg-muted">
            <img
              src={image}
              alt={title || displayDomain}
              loading="lazy"
              className="max-h-56 w-full object-cover transition-transform duration-200 group-hover/preview:scale-[1.01]"
              onError={() => setImageError(true)}
            />
          </div>
        ) : null}
      </div>

      {/* Thumbnail image on right in compact mode */}
      {showImage && compact ? (
        <div className="ml-3 size-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted">
          <img
            src={image}
            alt=""
            loading="lazy"
            className="size-full object-cover"
            onError={() => setImageError(true)}
          />
        </div>
      ) : null}

      {/* Remove/Dismiss button */}
      {onRemove ? (
        <div className="absolute right-1.5 top-1.5 z-10">
          <Hint label="Remove link preview">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              aria-label="Remove link preview"
              className="size-6 flex items-center justify-center rounded-md bg-surface/80 text-muted-foreground backdrop-blur-xs opacity-70 transition-all hover:bg-accent hover:text-foreground hover:opacity-100 focus-visible:opacity-100 shadow-xs cursor-pointer"
            >
              <X className="size-3.5" />
            </button>
          </Hint>
        </div>
      ) : null}
    </div>
  );
}
