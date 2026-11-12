import {
  DatePicker,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  UserAvatar,
} from '@org/ui';
import { TaskPriority, type PublicUser, type Task } from '@org/types';
import { useState } from 'react';
import { PriorityIcon, StatusIcon } from '../kanban/kanban-icons.js';
import { KanbanStatusPicker } from '../kanban/KanbanStatusPicker.js';
import { dayToIso, isoToDay, taskTicket } from '../kanban/server-board.js';
import { stateIdOf, useWorkflowStates } from '../kanban/task-states.js';

interface ProjectSpreadsheetViewProps {
  tasks: Task[];
  members: PublicUser[];
  onSelectTask: (task: Task) => void;
  onUpdateTask: (taskId: string, patch: Partial<Task>) => void;
}

export function ProjectSpreadsheetView({
  tasks,
  members,
  onSelectTask,
  onUpdateTask,
}: ProjectSpreadsheetViewProps) {
  const { nameOf, patchFor } = useWorkflowStates();
  const [editingCell, setEditingCell] = useState<{
    taskId: string;
    field: string;
  } | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const filteredTasks = tasks;

  const handleTitleBlur = (taskId: string) => {
    if (editTitle.trim()) {
      onUpdateTask(taskId, { title: editTitle.trim() });
    }
    setEditingCell(null);
  };

  return (
    <div className="p-4 h-full">
      <div className="flex h-full w-full flex-col overflow-hidden rounded-xl border border-border/60 bg-background shadow-xs select-none">
        {/* Header bar */}
        <div className="px-4 py-2.5 text-xs font-medium flex items-center border-b border-border/60 bg-muted/40 text-muted-foreground">
          {filteredTasks.length} {filteredTasks.length === 1 ? 'task' : 'tasks'}
        </div>

        {/* Spreadsheet Table */}
        <div className="flex-1 overflow-auto">
          <table className="text-xs w-full border-collapse text-left">
            <thead className="top-0 font-medium sticky z-10 border-b border-border/80 bg-muted/60 text-[11px] text-muted-foreground">
              <tr>
                <th className="py-2.5 px-3 w-28">ID</th>
                <th className="py-2.5 px-3 min-w-[240px]">Title</th>
                <th className="py-2.5 px-3 w-36">Status</th>
                <th className="py-2.5 px-3 w-32">Priority</th>
                <th className="py-2.5 px-3 w-40">Assignee</th>
                <th className="py-2.5 px-3 w-40">Due date</th>
                <th className="py-2.5 px-3 w-24">Estimate</th>
                <th className="py-2.5 px-3 w-36">Labels</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-border/40">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="py-12 text-center font-sans text-muted-foreground"
                  >
                    No tasks to show
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => (
                  <tr
                    key={task.id}
                    className="group cursor-pointer transition-colors hover:bg-muted/30"
                    onClick={() => onSelectTask(task)}
                  >
                    {/* Identifier */}
                    <td className="py-2 px-3 font-semibold shrink-0 text-primary">
                      <span className="gap-1 px-1.5 py-0.5 rounded inline-flex items-center border border-brand/20 bg-brand/10 font-mono text-[11px] text-brand-text">
                        {taskTicket(task)}
                      </span>
                    </td>

                    {/* Title */}
                    <td
                      className="py-2 px-3 font-medium font-sans text-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCell({ taskId: task.id, field: 'title' });
                        setEditTitle(task.title);
                      }}
                    >
                      {editingCell?.taskId === task.id &&
                      editingCell.field === 'title' ? (
                        <input
                          autoFocus
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onBlur={() => handleTitleBlur(task.id)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleTitleBlur(task.id);
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="rounded px-1.5 py-0.5 text-xs w-full border border-primary bg-background font-sans text-foreground shadow-xs outline-none"
                        />
                      ) : (
                        <div className="gap-2 flex items-center">
                          <span className="truncate">{task.title}</span>
                          {task.subItems && task.subItems.length > 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-muted font-mono text-[10px] text-muted-foreground">
                              {
                                task.subItems.filter((s) => s.status === 'DONE')
                                  .length
                              }
                              /{task.subItems.length}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td
                      className="py-2 px-3 font-sans"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <KanbanStatusPicker
                        status={stateIdOf(task)}
                        onStatusChange={(id) =>
                          onUpdateTask(task.id, patchFor(id))
                        }
                        trigger={
                          <button
                            type="button"
                            className="h-6 text-xs p-1 gap-1.5 flex w-full items-center rounded-md border border-transparent bg-transparent text-left hover:border-border hover:bg-muted/50"
                          >
                            <StatusIcon
                              status={stateIdOf(task)}
                              className="size-3.5"
                              showTooltip={false}
                            />
                            <span className="text-xs truncate">
                              {nameOf(stateIdOf(task))}
                            </span>
                          </button>
                        }
                      />
                    </td>

                    {/* Priority */}
                    <td
                      className="py-2 px-3 font-sans"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Select
                        value={task.priority}
                        onValueChange={(val) =>
                          onUpdateTask(task.id, {
                            priority: val as TaskPriority,
                          })
                        }
                      >
                        <SelectTrigger className="h-6 text-xs p-1 gap-1 w-full justify-between border-transparent bg-transparent hover:border-border hover:bg-muted/50">
                          <div className="gap-1.5 flex items-center truncate">
                            <PriorityIcon
                              priority={task.priority}
                              className="size-3.5"
                            />
                            <span className="text-xs truncate capitalize">
                              {task.priority.toLowerCase()}
                            </span>
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(TaskPriority).map((pr) => (
                            <SelectItem key={pr} value={pr}>
                              <div className="gap-2 flex items-center">
                                <PriorityIcon
                                  priority={pr}
                                  className="size-3.5"
                                />
                                <span className="capitalize">
                                  {pr.toLowerCase()}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>

                    {/* Assignee */}
                    <td
                      className="py-2 px-3 font-sans"
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
                        <SelectTrigger className="h-6 text-xs p-1 gap-1 w-full justify-between border-transparent bg-transparent hover:border-border hover:bg-muted/50">
                          <div className="gap-1.5 flex items-center truncate">
                            {task.assignee ? (
                              <>
                                <UserAvatar
                                  name={
                                    task.assignee.displayName ||
                                    task.assignee.name
                                  }
                                  seed={task.assignee.id}
                                  src={task.assignee.avatarUrl}
                                  size="xs"
                                  className="size-4"
                                />
                                <span className="text-xs truncate">
                                  {task.assignee.displayName ||
                                    task.assignee.name}
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                Unassigned
                              </span>
                            )}
                          </div>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {members.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              <div className="gap-2 flex items-center">
                                <UserAvatar
                                  name={m.displayName || m.name}
                                  seed={m.id}
                                  src={m.avatarUrl}
                                  size="xs"
                                  className="size-4"
                                />
                                <span>{m.displayName || m.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>

                    {/* Due Date */}
                    <td
                      className="py-1 px-3 text-xs font-sans"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DatePicker
                        value={isoToDay(task.dueDate)}
                        onChange={(day) =>
                          onUpdateTask(task.id, {
                            dueDate: day ? dayToIso(day) : null,
                          })
                        }
                        placeholder="No date"
                        className="[&_button]:h-6 [&_button]:px-1 [&_button]:text-xs w-full [&_button]:border-transparent [&_button]:bg-transparent [&_button]:shadow-none [&_button]:hover:border-border"
                      />
                    </td>

                    {/* Estimate */}
                    <td
                      className="py-1 px-3 text-xs"
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
                        className="h-6 w-16 rounded px-1 border border-transparent bg-transparent text-foreground tabular-nums outline-none hover:border-border focus:border-primary"
                      />
                    </td>

                    {/* Labels */}
                    <td className="py-2 px-3 font-sans">
                      <div className="gap-1 flex items-center overflow-hidden">
                        {task.labels && task.labels.length > 0 ? (
                          task.labels.slice(0, 2).map((lbl) => (
                            <span
                              key={lbl}
                              className="px-1.5 py-0.5 rounded max-w-[80px] truncate border border-border/40 bg-muted/80 text-[10px] text-muted-foreground"
                            >
                              {lbl}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
