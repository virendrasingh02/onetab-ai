import { useCallback, useRef, type PointerEvent, type RefObject } from 'react';

/**
 * Grab-to-scroll for the board: press on empty space — a lane's blank area,
 * the gutter between columns — and drag sideways to pan, the way Trello and
 * Linear boards move. Cards, column headers and every control keep their own
 * press; touch keeps the browser's native swipe.
 */

/** What a press on is never a pan. */
const INTERACTIVE = [
  '[data-kanban-card]',
  'header',
  'button',
  'a',
  'input',
  'textarea',
  'select',
  '[contenteditable="true"]',
  '[data-no-drag]',
  '[role="menu"]',
  '[role="dialog"]',
  '.simplebar-track',
].join(',');

/** Pixels of movement before a press counts as a pan, so clicks stay clicks. */
const PAN_THRESHOLD = 4;

export function useBoardPan(
  scrollerRef: RefObject<HTMLElement | null>,
  /** True while a card or column is being dragged: the drag owns the pointer. */
  busy: boolean,
) {
  const panning = useRef(false);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const scroller = scrollerRef.current;
      if (!scroller || busy) return;
      if (event.button !== 0 || event.pointerType === 'touch') return;
      const target = event.target as HTMLElement;
      // Portalled content bubbles through React but isn't in the board.
      if (!scroller.contains(target) || target.closest(INTERACTIVE)) return;
      if (scroller.scrollWidth <= scroller.clientWidth) return;

      const startX = event.clientX;
      const startLeft = scroller.scrollLeft;
      const pointerId = event.pointerId;
      let moved = false;

      const move = (e: globalThis.PointerEvent) => {
        if (e.pointerId !== pointerId) return;
        const dx = e.clientX - startX;
        if (!moved) {
          if (Math.abs(dx) < PAN_THRESHOLD) return;
          moved = true;
          panning.current = true;
          scroller.dataset.panning = '';
          try {
            scroller.setPointerCapture(pointerId);
          } catch {
            /* pointer already released */
          }
        }
        e.preventDefault();
        scroller.scrollLeft = startLeft - dx;
      };

      const end = (e: globalThis.PointerEvent) => {
        if (e.pointerId !== pointerId) return;
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        delete scroller.dataset.panning;
        panning.current = false;
        if (scroller.hasPointerCapture(pointerId)) {
          scroller.releasePointerCapture(pointerId);
        }
      };

      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    },
    [scrollerRef, busy],
  );

  return { onPointerDown };
}
