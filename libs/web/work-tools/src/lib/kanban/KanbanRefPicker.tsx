import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@org/ui';
import { cn } from '@org/utils';
import { Check, Search, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';

export interface KanbanRefPickerItem {
  id: string;
  label: string;
  /** Swatch colour; omitted items fall back to a neutral dot. */
  color?: string | null;
  /** Small trailing hint, e.g. a cycle's status. */
  sublabel?: string;
}

export interface KanbanRefPickerProps {
  items: KanbanRefPickerItem[];
  selectedId?: string | null;
  onSelect: (id: string | null) => void;
  trigger: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  /** Shown above the list and as the clear-selection row's label. */
  noneLabel?: string;
  emptyMessage?: string;
  /** Below this count the search box is skipped — the list is already short. */
  searchThreshold?: number;
}

/**
 * A single-select dropdown over a short reference list (Team, Epic, Module,
 * Cycle, …) — the same visual language as `KanbanStatusPicker` /
 * `KanbanPriorityPicker`, generalised so those four don't need four near-
 * identical copies of this file.
 */
export function KanbanRefPicker({
  items,
  selectedId,
  onSelect,
  trigger,
  align = 'start',
  noneLabel = 'None',
  emptyMessage = 'Nothing to pick from yet',
  searchThreshold = 8,
}: KanbanRefPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.label.toLowerCase().includes(q));
  }, [items, query]);

  const showSearch = items.length > searchThreshold;

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
        className="w-56 p-1.5 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl"
      >
        {showSearch && (
          <div className="relative flex items-center px-2 py-1 border-b border-border/60 mb-1">
            <Search className="size-3.5 text-muted-foreground shrink-0 mr-2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search..."
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
        )}

        <div className="space-y-0.5 max-h-56 overflow-y-auto">
          <button
            type="button"
            onClick={() => {
              onSelect(null);
              setOpen(false);
            }}
            className={cn(
              'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer font-medium transition-colors',
              !selectedId
                ? 'bg-accent text-foreground'
                : 'text-foreground/85 hover:bg-accent/60',
            )}
          >
            <span className="flex items-center gap-2.5 min-w-0 text-muted-foreground">
              <span className="size-4 rounded-full border border-dashed border-muted-foreground/50 shrink-0" />
              <span className="truncate">{noneLabel}</span>
            </span>
            {!selectedId && <Check className="size-3.5 text-foreground shrink-0 stroke-[2.5]" />}
          </button>

          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-center text-xs text-muted-foreground">
              {items.length === 0 ? emptyMessage : 'No matches'}
            </div>
          ) : (
            filtered.map((item) => {
              const isSelected = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onSelect(item.id);
                    setOpen(false);
                  }}
                  className={cn(
                    'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-accent/40 text-foreground hover:bg-accent/70'
                      : 'text-foreground/90 hover:bg-accent/60',
                  )}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="size-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color || '#64748b' }}
                    />
                    <span className="truncate font-medium">{item.label}</span>
                  </span>
                  <span className="flex items-center gap-2 text-muted-foreground/80 shrink-0">
                    {item.sublabel && (
                      <span className="text-[10px] uppercase tracking-wide">{item.sublabel}</span>
                    )}
                    {isSelected && (
                      <Check className="size-3.5 text-foreground shrink-0 stroke-[2.5]" />
                    )}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
