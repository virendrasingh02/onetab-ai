import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const LAYOUT_STORAGE_KEY = 'onetab_layout_preferences_v1';

/** Matches the `md:` breakpoint the shell uses to switch to drawer mode. */
const MOBILE_BREAKPOINT = 768;

/** No side panel may eat more than this share of the viewport. */
const MAX_PANEL_VIEWPORT_RATIO = 0.45;

export interface LayoutBounds {
  leftMin: number;
  leftMax: number;
  leftDefault: number;
  rightMin: number;
  rightMax: number;
  rightDefault: number;
}

export const DEFAULT_LAYOUT_BOUNDS: LayoutBounds = {
  leftMin: 180,
  leftMax: 480,
  leftDefault: 240,
  rightMin: 260,
  rightMax: 600,
  rightDefault: 320,
};

/**
 * Note the absence of `rightPanelOpen`.
 *
 * The right rail is opened from all over the app — a profile card, a Kanban
 * card, a channel's details — so its open state lives in `useRightPanelStore`
 * alongside the view it should show. Keeping a second copy here meant two
 * writers for one boolean, and the rail would flicker shut whenever the other
 * one won.
 */
export interface StoredLayoutConfig {
  leftWidth: number;
  rightWidth: number;
  sidebarOpen: boolean;
}

export interface UseResizableLayoutOptions {
  bounds?: Partial<LayoutBounds>;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** `window` is absent during SSR and during the desktop shell's prerender. */
const canUseDOM = () => typeof window !== 'undefined';

/**
 * The hard ceiling for a panel: whichever is smaller, the configured maximum or
 * a fixed share of the viewport. Recomputed per drag frame so the constraint
 * still holds while the window itself is being resized.
 */
function viewportMax(configuredMax: number) {
  if (!canUseDOM()) return configuredMax;
  return Math.min(
    configuredMax,
    Math.floor(window.innerWidth * MAX_PANEL_VIEWPORT_RATIO),
  );
}

/**
 * Widths, open/closed state and drag behaviour for the shell's two resizable
 * columns.
 *
 * Two things here are deliberate and easy to regress:
 *
 *  - Persistence is *desktop-only*. Below `md` the shell renders both panels as
 *    overlay drawers whose open state is transient, so writing it back would let
 *    a single phone visit clobber the widths and toggles the user set on their
 *    desktop.
 *  - Dragging uses pointer capture rather than bare `window` listeners, so the
 *    gesture survives the cursor crossing an iframe or leaving the window — the
 *    failure mode there was a panel stuck in resize mode after mouse-up.
 */
export function useResizableLayout(options: UseResizableLayoutOptions = {}) {
  const { bounds: boundsOption } = options;

  const bounds = useMemo<LayoutBounds>(
    () => ({ ...DEFAULT_LAYOUT_BOUNDS, ...boundsOption }),
    [boundsOption],
  );

  /* Read once, lazily. Guarded because `localStorage` throws in SSR and in
     Safari's private mode. */
  const [initial] = useState<StoredLayoutConfig>(() => {
    const fallback: StoredLayoutConfig = {
      leftWidth: bounds.leftDefault,
      rightWidth: bounds.rightDefault,
      sidebarOpen: true,
    };

    if (!canUseDOM()) return fallback;

    try {
      const saved = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
      if (!saved) return fallback;

      const parsed = JSON.parse(saved) as Partial<StoredLayoutConfig>;
      return {
        leftWidth:
          typeof parsed.leftWidth === 'number'
            ? clamp(parsed.leftWidth, bounds.leftMin, bounds.leftMax)
            : fallback.leftWidth,
        rightWidth:
          typeof parsed.rightWidth === 'number'
            ? clamp(parsed.rightWidth, bounds.rightMin, bounds.rightMax)
            : fallback.rightWidth,
        sidebarOpen:
          typeof parsed.sidebarOpen === 'boolean'
            ? parsed.sidebarOpen
            : fallback.sidebarOpen,
      };
    } catch {
      return fallback;
    }
  });

  const [isMobile, setIsMobile] = useState<boolean>(() =>
    canUseDOM() ? window.innerWidth < MOBILE_BREAKPOINT : false,
  );

  const [leftWidth, setLeftWidth] = useState(initial.leftWidth);
  const [rightWidth, setRightWidth] = useState(initial.rightWidth);
  const [isResizing, setIsResizing] = useState<'left' | 'right' | null>(null);

  /*
   * Drawers start closed on a phone regardless of what desktop preferred —
   * an overlay covering the whole screen on first paint is never the right
   * first impression.
   */
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    canUseDOM() && window.innerWidth < MOBILE_BREAKPOINT
      ? false
      : initial.sidebarOpen,
  );

