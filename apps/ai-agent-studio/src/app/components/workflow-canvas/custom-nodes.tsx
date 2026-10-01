import { cn } from '@org/utils';
import { Handle, NodeToolbar, Position, type NodeProps } from '@xyflow/react';
import {
  Bot,
  CheckCircle2,
  Code2,
  Copy,
  Cpu,
  Flame,
  Folder,
  GitBranch,
  Play,
  Plus,
  Repeat,
  Search,
  StickyNote,
  Trash2,
  UserCheck,
  Wrench,
  X,
} from 'lucide-react';
import React, { memo, useState, useRef, useEffect, useMemo } from 'react';
import { CATALOG_NODES, type CatalogNodeItem, type NodeCategory } from './node-library.js';

export interface WorkflowNodePayload {
  label: string;
  subtitle?: string;
  status?: 'idle' | 'running' | 'success' | 'failed' | 'waiting';
  config?: Record<string, any>;
  onTest?: (nodeId: string) => void;
  onDuplicate?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onConnectNext?: (item: CatalogNodeItem, handleId?: string) => void;
  [key: string]: any;
}

const statusBorderClasses: Record<string, string> = {
  idle: 'border-border',
  running: 'border-primary ring-2 ring-primary/40 animate-pulse',
  success: 'border-success/80 ring-2 ring-success/20',
  failed: 'border-destructive ring-2 ring-destructive/30',
  waiting: 'border-warning ring-2 ring-warning/30',
};

const CATEGORIES: { id: NodeCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'ai', label: 'AI' },
  { id: 'tools', label: 'Tools' },
  { id: 'logic', label: 'Logic' },
  { id: 'triggers', label: 'Triggers' },
  { id: 'transform', label: 'Data' },
  { id: 'human', label: 'Human' },
  { id: 'output', label: 'Output' },
];

