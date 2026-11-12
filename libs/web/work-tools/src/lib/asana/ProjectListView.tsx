import {
  Button,
  confirm,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DatePicker,
  Input,
  ScrollArea,
  SkeletonList,
  UserAvatar,
  UserAvatarGroup,
} from '@org/ui';
import { TaskStatus, WorkspacePermission } from '@org/types';
import { useWorkspacePermission } from '@org/web-workspace';
import { cn } from '@org/utils';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { describeDue, DUE_TEXT_CLASSES } from '../kanban/card-meta.js';
import { useKanbanDisplayStore } from '../kanban/kanban-display-store.js';
import { PriorityIcon, StatusIcon } from '../kanban/kanban-icons.js';
import { KanbanPriorityPicker } from '../kanban/KanbanPriorityPicker.js';
import { KanbanStatusPicker } from '../kanban/KanbanStatusPicker.js';
import { useWorkflowStates } from '../kanban/task-states.js';
import {
  PROJECT_VIEW_PADDING,
  TaskLabelChips,
  TaskTicket,
  TaskViewEmpty,
} from '../kanban/task-view-parts.js';
import { compareBy, type BoardAction } from '../kanban/server-board.js';
import type {
  BoardState,
  KanbanCard,
  KanbanList,
  Priority,
} from '../kanban/types.js';

