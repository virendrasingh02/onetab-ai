import {
  Button,
  confirm,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  ScrollArea,
  UserAvatar,
  UserAvatarGroup,
} from '@org/ui';
import { TaskStatus, WorkspacePermission } from '@org/types';
import { useWorkspacePermission } from '@org/web-workspace';
import { SkeletonList } from '@org/ui';
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
import {
  describeDue,
  PRIORITIES,
  DUE_TONE_CLASSES,
} from '../kanban/card-meta.js';
import { useKanbanDisplayStore } from '../kanban/kanban-display-store.js';
import { PriorityIcon, StatusIcon } from '../kanban/kanban-icons.js';
import { useWorkflowStates } from '../kanban/task-states.js';
import { compareBy, type BoardAction } from '../kanban/server-board.js';
import type { BoardState, KanbanCard, KanbanList } from '../kanban/types.js';

interface ProjectListViewProps {
  board: BoardState;
  dispatch: (action: BoardAction) => void;
  onSelectCard: (card: KanbanCard, listId: KanbanList['id']) => void;
  isLoading?: boolean;
}

export function ProjectListView({
  board,
  dispatch,
  onSelectCard,
  isLoading = false,
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
      <div className="p-4">
        <SkeletonList rows={6} />
      </div>
    );
  }

  return (
    <div className="gap-6 p-4 flex w-full max-w-full flex-col overflow-x-auto text-foreground">
      {board.lists.map((list) => {
        const isCollapsed = collapsedLists[list.id];
        const filteredCards =
          orderBy === 'manual'
            ? list.cards
            : [...list.cards].sort(compareBy(orderBy));
        const completedCount = filteredCards.filter(
          (c) => c.dueComplete,
        ).length;
        const totalCount = filteredCards.length;

        return (
          <div
            key={list.id}
            className="flex flex-col overflow-hidden rounded-xl border border-border/60 bg-card/60 shadow-xs transition-all duration-200"
          >
            {/* Section Header */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-border/40 bg-muted/40 select-none">
              <div className="gap-3 flex items-center">
                <button
                  type="button"
                  onClick={() => toggleCollapse(list.id)}
                  className="p-1 rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                <StatusIcon status={list.id} className="size-4" />
                <h3 className="text-sm font-semibold tracking-tight gap-2 flex items-center text-foreground">
                  {list.title}
                  <span className="text-xs font-normal px-2 py-0.5 rounded-full border border-border/40 bg-muted text-muted-foreground">
                    {completedCount}/{totalCount}
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
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add Task
                </Button>
              </div>
            </div>

            {/* Tasks Table Body */}
            {!isCollapsed && (
              <ScrollArea className="w-full">
                <table className="text-xs w-full min-w-[720px] border-collapse text-left">
                  <thead>
                    <tr className="font-medium border-b border-border/30 bg-muted/20 text-muted-foreground/70">
                      <th className="py-2.5 px-4 w-[40%]">Task Name</th>
                      <th className="py-2.5 px-3 w-[15%]">Assignee</th>
                      <th className="py-2.5 px-3 w-[15%]">Due Date</th>
                      <th className="py-2.5 px-3 w-[15%]">Priority</th>
                      <th className="py-2.5 px-3 pr-4 w-[15%] text-right">
                        Status / Move
                      </th>
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

                              {ticketId ? (
                                <span className="font-semibold px-1.5 py-0.2 rounded shrink-0 border border-border/50 bg-muted/70 font-mono text-[10.5px] text-muted-foreground">
                                  {ticketId}
                                </span>
                              ) : null}

                              <button
                                type="button"
                                onClick={() => onSelectCard(card, list.id)}
                                className={cn(
                                  'font-medium max-w-[300px] truncate text-left text-foreground transition-colors hover:text-primary hover:underline',
                                  card.dueComplete &&
                                    'text-muted-foreground line-through',
                                )}
                              >
                                {card.title}
                              </button>

                              {card.labels.length > 0 && (
                                <div className="sm:flex gap-1 hidden items-center">
                                  {card.labels.slice(0, 2).map((lbl) => (
                                    <span
                                      key={lbl}
                                      className="font-semibold px-1.5 py-0.2 rounded border border-accent-violet/20 bg-accent-violet-soft text-[9.5px] text-accent-violet"
                                    >
                                      {lbl}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {card.milestone && (
                                <span className="px-1.5 py-0.5 rounded ml-1 border border-border/40 bg-muted text-[10px] text-muted-foreground">
                                  {card.milestone}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Assignee */}
                          <td className="py-2.5 px-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="gap-1.5 p-1 flex items-center rounded-md text-left text-muted-foreground transition-colors hover:bg-muted/60"
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
                                          statusText={assignedMember.statusText}
                                          size="xs"
                                        />
                                      )}
                                      <span className="max-w-[90px] truncate">
                                        {assignedMembers.length > 1
                                          ? `${assignedMembers.length} assignees`
                                          : assignedMember.name}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-[11px] text-muted-foreground/60 italic">
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

                          {/* Due Date */}
                          <td className="py-2.5 px-3">
                            {dueInfo ? (
                              <span
                                className={cn(
                                  'gap-1 px-2 py-0.5 rounded font-medium inline-flex items-center border text-[11px]',
                                  DUE_TONE_CLASSES[dueInfo.tone],
                                )}
                              >
                                <Calendar className="w-3 h-3" />
                                {dueInfo.label}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onSelectCard(card, list.id)}
                                className="text-[11px] text-muted-foreground/50 italic hover:text-muted-foreground"
                              >
                                Set date
                              </button>
                            )}
                          </td>

                          {/* Priority with Linear Icon */}
                          <td className="py-2.5 px-3">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button
                                  type="button"
                                  className="gap-1.5 px-2 py-0.5 text-xs font-medium inline-flex cursor-pointer items-center rounded-md transition-colors hover:bg-muted/60"
                                >
                                  <PriorityIcon
                                    priority={card.priority}
                                    className="size-3.5"
                                  />
                                  <span className="text-[11px] text-foreground/90 capitalize">
                                    {card.priority
                                      .toLowerCase()
                                      .replace('_', ' ')}
                                  </span>
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start">
                                {PRIORITIES.map((p) => (
                                  <DropdownMenuItem
                                    key={p}
                                    onClick={() =>
                                      dispatch({
                                        type: 'card/update',
                                        cardId: card.id,
                                        patch: { priority: p },
                                      })
                                    }
                                    className="gap-2 text-xs flex items-center"
                                  >
                                    <PriorityIcon
                                      priority={p}
                                      className="size-3.5"
                                    />
                                    <span className="capitalize">
                                      {p.toLowerCase().replace('_', ' ')}
                                    </span>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>

                          {/* Status / List Move Dropdown */}
                          <td className="py-2.5 px-3 pr-4 text-right">
                            <div className="gap-2 flex items-center justify-end">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 font-normal gap-1 text-[11px]"
                                  >
                                    <span>{list.title}</span>
                                    <ChevronDown className="w-3 h-3 text-muted-foreground" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {board.lists.map((targetList) => (
                                    <DropdownMenuItem
                                      key={targetList.id}
                                      disabled={targetList.id === list.id}
                                      onClick={() =>
                                        dispatch({
                                          type: 'card/move',
                                          cardId: card.id,
                                          toListId: targetList.id,
                                          toIndex: targetList.cards.length,
                                        })
                                      }
                                    >
                                      {targetList.title}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>

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

                    {/* Quick Add Task Input Row */}
                    {newTaskInput?.listId === list.id ? (
                      <tr className="bg-primary/5">
                        <td colSpan={5} className="py-2 px-4">
                          <div className="gap-2 flex items-center">
                            <Input
                              autoFocus
                              placeholder="Write a task name... Press Enter to save"
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
                            <span>Add task...</span>
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
