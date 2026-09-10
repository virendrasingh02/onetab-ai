import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

/**
 * Tailwind's default breakpoint minimums, in px. Mirrors `breakpoints` in
 * `@org/design-system` — duplicated here so `@org/hooks` stays dependency-free
 * (its only runtime dep is React). If one list changes, change both.
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

export type BreakpointName = keyof typeof BREAKPOINTS;

const canUseDOM = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function';

/**
 * Subscribe to a CSS media query. SSR-safe (returns `false` until mounted),
 * re-renders only when the match actually flips, and tears its listener down on
 * unmount. Pass a full media string:
 *
 *   const wide = useMediaQuery('(min-width: 1024px)');
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!canUseDOM()) return () => undefined;
      const mql = window.matchMedia(query);
      // Safari < 14 only has the deprecated add/removeListener signature.
      if (typeof mql.addEventListener === 'function') {
        mql.addEventListener('change', onStoreChange);
        return () => mql.removeEventListener('change', onStoreChange);
      }
      mql.addListener(onStoreChange);
      return () => mql.removeListener(onStoreChange);
    },
    [query],
  );

  const getSnapshot = useCallback(
    () => (canUseDOM() ? window.matchMedia(query).matches : false),
    [query],
  );

  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

/** `true` below Tailwind's `md` (768px) — phone territory. SSR-safe. */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.md - 1}px)`);
}

/** `true` from `md` up to but not including `lg` — tablet portrait/landscape. */
export function useIsTablet(): boolean {
  return useMediaQuery(
    `(min-width: ${BREAKPOINTS.md}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`,
  );
}

/** `true` at `lg` (1024px) and up — the full multi-column desktop shell. */
export function useIsDesktop(): boolean {
  return useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`);
}

export interface BreakpointState {
  /** Largest named breakpoint whose min-width is met (`'base'` below `sm`). */
  active: 'base' | BreakpointName;
  /** Below `md` (768px). */
  isMobile: boolean;
  /** `md`–`lg` (768–1023px). */
  isTablet: boolean;
  /** `lg` (1024px) and up. */
  isDesktop: boolean;
  /** `true` at or above the given breakpoint. */
  up: (bp: BreakpointName) => boolean;
  /** `true` below the given breakpoint. */
  down: (bp: BreakpointName) => boolean;
}

/**
 * One hook for every breakpoint decision a component needs. Evaluates all five
 * Tailwind breakpoints once and hands back both the flat `isMobile/isTablet/
 * isDesktop` booleans and `up()/down()` helpers for finer checks:
 *
 *   const bp = useBreakpoint();
 *   if (bp.isMobile) return <Sheet…/>;
 *   const cols = bp.up('xl') ? 3 : bp.up('md') ? 2 : 1;
 */
export function useBreakpoint(): BreakpointState {
  const sm = useMediaQuery(`(min-width: ${BREAKPOINTS.sm}px)`);
  const md = useMediaQuery(`(min-width: ${BREAKPOINTS.md}px)`);
  const lg = useMediaQuery(`(min-width: ${BREAKPOINTS.lg}px)`);
  const xl = useMediaQuery(`(min-width: ${BREAKPOINTS.xl}px)`);
  const xxl = useMediaQuery(`(min-width: ${BREAKPOINTS['2xl']}px)`);

  const matched: Record<BreakpointName, boolean> = {
    sm,
    md,
    lg,
    xl,
    '2xl': xxl,
  };

  const active: 'base' | BreakpointName = xxl
    ? '2xl'
    : xl
      ? 'xl'
      : lg
        ? 'lg'
        : md
          ? 'md'
          : sm
            ? 'sm'
            : 'base';

  return {
    active,
    isMobile: !md,
    isTablet: md && !lg,
    isDesktop: lg,
    up: (bp) => matched[bp],
    down: (bp) => !matched[bp],
  };
}

/** Honours the OS "reduce motion" setting. Animations must gate on this. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}

/**
 * `true` when the primary pointer is coarse (finger, not mouse). Use it to
 * switch hover-reveal affordances to always-visible, or to grow hit targets —
 * not as a proxy for screen size (tablets with a trackpad report `fine`).
 */
export function useIsTouchDevice(): boolean {
  return useMediaQuery('(pointer: coarse)');
}

export interface ViewportSize {
  width: number;
  height: number;
}

/**
 * The layout viewport size, tracked across resize and orientation change and
 * throttled to one update per frame. `{ width: 0, height: 0 }` until mounted.
 * Prefer `useBreakpoint()` for layout branching — reach for this only when a
 * real pixel measurement is needed (canvas, virtualiser bounds).
 */
export function useViewportSize(): ViewportSize {
  const [size, setSize] = useState<ViewportSize>(() =>
    typeof window === 'undefined'
      ? { width: 0, height: 0 }
      : { width: window.innerWidth, height: window.innerHeight },
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setSize({ width: window.innerWidth, height: window.innerHeight }),
      );
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  return size;
}

export interface KeyboardInsetState {
  /** Pixels of the layout viewport currently covered by the virtual keyboard. */
  height: number;
  /** `true` while that value is more than an incidental toolbar shift. */
  isOpen: boolean;
}

/**
 * How much of the bottom of the screen the on-screen keyboard is covering,
 * derived from `window.visualViewport`. Returns `0` on desktop and on browsers
 * without the API, so it is always safe to add to a `padding-bottom`:
 *
 *   const { height } = useKeyboardInset();
 *   <footer style={{ paddingBottom: height }}>…composer…</footer>
 *
 * Pair it with `env(safe-area-inset-bottom)` via `max()` so the composer clears
 * both the keyboard and the home indicator.
 */
export function useKeyboardInset(): KeyboardInsetState {
  const [height, setHeight] = useState(0);
  const frameRef = useRef(0);

  useEffect(() => {
    const vv =
      typeof window !== 'undefined' ? window.visualViewport ?? null : null;
    if (!vv) return;

    const update = () => {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        // Gap between the visual viewport's bottom edge and the layout
        // viewport's — what the keyboard (or a collapsing browser toolbar)
        // now overlaps. Clamped at 0; never negative.
        const inset = Math.max(
          0,
          window.innerHeight - vv.height - vv.offsetTop,
        );
        setHeight(Math.round(inset));
      });
    };

    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      cancelAnimationFrame(frameRef.current);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return { height, isOpen: height > 60 };
}
