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
  ScrollArea,
  Textarea,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  ArrowDownUp,
  CornerUpRight,
  Eraser,
  MoreHorizontal,
  Plus,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type Ref } from 'react';
import { KanbanCardTile } from './KanbanCardTile.js';
import { StatusIcon } from './kanban-icons.js';
import type { BoardAction } from './server-board.js';
import type { BoardMember, KanbanCard, KanbanList, SortKey } from './types.js';
import type { BoardDrag } from './use-board-drag.js';

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'due', label: 'Due date' },
  { key: 'priority', label: 'Priority' },
  { key: 'title', label: 'Card title' },
  { key: 'created', label: 'Newest first' },
];

export interface KanbanListColumnProps {
  list: KanbanList;
  lists: KanbanList[];
  members: BoardMember[];
  /** Cards surviving the board filter, in list order. */
  visibleCards: KanbanCard[];
  /** How many of this list's cards the filter is holding back. */
  hiddenCount: number;
  dispatch: (action: BoardAction) => void;

  /** The board's drag engine — this column registers itself with it. */
  drag: BoardDrag;
  /** This column's place in the row, which is what a column drag rewrites. */
  index: number;

  onOpenCard: (cardId: string) => void;
}

export function KanbanListColumn({
  list,
  lists,
  members,
  visibleCards,
  hiddenCount,
  dispatch,
  drag,
  index,
  onOpenCard,
}: KanbanListColumnProps) {
  const sectionRef = useRef<HTMLElement>(null);
  /** The `<ul>` — the drag engine measures the tiles inside it. */
  const cardsRef = useRef<HTMLUListElement>(null);
  /** The element that scrolls, for pinning a freshly added card into view. */
  const cardsScrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const { registerColumn } = drag;
  useEffect(() => {
    const section = sectionRef.current;
    const viewport = cardsScrollRef.current;
    const cards = cardsRef.current;
    if (!section || !viewport || !cards) return;

    registerColumn(list.id, { section, viewport, list: cards });
    return () => registerColumn(list.id, null);
  }, [list.id, registerColumn]);

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
        // The scroller is the ScrollArea's viewport, not the list itself.
        const node = cardsScrollRef.current;
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

  const otherLists = lists.filter((other) => other.id !== list.id);
  const columnDrag = drag.getColumnHandlers(list.id, index);

  return (
    <section
      ref={sectionRef}
      data-kanban-list={list.id}
      aria-label={list.title}
      hidden={drag.activeListId === list.id}
      className={cn(
        'sm:w-72 flex max-h-full w-[82vw] shrink-0 flex-col rounded-xl border bg-surface-muted',
        'transition-[box-shadow] duration-(--duration-fast)',
        // Set by the drag engine on whichever column is under the pointer.
        'data-drop-target:ring-2 data-drop-target:ring-primary/25',
      )}
    >
      {/*
        The header is the column's drag handle — the body belongs to the cards,
        which have a drag of their own. The buttons inside it opt out.
      */}
      <header
        tabIndex={0}
        aria-roledescription="Draggable column"
        aria-describedby="kanban-drag-help"
        aria-keyshortcuts="Space"
        onPointerDown={columnDrag.onPointerDown}
        onKeyDown={columnDrag.onKeyDown}
        className={cn(
          'gap-1.5 px-3 py-2 flex items-center justify-between rounded-t-xl border-b border-border/40 bg-surface/40',
          'cursor-grab touch-manipulation select-none',
          'focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none',
        )}
      >
        <div className="gap-2 min-w-0 flex flex-1 items-center">
          <StatusIcon status={list.id} />

          <h2 className="min-w-0 py-0.5 text-xs font-semibold flex-1 truncate text-foreground">
            {list.title}
          </h2>

          <span className="text-xs font-medium text-muted-foreground/70 tabular-nums">
            {list.cards.length}
          </span>
        </div>

        <div data-no-drag className="gap-0.5 flex shrink-0 items-center">
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
                      <DropdownMenuItem disabled>
                        No other lists
                      </DropdownMenuItem>
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
                variant="destructive"
                disabled={list.cards.length === 0}
                onSelect={() =>
                  dispatch({ type: 'list/clear', listId: list.id })
                }
              >
                <Eraser />
                Delete all cards
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

      <ScrollArea
        className="min-h-0 flex-1"
        viewportRef={cardsScrollRef}
        contentClassName="px-2 pb-1"
      >
        {/* `relative`: the drop placeholder is positioned against this list. */}
        <ul ref={cardsRef} className="relative min-h-6 space-y-2">
          {/*
            Keyed off the unfiltered count rather than off what is on screen: a
            card in the air still belongs to this column, and letting the empty
            state appear underneath the placeholder mid-drag would only flicker.
          */}
          {visibleCards.length === 0 ? (
            <li
              data-kanban-empty
              className="px-2 py-6 text-xs text-center text-muted-foreground"
            >
              {hiddenCount > 0
                ? `${hiddenCount} card${hiddenCount === 1 ? '' : 's'} hidden by filters`
                : 'Drop a card here'}
            </li>
          ) : null}

          {visibleCards.map((card, index) => (
            <KanbanCardTile
              key={card.id}
              card={card}
              members={members}
              lists={lists}
              listId={list.id}
              dragging={card.id === drag.activeCardId}
              drag={drag.getCardHandlers(card.id, list.id, index)}
              onOpen={() => onOpenCard(card.id)}
              onCopy={() => dispatch({ type: 'card/copy', cardId: card.id })}
              onDelete={() => dispatch({ type: 'card/remove', cardId: card.id })}
              onMoveToList={(toListId) =>
                dispatch({
                  type: 'card/move',
                  cardId: card.id,
                  toListId,
                  toIndex: Number.MAX_SAFE_INTEGER,
                })
              }
              onAssigneeChange={(memberId) =>
                dispatch({
                  type: 'card/update',
                  cardId: card.id,
                  patch: { memberIds: memberId ? [memberId] : [] },
                })
              }
              onAssigneesChange={(memberIds) =>
                dispatch({
                  type: 'card/update',
                  cardId: card.id,
                  patch: { memberIds },
                })
              }
            />
          ))}

          {/*
            The gap the lifted card is holding open.

            One element per column, mounted for the whole drag and moved with a
            transform, so sliding it from slot to slot is something CSS can
            animate — inserting and removing a node between the tiles could not
            be. Out of flow, so where it sits among its siblings does not matter;
            `mt-0!` opts it out of the list's `space-y-2`, which would otherwise
            offset it from the slot it is meant to be marking.
          */}
          <li
            data-kanban-placeholder
            aria-hidden
            hidden
            className="pointer-events-none absolute inset-x-0 top-0 mt-0! rounded-xl border-2 border-dashed border-primary/40 bg-primary/5"
          />

          {hiddenCount > 0 && visibleCards.length > 0 ? (
            <li className="pt-1 pb-1 text-center text-[11px] text-muted-foreground">
              {hiddenCount} hidden by filters
            </li>
          ) : null}
        </ul>
      </ScrollArea>

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
