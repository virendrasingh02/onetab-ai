import {
  AppSelect,
  Badge,
  Button,
  Input,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  type AppSelectOption,
} from '@org/ui';
import { cn } from '@org/utils';
import { Handle, NodeToolbar, Position, type NodeProps } from '@xyflow/react';
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Cpu,
  Eye,
  Flame,
  Folder,
  GitBranch,
  Link2,
  Network,
  Pencil,
  Play,
  Plus,
  Repeat,
  ScrollText,
  Search,
  Settings2,
  StickyNote,
  Trash2,
  UserCheck,
  Wrench,
  X,
} from 'lucide-react';
import React, { memo, useCallback, useState, useRef, useEffect, useMemo } from 'react';
import {
  AGENT_SLOTS,
  DELEGATION_MODES,
  isSlotHost,
  slotCatalog,
  type AgentSlotDef,
  type AgentSlotId,
} from './agent-slots.js';
import { CATALOG_NODES, type CatalogNodeItem, type NodeCategory } from './node-library.js';

export interface WorkflowNodePayload {
  label: string;
  subtitle?: string;
  status?: 'idle' | 'running' | 'success' | 'failed' | 'waiting';
  config?: Record<string, any>;
  /** Canvas lock state — hides mutating quick actions. */
  locked?: boolean;
  onTest?: (nodeId: string) => void;
  onEdit?: (nodeId: string) => void;
  onDuplicate?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  onConnectNext?: (item: CatalogNodeItem, handleId?: string) => void;
  /** Merge a patch into this node's config (inline editors on Prompt / LLM nodes). */
  onUpdateConfig?: (patch: Record<string, unknown>) => void;
  /** Agent nodes: what's plugged into each slot. */
  slots?: AgentSlotSummary;
  /** Nodes plugged into an agent slot: which agent and slot. */
  attachedTo?: { label: string; slot: string };
  /** Agents: team role, setup issues, resolved model. */
  team?: AgentTeamInfo;
  /** Agents: hide everything plugged in (persisted with the graph). */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
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
  { id: 'knowledge', label: 'Knowledge' },
  { id: 'tools', label: 'Tools' },
  { id: 'logic', label: 'Logic' },
  { id: 'triggers', label: 'Triggers' },
  { id: 'transform', label: 'Data' },
  { id: 'human', label: 'Human' },
  { id: 'output', label: 'Output' },
];

/**
 * Searchable node catalog shown when adding a connected step. Shared by the
 * output-handle "+" and the node hover toolbar "+". Closes on outside click
 * (anything outside `anchorRef`) or Escape, and lifts its parent node above
 * the rest of the canvas while open.
 */
function QuickAddMenu({
  anchorRef,
  onSelect,
  onClose,
  className,
  items,
  title,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  onSelect: (item: CatalogNodeItem) => void;
  onClose: () => void;
  className?: string;
  /** Restrict the menu to these entries (an agent slot's compatible nodes); hides the category pills. */
  items?: CatalogNodeItem[];
  title?: string;
}) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<NodeCategory>('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filteredNodes = useMemo(() => {
    return (items ?? CATALOG_NODES).filter((n) => {
      if (!items && activeCategory !== 'all' && n.category !== activeCategory) {
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
  }, [search, activeCategory, items]);

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
    // Elevate the parent ReactFlow node so this dropdown is ALWAYS in front of all other canvas nodes
    const nodeEl = anchorRef.current?.closest('.react-flow__node') as HTMLElement | null;
    if (nodeEl) {
      nodeEl.classList.add('quick-add-open');
      nodeEl.style.setProperty('z-index', '99999', 'important');
    }

    function handleClickOutside(e: Event) {
      const target = e.target as Node | null;
      if (anchorRef.current && target && !anchorRef.current.contains(target)) {
        onClose();
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
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
  }, [anchorRef, onClose]);

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
        onSelect(filteredNodes[activeIndex]);
      }
    }
  };

  return (
    <div
      className={cn(
        'nowheel nodrag nopan quick-add-open absolute w-80 rounded-xl border border-border bg-card/95 p-3 shadow-2xl backdrop-blur-md z-[99999] text-foreground cursor-default animate-in fade-in zoom-in-95 duration-150',
        className,
      )}
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
              onClose();
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground p-0.5 rounded cursor-pointer"
            title="Close"
          >
            <X className="size-3" />
          </button>
        )}
      </div>

      {title && (
        <div className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </div>
      )}

      {/* Category Filter Pills */}
      <div
        className={cn(
          'nowheel gap-1 overflow-x-auto pb-1.5 mb-2 scrollbar-none text-[10px]',
          items ? 'hidden' : 'flex',
        )}
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
                  onSelect(item);
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
  );
}

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
  const containerRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setIsOpen(false), []);

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
          <QuickAddMenu
            anchorRef={containerRef}
            onClose={close}
            onSelect={(item) => {
              onConnectNext?.(item, id);
              setIsOpen(false);
            }}
            className="left-[calc(100%+8px)] top-1/2 -translate-y-1/2"
          />
        )}
      </div>
    </>
  );
}

