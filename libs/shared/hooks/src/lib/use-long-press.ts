import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';

export interface UseLongPressOptions {
  /** Hold time before the press fires, in ms. Default 450. */
  delay?: number;
  /**
   * How far the pointer may drift during the hold before it is treated as a
   * scroll and the press is cancelled, in px. Default 10.
   */
  moveTolerance?: number;
  /**
   * Also fire on a mouse right-click / the platform context-menu gesture
   * (preventing the native menu). Default `true` — gives desktop keyboard and
   * mouse users the same entry point.
   */
  handleContextMenu?: boolean;
  /** Skip entirely (e.g. when the row is in an editing state). */
  disabled?: boolean;
}

export interface LongPressHandlers {
  onPointerDown: (e: ReactPointerEvent) => void;
  onPointerMove: (e: ReactPointerEvent) => void;
  onPointerUp: (e: ReactPointerEvent) => void;
  onPointerLeave: (e: ReactPointerEvent) => void;
  onPointerCancel: (e: ReactPointerEvent) => void;
  onContextMenu: (e: ReactMouseEvent) => void;
}

/**
 * Fires `onLongPress` after the pointer is held still on the element for
 * `delay` ms. Cancels if the pointer moves more than `moveTolerance` (so a
 * scroll never triggers it) or lifts early. On touch it also emits a short
 * haptic tick where the platform supports `navigator.vibrate`.
 *
 * Returns a bag of pointer handlers to spread onto the target:
 *
 *   const bind = useLongPress(() => setActionsOpen(true));
 *   <article {...bind}>…</article>
 *
 * It does not manage the "pressed" state itself — the caller decides what a
 * long press opens and how it dismisses.
 */
export function useLongPress(
  onLongPress: (e: ReactPointerEvent | ReactMouseEvent) => void,
  options: UseLongPressOptions = {},
): LongPressHandlers {
  const {
    delay = 450,
    moveTolerance = 10,
    handleContextMenu = true,
    disabled = false,
  } = options;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);
  const callbackRef = useRef(onLongPress);
  callbackRef.current = onLongPress;

  const clear = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    originRef.current = null;
  }, []);

  useEffect(() => clear, [clear]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent) => {
      if (disabled) return;
      // Only the primary button for a mouse; any contact for touch/pen.
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      clear();
      firedRef.current = false;
      originRef.current = { x: e.clientX, y: e.clientY };
      timerRef.current = setTimeout(() => {
        firedRef.current = true;
        try {
          navigator.vibrate?.(10);
        } catch {
          /* vibrate can throw in cross-origin iframes — ignore */
        }
        callbackRef.current(e);
      }, delay);
    },
    [clear, delay, disabled],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent) => {
      const origin = originRef.current;
      if (!origin || !timerRef.current) return;
      const dx = Math.abs(e.clientX - origin.x);
      const dy = Math.abs(e.clientY - origin.y);
      if (dx > moveTolerance || dy > moveTolerance) clear();
    },
    [clear, moveTolerance],
  );

  const onContextMenu = useCallback(
    (e: ReactMouseEvent) => {
      if (disabled || !handleContextMenu) return;
      // A touch long-press that already fired also raises contextmenu on some
      // engines — swallow it so the native menu never flashes, but don't
      // double-fire the callback.
      e.preventDefault();
      if (firedRef.current) return;
      firedRef.current = true;
      callbackRef.current(e);
    },
    [disabled, handleContextMenu],
  );

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: clear,
    onPointerLeave: clear,
    onPointerCancel: clear,
    onContextMenu,
  };
}
