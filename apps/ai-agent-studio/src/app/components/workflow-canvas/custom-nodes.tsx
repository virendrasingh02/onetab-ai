import {
  AppSelect,
  Badge,
  Button,
  Input,
  Textarea,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  AIModelIcon,
  normalizeModel,
  type AppSelectOption,
} from '@org/ui';
import { cn } from '@org/utils';
import { Handle, NodeResizer, NodeToolbar, Position, useNodesData, type NodeProps } from '@xyflow/react';
import {
  AlertTriangle,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Code2,
  Copy,
  Download,
  Cpu,
  Database,
  Eye,
  Flame,
  Folder,
  GitBranch,
  Link2,
  Shield,
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
import { AppConnectorIcon } from '../common/app-connector-icon.jsx';
import { useConnectorCatalogNodes, useConnectorNode } from './connector-nodes.js';
import { useNavigate } from 'react-router-dom';
import { useWorkflowLayout, type WorkflowDirection, type WorkflowEdgeStyle } from './workflow-layout-context.js';
import { firstIssue, type AgentModuleId, type ModuleSummary } from './agent-config/agent-module-model.js';
import { FormattedText, NodeRunFooter, type NodeRunResult } from './node-chrome.js';

export interface WorkflowNodePayload {
  title?: string;
  label: string;
  description?: string;
  subtitle?: string;
  status?: 'idle' | 'running' | 'success' | 'failed' | 'waiting';
  config?: Record<string, any>;
  direction?: WorkflowDirection;
  edgeStyle?: WorkflowEdgeStyle;
  onUpdateMetadata?: (patch: { title?: string; label?: string; description?: string; subtitle?: string }) => void;
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
  /** What the run compiler reports for this step (shown as a corner badge). */
  issues?: Array<{ level: 'error' | 'warning'; message: string }>;
  /** Agents: hide everything plugged in (persisted with the graph). */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Agents: each capability module's summary (from agent-module-model). */
  moduleSummaries?: ModuleSummary[];
  /** Agents: apps whose actions are among its tools (cards and tool list). */
  toolApps?: string[];
  /** Agents: open a module's drawer, optionally at a problem. */
  onOpenModule?: (id: AgentModuleId, target?: { section?: string; field?: string }) => void;
  /** Agents: the start of their instructions, for the card. */
  promptPreview?: string;
  /** Agents: built-in tool names in their tool list. */
  builtinTools?: string[];
  /** What this step produced in the latest run (view state, never saved). */
  run?: NodeRunResult;
  /** Output cards: forget the shown result. */
  onClearRun?: () => void;
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

type QuickAddView =
  | { level: 'root' }
  | { level: 'apps' }
  | { level: 'actions'; provider: string; app: string };

/** The catalog's "App Connector Action" card — not yet pointed at an app. */
const isGenericAppAction = (item: CatalogNodeItem) =>
  item.type === 'APP_CONNECTOR_ACTION' && !item.defaultConfig?.['provider'];

/** One row per app that has actions, for the app step of the drill-down. */
function appActionApps(actions: readonly CatalogNodeItem[]): CatalogNodeItem[] {
  const apps = new Map<string, { item: CatalogNodeItem; count: number; connected: boolean }>();
  for (const action of actions) {
    const provider = String(action.defaultConfig?.['provider'] ?? '');
    if (!provider) continue;
    const entry = apps.get(provider);
    if (entry) {
      entry.count += 1;
      continue;
    }
    apps.set(provider, {
      count: 1,
      // connectorCatalogNodes marks an unconnected app's actions "· connect <App>"
      connected: !action.subtitle?.includes('· connect '),
      item: {
        key: `app:${provider}`,
        type: action.type,
        category: action.category,
        label: action.badge ?? provider,
        subtitle: '',
        description: `${action.badge ?? provider} actions`,
        icon: action.icon,
        defaultConfig: { provider, connectorId: action.defaultConfig?.['connectorId'] },
      },
    });
  }
  return [...apps.values()]
    .sort((a, b) => Number(b.connected) - Number(a.connected) || a.item.label.localeCompare(b.item.label))
    .map(({ item, count, connected }) => ({
      ...item,
      subtitle: `${count} action${count === 1 ? '' : 's'}${connected ? '' : ' · not connected'}`,
    }));
}

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
  appActions,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  onSelect: (item: CatalogNodeItem) => void;
  onClose: () => void;
  className?: string;
  /** Restrict the menu to these entries (an agent slot's compatible nodes); hides the category pills. */
  items?: CatalogNodeItem[];
  title?: string;
  /**
   * Connected apps' actions, kept out of the main list: picking the generic
   * "App Connector Action" drills into app → action instead of listing every
   * action up front.
   */
  appActions?: CatalogNodeItem[];
}) {
  const [search, setSearch] = useState('');
  const [view, setView] = useState<QuickAddView>({ level: 'root' });
  const [activeCategory, setActiveCategory] = useState<NodeCategory>('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  // Every connected app's actions and events, from the live connector manifests
  const connectorNodes = useConnectorCatalogNodes();
  const rootSource = useMemo(() => items ?? [...CATALOG_NODES, ...connectorNodes], [items, connectorNodes]);
  const appEntries = useMemo(() => appActionApps(appActions ?? []), [appActions]);
  const source = useMemo(() => {
    if (view.level === 'apps') return appEntries;
    if (view.level === 'actions') {
      return (appActions ?? []).filter((n) => n.defaultConfig?.['provider'] === view.provider);
    }
    return rootSource;
  }, [view, appEntries, appActions, rootSource]);
  const offersApps = useMemo(
    () => view.level !== 'root' || rootSource.some((n) => n.type.startsWith('APP_CONNECTOR')),
    [view.level, rootSource],
  );

  /** Root → apps → actions; only an action (or a plain node) is actually added. */
  const pick = useCallback(
    (item: CatalogNodeItem) => {
      if (view.level === 'root' && appEntries.length > 0 && isGenericAppAction(item)) {
        setView({ level: 'apps' });
      } else if (view.level === 'apps') {
        setView({ level: 'actions', provider: String(item.defaultConfig?.['provider']), app: item.label });
      } else {
        onSelect(item);
        return;
      }
      setSearch('');
      setActiveIndex(0);
    },
    [view.level, appEntries.length, onSelect],
  );
  const goBack = () => {
    setView(view.level === 'actions' ? { level: 'apps' } : { level: 'root' });
    setSearch('');
    setActiveIndex(0);
    inputRef.current?.focus();
  };

  const filteredNodes = useMemo(() => {
    return source.filter((n) => {
      if (!items && view.level === 'root' && activeCategory !== 'all' && n.category !== activeCategory) {
        return false;
      }
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        n.label.toLowerCase().includes(q) ||
        n.subtitle?.toLowerCase().includes(q) ||
        n.description?.toLowerCase().includes(q) ||
        n.badge?.toLowerCase().includes(q) ||
        n.type.toLowerCase().includes(q)
      );
    });
  }, [search, activeCategory, items, source, view.level]);

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
        pick(filteredNodes[activeIndex]);
      }
    } else if (e.key === 'Backspace' && !search && view.level !== 'root') {
      e.preventDefault();
      goBack();
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
          placeholder={
            view.level === 'apps' ? 'Search apps…' : view.level === 'actions' ? `Search ${view.app} actions…` : 'Search nodes…'
          }
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

      {view.level !== 'root' ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goBack();
          }}
          className="mb-2 flex items-center gap-1 rounded px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <ChevronLeft className="size-3.5" />
          {view.level === 'apps' ? 'Choose an app' : `${view.app} actions`}
        </button>
      ) : (
        title && (
          <div className="mb-2 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </div>
        )
      )}

      {/* Category Filter Pills */}
      <div
        className={cn(
          'nowheel gap-1 overflow-x-auto pb-1.5 mb-2 scrollbar-none text-[10px]',
          items || view.level !== 'root' ? 'hidden' : 'flex',
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
            {view.level === 'apps' ? 'No apps found' : view.level === 'actions' ? 'No actions found' : 'No nodes found'}
          </div>
        ) : (
          filteredNodes.map((item, idx) => {
            const Icon = item.icon || Cpu;
            const isSelected = idx === activeIndex;
            const appId = item.defaultConfig?.connectorId as string | undefined;
            const drills =
              view.level === 'apps' || (view.level === 'root' && appEntries.length > 0 && isGenericAppAction(item));
            return (
              <button
                key={item.key ?? item.type}
                data-node-index={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  pick(item);
                }}
                onMouseEnter={() => setActiveIndex(idx)}
                className={cn(
                  'group/item flex w-full items-center gap-2.5 rounded-lg border p-1.5 text-left transition-colors cursor-pointer',
                  isSelected
                    ? 'border-primary/50 bg-primary/10 text-foreground'
                    : 'border-transparent hover:border-primary/30 hover:bg-surface-raised/70',
                )}
              >
                {appId ? (
                  // App actions show the app's own logo
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border/60 bg-surface-raised">
                    <AppConnectorIcon connectorId={appId} size={16} />
                  </div>
                ) : (
                  <div
                    className={cn(
                      'flex size-7 shrink-0 items-center justify-center rounded-md transition-colors',
                      isSelected
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-surface-raised text-muted-foreground group-hover/item:bg-primary group-hover/item:text-primary-foreground',
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="truncate text-xs font-medium text-foreground">
                      {/* The logo and badge already name the app: show just the action */}
                      {appId && item.badge && item.label.startsWith(`${item.badge} · `)
                        ? item.label.slice(item.badge.length + 3)
                        : item.label}
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
                {drills && <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
              </button>
            );
          })
        )}
      </div>

      {offersApps && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
            navigate('/connectors');
          }}
          className="mt-2 flex w-full items-center justify-between rounded-lg border border-dashed border-border px-2.5 py-2 text-[11px] font-medium text-muted-foreground hover:border-primary/40 hover:text-foreground cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <Plus className="size-3.5" /> Connect another app
          </span>
          <ChevronRight className="size-3.5" />
        </button>
      )}
    </div>
  );
}

