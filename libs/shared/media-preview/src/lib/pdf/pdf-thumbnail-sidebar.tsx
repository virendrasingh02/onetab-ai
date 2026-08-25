import { cn } from '@org/utils';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
// Not called directly here — imported for its module side effect (wiring
// pdf.js's worker) so a thumbnail can render even if this component somehow
// mounts before `use-pdf-document.ts` has, though in practice `pdf-viewer.tsx`
// already imports that first.
import './pdf-worker.js';

const THUMBNAIL_SCALE = 0.2;
const ROW_HEIGHT_ESTIMATE = 160;

function PdfThumbnail({
  doc,
  pageNumber,
  isActive,
  onClick,
}: {
  doc: PDFDocumentProxy;
  pageNumber: number;
  isActive: boolean;
  onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | undefined;

    (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale: THUMBNAIL_SCALE });
      const canvas = canvasRef.current;
      const context = canvas?.getContext('2d');
      if (!canvas || !context) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      renderTask = page.render({ canvas, canvasContext: context, viewport });
      await renderTask.promise.catch(() => undefined);
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
    // A virtualized row only exists while it's the current/near-viewport
    // page, so mount/unmount here already is the "lazy + released" story —
    // no separate IntersectionObserver needed on top of the virtualizer's
    // own windowing.
  }, [doc, pageNumber]);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Go to page ${pageNumber}`}
      aria-current={isActive}
      className={cn(
        'group flex w-full flex-col items-center gap-1 rounded-md p-2 outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring/50',
        isActive ? 'bg-primary/10' : 'hover:bg-white/5',
      )}
    >
      <canvas
        ref={canvasRef}
        className={cn(
          'rounded-sm border shadow-sm',
          isActive ? 'border-primary' : 'border-white/10 group-hover:border-white/20',
        )}
      />
      <span className={cn('text-[11px]', isActive ? 'text-white' : 'text-white/60')}>
        {pageNumber}
      </span>
    </button>
  );
}

export interface PdfThumbnailSidebarProps {
  doc: PDFDocumentProxy;
  numPages: number;
  currentPage: number;
  onSelectPage: (page: number) => void;
}

export function PdfThumbnailSidebar({
  doc,
  numPages,
  currentPage,
  onSelectPage,
}: PdfThumbnailSidebarProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [hasScrolledToInitial, setHasScrolledToInitial] = useState(false);

  const virtualizer = useVirtualizer({
    count: numPages,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT_ESTIMATE,
    overscan: 4,
  });

  useEffect(() => {
    // Keep the active thumbnail in view as the current page changes —
    // `align: 'auto'` only scrolls when it isn't already visible.
    virtualizer.scrollToIndex(currentPage - 1, { align: hasScrolledToInitial ? 'auto' : 'center' });
    setHasScrolledToInitial(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage]);

  return (
    <div
      ref={parentRef}
      className="h-full overflow-y-auto border-r border-white/10 bg-black/40 p-2"
      aria-label="Page thumbnails"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: virtualRow.size,
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <PdfThumbnail
              doc={doc}
              pageNumber={virtualRow.index + 1}
              isActive={virtualRow.index + 1 === currentPage}
              onClick={() => onSelectPage(virtualRow.index + 1)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
