import { ErrorState, LoadingState } from '@org/ui';
import { lazy, Suspense } from 'react';
import { canRenderPreview } from './get-media-type.js';
import type { MediaCategory, MediaItem } from './types.js';
import { AudioViewer } from './viewers/audio-viewer.js';
import { ImageViewer } from './viewers/image-viewer.js';
import { UnsupportedViewer } from './viewers/unsupported-viewer.js';
import { VideoViewer } from './viewers/video-viewer.js';

/**
 * `pdfjs-dist` and `prismjs` are each pulled in only by these two viewers —
 * loading them via `lazy()` means their entire module graphs (the PDF
 * worker wiring, every Prism grammar) land in their own chunk, fetched only
 * the first time a PDF or a text/code file is actually opened, never as part
 * of the app's main bundle.
 */
const PdfViewer = lazy(() =>
  import('./viewers/pdf-viewer.js').then((module) => ({ default: module.PdfViewer })),
);
const TextViewer = lazy(() =>
  import('./viewers/text-viewer.js').then((module) => ({ default: module.TextViewer })),
);

function loadingLabelFor(category: MediaCategory): string {
  switch (category) {
    case 'pdf':
      return 'Opening document…';
    case 'video':
      return 'Loading video…';
    case 'audio':
      return 'Loading audio…';
    case 'image':
      return 'Loading image…';
    default:
      return 'Loading…';
  }
}

export interface MediaPreviewContentProps {
  item: MediaItem;
  url?: string;
  isLoading: boolean;
  error?: string;
  onRetry: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onDownload: () => void;
}

/** Picks the viewer for `item.category` and owns the shared loading/error
 * states so every viewer below can assume it already has something to show. */
export function MediaPreviewContent({
  item,
  url,
  isLoading,
  error,
  onRetry,
  onNext,
  onPrevious,
  onDownload,
}: MediaPreviewContentProps) {
  if (error) {
    return (
      <ErrorState
        fullPage
        title="Preview unavailable"
        description={error}
        onRetry={onRetry}
        className="text-popover-foreground"
      />
    );
  }

  const hasInlineText = item.category === 'text' && item.inlineText !== undefined;

  if (!hasInlineText && canRenderPreview(item.category) && !url) {
    return (
      <LoadingState
        fullPage
        label={loadingLabelFor(item.category)}
        className="text-popover-foreground"
      />
    );
  }

  const shared = { onNext, onPrevious, onDownload };

  // Keyed by item.id: navigating to a different attachment of the same
  // category (image -> image, say) should remount the viewer rather than
  // reuse it, so zoom/rotation/scroll state never leaks from one file to
  // the next. `key` has to be a literal JSX attribute, not part of a spread
  // object, or React never sees it as the special reconciliation key.
  switch (item.category) {
    case 'image':
      return <ImageViewer key={item.id} item={item} url={url as string} {...shared} />;
    case 'video':
      return <VideoViewer key={item.id} item={item} url={url as string} {...shared} />;
    case 'audio':
      return <AudioViewer key={item.id} item={item} url={url as string} {...shared} />;
    case 'pdf':
      return (
        <Suspense
          key={item.id}
          fallback={<LoadingState fullPage label="Opening document…" className="text-popover-foreground" />}
        >
          <PdfViewer item={item} url={url as string} {...shared} />
        </Suspense>
      );
    case 'text':
      return (
        <Suspense
          key={item.id}
          fallback={<LoadingState fullPage label="Loading file…" className="text-popover-foreground" />}
        >
          <TextViewer item={item} url={url} {...shared} />
        </Suspense>
      );
    default:
      return (
        <UnsupportedViewer
          key={item.id}
          item={item}
          isLoading={isLoading}
          onDownload={onDownload}
        />
      );
  }
}
