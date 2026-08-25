import { Hint, IconButton, Input } from '@org/ui';
import { cn } from '@org/utils';
import {
  Maximize,
  Minus,
  PanelLeft,
  Plus,
  Printer,
  RotateCw,
  Search,
  StretchHorizontal,
} from 'lucide-react';
import { useEffect, useState } from 'react';

export interface PdfToolbarProps {
  page: number;
  numPages: number;
  onPageChange: (page: number) => void;
  zoomPercent: number;
  isFitWidth: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitWidth: () => void;
  onRotate: () => void;
  onPrint: () => void;
  onToggleSearch: () => void;
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  onToggleFullscreen: () => void;
}

export function PdfToolbar({
  page,
  numPages,
  onPageChange,
  zoomPercent,
  isFitWidth,
  onZoomIn,
  onZoomOut,
  onFitWidth,
  onRotate,
  onPrint,
  onToggleSearch,
  onToggleSidebar,
  sidebarOpen,
  onToggleFullscreen,
}: PdfToolbarProps) {
  const [pageInput, setPageInput] = useState(String(page));

  // `page` also changes from outside this input — a thumbnail click, a
  // search-result jump, Previous/Next — so the field has to track it rather
  // than only updating itself in response to the user's own typing.
  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const commitPageInput = () => {
    const parsed = Number.parseInt(pageInput, 10);
    if (Number.isFinite(parsed)) {
      onPageChange(Math.min(Math.max(parsed, 1), numPages));
    } else {
      setPageInput(String(page));
    }
  };

  return (
    <div className="gap-1 px-2 sm:px-3 py-2 flex flex-wrap shrink-0 items-center justify-center border-t border-white/10 bg-black/30 text-white">
      <Hint label={sidebarOpen ? 'Hide thumbnails' : 'Show thumbnails'}>
        <IconButton
          variant="ghost"
          size="icon-sm"
          aria-label={sidebarOpen ? 'Hide thumbnails' : 'Show thumbnails'}
          aria-pressed={sidebarOpen}
          onClick={onToggleSidebar}
          className="text-white hover:bg-white/10 hover:text-white"
        >
          <PanelLeft />
        </IconButton>
      </Hint>

      <div className="gap-1 flex items-center">
        <Input
          value={pageInput}
          onChange={(event) => setPageInput(event.target.value.replace(/[^0-9]/g, ''))}
          onBlur={commitPageInput}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commitPageInput();
            }
          }}
          onFocus={() => setPageInput(String(page))}
          aria-label="Page number"
          className="h-7 w-12 border-white/15 bg-white/5 px-1 text-center text-white"
        />
        <span className="text-xs text-white/60 tabular-nums">/ {numPages}</span>
      </div>

      <span className="mx-1 h-4 w-px bg-white/15" aria-hidden />

      <Hint label="Search" shortcut="Ctrl+F">
        <IconButton variant="ghost" size="icon-sm" aria-label="Search in document" onClick={onToggleSearch} className="text-white hover:bg-white/10 hover:text-white">
          <Search />
        </IconButton>
      </Hint>

      <span className="mx-1 h-4 w-px bg-white/15" aria-hidden />

      <Hint label="Zoom out" shortcut="-">
        <IconButton variant="ghost" size="icon-sm" aria-label="Zoom out" onClick={onZoomOut} className="text-white hover:bg-white/10 hover:text-white">
          <Minus />
        </IconButton>
      </Hint>
      <span className="w-12 text-center text-xs tabular-nums text-white/80">{zoomPercent}%</span>
      <Hint label="Zoom in" shortcut="+">
        <IconButton variant="ghost" size="icon-sm" aria-label="Zoom in" onClick={onZoomIn} className="text-white hover:bg-white/10 hover:text-white">
          <Plus />
        </IconButton>
      </Hint>
      <Hint label="Fit width">
        <IconButton
          variant="ghost"
          size="icon-sm"
          aria-label="Fit width"
          aria-pressed={isFitWidth}
          onClick={onFitWidth}
          className={cn('text-white hover:bg-white/10 hover:text-white', isFitWidth && 'bg-white/10')}
        >
          <StretchHorizontal />
        </IconButton>
      </Hint>
      <Hint label="Rotate" shortcut="R">
        <IconButton variant="ghost" size="icon-sm" aria-label="Rotate" onClick={onRotate} className="text-white hover:bg-white/10 hover:text-white">
          <RotateCw />
        </IconButton>
      </Hint>

      <span className="mx-1 h-4 w-px bg-white/15" aria-hidden />

      <Hint label="Print">
        <IconButton variant="ghost" size="icon-sm" aria-label="Print" onClick={onPrint} className="text-white hover:bg-white/10 hover:text-white">
          <Printer />
        </IconButton>
      </Hint>
      <Hint label="Fullscreen" shortcut="F">
        <IconButton variant="ghost" size="icon-sm" aria-label="Fullscreen" onClick={onToggleFullscreen} className="text-white hover:bg-white/10 hover:text-white">
          <Maximize />
        </IconButton>
      </Hint>
    </div>
  );
}
