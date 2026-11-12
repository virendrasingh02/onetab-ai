/**
 * The small pieces every project task view (Board, List, Table, Timeline,
 * Overview) draws the same way, so a ticket, a label or an empty view looks
 * identical whichever tab it is on.
 */
import { Button, EmptyState } from '@org/ui';
import { cn } from '@org/utils';
import { FilterX, ListTodo, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { useKanbanLabels } from './kanban-custom-store.js';

/** Page padding shared by every project tab, so switching tabs never shifts the content. */
export const PROJECT_VIEW_PADDING = 'px-4 sm:px-6 py-4';

/** A task's ticket id (`UTP-10`), in the board card's style. */
export function TaskTicket({
  ticket,
  className,
}: {
  ticket: string | null | undefined;
  className?: string;
}) {
  if (!ticket) return null;
  return (
    <span
      className={cn(
        'font-medium tracking-tight shrink-0 font-mono text-[11px] text-muted-foreground tabular-nums',
        className,
      )}
    >
      {ticket}
    </span>
  );
}

/** A task label in its catalog colour, as the board card draws it. */
export function TaskLabelChip({ name }: { name: string }) {
  const { colorOf } = useKanbanLabels();
  const color = colorOf(name);
  return (
    <span
      className="theme-fixed h-5 max-w-32 px-1.5 gap-1 font-medium inline-flex shrink-0 items-center rounded-sm border text-[11px] whitespace-nowrap"
      style={{
        backgroundColor: `${color}15`,
        borderColor: `${color}35`,
        color,
      }}
      title={name}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="truncate">{name}</span>
    </span>
  );
}

/** Up to `max` label chips, then a `+N` count. */
export function TaskLabelChips({
  labels,
  max = 2,
  className,
}: {
  labels: readonly string[];
  max?: number;
  className?: string;
}) {
  if (labels.length === 0) return null;
  const rest = labels.length - max;
  return (
    <span className={cn('gap-1 min-w-0 flex items-center', className)}>
      {labels.slice(0, max).map((label) => (
        <TaskLabelChip key={label} name={label} />
      ))}
      {rest > 0 ? (
        <span
          className="text-[11px] text-muted-foreground tabular-nums"
          title={labels.slice(max).join(', ')}
        >
          +{rest}
        </span>
      ) : null}
    </span>
  );
}

export interface TaskViewEmptyProps {
  /** True when the search box or filter menu is narrowing the view. */
  filtered: boolean;
  onClearFilters?: () => void;
  onAddTask?: () => void;
  /** What an unfiltered empty view says, e.g. "No tasks scheduled". */
  title?: string;
  description?: string;
  icon?: ReactNode;
  className?: string;
}

/**
 * One empty state for every task view. A filtered view offers to clear the
 * filters; an empty project offers to add the first task.
 */
export function TaskViewEmpty({
  filtered,
  onClearFilters,
  onAddTask,
  title = 'No tasks yet',
  description = 'Add the first task to start tracking work in this project.',
  icon,
  className,
}: TaskViewEmptyProps) {
  if (filtered) {
    return (
      <EmptyState
        className={className}
        icon={<FilterX />}
        title="No tasks match your filters"
        description="Try a different search, or clear the filters to see every task."
        action={
          onClearFilters ? (
            <Button variant="outline" size="sm" onClick={onClearFilters}>
              <FilterX className="size-3.5" />
              Clear filters
            </Button>
          ) : undefined
        }
      />
    );
  }
  return (
    <EmptyState
      className={className}
      icon={icon ?? <ListTodo />}
      title={title}
      description={description}
      action={
        onAddTask ? (
          <Button size="sm" onClick={onAddTask}>
            <Plus className="size-3.5" />
            Add task
          </Button>
        ) : undefined
      }
    />
  );
}
