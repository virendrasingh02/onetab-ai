import {
  Button,
  DatePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SkeletonList,
  Textarea,
  UserAvatar,
} from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import {
  AlignLeft,
  CalendarDays,
  Copy,
  CornerUpRight,
  Flag,
  MessageSquare,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAddTaskComment, useTaskComments } from '../use-work-tools.js';
import {
  describeDue,
  DUE_TONE_CLASSES,
  PRIORITIES,
  PRIORITY_META,
} from './card-meta.js';
import type { BoardAction } from './server-board.js';
import type { BoardState, KanbanCard, KanbanList, Priority } from './types.js';

export interface CardDetailsDialogProps {
  workspaceId: string | undefined;
  board: BoardState;
  /** Open card, or null when the dialog is closed. */
  cardId: string | null;
  dispatch: (action: BoardAction) => void;
  onClose: () => void;
}

function findCard(
  board: BoardState,
  cardId: string,
): { list: KanbanList; card: KanbanCard } | undefined {
  for (const list of board.lists) {
    const card = list.cards.find((entry) => entry.id === cardId);
    if (card) return { list, card };
  }
  return undefined;
}

export function CardDetailsDialog({
  workspaceId,
  board,
  cardId,
  dispatch,
  onClose,
}: CardDetailsDialogProps) {
  const found = cardId ? findCard(board, cardId) : undefined;

  return (
    <Dialog
      open={Boolean(found)}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-w-3xl p-0"
        // Radix would otherwise land the caret in the title field on open,
        // which reads as "start renaming" rather than "read the card".
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          (event.currentTarget as HTMLElement | null)?.focus();
        }}
      >
        {found ? (
          <CardDetailsBody
            workspaceId={workspaceId}
            board={board}
            card={found.card}
            listId={found.list.id}
            listTitle={found.list.title}
            dispatch={dispatch}
            onClose={onClose}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/* ---------------------------------------------------------------- body --- */

interface CardDetailsBodyProps {
  workspaceId: string | undefined;
  board: BoardState;
  card: KanbanCard;
  listId: KanbanList['id'];
  listTitle: string;
  dispatch: (action: BoardAction) => void;
  onClose: () => void;
}

function CardDetailsBody({
  workspaceId,
  board,
  card,
  listId,
  listTitle,
  dispatch,
  onClose,
}: CardDetailsBodyProps) {
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(card.description);
  const [commentDraft, setCommentDraft] = useState('');

  /*
   * Comments are their own resource, not a field on the card: the board only
   * carries a count, and the thread is fetched when a card is actually opened.
   */
  const comments = useTaskComments(workspaceId, card.id);
  const addComment = useAddTaskComment(workspaceId, card.id);

  const due = describeDue(card);

  const memberName = (id: string) =>
    board.members.find((member) => member.id === id)?.name ?? 'Unknown';

  return (
    /* No scroller of its own: DialogContent scrolls its body already, and two
       nested scrollers meant two scrollbars on one card. */
    <div>
      <div className="px-6 pt-6 pb-4 border-b">
        {/*
          The dialog's accessible name has to be static text — an editable
          field as the title would rename the dialog on every keystroke — so
          the heading is visually hidden and the editor sits beside it.
        */}
        <DialogTitle className="sr-only">{card.title}</DialogTitle>
        <Textarea
          rows={1}
          defaultValue={card.title}
          aria-label="Card title"
          // Committed on blur rather than per keystroke: every change here is a
          // PATCH, and one request per character is not a rename.
          onBlur={(event) => {
            const title = event.target.value.trim();
            if (title && title !== card.title) {
              dispatch({ type: 'card/update', cardId: card.id, patch: { title } });
            }
          }}
          className="mr-10 px-1 text-base font-semibold border-transparent bg-transparent shadow-none hover:border-input focus-visible:border-ring"
        />
        <DialogDescription className="mt-1 px-1 text-xs">
          in <span className="font-medium text-foreground">{listTitle}</span>
        </DialogDescription>
      </div>

      <div className="gap-6 px-6 py-5 md:grid-cols-[minmax(0,1fr)_13rem] grid grid-cols-1">
        {/* ------------------------------------------------------- main --- */}
        <div className="space-y-6 min-w-0">
          <div className="gap-4 flex flex-wrap">
            {card.memberIds.length > 0 ? (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Assignee
                </p>
                <ul className="gap-1 flex">
                  {card.memberIds.map((id) => (
                    <li key={id} title={memberName(id)}>
                      <UserAvatar name={memberName(id)} seed={id} size="sm" />
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {due ? (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Due date
                </p>
                {/*
                  Read-only: "complete" is not a flag of its own any more, it is
                  the card sitting in a terminal column — so it changes by
                  moving the card, not by ticking the badge.
                */}
                <span
                  className={cn(
                    'gap-1.5 px-2.5 py-1 text-xs font-medium flex items-center rounded-md border',
                    DUE_TONE_CLASSES[due.tone],
                  )}
                >
                  {due.hint}
                </span>
              </div>
            ) : null}
          </div>

          {/* description */}
          <section>
            <h3 className="mb-2 gap-2 text-sm font-semibold flex items-center text-foreground">
              <AlignLeft className="size-4 text-muted-foreground" aria-hidden />
              Description
            </h3>

            {editingDescription ? (
              <div className="space-y-2">
                <Textarea
                  autoFocus
                  rows={5}
                  value={descriptionDraft}
                  aria-label="Card description"
                  placeholder="Add a more detailed description…"
                  onChange={(event) => setDescriptionDraft(event.target.value)}
                />
                <div className="gap-2 flex">
                  <Button
                    size="sm"
                    onClick={() => {
                      dispatch({
                        type: 'card/update',
                        cardId: card.id,
                        patch: { description: descriptionDraft },
                      });
                      setEditingDescription(false);
                    }}
                  >
                    Save
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDescriptionDraft(card.description);
                      setEditingDescription(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDescriptionDraft(card.description);
                  setEditingDescription(true);
                }}
                className={cn(
                  'min-h-16 px-3 py-2 text-sm w-full rounded-md border border-transparent bg-surface-muted text-left',
                  'whitespace-pre-wrap hover:border-input focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none',
                  !card.description && 'text-muted-foreground',
                )}
              >
                {card.description || 'Add a more detailed description…'}
              </button>
            )}
          </section>

          {/* activity */}
          <section>
            <h3 className="mb-2 gap-2 text-sm font-semibold flex items-center text-foreground">
              <MessageSquare
                className="size-4 text-muted-foreground"
                aria-hidden
              />
              Activity
            </h3>

            <form
              className="mb-3 space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                const content = commentDraft.trim();
                if (!content) return;
                addComment.mutate({ content });
                setCommentDraft('');
              }}
            >
              <Textarea
                rows={2}
                value={commentDraft}
                placeholder="Write a comment…"
                aria-label="New comment"
                onChange={(event) => setCommentDraft(event.target.value)}
              />
              <Button
                type="submit"
                size="sm"
                disabled={!commentDraft.trim() || addComment.isPending}
              >
                Comment
              </Button>
            </form>

            {comments.isLoading ? (
              <SkeletonList rows={2} />
            ) : (
              <ul className="space-y-3">
                {(comments.data ?? []).map((comment) => (
                  <li key={comment.id} className="gap-2 flex">
                    <UserAvatar
                      name={comment.author.displayName ?? comment.author.name}
                      seed={comment.author.id}
                      src={comment.author.avatarUrl ?? undefined}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="gap-2 text-xs flex items-baseline text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {comment.author.displayName ?? comment.author.name}
                        </span>
                        {formatRelative(comment.createdAt)}
                      </p>
                      <p className="mt-1 px-3 py-2 text-sm rounded-md border bg-surface whitespace-pre-wrap">
                        {comment.content}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* ---------------------------------------------------- sidebar --- */}
        <aside className="space-y-4">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">
              Add to card
            </p>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="subtle"
                  size="sm"
                  leadingIcon={<UserPlus />}
                  className="w-full justify-start"
                >
                  Assignee
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Workspace members</DropdownMenuLabel>
                {board.members.map((member) => (
                  <DropdownMenuCheckboxItem
                    key={member.id}
                    checked={card.memberIds.includes(member.id)}
                    // A task takes one assignee, so picking a second replaces
                    // the first and picking the current one unassigns.
                    onCheckedChange={() =>
                      dispatch({
                        type: 'card/toggleMember',
                        cardId: card.id,
                        memberId: member.id,
                      })
                    }
                  >
                    <UserAvatar
                      name={member.name}
                      seed={member.id}
                      src={member.avatarUrl}
                      size="xs"
                    />
                    {member.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="pt-2 space-y-1.5">
              <Label
                htmlFor={`due-${card.id}`}
                className="gap-1.5 text-xs flex items-center text-muted-foreground"
              >
                <CalendarDays className="size-3.5" aria-hidden />
                Due date
              </Label>
              <div className="gap-1 flex items-center">
                <DatePicker
                  id={`due-${card.id}`}
                  value={card.dueDate ?? ''}
                  onChange={(date) =>
                    dispatch({
                      type: 'card/update',
                      cardId: card.id,
                      patch: { dueDate: date || null },
                    })
                  }
                  className="h-8 text-xs flex-1"
                />
                {card.dueDate ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-8 shrink-0"
                    aria-label="Clear due date"
                    onClick={() =>
                      dispatch({
                        type: 'card/update',
                        cardId: card.id,
                        patch: { dueDate: null },
                      })
                    }
                  >
                    <X className="size-3.5" />
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="pt-2 space-y-1.5">
              <Label className="gap-1.5 text-xs flex items-center text-muted-foreground">
                <Flag className="size-3.5" aria-hidden />
                Priority
              </Label>
              <Select
                value={card.priority}
                onValueChange={(value) =>
                  dispatch({
                    type: 'card/update',
                    cardId: card.id,
                    patch: { priority: value as Priority },
                  })
                }
              >
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      <span className="gap-2 flex items-center">
                        <span
                          className={cn(
                            'size-2 rounded-full',
                            PRIORITY_META[priority].dot,
                          )}
                          aria-hidden
                        />
                        {PRIORITY_META[priority].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-3 space-y-1.5 border-t">
            <p className="text-xs font-medium text-muted-foreground">Actions</p>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="subtle"
                  size="sm"
                  leadingIcon={<CornerUpRight />}
                  className="w-full justify-start"
                >
                  Move
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                <DropdownMenuLabel>Move to</DropdownMenuLabel>
                {board.lists.map((list) => (
                  <DropdownMenuItem
                    key={list.id}
                    disabled={list.id === listId}
                    onSelect={() =>
                      dispatch({
                        type: 'card/move',
                        cardId: card.id,
                        toListId: list.id,
                        toIndex: Number.MAX_SAFE_INTEGER,
                      })
                    }
                  >
                    {list.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="subtle"
              size="sm"
              leadingIcon={<Copy />}
              className="w-full justify-start"
              onClick={() => dispatch({ type: 'card/copy', cardId: card.id })}
            >
              Copy
            </Button>

            <Button
              variant="ghost"
              size="sm"
              leadingIcon={<Trash2 />}
              className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                dispatch({ type: 'card/remove', cardId: card.id });
                onClose();
              }}
            >
              Delete
            </Button>
          </div>

          <p className="pt-3 text-xs border-t text-muted-foreground">
            Added {formatRelative(card.createdAt)}
          </p>
        </aside>
      </div>
    </div>
  );
}
