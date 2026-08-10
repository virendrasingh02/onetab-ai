import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Input,
  Textarea,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  ArrowDownUp,
  ArrowLeft,
  ArrowRight,
  CornerUpRight,
  Eraser,
  MoreHorizontal,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type Ref,
} from 'react';
import type { BoardAction } from './board-state.js';
import { KanbanCardTile } from './KanbanCardTile.js';
import type {
  BoardLabel,
  BoardMember,
  KanbanCard,
  KanbanList,
  SortKey,
} from './types.js';

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'due', label: 'Due date' },
  { key: 'priority', label: 'Priority' },
  { key: 'title', label: 'Card title' },
  { key: 'created', label: 'Newest first' },
];

export interface KanbanListColumnProps {
  list: KanbanList;
  lists: KanbanList[];
  labels: BoardLabel[];
  members: BoardMember[];
  /** Cards surviving the board filter, in list order. */
  visibleCards: KanbanCard[];
  /** How many of this list's cards the filter is holding back. */
  hiddenCount: number;
  index: number;
  showLabelText: boolean;
  dispatch: (action: BoardAction) => void;

  /** Id of the card currently being dragged, board-wide. */
  draggingCardId?: string;
  /**
   * Same card, but only once the browser has taken its drag image — that is
   * the frame it becomes safe to collapse the original out of the layout.
   */
  liftedCardId?: string;
  /**
   * True when this column has been picked up. Like a lifted card it collapses
   * out of the row — leaving it in place would widen the board by one column
   * and shift the very midpoints the drop index is measured against.
   */
  liftedList: boolean;
  /** Placeholder position, counted over the cards that are *not* being dragged. */
  dropIndex?: number;
  /** Height of the lifted card, so the placeholder matches its footprint. */
  dropHeight: number;

  onOpenCard: (cardId: string) => void;
  onCardDragStart: (event: DragEvent<HTMLLIElement>, card: KanbanCard) => void;
  onCardDragEnd: () => void;
  onCardDragOver: (listId: string, visualIndex: number) => void;
  onCardDrop: (listId: string, visualIndex: number) => void;
  onListDragStart: (event: DragEvent<HTMLElement>, listId: string) => void;
  onListDragEnd: () => void;
}

