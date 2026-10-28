import { Button, Input, Kbd } from '@org/ui';
import { cn } from '@org/utils';
import {
  Cpu,
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AppConnectorIcon } from '../common/app-connector-icon.jsx';
import { useConnectorCatalogNodes } from './connector-nodes.js';
import {
  CATALOG_NODES,
  CATEGORY_ITEMS,
  type CatalogNodeItem,
  type NodeCategory,
} from './node-library.js';

/** Per-category accent colour for the card's icon tile and title (a design-system accent token). */
const CATEGORY_ACCENT: Record<NodeCategory, string> = {
  all: 'var(--color-accent-indigo)',
  triggers: 'var(--color-accent-green)',
  widgets: 'var(--color-accent-pink)',
  connectors: 'var(--color-accent-blue)',
  ai: 'var(--color-accent-violet)',
  knowledge: 'var(--color-accent-cyan)',
  logic: 'var(--color-accent-amber)',
  transform: 'var(--color-accent-teal)',
  tools: 'var(--color-accent-orange)',
  human: 'var(--color-accent-rose)',
  output: 'var(--color-accent-indigo)',
  annotations: 'var(--color-accent-amber)',
};

const CATEGORY_LABELS = Object.fromEntries(
  CATEGORY_ITEMS.map((c: { id: NodeCategory; label: string }) => [c.id, c.label]),
) as Partial<Record<NodeCategory, string>>;

interface NodeCatalogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectNode: (item: CatalogNodeItem) => void;
}