  /* Persist desktop layout only — see the note on the hook. */
  useEffect(() => {
    if (isMobile || !canUseDOM()) return;
    try {
      const config: StoredLayoutConfig = {
        leftWidth,
        rightWidth,
        sidebarOpen,
      };
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(config));
    } catch {
      /* Quota or private mode — layout preferences are not worth surfacing. */
    }
  }, [isMobile, leftWidth, rightWidth, sidebarOpen]);

  /*
   * Track the breakpoint with `matchMedia` instead of a `resize` handler: it
   * fires only when the boundary is actually crossed, not on every frame of a
   * window drag.
   */
  useEffect(() => {
    if (!canUseDOM()) return;

    const query = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const sync = (event: MediaQueryList | MediaQueryListEvent) => {
      setIsMobile(event.matches);
    };

    sync(query);
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  /* Shrink panels that no longer fit after the window narrows. */
  useEffect(() => {
    if (!canUseDOM()) return;

    let frame = 0;
    const handleResize = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setLeftWidth((prev) =>
          Math.max(bounds.leftMin, Math.min(prev, viewportMax(bounds.leftMax))),
        );
        setRightWidth((prev) =>
          Math.max(
            bounds.rightMin,
            Math.min(prev, viewportMax(bounds.rightMax)),
          ),
        );
      });
    };

    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', handleResize);
    };
  }, [bounds.leftMax, bounds.leftMin, bounds.rightMax, bounds.rightMin]);

  /** Width of everything to the left of the resizable sidebar (the icon rail). */
  const contentOffsetRef = useRef(0);

  const startResize = useCallback(
    (side: 'left' | 'right') => (event: React.PointerEvent<HTMLElement>) => {
      /* Ignore secondary buttons so a right-click never starts a drag. */
      if (event.button !== 0) return;
      event.preventDefault();

      const handle = event.currentTarget;
      handle.setPointerCapture(event.pointerId);
      setIsResizing(side);

      /*
       * The sidebar no longer starts at x=0 now that the icon rail sits to its
       * left, so width is measured from the panel's own left edge (the handle's
       * immediately preceding sibling) rather than from the viewport.
       */
      contentOffsetRef.current =
        side === 'left'
          ? (handle.previousElementSibling?.getBoundingClientRect().left ?? 0)
          : 0;

      const handleMove = (moveEvent: PointerEvent) => {
        if (side === 'left') {
          const next = moveEvent.clientX - contentOffsetRef.current;
          setLeftWidth(
            clamp(next, bounds.leftMin, viewportMax(bounds.leftMax)),
          );
        } else {
          const next = window.innerWidth - moveEvent.clientX;
          setRightWidth(
            clamp(next, bounds.rightMin, viewportMax(bounds.rightMax)),
          );
        }
      };

      const stop = () => {
        setIsResizing(null);
        handle.releasePointerCapture?.(event.pointerId);
        handle.removeEventListener('pointermove', handleMove);
        handle.removeEventListener('pointerup', stop);
        handle.removeEventListener('pointercancel', stop);
      };

      handle.addEventListener('pointermove', handleMove);
      handle.addEventListener('pointerup', stop);
      handle.addEventListener('pointercancel', stop);
    },
    [bounds.leftMax, bounds.leftMin, bounds.rightMax, bounds.rightMin],
  );

  const startLeftResize = useMemo(() => startResize('left'), [startResize]);
  const startRightResize = useMemo(() => startResize('right'), [startResize]);

  const resetLeftWidth = useCallback(
    () => setLeftWidth(bounds.leftDefault),
    [bounds.leftDefault],
  );
  const resetRightWidth = useCallback(
    () => setRightWidth(bounds.rightDefault),
    [bounds.rightDefault],
  );

  const stepLeftWidth = useCallback(
    (delta: number) =>
      setLeftWidth((prev) =>
        clamp(prev + delta, bounds.leftMin, viewportMax(bounds.leftMax)),
      ),
    [bounds.leftMax, bounds.leftMin],
  );

  const stepRightWidth = useCallback(
    (delta: number) =>
      setRightWidth((prev) =>
        clamp(prev + delta, bounds.rightMin, viewportMax(bounds.rightMax)),
      ),
    [bounds.rightMax, bounds.rightMin],
  );

  return {
    leftWidth,
    rightWidth,
    sidebarOpen,
    isResizing,
    isMobile,
    bounds,
    setSidebarOpen,
    startLeftResize,
    startRightResize,
    resetLeftWidth,
    resetRightWidth,
    stepLeftWidth,
    stepRightWidth,
  };
}
