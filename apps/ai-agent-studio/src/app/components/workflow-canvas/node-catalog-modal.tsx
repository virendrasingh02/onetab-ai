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
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex((prev) =>
        filteredNodes.length > 0 ? (prev + 3) % filteredNodes.length : 0,
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex((prev) =>
        filteredNodes.length > 0
          ? (prev - 3 + filteredNodes.length) % filteredNodes.length
          : 0,
      );
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      setFocusedIndex((prev) =>
        filteredNodes.length > 0 ? (prev + 1) % filteredNodes.length : 0,
      );
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setFocusedIndex((prev) =>
        filteredNodes.length > 0
          ? (prev - 1 + filteredNodes.length) % filteredNodes.length
          : 0,
      );
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
      className="nowheel nodrag nopan absolute bottom-20 left-1/2 -translate-x-1/2 z-30 w-[780px] max-w-[94vw] max-h-[75vh] flex flex-col rounded-2xl border border-border bg-card/95 backdrop-blur-xl shadow-2xl text-foreground select-none animate-in fade-in zoom-in-95 duration-150 overflow-hidden"
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
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                {filteredNodes.length} available
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Select or drag a node into your workflow canvas
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-raised hover:text-foreground transition-colors cursor-pointer"
          title="Close (Esc)"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="p-4 pb-2 border-b border-border/60 bg-surface/30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Search triggers, AI reasoning, MCP tools, logic & transforms…"
            className="w-full rounded-xl border border-border bg-surface pl-9 pr-8 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-xs transition-all"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div
          className="nowheel flex items-center gap-1.5 overflow-x-auto pt-2.5 pb-0.5 no-scrollbar text-xs"
          onWheel={(e) => e.stopPropagation()}
        >
          {CATEGORY_ITEMS.map((cat: { id: NodeCategory; label: string; count: number }) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  'shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer flex items-center gap-1.5',
                  isSelected
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                    : 'bg-surface-raised/80 text-muted-foreground hover:bg-surface-raised hover:text-foreground',
                )}
              >
                <span>{cat.label}</span>
                <span
                  className={cn(
                    'text-[9px] rounded-full px-1.5 py-0.2',
                    isSelected
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-border/60 text-muted-foreground',
                  )}
                >
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* GRID VIEW */}
      <div
        ref={gridRef}
        onWheel={(e) => e.stopPropagation()}
        className="nowheel nodrag nopan flex-1 overflow-y-auto overscroll-contain p-4 scrollbar-subtle max-h-[46vh]"
      >
        {filteredNodes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Search className="size-8 text-muted-foreground/30 mb-2" />
            <div className="text-xs font-semibold text-foreground">
              No matching steps found
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 max-w-xs">
              Try searching with different terms or switch categories above.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {filteredNodes.map((item, idx) => {
              const Icon = item.icon || Cpu;
              const isFocused = idx === focusedIndex;

              return (
                <div
                  key={item.key ?? item.type}
                  data-catalog-idx={idx}
                  draggable
                  onDragStart={(e) => onDragStart(e, item)}
                  onClick={() => {
                    onSelectNode(item);
                    onClose();
                  }}
                  onMouseEnter={() => setFocusedIndex(idx)}
                  className={cn(
                    'group relative flex flex-col justify-between rounded-xl border p-3 transition-all cursor-pointer select-none text-left',
                    isFocused
                      ? 'border-primary bg-primary/10 shadow-md ring-1 ring-primary/30 -translate-y-0.5'
                      : 'border-border/80 bg-surface hover:border-primary/50 hover:bg-surface-raised/60 hover:shadow-xs hover:-translate-y-0.5',
                  )}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className={cn(
                            'flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors',
                            isFocused
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-surface-raised text-primary group-hover:bg-primary group-hover:text-primary-foreground',
                          )}
                        >
                          {item.defaultConfig?.connectorId ? (
                            <AppConnectorIcon connectorId={item.defaultConfig.connectorId} size={16} />
                          ) : (
                            <Icon className="size-3.5" />
                          )}
                        </div>
                        <span className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors truncate">
                          {item.label}
                        </span>
                      </div>

                      {item.badge && (
                        <span className="shrink-0 rounded-full bg-surface-raised border border-border/60 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                          {item.badge}
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                      {item.description || item.subtitle}
                    </p>
                  </div>

                  <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-border/40 text-[10px] text-muted-foreground">
                    <span className="capitalize font-mono opacity-70">
                      {item.category}
                    </span>
                    <span className="opacity-0 group-hover:opacity-100 flex items-center gap-1 text-primary font-semibold transition-opacity">
                      <span>Add</span>
                      <Plus className="size-3 stroke-[2.5]" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer shortcut hints */}
      <div className="flex items-center justify-between border-t border-border/70 px-4 py-2 bg-surface/50 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span>Click to place</span>
          <span>•</span>
          <span>Drag card onto canvas</span>
        </span>
        <span className="flex items-center gap-2">
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-surface-raised px-1 py-0.5 font-mono text-[9px] text-foreground">
              ↑
            </kbd>
            <kbd className="rounded bg-surface-raised px-1 py-0.5 font-mono text-[9px] text-foreground">
              ↓
            </kbd>
            <kbd className="rounded bg-surface-raised px-1 py-0.5 font-mono text-[9px] text-foreground">
              ←
            </kbd>
            <kbd className="rounded bg-surface-raised px-1 py-0.5 font-mono text-[9px] text-foreground">
              →
            </kbd>
            <span>navigate</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-[9px] text-foreground">
              ↵
            </kbd>
            <span>select</span>
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <kbd className="rounded bg-surface-raised px-1.5 py-0.5 font-mono text-[9px] text-foreground">
              Esc
            </kbd>
            <span>close</span>
          </span>
        </span>
      </div>
    </div>
  );
}
