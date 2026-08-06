import {
  accentClasses,
  Button,
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
  Input,
  Label,
  Progress,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  UserAvatar,
} from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import {
  AlignLeft,
  CalendarDays,
  Check,
  CheckSquare,
  Copy,
  CornerUpRight,
  Flag,
  MessageSquare,
  Tag,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useState } from 'react';
import type { BoardAction } from './board-state.js';
import { findCard } from './board-state.js';
import {
  describeDue,
  DUE_TONE_CLASSES,
  PRIORITIES,
  PRIORITY_META,
} from './card-meta.js';
import type { BoardState, Priority } from './types.js';

export interface CardDetailsDialogProps {
  board: BoardState;
  /** Open card, or null when the dialog is closed. */
  cardId: string | null;
  dispatch: (action: BoardAction) => void;
  onClose: () => void;
}

export function CardDetailsDialog({
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
  board: BoardState;
  card: NonNullable<ReturnType<typeof findCard>>['card'];
  listId: string;
  listTitle: string;
  dispatch: (action: BoardAction) => void;
  onClose: () => void;
}

function CardDetailsBody({
  board,
  card,
  listId,
  listTitle,
  dispatch,
  onClose,
}: CardDetailsBodyProps) {
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(card.description);
  const [checklistDraft, setChecklistDraft] = useState('');
  const [commentDraft, setCommentDraft] = useState('');

  const due = describeDue(card);
  const doneCount = card.checklist.filter((item) => item.done).length;
  const progress = card.checklist.length
    ? (doneCount / card.checklist.length) * 100
    : 0;

  const memberName = (id: string) =>
    board.members.find((member) => member.id === id)?.name ?? 'Unknown';

  return (
    <div className="scrollbar-subtle max-h-[85vh] overflow-y-auto">
      <div className="px-6 pt-6 pb-4 border-b">
        {/*
          The dialog's accessible name has to be static text — an editable
          field as the title would rename the dialog on every keystroke — so
          the heading is visually hidden and the editor sits beside it.
        */}
        <DialogTitle className="sr-only">{card.title}</DialogTitle>
        <Textarea
          rows={1}
          value={card.title}
          aria-label="Card title"
          onChange={(event) =>
            dispatch({
              type: 'card/update',
              cardId: card.id,
              patch: { title: event.target.value },
            })
          }
          className="mr-10 px-1 text-base font-semibold border-transparent bg-transparent shadow-none hover:border-input focus-visible:border-ring"
        />
        <DialogDescription className="mt-1 px-1 text-xs">
          in list{' '}
          <span className="font-medium text-foreground">{listTitle}</span>
        </DialogDescription>
      </div>

      <div className="gap-6 px-6 py-5 md:grid-cols-[minmax(0,1fr)_13rem] grid grid-cols-1">
        {/* ------------------------------------------------------- main --- */}
        <div className="space-y-6 min-w-0">
          <div className="gap-4 flex flex-wrap">
            {card.labelIds.length > 0 ? (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Labels
                </p>
                <ul className="gap-1.5 flex flex-wrap">
                  {card.labelIds.map((id) => {
                    const label = board.labels.find((entry) => entry.id === id);
                    if (!label) return null;
                    return (
                      <li
                        key={id}
                        className={cn(
                          'px-2.5 py-1 text-xs font-medium rounded-md',
                          accentClasses[label.color].soft,
                        )}
                      >
                        {label.name}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            {card.memberIds.length > 0 ? (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                  Members
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
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: 'card/update',
                      cardId: card.id,
                      patch: { dueComplete: !card.dueComplete },
                    })
                  }
                  title={
                    card.dueComplete
                      ? 'Mark as not complete'
                      : 'Mark as complete'
                  }
                  className={cn(
                    'gap-1.5 px-2.5 py-1 text-xs font-medium flex items-center rounded-md border',
                    DUE_TONE_CLASSES[due.tone],
                  )}
                >
                  <span
                    className={cn(
                      'size-3.5 flex items-center justify-center rounded-sm border border-current',
                      card.dueComplete && 'bg-current',
                    )}
                    aria-hidden
                  >
                    {card.dueComplete ? (
                      <Check className="size-2.5 text-background" />
                    ) : null}
                  </span>
                  {due.hint}
                </button>
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

          {/* checklist */}
          <section>
            <div className="mb-2 gap-2 flex items-center justify-between">
              <h3 className="gap-2 text-sm font-semibold flex items-center text-foreground">
                <CheckSquare
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
                Checklist
              </h3>
              {card.checklist.length > 0 ? (
                <span className="text-xs text-muted-foreground tabular-nums">
                  {doneCount}/{card.checklist.length}
                </span>
              ) : null}
            </div>

            {card.checklist.length > 0 ? (
              <>
                <Progress
                  value={progress}
                  size="sm"
                  accent="green"
                  label={`Checklist ${Math.round(progress)}% complete`}
                  className="mb-3"
                />
                <ul className="mb-3 space-y-1">
                  {card.checklist.map((item) => (
                    <li
                      key={item.id}
                      className="group/item gap-2 flex items-center"
                    >
                      <label className="gap-2 text-sm flex flex-1 cursor-pointer items-center">
                        <input
                          type="checkbox"
                          checked={item.done}
                          onChange={() =>
                            dispatch({
                              type: 'checklist/toggle',
                              cardId: card.id,
                              itemId: item.id,
                            })
                          }
                          className="size-4 accent-[var(--color-primary)]"
                        />
                        <span
                          className={cn(
                            item.done && 'text-muted-foreground line-through',
                          )}
                        >
                          {item.text}
                        </span>
                      </label>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="size-6 opacity-0 group-hover/item:opacity-100 focus-visible:opacity-100"
                        aria-label={`Remove “${item.text}”`}
                        onClick={() =>
                          dispatch({
                            type: 'checklist/remove',
                            cardId: card.id,
                            itemId: item.id,
                          })
                        }
                      >
                        <X className="size-3.5" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}

            <form
              className="gap-2 flex"
              onSubmit={(event) => {
                event.preventDefault();
                const text = checklistDraft.trim();
                if (!text) return;
                dispatch({ type: 'checklist/add', cardId: card.id, text });
                setChecklistDraft('');
              }}
            >
              <Input
                value={checklistDraft}
                placeholder="Add an item"
                aria-label="New checklist item"
                onChange={(event) => setChecklistDraft(event.target.value)}
              />
              <Button type="submit" size="sm" disabled={!checklistDraft.trim()}>
                Add
              </Button>
            </form>
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
                const body = commentDraft.trim();
                if (!body) return;
                dispatch({ type: 'comment/add', cardId: card.id, body });
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
              <Button type="submit" size="sm" disabled={!commentDraft.trim()}>
                Comment
              </Button>
            </form>

            <ul className="space-y-3">
              {card.comments.map((comment) => (
                <li key={comment.id} className="group/comment gap-2 flex">
                  <UserAvatar
                    name={memberName(comment.authorId)}
                    seed={comment.authorId}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="gap-2 text-xs flex items-baseline text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {memberName(comment.authorId)}
                      </span>
                      {formatRelative(comment.createdAt)}
                    </p>
                    <p className="mt-1 px-3 py-2 text-sm rounded-md border bg-surface whitespace-pre-wrap">
                      {comment.body}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-6 shrink-0 opacity-0 group-hover/comment:opacity-100 focus-visible:opacity-100"
                    aria-label="Delete comment"
                    onClick={() =>
                      dispatch({
                        type: 'comment/remove',
                        cardId: card.id,
                        commentId: comment.id,
                      })
                    }
                  >
                    <X className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
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
                  leadingIcon={<Tag />}
                  className="w-full justify-start"
                >
                  Labels
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Labels</DropdownMenuLabel>
                {board.labels.map((label) => (
                  <DropdownMenuCheckboxItem
                    key={label.id}
                    checked={card.labelIds.includes(label.id)}
                    // Keeps the menu open so several labels can be toggled.
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={() =>
                      dispatch({
                        type: 'card/toggleLabel',
                        cardId: card.id,
                        labelId: label.id,
                      })
                    }
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
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="subtle"
                  size="sm"
                  leadingIcon={<UserPlus />}
                  className="w-full justify-start"
                >
                  Members
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Board members</DropdownMenuLabel>
                {board.members.map((member) => (
                  <DropdownMenuCheckboxItem
                    key={member.id}
                    checked={card.memberIds.includes(member.id)}
                    onSelect={(event) => event.preventDefault()}
                    onCheckedChange={() =>
                      dispatch({
                        type: 'card/toggleMember',
                        cardId: card.id,
                        memberId: member.id,
                      })
                    }
                  >
                    <UserAvatar name={member.name} seed={member.id} size="xs" />
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
              <div className="gap-1 flex">
                <Input
                  id={`due-${card.id}`}
                  type="date"
                  value={card.dueDate ?? ''}
                  onChange={(event) =>
                    dispatch({
                      type: 'card/update',
                      cardId: card.id,
                      patch: { dueDate: event.target.value || undefined },
                    })
                  }
                  className="h-8 text-xs"
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
                        patch: { dueDate: undefined, dueComplete: false },
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
                <DropdownMenuLabel>Move to list</DropdownMenuLabel>
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