// Approximate rendered height of QuickAddMenu (search + pills + max-h-72 list + padding)
const ADD_MENU_HEIGHT = 400;

function ToolbarButton({
  label,
  onClick,
  active,
  tone = 'default',
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  tone?: 'default' | 'danger';
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        // Joined segments: outer corners rounded, shared borders collapsed
        'relative flex size-7 items-center justify-center border border-border bg-surface transition-colors cursor-pointer',
        'first:rounded-l-[10px] last:rounded-r-[10px] not-first:border-l-0',
        'focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-primary/60',
        tone === 'danger'
          ? 'text-foreground hover:bg-destructive/15 hover:text-destructive'
          : 'text-foreground hover:bg-surface-raised',
        active && 'bg-surface-raised text-primary',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Quick actions above the selected node: add next step, preview, edit,
 * duplicate, delete. Rendered through React Flow's NodeToolbar so it stays a
 * constant size at any zoom and only shows for a single selected node (or
 * while its add-menu is open). Mutating actions are hidden while the canvas is
 * locked.
 */
export function NodeActionToolbar({
  id,
  data,
  addHandleId,
  canAddNext = true,
}: {
  id: string;
  data: WorkflowNodePayload;
  selected?: boolean;
  /** Source handle the toolbar "+" connects from (e.g. `true` on If/Else). */
  addHandleId?: string;
  /** False for nodes without an output handle (End, notes, groups). */
  canAddNext?: boolean;
}) {
  const [isAddOpen, setIsAddOpen] = useState(false);
  // Open the add-menu upward when there's room, otherwise drop it below the toolbar
  const [addMenuBelow, setAddMenuBelow] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const closeAdd = useCallback(() => setIsAddOpen(false), []);
  const toggleAdd = () => {
    if (!isAddOpen) {
      const top = containerRef.current?.getBoundingClientRect().top ?? Infinity;
      setAddMenuBelow(top < ADD_MENU_HEIGHT);
    }
    setIsAddOpen((prev) => !prev);
  };
  const locked = Boolean(data?.locked);
  const name = data?.label || 'node';

  const showAdd = canAddNext && !locked && Boolean(data?.onConnectNext);
  const showPreview = Boolean(data?.onTest);
  const showEdit = Boolean(data?.onEdit);
  const showDuplicate = !locked && Boolean(data?.onDuplicate);
  const showDelete = !locked && Boolean(data?.onDelete);

  if (!showAdd && !showPreview && !showEdit && !showDuplicate && !showDelete) return null;

  return (
    <NodeToolbar
      position={Position.Top}
      offset={8}
      // undefined = React Flow's default: visible only while this node is the single selection
      isVisible={isAddOpen || undefined}
      className="nodrag nopan nowheel"
    >
      <div
        ref={containerRef}
        className="relative animate-in fade-in zoom-in-95 duration-100"
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <div role="group" aria-label={`${name} actions`} className="flex items-stretch rounded-[10px] shadow-sm select-none">
          {showAdd && (
            <ToolbarButton
              label={`Add a step after ${name}`}
              active={isAddOpen}
              onClick={toggleAdd}
            >
              <Plus className="size-3.5" />
            </ToolbarButton>
          )}
          {showPreview && (
            <ToolbarButton label={`Preview ${name} in a test run`} onClick={() => data.onTest?.(id)}>
              <Eye className="size-3.5" />
            </ToolbarButton>
          )}
          {showEdit && (
            <ToolbarButton label={`Edit ${name}`} onClick={() => data.onEdit?.(id)}>
              <Pencil className="size-3.5" />
            </ToolbarButton>
          )}
          {showDuplicate && (
            <ToolbarButton label={`Duplicate ${name}`} onClick={() => data.onDuplicate?.(id)}>
              <Copy className="size-3.5" />
            </ToolbarButton>
          )}
          {showDelete && (
            <ToolbarButton label={`Delete ${name}`} tone="danger" onClick={() => data.onDelete?.(id)}>
              <Trash2 className="size-3.5" />
            </ToolbarButton>
          )}
        </div>

        {isAddOpen && (
          <QuickAddMenu
            anchorRef={containerRef}
            onClose={closeAdd}
            onSelect={(item) => {
              data.onConnectNext?.(item, addHandleId);
              setIsAddOpen(false);
            }}
            className={cn(
              'left-1/2 -translate-x-1/2',
              addMenuBelow ? 'top-[calc(100%+6px)]' : 'bottom-[calc(100%+6px)]',
            )}
          />
        )}
      </div>
    </NodeToolbar>
  );
}

// 1. Start Node
export const StartNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  return (
    <div
      className={cn(
        'group relative min-w-[200px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-primary border-primary shadow-md' : 'hover:border-primary/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <NodeActionToolbar id={id} data={nodeData} selected={selected} />

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

/** Slot summary the page passes to agent nodes: what's plugged into each slot. */
export type AgentSlotSummary = Partial<Record<AgentSlotId, { id: string; label: string }[]>>;

/** Team-level facts the page works out for each agent (see agent-slots.ts). */
export interface AgentTeamInfo {
  /** Supervisor = has sub-agents; member = is someone's sub-agent (can be both). */
  role: 'solo' | 'supervisor' | 'member' | 'lead';
  issues: string[];
  model: { model: string; inherited: boolean } | null;
  /** Nodes hidden below this agent while it's collapsed. */
  hiddenCount: number;
}

/** "+" on a slot row: a quick-add menu limited to what that slot accepts. */
function SlotAddButton({
  slot,
  onSelect,
}: {
  slot: AgentSlotDef;
  onSelect: (item: CatalogNodeItem) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setIsOpen(false), []);
  const items = useMemo(() => slotCatalog(slot.id), [slot.id]);
  const label = slot.multiple ? `Add to ${slot.label}` : `Set ${slot.label}`;

  return (
    <div ref={containerRef} className={cn('nodrag nopan nowheel relative', isOpen && 'z-[99999] quick-add-open')}>
      <Button
        type="button"
        variant="primary"
        size="icon-xs"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        className={cn('size-5 rounded-full', isOpen && 'ring-2 ring-primary/40')}
        title={label}
        aria-label={label}
        aria-expanded={isOpen}
      >
        <Plus className="size-3 stroke-[2.5]" />
      </Button>
      {isOpen && (
        <QuickAddMenu
          anchorRef={containerRef}
          items={items}
          title={slot.hint}
          onClose={close}
          onSelect={(item) => {
            onSelect(item);
            setIsOpen(false);
          }}
          className="left-[calc(100%+24px)] top-1/2 -translate-y-1/2"
        />
      )}
    </div>
  );
}

/** One row on an agent: label, what's attached, "+" and the slot's source handle on the node edge. */
function SlotRow({
  label,
  summary,
  count = 0,
  empty,
  handleId,
  addButton,
  children,
}: {
  label: string;
  summary: string | null;
  count?: number;
  empty: string;
  handleId?: string;
  addButton?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="relative">
      <div className="rounded-lg border border-border bg-surface-raised/50 px-2.5 py-1.5">
        <div className="flex items-center gap-2">
          <span
            className={cn('size-1.5 shrink-0 rounded-full', summary ? 'bg-primary' : 'bg-muted-foreground/40')}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
              {label}
              {count > 1 && <Badge variant="primary" className="h-4 px-1 text-[9px]">{count}</Badge>}
            </div>
            <div className={cn('truncate text-[10px]', summary ? 'text-primary' : 'text-muted-foreground/70')}>
              {summary || empty}
            </div>
          </div>
          {addButton}
        </div>
        {children}
      </div>
      <Handle
        type="source"
        id={handleId}
        position={Position.Right}
        // Sit on the node's edge, not the row's (node has 14px padding + 1px border)
        style={{ right: -15 }}
        className="!size-2.5 !border-2 !border-background hover:!scale-125 !transition-transform !cursor-crosshair shadow-sm !bg-primary"
      />
    </div>
  );
}

export const MODEL_OPTIONS: AppSelectOption[] = [
  { value: 'llama3:latest', label: 'Llama 3' },
  { value: 'gpt-4o', label: 'OpenAI GPT-4o' },
  { value: 'gpt-4o-mini', label: 'OpenAI GPT-4o mini' },
  { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
  { value: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
  { value: 'mistral-large', label: 'Mistral Large' },
];
const modelLabel = (model: unknown) =>
  MODEL_OPTIONS.find((m) => m.value === model)?.label ?? String(model).replace(':latest', '');

const DELEGATION_OPTIONS: AppSelectOption[] = DELEGATION_MODES.map((m) => ({
  value: m.value,
  label: m.label,
  description: m.hint,
}));

const ROLE_BADGE: Record<AgentTeamInfo['role'], { label: string; variant: 'neutral' | 'primary' | 'info' } | null> = {
  solo: null,
  supervisor: { label: 'Supervisor', variant: 'primary' },
  lead: { label: 'Team lead', variant: 'primary' },
  member: { label: 'Sub-agent', variant: 'info' },
};

/** Agent with Prompt / LLM / Embeddings / Tools / Sub-agents slots and its normal Output. */
function SlottedAgentNode({ id, data, selected, type }: NodeProps) {
  const nodeData = data as WorkflowNodePayload;
  const cfg = nodeData.config || {};
  const slots = (nodeData.slots || {}) as AgentSlotSummary;
  const team = nodeData.team as AgentTeamInfo | undefined;
  const locked = Boolean(nodeData.locked);
  const canAdd = !locked && Boolean(nodeData.onConnectNext);
  const collapsed = Boolean(nodeData.collapsed);
  const isCoordinator = (type || '').toUpperCase() === 'AGENT_COORDINATOR';
  const subAgents = slots.agents || [];
  const roleBadge = team ? ROLE_BADGE[team.role] : null;
  const issues = team?.issues ?? [];
  const totalAttached = AGENT_SLOTS.reduce((sum, s) => sum + (slots[s.id]?.length ?? 0), 0);

  const summaryFor = (slotId: AgentSlotId): string | null => {
    const attached = slots[slotId] || [];
    if (attached.length === 0) return null;
    return attached.length === 1 ? attached[0].label : `${attached[0].label} +${attached.length - 1} more`;
  };
  // With nothing wired, say what the agent falls back to from its own settings (or its supervisor)
  const fallbackFor = (slotId: AgentSlotId): string => {
    if (slotId === 'prompt') return cfg.instructions ? 'Using built-in instructions' : 'No prompt';
    if (slotId === 'llm') {
      if (team?.model) return `${team.model.inherited ? 'Inherited' : 'Built-in'}: ${modelLabel(team.model.model)}`;
      return cfg.model ? `Built-in: ${modelLabel(cfg.model)}` : 'No model';
    }
    if (slotId === 'tools') {
      const n = (cfg.tools as string[] | undefined)?.length ?? 0;
      return n > 0 ? `${n} built-in tool${n === 1 ? '' : 's'}` : 'No tools';
    }
    if (slotId === 'agents') return isCoordinator ? 'Add the agents this team uses' : 'Works alone';
    return 'No knowledge';
  };

  return (
    <div
      className={cn(
        'group relative w-[290px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-primary border-primary shadow-md' : 'hover:border-primary/50',
        statusBorderClasses[nodeData.status || 'idle'],
        isCoordinator && !selected && 'border-primary/40',
      )}
    >
      <NodeActionToolbar id={id} data={nodeData} selected={selected} />

      <Handle
        type="target"
        position={Position.Left}
        style={{ top: 32 }}
        className="!size-3 !border-2 !border-background hover:!scale-125 !transition-transform !cursor-crosshair shadow-sm !bg-primary"
      />

      <div className="flex items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          {isCoordinator || subAgents.length > 0 ? <Network className="size-4" /> : <Bot className="size-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-xs font-bold text-foreground">{nodeData.label || 'AI Agent'}</span>
            {roleBadge && (
              <Badge variant={roleBadge.variant} className="h-4 shrink-0 px-1.5 text-[9px]">
                {roleBadge.label}
              </Badge>
            )}
          </div>
          <div className="truncate text-[11px] text-muted-foreground">{nodeData.subtitle || 'AI workflow agent'}</div>
        </div>
        {issues.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="nodrag flex size-6 shrink-0 items-center justify-center rounded-md text-warning hover:bg-warning/10"
                aria-label={`${issues.length} setup issue${issues.length === 1 ? '' : 's'}`}
                tabIndex={0}
              >
                <AlertTriangle className="size-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-60">
              <ul className="space-y-1 text-[11px]">
                {issues.map((issue) => (
                  <li key={issue}>{issue}</li>
                ))}
              </ul>
            </TooltipContent>
          </Tooltip>
        )}
        {totalAttached > 0 && nodeData.onToggleCollapse && (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="nodrag shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              nodeData.onToggleCollapse?.();
            }}
            title={collapsed ? 'Show what’s plugged in' : 'Hide what’s plugged in'}
            aria-label={collapsed ? 'Expand attachments' : 'Collapse attachments'}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </Button>
        )}
      </div>

      {collapsed ? (
        // Collapsed: one compact summary; the hidden nodes' wires gather on this row
        <div className="mt-3 flex flex-col gap-1.5">
          <div className="order-last">
            <SlotRow label="Output" summary={null} empty="Next step in the flow" />
          </div>
          <div className="relative rounded-lg border border-dashed border-border px-2.5 py-1.5 text-[10px] text-muted-foreground">
            {totalAttached} plugged in
            {team && team.hiddenCount > totalAttached ? ` · ${team.hiddenCount} steps hidden` : ''} ·{' '}
            {AGENT_SLOTS.filter((s) => (slots[s.id]?.length ?? 0) > 0)
              .map((s) => s.label)
              .join(', ')}
          </div>
        </div>
      ) : (
        /* Output comes first in the DOM (shown last): edges without a sourceHandle bind to the first handle */
        <div className="mt-3 flex flex-col gap-1.5">
          <div className="order-last">
            <SlotRow label="Output" summary={null} empty="Next step in the flow" />
          </div>
          {AGENT_SLOTS.map((slot) => (
            <SlotRow
              key={slot.id}
              label={slot.label}
              handleId={slot.id}
              summary={summaryFor(slot.id)}
              count={slots[slot.id]?.length ?? 0}
              empty={fallbackFor(slot.id)}
              addButton={
                canAdd ? (
                  <SlotAddButton slot={slot} onSelect={(item) => nodeData.onConnectNext?.(item, slot.id)} />
                ) : null
              }
            >
              {slot.id === 'agents' && (subAgents.length > 1 || isCoordinator) && (
                <div className="nodrag nopan mt-1.5" onClick={(e) => e.stopPropagation()}>
                  <AppSelect
                    size="sm"
                    aria-label="How this agent delegates"
                    value={String(cfg.delegation || 'router')}
                    options={DELEGATION_OPTIONS}
                    disabled={locked || !nodeData.onUpdateConfig}
                    onValueChange={(delegation) => nodeData.onUpdateConfig?.({ delegation })}
                    className="h-7 text-[11px]"
                  />
                </div>
              )}
            </SlotRow>
          ))}
        </div>
      )}
      {collapsed && (
        // Keep every slot handle mounted so the wires of hidden nodes don't error
        <div className="hidden">
          {AGENT_SLOTS.map((slot) => (
            <Handle key={slot.id} type="source" id={slot.id} position={Position.Right} />
          ))}
        </div>
      )}
      <AttachedChip data={nodeData} />
    </div>
  );
}

/** Small "Tools · Agent 1" chip on nodes plugged into an agent slot. */
function AttachedChip({ data }: { data: WorkflowNodePayload }) {
  const attachedTo = data.attachedTo;
  if (!attachedTo) return null;
  return (
    <Badge variant="primary" className="mt-2 h-5 max-w-full gap-1 px-1.5 text-[9px]">
      <Link2 className="size-2.5 shrink-0" />
      <span className="truncate">
        {attachedTo.slot} · {attachedTo.label}
      </span>
    </Badge>
  );
}

/** Configure button for tool-style nodes: opens the node panel. */
function ConfigureButton({ id, data }: { id: string; data: WorkflowNodePayload }) {
  if (!data.onEdit) return null;
  return (
    <Button
      type="button"
      variant="primary"
      size="xs"
      className="nodrag mt-2.5"
      onClick={(e) => {
        e.stopPropagation();
        data.onEdit?.(id);
      }}
    >
      <Settings2 />
      Configure
    </Button>
  );
}

/** Keeps a text field responsive while typing; commits to the graph shortly after, and on blur. */
function useDraftValue(value: string, commit: (next: string) => void) {
  const [draft, setDraft] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => {
    setDraft(value);
  }, [value]);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const flush = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (next !== value) commitRef.current(next);
  };
  const change = (next: string) => {
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => flush(next), 300);
  };
  return { draft, change, flush };
}

const fieldLabelClass = 'text-[10px] font-semibold text-muted-foreground';

// 2a. Prompt Node — the agent's system prompt, editable on the canvas
export const PromptNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  const cfg = nodeData.config || {};
  const locked = Boolean(nodeData.locked) || !nodeData.onUpdateConfig;
  const { draft, change, flush } = useDraftValue(String(cfg.prompt ?? ''), (prompt) =>
    nodeData.onUpdateConfig?.({ prompt }),
  );
  return (
    <div
      className={cn(
        'group relative w-[270px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-primary border-primary shadow-md' : 'hover:border-primary/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <NodeActionToolbar id={id} data={nodeData} selected={selected} />
      <Handle
        type="target"
        position={Position.Left}
        style={{ top: 32 }}
        className="!size-3 !border-2 !border-background hover:!scale-125 !transition-transform !cursor-crosshair shadow-sm !bg-primary"
      />
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
          <ScrollText className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs font-bold text-foreground">{nodeData.label || 'Prompt'}</div>
          <div className="truncate text-[11px] text-muted-foreground">{nodeData.subtitle || 'System prompt'}</div>
        </div>
      </div>
      <label className={cn(fieldLabelClass, 'mt-3 block')} htmlFor={`${id}-prompt`}>
        Prompt <span className="text-destructive">*</span>
      </label>
      <Textarea
        id={`${id}-prompt`}
        value={draft}
        disabled={locked}
        invalid={!draft.trim()}
        onChange={(e) => change(e.target.value)}
        onBlur={(e) => flush(e.target.value)}
        minRows={5}
        maxRows={12}
        placeholder={'## Role\nYou are…\n\n## Scope\n…'}
        className="nodrag nopan nowheel mt-1 font-mono text-[11px] leading-relaxed"
      />
      <AttachedChip data={nodeData} />
      <SourceHandleWithQuickAdd
        position={Position.Right}
        onConnectNext={nodeData.onConnectNext}
        className="!size-3 !border-2 !border-background hover:!scale-125 !transition-transform !cursor-crosshair shadow-sm !bg-primary"
      />
    </div>
  );
});
PromptNode.displayName = 'PromptNode';

// 2b. LLM Node — model settings, editable on the canvas
export const LlmNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  const cfg = nodeData.config || {};
  const locked = Boolean(nodeData.locked) || !nodeData.onUpdateConfig;
  const update = (patch: Record<string, unknown>) => nodeData.onUpdateConfig?.(patch);
  const model = String(cfg.model ?? 'gpt-4o');
  const options = MODEL_OPTIONS.some((m) => m.value === model)
    ? MODEL_OPTIONS
    : [{ value: model, label: model }, ...MODEL_OPTIONS];
  return (
    <div
      className={cn(
        'group relative w-[250px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-primary border-primary shadow-md' : 'hover:border-primary/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <NodeActionToolbar id={id} data={nodeData} selected={selected} />
      <Handle
        type="target"
        position={Position.Left}
        style={{ top: 32 }}
        className="!size-3 !border-2 !border-background hover:!scale-125 !transition-transform !cursor-crosshair shadow-sm !bg-primary"
      />
      <div className="flex items-center gap-2.5">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-success/15 text-success">
          <Cpu className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-xs font-bold text-foreground">{nodeData.label || 'LLM'}</div>
          <div className="truncate text-[11px] text-muted-foreground">{nodeData.subtitle || 'Chat model'}</div>
        </div>
      </div>

      <div className="nodrag nopan mt-3 space-y-2">
        <div className="space-y-1">
          <span className={fieldLabelClass}>Model</span>
          <AppSelect
            size="sm"
            aria-label="Model"
            value={model}
            options={options}
            disabled={locked}
            onValueChange={(next) => update({ model: next })}
            className="h-7 text-[11px]"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className={fieldLabelClass} htmlFor={`${id}-temp`}>
              Temperature
            </label>
            <Input
              id={`${id}-temp`}
              inputSize="sm"
              type="number"
              min={0}
              max={2}
              step={0.1}
              disabled={locked}
              value={cfg.temperature ?? 0.7}
              onChange={(e) => {
                const v = e.target.valueAsNumber;
                if (Number.isFinite(v)) update({ temperature: Math.min(2, Math.max(0, v)) });
              }}
              className="text-[11px]"
            />
          </div>
          <div className="space-y-1">
            <label className={fieldLabelClass} htmlFor={`${id}-max`}>
              Max tokens
            </label>
            <Input
              id={`${id}-max`}
              inputSize="sm"
              type="number"
              min={1}
              step={256}
              disabled={locked}
              value={cfg.maxTokens ?? 2048}
              onChange={(e) => {
                const v = e.target.valueAsNumber;
                if (Number.isFinite(v) && v >= 1) update({ maxTokens: Math.round(v) });
              }}
              className="text-[11px]"
            />
          </div>
        </div>
      </div>
      <AttachedChip data={nodeData} />
      <SourceHandleWithQuickAdd
        position={Position.Right}
        onConnectNext={nodeData.onConnectNext}
        className="!size-3 !border-2 !border-background hover:!scale-125 !transition-transform !cursor-crosshair shadow-sm !bg-success"
      />
    </div>
  );
});
LlmNode.displayName = 'LlmNode';

// 2. Agent Node
export const AgentNode = memo((props: NodeProps) => {
  if (isSlotHost(props.type)) return <SlottedAgentNode {...props} />;
  const { id, data, selected } = props;
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
      <NodeActionToolbar id={id} data={nodeData} selected={selected} />

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
export const FirecrawlNode = memo(({ id, data, selected }: NodeProps) => {
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
      <NodeActionToolbar id={id} data={nodeData} selected={selected} />

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

      <AttachedChip data={nodeData} />
      <div>
        <ConfigureButton id={id} data={nodeData} />
      </div>

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
export const MCPToolNode = memo(({ id, data, selected }: NodeProps) => {
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
      <NodeActionToolbar id={id} data={nodeData} selected={selected} />

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

      <AttachedChip data={nodeData} />
      <div>
        <ConfigureButton id={id} data={nodeData} />
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
export const TransformNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  return (
    <div
      className={cn(
        'group relative min-w-[210px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-accent-blue border-accent-blue shadow-md' : 'hover:border-accent-blue/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <NodeActionToolbar id={id} data={nodeData} selected={selected} />

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

      <AttachedChip data={nodeData} />

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
export const ConditionNode = memo(({ id, data, selected }: NodeProps) => {
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
      <NodeActionToolbar id={id} data={nodeData} selected={selected} addHandleId="true" />

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
export const WhileLoopNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  return (
    <div
      className={cn(
        'group relative min-w-[210px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-accent-violet border-accent-violet shadow-md' : 'hover:border-accent-violet/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <NodeActionToolbar id={id} data={nodeData} selected={selected} />

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
export const UserApprovalNode = memo(({ id, data, selected }: NodeProps) => {
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
      <NodeActionToolbar id={id} data={nodeData} selected={selected} />

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
export const EndNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  return (
    <div
      className={cn(
        'group relative min-w-[200px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-success border-success shadow-md' : 'hover:border-success/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <NodeActionToolbar id={id} data={nodeData} selected={selected} canAddNext={false} />

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
export const GenericStudioNode = memo(({ id, data, selected }: NodeProps) => {
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
      <NodeActionToolbar id={id} data={nodeData} selected={selected} />

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
      <NodeActionToolbar id={id} data={nodeData} selected={selected} canAddNext={false} />
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
      <NodeActionToolbar id={id} data={nodeData} selected={selected} canAddNext={false} />
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
  AI_CHAT_MODEL: LlmNode,
  INTENT_CLASSIFIER: AgentNode,
  STRUCTURED_OUTPUT: AgentNode,
  AI_SUMMARIZER: AgentNode,
  AI_TRANSLATOR: AgentNode,
  AI_SENTIMENT: AgentNode,
  AI_ENTITY_EXTRACTOR: AgentNode,
  AI_GUARDRAIL: AgentNode,
  MODEL_ROUTER: AgentNode,
  LLM_ROUTER: AgentNode,
  PROMPT_TEMPLATE: PromptNode,
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
  EMBEDDING_MODEL: TransformNode,
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
