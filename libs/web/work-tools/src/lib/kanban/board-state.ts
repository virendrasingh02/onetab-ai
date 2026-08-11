import { useEffect, useReducer, type Dispatch } from 'react';
import { createSeedBoard } from './seed.js';
import type {
  BoardState,
  KanbanCard,
  KanbanList,
  Priority,
  SortKey,
} from './types.js';

/* ------------------------------------------------------------------ ids --- */

let sequence = 0;

/** Collision-safe enough for client-side entities, and readable in devtools. */
export function createId(prefix: string): string {
  sequence += 1;
  const random =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${random}${sequence}`;
}

/* -------------------------------------------------------------- actions --- */

export type BoardAction =
  | { type: 'board/rename'; title: string }
  | { type: 'board/reset' }
  /** Swaps the whole board in — used when switching projects and on import. */
  | { type: 'board/replace'; state: BoardState }
  | { type: 'list/add'; title: string }
  | { type: 'list/rename'; listId: string; title: string }
  | { type: 'list/remove'; listId: string }
  | { type: 'list/move'; listId: string; toIndex: number }
  | { type: 'list/clear'; listId: string }
  | { type: 'list/sort'; listId: string; by: SortKey }
  | { type: 'list/moveAll'; fromListId: string; toListId: string }
  | { type: 'card/add'; listId: string; title: string; edge?: 'top' | 'bottom' }
  | { type: 'card/update'; cardId: string; patch: Partial<KanbanCard> }
  | { type: 'card/remove'; cardId: string }
  | { type: 'card/copy'; cardId: string }
  | { type: 'card/move'; cardId: string; toListId: string; toIndex: number }
  | { type: 'card/toggleLabel'; cardId: string; labelId: string }
  | { type: 'card/toggleMember'; cardId: string; memberId: string }
  | { type: 'label/rename'; labelId: string; name: string }
  | { type: 'checklist/add'; cardId: string; text: string }
  | { type: 'checklist/toggle'; cardId: string; itemId: string }
  | { type: 'checklist/remove'; cardId: string; itemId: string }
  | { type: 'comment/add'; cardId: string; body: string }
  | { type: 'comment/remove'; cardId: string; commentId: string };

/* -------------------------------------------------------------- helpers --- */

export function findCard(
  state: BoardState,
  cardId: string,
): { list: KanbanList; card: KanbanCard; index: number } | undefined {
  for (const list of state.lists) {
    const index = list.cards.findIndex((card) => card.id === cardId);
    if (index !== -1) return { list, card: list.cards[index], index };
  }
  return undefined;
}

function patchCard(
  state: BoardState,
  cardId: string,
  update: (card: KanbanCard) => KanbanCard,
): BoardState {
  return {
    ...state,
    lists: state.lists.map((list) =>
      list.cards.some((card) => card.id === cardId)
        ? {
            ...list,
            cards: list.cards.map((card) =>
              card.id === cardId ? update(card) : card,
            ),
          }
        : list,
    ),
  };
}

function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const PRIORITY_RANK: Record<Priority, number> = {
  URGENT: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

function compareBy(key: SortKey) {
  return (a: KanbanCard, b: KanbanCard): number => {
    switch (key) {
      case 'due':
        // Undated cards sink to the bottom rather than sorting as epoch zero.
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      case 'priority':
        return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      case 'title':
        return a.title.localeCompare(b.title);
      case 'created':
        return b.createdAt.localeCompare(a.createdAt);
      default:
        return 0;
    }
  };
}

export function newCard(title: string): KanbanCard {
  return {
    id: createId('c'),
    title,
    description: '',
    labelIds: [],
    memberIds: [],
    dueComplete: false,
    priority: 'MEDIUM',
    checklist: [],
    comments: [],
    createdAt: new Date().toISOString(),
  };
}

/* -------------------------------------------------------------- reducer --- */

export function boardReducer(
  state: BoardState,
  action: BoardAction,
): BoardState {
  switch (action.type) {
    case 'board/rename':
      return { ...state, title: action.title };

    case 'board/reset':
      return createSeedBoard();

    case 'board/replace':
      return action.state;

    case 'list/add':
      return {
        ...state,
        lists: [
          ...state.lists,
          { id: createId('list'), title: action.title, cards: [] },
        ],
      };

    case 'list/rename':
      return {
        ...state,
        lists: state.lists.map((list) =>
          list.id === action.listId ? { ...list, title: action.title } : list,
        ),
      };

    case 'list/remove':
      return {
        ...state,
        lists: state.lists.filter((list) => list.id !== action.listId),
      };

    case 'list/move': {
      const from = state.lists.findIndex((list) => list.id === action.listId);
      if (from === -1) return state;
      const lists = [...state.lists];
      const [moved] = lists.splice(from, 1);
      lists.splice(clamp(action.toIndex, 0, lists.length), 0, moved);
      return { ...state, lists };
    }

    case 'list/clear':
      return {
        ...state,
        lists: state.lists.map((list) =>
          list.id === action.listId ? { ...list, cards: [] } : list,
        ),
      };

    case 'list/sort':
      return {
        ...state,
        lists: state.lists.map((list) =>
          list.id === action.listId
            ? { ...list, cards: [...list.cards].sort(compareBy(action.by)) }
            : list,
        ),
      };

    case 'list/moveAll': {
      const source = state.lists.find((list) => list.id === action.fromListId);
      if (!source || source.cards.length === 0) return state;
      return {
        ...state,
        lists: state.lists.map((list) => {
          if (list.id === action.fromListId) return { ...list, cards: [] };
          if (list.id === action.toListId)
            return { ...list, cards: [...list.cards, ...source.cards] };
          return list;
        }),
      };
    }

    case 'card/add': {
      const card = newCard(action.title);
      return {
        ...state,
        lists: state.lists.map((list) =>
          list.id === action.listId
            ? {
                ...list,
                cards:
                  action.edge === 'top'
                    ? [card, ...list.cards]
                    : [...list.cards, card],
              }
            : list,
        ),
      };
    }

    case 'card/update':
      return patchCard(state, action.cardId, (card) => ({
        ...card,
        ...action.patch,
      }));

    case 'card/remove':
      return {
        ...state,
        lists: state.lists.map((list) => ({
          ...list,
          cards: list.cards.filter((card) => card.id !== action.cardId),
        })),
      };

    case 'card/copy': {
      const found = findCard(state, action.cardId);
      if (!found) return state;
      const copy: KanbanCard = {
        ...found.card,
        id: createId('c'),
        title: `${found.card.title} (copy)`,
        createdAt: new Date().toISOString(),
        // Comments belong to the original conversation; the checklist doesn't.
        comments: [],
        checklist: found.card.checklist.map((item) => ({
          ...item,
          id: createId('ci'),
        })),
      };
      return {
        ...state,
        lists: state.lists.map((list) => {
          if (list.id !== found.list.id) return list;
          const cards = [...list.cards];
          cards.splice(found.index + 1, 0, copy);
          return { ...list, cards };
        }),
      };
    }

    case 'card/move': {
      const found = findCard(state, action.cardId);
      if (!found) return state;

      // The card is pulled out first, so `toIndex` is always an index into the
      // target list *without* it — which is exactly what the drop-target
      // calculation reports, since it skips the card being dragged.
      const lists = state.lists.map((list) =>
        list.id === found.list.id
          ? { ...list, cards: list.cards.filter((c) => c.id !== action.cardId) }
          : list,
      );

      const targetIndex = lists.findIndex(
        (list) => list.id === action.toListId,
      );
      if (targetIndex === -1) return state;

      const target = lists[targetIndex];
      const cards = [...target.cards];
      cards.splice(clamp(action.toIndex, 0, cards.length), 0, found.card);
      lists[targetIndex] = { ...target, cards };

      return { ...state, lists };
    }

    case 'card/toggleLabel':
      return patchCard(state, action.cardId, (card) => ({
        ...card,
        labelIds: toggleId(card.labelIds, action.labelId),
      }));

    case 'card/toggleMember':
      return patchCard(state, action.cardId, (card) => ({
        ...card,
        memberIds: toggleId(card.memberIds, action.memberId),
      }));

    case 'label/rename':
      return {
        ...state,
        labels: state.labels.map((label) =>
          label.id === action.labelId ? { ...label, name: action.name } : label,
        ),
      };

    case 'checklist/add':
      return patchCard(state, action.cardId, (card) => ({
        ...card,
        checklist: [
          ...card.checklist,
          { id: createId('ci'), text: action.text, done: false },
        ],
      }));

    case 'checklist/toggle':
      return patchCard(state, action.cardId, (card) => ({
        ...card,
        checklist: card.checklist.map((item) =>
          item.id === action.itemId ? { ...item, done: !item.done } : item,
        ),
      }));

    case 'checklist/remove':
      return patchCard(state, action.cardId, (card) => ({
        ...card,
        checklist: card.checklist.filter((item) => item.id !== action.itemId),
      }));

    case 'comment/add':
      return patchCard(state, action.cardId, (card) => ({
        ...card,
        comments: [
          {
            id: createId('cm'),
            authorId: state.currentMemberId,
            body: action.body,
            createdAt: new Date().toISOString(),
          },
          ...card.comments,
        ],
      }));

    case 'comment/remove':
      return patchCard(state, action.cardId, (card) => ({
        ...card,
        comments: card.comments.filter(
          (comment) => comment.id !== action.commentId,
        ),
      }));

    default:
      return state;
  }
}

/* ---------------------------------------------------------- persistence --- */

const STORAGE_KEY = 'onetab.kanban.board.v1';

function loadBoard(): BoardState {
  if (typeof window === 'undefined') return createSeedBoard();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSeedBoard();

    const parsed = JSON.parse(raw) as Partial<BoardState>;
    // Shape check only — a hand-edited or stale payload falls back to the seed
    // rather than rendering a board with undefined lists.
    if (!Array.isArray(parsed.lists) || !Array.isArray(parsed.labels)) {
      return createSeedBoard();
    }
    return { ...createSeedBoard(), ...parsed };
  } catch {
    return createSeedBoard();
  }
}

/**
 * Board state plus a write-through to `localStorage`, so a reload keeps the
 * columns the user arranged. Swap `loadBoard`/the effect for a query and a
 * mutation when the tasks API lands; nothing else in the tree changes.
 */
export function useBoard(): [BoardState, Dispatch<BoardAction>] {
  const [state, dispatch] = useReducer(boardReducer, undefined, loadBoard);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private mode or a full quota: the board still works for this session.
    }
  }, [state]);

  return [state, dispatch];
}
