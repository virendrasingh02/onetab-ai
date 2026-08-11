/**
 * The left rail: every node kind the builder knows about, grouped and
 * filterable. Entries can be dragged onto the canvas to land where they are
 * dropped, or clicked to be appended — the click path exists so the palette
 * stays usable from the keyboard.
 */

import { Badge, Input, ScrollArea } from '@org/ui';
import { cn } from '@org/utils';
import { Search } from 'lucide-react';
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

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const matches = PALETTE_ORDER.filter((kind) => {
      if (!needle) return true;
      const spec = specFor(kind);
      return (
        spec.label.toLowerCase().includes(needle) ||
        spec.description.toLowerCase().includes(needle) ||
        kind.includes(needle)
      );
    });

    return NODE_CATEGORIES.map((category) => ({
      category,
      kinds: matches.filter((kind) => specFor(kind).category === category),
    })).filter((group) => group.kinds.length > 0);
  }, [query]);

  const onDragStart = (event: DragEvent<HTMLButtonElement>, kind: AgentNodeKind) => {
    event.dataTransfer.setData(NODE_DRAG_TYPE, kind);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      className={cn(
        'shadow-xs flex flex-col rounded-xl border bg-surface overflow-hidden',
        className,
      )}
    >
      <div className="px-3 pt-3 pb-2 border-b">
        <h2 className="mb-2 text-xs font-semibold text-foreground">Node library</h2>
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search nodes"
          leadingIcon={<Search />}
          aria-label="Search node library"
        />
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-3">
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
            <p className="px-2 py-6 text-xs text-center text-muted-foreground">
              No nodes match “{query}”.
            </p>
          ) : null}
        </div>
      </ScrollArea>

      <p className="px-3 py-2 text-[10px] border-t text-muted-foreground">
        Drag onto the canvas, or press Enter to append.
      </p>
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
    <section>
      <h3 className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-subtle">
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
              <button
                type="button"
                draggable={!locked}
                disabled={locked}
                onDragStart={(event) => onDragStart(event, kind)}
                onClick={() => onAdd(kind)}
                title={spec.description}
                className={cn(
                  'w-full gap-2.5 px-2 py-2 flex items-start rounded-lg text-left',
                  'transition-colors duration-(--duration-fast)',
                  'focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none',
                  locked
                    ? 'cursor-not-allowed opacity-45'
                    : 'cursor-grab hover:bg-selected active:cursor-grabbing',
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    'size-7 flex shrink-0 items-center justify-center rounded-lg',
                    accent.chip,
                  )}
                >
                  <Icon className="size-3.5" />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="gap-1.5 flex items-center">
                    <span className="text-xs font-medium truncate text-foreground">
                      {spec.label}
                    </span>
                    {locked ? (
                      <Badge variant="neutral" className="text-[9px]">
                        placed
                      </Badge>
                    ) : null}
                  </span>
                  <span className="block text-[10px] leading-snug text-muted-foreground">
                    {spec.description}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
