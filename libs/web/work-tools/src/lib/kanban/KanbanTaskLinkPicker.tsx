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
import { useMenuSearchField } from './menu-search-field.js';

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
  const searchField = useMenuSearchField();
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
        {...searchField.contentProps}
        align={align}
        className="w-72 p-1.5 shadow-xl rounded-xl border border-border bg-popover text-popover-foreground"
      >
        {header}
        <div className="px-2 py-1 mb-1 relative flex items-center border-b border-border/60">
          <Search className="size-3.5 mr-2 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={placeholder}
            className="text-xs p-0 w-full border-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground focus:ring-0"
            {...searchField.inputProps}
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

        <div className="max-h-56 space-y-0.5 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-xs text-center text-muted-foreground">
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
                  'gap-2.5 px-2.5 py-1.5 text-xs flex w-full cursor-pointer items-center rounded-lg text-left transition-colors',
                  'text-foreground/90 hover:bg-accent/60',
                )}
              >
                <StatusIcon
                  status={task.status}
                  className="size-3.5 shrink-0"
                />
                {task.identifier && (
                  <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {task.identifier}
                  </span>
                )}
                <span className="font-medium truncate">{task.title}</span>
              </button>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
