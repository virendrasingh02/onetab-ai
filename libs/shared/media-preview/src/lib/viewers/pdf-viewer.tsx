import { Button, ErrorState, Input, LoadingState } from '@org/ui';
import { Lock } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PdfPageCanvas } from '../pdf/pdf-page-canvas.js';
import { PdfSearchPanel } from '../pdf/pdf-search-panel.js';
import { PdfThumbnailSidebar } from '../pdf/pdf-thumbnail-sidebar.js';
import { PdfToolbar } from '../pdf/pdf-toolbar.js';
import { usePdfDocument } from '../pdf/use-pdf-document.js';
import type { MediaItem } from '../types.js';
import { useMediaPreviewKeys } from '../use-media-preview-keys.js';

const ZOOM_STEP = 25;
const MIN_ZOOM = 25;
const MAX_ZOOM = 400;

/**
 * Sidebar collapsed/expanded is remembered only for "the current preview
 * session" per spec — a module-level variable (like `scroll-position-store`)
 * is enough; it is not meant to survive a reload.
 */
let rememberedSidebarOpen = true;

function PdfPasswordForm({
  error,
  onSubmit,
}: {
  error?: string;
  onSubmit: (password: string) => void;
}) {
  const [value, setValue] = useState('');

  return (
    <form
      className="gap-3 h-full flex flex-col items-center justify-center p-8 text-center text-white"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value);
      }}
    >
      <span className="size-14 flex items-center justify-center rounded-2xl bg-white/10">
        <Lock className="size-6" />
      </span>
      <p className="text-sm font-medium">This PDF is password protected</p>
      <Input
        type="password"
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Enter password"
        aria-label="PDF password"
        className="max-w-56 border-white/15 bg-white/5 text-center text-white"
      />
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      <Button type="submit" size="sm">
        Unlock
      </Button>
    </form>
  );
}

function print(url: string) {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.src = url;
  iframe.onload = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      window.open(url, '_blank', 'noopener');
    }
    setTimeout(() => iframe.remove(), 60_000);
  };
  document.body.appendChild(iframe);
}

export interface PdfViewerProps {
  item: MediaItem;
  url: string;
  onDownload: () => void;
}

export function PdfViewer({ item, url, onDownload }: PdfViewerProps) {
  const { doc, numPages, status, error, submitPassword } = usePdfDocument(url);
  const [page, setPage] = useState(1);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [isFitWidth, setIsFitWidth] = useState(true);
  const [rotation, setRotation] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(rememberedSidebarOpen);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [naturalWidth, setNaturalWidth] = useState<number | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    rememberedSidebarOpen = sidebarOpen;
  }, [sidebarOpen]);

  useEffect(() => {
    setPage(1);
    setZoomPercent(100);
    setIsFitWidth(true);
    setRotation(0);
    setSearchOpen(false);
    setSearchQuery('');
  }, [url]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!doc) return;
    let cancelled = false;
    void doc.getPage(page).then((pageProxy) => {
      if (cancelled) return;
      setNaturalWidth(pageProxy.getViewport({ scale: 1 }).width);
    });
    return () => {
      cancelled = true;
    };
  }, [doc, page]);

  const effectiveScale = useMemo(() => {
    if (isFitWidth && naturalWidth && containerWidth) {
      return Math.max(containerWidth / naturalWidth, 0.1);
    }
    return zoomPercent / 100;
  }, [isFitWidth, naturalWidth, containerWidth, zoomPercent]);

  const displayedZoomPercent = Math.round(effectiveScale * 100);

  const zoomIn = () => {
    setIsFitWidth(false);
    setZoomPercent((current) => Math.min(current + ZOOM_STEP, MAX_ZOOM));
  };
  const zoomOut = () => {
    setIsFitWidth(false);
    setZoomPercent((current) => Math.max(current - ZOOM_STEP, MIN_ZOOM));
  };
  const zoomReset = () => setIsFitWidth(true);
  const rotate = () => setRotation((current) => (current + 90) % 360);

  useMediaPreviewKeys(true, {
    onZoomIn: zoomIn,
    onZoomOut: zoomOut,
    onZoomReset: zoomReset,
    onRotate: rotate,
  });

  const goToPage = (next: number) => setPage(Math.min(Math.max(next, 1), Math.max(numPages, 1)));

  if (status === 'password') {
    return <PdfPasswordForm error={error} onSubmit={submitPassword} />;
  }

  if (status === 'error') {
    return (
      <ErrorState
        fullPage
        title="Unable to preview this PDF"
        description={error ?? 'The file may be corrupted or unavailable.'}
        action={<Button onClick={onDownload}>Download</Button>}
        className="text-white"
      />
    );
  }

  if (status === 'loading' || !doc) {
    return <LoadingState fullPage label="Opening document…" className="text-white" />;
  }

  return (
    <div className="flex size-full flex-col">
      <div className="min-h-0 flex flex-1">
        {sidebarOpen ? (
          <div className="hidden w-36 shrink-0 sm:block">
            <PdfThumbnailSidebar doc={doc} numPages={numPages} currentPage={page} onSelectPage={goToPage} />
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          {searchOpen ? (
            <PdfSearchPanel
              doc={doc}
              numPages={numPages}
              onQueryChange={setSearchQuery}
              onNavigateToPage={goToPage}
              onClose={() => {
                setSearchOpen(false);
                setSearchQuery('');
              }}
            />
          ) : null}

          <div
            ref={viewportRef}
            role="document"
            aria-label={item.name}
            className="min-h-0 flex flex-1 items-start justify-center overflow-auto p-4"
          >
            <PdfPageCanvas doc={doc} pageNumber={page} scale={effectiveScale} rotation={rotation} searchQuery={searchQuery} />
          </div>
        </div>
      </div>

      <PdfToolbar
        page={page}
        numPages={numPages}
        onPageChange={goToPage}
        zoomPercent={displayedZoomPercent}
        isFitWidth={isFitWidth}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onFitWidth={zoomReset}
        onRotate={rotate}
        onPrint={() => print(url)}
        onToggleSearch={() => setSearchOpen((value) => !value)}
        onToggleSidebar={() => setSidebarOpen((value) => !value)}
        sidebarOpen={sidebarOpen}
        onToggleFullscreen={() => {
          if (document.fullscreenElement) void document.exitFullscreen();
          else void document.documentElement.requestFullscreen();
        }}
      />
    </div>
  );
}
