import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { lazy, StrictMode, Suspense, useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

/*
 * Throwaway harness: the board over plain local state, so the drag interaction
 * can be exercised without an API behind it. Reached the same lazy way the
 * other preview does, to keep the library out of the eager graph.
 */

const KanbanBoard = lazy(() =>
  import('@org/web-work-tools').then((m) => ({ default: m.KanbanBoard })),
);

const TITLES: Record<string, string> = {
  BACKLOG: 'Backlog',
  TODO: 'Planned',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Completed',
  CANCELLED: 'Cancelled',
};

const ORDER = [
  'BACKLOG',
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'DONE',
  'CANCELLED',
];

interface Card {
  id: string;
  ticketId: string;
  title: string;
  description: string;
  memberIds: string[];
  commentCount: number;
  dueComplete: boolean;
  priority: 'MEDIUM';
  createdAt: string;
}

function makeCard(id: string, title: string, ticketId: string): Card {
  return {
    id,
    ticketId,
    title,
    description: '',
    memberIds: [],
    commentCount: 0,
    dueComplete: false,
    priority: 'MEDIUM',
    createdAt: new Date().toISOString(),
  };
}

let ticket = 0;
const INITIAL = {
  title: 'Harness',
  members: [{ id: 'u1', name: 'Ada' }],
  currentMemberId: 'u1',
  lists: ORDER.map((id, column) => ({
    id,
    title: TITLES[id],
    cards:
      column < 2
        ? Array.from({ length: 4 }, (_, n) =>
            makeCard(`${id}-${n}`, `${TITLES[id]} card ${n + 1}`, `HAR-${(ticket += 1)}`),
          )
        : [],
  })),
};

function Harness() {
  const [board, setBoard] = useState(INITIAL);

  const dispatch = useCallback((action: Record<string, unknown>) => {
    if (action.type === 'list/move') {
      setBoard((current) => {
        const rest = current.lists.filter((list) => list.id !== action.listId);
        const moving = current.lists.find((list) => list.id === action.listId);
        if (!moving) return current;
        const at = Math.min(Math.max(action.toIndex as number, 0), rest.length);
        const lists = [...rest];
        lists.splice(at, 0, moving);
        return { ...current, lists };
      });
      return;
    }

    if (action.type !== 'card/move') return;
    setBoard((current) => {
      let moving: Card | undefined;
      const stripped = current.lists.map((list) => ({
        ...list,
        cards: list.cards.filter((entry) => {
          if (entry.id !== action.cardId) return true;
          moving = entry;
          return false;
        }),
      }));
      if (!moving) return current;
      const card = moving;

      return {
        ...current,
        lists: stripped.map((list) => {
          if (list.id !== action.toListId) return list;
          const cards = [...list.cards];
          cards.splice(Math.min(action.toIndex as number, cards.length), 0, card);
          return { ...list, cards };
        }),
      };
    });
  }, []);

  return (
    <div className="h-screen bg-background text-foreground">
      <Suspense fallback={null}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <KanbanBoard workspaceId="w1" board={board as any} dispatch={dispatch as any} />
      </Suspense>
      <pre id="board-state" hidden>
        {JSON.stringify(
          board.lists.map((list) => ({
            id: list.id,
            cards: list.cards.map((entry) => entry.id),
          })),
        )}
      </pre>
    </div>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <QueryClientProvider client={new QueryClient()}>
      <Harness />
    </QueryClientProvider>
  </StrictMode>,
);
