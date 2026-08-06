import {
  accentClasses,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  Input,
  Toolbar,
  UserAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Filter,
  ListFilter,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  SquareKanban,
  Tag,
  Users,
  X,
} from 'lucide-react';
import {
  Fragment,
  useCallback,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import { useBoard } from './kanban/board-state.js';
import {
  countActiveFilters,
  EMPTY_FILTER,
  isFilterActive,
  matchesFilter,
  type BoardFilter,
  type DueFilter,
} from './kanban/card-meta.js';
import { CardDetailsDialog } from './kanban/CardDetailsDialog.js';
import { KanbanListColumn } from './kanban/KanbanListColumn.js';
import type { KanbanCard } from './kanban/types.js';

export type {
  BoardLabel,
  BoardMember,
  BoardState,
  CardComment,
  ChecklistItem,
  KanbanCard,
  KanbanList,
  Priority,
  TaskItem,
} from './kanban/types.js';

/** What the pointer is currently carrying. */
type DragState =
  | { kind: 'card'; cardId: string; height: number }
  | { kind: 'list'; listId: string };

const DUE_FILTERS: Array<{ value: DueFilter; label: string }> = [
  { value: 'any', label: 'Any due date' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'week', label: 'Due in the next week' },
  { value: 'none', label: 'No due date' },
];

/** How close to the board edge a drag has to get before it scrolls. */
const EDGE_ZONE = 96;
const EDGE_SPEED = 22;

export function KanbanBoard() {
  const [board, dispatch] = useBoard();

  const [filter, setFilter] = useState<BoardFilter>(EMPTY_FILTER);
  const [showLabelText, setShowLabelText] = useState(true);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [renamingBoard, setRenamingBoard] = useState(false);
  const [addingList, setAddingList] = useState(false);
  const [listDraft, setListDraft] = useState('');

  const [drag, setDrag] = useState<DragState | null>(null);
  const [liftedCardId, setLiftedCardId] = useState<string | null>(null);
  const [liftedListId, setLiftedListId] = useState<string | null>(null);
  const [cardDrop, setCardDrop] = useState<{
    listId: string;
    index: number;
  } | null>(null);
  const [listDropIndex, setListDropIndex] = useState<number | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);

  /* --------------------------------------------------------- filtering --- */

  const visibleByList = useMemo(() => {
    const map = new Map<string, KanbanCard[]>();
    for (const list of board.lists) {
      map.set(
        list.id,
        list.cards.filter((card) => matchesFilter(card, filter, board.labels)),
      );
    }
    return map;
  }, [board.lists, board.labels, filter]);

  const totals = useMemo(() => {
    const all = board.lists.reduce((sum, list) => sum + list.cards.length, 0);
    let shown = 0;
    for (const cards of visibleByList.values()) shown += cards.length;
    return { all, shown };
  }, [board.lists, visibleByList]);

  const filterActive = isFilterActive(filter);
  const filterCount = countActiveFilters(filter);

  const toggleFilterId = (key: 'labelIds' | 'memberIds', id: string) => {
    setFilter((current) => ({
      ...current,
      [key]: current[key].includes(id)
        ? current[key].filter((value) => value !== id)
        : [...current[key], id],
    }));
  };

  /* ------------------------------------------------------------- drags --- */

  const clearDrag = useCallback(() => {
    setDrag(null);
    setLiftedCardId(null);
    setLiftedListId(null);
    setCardDrop(null);
    setListDropIndex(null);
  }, []);

  const handleCardDragStart = useCallback(
    (event: DragEvent<HTMLLIElement>, card: KanbanCard) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.id);
      setDrag({
        kind: 'card',
        cardId: card.id,
        height: event.currentTarget.getBoundingClientRect().height,
      });

      // Seed the placeholder at the card's own position. The source collapses
      // a frame from now, and without a placeholder already standing in for it
      // the whole column would jump up by one card height first.
      for (const [listId, cards] of visibleByList) {
        const at = cards.findIndex((entry) => entry.id === card.id);
        if (at !== -1) {
          setCardDrop({ listId, index: at });
          break;
        }
      }

      // Deferred a frame: the browser snapshots the drag image at the end of
      // this event, and hiding the source before then leaves it dragging
      // nothing.
      requestAnimationFrame(() => setLiftedCardId(card.id));
    },
    [visibleByList],
  );

  const handleCardDragOver = useCallback((listId: string, index: number) => {
    // Guarded so the ~60 dragover events a second only re-render on a real move.
    setCardDrop((current) =>
      current && current.listId === listId && current.index === index
        ? current
        : { listId, index },
    );
  }, []);

  /**
   * Translates a drop position among the *visible* cards into an index in the
   * list's real card array — the two differ whenever a filter is on.
   */
  const handleCardDrop = useCallback(
    (toListId: string, visualIndex: number) => {
      if (drag?.kind !== 'card') return;

      const list = board.lists.find((entry) => entry.id === toListId);
      if (!list) return;

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

  const handleListDragStart = useCallback(
    (event: DragEvent<HTMLElement>, listId: string) => {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', listId);
      // Drag the whole column, not just the header strip the handle lives in.
      const column =
        event.currentTarget.closest<HTMLElement>('[data-kanban-list]');
      if (column) event.dataTransfer.setDragImage(column, 24, 24);
      setDrag({ kind: 'list', listId });
      // Same reasoning as a card: hold the column's own slot open from the
      // start so the board does not shift left the instant it is picked up.
      setListDropIndex(board.lists.findIndex((entry) => entry.id === listId));
      requestAnimationFrame(() => setLiftedListId(listId));
    },
    [board.lists],
  );

  const handleBoardDragOver = (event: DragEvent<HTMLDivElement>) => {
    const scroller = scrollerRef.current;
    if (!scroller || !drag) return;

    // Auto-scroll: a board wider than the viewport is otherwise undraggable.
    const rect = scroller.getBoundingClientRect();
    if (event.clientX - rect.left < EDGE_ZONE)
      scroller.scrollLeft -= EDGE_SPEED;
    else if (rect.right - event.clientX < EDGE_ZONE)
      scroller.scrollLeft += EDGE_SPEED;

    if (drag.kind !== 'list') return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const columns = Array.from(
      scroller.querySelectorAll<HTMLElement>('[data-kanban-list]'),
    ).filter((column) => column.dataset.kanbanList !== drag.listId);

    let index = columns.length;
    for (let i = 0; i < columns.length; i += 1) {
      const bounds = columns[i].getBoundingClientRect();
      if (event.clientX < bounds.left + bounds.width / 2) {
        index = i;
        break;
      }
    }
    setListDropIndex((current) => (current === index ? current : index));
  };

  const handleBoardDrop = (event: DragEvent<HTMLDivElement>) => {
    if (drag?.kind !== 'list' || listDropIndex === null) return;
    event.preventDefault();
    dispatch({
      type: 'list/move',
      listId: drag.listId,
      toIndex: listDropIndex,
    });
    clearDrag();
  };

  /* -------------------------------------------------------------- lists --- */

  const submitList = () => {
    const title = listDraft.trim();
    if (!title) return;
    dispatch({ type: 'list/add', title });
    setListDraft('');
    requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      if (scroller) scroller.scrollLeft = scroller.scrollWidth;
    });
  };

  const handleListDraftKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitList();
    }
    if (event.key === 'Escape') setAddingList(false);
  };

  // Placeholder positions are counted over the lists that stay put, matching
  // the reducer's "remove, then insert at index" move.
  let stationaryIndex = 0;

  return (
    <div className="group/board min-h-128 px-6 py-6 flex h-full flex-col overflow-hidden">
      <header className="mb-4 gap-x-4 gap-y-3 flex flex-wrap items-start justify-between">
        <div className="min-w-0 gap-3 flex items-start">
          <span
            aria-hidden
            className={cn(
              'mt-0.5 size-9 [&_svg]:size-5 flex shrink-0 items-center justify-center rounded-lg',
              accentClasses.blue.soft,
            )}
          >
            <SquareKanban />
          </span>

          <div className="min-w-0">
            {renamingBoard ? (
              <Input
                autoFocus
                defaultValue={board.title}
                aria-label="Board name"
                className="h-8 text-lg font-semibold"
                onBlur={(event) => {
                  const title = event.target.value.trim();
                  if (title) dispatch({ type: 'board/rename', title });
                  setRenamingBoard(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                  if (event.key === 'Escape') setRenamingBoard(false);
                }}
              />
            ) : (
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                <button
                  type="button"
                  onClick={() => setRenamingBoard(true)}
                  title="Rename board"
                  className="-mx-1 px-1 rounded hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  {board.title}
                </button>
              </h1>
            )}

            <p className="mt-1 text-sm text-muted-foreground">
              {board.lists.length} list{board.lists.length === 1 ? '' : 's'} ·{' '}
              <span className="tabular-nums">
                {filterActive ? `${totals.shown} of ${totals.all}` : totals.all}
              </span>{' '}
              card{totals.all === 1 ? '' : 's'}
            </p>
          </div>
        </div>

        <Toolbar aria-label="Board controls">
          <Input
            value={filter.query}
            onChange={(event) =>
              setFilter((current) => ({
                ...current,
                query: event.target.value,
              }))
            }
            placeholder="Search cards…"
            aria-label="Search cards"
            leadingIcon={<Search />}
            className="w-56"
            trailingSlot={
              filter.query ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6"
                  aria-label="Clear search"
                  onClick={() =>
                    setFilter((current) => ({ ...current, query: '' }))
                  }
                >
                  <X className="size-3.5" />
                </Button>
              ) : null
            }
          />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" leadingIcon={<Filter />}>
                Filter
                {filterCount > 0 ? (
                  <Badge variant="primary" className="ml-1 tabular-nums">
                    {filterCount}
                  </Badge>
                ) : null}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-60">
              <DropdownMenuLabel className="gap-1.5 flex items-center">
                <Tag className="size-3.5" aria-hidden />
                Labels
              </DropdownMenuLabel>
              {board.labels.map((label) => (
                <DropdownMenuCheckboxItem
                  key={label.id}
                  checked={filter.labelIds.includes(label.id)}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={() => toggleFilterId('labelIds', label.id)}
                >
                  <span
                    className={cn(
                      'size-3 rounded-sm',
                      accentClasses[label.color].bg,
                    )}
                    aria-hidden
                  />
                  {label.name}
                </DropdownMenuCheckboxItem>
              ))}

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="gap-1.5 flex items-center">
                <Users className="size-3.5" aria-hidden />
                Members
              </DropdownMenuLabel>
              {board.members.map((member) => (
                <DropdownMenuCheckboxItem
                  key={member.id}
                  checked={filter.memberIds.includes(member.id)}
                  onSelect={(event) => event.preventDefault()}
                  onCheckedChange={() => toggleFilterId('memberIds', member.id)}
                >
                  <UserAvatar name={member.name} seed={member.id} size="xs" />
                  {member.name}
                </DropdownMenuCheckboxItem>
              ))}

              <DropdownMenuSeparator />
              <DropdownMenuLabel className="gap-1.5 flex items-center">
                <ListFilter className="size-3.5" aria-hidden />
                Due date
              </DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={filter.due}
                onValueChange={(value) =>
                  setFilter((current) => ({
                    ...current,
                    due: value as DueFilter,
                  }))
                }
              >
                {DUE_FILTERS.map((option) => (
                  <DropdownMenuRadioItem
                    key={option.value}
                    value={option.value}
                    onSelect={(event) => event.preventDefault()}
                  >
                    {option.label}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>

              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!filterActive}
                onSelect={() => setFilter(EMPTY_FILTER)}
              >
                <X />
                Clear filters
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button leadingIcon={<Plus />} onClick={() => setAddingList(true)}>
            Add list
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Board menu">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Board</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => setRenamingBoard(true)}>
                Rename board
              </DropdownMenuItem>
              <DropdownMenuCheckboxItem
                checked={showLabelText}
                onCheckedChange={setShowLabelText}
              >
                Show label text
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => {
                  dispatch({ type: 'board/reset' });
                  setFilter(EMPTY_FILTER);
                }}
              >
                <RotateCcw />
                Reset to sample board
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Toolbar>
      </header>

      {filterActive ? (
        <div className="mb-3 gap-2 flex flex-wrap items-center">
          <span className="text-xs text-muted-foreground">Filtering by</span>

          {filter.query ? (
            <FilterChip
              label={`“${filter.query}”`}
              onClear={() =>
                setFilter((current) => ({ ...current, query: '' }))
              }
            />
          ) : null}

          {filter.labelIds.map((id) => {
            const label = board.labels.find((entry) => entry.id === id);
            return label ? (
              <FilterChip
                key={id}
                label={label.name}
                dot={accentClasses[label.color].bg}
                onClear={() => toggleFilterId('labelIds', id)}
              />
            ) : null;
          })}

          {filter.memberIds.map((id) => {
            const member = board.members.find((entry) => entry.id === id);
            return member ? (
              <FilterChip
                key={id}
                label={member.name}
                onClear={() => toggleFilterId('memberIds', id)}
              />
            ) : null;
          })}

          {filter.due !== 'any' ? (
            <FilterChip
              label={
                DUE_FILTERS.find((option) => option.value === filter.due)
                  ?.label ?? filter.due
              }
              onClear={() =>
                setFilter((current) => ({ ...current, due: 'any' }))
              }
            />
          ) : null}

          <Button
            variant="link"
            size="sm"
            className="h-6 px-1"
            onClick={() => setFilter(EMPTY_FILTER)}
          >
            Clear all
          </Button>
        </div>
      ) : null}

      <div
        ref={scrollerRef}
        onDragOver={handleBoardDragOver}
        onDrop={handleBoardDrop}
        className="scrollbar-subtle gap-3 pb-3 min-h-0 flex flex-1 items-start overflow-x-auto"
      >
        {board.lists.length === 0 ? (
          <EmptyState
            className="w-full"
            icon={<SquareKanban />}
            title="This board has no lists"
            description="Lists are the columns work moves through — start with something like “To do”."
            action={
              <Button
                leadingIcon={<Plus />}
                onClick={() => setAddingList(true)}
              >
                Add a list
              </Button>
            }
          />
        ) : null}

        {board.lists.map((list, index) => {
          const isDragged = drag?.kind === 'list' && drag.listId === list.id;
          const placeholderBefore =
            listDropIndex !== null &&
            !isDragged &&
            stationaryIndex === listDropIndex;
          if (!isDragged) stationaryIndex += 1;

          const visible = visibleByList.get(list.id) ?? [];

          return (
            <Fragment key={list.id}>
              {placeholderBefore ? <ListDropPlaceholder /> : null}

              <KanbanListColumn
                list={list}
                lists={board.lists}
                labels={board.labels}
                members={board.members}
                visibleCards={visible}
                hiddenCount={list.cards.length - visible.length}
                index={index}
                showLabelText={showLabelText}
                dispatch={dispatch}
                draggingCardId={drag?.kind === 'card' ? drag.cardId : undefined}
                liftedCardId={liftedCardId ?? undefined}
                liftedList={liftedListId === list.id}
                dropIndex={
                  cardDrop && cardDrop.listId === list.id
                    ? cardDrop.index
                    : undefined
                }
                dropHeight={drag?.kind === 'card' ? drag.height : 64}
                onOpenCard={setOpenCardId}
                onCardDragStart={handleCardDragStart}
                onCardDragEnd={clearDrag}
                onCardDragOver={handleCardDragOver}
                onCardDrop={handleCardDrop}
                onListDragStart={handleListDragStart}
                onListDragEnd={clearDrag}
              />
            </Fragment>
          );
        })}

        {listDropIndex !== null && listDropIndex >= stationaryIndex ? (
          <ListDropPlaceholder />
        ) : null}

        {/* The trailing "add list" column, exactly where Trello puts it. */}
        <div className="w-72 shrink-0">
          {addingList ? (
            <div className="p-2 space-y-2 rounded-xl border bg-surface-muted">
              <Input
                autoFocus
                value={listDraft}
                placeholder="Enter list name…"
                aria-label="List name"
                onChange={(event) => setListDraft(event.target.value)}
                onKeyDown={handleListDraftKeyDown}
                className="bg-surface"
              />
              <div className="gap-2 flex items-center">
                <Button
                  size="sm"
                  onClick={submitList}
                  disabled={!listDraft.trim()}
                >
                  Add list
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Cancel adding a list"
                  onClick={() => {
                    setAddingList(false);
                    setListDraft('');
                  }}
                >
                  <X />
                </Button>
              </div>
            </div>
          ) : board.lists.length > 0 ? (
            <Button
              variant="ghost"
              leadingIcon={<Plus />}
              onClick={() => setAddingList(true)}
              className="w-full justify-start rounded-xl border border-dashed bg-surface-muted/60 text-muted-foreground"
            >
              Add another list
            </Button>
          ) : null}
        </div>
      </div>

      <CardDetailsDialog
        board={board}
        cardId={openCardId}
        dispatch={dispatch}
        onClose={() => setOpenCardId(null)}
      />
    </div>
  );
}

/* --------------------------------------------------------------- parts --- */

function ListDropPlaceholder() {
  return (
    <div
      aria-hidden
      className="w-72 h-24 shrink-0 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5"
    />
  );
}

interface FilterChipProps {
  label: string;
  dot?: string;
  onClear: () => void;
}

function FilterChip({ label, dot, onClear }: FilterChipProps) {
  return (
    <span className="gap-1.5 py-0.5 pr-1 pl-2 text-xs flex items-center rounded-full border bg-surface">
      {dot ? (
        <span className={cn('size-2 rounded-full', dot)} aria-hidden />
      ) : null}
      <span className="max-w-40 truncate">{label}</span>
      <button
        type="button"
        onClick={onClear}
        aria-label={`Remove filter ${label}`}
        className="size-4 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}
