/**
 * The left rail: every node kind the builder knows about, grouped and
 * filterable. Entries can be dragged onto the canvas to land where they are
 * dropped, or clicked to be appended — the click path exists so the palette
 * stays usable from the keyboard.
 */

import { Badge, Button, Input, ScrollArea } from '@org/ui';
import { cn } from '@org/utils';
import { Plus, Search, X } from 'lucide-react';
import { useMemo, useState, type DragEvent } from 'react';
import {
  CATEGORY_LABEL,
  NODE_CATEGORIES,
  PALETTE_ORDER,
  accentFor,
  specFor,
  type AgentNodeKind,
  type NodeCategory,
} from './agent-graph-model.js';

/** The drag payload key, shared with the canvas' drop handler. */
export const NODE_DRAG_TYPE = 'application/onetab-agent-node';

export interface AgentNodePaletteProps {
  onAdd: (kind: AgentNodeKind) => void;
  /** Kinds already on the canvas — singletons among them are locked out. */
  placedKinds: ReadonlySet<AgentNodeKind>;
  className?: string;
}

export function AgentNodePalette({
  onAdd,
  placedKinds,
  className,
}: AgentNodePaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<NodeCategory | 'all'>('all');

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const matches = PALETTE_ORDER.filter((kind) => {
      const spec = specFor(kind);
      if (selectedCategory !== 'all' && spec.category !== selectedCategory) {
        return false;
      }
      if (!needle) return true;
      return (
        spec.label.toLowerCase().includes(needle) ||
        spec.description.toLowerCase().includes(needle) ||
        kind.includes(needle)
      );
    });

    const activeCategories =
      selectedCategory === 'all'
        ? NODE_CATEGORIES
        : NODE_CATEGORIES.filter((cat) => cat === selectedCategory);

    return activeCategories
      .map((category) => ({
        category,
        kinds: matches.filter((kind) => specFor(kind).category === category),
      }))
      .filter((group) => group.kinds.length > 0);
  }, [query, selectedCategory]);

  const onDragStart = (event: DragEvent<HTMLButtonElement>, kind: AgentNodeKind) => {
    event.dataTransfer.setData(NODE_DRAG_TYPE, kind);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border border-border bg-surface shadow-xs overflow-hidden',
        className,
      )}
    >
      <div className="px-3 pt-3 pb-2.5 border-b border-border space-y-2.5 bg-surface/90">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-tight text-foreground">
            Node Library
          </h2>
          <span className="text-[10px] text-muted-foreground font-mono">
            {PALETTE_ORDER.length} components
          </span>
        </div>

        <div className="relative">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search nodes..."
            leadingIcon={<Search className="size-3.5 text-muted-foreground" />}
            className="h-8 text-xs pr-7"
            aria-label="Search node library"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded"
            >
              <X className="size-3" />
            </button>
          ) : null}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none pb-0.5 pt-0.5">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={cn(
              'px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors',
              selectedCategory === 'all'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground',
            )}
          >
            All
          </button>
          {NODE_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors',
                selectedCategory === cat
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-surface-raised hover:text-foreground',
              )}
            >
              {CATEGORY_LABEL[cat]}
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2.5 space-y-3">
          {groups.map((group) => (
            <PaletteGroup
              key={group.category}
              category={group.category}
              kinds={group.kinds}
              placedKinds={placedKinds}
              onAdd={onAdd}
              onDragStart={onDragStart}
            />
          ))}

          {groups.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <p className="text-xs text-muted-foreground">
                No nodes match “{query}”.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs"
                onClick={() => {
                  setQuery('');
                  setSelectedCategory('all');
                }}
              >
                Clear search filter
              </Button>
            </div>
          ) : null}
        </div>
      </ScrollArea>

      <div className="px-3 py-2 text-[10px] border-t border-border bg-surface-raised/40 text-muted-foreground flex items-center justify-between">
        <span>Drag & drop onto canvas</span>
        <span className="font-mono text-subtle">or click +</span>
      </div>
    </div>
  );
}

interface PaletteGroupProps {
  category: NodeCategory;
  kinds: ReadonlyArray<AgentNodeKind>;
  placedKinds: ReadonlySet<AgentNodeKind>;
  onAdd: (kind: AgentNodeKind) => void;
  onDragStart: (event: DragEvent<HTMLButtonElement>, kind: AgentNodeKind) => void;
}

function PaletteGroup({
  category,
  kinds,
  placedKinds,
  onAdd,
  onDragStart,
}: PaletteGroupProps) {
  return (
    <section className="space-y-1">
      <h3 className="px-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
        {CATEGORY_LABEL[category]}
      </h3>
      <ul className="space-y-1">
        {kinds.map((kind) => {
          const spec = specFor(kind);
          const accent = accentFor(kind);
          const Icon = spec.icon;
          const locked = Boolean(spec.singleton) && placedKinds.has(kind);

          return (
            <li key={kind}>
              <div
                className={cn(
                  'group relative w-full gap-2.5 p-2 flex items-start rounded-lg border border-transparent',
                  'transition-all duration-150',
                  locked
                    ? 'cursor-not-allowed opacity-45 bg-surface-inset/30'
                    : 'hover:border-border/80 hover:bg-surface-raised hover:shadow-xs',
                )}
              >
                <button
                  type="button"
                  draggable={!locked}
                  disabled={locked}
                  onDragStart={(event) => onDragStart(event, kind)}
                  onClick={() => onAdd(kind)}
                  title={locked ? `${spec.label} is already placed` : spec.description}
                  className={cn(
                    'flex-1 flex items-start gap-2.5 text-left min-w-0',
                    locked
                      ? 'cursor-not-allowed'
                      : 'cursor-grab active:cursor-grabbing',
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'size-7 flex shrink-0 items-center justify-center rounded-md transition-transform group-hover:scale-105',
                      accent.chip,
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="gap-1.5 flex items-center justify-between">
                      <span className="text-xs font-medium truncate text-foreground group-hover:text-primary transition-colors">
                        {spec.label}
                      </span>
                      {locked ? (
                        <Badge variant="neutral" className="text-[9px] px-1 py-0 font-normal">
                          Placed
                        </Badge>
                      ) : null}
                    </span>
                    <span className="block text-[10px] leading-snug text-muted-foreground line-clamp-2 mt-0.5">
                      {spec.description}
                    </span>
                  </span>
                </button>

                {!locked ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAdd(kind);
                    }}
                    title={`Add ${spec.label}`}
                    aria-label={`Add ${spec.label}`}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-surface-inset text-muted-foreground hover:text-foreground shrink-0 self-center"
                  >
                    <Plus className="size-3.5" />
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
