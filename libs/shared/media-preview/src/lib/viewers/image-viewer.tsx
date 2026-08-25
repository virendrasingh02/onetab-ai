import { Hint, IconButton } from '@org/ui';
import { cn } from '@org/utils';
import {
  Maximize2,
  Minus,
  Plus,
  RotateCw,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MediaItem } from '../types.js';
import { useMediaPreviewKeys } from '../use-media-preview-keys.js';

const ZOOM_STEP = 25;
const MIN_ZOOM = 25;
const MAX_ZOOM = 400;

export interface ImageViewerProps {
  item: MediaItem;
  url: string;
  onNext: () => void;
  onPrevious: () => void;
  onDownload: () => void;
}

/** `null` zoom means "fit to the viewport" — the natural default. Any other
 * value is an explicit percentage of the image's natural size. */
export function ImageViewer({ item, url, onNext, onPrevious }: ImageViewerProps) {
  const [zoom, setZoom] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const dragState = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setZoom(null);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  }, [url]);

  const zoomIn = useCallback(() => {
    setZoom((current) => Math.min((current ?? 100) + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((current) => Math.max((current ?? 100) - ZOOM_STEP, MIN_ZOOM));
  }, []);

  const zoomReset = useCallback(() => {
    setZoom(null);
    setPan({ x: 0, y: 0 });
  }, []);

  const rotate = useCallback(() => {
    setRotation((current) => (current + 90) % 360);
  }, []);

  useMediaPreviewKeys(true, {
    onZoomIn: zoomIn,
    onZoomOut: zoomOut,
    onZoomReset: zoomReset,
    onRotate: rotate,
  });

  const isZoomed = (zoom ?? 100) > 100;
  const effectiveScale = (zoom ?? 100) / 100;

  const onWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    if (event.deltaY < 0) zoomIn();
    else zoomOut();
  };

  const onPointerDown = (event: React.PointerEvent) => {
    if (!isZoomed) return;
    dragState.current = { startX: event.clientX, startY: event.clientY, panX: pan.x, panY: pan.y };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    if (!dragState.current) return;
    const dx = event.clientX - dragState.current.startX;
    const dy = event.clientY - dragState.current.startY;
    setPan({ x: dragState.current.panX + dx, y: dragState.current.panY + dy });
  };

  const onPointerUp = () => {
    dragState.current = null;
  };

  const onTouchStart = (event: React.TouchEvent) => {
    if (isZoomed) return;
    touchStartX.current = event.touches[0]?.clientX ?? null;
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 60) return;
    if (delta > 0) onPrevious();
    else onNext();
  };

  return (
    <div className="flex size-full flex-col">
      <div
        className="relative flex flex-1 items-center justify-center touch-pan-y overflow-hidden"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onDoubleClick={() => (isZoomed ? zoomReset() : setZoom(200))}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {!loaded && !failed ? (
          <div className="border-white/20 border-t-white/70 size-10 animate-spin rounded-full border-2" aria-hidden />
        ) : null}
        {failed ? (
          <p className="text-sm text-white/70">This image could not be loaded.</p>
        ) : (
          <img
            src={url}
            alt={item.name}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={cn(
              'max-h-full max-w-full select-none object-contain transition-opacity',
              loaded ? 'opacity-100' : 'opacity-0',
              isZoomed ? (dragState.current ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-zoom-in',
            )}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${effectiveScale}) rotate(${rotation}deg)`,
              transition: dragState.current ? 'none' : 'transform 150ms ease-out',
            }}
            draggable={false}
          />
        )}
      </div>

      <div className="gap-1 px-3 py-2 flex shrink-0 items-center justify-center border-t border-white/10 bg-black/30 text-white">
        <Hint label="Zoom out" shortcut="-">
          <IconButton variant="ghost" size="icon-sm" aria-label="Zoom out" onClick={zoomOut} className="text-white hover:bg-white/10 hover:text-white">
            <Minus />
          </IconButton>
        </Hint>
        <button
          type="button"
          onClick={zoomReset}
          className="min-w-14 px-2 h-7 rounded-md text-xs font-medium text-white/80 hover:bg-white/10 hover:text-white"
        >
          {zoom === null ? 'Fit' : `${zoom}%`}
        </button>
        <Hint label="Zoom in" shortcut="+">
          <IconButton variant="ghost" size="icon-sm" aria-label="Zoom in" onClick={zoomIn} className="text-white hover:bg-white/10 hover:text-white">
            <Plus />
          </IconButton>
        </Hint>
        <span className="mx-1 h-4 w-px bg-white/15" aria-hidden />
        <Hint label="Rotate" shortcut="R">
          <IconButton variant="ghost" size="icon-sm" aria-label="Rotate" onClick={rotate} className="text-white hover:bg-white/10 hover:text-white">
            <RotateCw />
          </IconButton>
        </Hint>
        <Hint label="Reset" shortcut="0">
          <IconButton variant="ghost" size="icon-sm" aria-label="Reset zoom" onClick={zoomReset} className="text-white hover:bg-white/10 hover:text-white">
            <Maximize2 />
          </IconButton>
        </Hint>
      </div>
    </div>
  );
}
