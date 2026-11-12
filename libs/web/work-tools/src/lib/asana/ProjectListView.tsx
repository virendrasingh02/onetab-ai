import {
  ActionDropdownMenu,
  Badge,
  Button,
  DatePicker,
  EntityContextMenu,
  Input,
  ScrollArea,
  SkeletonList,
  UserAvatar,
  UserAvatarGroup,
} from '@org/ui';
import { TaskStatus } from '@org/types';
import { cn } from '@org/utils';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  MoreHorizontal,
  Plus,
} from 'lucide-react';
import { useState } from 'react';
import {
  describeDue,
  DUE_TEXT_CLASSES,
  PRIORITY_META,
} from '../kanban/card-meta.js';
import { useKanbanDisplayStore } from '../kanban/kanban-display-store.js';
import {
  PriorityIcon,
  StatusIcon,
  UnassignedLeadIcon,
} from '../kanban/kanban-icons.js';
import { KanbanLeadPicker } from '../kanban/KanbanLeadPicker.js';
import { KanbanPriorityPicker } from '../kanban/KanbanPriorityPicker.js';
import { KanbanStatusPicker } from '../kanban/KanbanStatusPicker.js';
import { useBoardTaskActions } from '../kanban/task-actions.js';
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

/** Controls a row owns; a click on them never opens the task. */
const ROW_CONTROLS =
  'button, a, input, textarea, [data-no-drag], [role="menu"]';

/** An inline cell control: borderless until hovered. */
const CELL_TRIGGER =
  'h-7 px-1.5 gap-1.5 inline-flex max-w-full min-w-0 items-center rounded-md border border-transparent bg-transparent text-left text-xs text-foreground transition-colors hover:border-border hover:bg-muted/50 focus-visible:border-ring focus-visible:outline-none';

interface ProjectListViewProps {
  workspaceId?: string;
  board: BoardState;
  dispatch: (action: BoardAction) => void;
  onSelectCard: (card: KanbanCard, listId: KanbanList['id']) => void;
  isLoading?: boolean;
  /** True when search or filters are narrowing the board. */
  filtered?: boolean;
  onClearFilters?: () => void;
}