export function SourceHandleWithQuickAdd({
  id,
  position = Position.Right,
  className,
  style,
  onConnectNext,
}: {
  id?: string;
  position?: Position;
  className?: string;
  style?: React.CSSProperties;
  onConnectNext?: (item: CatalogNodeItem, handleId?: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<NodeCategory>('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredNodes = useMemo(() => {
    return CATALOG_NODES.filter((n) => {
      if (activeCategory !== 'all' && n.category !== activeCategory) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        n.label.toLowerCase().includes(q) ||
        n.subtitle?.toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q)
      );
    });
  }, [search, activeCategory]);

  // Reset active index when filtered nodes change
  useEffect(() => {
    setActiveIndex(0);
  }, [search, activeCategory]);

  // Scroll active item into view when navigating via keyboard
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeEl = listRef.current.querySelector<HTMLElement>(`[data-node-index="${activeIndex}"]`);
      activeEl?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setActiveCategory('all');
      setActiveIndex(0);
      return;
    }

    // Elevate the parent ReactFlow node so this dropdown is ALWAYS in front of all other canvas nodes
    const nodeEl = containerRef.current?.closest('.react-flow__node') as HTMLElement | null;
    if (nodeEl) {
      nodeEl.classList.add('quick-add-open');
      nodeEl.style.setProperty('z-index', '99999', 'important');
    }

    function handleClickOutside(e: Event) {
      const target = e.target as Node | null;
      if (containerRef.current && target && !containerRef.current.contains(target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setIsOpen(false);
      }
    }

    // Use capture phase (true) so clicks anywhere on canvas, other nodes, or window dismiss immediately
    window.addEventListener('pointerdown', handleClickOutside, true);
    window.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('keydown', handleKeyDown);
    const timer = setTimeout(() => inputRef.current?.focus(), 50);

    return () => {
      clearTimeout(timer);
      if (nodeEl) {
        nodeEl.classList.remove('quick-add-open');
        nodeEl.style.removeProperty('z-index');
      }
      window.removeEventListener('pointerdown', handleClickOutside, true);
      window.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex((prev) => (filteredNodes.length > 0 ? (prev + 1) % filteredNodes.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setActiveIndex((prev) => (filteredNodes.length > 0 ? (prev - 1 + filteredNodes.length) % filteredNodes.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      if (filteredNodes[activeIndex]) {
        onConnectNext?.(filteredNodes[activeIndex], id);
        setIsOpen(false);
      }
    }
  };

  return (
    <>
      <Handle
        type="source"
        id={id}
        position={position}
        className={className}
        style={style}
      />

      <div
        ref={containerRef}
        className={cn(
          'nodrag nopan nowheel absolute z-30 flex items-center pl-2 -ml-2 pointer-events-auto',
          isOpen && 'z-[99999] quick-add-open',
        )}
        style={{
          top: style?.top ?? '50%',
          right: '-22px',
          transform: 'translateY(-50%)',
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }}
          className={cn(
            'flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-all duration-150',
            'opacity-0 group-hover:opacity-100 hover:scale-110 active:scale-95 cursor-pointer',
            isOpen && 'opacity-100 ring-2 ring-primary/40 scale-110',
          )}
          title="Add connected node"
        >
          <Plus className="size-3 stroke-[2.5]" />
        </button>

        {isOpen && (
          <div
            className="nowheel nodrag nopan quick-add-open absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 w-80 rounded-xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur-md z-[99999] text-foreground cursor-default animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            onWheel={(e) => e.stopPropagation()}
          >
            {/* Search Input */}
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleInputKeyDown}
                placeholder="Search nodes…"
                className="w-full rounded-md border border-border bg-surface pl-8 pr-7 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary transition-colors"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                  title="Clear search"
                >
                  <X className="size-3" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground p-0.5 rounded cursor-pointer"
                  title="Close"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>

            {/* Category Filter Pills */}
            <div
              className="nowheel flex gap-1 overflow-x-auto pb-1.5 mb-2 scrollbar-none text-[10px]"
              onWheel={(e) => e.stopPropagation()}
            >
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    'shrink-0 rounded px-2 py-0.5 font-medium transition-colors cursor-pointer',
                    activeCategory === cat.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-surface-raised text-muted-foreground hover:text-foreground hover:bg-surface-raised/80',
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Node Items List */}
            <div
              ref={listRef}
              onWheel={(e) => e.stopPropagation()}
              className="nowheel nodrag nopan max-h-72 overflow-y-auto overscroll-contain space-y-1 pr-1.5 scrollbar-subtle"
            >
              {filteredNodes.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  No nodes found
                </div>
              ) : (
                filteredNodes.map((item, idx) => {
                  const Icon = item.icon || Cpu;
                  const isSelected = idx === activeIndex;
                  return (
                    <button
                      key={item.type}
                      data-node-index={idx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onConnectNext?.(item, id);
                        setIsOpen(false);
                      }}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={cn(
                        'group/item flex w-full items-center gap-2.5 rounded-lg border p-1.5 text-left transition-colors cursor-pointer',
                        isSelected
                          ? 'border-primary/50 bg-primary/10 text-foreground'
                          : 'border-transparent hover:border-primary/30 hover:bg-surface-raised/70',
                      )}
                    >
                      <div
                        className={cn(
                          'flex size-6 shrink-0 items-center justify-center rounded-md transition-colors',
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-surface-raised text-muted-foreground group-hover/item:bg-primary group-hover/item:text-primary-foreground',
                        )}
                      >
                        <Icon className="size-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="truncate text-xs font-medium text-foreground">
                            {item.label}
                          </span>
                          {item.badge && (
                            <span className="shrink-0 rounded bg-surface-raised px-1.5 py-0.2 text-[9px] font-medium text-muted-foreground">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <p className="truncate text-[10px] text-muted-foreground">
                          {item.subtitle || item.description}
                        </p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export function NodeActionToolbar({
  id,
  data,
  selected,
}: {
  id: string;
  data: WorkflowNodePayload;
  selected?: boolean;
}) {
  if (!selected) return null;
  return (
    <NodeToolbar
      isVisible={selected}
      position={Position.Top}
      className="flex items-center gap-1 rounded-xl border border-border bg-surface/95 backdrop-blur-md px-1.5 py-1 shadow-md select-none"
    >
      {data?.onTest && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            data.onTest?.(id);
          }}
          title="Test node execution"
          className="flex size-6 items-center justify-center rounded-md text-primary hover:bg-primary/10 transition-colors"
        >
          <Play className="size-3 fill-current" />
        </button>
      )}

      {data?.onDuplicate && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            data.onDuplicate?.(id);
          }}
          title="Duplicate node"
          className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-surface-raised transition-colors"
        >
          <Copy className="size-3" />
        </button>
      )}

      {data?.onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            data.onDelete?.(id);
          }}
          title="Delete node"
          className="flex size-6 items-center justify-center rounded-md text-destructive hover:bg-destructive/10 transition-colors"
        >
          <Trash2 className="size-3" />
        </button>
      )}
    </NodeToolbar>
  );
}

// 1. Start Node
export const StartNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  return (
    <div
      className={cn(
        'group relative min-w-[200px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-primary border-primary shadow-md' : 'hover:border-primary/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-success/15 text-success">
          <Play className="size-4 fill-success" />
        </div>
        <div>
          <div className="text-xs font-bold text-foreground">
            {nodeData.label || 'Workflow Start'}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {nodeData.subtitle || 'Entry point'}
          </div>
        </div>
      </div>

      <SourceHandleWithQuickAdd
        position={Position.Right}
        onConnectNext={nodeData.onConnectNext}
        className="!size-3 !border-2 !border-background hover:!scale-125 !transition-transform !cursor-crosshair shadow-sm !bg-success"
      />
    </div>
  );
});
StartNode.displayName = 'StartNode';

// 2. Agent Node
export const AgentNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  const cfg = nodeData.config || {};
  return (
    <div
      className={cn(
        'group relative min-w-[240px] max-w-[280px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-primary border-primary shadow-md' : 'hover:border-primary/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background hover:!scale-125 !transition-transform !cursor-crosshair shadow-sm !bg-primary"
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Bot className="size-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">
              {nodeData.label || 'AI Agent'}
            </div>
            <div className="text-[11px] text-muted-foreground line-clamp-1">
              {nodeData.subtitle || 'Autonomous Reasoning'}
            </div>
          </div>
        </div>

        {cfg.model && (
          <span className="rounded bg-surface-raised px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground">
            {String(cfg.model).replace(':latest', '')}
          </span>
        )}
      </div>

      {cfg.instructions && (
        <div className="mt-2.5 rounded-md bg-surface-raised/70 p-1.5 text-[10px] text-muted-foreground line-clamp-2">
          {String(cfg.instructions)}
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
        <span>Tools: {(cfg.tools as string[])?.length || 0} attached</span>
        <span>Temp: {cfg.temperature ?? 0.7}</span>
      </div>

      <SourceHandleWithQuickAdd
        position={Position.Right}
        onConnectNext={nodeData.onConnectNext}
        className="!size-3 !border-2 !border-background hover:!scale-125 !transition-transform !cursor-crosshair shadow-sm !bg-primary"
      />
    </div>
  );
});
AgentNode.displayName = 'AgentNode';

// 3. Firecrawl Node
export const FirecrawlNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  const cfg = nodeData.config || {};
  return (
    <div
      className={cn(
        'group relative min-w-[230px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-warning border-warning shadow-md' : 'hover:border-warning/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background hover:!scale-125 !transition-transform !cursor-crosshair shadow-sm !bg-warning"
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-warning/15 text-warning">
            <Flame className="size-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">
              {nodeData.label || 'Firecrawl'}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {nodeData.subtitle || 'Web Extraction'}
            </div>
          </div>
        </div>

        <span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[9px] font-semibold text-warning">
          Firecrawl
        </span>
      </div>

      {(cfg.query || cfg.url) && (
        <div className="mt-2 rounded bg-surface-raised px-2 py-1 font-mono text-[10px] text-muted-foreground truncate">
          {String(cfg.query || cfg.url)}
        </div>
      )}

      <SourceHandleWithQuickAdd
        position={Position.Right}
        onConnectNext={nodeData.onConnectNext}
        className="!size-3 !border-2 !border-background hover:!scale-125 !transition-transform !cursor-crosshair shadow-sm !bg-warning"
      />
    </div>
  );
});
FirecrawlNode.displayName = 'FirecrawlNode';

// 4. MCP Tool Node
export const MCPToolNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  const cfg = nodeData.config || {};
  return (
    <div
      className={cn(
        'group relative min-w-[220px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-accent-indigo border-accent-indigo shadow-md' : 'hover:border-accent-indigo/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background hover:!scale-125 !transition-transform !cursor-crosshair shadow-sm !bg-accent-indigo"
      />

      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-accent-indigo/15 text-accent-indigo">
          <Wrench className="size-4" />
        </div>
        <div>
          <div className="text-xs font-bold text-foreground">
            {nodeData.label || 'MCP Tool'}
          </div>
          <div className="text-[11px] font-mono text-muted-foreground truncate max-w-[140px]">
            {cfg.toolName || nodeData.subtitle || 'execute_tool'}
          </div>
        </div>
      </div>

      <SourceHandleWithQuickAdd
        position={Position.Right}
        onConnectNext={nodeData.onConnectNext}
        className="!size-3 !border-2 !border-background hover:!scale-125 !transition-transform !cursor-crosshair shadow-sm !bg-accent-indigo"
      />
    </div>
  );
});
MCPToolNode.displayName = 'MCPToolNode';

// 5. Transform Node
export const TransformNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  return (
    <div
      className={cn(
        'group relative min-w-[210px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-accent-blue border-accent-blue shadow-md' : 'hover:border-accent-blue/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background hover:!scale-125 !transition-transform !cursor-crosshair shadow-sm !bg-accent-blue"
      />

      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-accent-blue/15 text-accent-blue">
          <Code2 className="size-4" />
        </div>
        <div>
          <div className="text-xs font-bold text-foreground">
            {nodeData.label || 'Transform'}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {nodeData.subtitle || 'Map / Template'}
          </div>
        </div>
      </div>

      <SourceHandleWithQuickAdd
        position={Position.Right}
        onConnectNext={nodeData.onConnectNext}
        className="!size-3 !border-2 !border-background hover:!scale-125 !transition-transform !cursor-crosshair shadow-sm !bg-accent-blue"
      />
    </div>
  );
});
TransformNode.displayName = 'TransformNode';

// 6. If / Else Condition Node
export const ConditionNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  const cfg = nodeData.config || {};
  return (
    <div
      className={cn(
        'group relative min-w-[220px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-accent-violet border-accent-violet shadow-md' : 'hover:border-accent-violet/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background hover:!scale-125 !transition-transform !cursor-crosshair shadow-sm !bg-accent-violet"
      />

      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-accent-violet/15 text-accent-violet">
          <GitBranch className="size-4" />
        </div>
        <div>
          <div className="text-xs font-bold text-foreground">
            {nodeData.label || 'If / Else'}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {cfg.variable ? `${cfg.variable} ${cfg.operator || '=='} ${cfg.value || ''}` : 'Branching Logic'}
          </div>
        </div>
      </div>

      {/* True Handle (Top Right) */}
      <div className="mt-3 flex items-center justify-between text-[10px] font-semibold text-success">
        <span>True</span>
        <SourceHandleWithQuickAdd
          id="true"
          position={Position.Right}
          style={{ top: '42%' }}
          onConnectNext={nodeData.onConnectNext}
          className="!size-3 !border-2 !border-background hover:!scale-125 !transition-transform !cursor-crosshair shadow-sm !bg-success"
        />
      </div>

      {/* False Handle (Bottom Right) */}
      <div className="flex items-center justify-between text-[10px] font-semibold text-destructive">
        <span>False</span>
        <SourceHandleWithQuickAdd
          id="false"
          position={Position.Right}
          style={{ top: '78%' }}
          onConnectNext={nodeData.onConnectNext}
          className="!size-3 !border-2 !border-background hover:!scale-125 !transition-transform !cursor-crosshair shadow-sm !bg-destructive"
        />
      </div>
    </div>
  );
});
ConditionNode.displayName = 'ConditionNode';

// 7. While Loop Node
export const WhileLoopNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  return (
    <div
      className={cn(
        'group relative min-w-[210px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-accent-violet border-accent-violet shadow-md' : 'hover:border-accent-violet/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background hover:!scale-125 !transition-transform !cursor-crosshair shadow-sm !bg-accent-violet"
      />

      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-accent-violet/15 text-accent-violet">
          <Repeat className="size-4" />
        </div>
        <div>
          <div className="text-xs font-bold text-foreground">
            {nodeData.label || 'While Loop'}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {nodeData.subtitle || 'Iterative batching'}
          </div>
        </div>
      </div>

      <SourceHandleWithQuickAdd
        position={Position.Right}
        onConnectNext={nodeData.onConnectNext}
        className="!size-3 !border-2 !border-background hover:!scale-125 !transition-transform !cursor-crosshair shadow-sm !bg-accent-violet"
      />
    </div>
  );
});
WhileLoopNode.displayName = 'WhileLoopNode';

// 8. User Approval Node (Human in the loop)
export const UserApprovalNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  const cfg = nodeData.config || {};
  return (
    <div
      className={cn(
        'group relative min-w-[230px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-destructive border-destructive shadow-md' : 'hover:border-destructive/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background hover:!scale-125 !transition-transform !cursor-crosshair shadow-sm !bg-destructive"
      />

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-destructive/15 text-destructive">
            <UserCheck className="size-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">
              {nodeData.label || 'User Approval'}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {nodeData.subtitle || 'Human signoff gate'}
            </div>
          </div>
        </div>

        <span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] font-semibold text-destructive">
          Pause Flow
        </span>
      </div>

      {cfg.action && (
        <div className="mt-2 text-[10px] text-muted-foreground italic truncate">
          Action: {String(cfg.action)}
        </div>
      )}

      <SourceHandleWithQuickAdd
        position={Position.Right}
        onConnectNext={nodeData.onConnectNext}
        className="!size-3 !border-2 !border-background hover:!scale-125 !transition-transform !cursor-crosshair shadow-sm !bg-destructive"
      />
    </div>
  );
});
UserApprovalNode.displayName = 'UserApprovalNode';

// 9. End Node
export const EndNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  return (
    <div
      className={cn(
        'group relative min-w-[200px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-success border-success shadow-md' : 'hover:border-success/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background hover:!scale-125 !transition-transform !cursor-crosshair shadow-sm !bg-success"
      />

      <div className="flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-success/15 text-success">
          <CheckCircle2 className="size-4" />
        </div>
        <div>
          <div className="text-xs font-bold text-foreground">
            {nodeData.label || 'Workflow End'}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {nodeData.subtitle || 'Final output delivery'}
          </div>
        </div>
      </div>
    </div>
  );
});
EndNode.displayName = 'EndNode';

// 10. Generic / Dynamic Node for catalog nodes
export const GenericStudioNode = memo(({ data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  const cfg = nodeData.config || {};
  return (
    <div
      className={cn(
        'group relative min-w-[220px] max-w-[280px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-primary border-primary shadow-md' : 'hover:border-primary/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-2 !border-background hover:!scale-125 !transition-transform !cursor-crosshair shadow-sm !bg-primary"
      />

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Cpu className="size-4" />
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">
              {nodeData.label || 'Studio Node'}
            </div>
            <div className="text-[11px] text-muted-foreground line-clamp-1">
              {nodeData.subtitle || 'Step Execution'}
            </div>
          </div>
        </div>

        {nodeData.badge && (
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
            {nodeData.badge}
          </span>
        )}
      </div>

      {cfg.action && (
        <div className="mt-2 text-[10px] text-muted-foreground font-mono truncate">
          {String(cfg.action)}
        </div>
      )}

      <SourceHandleWithQuickAdd
        position={Position.Right}
        onConnectNext={nodeData.onConnectNext}
        className="!size-3 !border-2 !border-background hover:!scale-125 !transition-transform !cursor-crosshair shadow-sm !bg-primary"
      />
    </div>
  );
});
// 11. Sticky Note / Documentation Node
export const StickyNoteNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  const [text, setText] = React.useState(nodeData.text || nodeData.label || 'Workflow documentation note…');
  const color = nodeData.color || 'yellow';

  const colorStyles: Record<string, string> = {
    yellow: 'bg-warning/10 border-warning/30 text-amber-950 dark:text-amber-200',
    blue: 'bg-accent-blue/10 border-accent-blue/30 text-sky-950 dark:text-sky-200',
    purple: 'bg-accent-violet/10 border-accent-violet/30 text-purple-950 dark:text-purple-200',
    green: 'bg-success/10 border-success/30 text-emerald-950 dark:text-emerald-200',
  };

  return (
    <div
      className={cn(
        'group relative min-w-[190px] max-w-[280px] rounded-2xl border p-3 shadow-xs transition-all backdrop-blur-xs',
        colorStyles[color] || colorStyles.yellow,
        selected ? 'ring-2 ring-primary shadow-md' : 'hover:border-primary/40',
      )}
    >
      <NodeActionToolbar id={id} data={nodeData} selected={selected} />
      <div className="flex items-center gap-1.5 font-bold text-xs mb-1.5 opacity-80">
        <StickyNote className="size-3.5" />
        <span>{nodeData.label || 'Note'}</span>
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (nodeData.onChange) nodeData.onChange(e.target.value);
        }}
        rows={3}
        className="w-full bg-transparent text-xs resize-none focus:outline-none placeholder:text-muted-foreground/60 leading-relaxed font-sans"
        placeholder="Type note…"
      />
    </div>
  );
});
StickyNoteNode.displayName = 'StickyNoteNode';

// 12. Group / Subflow Stage Node
export const GroupNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  return (
    <div
      className={cn(
        'group relative min-w-[340px] min-h-[220px] rounded-2xl border-2 border-dashed border-border/80 bg-surface/30 p-4 transition-all',
        selected ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/40',
      )}
    >
      <NodeActionToolbar id={id} data={nodeData} selected={selected} />
      <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground mb-2">
        <Folder className="size-4 text-primary" />
        <span>{nodeData.label || 'Stage Group'}</span>
        {nodeData.subtitle && (
          <span className="text-[10px] text-muted-foreground font-normal">
            ({nodeData.subtitle})
          </span>
        )}
      </div>
    </div>
  );
});
GroupNode.displayName = 'GroupNode';