export function WorkflowHandle({
  type,
  id,
  position,
  className,
  style,
  isConnectable,
  isConnectableStart,
  isConnectableEnd,
  colorClass = 'bg-primary',
  direction: explicitDirection,
  children,
}: {
  type: 'source' | 'target';
  id?: string;
  position?: Position;
  className?: string;
  style?: React.CSSProperties;
  isConnectable?: boolean;
  isConnectableStart?: boolean;
  isConnectableEnd?: boolean;
  colorClass?: string;
  direction?: WorkflowDirection;
  children?: React.ReactNode;
}) {
  const { direction: contextDirection } = useWorkflowLayout();
  const dir = explicitDirection || contextDirection || 'horizontal';

  // In horizontal mode: target = Left (50% vertical center), source = Right (50% vertical center)
  // In vertical mode: target = Top (50% horizontal center), source = Bottom (50% horizontal center)
  const resolvedPosition =
    position ??
    (dir === 'vertical'
      ? type === 'target'
        ? Position.Top
        : Position.Bottom
      : type === 'target'
      ? Position.Left
      : Position.Right);

  // Move handle out of the box so the circle floats clearly outside the card border
  const positionOffsetStyle = useMemo<React.CSSProperties>(() => {
    switch (resolvedPosition) {
      case Position.Right:
        return { right: -11 };
      case Position.Left:
        return { left: -11 };
      case Position.Top:
        return { top: -11 };
      case Position.Bottom:
        return { bottom: -11 };
      default:
        return {};
    }
  }, [resolvedPosition]);

  const mergedStyle = useMemo<React.CSSProperties>(() => {
    return {
      ...style,
      ...positionOffsetStyle,
    };
  }, [style, positionOffsetStyle]);

  return (
    <Handle
      type={type}
      id={id}
      position={resolvedPosition}
      isConnectable={isConnectable}
      isConnectableStart={isConnectableStart}
      isConnectableEnd={isConnectableEnd}
      style={mergedStyle}
      className={cn(
        // 32px hit area centered outside the edge; transparent background with flex centering
        'group/handle !size-8 !border-0 !bg-transparent !p-0 !m-0 !flex !items-center !justify-center !cursor-crosshair z-20',
        className,
      )}
    >
      {children || (
        <span
          className={cn(
            // Larger hollow dot moved out of the box; accent fill & scale on hover
            'relative size-3.5 rounded-full border-2 border-muted-foreground/70 bg-surface shadow-xs transition-all duration-150 pointer-events-none',
            'group-hover/handle:scale-125 group-hover/handle:border-primary group-hover/handle:ring-2 group-hover/handle:ring-primary/40',
            'group-[.connecting]/handle:scale-125 group-[.connecting]/handle:border-primary group-[.connecting]/handle:ring-2 group-[.connecting]/handle:ring-primary/60',
            'group-[.valid]/handle:!bg-emerald-500 group-[.valid]/handle:!border-emerald-500 group-[.valid]/handle:ring-4 group-[.valid]/handle:ring-emerald-500/40 group-[.valid]/handle:scale-130',
            'group-[.invalid]/handle:!bg-destructive group-[.invalid]/handle:!border-destructive group-[.invalid]/handle:ring-4 group-[.invalid]/handle:ring-destructive/40 group-[.invalid]/handle:scale-130',
          )}
        >
          <span className={cn('absolute inset-0 rounded-full opacity-0 transition-opacity group-hover/handle:opacity-100', colorClass)} />
        </span>
      )}
    </Handle>
  );
}

export function SourceHandleWithQuickAdd({
  id,
  position,
  className,
  style,
  colorClass = 'bg-primary',
  onConnectNext,
  direction: explicitDirection,
}: {
  id?: string;
  position?: Position;
  className?: string;
  style?: React.CSSProperties;
  colorClass?: string;
  onConnectNext?: (item: CatalogNodeItem, handleId?: string) => void;
  direction?: WorkflowDirection;
}) {
  const { direction: contextDirection } = useWorkflowLayout();
  const dir = explicitDirection || contextDirection || 'horizontal';
  const resolvedPosition =
    position ?? (dir === 'vertical' ? Position.Bottom : Position.Right);

  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setIsOpen(false), []);
  const isVertical = resolvedPosition === Position.Bottom;

  return (
    <>
      <WorkflowHandle
        type="source"
        id={id}
        position={resolvedPosition}
        className={className}
        style={style}
        colorClass={colorClass}
        direction={dir}
      />

      <div
        ref={containerRef}
        className={cn(
          'nodrag nopan nowheel absolute z-30 flex items-center pointer-events-auto',
          isVertical ? 'pt-1.5' : 'pl-2 -ml-2',
          isOpen && 'z-[99999] quick-add-open',
        )}
        style={
          isVertical
            ? {
                bottom: '-34px',
                left: style?.left ?? '50%',
                transform: 'translateX(-50%)',
              }
            : {
                top: style?.top ?? '50%',
                right: '-34px',
                transform: 'translateY(-50%)',
              }
        }
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
            className={
              isVertical
                ? 'top-[calc(100%+8px)] left-1/2 -translate-x-1/2'
                : 'left-[calc(100%+8px)] top-1/2 -translate-y-1/2'
            }
          />
        )}
      </div>
    </>
  );
}