export function KanbanListColumn({
  list,
  lists,
  labels,
  members,
  visibleCards,
  hiddenCount,
  index,
  showLabelText,
  dispatch,
  draggingCardId,
  liftedCardId,
  liftedList,
  dropIndex,
  dropHeight,
  onOpenCard,
  onCardDragStart,
  onCardDragEnd,
  onCardDragOver,
  onCardDrop,
  onListDragStart,
  onListDragEnd,
}: KanbanListColumnProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const cardsRef = useRef<HTMLUListElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const [renaming, setRenaming] = useState(false);
  const [composer, setComposer] = useState<'top' | 'bottom' | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (composer) composerRef.current?.focus();
  }, [composer]);

  const openComposer = (edge: 'top' | 'bottom') => {
    setDraft('');
    setComposer(edge);
  };

  const submitDraft = () => {
    const title = draft.trim();
    if (!title) return;
    dispatch({
      type: 'card/add',
      listId: list.id,
      title,
      edge: composer ?? 'bottom',
    });
    setDraft('');
    // Trello keeps the composer open so a burst of cards can be typed straight
    // through; the newest card is scrolled into view at the bottom.
    if (composer === 'bottom') {
      requestAnimationFrame(() => {
        const node = cardsRef.current;
        if (node) node.scrollTop = node.scrollHeight;
      });
    }
    composerRef.current?.focus();
  };

  const handleComposerKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitDraft();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      setComposer(null);
    }
  };

  /**
   * Insertion point for the lifted card: the first visible card whose vertical
   * midpoint sits below the pointer. The dragged card is skipped so the index
   * is already relative to the list without it.
   */
  const resolveVisualIndex = (clientY: number): number => {
    const container = cardsRef.current;
    if (!container) return visibleCards.length;

    const tiles = Array.from(
      container.querySelectorAll<HTMLElement>('[data-kanban-card]'),
    ).filter((tile) => tile.dataset.kanbanCard !== draggingCardId);

    for (let i = 0; i < tiles.length; i += 1) {
      const rect = tiles[i].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return i;
    }
    return tiles.length;
  };

  const handleDragOver = (event: DragEvent<HTMLElement>) => {
    if (!draggingCardId) return;
    // Claiming the drag here is what makes the column a valid drop target.
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    onCardDragOver(list.id, resolveVisualIndex(event.clientY));
  };

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    if (!draggingCardId) return;
    event.preventDefault();
    onCardDrop(list.id, resolveVisualIndex(event.clientY));
  };

  const commitRename = (value: string) => {
    const title = value.trim();
    if (title) dispatch({ type: 'list/rename', listId: list.id, title });
    setRenaming(false);
  };

  const otherLists = lists.filter((other) => other.id !== list.id);
  const placeholder =
    draggingCardId && dropIndex !== undefined ? dropIndex : undefined;

  const renderPlaceholder = (key: string) => (
    <li
      key={key}
      aria-hidden
      style={{ height: dropHeight }}
      className="rounded-lg border-2 border-dashed border-primary/40 bg-primary/5"
    />
  );

  /** Cards still sitting in the list, i.e. everything except the lifted one. */
  let stationary = 0;
  const stationaryCount = visibleCards.filter(
    (card) => card.id !== liftedCardId,
  ).length;

  return (
    <section
      ref={sectionRef}
      data-kanban-list={list.id}
      aria-label={list.title}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={cn(
        'w-[82vw] sm:w-72 flex max-h-full shrink-0 flex-col rounded-xl border bg-surface-muted',
        'transition-[box-shadow] duration-(--duration-fast)',
        liftedList && 'hidden',
        placeholder !== undefined && 'ring-2 ring-primary/25',
      )}
    >
      <header
        draggable={!renaming}
        onDragStart={(event) => onListDragStart(event, list.id)}
        onDragEnd={onListDragEnd}
        className={cn(
          'gap-1.5 px-3 py-2 flex items-center justify-between rounded-t-xl bg-surface/40 border-b border-border/40',
          !renaming && 'cursor-grab active:cursor-grabbing',
        )}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Linear Status Column Icon */}
          {list.title.toLowerCase().includes('backlog') ? (
            <span className="size-3.5 rounded-full border-2 border-dashed border-accent-amber/30 shrink-0" />
          ) : list.title.toLowerCase().includes('planned') ? (
            <span className="size-3.5 rounded-full border-2 border-muted-foreground/60 shrink-0" />
          ) : list.title.toLowerCase().includes('progress') ? (
            <span className="size-3.5 rounded-full border-2 border-accent-amber/30 bg-accent-amber-soft shrink-0" />
          ) : list.title.toLowerCase().includes('completed') || list.title.toLowerCase().includes('done') ? (
            <span className="size-3.5 rounded-full bg-accent-blue dark:bg-accent-blue text-white flex items-center justify-center shrink-0 font-bold text-[9px]">
              ✓
            </span>
          ) : (
            <span className="size-3.5 rounded-full border-2 border-primary/60 shrink-0" />
          )}

          {renaming ? (
            <Input
              autoFocus
              defaultValue={list.title}
              aria-label="List name"
              className="h-7 px-2 text-xs font-semibold"
              onBlur={(event) => commitRename(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter')
                  commitRename(event.currentTarget.value);
                if (event.key === 'Escape') setRenaming(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setRenaming(true)}
              title="Rename list"
              className={cn(
                'min-w-0 py-0.5 rounded text-xs font-semibold flex-1 truncate text-left text-foreground',
                'hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
              )}
            >
              {list.title}
            </button>
          )}

          <span className="text-xs font-medium text-muted-foreground/70 tabular-nums">
            {list.cards.length}
          </span>
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => openComposer('bottom')}
            className="size-6 text-muted-foreground hover:text-foreground"
            title="Add card"
          >
            <Plus className="size-3.5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-6 text-muted-foreground hover:text-foreground"
                aria-label={`Actions for list “${list.title}”`}
              >
                <MoreHorizontal className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>List actions</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => openComposer('top')}>
              <Plus />
              Add card
            </DropdownMenuItem>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <ArrowDownUp />
                Sort by
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="w-44">
                  {SORT_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.key}
                      onSelect={() =>
                        dispatch({
                          type: 'list/sort',
                          listId: list.id,
                          by: option.key,
                        })
                      }
                    >
                      {option.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <CornerUpRight />
                Move all cards to
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="w-44">
                  {otherLists.length === 0 ? (
                    <DropdownMenuItem disabled>No other lists</DropdownMenuItem>
                  ) : (
                    otherLists.map((target) => (
                      <DropdownMenuItem
                        key={target.id}
                        disabled={list.cards.length === 0}
                        onSelect={() =>
                          dispatch({
                            type: 'list/moveAll',
                            fromListId: list.id,
                            toListId: target.id,
                          })
                        }
                      >
                        {target.title}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              disabled={index === 0}
              onSelect={() =>
                dispatch({
                  type: 'list/move',
                  listId: list.id,
                  toIndex: index - 1,
                })
              }
            >
              <ArrowLeft />
              Move list left
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={index === lists.length - 1}
              onSelect={() =>
                dispatch({
                  type: 'list/move',
                  listId: list.id,
                  toIndex: index + 1,
                })
              }
            >
              <ArrowRight />
              Move list right
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem
              disabled={list.cards.length === 0}
              onSelect={() => dispatch({ type: 'list/clear', listId: list.id })}
            >
              <Eraser />
              Remove all cards
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onSelect={() =>
                dispatch({ type: 'list/remove', listId: list.id })
              }
            >
              <Trash2 />
              Delete list
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </header>

      {composer === 'top' ? (
        <CardComposer
          ref={composerRef}
          value={draft}
          onChange={setDraft}
          onSubmit={submitDraft}
          onClose={() => setComposer(null)}
          onKeyDown={handleComposerKeyDown}
        />
      ) : null}

      <ul
        ref={cardsRef}
        className="scrollbar-subtle px-2 pb-1 space-y-2 min-h-6 flex-1 overflow-y-auto"
      >
        {stationaryCount === 0 && placeholder === undefined ? (
          <li className="px-2 py-6 text-xs text-center text-muted-foreground">
            {hiddenCount > 0
              ? `${hiddenCount} card${hiddenCount === 1 ? '' : 's'} hidden by filters`
              : 'Drop a card here'}
          </li>
        ) : null}

        {visibleCards.map((card) => {
          // The lifted card keeps its slot in the DOM — collapsing it instead
          // of unmounting it is what keeps `dragend` firing — but it is skipped
          // when counting, so the placeholder lands on the real insertion point.
          const lifted = card.id === liftedCardId;
          const placeholderHere =
            placeholder !== undefined && !lifted && stationary === placeholder;
          if (!lifted) stationary += 1;

          return (
            <Fragment key={card.id}>
              {placeholderHere ? renderPlaceholder(`ph-${card.id}`) : null}
              <KanbanCardTile
                card={card}
                labels={labels}
                members={members}
                lists={lists}
                listId={list.id}
                lifted={lifted}
                showLabelText={showLabelText}
                onOpen={() => onOpenCard(card.id)}
                onCopy={() => dispatch({ type: 'card/copy', cardId: card.id })}
                onDelete={() =>
                  dispatch({ type: 'card/remove', cardId: card.id })
                }
                onMoveToList={(toListId) =>
                  dispatch({
                    type: 'card/move',
                    cardId: card.id,
                    toListId,
                    toIndex: Number.MAX_SAFE_INTEGER,
                  })
                }
                onDragStart={(event) => onCardDragStart(event, card)}
                onDragEnd={onCardDragEnd}
              />
            </Fragment>
          );
        })}

        {placeholder !== undefined && placeholder >= stationary
          ? renderPlaceholder('ph-end')
          : null}

        {hiddenCount > 0 && stationaryCount > 0 ? (
          <li className="pt-1 pb-1 text-center text-[11px] text-muted-foreground">
            {hiddenCount} hidden by filters
          </li>
        ) : null}
      </ul>

      {composer === 'bottom' ? (
        <CardComposer
          ref={composerRef}
          value={draft}
          onChange={setDraft}
          onSubmit={submitDraft}
          onClose={() => setComposer(null)}
          onKeyDown={handleComposerKeyDown}
        />
      ) : composer === null ? (
        <div className="p-2">
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Plus />}
            onClick={() => openComposer('bottom')}
            className="w-full justify-start text-muted-foreground"
          >
            Add a card
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------ composer --- */

interface CardComposerProps {
  ref: Ref<HTMLTextAreaElement>;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  onKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
}

function CardComposer({
  ref,
  value,
  onChange,
  onSubmit,
  onClose,
  onKeyDown,
}: CardComposerProps) {
  return (
    <div className="p-2 space-y-2">
      <Textarea
        ref={ref}
        rows={2}
        value={value}
        placeholder="Enter a title…"
        aria-label="Card title"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        className="text-sm shadow-xs bg-surface"
      />
      <div className="gap-2 flex items-center">
        <Button size="sm" onClick={onSubmit} disabled={!value.trim()}>
          Add card
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Cancel adding a card"
        >
          <X />
        </Button>
      </div>
    </div>
  );
}
