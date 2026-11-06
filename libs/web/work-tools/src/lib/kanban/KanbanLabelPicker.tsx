import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import { Check, Plus, Search, Tag } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useKanbanLabels } from './kanban-custom-store.js';
import { useMenuSearchField } from './menu-search-field.js';

export interface KanbanLabelPickerProps {
  selectedLabels: string[];
  onToggleLabel: (labelName: string) => void;
  trigger?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
}

export function KanbanLabelPicker({
  selectedLabels,
  onToggleLabel,
  trigger,
  align = 'start',
}: KanbanLabelPickerProps) {
  const searchField = useMenuSearchField();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { labels: catalog, colorOf, createLabel } = useKanbanLabels();

  // The catalogue, plus any name a card already carries that it does not have
  // (imported, or tagged before the catalogue existed) so it can be untagged.
  const labels = useMemo(() => {
    const known = new Set(catalog.map((l) => l.name));
    return [
      ...catalog.map((l) => ({ id: l.id, name: l.name, color: l.color })),
      ...selectedLabels
        .filter((name) => !known.has(name))
        .map((name) => ({ id: `name:${name}`, name, color: colorOf(name) })),
    ];
  }, [catalog, selectedLabels, colorOf]);

  const filteredLabels = labels.filter((l) =>
    l.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const handleCreateLabel = () => {
    const name = search.trim().slice(0, 50);
    if (!name) return;
    onToggleLabel(name);
    setSearch('');
    createLabel(name).catch(() => {
      toast.error(`Could not add “${name}” to the workspace labels.`);
    });
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="gap-1.5 px-2 py-1 text-xs font-medium inline-flex cursor-pointer items-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <Tag className="size-3.5" />
            <span>Add label</span>
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        {...searchField.contentProps}
        align={align}
        className="w-56 p-1.5 shadow-xl rounded-xl border border-border bg-popover text-popover-foreground"
      >
        {/* Search input */}
        <div className="gap-2 px-2 py-1.5 mb-1 flex items-center rounded-lg border border-border/60 bg-muted/30">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            ref={searchField.inputProps.ref}
            onKeyDown={(e) => {
              searchField.inputProps.onKeyDown(e);
              if (e.key === 'Enter' && filteredLabels.length === 0) {
                e.preventDefault();
                handleCreateLabel();
              }
            }}
            placeholder="Search or create label..."
            className="text-xs w-full bg-transparent text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
          />
        </div>

        {/* Labels list */}
        <div className="max-h-48 space-y-0.5 no-scrollbar overflow-y-auto">
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
                  'px-2 py-1 text-xs flex cursor-pointer items-center justify-between rounded-md transition-colors',
                  isSelected
                    ? 'font-semibold bg-accent text-foreground'
                    : 'text-foreground/80 hover:bg-accent/60',
                )}
              >
                <div className="gap-2 min-w-0 flex items-center">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="truncate">{item.name}</span>
                </div>

                {isSelected && (
                  <Check className="size-3.5 shrink-0 text-primary" />
                )}
              </DropdownMenuItem>
            );
          })}

          {filteredLabels.length === 0 && search.trim() && (
            <DropdownMenuItem
              onSelect={handleCreateLabel}
              className="gap-2 px-2 py-1.5 text-xs font-medium flex cursor-pointer items-center rounded-md text-primary hover:bg-primary/10"
            >
              <Plus className="size-3.5" />
              <span>Create "{search.trim()}"</span>
            </DropdownMenuItem>
          )}

          {filteredLabels.length === 0 && !search.trim() && (
            <div className="py-2 text-center text-[11px] text-muted-foreground">
              No labels yet. Type a name to create one.
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
