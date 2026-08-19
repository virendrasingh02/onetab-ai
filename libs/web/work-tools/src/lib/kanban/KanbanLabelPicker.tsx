import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@org/ui';
import { cn } from '@org/utils';
import { Check, Plus, Search, Tag } from 'lucide-react';
import React, { useState } from 'react';
import { useKanbanCustomStore } from './kanban-custom-store.js';

export interface KanbanLabelPickerProps {
  selectedLabels: string[];
  onToggleLabel: (labelName: string) => void;
  trigger?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
}

const PRESET_COLORS = [
  '#8b5cf6',
  '#3b82f6',
  '#10b981',
  '#ef4444',
  '#f59e0b',
  '#06b6d4',
  '#ec4899',
  '#64748b',
];

export function KanbanLabelPicker({
  selectedLabels,
  onToggleLabel,
  trigger,
  align = 'start',
}: KanbanLabelPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const labels = useKanbanCustomStore((s) => s.labels);
  const addLabel = useKanbanCustomStore((s) => s.addLabel);

  const filteredLabels = labels.filter((l) =>
    l.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const handleCreateLabel = () => {
    const name = search.trim();
    if (!name) return;
    const randomColor =
      PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
    addLabel({ name, color: randomColor });
    onToggleLabel(name);
    setSearch('');
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
          >
            <Tag className="size-3.5" />
            <span>Add label</span>
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={align}
        className="w-56 p-1.5 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl animate-in fade-in zoom-in-95"
      >
        {/* Search input */}
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border/60 bg-muted/30 mb-1">
          <Search className="size-3.5 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search or create label..."
            className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
            autoFocus
          />
        </div>

        {/* Labels list */}
        <div className="max-h-48 overflow-y-auto space-y-0.5 no-scrollbar">
          {filteredLabels.map((item) => {
            const isSelected = selectedLabels.includes(item.name);
            return (
              <DropdownMenuItem
                key={item.id}
                onSelect={(e) => {
                  e.preventDefault();
                  onToggleLabel(item.name);
                }}
                className={cn(
                  'flex items-center justify-between px-2 py-1 rounded-md text-xs cursor-pointer transition-colors',
                  isSelected
                    ? 'bg-accent font-semibold text-foreground'
                    : 'text-foreground/80 hover:bg-accent/60',
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate">{item.name}</span>
                </div>

                {isSelected && (
                  <Check className="size-3.5 text-primary shrink-0" />
                )}
              </DropdownMenuItem>
            );
          })}

          {filteredLabels.length === 0 && search.trim() && (
            <DropdownMenuItem
              onSelect={handleCreateLabel}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs cursor-pointer text-primary hover:bg-primary/10 font-medium"
            >
              <Plus className="size-3.5" />
              <span>Create "{search.trim()}"</span>
            </DropdownMenuItem>
          )}

          {filteredLabels.length === 0 && !search.trim() && (
            <div className="py-2 text-center text-[11px] text-muted-foreground">
              No labels found
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
