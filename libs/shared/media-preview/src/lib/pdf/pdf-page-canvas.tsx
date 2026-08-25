import { cn } from '@org/utils';
import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { pdfjsLib } from './pdf-worker.js';
import './pdf-text-layer.css';

export interface PdfPageCanvasProps {
  doc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  rotation: number;
  searchQuery?: string;
  className?: string;
}

/**
 * One page: a lazily-rendered `<canvas>` plus a pdf.js text layer for
 * selection/copy and search highlighting. Rendering (and the text layer) is
 * gated on the page actually being near the viewport, and released again —
 * canvas cleared, text layer emptied — once it scrolls well out of view, so
 * a long document never keeps hundreds of full-resolution canvases alive at
 * once.
 */
export function PdfPageCanvas({
  doc,
  pageNumber,
  scale,
  rotation,
  searchQuery,
  className,
}: PdfPageCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsNearViewport(entry.isIntersecting),
      { rootMargin: '600px 0px' },
    );
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isNearViewport) return;
    let cancelled = false;
    let renderTask: RenderTask | undefined;
    // Snapshotted once per effect run (not re-read in the cleanup below) —
    // by the time cleanup fires the refs may already point elsewhere.
    const canvas = canvasRef.current;
    const textLayerContainer = textLayerRef.current;

    (async () => {
      const page = await doc.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale, rotation });
      setSize({ width: viewport.width, height: viewport.height });

      const context = canvas?.getContext('2d');
      if (!canvas || !context) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      renderTask = page.render({ canvas, canvasContext: context, viewport });
      await renderTask.promise.catch(() => {
        // A page scrolled out mid-render cancels its own RenderTask (below)
        // — that rejection is expected and not a real error.
      });
      if (cancelled) return;

      if (textLayerContainer) {
        textLayerContainer.replaceChildren();
        const textContent = await page.getTextContent();
        if (cancelled) return;
        const textLayer = new pdfjsLib.TextLayer({
          textContentSource: textContent,
          container: textLayerContainer,
          viewport,
        });
        await textLayer.render();
      }
    })();

    return () => {
      cancelled = true;
      renderTask?.cancel();
      // Release the bitmap — a 100+ page document must not keep every page's
      // full-resolution canvas backing store alive at once.
      if (canvas) {
        canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
      }
      textLayerContainer?.replaceChildren();
    };
  }, [doc, pageNumber, scale, rotation, isNearViewport]);

  useEffect(() => {
    const container = textLayerRef.current;
    if (!container) return;
    const query = searchQuery?.trim().toLowerCase();
    for (const span of container.querySelectorAll('span')) {
      const matches = !!query && query.length > 0 && span.textContent?.toLowerCase().includes(query);
      span.classList.toggle('media-preview-pdf-match', !!matches);
    }
  }, [searchQuery, isNearViewport]);

  return (
    <div
      ref={wrapperRef}
      data-page-number={pageNumber}
      className={cn('relative mx-auto', className)}
      style={size ? { width: size.width, height: size.height } : { minHeight: 400 }}
    >
      {isNearViewport ? (
        <>
          <canvas ref={canvasRef} className="block shadow-sm" />
          <div
            ref={textLayerRef}
            className="pdf-text-layer pointer-events-none absolute inset-0 select-text [&_span]:pointer-events-auto"
          />
        </>
      ) : null}
    </div>
  );
}
