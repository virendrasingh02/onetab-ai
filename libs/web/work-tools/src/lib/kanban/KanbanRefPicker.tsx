import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@org/ui';
import { cn } from '@org/utils';
import { Check, Plus, Search, Settings2, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useMenuSearchField } from './menu-search-field.js';

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
  /** What a new item is called, e.g. "epic". Needed with `onCreate`. */
  itemNoun?: string;
  /** Turns the search box into "search or create": typing a new name offers it. */
  onCreate?: (name: string) => void;
  /** Names shorter than this can't be created; the API sets the limit. */
  minCreateLength?: number;
  /** Footer link to where this list is managed, e.g. "Manage epics". */
  manage?: { label: string; onSelect: () => void };
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
  itemNoun = 'item',
  onCreate,
  minCreateLength = 1,
  manage,
}: KanbanRefPickerProps) {
  const searchField = useMenuSearchField();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.label.toLowerCase().includes(q));
  }, [items, query]);

  const showSearch = Boolean(onCreate) || items.length > searchThreshold;

  const newName = query.trim();
  const canCreate =
    Boolean(onCreate) &&
    newName.length >= minCreateLength &&
    !items.some((item) => item.label.toLowerCase() === newName.toLowerCase());

  const create = () => {
    onCreate?.(newName);
    setQuery('');
    setOpen(false);
  };

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
        className="w-56 p-1.5 shadow-xl rounded-xl border border-border bg-popover text-popover-foreground"
      >
        {showSearch && (
          <div className="px-2 py-1 mb-1 relative flex items-center border-b border-border/60">
            <Search className="size-3.5 mr-2 shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                onCreate
                  ? items.length > 0
                    ? `Search or create ${itemNoun}...`
                    : `Name a new ${itemNoun}...`
                  : 'Search...'
              }
              className="text-xs p-0 w-full border-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground focus:ring-0"
              {...searchField.inputProps}
              onKeyDown={(event) => {
                searchField.inputProps.onKeyDown(event);
                if (event.key === 'Enter' && canCreate && !filtered.length) {
                  event.preventDefault();
                  create();
                }
              }}
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
              'px-2.5 py-1.5 text-xs font-medium flex w-full cursor-pointer items-center justify-between rounded-lg transition-colors',
              !selectedId
                ? 'bg-accent text-foreground'
                : 'text-foreground/85 hover:bg-accent/60',
            )}
          >
            <span className="gap-2.5 min-w-0 flex items-center text-muted-foreground">
              <span className="size-4 shrink-0 rounded-full border border-dashed border-muted-foreground/50" />
              <span className="truncate">{noneLabel}</span>
            </span>
            {!selectedId && (
              <Check className="size-3.5 shrink-0 stroke-[2.5] text-foreground" />
            )}
          </button>

          {filtered.length === 0 && canCreate ? null : filtered.length === 0 ? (
            <div className="px-3 py-3 text-xs text-center text-muted-foreground">
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
                    'px-2.5 py-1.5 text-xs flex w-full cursor-pointer items-center justify-between rounded-lg transition-colors',
                    isSelected
                      ? 'bg-accent/40 text-foreground hover:bg-accent/70'
                      : 'text-foreground/90 hover:bg-accent/60',
                  )}
                >
                  <span className="gap-2.5 min-w-0 flex items-center">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color || '#64748b' }}
                    />
                    <span className="font-medium truncate">{item.label}</span>
                  </span>
                  <span className="gap-2 flex shrink-0 items-center text-muted-foreground/80">
                    {item.sublabel && (
                      <span className="tracking-wide text-[10px] uppercase">
                        {item.sublabel}
                      </span>
                    )}
                    {isSelected && (
                      <Check className="size-3.5 shrink-0 stroke-[2.5] text-foreground" />
                    )}
                  </span>
                </button>
              );
            })
          )}

          {canCreate ? (
            <button
              type="button"
              onClick={create}
              className="px-2.5 py-1.5 gap-2.5 text-xs font-medium flex w-full cursor-pointer items-center rounded-lg text-foreground transition-colors hover:bg-accent/60"
            >
              <Plus className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">
                Create {itemNoun} “{newName}”
              </span>
            </button>
          ) : null}
        </div>

        {manage ? (
          <div className="mt-1 pt-1 border-t border-border/60">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                manage.onSelect();
              }}
              className="px-2.5 py-1.5 gap-2.5 text-xs font-medium flex w-full cursor-pointer items-center rounded-lg text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
            >
              <Settings2 className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{manage.label}</span>
            </button>
          </div>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
