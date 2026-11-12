import {
  DatePicker,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SkeletonList,
  UserAvatar,
} from '@org/ui';
import { TaskStatus, type PublicUser, type Task } from '@org/types';
import { cn } from '@org/utils';
import { Calendar } from 'lucide-react';
import { useState } from 'react';
import { describeDue, DUE_TEXT_CLASSES } from '../kanban/card-meta.js';
import { PriorityIcon, StatusIcon } from '../kanban/kanban-icons.js';
import { KanbanPriorityPicker } from '../kanban/KanbanPriorityPicker.js';
import { KanbanStatusPicker } from '../kanban/KanbanStatusPicker.js';
import { dayToIso, isoToDay, taskTicket } from '../kanban/server-board.js';
import {
  PROJECT_VIEW_PADDING,
  TaskLabelChips,
  TaskTicket,
  TaskViewEmpty,
} from '../kanban/task-view-parts.js';
import { stateIdOf, useWorkflowStates } from '../kanban/task-states.js';
import type { KanbanCard, Priority } from '../kanban/types.js';

interface ProjectSpreadsheetViewProps {
  tasks: Task[];
  members: PublicUser[];
  onSelectTask: (task: Task) => void;
  onUpdateTask: (taskId: string, patch: Partial<Task>) => void;
  isLoading?: boolean;
  /** True when search or filters are narrowing `tasks`. */
  filtered?: boolean;
  onClearFilters?: () => void;
  onAddTask?: () => void;
}

/** An inline cell control: borderless until hovered, like a spreadsheet cell. */
const CELL_TRIGGER =
  'h-7 px-1.5 gap-1.5 flex w-full min-w-0 items-center rounded-md border border-transparent bg-transparent text-left text-xs text-foreground transition-colors hover:border-border hover:bg-muted/50 focus-visible:border-ring focus-visible:outline-none';

const PRIORITY_LABELS: Record<Priority, string> = {
  URGENT: 'Urgent',
  HIGH: 'High',
  MEDIUM: 'Medium',
  LOW: 'Low',
};