export function EditableNodeHeader({
  id,
  title,
  description,
  defaultTitle,
  defaultDescription,
  icon: Icon,
  iconBg = 'bg-primary/15 text-primary',
  customIcon,
  badge,
  actions,
  locked,
  onEdit,
  onUpdateMetadata: _onUpdateMetadata,
}: {
  id: string;
  title?: string;
  description?: string;
  defaultTitle: string;
  defaultDescription: string;
  icon?: React.ComponentType<{ className?: string }>;
  iconBg?: string;
  customIcon?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  locked?: boolean;
  onEdit?: () => void;
  onUpdateMetadata?: (patch: { title?: string; label?: string; description?: string; subtitle?: string }) => void;
}) {
  const displayTitle = title || defaultTitle;
  // Descriptions stay off the card unless the step opts in (inspector toggle).
  const showDescription = useNodesData(id)?.data?.['showDescription'] === true;
  const displayDescription = showDescription ? description || defaultDescription : undefined;

  // A neutral bordered tile; the icon keeps the node's accent colour.
  const iconTone = iconBg.split(/\s+/).filter((c) => c.startsWith('text-')).join(' ') || 'text-foreground';
  return (
    <div
      className={cn(
        'flex items-center gap-2.5',
        onEdit && !locked && 'cursor-pointer',
      )}
      onDoubleClick={(e) => {
        if (!locked && onEdit) {
          e.stopPropagation();
          onEdit();
        }
      }}
    >
      {customIcon || (
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface shadow-2xs">
          {Icon && <Icon className={cn('size-[18px]', iconTone)} />}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className="truncate text-[13px] font-semibold text-foreground select-none"
            title={displayTitle}
          >
            {displayTitle}
          </span>
          {badge}
        </div>
        {displayDescription && (
          <div
            className="mt-0.5 text-[11px] leading-snug text-muted-foreground select-none line-clamp-2"
            title={displayDescription}
          >
            {displayDescription}
          </div>
        )}
      </div>

      {actions}
    </div>
  );
}

export const NodeHeader = EditableNodeHeader;

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

// 1. Start / Trigger Node (Universal support for Webhooks, Manual, Chat, Schedules, and SaaS App Connector Triggers)
export const StartNode = memo(({ id, type, data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  const cfg = nodeData.config || {};
  const isConnectorTrigger =
    String(type).toUpperCase().includes('APP_CONNECTOR') ||
    String(type).toUpperCase().includes('TEAMS_TRIGGER') ||
    Boolean(cfg.provider || cfg.connectorId);
  const app = useConnectorNode(type, cfg);
  const connectorId = isConnectorTrigger && app.provider ? app.slug : null;
  const meta = connectorId ? { name: app.connector?.name ?? app.provider, category: app.connector?.category, color: undefined as string | undefined } : null;

  const defaultTitle = meta ? `${meta.name} Trigger` : 'Start Entry';
  const defaultDesc = isConnectorTrigger
    ? (app.trigger?.label ?? (app.provider ? 'Pick an event' : 'Pick an app and event'))
    : 'User prompt';

  return (
    <div
      className={cn(
        'group relative min-w-[220px] max-w-[290px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-emerald-500 border-emerald-500 shadow-md' : 'hover:border-emerald-500/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <NodeActionToolbar id={id} data={nodeData} selected={selected} />

      <EditableNodeHeader
        id={id}
        title={nodeData.title || nodeData.label}
        description={nodeData.description || nodeData.subtitle}
        defaultTitle={defaultTitle}
        defaultDescription={defaultDesc}
        icon={Play}
        iconBg="bg-emerald-500/15 text-emerald-500"
        locked={Boolean(nodeData.locked)}
        onEdit={nodeData.onEdit ? () => nodeData.onEdit?.(id) : undefined}
        onUpdateMetadata={nodeData.onUpdateMetadata}
        customIcon={
          isConnectorTrigger && meta ? (
            <div
              className="flex size-10 items-center justify-center rounded-xl shrink-0 p-1.5 shadow-2xs border border-border/60 bg-surface-raised"
              style={{ borderColor: meta?.color ? `${meta.color}40` : undefined }}
            >
              <AppConnectorIcon
                connectorId={connectorId}
                name={meta.name}
                category={meta.category}
                customIconUrl={cfg.customIconUrl}
                size={24}
              />
            </div>
          ) : undefined
        }
      />

      {nodeData.run?.output && (
        <div className="nodrag nowheel mt-3 max-h-28 overflow-auto whitespace-pre-wrap [overflow-wrap:anywhere] rounded-lg bg-surface-raised px-2.5 py-2 text-[11px] leading-relaxed text-foreground">
          {nodeData.run.output}
        </div>
      )}
      <NodeRunFooter run={nodeData.run} />
      <SourceHandleWithQuickAdd
        colorClass="bg-emerald-500"
        onConnectNext={nodeData.onConnectNext}
      />
    </div>
  );
});
StartNode.displayName = 'StartNode';

/** Slot summary the page passes to agent nodes: what's plugged into each slot. */
export type AgentSlotSummary = Partial<Record<AgentSlotId, { id: string; label: string; connectorId?: string }[]>>;

/** The apps plugged into an agent's Tools, as overlapping logos. */
function AppLogoStack({ apps }: { apps: string[] }) {
  if (apps.length === 0) return null;
  const shown = apps.slice(0, 5);
  return (
    <div className="mt-1.5 flex items-center" aria-label={`Apps: ${apps.join(', ')}`}>
      {shown.map((app, i) => (
        <span
          key={app}
          title={app.replace(/_/g, ' ')}
          className={cn('flex size-6 items-center justify-center rounded-full border-2 border-surface bg-surface-raised shadow-2xs', i > 0 && '-ml-1.5')}
        >
          <AppConnectorIcon connectorId={app} size={14} />
        </span>
      ))}
      {apps.length > shown.length && (
        <span className="-ml-1.5 flex size-6 items-center justify-center rounded-full border-2 border-surface bg-surface-raised text-[9px] font-semibold text-muted-foreground">
          +{apps.length - shown.length}
        </span>
      )}
    </div>
  );
}

/** Team-level facts the page works out for each agent (see agent-slots.ts). */
export interface AgentTeamInfo {
  /** Supervisor = has sub-agents; member = is someone's sub-agent (can be both). */
  role: 'solo' | 'supervisor' | 'member' | 'lead';
  issues: string[];
  model: { model: string; inherited: boolean } | null;
  /** Nodes hidden below this agent while it's collapsed. */
  hiddenCount: number;
}

/** Legacy single-action cards not offered as new tools; saved ones still render and run. */
const SUPERSEDED_BY_APP_CONNECTOR = new Set(['SLACK_SEND']);

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
  const connectorNodes = useConnectorCatalogNodes();
  // Tools list only the main tools; app actions sit behind "App Connector Action" (app → action)
  const items = useMemo(() => {
    // Single-app cards (Slack) are covered by the full app under App Connector Action
    const catalog = slotCatalog(slot.id).filter((n) => !SUPERSEDED_BY_APP_CONNECTOR.has(n.type));
    // The app drill-down leads the list
    return [...catalog.filter(isGenericAppAction), ...catalog.filter((n) => !isGenericAppAction(n))];
  }, [slot.id]);
  const appActions = useMemo(
    () => (slot.id === 'tools' ? connectorNodes.filter((n) => n.type === 'APP_CONNECTOR_ACTION') : undefined),
    [slot.id, connectorNodes],
  );
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
          appActions={appActions}
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

export const MODEL_OPTIONS: AppSelectOption[] = [
  { value: 'gpt-4o', label: 'OpenAI GPT-4o' },
  { value: 'gpt-4o-mini', label: 'OpenAI GPT-4o mini' },
  { value: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5' },
  { value: 'claude-3-5-sonnet', label: 'Claude 3.5 Sonnet' },
  { value: 'gemini-1.5-pro', label: 'Google Gemini 1.5 Pro' },
  { value: 'gemini-2-5-pro', label: 'Google Gemini 2.5 Pro' },
  { value: 'deepseek-chat', label: 'DeepSeek V3' },
  { value: 'deepseek-reasoner', label: 'DeepSeek R1' },
  { value: 'llama3:latest', label: 'Meta Llama 3' },
  { value: 'mistral-large', label: 'Mistral Large' },
  { value: 'nemotron', label: 'NVIDIA Nemotron 3' },
];
export const modelLabel = (model: unknown) =>
  MODEL_OPTIONS.find((m) => m.value === model)?.label ?? (normalizeModel(String(model)).displayName || String(model).replace(':latest', ''));

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

  const moduleOf = (id: AgentModuleId) => nodeData.moduleSummaries?.find((m) => m.id === id);
  const open = (id: AgentModuleId, target?: { section?: string; field?: string }) => nodeData.onOpenModule?.(id, target);
  const addFor = (slotId: AgentSlotId) => {
    const slot = AGENT_SLOTS.find((x) => x.id === slotId);
    return canAdd && slot ? <SlotAddButton slot={slot} onSelect={(item) => nodeData.onConnectNext?.(item, slot.id)} /> : null;
  };
  const modelId = team?.model?.model ?? (cfg.model ? String(cfg.model) : undefined);
  const modelName = modelId ? String(modelLabel(modelId)) : undefined;
  const promptPreview = String(nodeData.promptPreview ?? cfg.instructions ?? '').trim();
  const toolApps = [...new Set([...(slots.tools ?? []).map((t) => t.connectorId), ...(nodeData.toolApps ?? [])].filter((c): c is string => !!c))];
  const builtinTools = nodeData.builtinTools ?? ((cfg.tools as string[] | undefined) ?? []).filter((t) => !t.includes('.'));
  const toolCount = moduleOf('tools')?.count ?? builtinTools.length + (slots.tools ?? []).length;
  const hiddenToolCount = Math.max(0, toolCount - toolApps.length - Math.min(builtinTools.length, toolApps.length ? 1 : 2));

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

      {/* Target handle: Left (50%) in horizontal, Top (50%) in vertical */}
      <WorkflowHandle
        type="target"
        colorClass="bg-primary"
      />

      {/* Main output dot: Right (50%) in horizontal, Bottom (50%) in vertical */}
      <WorkflowHandle
        type="source"
        colorClass="bg-primary"
        style={{ zIndex: 2 }}
      />

      {/* Slot handles share the dot's spot (invisible) so every attachment wire leaves from that one dot */}
      {AGENT_SLOTS.map((slot) => (
        <WorkflowHandle
          key={slot.id}
          type="source"
          id={slot.id}
          isConnectableStart={false}
          style={{ zIndex: 1 }}
          className="!pointer-events-none !size-7 !border-0 !opacity-0"
        />
      ))}

      <EditableNodeHeader
        id={id}
        title={nodeData.title || nodeData.label}
        description={nodeData.description || nodeData.subtitle}
        defaultTitle="AI Agent"
        defaultDescription="AI-powered workflow agent"
        icon={isCoordinator || subAgents.length > 0 ? Network : Bot}
        iconBg="bg-primary/15 text-primary"
        locked={locked}
        onEdit={nodeData.onEdit ? () => nodeData.onEdit?.(id) : undefined}
        onUpdateMetadata={nodeData.onUpdateMetadata}
        badge={
          roleBadge ? (
            <Badge variant={roleBadge.variant} className="h-4 shrink-0 px-1.5 text-[9px]">
              {roleBadge.label}
            </Badge>
          ) : undefined
        }
        actions={
          <div className="flex items-center gap-1 shrink-0">
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
        }
      />

      {collapsed ? (
        // Collapsed: one compact summary; the hidden nodes' wires gather on this row
        <div className="mt-3 flex flex-col gap-1.5">
          <div className="relative rounded-lg border border-dashed border-border px-2.5 py-1.5 text-[10px] text-muted-foreground">
            {totalAttached} plugged in
            {team && team.hiddenCount > totalAttached ? ` · ${team.hiddenCount} steps hidden` : ''} ·{' '}
            {AGENT_SLOTS.filter((s) => (slots[s.id]?.length ?? 0) > 0)
              .map((s) => s.label)
              .join(', ')}
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {/* Model */}
          <AgentSection summary={moduleOf('llm')} onOpen={open} addButton={addFor('llm')} hideLabel>
            <button
              type="button"
              disabled={!nodeData.onOpenModule}
              onClick={(e) => {
                e.stopPropagation();
                open('llm');
              }}
              className="nodrag flex w-full items-center gap-2 rounded-lg bg-surface-raised px-2.5 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-surface-raised/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 motion-reduce:transition-none"
              aria-label={`Model: ${modelName ?? 'none'}. Open LLM settings`}
            >
              {modelId ? <AIModelIcon modelId={modelId} size={14} /> : <Cpu className="size-3.5 text-muted-foreground" />}
              <span className="min-w-0 flex-1 truncate">{modelName ?? 'Choose a model'}</span>
              {team?.model?.inherited && <Badge variant="neutral" className="h-4 shrink-0 px-1 text-[9px]">Inherited</Badge>}
            </button>
          </AgentSection>

          {/* Instructions */}
          <AgentSection label="Instructions" summary={moduleOf('prompt')} onOpen={open} addButton={addFor('prompt')}>
            <button
              type="button"
              disabled={!nodeData.onOpenModule}
              onClick={(e) => {
                e.stopPropagation();
                open('prompt');
              }}
              className="nodrag block w-full rounded-lg border border-border px-2.5 py-1.5 text-left text-[11px] leading-snug transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 motion-reduce:transition-none"
              aria-label="Open Prompt settings"
            >
              {promptPreview ? (
                <span className="line-clamp-2 text-foreground/80">{promptPreview}</span>
              ) : (
                <span className="text-muted-foreground">Add instructions…</span>
              )}
              {moduleOf('prompt')?.detail && <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{moduleOf('prompt')?.detail}</span>}
            </button>
          </AgentSection>

          {/* Knowledge */}
          <AgentSection label="Knowledge Bases" summary={moduleOf('knowledge')} onOpen={open} addButton={addFor('embedding')}>
            {(slots.embedding ?? []).length > 0 ? (
              <ChipRow
                items={(slots.embedding ?? []).map((k) => ({ key: k.id, label: k.label, icon: <BookOpen className="size-3 text-primary" /> }))}
                onClick={() => open('knowledge')}
              />
            ) : (
              <OutlineAction icon={<Database className="size-3.5" />} label="Add Knowledge Bases" onClick={() => open('knowledge', { section: 'sources' })} disabled={!nodeData.onOpenModule} />
            )}
          </AgentSection>

          {/* Tools */}
          <AgentSection label="Tools" summary={moduleOf('tools')} onOpen={open} addButton={addFor('tools')}>
            {toolCount > 0 ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={!nodeData.onOpenModule}
                  onClick={(e) => {
                    e.stopPropagation();
                    open('tools', { section: 'builtin' });
                  }}
                  className="nodrag flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  aria-label="Add or change tools"
                  title="Add or change tools"
                >
                  <Plus className="size-3" />
                </button>
                <button
                  type="button"
                  disabled={!nodeData.onOpenModule}
                  onClick={(e) => {
                    e.stopPropagation();
                    open('tools');
                  }}
                  className="nodrag flex min-w-0 flex-1 items-center gap-1.5 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  aria-label={`${toolCount} tools. Open Tools settings`}
                >
                  <AppLogoStack apps={toolApps} />
                  {builtinTools.slice(0, toolApps.length ? 1 : 2).map((t) => (
                    <span key={t} className="inline-flex max-w-[96px] items-center gap-1 truncate rounded-full border border-border bg-surface-raised px-1.5 py-0.5 text-[10px] text-foreground">
                      <Wrench className="size-2.5 shrink-0 text-muted-foreground" />
                      <span className="truncate">{t.replace(/_/g, ' ')}</span>
                    </span>
                  ))}
                  {hiddenToolCount > 0 && <span className="text-[10px] text-muted-foreground">+{hiddenToolCount}</span>}
                </button>
              </div>
            ) : (
              <OutlineAction icon={<Wrench className="size-3.5" />} label="Add Tools" onClick={() => open('tools', { section: 'builtin' })} disabled={!nodeData.onOpenModule} />
            )}
          </AgentSection>

          {/* Sub-agents */}
          <AgentSection label="Sub-agents" summary={moduleOf('subAgents')} onOpen={open} addButton={addFor('agents')}>
            {subAgents.length > 0 ? (
              <ChipRow items={subAgents.map((a) => ({ key: a.id, label: a.label, icon: <Bot className="size-3 text-primary" /> }))} onClick={() => open('subAgents')} />
            ) : (
              <OutlineAction
                icon={<Network className="size-3.5" />}
                label={isCoordinator ? 'Add the agents this team uses' : 'Add sub-agents'}
                onClick={() => open('subAgents', { section: 'members' })}
                disabled={!nodeData.onOpenModule}
              />
            )}
            {(subAgents.length > 1 || isCoordinator) && (
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
          </AgentSection>
        </div>
      )}
      <AttachedChip data={nodeData} />
      <NodeRunFooter run={nodeData.run} />
    </div>
  );
}

/** Quick-add "+" buttons appear when the card is hovered, focused or selected. */
const QUICK_ADD_REVEAL =
  'opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 group-[.selected]:opacity-100 [.react-flow__node.selected_&]:opacity-100 motion-reduce:transition-none';

/** A labelled block on the agent card; its warning icon jumps to the problem in the drawer. */
function AgentSection({
  label,
  summary,
  onOpen,
  addButton,
  hideLabel,
  children,
}: {
  label?: string;
  summary?: ModuleSummary;
  onOpen: (id: AgentModuleId, target?: { section?: string; field?: string }) => void;
  addButton?: React.ReactNode;
  hideLabel?: boolean;
  children: React.ReactNode;
}) {
  const issue = summary ? firstIssue(summary) : undefined;
  const warning = issue && summary ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(summary.id, { section: issue.section, field: issue.field });
      }}
      className={cn(
        'nodrag flex size-5 shrink-0 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        issue.level === 'error' ? 'text-destructive hover:bg-destructive/10' : 'text-warning hover:bg-warning/10',
      )}
      title={issue.message}
      aria-label={`Fix: ${issue.message}`}
    >
      <AlertTriangle className="size-3" />
    </button>
  ) : null;
  if (hideLabel) {
    return (
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">{children}</div>
        {warning}
        {addButton && <span className={QUICK_ADD_REVEAL}>{addButton}</span>}
      </div>
    );
  }
  return (
    <section aria-label={label}>
      <div className="mb-1 flex items-center gap-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className="ml-auto flex items-center gap-1">
          {warning}
          {addButton && <span className={QUICK_ADD_REVEAL}>{addButton}</span>}
        </span>
      </div>
      {children}
    </section>
  );
}

/** Full-width outline button for an empty section ("Add Knowledge Bases"). */
function OutlineAction({ icon, label, onClick, disabled }: { icon: React.ReactNode; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="nodrag flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-border bg-surface text-[11px] font-medium text-foreground shadow-2xs transition-colors hover:border-primary/40 hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60 motion-reduce:transition-none"
    >
      {icon}
      {label}
    </button>
  );
}

/** What is plugged in, as chips; the row opens the module. */
function ChipRow({ items, onClick }: { items: Array<{ key: string; label: string; icon: React.ReactNode }>; onClick: () => void }) {
  const shown = items.slice(0, 3);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="nodrag flex w-full flex-wrap items-center gap-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      {shown.map((item) => (
        <span key={item.key} className="inline-flex max-w-[130px] items-center gap-1 rounded-full border border-border bg-surface-raised px-1.5 py-0.5 text-[10px] text-foreground">
          {item.icon}
          <span className="truncate">{item.label}</span>
        </span>
      ))}
      {items.length > shown.length && <span className="text-[10px] text-muted-foreground">+{items.length - shown.length}</span>}
    </button>
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
      <WorkflowHandle type="target" colorClass="bg-primary" />
      <EditableNodeHeader
        id={id}
        title={nodeData.title || nodeData.label}
        description={nodeData.description || nodeData.subtitle}
        defaultTitle="Prompt"
        defaultDescription="System prompt"
        icon={ScrollText}
        iconBg="bg-primary/15 text-primary"
        locked={Boolean(nodeData.locked)}
        onEdit={nodeData.onEdit ? () => nodeData.onEdit?.(id) : undefined}
        onUpdateMetadata={nodeData.onUpdateMetadata}
      />
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
      <NodeRunFooter run={nodeData.run} />
      <SourceHandleWithQuickAdd
        colorClass="bg-primary"
        onConnectNext={nodeData.onConnectNext}
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
      <WorkflowHandle type="target" colorClass="bg-primary" />
      <EditableNodeHeader
        id={id}
        title={nodeData.title || nodeData.label}
        description={nodeData.description || nodeData.subtitle}
        defaultTitle="LLM"
        defaultDescription="Chat model"
        customIcon={
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-raised border border-border/80">
            <AIModelIcon modelId={model} size={18} />
          </div>
        }
        locked={Boolean(nodeData.locked)}
        onEdit={nodeData.onEdit ? () => nodeData.onEdit?.(id) : undefined}
        onUpdateMetadata={nodeData.onUpdateMetadata}
      />

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
      <NodeRunFooter run={nodeData.run} />
      <SourceHandleWithQuickAdd
        colorClass="bg-success"
        onConnectNext={nodeData.onConnectNext}
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

      <WorkflowHandle type="target" colorClass="bg-primary" />

      <EditableNodeHeader
        id={id}
        title={nodeData.title || nodeData.label}
        description={nodeData.description || nodeData.subtitle}
        defaultTitle="AI Agent"
        defaultDescription="AI-powered workflow agent"
        icon={Bot}
        iconBg="bg-primary/15 text-primary"
        locked={Boolean(nodeData.locked)}
        onEdit={nodeData.onEdit ? () => nodeData.onEdit?.(id) : undefined}
        onUpdateMetadata={nodeData.onUpdateMetadata}
      />

      {cfg.instructions && (
        <div className="mt-2.5 rounded-md bg-surface-raised/70 p-1.5 text-[10px] text-muted-foreground line-clamp-2">
          {String(cfg.instructions)}
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between border-t border-border/60 pt-2 text-[10px] text-muted-foreground">
        <span>Tools: {(cfg.tools as string[])?.length || 0} attached</span>
        <span>Temp: {cfg.temperature ?? 0.7}</span>
      </div>

      <NodeRunFooter run={nodeData.run} />
      <SourceHandleWithQuickAdd
        colorClass="bg-primary"
        onConnectNext={nodeData.onConnectNext}
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
      <WorkflowHandle type="target" colorClass="bg-warning" />
      <EditableNodeHeader
        id={id}
        title={nodeData.title || nodeData.label}
        description={nodeData.description || nodeData.subtitle}
        defaultTitle="Firecrawl"
        defaultDescription="Web Extraction"
        icon={Flame}
        iconBg="bg-warning/15 text-warning"
        badge={<span className="rounded-full bg-warning/10 px-1.5 py-0.5 text-[9px] font-semibold text-warning">Firecrawl</span>}
        locked={Boolean(nodeData.locked)}
        onEdit={nodeData.onEdit ? () => nodeData.onEdit?.(id) : undefined}
        onUpdateMetadata={nodeData.onUpdateMetadata}
      />

      {(cfg.query || cfg.url) && (
        <div className="mt-2 rounded bg-surface-raised px-2 py-1 font-mono text-[10px] text-muted-foreground truncate">
          {String(cfg.query || cfg.url)}
        </div>
      )}

      <AttachedChip data={nodeData} />
      <div>
        <ConfigureButton id={id} data={nodeData} />
      </div>

      <NodeRunFooter run={nodeData.run} />
      <SourceHandleWithQuickAdd
        colorClass="bg-warning"
        onConnectNext={nodeData.onConnectNext}
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
      <WorkflowHandle type="target" colorClass="bg-accent-indigo" />
      <EditableNodeHeader
        id={id}
        title={nodeData.title || nodeData.label}
        description={nodeData.description || cfg.toolName || nodeData.subtitle}
        defaultTitle="Custom External API"
        defaultDescription="Execute external API operation"
        icon={Wrench}
        iconBg="bg-accent-indigo/15 text-accent-indigo"
        locked={Boolean(nodeData.locked)}
        onEdit={nodeData.onEdit ? () => nodeData.onEdit?.(id) : undefined}
        onUpdateMetadata={nodeData.onUpdateMetadata}
      />

      <AttachedChip data={nodeData} />
      <div>
        <ConfigureButton id={id} data={nodeData} />
      </div>

      <NodeRunFooter run={nodeData.run} />
      <SourceHandleWithQuickAdd
        colorClass="bg-accent-indigo"
        onConnectNext={nodeData.onConnectNext}
      />
    </div>
  );
});
MCPToolNode.displayName = 'MCPToolNode';