// Registered custom node types map for ReactFlow
const BASE_NODE_TYPES: Record<string, any> = {
  // Triggers
  START: StartNode,
  TRIGGER: StartNode,
  TRIGGER_MANUAL: StartNode,
  TRIGGER_CHAT: StartNode,
  TRIGGER_FORM: StartNode,
  TRIGGER_SCHEDULE: StartNode,
  TRIGGER_WEBHOOK: StartNode,
  TRIGGER_API: StartNode,
  TRIGGER_APP_EVENT: StartNode,
  TRIGGER_DB_EVENT: StartNode,
  TRIGGER_EMAIL: StartNode,
  TRIGGER_AGENT: StartNode,
  TRIGGER_EVENT: StartNode,

  // AI & Reasoning
  AGENT: AgentNode,
  SUB_AGENT: AgentNode,
  AGENT_COORDINATOR: AgentNode,
  AI_CHAT_MODEL: AgentNode,
  INTENT_CLASSIFIER: AgentNode,
  STRUCTURED_OUTPUT: AgentNode,
  AI_SUMMARIZER: AgentNode,
  AI_TRANSLATOR: AgentNode,
  AI_SENTIMENT: AgentNode,
  AI_ENTITY_EXTRACTOR: AgentNode,
  AI_GUARDRAIL: AgentNode,
  MODEL_ROUTER: AgentNode,
  LLM_ROUTER: AgentNode,
  PROMPT_TEMPLATE: AgentNode,
  REASONING_CHAIN: AgentNode,

  // Firecrawl & Tools
  FIRECRAWL_SEARCH: FirecrawlNode,
  FIRECRAWL_SCRAPE: FirecrawlNode,
  FIRECRAWL_CRAWL: FirecrawlNode,
  FIRECRAWL_EXTRACT: FirecrawlNode,
  TOOL: MCPToolNode,
  MCP: MCPToolNode,
  MCP_TOOL: MCPToolNode,
  HTTP_REQUEST: MCPToolNode,
  DB_QUERY: MCPToolNode,
  DB_WRITE: MCPToolNode,
  SLACK_SEND: MCPToolNode,
  EMAIL_SEND: MCPToolNode,
  GITHUB_ACTION: MCPToolNode,

  // Knowledge & RAG
  KB_SEARCH: TransformNode,
  DOC_RETRIEVAL: TransformNode,
  VECTOR_SEARCH: TransformNode,
  KNOWLEDGE_RETRIEVAL: TransformNode,
  RERANKER: TransformNode,
  CONTEXT_BUILDER: TransformNode,
  TEXT_SPLITTER: TransformNode,

  // Data & Transform
  TRANSFORM: TransformNode,
  CODE: TransformNode,
  CODE_JAVASCRIPT: TransformNode,
  CODE_PYTHON: TransformNode,
  SET_VARIABLE: TransformNode,
  GET_VARIABLE: TransformNode,
  DATA_MAPPER: TransformNode,
  DATA_FILTER: TransformNode,
  JSON_PARSER: TransformNode,
  DATE_FORMATTER: TransformNode,

  // Logic & Flow
  IF_ELSE: ConditionNode,
  CONDITION: ConditionNode,
  SWITCH_CASE: ConditionNode,
  PARALLEL_SPLIT: ConditionNode,
  MERGE_PATHS: ConditionNode,
  WHILE_LOOP: WhileLoopNode,
  LOOP: WhileLoopNode,
  WAIT_DELAY: WhileLoopNode,
  RETRY_NODE: WhileLoopNode,
  ERROR_HANDLER: ConditionNode,
  STOP_WORKFLOW: EndNode,

  // Human in the Loop
  USER_APPROVAL: UserApprovalNode,
  HUMAN_APPROVAL: UserApprovalNode,
  HUMAN_INPUT: UserApprovalNode,
  HUMAN_REVIEW: UserApprovalNode,
  HUMAN_TASK: UserApprovalNode,
  ESCALATE_HUMAN: UserApprovalNode,

  // Outputs
  END: EndNode,
  OUTPUT: EndNode,
  CHAT_RESPONSE: EndNode,
  RESPONSE_STREAM: EndNode,
  WEBHOOK_RESPONSE: EndNode,
  RETURN_TO_PARENT: EndNode,

  // Annotations & Helpers
  STICKY_NOTE: StickyNoteNode,
  NOTE: StickyNoteNode,
  ANNOTATION: StickyNoteNode,
  GROUP: GroupNode,
  SUBFLOW: GroupNode,
  STAGE: GroupNode,
  generic: GenericStudioNode,
  default: GenericStudioNode,
};

// Use Proxy so ANY unrecognized catalog node gracefully renders GenericStudioNode
export const STUDIO_NODE_TYPES = new Proxy(BASE_NODE_TYPES, {
  get(target, prop) {
    if (typeof prop === 'string' && prop in target) {
      return target[prop];
    }
    return GenericStudioNode;
  },
});
