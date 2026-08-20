import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Where an open card is drawn.
 *
 * - `panel`  — the app's right rail, beside the board it came from.
 * - `modal`  — a centred dialog at the usual reading width.
 * - `full`   — the same dialog taking essentially the whole viewport.
 *
 * The board previously offered only the last two, behind a single
 * expand/collapse toggle. That is the wrong shape for a preference: whichever
 * one you like, you like it for every card, and a per-card boolean reset itself
 * each time you opened the next one.
 */
export type KanbanCardViewMode = 'panel' | 'modal' | 'full';

interface KanbanCardViewState {
  mode: KanbanCardViewMode;
  setMode: (mode: KanbanCardViewMode) => void;
}

export const useKanbanCardViewStore = create<KanbanCardViewState>()(
  persist(
    (set) => ({
      /* The dialog stays the default — it is what the board has always done,
         and the rail is narrow enough that arriving in it unasked would be a
         surprise. */
      mode: 'modal',
      setMode: (mode) => set({ mode }),
    }),
    { name: 'onetab_kanban_card_view_v1' },
  ),
);
