import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  UserAvatar,
} from '@org/ui';
import { TaskPriority, TaskStatus, type PublicUser, type Task } from '@org/types';
import { Calendar, Plus } from 'lucide-react';
import { useState } from 'react';
import { PriorityIcon, StatusIcon } from '../kanban/kanban-icons.js';
import { STATUS_TITLES } from '../kanban/server-board.js';

interface ProjectSpreadsheetViewProps {
  tasks: Task[];
  members: PublicUser[];
  onSelectTask: (task: Task) => void;
  onUpdateTask: (taskId: string, patch: Partial<Task>) => void;
  onQuickAddTask?: () => void;
  searchQuery?: string;
}

export function ProjectSpreadsheetView({
  tasks,
  members,
  onSelectTask,
  onUpdateTask,
  onQuickAddTask,
  searchQuery = '',
}: ProjectSpreadsheetViewProps) {
  const [editingCell, setEditingCell] = useState<{
    taskId: string;
    field: string;
  } | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const filteredTasks = tasks.filter((t) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(query) ||
      (t.identifier && t.identifier.toLowerCase().includes(query)) ||
      (t.description && t.description.toLowerCase().includes(query))
    );
  });

  const handleTitleBlur = (taskId: string) => {
    if (editTitle.trim()) {
      onUpdateTask(taskId, { title: editTitle.trim() });
    }
    setEditingCell(null);
  };

  return (
    <div className="flex flex-col w-full h-full bg-background border border-border/60 rounded-xl overflow-hidden shadow-xs select-none">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40 border-b border-border/60 text-xs font-semibold text-muted-foreground">
        <div className="flex items-center gap-2">
          <span>{filteredTasks.length} work items</span>
        </div>
        {onQuickAddTask && (
          <Button
            size="xs"
            variant="ghost"
            onClick={onQuickAddTask}
            className="gap-1.5 text-xs text-primary hover:text-primary"
          >
            <Plus className="size-3.5" />
            Add Row
          </Button>
        )}
      </div>

      {/* Spreadsheet Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="bg-muted/60 sticky top-0 z-10 border-b border-border/80 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            <tr>
              <th className="py-2.5 px-3 w-28">Identifier</th>
              <th className="py-2.5 px-3 min-w-[240px]">Title</th>
              <th className="py-2.5 px-3 w-36">Status</th>
              <th className="py-2.5 px-3 w-32">Priority</th>
              <th className="py-2.5 px-3 w-40">Assignee</th>
              <th className="py-2.5 px-3 w-32">Due Date</th>
              <th className="py-2.5 px-3 w-24">Estimate</th>
              <th className="py-2.5 px-3 w-36">Labels</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40 font-mono text-xs">
            {filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-muted-foreground font-sans">
                  No work items found matching your filter
                </td>
              </tr>
            ) : (
              filteredTasks.map((task) => (
                <tr
                  key={task.id}
                  className="hover:bg-muted/30 group transition-colors cursor-pointer"
                  onClick={() => onSelectTask(task)}
                >
                  {/* Identifier */}
                  <td className="py-2 px-3 font-semibold text-primary shrink-0">
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] bg-primary/10 text-primary px-1.5 py-0.5 rounded border border-primary/20">
                      {task.identifier || `TASK-${task.ticketNumber ?? ''}`}
                    </span>
                  </td>

                  {/* Title */}
                  <td
                    className="py-2 px-3 font-sans text-foreground font-medium"
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
                        className="w-full bg-background border border-primary rounded px-1.5 py-0.5 text-xs text-foreground outline-none shadow-xs font-sans"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="truncate">{task.title}</span>
                        {task.subItems && task.subItems.length > 0 && (
                          <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1.5 py-0.2 rounded">
                            {task.subItems.filter((s) => s.status === 'DONE').length}/
                            {task.subItems.length}
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
                    <Select
                      value={task.status}
                      onValueChange={(val) =>
                        onUpdateTask(task.id, { status: val as TaskStatus })
                      }
                    >
                      <SelectTrigger className="h-6 text-xs border-transparent hover:border-border bg-transparent hover:bg-muted/50 p-1 w-full justify-between gap-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <StatusIcon status={task.status} className="size-3.5" />
                          <span className="text-xs truncate">
                            {STATUS_TITLES[task.status] || task.status}
                          </span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(TaskStatus).map((st) => (
                          <SelectItem key={st} value={st}>
                            <div className="flex items-center gap-2">
                              <StatusIcon status={st} className="size-3.5" />
                              <span>{STATUS_TITLES[st] || st}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>

                  {/* Priority */}
                  <td
                    className="py-2 px-3 font-sans"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Select
                      value={task.priority}
                      onValueChange={(val) =>
                        onUpdateTask(task.id, { priority: val as TaskPriority })
                      }
                    >
                      <SelectTrigger className="h-6 text-xs border-transparent hover:border-border bg-transparent hover:bg-muted/50 p-1 w-full justify-between gap-1">
                        <div className="flex items-center gap-1.5 truncate">
                          <PriorityIcon priority={task.priority} className="size-3.5" />
                          <span className="text-xs truncate capitalize">
                            {task.priority.toLowerCase()}
                          </span>
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(TaskPriority).map((pr) => (
                          <SelectItem key={pr} value={pr}>
                            <div className="flex items-center gap-2">
                              <PriorityIcon priority={pr} className="size-3.5" />
                              <span className="capitalize">{pr.toLowerCase()}</span>
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
                      <SelectTrigger className="h-6 text-xs border-transparent hover:border-border bg-transparent hover:bg-muted/50 p-1 w-full justify-between gap-1">
                        <div className="flex items-center gap-1.5 truncate">
                          {task.assignee ? (
                            <>
                              <UserAvatar
                                name={task.assignee.displayName || task.assignee.name}
                                seed={task.assignee.id}
                                src={task.assignee.avatarUrl}
                                size="xs"
                                className="size-4"
                              />
                              <span className="text-xs truncate">
                                {task.assignee.displayName || task.assignee.name}
                              </span>
                            </>
                          ) : (
                            <span className="text-muted-foreground text-xs">
                              Unassigned
                            </span>
                          )}
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">Unassigned</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            <div className="flex items-center gap-2">
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
                  <td className="py-2 px-3 font-sans text-muted-foreground text-xs">
                    {task.dueDate ? (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="size-3" />
                        {new Date(task.dueDate).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>

                  {/* Estimate */}
                  <td className="py-2 px-3 font-mono text-muted-foreground text-xs">
                    {task.estimate != null ? (
                      <span className="bg-muted/60 px-1.5 py-0.5 rounded border border-border/40">
                        {task.estimate} pts
                      </span>
                    ) : (
                      <span className="text-muted-foreground/50">—</span>
                    )}
                  </td>

                  {/* Labels */}
                  <td className="py-2 px-3 font-sans">
                    <div className="flex items-center gap-1 overflow-hidden">
                      {task.labels && task.labels.length > 0 ? (
                        task.labels.slice(0, 2).map((lbl) => (
                          <span
                            key={lbl}
                            className="bg-muted/80 text-[10px] text-muted-foreground px-1.5 py-0.5 rounded border border-border/40 truncate max-w-[80px]"
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
  );
}
