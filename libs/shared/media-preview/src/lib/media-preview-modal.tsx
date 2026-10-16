import { useAuthenticatedMediaSrc } from '@org/hooks';
import { Dialog, DialogOverlay, DialogPortal, toast } from '@org/ui';
import { cn } from '@org/utils';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
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

/** How long the pointer can sit still over the media before the header
 * fades back out. */
const CHROME_IDLE_MS = 2200;

/**
 * The toolbar floats over the media and auto-hides the way a photo viewer's
 * chrome does: it slides in when the pointer moves over the viewer, fades out
 * after a short idle (or when the pointer leaves), and stays put while the
 * pointer rests on it, its "More" menu is open, or a control in it has
 * keyboard focus. `:focus-visible` rather than `focus-within`, so a mouse
 * click on Download doesn't pin the header open indefinitely. Opacity — not
 * `display` — so the buttons stay keyboard-reachable while faded out.
 */
const TOOLBAR_REVEAL = cn(
  'absolute inset-x-0 top-0 z-20 transition duration-200 ease-standard',
  'pointer-events-none -translate-y-1 opacity-0',
  'group-data-[chrome=visible]/preview:pointer-events-auto group-data-[chrome=visible]/preview:translate-y-0 group-data-[chrome=visible]/preview:opacity-100',
  'hover:pointer-events-auto hover:translate-y-0 hover:opacity-100',
  'has-focus-visible:pointer-events-auto has-focus-visible:translate-y-0 has-focus-visible:opacity-100',
  'has-data-[state=open]:pointer-events-auto has-data-[state=open]:translate-y-0 has-data-[state=open]:opacity-100',
);

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
  const toolbarRef = useRef<HTMLDivElement>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [chromeVisible, setChromeVisible] = useState(false);

  const clearIdleTimer = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = null;
  }, []);

  // Any pointer movement reveals the header; it hides again after an idle
  // spell — unless the pointer is resting on the header itself.
  const revealChrome = useCallback(
    (event: React.PointerEvent) => {
      setChromeVisible(true);
      clearIdleTimer();
      if (toolbarRef.current?.contains(event.target as Node)) return;
      idleTimer.current = setTimeout(() => setChromeVisible(false), CHROME_IDLE_MS);
    },
    [clearIdleTimer],
  );

  const hideChrome = useCallback(() => {
    clearIdleTimer();
    setChromeVisible(false);
  }, [clearIdleTimer]);

  useEffect(() => clearIdleTimer, [clearIdleTimer]);
  useEffect(() => {
    if (!isOpen) hideChrome();
  }, [isOpen, hideChrome]);

  // A Matrix attachment's resolved URL points at its authenticated media
  // repo — the same problem `@org/ui`'s `AvatarImage` works around — so
  // every viewer below gets one already-fetchable URL instead of one each
  // rolling its own handling.
  const previewUrl = useAuthenticatedMediaSrc(
    activeItem?.url ?? (activeItem ? resolvedUrls[activeItem.id] : undefined),
  );

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
              // Floats over the dimmed app with a gutter that grows with the
              // viewport (tight on phones, generous on desktop) so it reads as
              // a lightbox above the workspace rather than a full-bleed
              // takeover. Fullscreen drops the gutter and frame entirely.
              'group/preview fixed inset-2 z-50 flex flex-col overflow-hidden rounded-2xl border shadow-2xl outline-none',
              // A light theme border reads as a white halo around the
              // near-black media canvas, so dark canvases get a dark frame
              // (matching the canvas fill) instead.
              usesDarkCanvas(activeItem.category)
                ? 'border-neutral-950 bg-neutral-950'
                : 'border-border/60 bg-popover',
              'sm:inset-6 lg:inset-x-16 lg:inset-y-10 xl:inset-x-24 xl:inset-y-12',
              '[&:fullscreen]:inset-0 [&:fullscreen]:rounded-none [&:fullscreen]:border-0',
              'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-98',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-98',
              'duration-(--duration-base) ease-standard',
            )}
            aria-label={`${activeItem.name} preview`}
            data-chrome={chromeVisible ? 'visible' : 'hidden'}
            onPointerMove={revealChrome}
            onPointerDown={revealChrome}
            onPointerLeave={hideChrome}
          >
            <DialogPrimitive.Title className="sr-only">
              {activeItem.name}
            </DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Media preview. Press Escape to close, and Left or Right arrow
              keys to move between attachments.
            </DialogPrimitive.Description>

            <MediaPreviewToolbar
              ref={toolbarRef}
              item={activeItem}
              index={activeIndex}
              count={items.length}
              resolvedUrl={resolvedUrls[activeItem.id]}
              isResolving={resolvingIds[activeItem.id]}
              onDownload={handleDownload}
              onClose={close}
              className={cn(
                TOOLBAR_REVEAL,
                // Over the near-black media canvas the frosted header uses the
                // dark token set regardless of app theme, so it stays legible.
                usesDarkCanvas(activeItem.category) && 'dark',
              )}
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
                url={previewUrl ?? undefined}
                isLoading={!!resolvingIds[activeItem.id]}
                error={errors[activeItem.id]}
                onRetry={() => resolve(activeItem)}
                onNext={next}
                onPrevious={previous}
                onDownload={handleDownload}
                onClose={close}
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
