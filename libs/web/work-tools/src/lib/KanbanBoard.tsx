import type { TaskStatus } from '@org/types';
import { Input, SkeletonList } from '@org/ui';
import { Sparkles, X } from 'lucide-react';
import {
  Fragment,
  useCallback,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react';
import {
  countActiveFilters,
  EMPTY_FILTER,
  matchesFilter,
  type BoardFilter,
} from './kanban/card-meta.js';
import { CardDetailsDialog } from './kanban/CardDetailsDialog.js';
import { KanbanListColumn } from './kanban/KanbanListColumn.js';
import { LinearFilterMenu } from './kanban/LinearFilterMenu.js';
import type { BoardAction } from './kanban/server-board.js';
import type { BoardState, KanbanCard } from './kanban/types.js';

export type {
  BoardMember,
  BoardState,
  KanbanCard,
  KanbanList,
  Priority,
} from './kanban/types.js';

const EDGE_ZONE = 96;
const EDGE_SPEED = 22;

type DragState = { cardId: string; height: number };

export interface KanbanBoardProps {
  workspaceId: string | undefined;
  /** The open project's tasks, grouped into status columns. */
  board: BoardState;
  dispatch: (action: BoardAction) => void;
  /** Milestone titles on the open project, for the filter menu. */
  milestones?: string[];
  isLoading?: boolean;

  filter?: BoardFilter;
  setFilter?: React.Dispatch<React.SetStateAction<BoardFilter>>;
  /**
   * Left `false` by a parent that renders the filter menu in its own header —
   * two anchored copies of the same popover would overlap.
   */
  isFilterMenuOpen?: boolean;
  setIsFilterMenuOpen?: (open: boolean) => void;
  showAIFilterInput?: boolean;
  setShowAIFilterInput?: (show: boolean) => void;
}

/**
 * The board.
 *
 * Columns are the `TaskStatus` values and a drop is a `moveTask`, so unlike the
 * local board this holds no state that outlives a drag: `board` is derived from
 * the tasks query and every edit goes back through `dispatch`.
 */
export function KanbanBoard({
  workspaceId,
  board,
  dispatch,
  milestones = [],
  isLoading = false,
  filter: externalFilter,
  setFilter: externalSetFilter,
  isFilterMenuOpen: externalIsFilterMenuOpen,
  setIsFilterMenuOpen: externalSetIsFilterMenuOpen,
  showAIFilterInput: externalShowAIFilterInput,
  setShowAIFilterInput: externalSetShowAIFilterInput,
}: KanbanBoardProps) {
  const [internalFilter, setInternalFilter] = useState<BoardFilter>(EMPTY_FILTER);
  const filter = externalFilter ?? internalFilter;
  const setFilter = externalSetFilter ?? setInternalFilter;

  const [internalIsFilterMenuOpen, setInternalIsFilterMenuOpen] = useState(false);
  const isFilterMenuOpen = externalIsFilterMenuOpen ?? internalIsFilterMenuOpen;
  const setIsFilterMenuOpen =
    externalSetIsFilterMenuOpen ?? setInternalIsFilterMenuOpen;

  const [internalShowAIFilterInput, setInternalShowAIFilterInput] = useState(false);
  const showAIFilterInput =
    externalShowAIFilterInput ?? internalShowAIFilterInput;
  const setShowAIFilterInput =
    externalSetShowAIFilterInput ?? setInternalShowAIFilterInput;

  const [aiPromptInput, setAiPromptInput] = useState('');
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  const [drag, setDrag] = useState<DragState | null>(null);
  const [liftedCardId, setLiftedCardId] = useState<string | null>(null);
  const [cardDrop, setCardDrop] = useState<{
    listId: TaskStatus;
    index: number;
  } | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);

  const visibleByList = useMemo(() => {
    const map = new Map<TaskStatus, KanbanCard[]>();
    for (const list of board.lists) {
      map.set(
        list.id,
        list.cards.filter((card) => matchesFilter(card, filter, list.id)),
      );
    }
    return map;
  }, [board.lists, filter]);

  const filterCount = useMemo(() => countActiveFilters(filter), [filter]);

  const clearDrag = useCallback(() => {
    setDrag(null);
    setLiftedCardId(null);
    setCardDrop(null);
  }, []);

  const handleCardDragStart = useCallback(
    (event: DragEvent<HTMLLIElement>, card: KanbanCard) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.id);
      setDrag({
        cardId: card.id,
        height: event.currentTarget.getBoundingClientRect().height,
      });

      for (const [listId, cards] of visibleByList) {
        const at = cards.findIndex((entry) => entry.id === card.id);
        if (at !== -1) {
          setCardDrop({ listId, index: at });
          break;
        }
      }

      requestAnimationFrame(() => setLiftedCardId(card.id));
    },
    [visibleByList],
  );

  const handleCardDragOver = useCallback((listId: TaskStatus, index: number) => {
    setCardDrop((current) =>
      current && current.listId === listId && current.index === index
        ? current
        : { listId, index },
    );
  }, []);

  const handleCardDrop = useCallback(
    (toListId: TaskStatus, visualIndex: number) => {
      if (!drag) return;

      const list = board.lists.find((entry) => entry.id === toListId);
      if (!list) return;

      /*
       * The drop index is counted over *visible* cards, but the position the
       * server is given has to be an index into the whole column — so the
       * visible card at that slot is used as an anchor into the real list.
       */
      const visible = (visibleByList.get(toListId) ?? []).filter(
        (card) => card.id !== drag.cardId,
      );
      const remaining = list.cards.filter((card) => card.id !== drag.cardId);

      let toIndex = remaining.length;
      if (visualIndex < visible.length) {
        const anchor = remaining.findIndex(
          (card) => card.id === visible[visualIndex].id,
        );
        if (anchor !== -1) toIndex = anchor;
      }

      dispatch({ type: 'card/move', cardId: drag.cardId, toListId, toIndex });
      clearDrag();
    },
    [board.lists, clearDrag, dispatch, drag, visibleByList],
  );

  /** Auto-scrolls the column row while a card is held near either edge. */
  const handleBoardDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!drag) return;
    event.preventDefault();

    const scroller = scrollerRef.current;
    if (!scroller) return;

    const rect = scroller.getBoundingClientRect();
    if (event.clientX < rect.left + EDGE_ZONE) {
      scroller.scrollLeft -= EDGE_SPEED;
    } else if (event.clientX > rect.right - EDGE_ZONE) {
      scroller.scrollLeft += EDGE_SPEED;
    }
  };

  return (
    <div className="group/board min-h-128 px-4 sm:px-6 py-4 sm:py-6 flex h-full flex-col overflow-hidden text-foreground">
      {/* Board Filter Controls & AI Overlay */}
      <div className="relative mb-2 shrink-0 space-y-2">
        {/* AI Filter Input Prompt Overlay Bar */}
        {showAIFilterInput && (
          <div className="flex items-center gap-2 p-2 rounded-xl border border-accent-violet/40 bg-accent-violet-soft text-xs animate-in fade-in">
            <Sparkles className="size-4 text-accent-violet shrink-0" />
            <Input
              autoFocus
              value={aiPromptInput}
              onChange={(e) => {
                setAiPromptInput(e.target.value);
                setFilter((prev) => ({ ...prev, aiQuery: e.target.value }));
              }}
              placeholder='Ask AI filter (e.g. "show high priority tasks in progress" or "overdue tasks")...'
              className="flex-1 text-xs h-7 bg-transparent border-none shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/70"
            />
            {aiPromptInput && (
              <button
                onClick={() => {
                  setAiPromptInput('');
                  setFilter((prev) => ({ ...prev, aiQuery: '' }));
                }}
                className="p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Active Filter Chips Pill Bar */}
        {filterCount > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap text-xs pt-1">
            <span className="text-[11px] font-medium text-muted-foreground">
              Active filters:
            </span>

            {filter.query && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-[11px] font-medium">
                Query: "{filter.query}"
                <X
                  className="size-3 cursor-pointer hover:text-foreground"
                  onClick={() => setFilter((prev) => ({ ...prev, query: '' }))}
                />
              </span>
            )}

            {filter.aiQuery && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-violet-soft text-accent-violet text-[11px] font-medium">
                ✨ AI: "{filter.aiQuery}"
                <X
                  className="size-3 cursor-pointer hover:text-foreground"
                  onClick={() => setFilter((prev) => ({ ...prev, aiQuery: '' }))}
                />
              </span>
            )}

            {filter.status.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-[11px] font-medium">
                Status ({filter.status.length})
                <X
                  className="size-3 cursor-pointer hover:text-foreground"
                  onClick={() => setFilter((prev) => ({ ...prev, status: [] }))}
                />
              </span>
            )}

            {filter.priorities.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-[11px] font-medium">
                Priority ({filter.priorities.length})
                <X
                  className="size-3 cursor-pointer hover:text-foreground"
                  onClick={() =>
                    setFilter((prev) => ({ ...prev, priorities: [] }))
                  }
                />
              </span>
            )}

            {filter.memberIds.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-[11px] font-medium">
                Assignee ({filter.memberIds.length})
                <X
                  className="size-3 cursor-pointer hover:text-foreground"
                  onClick={() =>
                    setFilter((prev) => ({ ...prev, memberIds: [] }))
                  }
                />
              </span>
            )}

            {filter.milestones.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-[11px] font-medium">
                Milestones ({filter.milestones.length})
                <X
                  className="size-3 cursor-pointer hover:text-foreground"
                  onClick={() =>
                    setFilter((prev) => ({ ...prev, milestones: [] }))
                  }
                />
              </span>
            )}

            {filter.due !== 'any' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent text-[11px] font-medium capitalize">
                Due: {filter.due}
                <X
                  className="size-3 cursor-pointer hover:text-foreground"
                  onClick={() => setFilter((prev) => ({ ...prev, due: 'any' }))}
                />
              </span>
            )}

            <button
              onClick={() => {
                setFilter(EMPTY_FILTER);
                setAiPromptInput('');
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground underline ml-1"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Floating Linear Filter Popover Menu */}
        <LinearFilterMenu
          filter={filter}
          setFilter={setFilter}
          members={board.members}
          milestones={milestones}
          isOpen={isFilterMenuOpen}
          onClose={() => setIsFilterMenuOpen(false)}
          onActivateAIFilter={() => setShowAIFilterInput(true)}
        />
      </div>

      {/* Kanban Columns Drag Scroller */}
      {isLoading ? (
        <div className="flex flex-1 items-start gap-4 overflow-hidden pb-4">
          {[0, 1, 2, 3].map((column) => (
            <div
              key={column}
              className="w-72 shrink-0 rounded-xl border bg-surface-muted p-3"
            >
              <SkeletonList rows={3} />
            </div>
          ))}
        </div>
      ) : (
        <div
          ref={scrollerRef}
          onDragOver={handleBoardDragOver}
          className="no-scrollbar flex flex-1 items-start gap-4 overflow-x-auto pb-4"
        >
          {board.lists.map((list) => (
            <Fragment key={list.id}>
              <KanbanListColumn
                list={list}
                lists={board.lists}
                members={board.members}
                visibleCards={visibleByList.get(list.id) ?? []}
                hiddenCount={
                  list.cards.length - (visibleByList.get(list.id) ?? []).length
                }
                dispatch={dispatch}
                draggingCardId={drag?.cardId}
                liftedCardId={liftedCardId ?? undefined}
                dropIndex={
                  cardDrop?.listId === list.id ? cardDrop.index : undefined
                }
                dropHeight={drag?.height ?? 0}
                onOpenCard={setOpenCardId}
                onCardDragStart={handleCardDragStart}
                onCardDragEnd={clearDrag}
                onCardDragOver={handleCardDragOver}
                onCardDrop={handleCardDrop}
              />
            </Fragment>
          ))}
        </div>
      )}

      {/* Card Details Dialog */}
      {openCardId ? (
        <CardDetailsDialog
          workspaceId={workspaceId}
          cardId={openCardId}
          board={board}
          dispatch={dispatch}
          onClose={() => setOpenCardId(null)}
        />
      ) : null}
    </div>
  );
}
