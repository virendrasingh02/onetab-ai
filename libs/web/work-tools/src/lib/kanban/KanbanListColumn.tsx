import {
  Badge,
  Button,
  confirm,
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
import { WorkspacePermission } from '@org/types';
import { cn } from '@org/utils';
import { useWorkspacePermission } from '@org/web-workspace';
import { useSaveForLater } from '@org/web-chat/bookmarks';
import {
  ArrowDownUp,
  CircleDashed,
  CornerUpRight,
  Eraser,
  MoreHorizontal,
  Plus,
  X,
} from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from 'react';
import { KanbanCardTile } from './KanbanCardTile.js';
import { StatusIcon } from './kanban-icons.js';
import type { BoardAction } from './server-board.js';
import type { BoardMember, KanbanCard, KanbanList, SortKey } from './types.js';
import type { BoardDrag } from './use-board-drag.js';

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'due', label: 'Due date' },
  { key: 'priority', label: 'Priority' },
  { key: 'title', label: 'Title' },
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
  /** The signed-in user, for a card's "Assign to me". */
  currentUserId?: string;
  /** "Convert to document" for a card. */
  onConvertCardToDoc?: (card: KanbanCard) => Promise<unknown>;
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
  currentUserId,
  onConvertCardToDoc,
}: KanbanListColumnProps) {
  const { saveAction } = useSaveForLater();
  const canDelete = useWorkspacePermission().can(WorkspacePermission.DELETE);
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
        'sm:w-80 md:w-84 xl:w-[320px] 2xl:w-[340px] min-h-0 flex w-[85vw] shrink-0 flex-col rounded-xl',
        'transition-[box-shadow,background-color] duration-(--duration-fast)',
        // Set by the drag engine on whichever column is under the pointer.
        'data-drop-target:bg-surface-muted data-drop-target:ring-2 data-drop-target:ring-primary/25',
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
          'gap-2 pl-3 pr-1.5 h-10 flex shrink-0 items-center justify-between rounded-lg',
          'cursor-grab touch-manipulation select-none',
          'focus-visible:ring-[3px] focus-visible:ring-ring/30 focus-visible:outline-none',
        )}
      >
        <div className="gap-2 min-w-0 flex flex-1 items-center">
          <StatusIcon status={list.id} className="size-4 shrink-0" />

          <h2 className="min-w-0 text-sm font-semibold truncate text-foreground">
            {list.title}
          </h2>

          <Badge
            variant="neutral"
            className="min-w-5 tabular-nums"
            aria-label={`${list.cards.length} task${list.cards.length === 1 ? '' : 's'}`}
            title={
              hiddenCount > 0
                ? `${visibleCards.length} of ${list.cards.length} shown`
                : undefined
            }
          >
            {hiddenCount > 0
              ? `${visibleCards.length}/${list.cards.length}`
              : list.cards.length}
          </Badge>
        </div>

        <div data-no-drag className="gap-0.5 flex shrink-0 items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => openComposer('bottom')}
            className="size-6 text-muted-foreground hover:text-foreground"
            title="Add task"
            aria-label={`Add task to ${list.title}`}
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
                Add task at top
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
                  Move all tasks to
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

              {canDelete ? <DropdownMenuSeparator /> : null}

              {canDelete ? (
                <DropdownMenuItem
                  variant="destructive"
                  disabled={list.cards.length === 0}
                  onSelect={() => {
                    void confirm({
                      title: `Delete all ${list.cards.length} task${
                        list.cards.length === 1 ? '' : 's'
                      } in “${list.title}”?`,
                      description: "This can't be undone.",
                      confirmLabel: 'Delete all tasks',
                      destructive: true,
                    }).then((ok) => {
                      if (ok) dispatch({ type: 'list/clear', listId: list.id });
                    });
                  }}
                >
                  <Eraser />
                  Delete all tasks
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {composer === 'top' ? (
        <div className="px-2.5 pb-2.5">
          <CardComposer
            ref={composerRef}
            value={draft}
            onChange={setDraft}
            onSubmit={submitDraft}
            onClose={() => setComposer(null)}
            onKeyDown={handleComposerKeyDown}
          />
        </div>
      ) : null}

      <ScrollArea
        className="min-h-0 flex-1"
        viewportRef={cardsScrollRef}
        contentClassName="px-2.5 pt-0.5 pb-2.5"
      >
        {/* `relative`: the drop placeholder is positioned against this list. */}
        <ul ref={cardsRef} className="min-h-8 space-y-2.5 relative">
          {/*
            Keyed off the unfiltered count rather than off what is on screen: a
            card in the air still belongs to this column, and letting the empty
            state appear underneath the placeholder mid-drag would only flicker.
          */}
          {visibleCards.length === 0 ? (
            <li
              data-kanban-empty
              className={cn(
                'px-3 text-xs text-center text-muted-foreground transition-all',
                hiddenCount > 0
                  ? 'py-8 rounded-xl border border-dashed border-border/60 bg-card/20'
                  : drag.activeCardId
                    ? 'h-24 font-medium flex items-center justify-center rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 text-primary'
                    : 'h-24 gap-1 flex flex-col items-center justify-center rounded-xl border border-dashed border-border/70 text-muted-foreground',
              )}
            >
              {hiddenCount > 0 ? (
                `${hiddenCount} task${hiddenCount === 1 ? '' : 's'} hidden by filters`
              ) : drag.activeCardId ? (
                'Drop task here'
              ) : (
                <>
                  <CircleDashed className="size-4 opacity-50" />
                  <span className="text-xs font-medium">No tasks</span>
                  <span className="text-[11px] text-muted-foreground/80">
                    Drag a task here or add one
                  </span>
                </>
              )}
            </li>
          ) : null}

          {visibleCards.map((card, index) => (
            <KanbanCardTile
              key={card.id}
              card={card}
              saveAction={saveAction}
              members={members}
              lists={lists}
              listId={list.id}
              dragging={card.id === drag.activeCardId}
              drag={drag.getCardHandlers(card.id, list.id, index)}
              onOpen={() => onOpenCard(card.id)}
              onCopy={() => dispatch({ type: 'card/copy', cardId: card.id })}
              canDelete={canDelete}
              onDelete={() => {
                void confirm({
                  title: `Delete “${card.title}”?`,
                  description:
                    "The task and its details are removed. This can't be undone.",
                  confirmLabel: 'Delete task',
                  destructive: true,
                }).then((ok) => {
                  if (ok) dispatch({ type: 'card/remove', cardId: card.id });
                });
              }}
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
              onUpdate={(patch) =>
                dispatch({ type: 'card/update', cardId: card.id, patch })
              }
              currentUserId={currentUserId}
              onConvertToDoc={
                onConvertCardToDoc ? () => onConvertCardToDoc(card) : undefined
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
            className="inset-x-0 top-0 mt-0! pointer-events-none absolute rounded-xl border-2 border-dashed border-primary/40 bg-primary/5"
          />

          {hiddenCount > 0 && visibleCards.length > 0 ? (
            <li className="pt-1 pb-1 text-center text-[11px] text-muted-foreground">
              {hiddenCount} hidden by filters
            </li>
          ) : null}
        </ul>

        {/* Adding sits right under the last card, where the new one lands. */}
        {composer === 'bottom' ? (
          <div className="mt-2.5">
            <CardComposer
              ref={composerRef}
              value={draft}
              onChange={setDraft}
              onSubmit={submitDraft}
              onClose={() => setComposer(null)}
              onKeyDown={handleComposerKeyDown}
            />
          </div>
        ) : composer === null ? (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Plus className="size-3.5" />}
            onClick={() => openComposer('bottom')}
            className="mt-1.5 h-8 text-xs font-medium w-full justify-start rounded-md text-muted-foreground hover:bg-surface hover:text-foreground"
          >
            Add task
          </Button>
        ) : null}
      </ScrollArea>
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
    <div className="p-2 space-y-2 rounded-lg border border-border bg-card shadow-xs">
      <Textarea
        ref={ref}
        rows={2}
        value={value}
        placeholder="Task title"
        aria-label="Task title"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        className="min-h-14 text-sm px-1 resize-none border-0 bg-transparent shadow-none placeholder:text-muted-foreground focus-visible:ring-0"
      />
      <div className="gap-2 flex items-center justify-between">
        <Button
          size="sm"
          onClick={onSubmit}
          disabled={!value.trim()}
          className="font-medium px-3 h-8 text-xs"
        >
          Add task
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          aria-label="Cancel adding a task"
          className="size-8"
        >
          <X className="size-4" />
        </Button>
      </div>
    </div>
  );
}