// 4b. App action card — any connector capability, resolved against the live manifests.
export const AppConnectorNode = memo(({ id, type, data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  const cfg = nodeData.config || {};
  const app = useConnectorNode(type, cfg);
  const input = (cfg.input && typeof cfg.input === 'object' ? cfg.input : {}) as Record<string, unknown>;
  const preview = Object.entries(input).filter(([, v]) => v !== '' && v !== undefined).slice(0, 2);
  const picked = Boolean(app.provider && app.label);
  const status = nodeData.status || (picked && app.connected ? 'idle' : 'waiting');
  const kindLabel = !app.capability ? null : app.capability.kind === 'query' ? 'Reads' : app.capability.permissionLevel === 'destructive' ? 'Deletes' : 'Writes';

  const defaultTitle = app.connector?.name ?? (app.provider ? app.provider : 'App Connector');
  const defaultDesc = app.label || nodeData.subtitle || 'Execute app action';

  return (
    <div
      className={cn(
        'group relative min-w-[240px] max-w-[300px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-primary border-primary shadow-md' : 'hover:border-primary/50',
        statusBorderClasses[status],
      )}
    >
      <NodeActionToolbar id={id} data={nodeData} selected={selected} />
      <WorkflowHandle type="target" colorClass="bg-primary" />
      <EditableNodeHeader
        id={id}
        title={nodeData.title || nodeData.label}
        description={nodeData.description || nodeData.subtitle}
        defaultTitle={defaultTitle}
        defaultDescription={defaultDesc}
        customIcon={
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-surface-raised p-1.5 shadow-2xs">
            <AppConnectorIcon connectorId={app.slug} name={app.connector?.name} category={app.connector?.category} size={24} />
          </div>
        }
        badge={
          picked && !app.loading ? (
            <span
              className={cn(
                'shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-semibold',
                app.connected
                  ? 'border-success/25 bg-success/10 text-success-text'
                  : 'border-warning/30 bg-warning/10 text-warning-text',
              )}
            >
              {app.connected ? 'Connected' : app.connector ? 'Not connected' : 'Unknown app'}
            </span>
          ) : undefined
        }
        locked={Boolean(nodeData.locked)}
        onEdit={nodeData.onEdit ? () => nodeData.onEdit?.(id) : undefined}
        onUpdateMetadata={nodeData.onUpdateMetadata}
      />

      {preview.map(([k, v]) => (
        <div key={k} className="mt-1 truncate rounded bg-surface-raised/80 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/80">
          {k}: {typeof v === 'object' ? JSON.stringify(v) : String(v)}
        </div>
      ))}

      <AttachedChip data={nodeData} />
      <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
        <ConfigureButton id={id} data={nodeData} />
        {kindLabel && <span className="ml-auto mr-2 shrink-0 text-[9px] uppercase tracking-wide text-muted-foreground/80">{kindLabel}</span>}
        {app.capability?.requiresConfirmation && (
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-warning-text" title={`${app.connector?.name} marks this as needing confirmation`}>
            <Shield className="size-2.5" /> Sensitive
          </span>
        )}
      </div>

      <NodeRunFooter run={nodeData.run} />
      <SourceHandleWithQuickAdd
        colorClass="bg-primary"
        onConnectNext={nodeData.onConnectNext}
      />
    </div>
  );
});
AppConnectorNode.displayName = 'AppConnectorNode';

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
      <WorkflowHandle type="target" colorClass="bg-accent-blue" />
      <EditableNodeHeader
        id={id}
        title={nodeData.title || nodeData.label}
        description={nodeData.description || nodeData.subtitle}
        defaultTitle="Transform"
        defaultDescription="Map / Template"
        icon={Code2}
        iconBg="bg-accent-blue/15 text-accent-blue"
        locked={Boolean(nodeData.locked)}
        onEdit={nodeData.onEdit ? () => nodeData.onEdit?.(id) : undefined}
        onUpdateMetadata={nodeData.onUpdateMetadata}
      />
      <AttachedChip data={nodeData} />
      <NodeRunFooter run={nodeData.run} />
      <SourceHandleWithQuickAdd
        colorClass="bg-accent-blue"
        onConnectNext={nodeData.onConnectNext}
      />
    </div>
  );
});
TransformNode.displayName = 'TransformNode';

