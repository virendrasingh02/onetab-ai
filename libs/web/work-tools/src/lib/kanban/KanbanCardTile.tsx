import {
  accentClasses,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  UserAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  AlignLeft,
  CheckSquare,
  Clock,
  Copy,
  CornerUpRight,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { DragEvent } from 'react';
import {
  checklistProgress,
  describeDue,
  DUE_TONE_CLASSES,
  PRIORITY_META,
} from './card-meta.js';
import type { BoardLabel, BoardMember, KanbanCard } from './types.js';

export interface KanbanCardTileProps {
  card: KanbanCard;
  labels: BoardLabel[];
  members: BoardMember[];
  lists: Array<{ id: string; title: string }>;
  listId: string;
  /**
   * True once this card has been picked up. The tile collapses out of the
   * layout so the drop placeholder can take its place, exactly one card tall.
   */
  lifted: boolean;
  /** Trello's label toggle: colour chips collapse to bars when off. */
  showLabelText: boolean;
  onOpen: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onMoveToList: (toListId: string) => void;
  onDragStart: (event: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
}

export function KanbanCardTile({
  card,
  labels,
  members,
  lists,
  listId,
  lifted,
  showLabelText,
  onOpen,
  onCopy,
  onDelete,
  onMoveToList,
  onDragStart,
  onDragEnd,
}: KanbanCardTileProps) {
  const cardLabels = card.labelIds
    .map((id) => labels.find((label) => label.id === id))
    .filter((label): label is BoardLabel => Boolean(label));

  const cardMembers = card.memberIds
    .map((id) => members.find((member) => member.id === id))
    .filter((member): member is BoardMember => Boolean(member));

  const due = describeDue(card);
  const checklist = checklistProgress(card);
  const priority = PRIORITY_META[card.priority];

  return (
    <li
      data-kanban-card={card.id}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={cn(
        'group/card p-2.5 relative cursor-grab list-none rounded-lg border bg-surface',
        'shadow-xs transition-[border-color,box-shadow,opacity] duration-(--duration-fast)',
        'hover:border-border-strong hover:shadow-elevated',
        'has-[:focus-visible]:border-ring has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/30',
        lifted && 'hidden',
      )}
    >
      {cardLabels.length > 0 ? (
        <ul className="mb-2 gap-1 flex flex-wrap">
          {cardLabels.map((label) => (
            <li
              key={label.id}
              title={label.name}
              className={cn(
                'font-semibold rounded-full text-[10px] leading-none',
                accentClasses[label.color].soft,
                showLabelText ? 'px-2 py-1' : 'h-2 w-9 overflow-hidden',
              )}
            >
              {showLabelText ? (
                label.name
              ) : (
                <span className="sr-only">{label.name}</span>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {/*
        The title button is the card's click target: `after:inset-0` stretches
        it over the whole tile, so the accessible name stays the card title
        instead of wrapping every badge inside one giant button.
      */}
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'text-sm font-medium leading-snug text-left text-foreground outline-none',
          'after:inset-0 after:absolute after:rounded-lg',
        )}
      >
        {card.title}
      </button>

      {(due ||
        card.description ||
        checklist.total > 0 ||
        card.comments.length > 0) && (
        <div className="mt-2 gap-1.5 flex flex-wrap items-center text-[11px] text-muted-foreground">
          {due ? (
            <span
              title={due.hint}
              className={cn(
                'gap-1 px-1.5 py-0.5 rounded font-medium flex items-center border',
                DUE_TONE_CLASSES[due.tone],
              )}
            >
              <Clock className="size-3" aria-hidden />
              {due.label}
              <span className="sr-only">{due.hint}</span>
            </span>
          ) : null}

          {card.description ? (
            <span title="This card has a description">
              <AlignLeft className="size-3.5" aria-hidden />
              <span className="sr-only">Has a description</span>
            </span>
          ) : null}

          {checklist.total > 0 ? (
            <span
              className={cn(
                'gap-1 px-1 py-0.5 rounded font-medium flex items-center tabular-nums',
                checklist.complete && 'bg-accent-green-soft text-accent-green',
              )}
              title={`Checklist ${checklist.done} of ${checklist.total} complete`}
            >
              <CheckSquare className="size-3.5" aria-hidden />
              {checklist.done}/{checklist.total}
            </span>
          ) : null}

          {card.comments.length > 0 ? (
            <span
              className="gap-1 flex items-center tabular-nums"
              title={`${card.comments.length} comments`}
            >
              <MessageSquare className="size-3.5" aria-hidden />
              {card.comments.length}
            </span>
          ) : null}
        </div>
      )}

      <div className="mt-2 gap-2 flex items-center justify-between">
        <span
          className="gap-1.5 flex items-center text-[11px] text-muted-foreground"
          title={`${priority.label} priority`}
        >
          <span
            className={cn('size-1.5 rounded-full', priority.dot)}
            aria-hidden
          />
          {priority.label}
        </span>

        {cardMembers.length > 0 ? (
          <ul className="-space-x-1.5 flex">
            {cardMembers.slice(0, 3).map((member) => (
              <li key={member.id} title={member.name}>
                <UserAvatar
                  name={member.name}
                  seed={member.id}
                  src={member.avatarUrl}
                  size="xs"
                  className="ring-2 ring-surface"
                />
              </li>
            ))}
            {cardMembers.length > 3 ? (
              <li
                className="size-5 font-medium flex items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground ring-2 ring-surface"
                title={cardMembers
                  .slice(3)
                  .map((member) => member.name)
                  .join(', ')}
              >
                +{cardMembers.length - 3}
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>

      {/*
        Sits above the stretched title overlay, and is the keyboard-reachable
        route to every move that drag-and-drop offers with a pointer.
      */}
      <div className="right-1.5 top-1.5 absolute z-10">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className={cn(
                'size-6 backdrop-blur-sm bg-surface/80 opacity-0',
                'group-hover/card:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100',
              )}
              aria-label={`Actions for “${card.title}”`}
            >
              <MoreHorizontal className="size-3.5" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={onOpen}>
              <Pencil />
              Open card
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onCopy}>
              <Copy />
              Copy card
            </DropdownMenuItem>

            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <CornerUpRight />
                Move to
              </DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent className="w-44">
                  {lists.map((list) => (
                    <DropdownMenuItem
                      key={list.id}
                      disabled={list.id === listId}
                      onSelect={() => onMoveToList(list.id)}
                    >
                      {list.title}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>

            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 />
              Delete card
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  );
}
