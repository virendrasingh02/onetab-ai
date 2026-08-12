import {
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
  Clock,
  Copy,
  CornerUpRight,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react';
import type { DragEvent } from 'react';
import { describeDue, DUE_TONE_CLASSES, PRIORITY_META } from './card-meta.js';
import type { BoardMember, KanbanCard, KanbanList } from './types.js';

export interface KanbanCardTileProps {
  card: KanbanCard;
  members: BoardMember[];
  lists: Array<Pick<KanbanList, 'id' | 'title'>>;
  listId: string;
  /**
   * True once this card has been picked up. The tile collapses out of the
   * layout so the drop placeholder can take its place, exactly one card tall.
   */
  lifted: boolean;
  onOpen: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onMoveToList: (toListId: KanbanList['id']) => void;
  onDragStart: (event: DragEvent<HTMLLIElement>) => void;
  onDragEnd: () => void;
}

export function KanbanCardTile({
  card,
  members,
  lists,
  listId,
  lifted,
  onOpen,
  onCopy,
  onDelete,
  onMoveToList,
  onDragStart,
  onDragEnd,
}: KanbanCardTileProps) {
  const assignees = card.memberIds
    .map((id) => members.find((member) => member.id === id))
    .filter((member): member is BoardMember => Boolean(member));

  const due = describeDue(card);
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
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'text-xs font-semibold leading-snug text-left text-foreground outline-none hover:text-primary transition-colors',
          'after:inset-0 after:absolute after:rounded-lg',
        )}
      >
        {card.title}
      </button>

      {card.milestone ? (
        <div className="mt-1 truncate text-[11px] font-medium text-muted-foreground/80">
          {card.milestone}
        </div>
      ) : null}

      {/* Date badge, comment count, priority signal, and assignee avatar */}
      <div className="mt-2.5 flex items-center justify-between pt-1 text-[11px]">
        <div className="flex items-center gap-1.5">
          {due ? (
            <span
              title={due.hint}
              className={cn(
                'gap-1 px-1.5 py-0.5 rounded border font-medium flex items-center text-[10px]',
                DUE_TONE_CLASSES[due.tone],
              )}
            >
              <Clock className="size-3 shrink-0" aria-hidden />
              <span>{due.label}</span>
            </span>
          ) : null}

          {card.commentCount > 0 ? (
            <span
              title={`${card.commentCount} comment${card.commentCount === 1 ? '' : 's'}`}
              className="gap-1 flex items-center text-[10px] text-muted-foreground"
            >
              <MessageSquare className="size-3 shrink-0" aria-hidden />
              <span className="tabular-nums">{card.commentCount}</span>
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <span
            className="flex items-center gap-1 text-[10px] text-muted-foreground"
            title={`${priority.label} priority`}
          >
            <span className={cn('size-1.5 rounded-full', priority.dot)} />
          </span>

          {assignees.length > 0 ? (
            <div className="flex items-center -space-x-1">
              {assignees.map((member) => (
                <UserAvatar
                  key={member.id}
                  name={member.name}
                  seed={member.id}
                  src={member.avatarUrl}
                  size="xs"
                  className="size-5 text-[9px] font-bold ring-1 ring-surface"
                />
              ))}
            </div>
          ) : null}
        </div>
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
