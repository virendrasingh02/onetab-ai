import { useEffect } from 'react';
import { create } from 'zustand';

/**
 * Coordinates who draws the window's drag strip and minimise/maximise/close
 * controls, for the screens where more than one thing could plausibly own
 * them.
 *
 * `DesktopChrome` always mounts `DesktopTitleBar` above the router, so a
 * frameless window is still draggable and closable on screens that have no
 * header of their own (login, onboarding, the admin console). Once a
 * workspace is open, `AppHeader` draws those same controls into its own row
 * instead — the alternative was two bars stacked for one job. This store is
 * how `DesktopTitleBar` knows to step aside while something downstream has
 * claimed the row, rather than both rendering at once.
 *
 * A counter, not a boolean: a route change can mount the next screen before
 * the previous one unmounts, and the row should stay claimed across that
 * overlap rather than flash the fallback strip in between.
 */
export const useWindowChromeStore = create<{
  claims: number;
  claim: () => void;
  release: () => void;
}>((set) => ({
  claims: 0,
  claim: () => set((state) => ({ claims: state.claims + 1 })),
  release: () => set((state) => ({ claims: Math.max(0, state.claims - 1) })),
}));

/**
 * Call once from a component that draws its own drag strip and window
 * controls, for as long as it stays mounted — see `AppHeader`.
 */
export function useClaimsWindowChrome(): void {
  const claim = useWindowChromeStore((state) => state.claim);
  const release = useWindowChromeStore((state) => state.release);

  useEffect(() => {
    claim();
    return release;
  }, [claim, release]);
}
