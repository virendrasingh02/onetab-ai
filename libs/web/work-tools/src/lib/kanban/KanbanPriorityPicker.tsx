import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  KbdShortcut,
} from '@org/ui';
import { cn } from '@org/utils';
import { Check } from 'lucide-react';
import React, { useEffect } from 'react';
import { KANBAN_PRIORITIES } from './kanban-custom-store.js';
import { PriorityIcon } from './kanban-icons.js';
import type { Priority } from './types.js';

export type PriorityOption = Priority | 'NO_PRIORITY' | string;

export interface KanbanPriorityPickerProps {
  priority: PriorityOption;
  onPriorityChange: (priority: PriorityOption) => void;
  trigger?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  /** Drops "No priority": a saved task always has one, so it can't be stored. */
  required?: boolean;
}

export function KanbanPriorityPicker({
  priority,
  onPriorityChange,
  trigger,
  align = 'start',
  required = false,
}: KanbanPriorityPickerProps) {
  const [open, setOpen] = React.useState(false);
  const customPriorities = React.useMemo(
    () =>
      required
        ? KANBAN_PRIORITIES.filter((item) => item.id !== 'NO_PRIORITY')
        : KANBAN_PRIORITIES,
    [required],
  );

  // Keyboard shortcut listener when open
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      const match = customPriorities.find((item) => item.key === e.key);
      if (match) {
        e.preventDefault();
        onPriorityChange(match.id as PriorityOption);
        setOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onPriorityChange, customPriorities]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="size-6 flex cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/80"
            aria-label="Change priority"
          >
            <PriorityIcon priority={priority as Priority} />
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={align}
        className="w-56 p-1.5 shadow-xl rounded-xl border border-border bg-popover text-popover-foreground"
      >
        {/* Header */}
        <div className="px-2.5 py-1.5 mb-1 text-xs flex items-center justify-between text-muted-foreground">
          <span className="font-medium text-[12px]">Change priority...</span>
          <KbdShortcut shortcut="P then P" size="xs" variant="muted" />
        </div>

        {/* List items */}
        <div className="space-y-0.5">
          {customPriorities.map((item) => {
            const isSelected = item.id === priority;
            return (
              <DropdownMenuItem
                key={item.id}
                onSelect={() => onPriorityChange(item.id as PriorityOption)}
                className={cn(
                  'px-2.5 py-1.5 text-xs font-medium flex cursor-pointer items-center justify-between rounded-lg transition-colors',
                  isSelected
                    ? 'bg-accent text-foreground'
                    : 'text-foreground/85 hover:bg-accent/60',
                )}
              >
                <div className="gap-2.5 min-w-0 flex items-center">
                  <PriorityIcon
                    priority={item.id as Priority}
                    className="size-4"
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                <div className="gap-2 flex items-center text-muted-foreground/80">
                  {isSelected && (
                    <Check className="size-3.5 shrink-0 stroke-[2.5] text-foreground" />
                  )}
                  <span className="font-mono text-[11px] text-muted-foreground/70 tabular-nums">
                    {item.key}
                  </span>
                </div>
              </DropdownMenuItem>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
