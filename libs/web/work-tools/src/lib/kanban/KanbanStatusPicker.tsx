import { type TaskStatus } from '@org/types';
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
import { useKanbanCustomStore } from './kanban-custom-store.js';
import { StatusIcon } from './kanban-icons.js';

export interface KanbanStatusPickerProps {
  status: TaskStatus | string;
  onStatusChange: (status: TaskStatus) => void;
  trigger?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
}

export function KanbanStatusPicker({
  status,
  onStatusChange,
  trigger,
  align = 'start',
}: KanbanStatusPickerProps) {
  const [open, setOpen] = React.useState(false);
  const customStatuses = useKanbanCustomStore((s) => s.statuses);

  // Keyboard shortcut listener when open
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      const match = customStatuses.find((item) => item.key === e.key);
      if (match) {
        e.preventDefault();
        onStatusChange(match.id as TaskStatus);
        setOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onStatusChange, customStatuses]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="flex items-center justify-center size-6 rounded-md hover:bg-muted/80 text-muted-foreground transition-colors cursor-pointer"
            aria-label="Change status"
          >
            <StatusIcon status={status as TaskStatus} />
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={align}
        className="w-56 p-1.5 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl animate-in fade-in zoom-in-95"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-2.5 py-1.5 mb-1 text-xs text-muted-foreground">
          <span className="font-medium text-[12px]">Change status...</span>
          <KbdShortcut shortcut="P then S" size="xs" variant="muted" />
        </div>

        {/* List items */}
        <div className="space-y-0.5">
          {customStatuses.map((item) => {
            const isSelected = item.id === status;
            return (
              <DropdownMenuItem
                key={item.id}
                onSelect={() => onStatusChange(item.id as TaskStatus)}
                className={cn(
                  'flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer font-medium transition-colors',
                  isSelected
                    ? 'bg-accent text-foreground'
                    : 'text-foreground/85 hover:bg-accent/60',
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <StatusIcon status={item.id as TaskStatus} className="size-4" />
                  <span className="truncate">{item.label}</span>
                </div>

                <div className="flex items-center gap-2 text-muted-foreground/80">
                  {isSelected && (
                    <Check className="size-3.5 text-foreground shrink-0 stroke-[2.5]" />
                  )}
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground/70">
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
