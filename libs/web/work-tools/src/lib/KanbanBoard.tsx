import { Button, SkeletonList } from '@org/ui';
import { cn } from '@org/utils';
import { Sparkles, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { SmartFilterBar } from './kanban/SmartFilterBar.js';
import { useCurrentUser } from '@org/auth';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useConvertTaskToDocument } from './use-work-tools.js';
import {
  countActiveFilters,
  EMPTY_FILTER,
  matchesFilter,
  type BoardFilter,
} from './kanban/card-meta.js';
import { CardDetailsDialog } from './kanban/CardDetailsDialog.js';
import { KanbanListColumn } from './kanban/KanbanListColumn.js';
import { LinearFilterMenu } from './kanban/LinearFilterMenu.js';
import { useKanbanDisplayStore } from './kanban/kanban-display-store.js';
import { compareBy, type BoardAction } from './kanban/server-board.js';
import type { BoardState, KanbanCard } from './kanban/types.js';
import { useBoardDrag, type DragSlot } from './kanban/use-board-drag.js';
import { useBoardPan } from './kanban/use-board-pan.js';

export type {
  BoardMember,
  BoardState,
  KanbanCard,
  KanbanList,
  Priority,
} from './kanban/types.js';

export interface KanbanBoardProps {
  workspaceId: string | undefined;
  /** The open project — threaded to the card dialog for Epic/Module/Cycle and task-link pickers. */
  projectId?: string;
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

const DUE_LABELS: Record<Exclude<BoardFilter['due'], 'any'>, string> = {
  overdue: 'Overdue',
  today: 'Due today',
  week: 'Due this week',
  none: 'No due date',
};

function namesFor(ids: string[], items: Array<{ id: string; name: string }>) {
  return ids
    .map((id) => items.find((item) => item.id === id)?.name ?? id)
    .join(', ');
}

/** One active-filter chip: label plus a clear button. */
function FilterChip({
  label,
  icon,
  title,
  tone = 'default',
  onClear,
}: {
  label: string;
  icon?: ReactNode;
  title?: string;
  tone?: 'default' | 'smart';
  onClear: () => void;
}) {
  return (
    <span
      title={title}
      className={cn(
        'gap-1 pl-2 pr-0.5 inline-flex h-6 max-w-80 items-center rounded-md border text-xs',
        tone === 'smart'
          ? 'border-accent-violet/30 bg-accent-violet-soft text-accent-violet'
          : 'border-border bg-surface text-foreground',
      )}
    >
      {icon}
      <span className="truncate">{label}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remove filter: ${label}`}
        className="size-5 inline-flex shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <X className="size-3" />
      </button>
    </span>
  );
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
  projectId,
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
  const currentUser = useCurrentUser();
  const navigate = useNavigate();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const convertTaskToDoc = useConvertTaskToDocument(
    workspaceId,
    workspaceSlug
      ? (docId) => navigate(`/w/${workspaceSlug}/docs/${docId}`)
      : undefined,
  );
  const [internalFilter, setInternalFilter] =
    useState<BoardFilter>(EMPTY_FILTER);
  const filter = externalFilter ?? internalFilter;
  const setFilter = externalSetFilter ?? setInternalFilter;

  const [internalIsFilterMenuOpen, setInternalIsFilterMenuOpen] =
    useState(false);
  const isFilterMenuOpen = externalIsFilterMenuOpen ?? internalIsFilterMenuOpen;
  const setIsFilterMenuOpen =
    externalSetIsFilterMenuOpen ?? setInternalIsFilterMenuOpen;

  const [internalShowAIFilterInput, setInternalShowAIFilterInput] =
    useState(false);
  const showAIFilterInput =
    externalShowAIFilterInput ?? internalShowAIFilterInput;
  const setShowAIFilterInput =
    externalSetShowAIFilterInput ?? setInternalShowAIFilterInput;

  const smartStatuses = useMemo(
    () => board.lists.map((list) => ({ id: list.id, name: list.title })),
    [board.lists],
  );
  const smartMembers = useMemo(
    () =>
      board.members.map((m) => ({ id: m.id, name: m.displayName || m.name })),
    [board.members],
  );
  const [openCardId, setOpenCardId] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);

  const orderBy = useKanbanDisplayStore((state) => state.orderBy);

  const visibleByList = useMemo(() => {
    const map = new Map<string, KanbanCard[]>();
    for (const list of board.lists) {
      const cards = list.cards.filter((card) =>
        matchesFilter(card, filter, list.id),
      );
      map.set(
        list.id,
        orderBy === 'manual' ? cards : cards.sort(compareBy(orderBy)),
      );
    }
    return map;
  }, [board.lists, filter, orderBy]);

  const filterCount = useMemo(() => countActiveFilters(filter), [filter]);

  const dragColumns = useMemo(
    () =>
      board.lists.map((list) => ({
        listId: list.id,
        title: list.title,
        count: visibleByList.get(list.id)?.length ?? 0,
      })),
    [board.lists, visibleByList],
  );

  const handleDrop = useCallback(
    (cardId: string, slot: DragSlot) => {
      const list = board.lists.find((entry) => entry.id === slot.listId);
      if (!list) return;

      /*
       * The slot is counted over *visible* cards, but the position the server is
       * given has to be an index into the whole column — so the visible card at
       * that slot is used as an anchor into the real list.
       */
      const visible = (visibleByList.get(slot.listId) ?? []).filter(
        (card) => card.id !== cardId,
      );
      const remaining = list.cards.filter((card) => card.id !== cardId);

      let toIndex = remaining.length;
      if (slot.index < visible.length) {
        const anchor = remaining.findIndex(
          (card) => card.id === visible[slot.index].id,
        );
        if (anchor !== -1) toIndex = anchor;
      }

      dispatch({ type: 'card/move', cardId, toListId: slot.listId, toIndex });
    },
    [board.lists, dispatch, visibleByList],
  );

  const handleColumnDrop = useCallback(
    (listId: string, toIndex: number) => {
      dispatch({ type: 'list/move', listId, toIndex });
    },
    [dispatch],
  );

  const drag = useBoardDrag({
    columns: dragColumns,
    scrollerRef,
    onDrop: handleDrop,
    onColumnDrop: handleColumnDrop,
  });
  const pan = useBoardPan(
    scrollerRef,
    Boolean(drag.activeCardId || drag.activeListId),
  );

  return (
    <div className="group/board min-h-128 pt-4 flex h-full flex-col overflow-hidden text-foreground">
      {/* Board Filter Controls & AI Overlay */}
      <div className="mb-2 px-4 sm:px-6 space-y-2 empty:mb-0 relative shrink-0">
        {/* AI Filter Input Prompt Overlay Bar */}
        {showAIFilterInput && (
          <SmartFilterBar
            workspaceId={workspaceId}
            filter={filter}
            setFilter={setFilter}
            statuses={smartStatuses}
            members={smartMembers}
            milestones={milestones}
            onClose={() => setShowAIFilterInput(false)}
          />
        )}

        {/* Active filters — one chip per facet, each clearable on its own. */}
        {filterCount > 0 || filter.aiSummary ? (
          <div className="gap-1.5 flex flex-wrap items-center">
            {filter.aiSummary ? (
              <FilterChip
                tone="smart"
                icon={<Sparkles className="size-3.5" />}
                title={filter.aiPrompt}
                label={filter.aiSummary}
                onClear={() =>
                  setFilter((prev) => ({ ...EMPTY_FILTER, query: prev.query }))
                }
              />
            ) : null}
            {filter.query ? (
              <FilterChip
                label={`Search: “${filter.query}”`}
                onClear={() => setFilter((prev) => ({ ...prev, query: '' }))}
              />
            ) : null}
            {filter.aiQuery ? (
              <FilterChip
                label={`Mentions: ${filter.aiQuery.split(/\s+/).join(', ')}`}
                onClear={() => setFilter((prev) => ({ ...prev, aiQuery: '' }))}
              />
            ) : null}
            {filter.status.length > 0 ? (
              <FilterChip
                label={`Status: ${namesFor(filter.status, smartStatuses)}`}
                onClear={() => setFilter((prev) => ({ ...prev, status: [] }))}
              />
            ) : null}
            {filter.priorities.length > 0 ? (
              <FilterChip
                label={`Priority: ${filter.priorities
                  .map((p) => p.charAt(0) + p.slice(1).toLowerCase())
                  .join(', ')}`}
                onClear={() =>
                  setFilter((prev) => ({ ...prev, priorities: [] }))
                }
              />
            ) : null}
            {filter.memberIds.length > 0 ? (
              <FilterChip
                label={`Assignee: ${namesFor(filter.memberIds, smartMembers)}`}
                onClear={() => setFilter((prev) => ({ ...prev, memberIds: [] }))}
              />
            ) : null}
            {filter.milestones.length > 0 ? (
              <FilterChip
                label={`Milestone: ${filter.milestones.join(', ')}`}
                onClear={() =>
                  setFilter((prev) => ({ ...prev, milestones: [] }))
                }
              />
            ) : null}
            {filter.due !== 'any' ? (
              <FilterChip
                label={DUE_LABELS[filter.due]}
                onClear={() => setFilter((prev) => ({ ...prev, due: 'any' }))}
              />
            ) : null}
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={() => setFilter(EMPTY_FILTER)}
            >
              Clear all
            </Button>
          </div>
        ) : null}

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
        <div className="gap-1 px-3 sm:px-4 pb-3 flex flex-1 items-start overflow-hidden">
          {[0, 1, 2, 3].map((column) => (
            <div
              key={column}
              className="sm:w-80 md:w-84 xl:w-[320px] 2xl:w-[340px] p-3 w-[85vw] shrink-0 rounded-xl border border-border bg-surface-muted"
            >
              <SkeletonList rows={3} />
            </div>
          ))}
        </div>
      ) : (
        <div
          ref={scrollerRef}
          onPointerDown={pan.onPointerDown}
          // Blank space pans the board; `data-panning` is set while it does.
          className="scrollbar-subtle gap-1 px-3 sm:px-4 pb-3 scroll-px-3 sm:scroll-px-4min-h-0 relative flex flex-1 cursor-grab items-stretch overflow-x-auto overflow-y-hidden data-panning:cursor-grabbing data-panning:select-none"
        >
          {board.lists.map((list, index) => (
            <KanbanListColumn
              key={list.id}
              list={list}
              lists={board.lists}
              members={board.members}
              visibleCards={visibleByList.get(list.id) ?? []}
              hiddenCount={
                list.cards.length - (visibleByList.get(list.id) ?? []).length
              }
              dispatch={dispatch}
              drag={drag}
              index={index}
              onOpenCard={setOpenCardId}
              currentUserId={currentUser?.id}
              onConvertCardToDoc={convertTaskToDoc}
            />
          ))}

          {/*
            The gap a lifted column is holding open, the row's counterpart to
            the one each column keeps for cards. Out of flow, so the flex row
            never sees it, and positioned against the scroller — which means it
            scrolls with the columns rather than floating over them.
          */}
          <div
            data-kanban-column-placeholder
            aria-hidden
            hidden
            className="left-0 top-0 pointer-events-none absolute rounded-xl border-2 border-dashed border-primary/40 bg-primary/5"
          />
        </div>
      )}

      {/* Keyboard dragging: the instructions each tile points at, and what the
          card just did, for anyone who cannot see the placeholder move. */}
      <p id="kanban-drag-help" className="sr-only">
        Press space to pick this up, the arrow keys to move it, space again to
        drop it, and escape to cancel.
      </p>
      <p aria-live="assertive" role="status" className="sr-only">
        {drag.announcement}
      </p>

      {/* Card Details Dialog */}
      {openCardId ? (
        <CardDetailsDialog
          workspaceId={workspaceId}
          projectId={projectId}
          cardId={openCardId}
          board={board}
          dispatch={dispatch}
          onOpenCard={setOpenCardId}
          onClose={() => setOpenCardId(null)}
        />
      ) : null}
    </div>
  );
}