export function NodeCatalogModal({
  isOpen,
  onClose,
  onSelectNode,
}: NodeCatalogModalProps) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<NodeCategory>('all');
  const [focusedIndex, setFocusedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const connectorNodes = useConnectorCatalogNodes();

  // Filter nodes by category and search query — the live connector capabilities included.
  const filteredNodes = useMemo(() => {
    return [...CATALOG_NODES, ...connectorNodes].filter((node) => {
      const matchesCategory =
        selectedCategory === 'all' ||
        node.category === selectedCategory ||
        (selectedCategory === 'connectors' && node.type.startsWith('APP_CONNECTOR'));
      if (!matchesCategory) return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return Boolean(
        node.label.toLowerCase().includes(q) ||
        node.subtitle?.toLowerCase().includes(q) ||
        node.description?.toLowerCase().includes(q) ||
        node.type.toLowerCase().includes(q) ||
        node.category.toLowerCase().includes(q),
      );
    });
  }, [selectedCategory, search, connectorNodes]);

  // Reset search and selection when modal opens
  useEffect(() => {
    if (!isOpen) return undefined;
    setSearch('');
    setSelectedCategory('all');
    setFocusedIndex(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Reset focused index when filtering
  useEffect(() => {
    setFocusedIndex(0);
  }, [search, selectedCategory]);

  // Keep the active category tab visible (it can change via ←/→)
  useEffect(() => {
    containerRef.current
      ?.querySelector<HTMLElement>(`[data-category-id="${selectedCategory}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [selectedCategory]);

  // Handle escape and click outside
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Keep focused item scrolled into view
  useEffect(() => {
    if (focusedIndex >= 0 && gridRef.current) {
      const el = gridRef.current.querySelector<HTMLElement>(
        `[data-catalog-idx="${focusedIndex}"]`,
      );
      el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [focusedIndex]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const count = filteredNodes.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) => (count > 0 ? (prev + 1) % count : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) => (count > 0 ? (prev - 1 + count) % count : 0));
    } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !search) {
      // Left/right cycles category tabs (only while the search box is empty, so the caret still moves).
      e.preventDefault();
      const ids = CATEGORY_ITEMS.map((c: { id: NodeCategory }) => c.id);
      const step = e.key === 'ArrowRight' ? 1 : -1;
      setSelectedCategory((prev) => ids[(ids.indexOf(prev) + step + ids.length) % ids.length]);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredNodes[focusedIndex]) {
        onSelectNode(filteredNodes[focusedIndex]);
        onClose();
      }
    }
  };

  const onDragStart = (
    event: React.DragEvent,
    nodeData: CatalogNodeItem,
  ) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeData));
    event.dataTransfer.effectAllowed = 'move';
  };

  if (!isOpen) return null;

  return (
    <div
      ref={containerRef}
      onWheel={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="nowheel nodrag nopan absolute bottom-20 left-1/2 -translate-x-1/2 z-30 w-[780px] max-w-[94vw] max-h-[75vh] flex flex-col rounded-xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl text-foreground select-none animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/80 px-5 py-3.5 bg-surface/50">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Sparkles className="size-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">
                Add Step to Workflow
              </h2>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-2xs font-semibold text-primary">
                {filteredNodes.length} available
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Select or drag a node into your workflow canvas
            </p>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onClose}
          title="Close (Esc)"
          aria-label="Close"
        >
          <X className="size-4" />
        </Button>
      </div>

      {/* Search Input Bar */}
      <div className="p-4 pb-2 border-b border-border/60 bg-surface/30">
        <Input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder="Search triggers, AI reasoning, MCP tools, logic & transforms…"
          aria-label="Search steps"
          inputSize="lg"
          leadingIcon={<Search className="size-4" />}
          trailingSlot={
            search ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setSearch('')}
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </Button>
            ) : undefined
          }
        />

        {/* Category Filter Pills */}
        <div
          className="nowheel flex items-center gap-1.5 overflow-x-auto pt-2.5 pb-0.5 no-scrollbar text-xs"
          onWheel={(e) => e.stopPropagation()}
        >
          {CATEGORY_ITEMS.map((cat: { id: NodeCategory; label: string; count: number }) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <Button
                key={cat.id}
                data-category-id={cat.id}
                type="button"
                variant={isSelected ? 'primary' : 'subtle'}
                size="xs"
                aria-pressed={isSelected}
                onClick={() => setSelectedCategory(cat.id)}
                className="shrink-0 rounded-lg"
              >
                <span>{cat.label}</span>
                <span
                  className={cn(
                    'text-2xs rounded-full px-1.5 py-0.2',
                    isSelected
                      ? 'bg-background/20 text-background'
                      : 'bg-border/60 text-muted-foreground',
                  )}
                >
                  {cat.count}
                </span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* LIST VIEW */}
      <div
        ref={gridRef}
        onWheel={(e) => e.stopPropagation()}
        role="listbox"
        aria-label="Workflow steps"
        className="nowheel nodrag nopan flex-1 overflow-y-auto overscroll-contain p-3 scrollbar-subtle max-h-[46vh]"
      >
        {filteredNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Search className="size-8 text-muted-foreground/30 mb-2" />
            <div className="text-xs font-semibold text-foreground">
              No matching steps found
            </div>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Try searching with different terms or switch categories above.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {filteredNodes.map((item, idx) => {
              const Icon = item.icon || Cpu;
              const isFocused = idx === focusedIndex;
              const accent = CATEGORY_ACCENT[item.category] ?? CATEGORY_ACCENT.all;
              // Section header whenever the category changes (only in the mixed "All" view).
              const showHeader =
                selectedCategory === 'all' &&
                (idx === 0 || filteredNodes[idx - 1].category !== item.category);

              return (
                <React.Fragment key={item.key ?? item.type}>
                  {showHeader && (
                    <div
                      style={{ '--cat': accent } as React.CSSProperties}
                      className={cn(
                        'flex items-center gap-2 px-1 pb-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground',
                        idx === 0 ? 'pt-0' : 'pt-3',
                      )}
                    >
                      <span className="size-1.5 rounded-full bg-(--cat)" />
                      {CATEGORY_LABELS[item.category] ?? item.category}
                    </div>
                  )}
                  <div
                    data-catalog-idx={idx}
                    role="option"
                    aria-selected={isFocused}
                    draggable
                    onDragStart={(e) => onDragStart(e, item)}
                    onClick={() => {
                      onSelectNode(item);
                      onClose();
                    }}
                    onMouseEnter={() => setFocusedIndex(idx)}
                    style={{ '--cat': accent } as React.CSSProperties}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors cursor-pointer select-none text-left',
                      isFocused
                        ? 'border-(--cat)/40 bg-(--cat)/8'
                        : 'border-transparent hover:bg-surface-raised/60',
                    )}
                  >
                    <div
                      className={cn(
                        'flex size-11 shrink-0 items-center justify-center rounded-xl bg-(--cat)/15 text-(--cat) ring-1 ring-inset ring-(--cat)/30 transition-transform',
                        isFocused && 'scale-105',
                      )}
                    >
                      {item.defaultConfig?.connectorId ? (
                        <AppConnectorIcon connectorId={item.defaultConfig.connectorId} size={24} />
                      ) : (
                        <Icon className="size-5" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={cn(
                            'font-semibold text-sm leading-tight truncate transition-colors',
                            isFocused ? 'text-(--cat)' : 'text-foreground',
                          )}
                        >
                          {item.label}
                        </span>
                        {item.badge && (
                          <span className="shrink-0 rounded-full bg-(--cat)/12 px-1.5 py-0.5 text-2xs font-medium text-(--cat)">
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">
                        {item.description || item.subtitle}
                      </p>
                    </div>

                    <span
                      className={cn(
                        'flex shrink-0 items-center gap-1 rounded-lg bg-(--cat)/15 px-2 py-1 text-xs font-semibold text-(--cat) transition-opacity',
                        isFocused ? 'opacity-100' : 'opacity-0',
                      )}
                    >
                      <Plus className="size-3.5 stroke-[2.5]" />
                      <span>Add</span>
                    </span>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer shortcut hints */}
      <div className="flex items-center justify-between border-t border-border/70 px-4 py-2 bg-surface/50 text-2xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span>Click to place</span>
          <span>•</span>
          <span>Drag onto canvas</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <Kbd size="xs">↑</Kbd>
            <Kbd size="xs">↓</Kbd>
            <span>navigate</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Kbd size="xs">←</Kbd>
            <Kbd size="xs">→</Kbd>
            <span>category</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Kbd size="xs">↵</Kbd>
            <span>select</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Kbd size="xs">Esc</Kbd>
            <span>close</span>
          </span>
        </span>
      </div>
    </div>
  );
}
