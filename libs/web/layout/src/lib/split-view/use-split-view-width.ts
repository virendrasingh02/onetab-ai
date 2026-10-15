import { useCallback, useEffect, useState } from 'react';

export const SPLIT_MIN_WIDTH = 320;
/** The split pane may take at most this share of the window, so the routed page keeps room. */
const MAX_VIEWPORT_RATIO = 0.7;

const canUseDOM = () => typeof window !== 'undefined';
const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

/** Ceiling for the pane — recomputed per call so it tracks window resizes. */
export function splitMaxWidth() {
  if (!canUseDOM()) return 900;
  return Math.max(
    SPLIT_MIN_WIDTH,
    Math.floor(window.innerWidth * MAX_VIEWPORT_RATIO),
  );
}

/**
 * Width + drag behaviour for the split pane, mirroring the right rail's
 * handle (pointer capture, keyboard steps, double-click to reset).
 *
 * `width` is `null` while the pane is on its default: an even 50 / 50 split
 * with the routed page, done by layout (both columns `flex-1`) so it stays
 * even as the window or the right rail changes. Dragging pins a pixel width;
 * double-click returns to 50 / 50. Nothing is persisted — the pane always
 * opens evenly split, however the last one was left.
 */
export function useSplitViewWidth() {
  const [width, setWidth] = useState<number | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  /* Keep a pinned width inside the window when it narrows. */
  useEffect(() => {
    if (!canUseDOM()) return;
    const onResize = () =>
      setWidth((prev) =>
        prev === null ? prev : clamp(prev, SPLIT_MIN_WIDTH, splitMaxWidth()),
      );
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /** The handle sits just before the pane, so the pane is its next sibling. */
  const startResize = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();

    const handle = event.currentTarget;
    const paneRight =
      handle.nextElementSibling?.getBoundingClientRect().right ??
      window.innerWidth;
    handle.setPointerCapture(event.pointerId);
    setIsResizing(true);

    const move = (e: PointerEvent) =>
      setWidth(clamp(paneRight - e.clientX, SPLIT_MIN_WIDTH, splitMaxWidth()));
    const stop = () => {
      setIsResizing(false);
      handle.releasePointerCapture?.(event.pointerId);
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', stop);
      handle.removeEventListener('pointercancel', stop);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', stop);
    handle.addEventListener('pointercancel', stop);
  }, []);

  const reset = useCallback(() => setWidth(null), []);
  /** Keyboard step; `current` is the pane's measured width when it is unpinned. */
  const step = useCallback(
    (delta: number, current: number) =>
      setWidth(clamp(current + delta, SPLIT_MIN_WIDTH, splitMaxWidth())),
    [],
  );

  return { width, isResizing, startResize, reset, step };
}