export function ProjectListView({
  workspaceId,
  board,
  dispatch,
  onSelectCard,
  isLoading = false,
  filtered = false,
  onClearFilters,
}: ProjectListViewProps) {
  const orderBy = useKanbanDisplayStore((state) => state.orderBy);
  const show = useKanbanDisplayStore((state) => state.card);
  const { nameOf, categoryOf } = useWorkflowStates();
  // The board card's own menu: same actions, same order, in every view.
  const taskActions = useBoardTaskActions({
    workspaceId,
    lists: board.lists,
    members: board.members,
    dispatch,
    onOpen: onSelectCard,
  });
  // "Done" is a status, not the due-date tick: these are where the circle
  // sends a task, by category, so renamed or custom statuses still work.
  const doneListId =
    board.lists.find((l) => categoryOf(l.id) === TaskStatus.DONE)?.id ??
    TaskStatus.DONE;
  const todoListId =
    board.lists.find((l) => categoryOf(l.id) === TaskStatus.TODO)?.id ??
    TaskStatus.TODO;
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
                  <Badge variant="neutral" className="min-w-5 tabular-nums">
                    {totalCount}
                  </Badge>
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
                      const isDone = categoryOf(list.id) === TaskStatus.DONE;
                      const actions = () => taskActions(card, list.id);
                      return (
                        <EntityContextMenu
                          key={card.id}
                          actions={actions}
                          scope={`task:${card.id}`}
                          entityType="task"
                          entity={card}
                          label={`“${card.title}”`}
                          longPress={false}
                        >
                          <tr
                            tabIndex={0}
                            onClick={(event) => {
                              // The whole row opens the task, like a board card;
                              // its own pickers and menu keep their clicks.
                              const target = event.target as HTMLElement;
                              if (!event.currentTarget.contains(target)) return;
                              if (target.closest(ROW_CONTROLS)) return;
                              onSelectCard(card, list.id);
                            }}
                            onKeyDown={(event) => {
                              if (
                                event.key === 'Enter' &&
                                event.target === event.currentTarget
                              ) {
                                event.preventDefault();
                                onSelectCard(card, list.id);
                              }
                            }}
                            className="group cursor-pointer transition-colors hover:bg-muted/30 focus-visible:bg-muted/40 focus-visible:outline-none"
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
                                    isDone
                                      ? `Move back to ${nameOf(todoListId)}`
                                      : `Mark as ${nameOf(doneListId)}`
                                  }
                                  aria-label={
                                    isDone
                                      ? `Reopen ${card.title}`
                                      : `Complete ${card.title}`
                                  }
                                  onClick={() =>
                                    dispatch({
                                      type: 'card/move',
                                      cardId: card.id,
                                      toListId: isDone
                                        ? todoListId
                                        : doneListId,
                                      toIndex: 0,
                                    })
                                  }
                                  className="shrink-0 text-muted-foreground transition-colors hover:text-[#10b981]"
                                >
                                  {isDone ? (
                                    <CheckCircle2 className="size-4 text-white fill-[#10b981]" />
                                  ) : (
                                    <Circle className="size-4" />
                                  )}
                                </button>

                                {(show.ticketId ?? true) ? (
                                  <TaskTicket ticket={ticketId} />
                                ) : null}

                                <span
                                  className={cn(
                                    'font-medium min-w-0 truncate text-foreground',
                                    isDone &&
                                      'text-muted-foreground line-through',
                                  )}
                                >
                                  {card.title}
                                </span>

                                {(show.labels ?? true) ? (
                                  <TaskLabelChips
                                    labels={card.labels}
                                    className="sm:flex hidden"
                                  />
                                ) : null}
                              </div>
                            </td>

                            {/* Assignee */}
                            <td className="py-2.5 px-3">
                              <KanbanLeadPicker
                                selectedMemberIds={card.memberIds}
                                currentMemberId={card.memberIds[0]}
                                members={board.members}
                                multiple
                                onSelectMembers={(memberIds) =>
                                  dispatch({
                                    type: 'card/update',
                                    cardId: card.id,
                                    patch: { memberIds },
                                  })
                                }
                                onSelectMember={(memberId) =>
                                  dispatch({
                                    type: 'card/update',
                                    cardId: card.id,
                                    patch: {
                                      memberIds: memberId ? [memberId] : [],
                                    },
                                  })
                                }
                                align="start"
                                trigger={
                                  <button
                                    type="button"
                                    className={CELL_TRIGGER}
                                  >
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
                                            statusText={
                                              assignedMember.statusText
                                            }
                                            size="xs"
                                          />
                                        )}
                                        <span className="truncate">
                                          {assignedMembers.length > 1
                                            ? `${assignedMembers.length} assignees`
                                            : (assignedMember.displayName ??
                                              assignedMember.name)}
                                        </span>
                                      </>
                                    ) : (
                                      <>
                                        <UnassignedLeadIcon className="size-4" />
                                        <span className="text-muted-foreground">
                                          Unassigned
                                        </span>
                                      </>
                                    )}
                                  </button>
                                }
                              />
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
                                  <button
                                    type="button"
                                    className={CELL_TRIGGER}
                                  >
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
                                  <button
                                    type="button"
                                    className={CELL_TRIGGER}
                                  >
                                    <PriorityIcon
                                      priority={card.priority}
                                      className="size-3.5"
                                    />
                                    <span className="truncate">
                                      {PRIORITY_META[card.priority]?.label ??
                                        card.priority}
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

                                <ActionDropdownMenu
                                  actions={actions}
                                  scope={`task:${card.id}`}
                                  entityType="task"
                                  entity={card}
                                  trigger={
                                    <button
                                      type="button"
                                      aria-label={`Actions for “${card.title}”`}
                                      className="size-6 flex shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-muted hover:text-foreground focus-visible:opacity-100 data-[state=open]:opacity-100"
                                    >
                                      <MoreHorizontal className="size-3.5" />
                                    </button>
                                  }
                                />
                              </div>
                            </td>
                          </tr>
                        </EntityContextMenu>
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