const PRIORITY_LABELS: Record<Priority, string> = {
  URGENT: 'Urgent',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

/** An inline cell control: borderless until hovered, matching the Table view. */
const CELL_TRIGGER =
  'h-7 px-1.5 gap-1.5 inline-flex max-w-full min-w-0 items-center rounded-md border border-transparent bg-transparent text-left text-xs text-foreground transition-colors hover:border-border hover:bg-muted/50 focus-visible:border-ring focus-visible:outline-none';

interface ProjectListViewProps {
  board: BoardState;
  dispatch: (action: BoardAction) => void;
  onSelectCard: (card: KanbanCard, listId: KanbanList['id']) => void;
  isLoading?: boolean;
  /** True when search or filters are narrowing the board. */
  filtered?: boolean;
  onClearFilters?: () => void;
}

export function ProjectListView({
  board,
  dispatch,
  onSelectCard,
  isLoading = false,
  filtered = false,
  onClearFilters,
}: ProjectListViewProps) {
  const orderBy = useKanbanDisplayStore((state) => state.orderBy);
  const canDelete = useWorkspacePermission().can(WorkspacePermission.DELETE);
  const { nameOf } = useWorkflowStates();
  const [collapsedLists, setCollapsedLists] = useState<Record<string, boolean>>(
    {},
  );
  const [newTaskInput, setNewTaskInput] = useState<{
    listId: string;
    title: string;
  } | null>(null);

  const toggleCollapse = (listId: string) => {
    setCollapsedLists((prev) => ({ ...prev, [listId]: !prev[listId] }));
  };

  const handleCreateTask = (listId: string) => {
    if (newTaskInput?.title.trim()) {
      dispatch({
        type: 'card/add',
        listId,
        title: newTaskInput.title.trim(),
        edge: 'bottom',
      });
      setNewTaskInput(null);
    }
  };

  if (isLoading) {
    return (
      <div className={PROJECT_VIEW_PADDING}>
        <SkeletonList rows={6} />
      </div>
    );
  }

  // While filtering, a section with no matches is noise: show only the hits.
  const lists = filtered
    ? board.lists.filter((list) => list.cards.length > 0)
    : board.lists;

  if (filtered && lists.length === 0) {
    return (
      <div className={PROJECT_VIEW_PADDING}>
        <TaskViewEmpty filtered onClearFilters={onClearFilters} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        PROJECT_VIEW_PADDING,
        'gap-4 flex w-full max-w-full flex-col overflow-x-auto text-foreground',
      )}
    >
      {lists.map((list) => {
        const isCollapsed = collapsedLists[list.id];
        const filteredCards =
          orderBy === 'manual'
            ? list.cards
            : [...list.cards].sort(compareBy(orderBy));
        const totalCount = filteredCards.length;

        return (
          <div
            key={list.id}
            className="flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-xs"
          >
            {/* Section Header */}
            <div className="px-3 py-2 flex items-center justify-between border-b border-border/60 bg-muted/40 select-none">
              <div className="gap-2 flex items-center">
                <button
                  type="button"
                  onClick={() => toggleCollapse(list.id)}
                  aria-expanded={!isCollapsed}
                  aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${list.title}`}
                  className="p-1 rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                <StatusIcon status={list.id} className="size-4" />
                <h3 className="text-sm font-semibold gap-2 flex items-center text-foreground">
                  {list.title}
                  <span className="text-xs font-normal text-muted-foreground tabular-nums">
                    {totalCount}
                  </span>
                </h3>
              </div>

              <div className="gap-2 flex items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    setNewTaskInput({ listId: list.id, title: '' })
                  }
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  <Plus className="size-3.5" />
                  Add task
                </Button>
              </div>
            </div>

            {/* Tasks Table Body */}
            {!isCollapsed && (
              <ScrollArea className="w-full">
                <table className="text-xs w-full min-w-[720px] border-collapse text-left">
                  {/* Headers only label rows; an empty section has none. */}
                  <thead className={cn(totalCount === 0 && 'sr-only')}>
                    <tr className="font-medium border-b border-border/40 text-[11px] text-muted-foreground">
                      <th className="py-2 px-4 w-[40%]">Task</th>
                      <th className="py-2 px-3 w-[15%]">Assignee</th>
                      <th className="py-2 px-3 w-[15%]">Due date</th>
                      <th className="py-2 px-3 w-[13%]">Priority</th>
                      <th className="py-2 px-3 pr-4 w-[17%]">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {filteredCards.map((card) => {
                      const dueInfo = describeDue(card);
                      const assignedMembers = card.memberIds
                        .map((id) => board.members.find((m) => m.id === id))
                        .filter(
                          (m): m is (typeof board.members)[number] => !!m,
                        );
                      const assignedMember = assignedMembers[0];

                      const ticketId = card.ticketId ?? card.identifier;
                      return (
                        <tr
                          key={card.id}
                          className={cn(
                            'group transition-colors hover:bg-muted/30',
                            card.dueComplete && 'bg-muted/10 opacity-60',
                          )}
                        >
                          {/* Task Name & Completion Toggle */}
                          <td className="py-2.5 px-4">
                            <div className="gap-2.5 min-w-0 flex items-center">
                              {/*
                                "Done" is the column the task sits in, not a
                                flag of its own, so ticking this moves the task
                                rather than setting a field.
                              */}
                              <button
                                type="button"
                                title={
                                  card.dueComplete
                                    ? `Move back to ${nameOf(TaskStatus.TODO)}`
                                    : 'Mark as completed'
                                }
                                onClick={() =>
                                  dispatch({
                                    type: 'card/move',
                                    cardId: card.id,
                                    toListId: card.dueComplete
                                      ? TaskStatus.TODO
                                      : TaskStatus.DONE,
                                    toIndex: 0,
                                  })
                                }
                                className="shrink-0 text-muted-foreground transition-colors hover:text-accent-green"
                              >
                                {card.dueComplete ? (
                                  <CheckCircle2 className="w-4 h-4 fill-accent-green text-accent-green" />
                                ) : (
                                  <Circle className="w-4 h-4" />
                                )}
                              </button>

                              <TaskTicket ticket={ticketId} />

                              <button
                                type="button"
                                onClick={() => onSelectCard(card, list.id)}
                                className={cn(
                                  'font-medium min-w-0 truncate text-left text-foreground transition-colors hover:text-primary',
                                  card.dueComplete &&
                                    'text-muted-foreground line-through',
                                )}
                              >
                                {card.title}
                              </button>

                              <TaskLabelChips
                                labels={card.labels}
                                className="sm:flex hidden"
                              />
                            </div>
                          </td>

                          {/* Assignee */}
                          <td className="py-2.5 px-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button type="button" className={CELL_TRIGGER}>
                                  {assignedMember ? (
                                    <>
                                      {assignedMembers.length > 1 ? (
                                        <UserAvatarGroup
                                          users={assignedMembers}
                                          size="xs"
                                        />
                                      ) : (
                                        <UserAvatar
                                          name={assignedMember.name}
                                          src={assignedMember.avatarUrl}
                                          seed={assignedMember.id}
                                          presence={assignedMember.presence}
                                          statusEmoji={
                                            assignedMember.statusEmoji
                                          }
                                          statusText={assignedMember.statusText}
                                          size="xs"
                                        />
                                      )}
                                      <span className="truncate">
                                        {assignedMembers.length > 1
                                          ? `${assignedMembers.length} assignees`
                                          : assignedMember.name}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      Unassigned
                                    </span>
                                  )}
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                {board.members.map((member) => (
                                  <DropdownMenuItem
                                    key={member.id}
                                    onClick={() =>
                                      dispatch({
                                        type: 'card/toggleMember',
                                        cardId: card.id,
                                        memberId: member.id,
                                      })
                                    }
                                    className="gap-2 flex items-center"
                                  >
                                    <UserAvatar
                                      name={member.name}
                                      src={member.avatarUrl}
                                      seed={member.id}
                                      presence={member.presence}
                                      statusEmoji={member.statusEmoji}
                                      statusText={member.statusText}
                                      size="xs"
                                    />
                                    <span>{member.name}</span>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>

                          {/* Due date */}
                          <td className="py-1.5 px-3">
                            <DatePicker
                              value={card.dueDate}
                              onChange={(day) =>
                                dispatch({
                                  type: 'card/update',
                                  cardId: card.id,
                                  patch: { dueDate: day ?? null },
                                })
                              }
                              trigger={
                                <button type="button" className={CELL_TRIGGER}>
                                  <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
                                  {dueInfo ? (
                                    <span
                                      className={cn(
                                        'truncate',
                                        DUE_TEXT_CLASSES[dueInfo.tone],
                                      )}
                                    >
                                      {dueInfo.label}
                                    </span>
                                  ) : (
                                    <span className="text-muted-foreground">
                                      No date
                                    </span>
                                  )}
                                </button>
                              }
                            />
                          </td>

                          {/* Priority */}
                          <td className="py-1.5 px-3">
                            <KanbanPriorityPicker
                              required
                              priority={card.priority}
                              onPriorityChange={(value) =>
                                dispatch({
                                  type: 'card/update',
                                  cardId: card.id,
                                  patch: { priority: value as Priority },
                                })
                              }
                              trigger={
                                <button type="button" className={CELL_TRIGGER}>
                                  <PriorityIcon
                                    priority={card.priority}
                                    className="size-3.5"
                                  />
                                  <span className="truncate">
                                    {PRIORITY_LABELS[card.priority]}
                                  </span>
                                </button>
                              }
                            />
                          </td>

                          {/* Status */}
                          <td className="py-1.5 px-3 pr-4">
                            <div className="gap-1 flex items-center justify-between">
                              <KanbanStatusPicker
                                status={list.id}
                                onStatusChange={(toListId) => {
                                  if (toListId === list.id) return;
                                  const target = board.lists.find(
                                    (l) => l.id === toListId,
                                  );
                                  dispatch({
                                    type: 'card/move',
                                    cardId: card.id,
                                    toListId,
                                    toIndex: target?.cards.length ?? 0,
                                  });
                                }}
                                trigger={
                                  <button
                                    type="button"
                                    className={CELL_TRIGGER}
                                  >
                                    <StatusIcon
                                      status={list.id}
                                      className="size-3.5"
                                      showTooltip={false}
                                    />
                                    <span className="truncate">
                                      {list.title}
                                    </span>
                                  </button>
                                }
                              />

                              {canDelete ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    void confirm({
                                      title: `Delete “${card.title}”?`,
                                      description:
                                        "The task and its details are removed. This can't be undone.",
                                      confirmLabel: 'Delete task',
                                      destructive: true,
                                    }).then((ok) => {
                                      if (ok) {
                                        dispatch({
                                          type: 'card/remove',
                                          cardId: card.id,
                                        });
                                      }
                                    });
                                  }}
                                  aria-label={`Delete ${card.title}`}
                                  className="p-1 rounded text-muted-foreground/60 opacity-0 transition-all group-hover:opacity-100 hover:text-destructive focus-visible:opacity-100"
                                  title="Delete task"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Quick add */}
                    {newTaskInput?.listId === list.id ? (
                      <tr className="bg-primary/5">
                        <td colSpan={5} className="py-2 px-4">
                          <div className="gap-2 flex items-center">
                            <Input
                              autoFocus
                              placeholder="Task name. Enter to add, Esc to cancel"
                              value={newTaskInput.title}
                              onChange={(e) =>
                                setNewTaskInput({
                                  listId: list.id,
                                  title: e.target.value,
                                })
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter')
                                  handleCreateTask(list.id);
                                if (e.key === 'Escape') setNewTaskInput(null);
                              }}
                              className="h-8 text-xs bg-background"
                            />
                            <Button
                              size="sm"
                              onClick={() => handleCreateTask(list.id)}
                            >
                              Add
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setNewTaskInput(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-1.5 px-4">
                          <button
                            type="button"
                            onClick={() =>
                              setNewTaskInput({ listId: list.id, title: '' })
                            }
                            className="py-1 text-xs gap-1.5 group flex w-full items-center text-left text-muted-foreground transition-colors hover:text-foreground"
                          >
                            <Plus className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground" />
                            <span>Add task</span>
                          </button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </ScrollArea>
            )}
          </div>
        );
      })}
    </div>
  );
}
