import { Dialog, DialogOverlay, DialogPortal, toast } from '@org/ui';
import { cn } from '@org/utils';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';
import { MediaPreviewContent } from './media-preview-content.js';
import { useMediaPreviewStore } from './media-preview-store.js';
import { MediaPreviewToolbar } from './media-preview-toolbar.js';
import { downloadMediaItem } from './download-media-item.js';
import { useMediaPreviewKeys } from './use-media-preview-keys.js';

/** Categories rendered on a near-black canvas for contrast, the way a photo
 * viewer or document reader does — everything else (text, unsupported)
 * keeps the app's normal surface so it reads as a document, not a lightbox. */
function usesDarkCanvas(category: string): boolean {
  return category === 'image' || category === 'video' || category === 'pdf';
}

export function MediaPreviewModal() {
  const items = useMediaPreviewStore((state) => state.items);
  const activeIndex = useMediaPreviewStore((state) => state.activeIndex);
  const isOpen = useMediaPreviewStore((state) => state.isOpen);
  const close = useMediaPreviewStore((state) => state.close);
  const next = useMediaPreviewStore((state) => state.next);
  const previous = useMediaPreviewStore((state) => state.previous);
  const resolve = useMediaPreviewStore((state) => state.resolve);
  const resolvedUrls = useMediaPreviewStore((state) => state.resolvedUrls);
  const resolvingIds = useMediaPreviewStore((state) => state.resolvingIds);
  const errors = useMediaPreviewStore((state) => state.errors);

  const activeItem = items[activeIndex];
  const contentRef = useRef<HTMLDivElement>(null);

  // Kick off resolution for whatever the active item needs, as soon as it
  // becomes active — but never for a category that only ever shows a
  // download fallback (no reason to fetch an entire archive just to render
  // "this can't be previewed here").
  useEffect(() => {
    if (!isOpen || !activeItem) return;
    if (activeItem.category === 'text' && activeItem.inlineText !== undefined) return;
    if (!activeItem.url && activeItem.resolveUrl) {
      void resolve(activeItem);
    }
  }, [isOpen, activeItem, resolve]);

  const handleDownload = useCallback(async () => {
    if (!activeItem) return;
    let url: string | undefined = activeItem.downloadUrl ?? activeItem.url ?? resolvedUrls[activeItem.id];
    if (!url) url = await resolve(activeItem);
    if (!url) {
      toast.error('Unable to download this file');
      return;
    }
    try {
      await downloadMediaItem(url, activeItem.name);
    } catch {
      toast.error('Download failed');
    }
  }, [activeItem, resolve, resolvedUrls]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void contentRef.current?.requestFullscreen();
    }
  }, []);

  useMediaPreviewKeys(isOpen, {
    onPrevious: previous,
    onNext: next,
    onDownload: handleDownload,
    onFullscreen: toggleFullscreen,
  });

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      {activeItem ? (
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content
            ref={contentRef}
            tabIndex={-1}
            onOpenAutoFocus={(event) => {
              // Radix's default is "focus the first focusable descendant" —
              // here that's the toolbar's Download button, and focusing a
              // `<Hint>`-wrapped control opens its tooltip immediately,
              // which then swallows the very next Escape key (closing the
              // tooltip instead of the dialog) rather than letting it reach
              // the dialog's own dismiss handling. Focusing the content pane
              // itself avoids that, and is the usual pattern for a
              // full-screen viewer anyway.
              event.preventDefault();
              contentRef.current?.focus();
            }}
            className={cn(
              'fixed inset-0 z-50 flex flex-col outline-none',
              'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-98',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-98',
              'duration-(--duration-base) ease-standard',
            )}
            aria-label={`${activeItem.name} preview`}
          >
            <DialogPrimitive.Title className="sr-only">
              {activeItem.name}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Media preview. Press Escape to close, and Left or Right arrow
              keys to move between attachments.
            </DialogPrimitive.Description>

            <MediaPreviewToolbar
              item={activeItem}
              index={activeIndex}
              count={items.length}
              resolvedUrl={resolvedUrls[activeItem.id]}
              isResolving={resolvingIds[activeItem.id]}
              onDownload={handleDownload}
              onClose={close}
            />

            <div
              className={cn(
                'relative min-h-0 flex-1 overflow-hidden',
                usesDarkCanvas(activeItem.category)
                  ? 'bg-neutral-950'
                  : 'bg-popover',
              )}
            >
              {items.length > 1 ? (
                <button
                  type="button"
                  onClick={previous}
                  aria-label="Previous attachment"
                  className="left-2 top-1/2 z-10 absolute flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
                >
                  <ChevronLeft className="size-5" />
                </button>
              ) : null}

              <MediaPreviewContent
                item={activeItem}
                url={activeItem.url ?? resolvedUrls[activeItem.id]}
                isLoading={!!resolvingIds[activeItem.id]}
                error={errors[activeItem.id]}
                onRetry={() => resolve(activeItem)}
                onNext={next}
                onPrevious={previous}
                onDownload={handleDownload}
              />

              {items.length > 1 ? (
                <button
                  type="button"
                  onClick={next}
                  aria-label="Next attachment"
                  className="right-2 top-1/2 z-10 absolute flex size-9 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white transition-colors hover:bg-black/60 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:outline-none"
                >
                  <ChevronRight className="size-5" />
                </button>
              ) : null}
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      ) : null}
    </Dialog>
  );
}
