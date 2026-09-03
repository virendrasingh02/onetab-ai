import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Input,
  ScrollArea,
  UserAvatar,
  UserAvatarGroup,
} from '@org/ui';
import { TaskStatus } from '@org/types';
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
import { useKanbanCustomStore } from '../kanban/kanban-custom-store.js';
import { PriorityIcon, StatusIcon } from '../kanban/kanban-icons.js';
import type { BoardAction } from '../kanban/server-board.js';
import type { BoardState, KanbanCard, KanbanList } from '../kanban/types.js';

interface ProjectListViewProps {
  board: BoardState;
  dispatch: (action: BoardAction) => void;
  onSelectCard: (card: KanbanCard, listId: KanbanList['id']) => void;
  searchQuery?: string;
  isLoading?: boolean;
}

export function ProjectListView({
  board,
  dispatch,
  onSelectCard,
  searchQuery = '',
  isLoading = false,
}: ProjectListViewProps) {
  const [collapsedLists, setCollapsedLists] = useState<Record<string, boolean>>({});
  const [newTaskInput, setNewTaskInput] = useState<{
    listId: TaskStatus;
    title: string;
  } | null>(null);
  const customStore = useKanbanCustomStore();

  const toggleCollapse = (listId: string) => {
    setCollapsedLists((prev) => ({ ...prev, [listId]: !prev[listId] }));
  };

  const handleCreateTask = (listId: TaskStatus) => {
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
    <div className="flex flex-col gap-6 p-4 w-full max-w-full overflow-x-auto text-foreground">
      {board.lists.map((list) => {
        const isCollapsed = collapsedLists[list.id];
        const filteredCards = list.cards.filter((c) =>
          searchQuery
            ? c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
              c.description?.toLowerCase().includes(searchQuery.toLowerCase())
            : true
        );
        const completedCount = filteredCards.filter((c) => c.dueComplete).length;
        const totalCount = filteredCards.length;

        return (
          <div
            key={list.id}
            className="flex flex-col rounded-xl border border-border/60 bg-card/60 shadow-xs overflow-hidden transition-all duration-200"
          >
            {/* Section Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b border-border/40 select-none">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleCollapse(list.id)}
                  className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                <StatusIcon status={list.id} className="size-4" />
                <h3 className="text-sm font-semibold text-foreground tracking-tight flex items-center gap-2">
                  {list.title}
                  <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border/40">
                    {completedCount}/{totalCount}
                  </span>
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setNewTaskInput({ listId: list.id, title: '' })}
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
                <table className="w-full border-collapse text-left text-xs min-w-[720px]">
                  <thead>
                    <tr className="border-b border-border/30 text-muted-foreground/70 font-medium bg-muted/20">
                      <th className="py-2.5 px-4 w-[40%]">Task Name</th>
                      <th className="py-2.5 px-3 w-[15%]">Assignee</th>
                      <th className="py-2.5 px-3 w-[15%]">Due Date</th>
                      <th className="py-2.5 px-3 w-[15%]">Priority</th>
                      <th className="py-2.5 px-3 w-[15%] text-right pr-4">Status / Move</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/30">
                    {filteredCards.map((card) => {
                      const dueInfo = describeDue(card);
                      const assignedMembers = card.memberIds
                        .map((id) => board.members.find((m) => m.id === id))
                        .filter((m): m is (typeof board.members)[number] => !!m);
                      const assignedMember = assignedMembers[0];

                      const cardProps = customStore.getCardProperties(card.id);
                      return (
                        <tr
                          key={card.id}
                          className={cn(
                            'group hover:bg-muted/30 transition-colors',
                            card.dueComplete && 'opacity-60 bg-muted/10'
                          )}
                        >
                          {/* Task Name & Completion Toggle */}
                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {/*
                                "Done" is the column the task sits in, not a
                                flag of its own, so ticking this moves the task
                                rather than setting a field.
                              */}
                              <button
                                type="button"
                                title={
                                  card.dueComplete
                                    ? 'Move back to Planned'
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
                                className="text-muted-foreground hover:text-accent-green transition-colors shrink-0"
                              >
                                {card.dueComplete ? (
                                  <CheckCircle2 className="w-4 h-4 text-accent-green fill-accent-green" />
                                ) : (
                                  <Circle className="w-4 h-4" />
                                )}
                              </button>

                              <span className="font-mono text-[10.5px] font-semibold text-muted-foreground bg-muted/70 px-1.5 py-0.2 rounded border border-border/50 shrink-0">
                                {cardProps.ticketId}
                              </span>

                              <button
                                type="button"
                                onClick={() => onSelectCard(card, list.id)}
                                className={cn(
                                  'font-medium text-foreground hover:text-primary hover:underline text-left truncate max-w-[300px] transition-colors',
                                  card.dueComplete && 'line-through text-muted-foreground'
                                )}
                              >
                                {card.title}
                              </button>

                              {cardProps.labels && cardProps.labels.length > 0 && (
                                <div className="hidden sm:flex items-center gap-1">
                                  {cardProps.labels.slice(0, 2).map((lbl) => (
                                    <span
                                      key={lbl}
                                      className="text-[9.5px] font-semibold px-1.5 py-0.2 rounded bg-accent-violet-soft text-accent-violet border border-accent-violet/20"
                                    >
                                      {lbl}
                                    </span>
                                  ))}
                                </div>
                              )}

                              {card.milestone && (
                                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border/40 ml-1">
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
                                  className="flex items-center gap-1.5 p-1 rounded-md hover:bg-muted/60 text-muted-foreground text-left transition-colors"
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
                                          statusEmoji={assignedMember.statusEmoji}
                                          statusText={assignedMember.statusText}
                                          size="xs"
                                        />
                                      )}
                                      <span className="truncate max-w-[90px]">
                                        {assignedMembers.length > 1
                                          ? `${assignedMembers.length} assignees`
                                          : assignedMember.name}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-muted-foreground/60 italic text-[11px]">Unassigned</span>
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
                                    className="flex items-center gap-2"
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
                                  'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border',
                                  DUE_TONE_CLASSES[dueInfo.tone]
                                )}
                              >
                                <Calendar className="w-3 h-3" />
                                {dueInfo.label}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onSelectCard(card, list.id)}
                                className="text-muted-foreground/50 hover:text-muted-foreground text-[11px] italic"
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
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md hover:bg-muted/60 text-xs font-medium cursor-pointer transition-colors"
                                >
                                  <PriorityIcon priority={card.priority} className="size-3.5" />
                                  <span className="capitalize text-[11px] text-foreground/90">
                                    {card.priority.toLowerCase().replace('_', ' ')}
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
                                    className="flex items-center gap-2 text-xs"
                                  >
                                    <PriorityIcon priority={p} className="size-3.5" />
                                    <span className="capitalize">{p.toLowerCase().replace('_', ' ')}</span>
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>

                          {/* Status / List Move Dropdown */}
                          <td className="py-2.5 px-3 pr-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm" className="h-6 text-[11px] font-normal gap-1">
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

                              <button
                                type="button"
                                onClick={() =>
                                  dispatch({ type: 'card/remove', cardId: card.id })
                                }
                                className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground/60 hover:text-destructive transition-all rounded"
                                title="Delete task"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {/* Quick Add Task Input Row */}
                    {newTaskInput?.listId === list.id ? (
                      <tr className="bg-primary/5">
                        <td colSpan={5} className="py-2 px-4">
                          <div className="flex items-center gap-2">
                            <Input
                              autoFocus
                              placeholder="Write a task name... Press Enter to save"
                              value={newTaskInput.title}
                              onChange={(e) => setNewTaskInput({ listId: list.id, title: e.target.value })}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCreateTask(list.id);
                                if (e.key === 'Escape') setNewTaskInput(null);
                              }}
                              className="h-8 text-xs bg-background"
                            />
                            <Button size="sm" onClick={() => handleCreateTask(list.id)}>
                              Add
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setNewTaskInput(null)}>
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
                            onClick={() => setNewTaskInput({ listId: list.id, title: '' })}
                            className="w-full text-left py-1 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors group"
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
