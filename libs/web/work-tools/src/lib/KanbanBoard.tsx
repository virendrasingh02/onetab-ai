import type { Accent } from '@org/design-system';
import {
  accentClasses,
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Input,
  Label,
  Page,
  PageHeader,
} from '@org/ui';
import { cn } from '@org/utils';
import { CheckSquare, Plus, User } from 'lucide-react';
import { useState } from 'react';

export interface TaskItem {
  id: string;
  title: string;
  description?: string;
  status: 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assigneeName?: string;
  dueDate?: string;
}

type Status = TaskItem['status'];

const COLUMNS: Array<{ id: Status; title: string; accent?: Accent }> = [
  { id: 'TODO', title: 'To do' },
  { id: 'IN_PROGRESS', title: 'In progress', accent: 'blue' },
  { id: 'IN_REVIEW', title: 'In review', accent: 'violet' },
  { id: 'DONE', title: 'Done', accent: 'green' },
];

const initialTasks: TaskItem[] = [
  {
    id: '1',
    title: 'Setup Qdrant Vector Collection',
    description: 'Configure workspace_docs collection for RAG embeddings',
    status: 'DONE',
    priority: 'HIGH',
    assigneeName: 'Admin',
  },
  {
    id: '2',
    title: 'Implement Kanban Board Interface',
    description: 'Build drag-and-drop task columns for agile management',
    status: 'IN_PROGRESS',
    priority: 'URGENT',
    assigneeName: 'Dev User',
  },
  {
    id: '3',
    title: 'Connect Ollama Model Runner',
    description: 'Enable local LLM inference with nomic-embed-text',
    status: 'TODO',
    priority: 'MEDIUM',
    assigneeName: 'Dev User',
  },
  {
    id: '4',
    title: 'Document & Wiki Hierarchy',
    description: 'Notion-like block editor and page nesting',
    status: 'TODO',
    priority: 'HIGH',
  },
];

export function KanbanBoard() {
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAddTask = () => {
    const title = newTaskTitle.trim();
    if (!title) return;

    setTasks((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        title,
        status: 'TODO',
        priority: 'MEDIUM',
        assigneeName: 'You',
      },
    ]);
    setNewTaskTitle('');
    setDialogOpen(false);
  };

  const moveTask = (taskId: string, status: Status) => {
    setTasks((prev) =>
      prev.map((task) => (task.id === taskId ? { ...task, status } : task)),
    );
  };

  return (
    <Page width="full">
      <PageHeader
        title="Tasks"
        description="Plan and track work across your workspace."
        icon={<CheckSquare />}
        accent="blue"
        actions={
          <Button leadingIcon={<Plus />} onClick={() => setDialogOpen(true)}>
            New task
          </Button>
        }
      />

      <div className="gap-4 md:grid-cols-2 xl:grid-cols-4 grid grid-cols-1">
        {COLUMNS.map((column) => {
          const columnTasks = tasks.filter((task) => task.status === column.id);

          return (
            <section
              key={column.id}
              aria-labelledby={`column-${column.id}`}
              className="p-3 flex flex-col rounded-xl border bg-surface-muted"
            >
              <div className="mb-3 gap-2 pb-2 flex items-center justify-between border-b">
                <h2
                  id={`column-${column.id}`}
                  className={cn(
                    'pl-2 text-sm font-semibold border-l-2',
                    column.accent
                      ? cn(
                          accentClasses[column.accent].text,
                          accentClasses[column.accent].border,
                        )
                      : 'border-border-strong text-muted-foreground',
                  )}
                >
                  {column.title}
                </h2>
                <Badge variant="neutral" className="rounded-full tabular-nums">
                  {columnTasks.length}
                </Badge>
              </div>

              <ul className="scrollbar-subtle min-h-24 space-y-2 flex-1 overflow-y-auto">
                {columnTasks.length === 0 ? (
                  <li>
                    <EmptyState
                      size="sm"
                      title="Nothing here"
                      description="Move a task in."
                    />
                  </li>
                ) : (
                  columnTasks.map((task) => (
                    <li
                      key={task.id}
                      className={cn(
                        'p-3 shadow-xs rounded-lg border bg-surface',
                        'transition-colors duration-(--duration-fast) hover:border-border-strong',
                      )}
                    >
                      <h3 className="mb-1 text-sm font-medium text-foreground">
                        {task.title}
                      </h3>
                      {task.description ? (
                        <p className="mb-3 text-xs line-clamp-2 text-muted-foreground">
                          {task.description}
                        </p>
                      ) : null}

                      <div className="gap-2 pt-2 text-xs flex items-center justify-between border-t text-muted-foreground">
                        <span className="min-w-0 gap-1 flex items-center">
                          <User className="size-3 shrink-0" aria-hidden />
                          <span className="truncate">
                            {task.assigneeName ?? 'Unassigned'}
                          </span>
                        </span>

                        <div className="gap-1 flex shrink-0">
                          {COLUMNS.filter(
                            (target) => target.id !== column.id,
                          ).map((target) => (
                            <Button
                              key={target.id}
                              variant="ghost"
                              size="icon-sm"
                              className="size-6 text-[10px]"
                              onClick={() => moveTask(task.id, target.id)}
                              title={`Move “${task.title}” to ${target.title}`}
                            >
                              <span aria-hidden>{target.title[0]}</span>
                              <span className="sr-only">
                                Move “{task.title}” to {target.title}
                              </span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </section>
          );
        })}
      </div>

      {/*
        Radix Dialog rather than a bare overlay div: focus is trapped inside,
        Escape and outside-click dismiss, and focus returns to the trigger.
      */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleAddTask();
            }}
          >
            <DialogHeader>
              <DialogTitle>Create a task</DialogTitle>
              <DialogDescription>
                It will be added to the “To do” column.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2 px-6 py-4">
              <Label htmlFor="task-title">Title</Label>
              <Input
                id="task-title"
                value={newTaskTitle}
                onChange={(event) => setNewTaskTitle(event.target.value)}
                placeholder="What needs doing?"
                autoFocus
                required
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={!newTaskTitle.trim()}>
                Create task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Page>
  );
}
