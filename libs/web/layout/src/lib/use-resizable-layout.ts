import { BREAKPOINTS, useIsMobile } from '@org/hooks';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const LAYOUT_STORAGE_KEY = 'onetab_layout_preferences_v1';

/** Matches the `md:` breakpoint the shell uses to switch to drawer mode. */
const MOBILE_BREAKPOINT = BREAKPOINTS.md;

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
 * Persisted widths and open/closed state for the shell's resizable columns.
 *
 * Dragging itself is owned by `ResizableGroup` (`@org/ui`, on
 * `react-resizable-panels`), which resizes the panels without going through
 * React. This hook only stores where the user *left* them: the shell calls
 * `commitWidths` from the group's `onLayoutChanged`, i.e. once per finished
 * drag or key press, never per frame.
 *
 * Persistence is *desktop-only*. Below `md` the shell renders both panels as
 * overlay drawers whose open state is transient, so writing it back would let
 * a single phone visit clobber the widths and toggles the user set on their
 * desktop.
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

  /*
   * Single source of truth for the breakpoint, shared with every other
   * component via `@org/hooks`. Below `md` the shell renders both side panels
   * as overlay drawers instead of columns.
   */
  const isMobile = useIsMobile();

  /*
   * Widths live in a ref, not state. They are only read when a panel mounts
   * (as its `defaultSize`) or on collapse/expand — a finished drag has nothing
   * to re-render, and putting them in state cost one full shell re-render per
   * drag.
   */
  const widthsRef = useRef({
    left: initial.leftWidth,
    right: initial.rightWidth,
  });

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

  const isMobileRef = useRef(isMobile);
  isMobileRef.current = isMobile;
  const sidebarOpenRef = useRef(sidebarOpen);
  sidebarOpenRef.current = sidebarOpen;

  /* Persist desktop layout only — see the note on the hook. */
  const persist = useCallback(() => {
    if (isMobileRef.current || !canUseDOM()) return;
    try {
      const config: StoredLayoutConfig = {
        leftWidth: widthsRef.current.left,
        rightWidth: widthsRef.current.right,
        sidebarOpen: sidebarOpenRef.current,
      };
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(config));
    } catch {
      /* Quota or private mode — layout preferences are not worth surfacing. */
    }
  }, []);

  useEffect(persist, [persist, isMobile, sidebarOpen]);

  /** Store the widths a finished resize left behind; omitted sides are kept. */
  const commitWidths = useCallback(
    (next: { left?: number; right?: number }) => {
      if (next.left !== undefined) {
        widthsRef.current.left = Math.round(
          clamp(next.left, bounds.leftMin, bounds.leftMax),
        );
      }
      if (next.right !== undefined) {
        widthsRef.current.right = Math.round(
          clamp(next.right, bounds.rightMin, bounds.rightMax),
        );
      }
      persist();
    },
    [bounds.leftMax, bounds.leftMin, bounds.rightMax, bounds.rightMin, persist],
  );

  return {
    /** Last committed widths — read at render / mount time, never reactive. */
    leftWidth: widthsRef.current.left,
    rightWidth: widthsRef.current.right,
    widthsRef,
    sidebarOpen,
    isMobile,
    bounds,
    setSidebarOpen,
    commitWidths,
  };
}
