import type { TaskStatus } from '@org/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@org/ui';
import { cn } from '@org/utils';
import { Search, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { StatusIcon } from './kanban-icons.js';

export interface KanbanTaskLinkOption {
  id: string;
  title: string;
  identifier?: string | null;
  status: TaskStatus;
}

export interface KanbanTaskLinkPickerProps {
  options: KanbanTaskLinkOption[];
  /** Ids to hide from the list — the card itself, and anything picking it would cycle through. */
  excludeIds?: string[];
  onSelect: (task: KanbanTaskLinkOption) => void;
  trigger: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  placeholder?: string;
  emptyMessage?: string;
  /** Extra content above the search box — the relation-type picker uses this for its type select. */
  header?: React.ReactNode;
}

/**
 * Searches this project's other tasks — used for both "Parent" and for
 * picking a relation's other end. A plain filtered list rather than a server
 * search: `useTasks` for the project is already cached by the board, so this
 * adds no request.
 */
export function KanbanTaskLinkPicker({
  options,
  excludeIds = [],
  onSelect,
  trigger,
  align = 'start',
  placeholder = 'Search tasks...',
  emptyMessage = 'No tasks found',
  header,
}: KanbanTaskLinkPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options
      .filter((task) => !excluded.has(task.id))
      .filter((task) => {
        if (!q) return true;
        return (
          task.title.toLowerCase().includes(q) ||
          (task.identifier ?? '').toLowerCase().includes(q)
        );
      })
      .slice(0, 50);
  }, [options, excluded, query]);

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery('');
      }}
    >
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>

      <DropdownMenuContent
        align={align}
        className="w-72 p-1.5 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl"
      >
        {header}
        <div className="relative flex items-center px-2 py-1 border-b border-border/60 mb-1">
          <Search className="size-3.5 text-muted-foreground shrink-0 mr-2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none border-none p-0 focus:ring-0"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        <div className="max-h-56 overflow-y-auto space-y-0.5">
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-center text-xs text-muted-foreground">
              {emptyMessage}
            </div>
          ) : (
            filtered.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => {
                  onSelect(task);
                  setOpen(false);
                  setQuery('');
                }}
                className={cn(
                  'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors text-left',
                  'text-foreground/90 hover:bg-accent/60',
                )}
              >
                <StatusIcon status={task.status} className="size-3.5 shrink-0" />
                {task.identifier && (
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                    {task.identifier}
                  </span>
                )}
                <span className="truncate font-medium">{task.title}</span>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
