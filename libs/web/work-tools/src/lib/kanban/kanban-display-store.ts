import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SortKey } from './types.js';

/**
 * How this viewer likes the board drawn.
 *
 * `manual` is the order the team dragged the cards into. Any other value only
 * changes what this viewer sees: nothing is written to the tasks, so one
 * person's sort can't reshuffle the board for everyone else.
 */
export type BoardOrder = 'manual' | SortKey;

export interface CardProperties {
  ticketId: boolean;
  status: boolean;
  priority: boolean;
  dueDate: boolean;
  assignee: boolean;
  labels: boolean;
  progress: boolean;
  comments: boolean;
  estimate: boolean;
}

export const CARD_PROPERTY_LABELS: Record<keyof CardProperties, string> = {
  ticketId: 'Task ID',
  status: 'Status badge',
  priority: 'Priority',
  dueDate: 'Due date',
  assignee: 'Assignee',
  labels: 'Labels',
  progress: 'Checklist and sub-items',
  comments: 'Comments',
  estimate: 'Estimate points',
};

interface KanbanDisplayState {
  orderBy: BoardOrder;
  card: CardProperties;
  setOrderBy: (orderBy: BoardOrder) => void;
  toggleCardProperty: (key: keyof CardProperties) => void;
}

export const useKanbanDisplayStore = create<KanbanDisplayState>()(
  persist(
    (set) => ({
      orderBy: 'manual',
      card: {
        ticketId: true,
        // The column already says the status; the badge is opt-in.
        status: false,
        priority: true,
        dueDate: true,
        assignee: true,
        labels: true,
        progress: true,
        comments: true,
        estimate: true,
      },
      setOrderBy: (orderBy) => set({ orderBy }),
      toggleCardProperty: (key) =>
        set((state) => ({
          card: { ...state.card, [key]: !state.card[key] },
        })),
    }),
    {
      name: 'onetab_kanban_display_v1',
      version: 2,
      // v2 hides the status badge by default: on a board grouped by status it
      // only repeated the column's name.
      migrate: (persisted, version) => {
        const state = persisted as KanbanDisplayState;
        if (version < 2 && state?.card) {
          return { ...state, card: { ...state.card, status: false } };
        }
        return state;
      },
    },
  ),
);