// 6. If / Else Condition Node
export const ConditionNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  const cfg = nodeData.config || {};
  const { direction } = useWorkflowLayout();
  const dir = nodeData.direction || direction || 'horizontal';
  const isVertical = dir === 'vertical';

  return (
    <div
      className={cn(
        'group relative min-w-[220px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-accent-violet border-accent-violet shadow-md' : 'hover:border-accent-violet/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <NodeActionToolbar id={id} data={nodeData} selected={selected} addHandleId="true" />

      {/* Target handle: Left (50%) in horizontal, Top (50%) in vertical */}
      <WorkflowHandle
        type="target"
        colorClass="bg-accent-violet"
      />

      <EditableNodeHeader
        id={id}
        title={nodeData.title || nodeData.label}
        description={nodeData.description || (cfg.variable ? `${cfg.variable} ${cfg.operator || '=='} ${cfg.value || ''}` : nodeData.subtitle)}
        defaultTitle="If / Else"
        defaultDescription="Branching Logic"
        icon={GitBranch}
        iconBg="bg-accent-violet/15 text-accent-violet"
        locked={Boolean(nodeData.locked)}
        onEdit={nodeData.onEdit ? () => nodeData.onEdit?.(id) : undefined}
        onUpdateMetadata={nodeData.onUpdateMetadata}
      />

      {isVertical ? (
        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-[10px] font-semibold">
          <div className="flex items-center gap-1 text-success">
            <span>True</span>
            <SourceHandleWithQuickAdd
              id="true"
              position={Position.Bottom}
              style={{ left: '30%' }}
              colorClass="bg-success"
              onConnectNext={nodeData.onConnectNext}
            />
          </div>
          <div className="flex items-center gap-1 text-destructive">
            <span>False</span>
            <SourceHandleWithQuickAdd
              id="false"
              position={Position.Bottom}
              style={{ left: '70%' }}
              colorClass="bg-destructive"
              onConnectNext={nodeData.onConnectNext}
            />
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          {/* True Handle (Top Right) */}
          <div className="flex items-center justify-between text-[10px] font-semibold text-success">
            <span>True</span>
            <SourceHandleWithQuickAdd
              id="true"
              position={Position.Right}
              style={{ top: '38%' }}
              colorClass="bg-success"
              onConnectNext={nodeData.onConnectNext}
            />
          </div>

          {/* False Handle (Bottom Right) */}
          <div className="flex items-center justify-between text-[10px] font-semibold text-destructive">
            <span>False</span>
            <SourceHandleWithQuickAdd
              id="false"
              position={Position.Right}
              style={{ top: '78%' }}
              colorClass="bg-destructive"
              onConnectNext={nodeData.onConnectNext}
            />
          </div>
        </div>
      )}
    </div>
  );
});
ConditionNode.displayName = 'ConditionNode';

