import { cn } from '@org/utils';
import {
  File as FileIcon,
  FileArchive,
  FileCode,
  FileText,
  Film,
  Image as ImageIcon,
  Music,
} from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import type { MediaCategory, MediaItem } from './types.js';
import { useMediaPreview } from './use-media-preview.js';

const CATEGORY_ICONS: Record<MediaCategory, typeof FileIcon> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  pdf: FileText,
  text: FileCode,
  office: FileText,
  archive: FileArchive,
  unknown: FileIcon,
};

export interface MediaThumbnailProps {
  item: MediaItem;
  className?: string;
  iconClassName?: string;
}

/** A small, generic attachment card — an image gets its thumbnail/URL,
 * everything else gets a category icon. Used as the default visual for
 * `MediaPreviewTrigger`, and standalone anywhere a plain preview affordance
 * is enough (e.g. a file-manager grid). */
export function MediaThumbnail({ item, className, iconClassName }: MediaThumbnailProps) {
  const Icon = CATEGORY_ICONS[item.category];
  const imageSrc = item.category === 'image' ? (item.thumbnailUrl ?? item.url) : undefined;

  if (imageSrc) {
    return (
      <img
        src={imageSrc}
        alt={item.name}
        loading="lazy"
        decoding="async"
        className={cn('size-full object-cover', className)}
      />
    );
  }

  return (
    <span
      className={cn(
        'flex items-center justify-center rounded-md bg-muted text-muted-foreground',
        className,
      )}
    >
      <Icon className={cn('size-4', iconClassName)} />
    </span>
  );
}

export interface MediaPreviewTriggerProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  item: MediaItem;
  /** The full gallery this item belongs to, for in-modal Previous/Next.
   * Defaults to a single-item gallery of just `item`. */
  items?: MediaItem[];
  /** Explicit start index, when the caller already knows it (avoids an
   * `indexOf` scan against a list that may contain duplicate ids). */
  index?: number;
  children: ReactNode;
}

/** Wraps any clickable content (a thumbnail, a file row, an inline image) and
 * opens the shared preview to this item on click. */
export function MediaPreviewTrigger({
  item,
  items,
  index,
  className,
  children,
  ...props
}: MediaPreviewTriggerProps) {
  const { openPreview } = useMediaPreview();
  const gallery = items ?? [item];
  const startIndex = index ?? Math.max(gallery.indexOf(item), 0);

  return (
    <button
      type="button"
      onClick={() => openPreview(gallery, startIndex)}
      className={cn(
        'text-left focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none',
        className,
      )}
      aria-label={`Open ${item.name}`}
      {...props}
    >
      {children}
    </button>
  );
}
