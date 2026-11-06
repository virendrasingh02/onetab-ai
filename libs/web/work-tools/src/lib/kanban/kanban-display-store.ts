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
  priority: boolean;
  dueDate: boolean;
  assignee: boolean;
  labels: boolean;
  progress: boolean;
  comments: boolean;
}

export const CARD_PROPERTY_LABELS: Record<keyof CardProperties, string> = {
  ticketId: 'Task ID',
  priority: 'Priority',
  dueDate: 'Due date',
  assignee: 'Assignee',
  labels: 'Labels',
  progress: 'Checklist and sub-items',
  comments: 'Comments',
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
        priority: true,
        dueDate: true,
        assignee: true,
        labels: true,
        progress: true,
        comments: true,
      },
      setOrderBy: (orderBy) => set({ orderBy }),
      toggleCardProperty: (key) =>
        set((state) => ({
          card: { ...state.card, [key]: !state.card[key] },
        })),
    }),
    { name: 'onetab_kanban_display_v1' },
  ),
);