// 7. While Loop Node
export const WhileLoopNode = memo(({ id, type, data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  const isLoop = ['LOOP', 'WHILE_LOOP'].includes(String(type).toUpperCase());
  if (isLoop) return <LoopNode id={id} nodeData={nodeData} selected={!!selected} />;
  return (
    <div
      className={cn(
        'group relative min-w-[210px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-accent-violet border-accent-violet shadow-md' : 'hover:border-accent-violet/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <NodeActionToolbar id={id} data={nodeData} selected={selected} />
      <WorkflowHandle type="target" colorClass="bg-accent-violet" />
      <EditableNodeHeader
        id={id}
        title={nodeData.title || nodeData.label}
        description={nodeData.description || nodeData.subtitle}
        defaultTitle="While Loop"
        defaultDescription="Iterative batching"
        icon={Repeat}
        iconBg="bg-accent-violet/15 text-accent-violet"
        locked={Boolean(nodeData.locked)}
        onEdit={nodeData.onEdit ? () => nodeData.onEdit?.(id) : undefined}
        onUpdateMetadata={nodeData.onUpdateMetadata}
      />
      <NodeRunFooter run={nodeData.run} />
      <SourceHandleWithQuickAdd
        colorClass="bg-accent-violet"
        onConnectNext={nodeData.onConnectNext}
      />
    </div>
  );
});
WhileLoopNode.displayName = 'WhileLoopNode';

/**
 * A loop: the "Each item" branch runs once per item of the list (seeing
 * `{{item}}` and `{{index}}`), then "When done" continues with every item's
 * result in `{{loopResults}}`.
 */
function LoopNode({ id, nodeData, selected }: { id: string; nodeData: WorkflowNodePayload; selected: boolean }) {
  const itemsKey = String((nodeData.config as { itemsKey?: string } | undefined)?.itemsKey || 'items');
  const { direction } = useWorkflowLayout();
  const dir = nodeData.direction || direction || 'horizontal';
  const isVertical = dir === 'vertical';

  return (
    <div
      className={cn(
        'group relative min-w-[220px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-accent-violet border-accent-violet shadow-md' : 'hover:border-accent-violet/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <NodeActionToolbar id={id} data={nodeData} selected={selected} />
      <WorkflowHandle type="target" colorClass="bg-accent-violet" />

      <EditableNodeHeader
        id={id}
        title={nodeData.title || nodeData.label}
        description={nodeData.description || nodeData.subtitle || `For each in {{${itemsKey}}}`}
        defaultTitle="Loop"
        defaultDescription={`For each in {{${itemsKey}}}`}
        icon={Repeat}
        iconBg="bg-accent-violet/15 text-accent-violet"
        locked={Boolean(nodeData.locked)}
        onEdit={nodeData.onEdit ? () => nodeData.onEdit?.(id) : undefined}
        onUpdateMetadata={nodeData.onUpdateMetadata}
      />

      {isVertical ? (
        <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-[10px] font-semibold">
          <div className="flex items-center gap-1 text-muted-foreground">
            <span>When done</span>
            <SourceHandleWithQuickAdd
              position={Position.Bottom}
              style={{ left: '30%' }}
              colorClass="bg-accent-violet"
              onConnectNext={nodeData.onConnectNext}
            />
          </div>
          <div className="flex items-center gap-1 text-accent-violet">
            <span>Each item</span>
            <SourceHandleWithQuickAdd
              id="each"
              position={Position.Bottom}
              style={{ left: '70%' }}
              colorClass="bg-accent-violet"
              onConnectNext={nodeData.onConnectNext}
            />
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col-reverse gap-1.5 text-[10px] font-semibold">
          <div className="relative flex items-center justify-end pr-2 text-muted-foreground">
            <span>When done</span>
            <SourceHandleWithQuickAdd
              position={Position.Right}
              style={{ top: '42%' }}
              colorClass="bg-accent-violet"
              onConnectNext={nodeData.onConnectNext}
            />
          </div>
          <div className="relative flex items-center justify-end pr-2 text-accent-violet">
            <span>Each item</span>
            <SourceHandleWithQuickAdd
              id="each"
              position={Position.Right}
              style={{ top: '78%' }}
              colorClass="bg-accent-violet"
              onConnectNext={nodeData.onConnectNext}
            />
          </div>
        </div>
      )}
    </div>
  );
}

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
      <WorkflowHandle type="target" colorClass="bg-destructive" />
      <EditableNodeHeader
        id={id}
        title={nodeData.title || nodeData.label}
        description={nodeData.description || nodeData.subtitle}
        defaultTitle="User Approval"
        defaultDescription="Human signoff gate"
        icon={UserCheck}
        iconBg="bg-destructive/15 text-destructive"
        badge={<span className="rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] font-semibold text-destructive">Pause Flow</span>}
        locked={Boolean(nodeData.locked)}
        onEdit={nodeData.onEdit ? () => nodeData.onEdit?.(id) : undefined}
        onUpdateMetadata={nodeData.onUpdateMetadata}
      />

      {cfg.action && (
        <div className="mt-2 text-[10px] text-muted-foreground italic truncate">
          Action: {String(cfg.action)}
        </div>
      )}

      <NodeRunFooter run={nodeData.run} />
      <SourceHandleWithQuickAdd
        colorClass="bg-destructive"
        onConnectNext={nodeData.onConnectNext}
      />
    </div>
  );
});
UserApprovalNode.displayName = 'UserApprovalNode';

// 9. End Node
export const EndNode = memo(({ id, data, selected }: NodeProps) => {
  const nodeData = data as WorkflowNodePayload;
  const run = nodeData.run;
  const [view, setView] = useState<'text' | 'formatted'>('formatted');
  const text = run?.error || run?.output || '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Clipboard blocked: nothing to do, the text is still selectable.
    }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: view === 'formatted' ? 'text/markdown' : 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${String(nodeData.label || 'output').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.${view === 'formatted' ? 'md' : 'txt'}`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const toolButton = 'flex h-6 items-center gap-1 rounded-md border border-border bg-surface px-1.5 text-[10px] text-muted-foreground hover:bg-surface-raised hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-40';
  return (
    <div
      className={cn(
        'group relative w-[300px] rounded-xl border bg-surface p-3.5 shadow-sm transition-all',
        selected ? 'ring-2 ring-success border-success shadow-md' : 'hover:border-success/50',
        statusBorderClasses[nodeData.status || 'idle'],
      )}
    >
      <NodeActionToolbar id={id} data={nodeData} selected={selected} canAddNext={false} />
      <WorkflowHandle type="target" colorClass="bg-success" />
      <EditableNodeHeader
        id={id}
        title={nodeData.title || nodeData.label}
        description={nodeData.description || nodeData.subtitle}
        defaultTitle="Output"
        defaultDescription="The agent’s final answer"
        icon={CheckCircle2}
        iconBg="bg-success/15 text-success"
        locked={Boolean(nodeData.locked)}
        onEdit={nodeData.onEdit ? () => nodeData.onEdit?.(id) : undefined}
        onUpdateMetadata={nodeData.onUpdateMetadata}
      />

      <div className="nodrag nopan mt-3 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <div role="radiogroup" aria-label="Output view" className="flex rounded-md border border-border bg-surface-raised p-0.5">
          {(['text', 'formatted'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={view === v}
              onClick={() => setView(v)}
              className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium capitalize', view === v ? 'bg-surface text-foreground shadow-2xs' : 'text-muted-foreground hover:text-foreground')}
            >
              {v}
            </button>
          ))}
        </div>
        <span className="ml-auto flex items-center gap-1">
          <button type="button" className={toolButton} disabled={!text} onClick={() => void copy()} aria-label="Copy output" title="Copy">
            <Copy className="size-3" />
          </button>
          <button type="button" className={toolButton} disabled={!text} onClick={download} aria-label="Download output" title="Download">
            <Download className="size-3" />
          </button>
          <button type="button" className={toolButton} disabled={!run || !nodeData.onClearRun} onClick={() => nodeData.onClearRun?.()} aria-label="Clear output">
            <Trash2 className="size-3" />
            Clear
          </button>
        </span>
      </div>
      <div
        tabIndex={0}
        aria-label="Output"
        className={cn(
          'nodrag nowheel mt-2 max-h-56 min-h-16 overflow-auto rounded-lg border px-3 py-2',
          run?.error ? 'border-destructive/30 bg-destructive/5' : 'border-border bg-surface',
        )}
      >
        {!text ? (
          <p className="py-2 text-center text-[11px] text-muted-foreground">
            {run?.status === 'running' ? 'Waiting for the agent…' : 'Run the agent to see its answer here.'}
          </p>
        ) : run?.error ? (
          <p className="whitespace-pre-wrap text-[11px] text-destructive">{run.error}</p>
        ) : view === 'formatted' ? (
          <FormattedText text={text} />
        ) : (
          <pre className="whitespace-pre-wrap [overflow-wrap:anywhere] font-mono text-[11px] leading-relaxed text-foreground">{text}</pre>
        )}
      </div>
      <NodeRunFooter run={run} />
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
      <WorkflowHandle type="target" colorClass="bg-primary" />
      <EditableNodeHeader
        id={id}
        title={nodeData.title || nodeData.label}
        description={nodeData.description || nodeData.subtitle}
        defaultTitle="Studio Node"
        defaultDescription="Step Execution"
        icon={Cpu}
        iconBg="bg-primary/10 text-primary"
        badge={
          nodeData.badge ? (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
              {nodeData.badge}
            </span>
          ) : undefined
        }
        locked={Boolean(nodeData.locked)}
        onEdit={nodeData.onEdit ? () => nodeData.onEdit?.(id) : undefined}
        onUpdateMetadata={nodeData.onUpdateMetadata}
      />

      {cfg.action && (
        <div className="mt-2 text-[10px] text-muted-foreground font-mono truncate">
          {String(cfg.action)}
        </div>
      )}

      <NodeRunFooter run={nodeData.run} />
      <SourceHandleWithQuickAdd
        colorClass="bg-primary"
        onConnectNext={nodeData.onConnectNext}
      />
    </div>
  );
});
GenericStudioNode.displayName = 'GenericStudioNode';
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
        'group relative min-w-[190px] h-full w-full rounded-2xl border p-3 shadow-xs transition-all backdrop-blur-xs',
        colorStyles[color] || colorStyles.yellow,
        selected ? 'ring-2 ring-primary shadow-md' : 'hover:border-primary/40',
      )}
    >
      <NodeResizer
        minWidth={180}
        minHeight={90}
        isVisible={selected}
        lineClassName="!border-warning/60"
        handleClassName="!size-2 !bg-warning !border-background rounded-xs"
      />
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
        'group relative min-w-[340px] min-h-[220px] h-full w-full rounded-2xl border-2 border-dashed border-border/80 bg-surface/30 p-4 transition-all',
        selected ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/40',
      )}
    >
      <NodeResizer
        minWidth={280}
        minHeight={160}
        isVisible={selected}
        lineClassName="!border-primary/60"
        handleClassName="!size-2.5 !bg-primary !border-background rounded-xs"
      />
      <NodeActionToolbar id={id} data={nodeData} selected={selected} canAddNext={false} />
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-2">
        <Folder className="size-4 text-primary" />
        <span>{nodeData.label || 'Stage Group'}</span>
        {nodeData.subtitle && nodeData.showDescription === true && (
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
  APP_CONNECTOR_TRIGGER: StartNode,
  TEAMS_TRIGGER_MESSAGE: StartNode,

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
  APP_CONNECTOR_ACTION: AppConnectorNode,
  TEAMS_SEND_MESSAGE: AppConnectorNode,
  TEAMS_CREATE_MEETING: AppConnectorNode,

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

  // Section 3 Aliases
  API: MCPToolNode,
  WEB_SEARCH: FirecrawlNode,
  WEB_SCRAPER: FirecrawlNode,
  ROUTER: ConditionNode,
  SWITCH: ConditionNode,
  ITERATOR: WhileLoopNode,
  PARALLEL: ConditionNode,
  MERGE: ConditionNode,
  PARSER: TransformNode,
  JSON: TransformNode,
  MEMORY: TransformNode,
  MEMORY_STORE: TransformNode,
  MEMORY_RETRIEVE: TransformNode,
  KNOWLEDGE_BASE: TransformNode,
  FILE: TransformNode,
  DOCUMENT: TransformNode,
  DELAY: WhileLoopNode,
  SCHEDULE: StartNode,
  WEBHOOK: StartNode,
  DATABASE: MCPToolNode,
  NOTIFICATION: MCPToolNode,
  EMAIL: MCPToolNode,
  SLACK: MCPToolNode,
  TEAMS: AppConnectorNode,
  GENERIC_CONNECTOR: AppConnectorNode,
  CUSTOM_NODE: GenericStudioNode,

  generic: GenericStudioNode,
  default: GenericStudioNode,
};

/**
 * Every card shows what the run compiler would say about it (the same
 * `compileStudioGraph` the server runs): red for problems that stop a run,
 * amber for steps that will be skipped or behave differently than they look.
 */
function IssueBadge({ issues, label }: { issues: Array<{ level: string; message: string }>; label: string }) {
  const errors = issues.filter((i) => i.level === 'error');
  const tone = errors.length ? 'error' : 'warning';
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${label}: ${issues.length} problem${issues.length === 1 ? '' : 's'} — ${issues.map((i) => i.message).join(' ')}`}
          className={cn(
            'nodrag nopan absolute -right-2 -top-2 z-10 flex h-5 min-w-5 items-center justify-center gap-0.5 rounded-full border-2 border-background px-1 text-[10px] font-bold shadow-sm',
            tone === 'error' ? 'bg-destructive text-destructive-foreground' : 'bg-warning text-warning-foreground',
          )}
        >
          <AlertTriangle className="size-2.5" aria-hidden="true" />
          {issues.length > 1 ? issues.length : null}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-72">
        <ul className="space-y-1 text-xs">
          {issues.map((i, k) => (
            <li key={k} className="flex gap-1.5">
              <span className={cn('mt-1 size-1.5 shrink-0 rounded-full', i.level === 'error' ? 'bg-destructive' : 'bg-warning')} />
              <span>{i.message}</span>
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

const withIssues = (Component: any) => {
  const Wrapped = memo((props: NodeProps) => {
    const issues = (props.data as WorkflowNodePayload)?.issues as Array<{ level: string; message: string }> | undefined;
    return (
      <>
        <Component {...props} />
        {issues && issues.length > 0 && <IssueBadge issues={issues} label={String((props.data as WorkflowNodePayload)?.label ?? 'Step')} />}
      </>
    );
  });
  Wrapped.displayName = `WithIssues(${Component.displayName ?? Component.name ?? 'Node'})`;
  return Wrapped;
};
const wrappedTypes = new Map<unknown, unknown>();
const wrapped = (Component: unknown) => {
  if (!wrappedTypes.has(Component)) wrappedTypes.set(Component, withIssues(Component));
  return wrappedTypes.get(Component);
};

// Use Proxy so ANY unrecognized catalog node gracefully renders GenericStudioNode
export const STUDIO_NODE_TYPES = new Proxy(BASE_NODE_TYPES, {
  get(target, prop) {
    if (typeof prop === 'string' && prop in target) {
      return wrapped(target[prop]);
    }
    return wrapped(GenericStudioNode);
  },
});