export function ProjectSpreadsheetView({
  tasks,
  members,
  onSelectTask,
  onUpdateTask,
  isLoading = false,
  filtered = false,
  onClearFilters,
  onAddTask,
}: ProjectSpreadsheetViewProps) {
  const { nameOf, patchFor } = useWorkflowStates();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const commitTitle = (task: Task) => {
    const next = editTitle.trim();
    if (next && next !== task.title) onUpdateTask(task.id, { title: next });
    setEditingId(null);
  };

  if (isLoading) {
    return (
      <div className={PROJECT_VIEW_PADDING}>
        <SkeletonList rows={8} />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className={PROJECT_VIEW_PADDING}>
        <TaskViewEmpty
          filtered={filtered}
          onClearFilters={onClearFilters}
          onAddTask={onAddTask}
        />
      </div>
    );
  }

  return (
    <div className={cn(PROJECT_VIEW_PADDING, 'h-full')}>
      <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-xs">
        <div className="px-4 py-2.5 text-xs font-medium flex items-center border-b border-border/60 bg-muted/40 text-muted-foreground">
          {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
        </div>

        <div className="scrollbar-subtle flex-1 overflow-auto">
          <table className="text-xs min-w-240 w-full border-collapse text-left">
            <thead className="top-0 font-medium sticky z-10 border-b border-border/60 bg-muted/60 text-[11px] text-muted-foreground">
              <tr>
                <th className="py-2.5 px-3 w-24">ID</th>
                <th className="py-2.5 px-3 min-w-60">Title</th>
                <th className="py-2.5 px-3 w-36">Status</th>
                <th className="py-2.5 px-3 w-28">Priority</th>
                <th className="py-2.5 px-3 w-40">Assignee</th>
                <th className="py-2.5 px-3 w-32">Due date</th>
                <th className="py-2.5 px-3 w-20">Estimate</th>
                <th className="py-2.5 px-3 w-40">Labels</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {tasks.map((task) => {
                const stateId = stateIdOf(task);
                // Only the two fields describeDue reads.
                const due = describeDue({
                  dueDate: isoToDay(task.dueDate),
                  dueComplete: task.status === TaskStatus.DONE,
                } as KanbanCard);
                const assigneeName =
                  task.assignee?.displayName || task.assignee?.name || '';
                const subDone =
                  task.subItems?.filter((s) => s.status === 'DONE').length ?? 0;
                return (
                  <tr
                    key={task.id}
                    className="group cursor-pointer transition-colors hover:bg-muted/30"
                    onClick={() => onSelectTask(task)}
                  >
                    <td className="py-1.5 px-3">
                      <TaskTicket ticket={taskTicket(task)} />
                    </td>

                    {/* Title: click to edit in place, like a spreadsheet cell. */}
                    <td
                      className="py-1.5 px-3 font-medium text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingId(task.id);
                        setEditTitle(task.title);
                      }}
                    >
                      {editingId === task.id ? (
                        <input
                          autoFocus
                          type="text"
                          aria-label="Task title"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={() => commitTitle(task)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitTitle(task);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="h-7 px-1.5 text-xs w-full rounded-md border border-ring bg-background text-foreground shadow-xs outline-none"
                        />
                      ) : (
                        <div className="gap-2 min-w-0 flex items-center">
                          <span className="truncate" title="Click to rename">
                            {task.title}
                          </span>
                          {task.subItems && task.subItems.length > 0 ? (
                            <span className="shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums">
                              {subDone}/{task.subItems.length}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </td>

                    <td
                      className="py-1.5 px-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <KanbanStatusPicker
                        status={stateId}
                        onStatusChange={(id) =>
                          onUpdateTask(task.id, patchFor(id))
                        }
                        trigger={
                          <button type="button" className={CELL_TRIGGER}>
                            <StatusIcon
                              status={stateId}
                              className="size-3.5"
                              showTooltip={false}
                            />
                            <span className="truncate">{nameOf(stateId)}</span>
                          </button>
                        }
                      />
                    </td>

                    <td
                      className="py-1.5 px-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <KanbanPriorityPicker
                        required
                        priority={task.priority}
                        onPriorityChange={(value) =>
                          onUpdateTask(task.id, {
                            priority: value as Task['priority'],
                          })
                        }
                        trigger={
                          <button type="button" className={CELL_TRIGGER}>
                            <PriorityIcon
                              priority={task.priority}
                              className="size-3.5"
                            />
                            <span className="truncate">
                              {PRIORITY_LABELS[task.priority as Priority] ??
                                task.priority}
                            </span>
                          </button>
                        }
                      />
                    </td>

                    <td
                      className="py-1.5 px-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Select
                        value={task.assigneeId || 'unassigned'}
                        onValueChange={(val) =>
                          onUpdateTask(task.id, {
                            assigneeId: val === 'unassigned' ? null : val,
                          })
                        }
                      >
                        <SelectTrigger
                          aria-label="Assignee"
                          className={cn(CELL_TRIGGER, 'justify-between')}
                        >
                          <span className="gap-1.5 min-w-0 flex items-center">
                            {task.assignee ? (
                              <>
                                <UserAvatar
                                  name={assigneeName}
                                  seed={task.assignee.id}
                                  src={task.assignee.avatarUrl}
                                  size="xs"
                                />
                                <span className="truncate">{assigneeName}</span>
                              </>
                            ) : (
                              <span className="text-muted-foreground">
                                Unassigned
                              </span>
                            )}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {members.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              <span className="gap-2 flex items-center">
                                <UserAvatar
                                  name={m.displayName || m.name}
                                  seed={m.id}
                                  src={m.avatarUrl}
                                  size="xs"
                                />
                                <span>{m.displayName || m.name}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>

                    <td
                      className="py-1.5 px-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DatePicker
                        value={isoToDay(task.dueDate)}
                        onChange={(day) =>
                          onUpdateTask(task.id, {
                            dueDate: day ? dayToIso(day) : null,
                          })
                        }
                        trigger={
                          <button type="button" className={CELL_TRIGGER}>
                            <Calendar className="size-3.5 shrink-0 text-muted-foreground" />
                            {due ? (
                              <span
                                className={cn(
                                  'truncate',
                                  DUE_TEXT_CLASSES[due.tone],
                                )}
                              >
                                {due.label}
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

                    <td
                      className="py-1.5 px-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        key={task.estimate ?? 'none'}
                        type="number"
                        min={0}
                        max={1000}
                        defaultValue={task.estimate ?? ''}
                        placeholder="—"
                        aria-label={`Estimate for ${task.title}`}
                        onBlur={(e) => {
                          const raw = e.target.value.trim();
                          const next = raw === '' ? null : Number(raw);
                          if (next !== (task.estimate ?? null)) {
                            onUpdateTask(task.id, { estimate: next });
                          }
                        }}
                        className="h-7 w-16 px-1.5 text-xs rounded-md border border-transparent bg-transparent text-foreground tabular-nums transition-colors outline-none hover:border-border focus:border-ring"
                      />
                    </td>

                    <td className="py-1.5 px-3">
                      {task.labels && task.labels.length > 0 ? (
                        <TaskLabelChips labels={task.labels} />
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
