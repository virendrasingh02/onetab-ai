import { useCallback } from 'react';
import { create } from 'zustand';

export interface HuddleDockState {
  /**
   * The element an active huddle renders into, or null while no shell has
   * mounted one — a conversation outside the app shell then draws its huddle
   * in place instead.
   */
  slot: HTMLElement | null;
  setSlot: (element: HTMLElement | null) => void;
}

export const useHuddleDockStore = create<HuddleDockState>()((set) => ({
  slot: null,
  setSlot: (element) =>
    set((state) => (state.slot === element ? state : { slot: element })),
}));

/**
 * The huddle's landing strip: a full-width row under the shell's three
 * columns, beside the notification bar.
 *
 * A huddle belongs to a conversation but outlives looking at it, so the bar
 * cannot live inside the conversation column — it is published here and the
 * conversation portals into it, the same arrangement the right rail uses for
 * threads. Empty, the row collapses to nothing and costs no height.
 */
export function HuddleDock() {
  const setSlot = useHuddleDockStore((s) => s.setSlot);

  /* A stable ref — an inline arrow would hand the store `null` and then the
     element again on every render of the shell. */
  const ref = useCallback(
    (element: HTMLDivElement | null) => setSlot(element),
    [setSlot],
  );

  return <div ref={ref} className="shrink-0 empty:hidden" />;
}
