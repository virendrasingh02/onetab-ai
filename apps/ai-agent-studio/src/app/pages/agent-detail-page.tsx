import { agentsApi } from '@org/api-client';
import {
  AppSelect,
  Badge,
  Button,
  Card,
  CodeBlock,
  confirm,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogBody,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  EmptyState,
  Field,
  Input,
  Label,
  ErrorState,
  LoadingState,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Textarea,
  toast,
  AiEntityIdentityPicker,
  aiEntityAvatarFromLegacy,
  formatAiEntityIconAvatar,
  parseAiEntityAvatar,
} from '@org/ui';
import { canManageOwnedAIResource, compileStudioGraph, isStudioGraph, diffStudioGraphs, type StudioCanvasGraph, type StudioGraphIssue } from '@org/types';
import { cn, generateId } from '@org/utils';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  type ConnectionLineComponentProps,
  ConnectionMode,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  reconnectEdge,
  SelectionMode,
  useOnSelectionChange,
  useReactFlow,
  useStore,
  useUpdateNodeInternals,
  useViewport,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import {
  Activity,
  AlertCircle,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowLeft,
  ArrowUpRight,
  Award,
  BarChart3,
  Bot,
  Brain,
  Check,
  ChevronDown,
  Clock,
  Code2,
  Copy,
  Cpu,
  Edit2,
  Eye,
  GitBranch,
  Globe,
  Hand,
  Layers,
  Loader2,
  Lock,
  Minus,
  MousePointer2,
  Network,
  Palette,
  Play,
  Plus,
  Plug,
  Radio,
  Redo2,
  RotateCcw,
  Save,
  AlertTriangle,
  Search,
  Settings,
  Store,
  ShieldCheck,
  Sparkles,
  Tag,
  Trash2,
  Undo2,
  KeyRound,
  Wand2,
  X,
  Rocket,
  CornerDownRight,
  MoveHorizontal,
  MoreHorizontal,
  MoveVertical,
  Spline,
  Route,
  Slash,
  Rows3,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { scopeStudioPath, useNavigate, useParams, useSearchParams } from '../router.js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AgentAvatar, DEFAULT_CATEGORIES } from '../data/agent-metadata.js';
import { useMemberPreference } from '../hooks/use-member-preference.js';
import { useStudioSession } from '../session-guard.js';
import { AgentRuntimeSettings, type AgentRuntimeDraft } from '../components/agent-detail/agent-runtime-settings.js';
import { modelLabel, STUDIO_NODE_TYPES } from '../components/workflow-canvas/custom-nodes.js';
import { STUDIO_EDGE_TYPES, WorkflowConnectionLine } from '../components/workflow-canvas/custom-edges.jsx';
import { CanvasContextMenu } from '../components/workflow-canvas/canvas-context-menu.jsx';
import { NodeCatalogModal } from '../components/workflow-canvas/node-catalog-modal.js';
import { NodeInspector, type NodeSnapshot } from '../components/workflow-canvas/node-inspector.js';
import { ValidationModal } from '../components/workflow-canvas/validation-modal.js';
import { RunConsoleDrawer, type CanvasNodeStatus } from '../components/workflow-canvas/run-console-drawer.js';
import { AgentCopilotPanel } from '../components/agent-architect/agent-copilot-panel.js';
import { AgentConnectorsTab } from '../components/agent-detail/agent-connectors-tab.js';
import { MemoryTab } from '../components/agent-detail/memory-tab.jsx';
import { VariablesTab } from '../components/agent-detail/variables-tab.jsx';
import { EvaluationsTab } from '../components/agent-detail/evaluations-tab.jsx';
import { AgentVersionsList } from '../components/agent-detail/agent-versions-list.js';
import { AgentDeploymentTab } from '../components/agent-detail/agent-deployment-tab.js';
import { AgentMarketplaceTab } from '../components/agent-detail/agent-marketplace-tab.js';
import { AgentTabPage, AgentTabSection } from '../components/agent-detail/agent-tab-page.js';
import { apiBase as deploymentApiBase } from '../components/agent-detail/deployment/use-deployment.js';
import { AgentSettingsLayout, type SettingsNavItem } from '../components/agent-detail/agent-settings-layout.js';
import { agentService } from '../services/agentService.js';
import { analyticsService } from '../services/analyticsService.js';
import {
  layoutWorkflow,
  type LayoutArrange,
  type LayoutSpacing,
} from '../components/workflow-canvas/auto-layout.js';
import { EDGE_ROUTING_HINTS, EDGE_ROUTING_LABELS, isEdgeRouting } from '../components/workflow-canvas/edge-routing.js';
import {
  WorkflowLayoutContext,
  type WorkflowDirection,
  type WorkflowEdgeStyle,
} from '../components/workflow-canvas/workflow-layout-context.js';
import {
  agentIssues,
  attachmentPosition,
  getSlot,
  isAttachmentEdge,
  isSlotHost,
  resolveAgentModel,
  slotAttachments,
  slotConnectionError,
  supervisorOf,
  withSlotConnection,
} from '../components/workflow-canvas/agent-slots.js';
import { AgentOutlinePanel } from '../components/workflow-canvas/agent-outline-panel.js';
import { validateWorkflowConnection } from '../components/workflow-canvas/connection-validator.js';
import { EdgeDataInspector } from '../components/workflow-canvas/edge-data-inspector.js';
import { CanvasCommandPalette } from '../components/workflow-canvas/canvas-command-palette.js';
import { WorkflowHealthBadge, type WorkflowIssue } from '../components/workflow-canvas/workflow-health-badge.js';
import { TemplateExportModal } from '../components/workflow-canvas/template-export-modal.js';
import {
  readAgentModules,
  summarizeAgentModules,
  type AgentModuleId,
  type ModuleDraft,
} from '../components/workflow-canvas/agent-config/agent-module-model.js';
import type { ModuleActions } from '../components/workflow-canvas/agent-config/module-drawer.js';
import type { NodeAnalyticsOverlayData, NodeRunResult } from '../components/workflow-canvas/node-chrome.js';

const INITIAL_NODES: Node[] = [
  {
    id: 'start-1',
    type: 'START',
    position: { x: 100, y: 200 },
    data: {
      title: 'Workflow Trigger',
      label: 'Workflow Trigger',
      description: 'Manual execution & API trigger',
      subtitle: 'Manual execution & API trigger',
      config: { triggerType: 'MANUAL' },
    },
  },
  {
    id: 'agent-1',
    type: 'AGENT',
    position: { x: 380, y: 160 },
    data: {
      title: 'Primary Reasoner',
      label: 'Primary Reasoner',
      description: 'gpt-4o • temp 0.4',
      subtitle: 'gpt-4o • temp 0.4',
      config: {
        model: 'gpt-4o',
        temperature: 0.4,
        instructions: 'Analyze the given task and execute the required sub-workflows.',
      },
    },
  },
  {
    id: 'end-1',
    type: 'END',
    position: { x: 740, y: 200 },
    data: {
      title: 'Workflow Output',
      label: 'Workflow Output',
      description: 'Structured result response',
      subtitle: 'Structured result response',
    },
  },
];

const INITIAL_EDGES: Edge[] = [
  { id: 'e1-2', source: 'start-1', target: 'agent-1', animated: true },
  { id: 'e2-3', source: 'agent-1', target: 'end-1' },
];

/** A node as saved: without the status ring a run painted on it. */
function withoutRunStatus(node: Node): Node {
  const { status: _status, ...data } = (node.data ?? {}) as Record<string, unknown>;
  return { ...node, data };
}

export interface ParsedStudioGraph {
  nodes: Node[];
  edges: Edge[];
  /** Graph-level settings, e.g. `limits` for the run (read by the run compiler). */
  settings?: Record<string, unknown>;
  layout?: {
    direction?: WorkflowDirection;
    edgeStyle?: WorkflowEdgeStyle;
  } & Partial<LayoutPrefs>;
}

/** How Auto Layout arranges the canvas; saved with the graph so each agent keeps its own. */
interface LayoutPrefs {
  arrange: LayoutArrange;
  spacing: LayoutSpacing;
}
const DEFAULT_LAYOUT_PREFS: LayoutPrefs = { arrange: 'layered', spacing: 'comfortable' };

const LAYOUT_ARRANGE_MENU: { value: LayoutArrange; label: string; hint: string; Icon: typeof Spline }[] = [
  { value: 'layered', label: 'Layered flow', hint: 'Columns by step order, fewest crossing wires', Icon: Rows3 },
  { value: 'tree', label: 'Tree', hint: 'Tidy tree: each step centred over the branches it starts', Icon: Network },
];
const LAYOUT_SPACING_MENU: { value: LayoutSpacing; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'spacious', label: 'Spacious' },
];
const isLayoutArrange = (v: unknown): v is LayoutArrange => v === 'layered' || v === 'tree';
const isLayoutSpacing = (v: unknown): v is LayoutSpacing => v === 'compact' || v === 'comfortable' || v === 'spacious';

/** Canvas-wide routing choices, in menu order. */
const EDGE_ROUTING_MENU: { value: WorkflowEdgeStyle; Icon: typeof Spline }[] = [
  { value: 'smooth', Icon: Spline },
  { value: 'step', Icon: CornerDownRight },
  { value: 'smart', Icon: Route },
  { value: 'straight', Icon: Slash },
];

/** The canvas graph as the API stores it: JSON in `graphJson`. */
function parseGraph(graphJson: string | null | undefined): ParsedStudioGraph | null {
  if (!graphJson) return null;
  try {
    const graph = JSON.parse(graphJson) as {
      nodes?: unknown;
      edges?: unknown;
      settings?: unknown;
      layout?: { direction?: string; edgeStyle?: string; arrange?: string; spacing?: string };
    };
    if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) return null;
    return {
      nodes: graph.nodes as Node[],
      edges: Array.isArray(graph.edges) ? (graph.edges as Edge[]) : [],
      ...(graph.settings && typeof graph.settings === 'object' && !Array.isArray(graph.settings)
        ? { settings: graph.settings as Record<string, unknown> }
        : {}),
      layout: {
        direction: graph.layout?.direction === 'vertical' ? 'vertical' : 'horizontal',
        edgeStyle: isEdgeRouting(graph.layout?.edgeStyle) ? graph.layout.edgeStyle : 'smooth',
        arrange: isLayoutArrange(graph.layout?.arrange) ? graph.layout.arrange : DEFAULT_LAYOUT_PREFS.arrange,
        spacing: isLayoutSpacing(graph.layout?.spacing) ? graph.layout.spacing : DEFAULT_LAYOUT_PREFS.spacing,
      },
    };
  } catch {
    return null;
  }
}

/** A published snapshot, as `GET /agents/:id/versions` returns it. */
interface AgentVersion {
  version: number;
  versionTag?: string;
  publishedAt?: string;
  changeSummary?: string;
  status?: 'PUBLISHED' | 'DRAFT' | string;
}

interface AgentSettingsDraft {
  name: string;
  role: string;
  description: string;
  model: string;
  category: string;
  theme: string;
  icon: string;
  avatar: string;
  tags: string[];
  ownerName: string;
  ownerEmail: string;
  /** What the saved runtime enforces (`configuration.runtime`). */
  runtime: AgentRuntimeDraft;
}

const ZOOM_PRESETS = [0.5, 1, 2] as const;
/** How long auto layout takes to glide nodes into place. */
const LAYOUT_ANIMATION_MS = 420;
/** Quiet time after the last edit before the draft saves itself. */
const AUTO_SAVE_DELAY_MS = 2000;
const AUTO_SAVE_PREF_KEY = 'studioAutosave';
const isAutoSave = (opts: unknown) => !!(opts as { auto?: boolean } | undefined)?.auto;

/** "just now", "12s ago", "4m ago", then the time. */
function savedAgo(at: number, now: number): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `at ${new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

/** Re-renders on a clock: every second for the first minute after `since`, then every 30s. */
function useNow(since: number | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (since === null) return;
    setNow(Date.now());
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      timer = setTimeout(tick, t - since < 60_000 ? 1000 : 30_000);
    };
    timer = setTimeout(tick, 1000);
    return () => clearTimeout(timer);
  }, [since]);
  return now;
}

/** What an agent's slot row says about the node plugged into it — the prompt's first real line for a prompt. */
function slotRowLabel(slotId: string, n: Node): string {
  const data = (n.data ?? {}) as { label?: unknown; config?: Record<string, unknown> };
  if (slotId === 'prompt') {
    const text = String(data.config?.['prompt'] ?? data.config?.['template'] ?? data.config?.['systemPrompt'] ?? '');
    const line = text
      .split('\n')
      .map((l) => l.replace(/^[#>*\-\s]+/, '').trim())
      .find((l) => l.length > 0 && !/^(role|scope|rules|goal|instructions)$/i.test(l));
    if (line) return line.length > 48 ? `${line.slice(0, 47)}…` : line;
  }
  return String(data.label || n.type);
}

const AGENT_TABS = [
  { id: 'build', label: 'Canvas', icon: GitBranch },
  { id: 'connectors', label: 'Connectors', icon: Plug },
  { id: 'memory', label: 'Memory', icon: Brain },
  { id: 'variables', label: 'Secrets', icon: KeyRound },
  { id: 'executions', label: 'Executions', icon: Activity },
  { id: 'evaluations', label: 'Evaluation', icon: Award },
  { id: 'versions', label: 'Versions', icon: Clock },
  { id: 'deploy', label: 'Deploy', icon: Rocket },
  { id: 'marketplace', label: 'Marketplace', icon: Store },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;
type AgentTab = (typeof AGENT_TABS)[number]['id'];
/** Short header items; multi-section groups open a menu. */
const AGENT_TAB_GROUPS: readonly { label: string; icon: typeof Plug; tabs: readonly AgentTab[] }[] = [
  { label: 'Canvas', icon: GitBranch, tabs: ['build'] },
  { label: 'Setup', icon: Plug, tabs: ['connectors', 'memory', 'variables'] },
  { label: 'Runs', icon: Activity, tabs: ['executions', 'evaluations'] },
  { label: 'Deploy', icon: Rocket, tabs: ['deploy'] },
  { label: 'Release', icon: Clock, tabs: ['versions', 'marketplace'] },
  { label: 'Settings', icon: Settings, tabs: ['settings'] },
];
const isAgentTab = (value: string | null): value is AgentTab =>
  AGENT_TABS.some((t) => t.id === value);

type AlignType = 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom';

const SETTINGS_NAV: readonly SettingsNavItem[] = [
  { id: 'settings-identity', label: 'Identity', icon: <Bot /> },
  { id: 'settings-appearance', label: 'Appearance', icon: <Palette /> },
  { id: 'settings-category', label: 'Category & owner', icon: <Tag /> },
  { id: 'settings-model', label: 'Model', icon: <Cpu /> },
  { id: 'settings-limits', label: 'Run limits', icon: <Network /> },
  { id: 'settings-safety', label: 'Safety', icon: <ShieldCheck /> },
  { id: 'settings-api', label: 'API endpoint', icon: <Code2 /> },
];

const SELECTION_ALIGN_ACTIONS: { type: AlignType; label: string; icon: typeof AlignStartVertical }[] = [
  { type: 'left', label: 'Align left edges', icon: AlignStartVertical },
  { type: 'center', label: 'Align horizontal centers', icon: AlignCenterVertical },
  { type: 'right', label: 'Align right edges', icon: AlignEndVertical },
  { type: 'top', label: 'Align top edges', icon: AlignStartHorizontal },
  { type: 'middle', label: 'Align vertical centers', icon: AlignCenterHorizontal },
  { type: 'bottom', label: 'Align bottom edges', icon: AlignEndHorizontal },
];

/** Undo/redo keeps at most this many graph states. */
const HISTORY_LIMIT = 100;
/** Edits that land within this window (typing in the inspector, nudges) collapse into one undo step. */
const HISTORY_SETTLE_MS = 400;

/** Canvas-wide settings that undo/redo restores along with the graph. */
interface CanvasLayout {
  direction: WorkflowDirection;
  edgeStyle: WorkflowEdgeStyle;
}

interface GraphSnapshot {
  key: string;
  nodes: Node[];
  edges: Edge[];
  layout?: CanvasLayout;
}

/**
 * The graph minus React Flow's transient UI state (selection, drag, measured
 * size), plus — for history entries — the canvas layout, so switching edge
 * routing or layout direction is an undoable step like any graph edit.
 */
function toGraphSnapshot(nodes: Node[], edges: Edge[], layout?: CanvasLayout): GraphSnapshot {
  const cleanNodes = nodes.map(({ selected: _s, dragging: _d, measured: _m, ...n }) => n as Node);
  const cleanEdges = edges.map(({ selected: _s, ...e }) => e as Edge);
  return {
    key: JSON.stringify(layout ? [cleanNodes, cleanEdges, layout.direction, layout.edgeStyle] : [cleanNodes, cleanEdges]),
    nodes: cleanNodes,
    edges: cleanEdges,
    ...(layout ? { layout } : {}),
  };
}

const isTypingTarget = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
};

/** Extra classes on top of `<Button variant="ghost" size="icon-sm">` for the canvas toolbar. */
const canvasControlClass = 'rounded-lg disabled:opacity-40';

type MeasuredSizeReader = (id: string) => { width?: number; height?: number } | undefined;

/**
 * Nodes in page state lose `measured` whenever they're replaced (load, undo,
 * copilot edits) and React Flow only re-reports a size when it changes, so the
 * layout fell back to a default size for every card and lined up their tops
 * instead of their handles. Fill sizes in from what React Flow has measured.
 */
function withMeasuredSizes(nodes: Node[], read: MeasuredSizeReader | null | undefined): Node[] {
  if (!read) return nodes;
  return nodes.map((n) => {
    const size = read(n.id);
    return size?.width && size.height ? { ...n, measured: { width: size.width, height: size.height } } : n;
  });
}

function WorkflowCanvasInner({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onPaneClick,
  onAddNode,
  onAutoLayout,
  onDeleteNodes,
  onDuplicateNode,
  onTestNode,
  onInspectNode,
  onDeleteEdge,
  onReconnectEdge,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onExportJson,
  onBatchAlign,
  onBatchDuplicate,
  onBatchGroup,
  onInitFlow,
  isLocked,
  onToggleLock,
  onFocusNodeById,
  onEdgeClick,
  onInspectEdge,
  onInsertNodeOnEdge,
  onEditEdgeLabel,
  onToggleEdgeAnimated,
  onCopyNode,
  onCutNode,
  onPaste,
  hasClipboard = false,
  onSelectAll,
  onOpenCommandPalette,
  onConnectEndDrop,
  direction = 'horizontal',
  onChangeDirection,
  edgeStyle = 'smooth',
  onChangeEdgeStyle,
  layoutPrefs = DEFAULT_LAYOUT_PREFS,
  onChangeLayoutPrefs,
  isCopilotOpen = false,
  onToggleCopilot,
  onUpdateNodeMetadata,
  measuredSizeRef,
}: {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onPaneClick: () => void;
  onAddNode: (newNode: Node) => void;
  /** Returns the animation length in ms, or null if nothing moved. */
  onAutoLayout: (dir?: 'LR' | 'TB') => number | null;
  onDeleteNodes: (nodeIds: string[]) => void;
  onDuplicateNode: (node: Node) => void;
  onTestNode: (node: Node) => void;
  onInspectNode: (node: Node) => void;
  onDeleteEdge: (edgeId: string) => void;
  onReconnectEdge: (oldEdge: Edge, newConnection: Connection) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onExportJson: () => void;
  onBatchAlign: (type: AlignType, selectedIds: string[]) => void;
  onBatchDuplicate: (selectedIds: string[]) => void;
  onBatchGroup: (selectedIds: string[]) => void;
  onInitFlow?: (instance: any) => void;
  isLocked: boolean;
  onToggleLock: () => void;
  /** Frame a node. */
  onFocusNodeById: (nodeId: string) => void;
  onEdgeClick?: (event: React.MouseEvent, edge: Edge) => void;
  onInspectEdge?: (edge: Edge) => void;
  onInsertNodeOnEdge?: (edge: Edge) => void;
  onEditEdgeLabel?: (edge: Edge) => void;
  onToggleEdgeAnimated?: (edge: Edge) => void;
  onCopyNode?: (node: Node) => void;
  onCutNode?: (node: Node) => void;
  onPaste?: () => void;
  hasClipboard?: boolean;
  onSelectAll?: () => void;
  onOpenCommandPalette?: () => void;
  onConnectEndDrop?: (pos: { x: number; y: number }, fromNode: Node, fromHandle?: string) => void;
  direction?: WorkflowDirection;
  onChangeDirection?: (dir: WorkflowDirection) => void;
  edgeStyle?: WorkflowEdgeStyle;
  onChangeEdgeStyle?: (style: WorkflowEdgeStyle) => void;
  layoutPrefs?: LayoutPrefs;
  /** Saves the choice and re-runs Auto Layout with it. */
  onChangeLayoutPrefs?: (patch: Partial<LayoutPrefs>) => void;
  isCopilotOpen?: boolean;
  /** Opens/closes the Agent Copilot drawer; the toolbar button is hidden without it. */
  onToggleCopilot?: () => void;
  onUpdateNodeMetadata?: (
    nodeId: string,
    patch: { title?: string; label?: string; description?: string; subtitle?: string },
  ) => void;
  /** Filled with a reader for each card's rendered size, for layouts run by the page. */
  measuredSizeRef?: { current: MeasuredSizeReader | null };
}) {
  const reactFlowInstance = useReactFlow();
  if (measuredSizeRef) {
    measuredSizeRef.current = (id) => {
      const measured = reactFlowInstance.getInternalNode(id)?.measured;
      if (measured?.width && measured.height) return measured;
      // React Flow's record can be empty (state replaced, resize observer idle): use the
      // rendered card, whose offset size is unaffected by the canvas zoom
      const el = canvasRef.current?.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(id)}"]`);
      return el ? { width: el.offsetWidth, height: el.offsetHeight } : undefined;
    };
  }
  const { zoom } = useViewport();
  const [interactionMode, setInteractionMode] = useState<'select' | 'pan'>('select');
  const canvasRef = useRef<HTMLDivElement>(null);
  const edgeReconnectSuccessful = useRef(true);

  // Keyboard shortcuts: V (select), H (pan), Shift+1 (zoom to fit), Shift+0 (zoom to 100%), Shift+L (tidy)
  const autoLayoutRef = useRef<(dir?: 'LR' | 'TB') => void>(() => undefined);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // e.code, not e.key: Shift+1 yields '!' (or another symbol, layout-dependent)
      if (e.shiftKey && e.code === 'Digit1') {
        e.preventDefault();
        reactFlowInstance.fitView({ padding: 0.2, duration: 250 });
      } else if (e.shiftKey && e.code === 'Digit0') {
        e.preventDefault();
        reactFlowInstance.zoomTo(1, { duration: 250 });
      } else if (e.shiftKey && e.code === 'KeyL') {
        e.preventDefault();
        autoLayoutRef.current();
      } else if (e.key === 'v' || e.key === 'V') {
        setInteractionMode('select');
      } else if (e.key === 'h' || e.key === 'H') {
        setInteractionMode('pan');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [reactFlowInstance]);

  useEffect(() => {
    onInitFlow?.(reactFlowInstance);
  }, [reactFlowInstance, onInitFlow]);

  // Multi-selection tracking
  const [selectedNodes, setSelectedNodes] = useState<Node[]>([]);
  useOnSelectionChange({
    onChange: ({ nodes: selNodes }) => {
      setSelectedNodes(selNodes);
    },
  });

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{
    isOpen: boolean;
    x: number;
    y: number;
    targetNode: Node | null;
    targetEdge: Edge | null;
  }>({ isOpen: false, x: 0, y: 0, targetNode: null, targetEdge: null });

  // Bottom Node Catalog Modal State
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  // Agent outline (teams, attachments, setup issues); opens on its own once the flow has agents
  const agentCount = useMemo(() => nodes.filter((n) => isSlotHost(n.type)).length, [nodes]);
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const rawData = event.dataTransfer.getData('application/reactflow');
      if (!rawData) return;

      try {
        const item = JSON.parse(rawData);
        const position = reactFlowInstance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });

        const newNode: Node = {
          id: `${item.type.toLowerCase()}-${Date.now().toString(36)}`,
          type: item.type,
          position,
          data: {
            label: item.label,
            subtitle: item.subtitle,
            config: item.config || {},
          },
        };

        onAddNode(newNode);
      } catch (e) {
        console.error('Failed to drop node', e);
      }
    },
    [reactFlowInstance, onAddNode],
  );

  // Edge Reconnection Handlers
  const onReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  const onReconnect = useCallback(
    (oldEdge: Edge, newConnection: Connection) => {
      edgeReconnectSuccessful.current = true;
      onReconnectEdge(oldEdge, newConnection);
    },
    [onReconnectEdge],
  );

  const onReconnectEnd = useCallback(
    (_: any, edge: Edge) => {
      if (!edgeReconnectSuccessful.current) {
        onDeleteEdge(edge.id);
      }
      edgeReconnectSuccessful.current = true;
    },
    [onDeleteEdge],
  );

  // Edge Drop Handler (Connect on empty drop)
  const onConnectEnd = useCallback(
    (event: any, connectionState: any) => {
      if (!connectionState?.isValid && connectionState?.fromNode) {
        const clientX = event?.clientX ?? event?.changedTouches?.[0]?.clientX ?? 0;
        const clientY = event?.clientY ?? event?.changedTouches?.[0]?.clientY ?? 0;
        const position = reactFlowInstance.screenToFlowPosition({ x: clientX, y: clientY });
        onConnectEndDrop?.(
          position,
          connectionState.fromNode,
          connectionState.fromHandle?.id ?? connectionState.fromHandle,
        );
      }
    },
    [reactFlowInstance, onConnectEndDrop],
  );

  // Canvas Right-Click
  const handlePaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault();
    setContextMenu({
      isOpen: true,
      x: event.clientX,
      y: event.clientY,
      targetNode: null,
      targetEdge: null,
    });
  }, []);

  // Node Right-Click
  const handleNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: event.clientX,
      y: event.clientY,
      targetNode: node,
      targetEdge: null,
    });
  }, []);

  // Edge Right-Click
  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      isOpen: true,
      x: event.clientX,
      y: event.clientY,
      targetNode: null,
      targetEdge: edge,
    });
  }, []);

  // Analytics Overlay State
  const [isAnalyticsOverlayOpen, setIsAnalyticsOverlayOpen] = useState(false);
  const [overlayMetric, setOverlayMetric] = useState<'duration' | 'cost' | 'runs' | 'errors'>('duration');
  const [overlayRange, setOverlayRange] = useState<'24H' | '7D' | '30D'>('7D');
  const { activeWorkspace } = useStudioSession();
  const { agentId } = useParams();

  // Query workflow analytics for overlay metrics
  const { data: workflowAnalytics } = useQuery({
    queryKey: ['workflow-analytics-overlay', activeWorkspace?.id, agentId, overlayRange],
    queryFn: () => analyticsService.getWorkflowDetail(activeWorkspace.id, agentId!, overlayRange),
    enabled: Boolean(isAnalyticsOverlayOpen && activeWorkspace?.id && agentId),
  });

  // Also query node analytics across workspace for node fallback
  const { data: nodesAnalytics = [] } = useQuery({
    queryKey: ['nodes-analytics-overlay', activeWorkspace?.id, overlayRange],
    queryFn: () => analyticsService.getNodeAnalytics(activeWorkspace.id, overlayRange),
    enabled: Boolean(isAnalyticsOverlayOpen && activeWorkspace?.id),
  });

  // Node quick-action toolbars hide mutating actions while the canvas is locked; analytics overlay attaches telemetry badges
  // The drag-to-connect wire follows the chosen routing and shows an arrowhead
  const connectionLine = useCallback(
    (lineProps: ConnectionLineComponentProps) => (
      <WorkflowConnectionLine {...lineProps} edgeStyle={edgeStyle} />
    ),
    [edgeStyle],
  );

  const displayNodes = useMemo(() => {
    // Per-node metrics for this workflow, falling back to workspace-wide
    // figures for the node's type. Nodes with neither get no badge.
    const metricsFor = (n: (typeof nodes)[number]) => {
      const own = workflowAnalytics?.nodeMetrics?.[n.id];
      if (own) {
        return {
          executionCount: own.invocations,
          successCount: own.successCount,
          errorCount: own.errorCount,
          successRate: own.successRate,
          avgDurationMs: own.avgLatencyMs,
          totalTokens: own.totalTokens,
          estimatedCost: own.costUsd,
          errorRate: own.errorRate,
          retryCount: 0,
        };
      }
      const byType = nodesAnalytics.find((rec) => rec.nodeType === n.type);
      if (byType) {
        return {
          executionCount: byType.invocations,
          successCount: byType.successCount,
          errorCount: byType.errorCount,
          successRate: byType.successRate,
          avgDurationMs: byType.avgDurationMs,
          totalTokens: byType.totalTokens,
          estimatedCost: byType.costUsd,
          errorRate: byType.invocations > 0 ? (byType.errorCount / byType.invocations) * 100 : 0,
          retryCount: byType.retryCount,
        };
      }
      return null;
    };

    const metricOf = (m: NonNullable<ReturnType<typeof metricsFor>>) =>
      overlayMetric === 'duration'
        ? m.avgDurationMs
        : overlayMetric === 'cost'
        ? m.estimatedCost
        : overlayMetric === 'runs'
        ? m.executionCount
        : m.errorRate;

    let maxVal = 0;
    if (isAnalyticsOverlayOpen) {
      for (const n of nodes) {
        const m = metricsFor(n);
        if (m) maxVal = Math.max(maxVal, metricOf(m));
      }
    }

    return nodes.map((n) => {
      let nodeAnalyticsData: NodeAnalyticsOverlayData | undefined;
      const m = isAnalyticsOverlayOpen ? metricsFor(n) : null;

      if (m) {
        const metricLabel =
          overlayMetric === 'cost' ? 'Cost' : overlayMetric === 'runs' ? 'Runs' : overlayMetric === 'errors' ? 'Errors' : 'Latency';
        const metricValue =
          overlayMetric === 'cost'
            ? `$${m.estimatedCost.toFixed(4)}`
            : overlayMetric === 'runs'
            ? `${m.executionCount}`
            : overlayMetric === 'errors'
            ? `${m.errorRate.toFixed(1)}%`
            : `${Math.round(m.avgDurationMs)}ms`;

        nodeAnalyticsData = {
          ...m,
          relativeIntensity: maxVal > 0 ? Math.min(1, metricOf(m) / maxVal) : 0,
          metricLabel,
          metricValue,
        };
      }

      return {
        ...n,
        data: {
          ...n.data,
          locked: isLocked ? true : n.data?.locked,
          analytics: nodeAnalyticsData,
          onOpenNodeAnalytics: () => {
            onNodeClick?.(null as any, n);
          },
        },
      };
    });
  }, [nodes, isLocked, isAnalyticsOverlayOpen, overlayMetric, workflowAnalytics, nodesAnalytics, onNodeClick]);

  autoLayoutRef.current = (dir: 'LR' | 'TB' = direction === 'vertical' ? 'TB' : 'LR') => handleAutoLayoutClick(dir);
  const handleAutoLayoutClick = useCallback((dir: 'LR' | 'TB' = direction === 'vertical' ? 'TB' : 'LR') => {
    if (isLocked) return;
    const duration = onAutoLayout(dir);
    if (duration === null) return;
    // Frame the tidied graph once the nodes have settled
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.2, duration: 450 });
    }, duration + 40);
  }, [isLocked, onAutoLayout, reactFlowInstance, direction]);

  return (
    <div
      ref={canvasRef}
      className="relative flex-1 h-full w-full bg-surface/50 select-none overflow-hidden"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Floating Canvas Quick Toolbar (Docked at Bottom Center) */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-xl border border-border bg-surface p-1.5 shadow-lg select-none">
        {onToggleCopilot && (
          <>
            <button
              type="button"
              onClick={onToggleCopilot}
              data-open={isCopilotOpen}
              aria-pressed={isCopilotOpen}
              title={isCopilotOpen ? 'Close Agent Copilot' : 'Ask Agent Copilot to change this agent'}
              className={cn(
                'copilot-shine h-8.5 rounded-full pl-2.5 pr-3 flex items-center gap-1.5 shrink-0 cursor-pointer',
                'text-xs font-semibold text-primary-foreground transition-transform duration-200',
                'hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
              )}
            >
              <Sparkles className="size-4" />
              <span>Copilot</span>
            </button>

            <div className="h-4 w-px bg-border mx-0.5" />
          </>
        )}

        {/* Highlighted Rounded Plus Button */}
        <button
          type="button"
          onClick={() => setIsCatalogOpen((prev) => !prev)}
          title="Add Node to Workflow (Ctrl+K)"
          className={cn(
            'size-8.5 rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0',
            'bg-foreground text-background shadow-md shadow-foreground/15',
            'hover:bg-foreground/85 hover:scale-110 hover:shadow-lg hover:shadow-foreground/15 active:scale-95',
            'ring-2 ring-foreground/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/55',
            isCatalogOpen && 'ring-4 ring-foreground/20 scale-105 shadow-foreground/15',
          )}
        >
          <Plus className="size-5 stroke-[2.5]" />
        </button>

        <div className="h-4 w-px bg-border mx-0.5" />

        <Button
          variant="ghost"
          size="xs"
          onClick={() => handleAutoLayoutClick(direction === 'vertical' ? 'TB' : 'LR')}
          disabled={isLocked}
          title={isLocked ? 'Unlock the canvas to tidy the layout' : 'Tidy the layout (Shift+L)'}
          aria-keyshortcuts="Shift+L"
          className="gap-1.5 text-xs font-semibold text-foreground hover:text-primary h-8 px-2.5 rounded-xl cursor-pointer"
        >
          <Wand2 className="size-3.5 text-primary" />
          <span>Auto Layout</span>
        </Button>

        {/* Layout direction + connection style live in one overflow menu */}
        <div className="h-4 w-px bg-border mx-0.5" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              title="Layout & connection options"
              aria-label="Layout and connection options"
              className="rounded-xl"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="center" className="w-52">
            <DropdownMenuLabel className="text-xs text-muted-foreground">Layout direction</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={direction}
              onValueChange={(value) => onChangeDirection?.(value as WorkflowDirection)}
            >
              <DropdownMenuRadioItem value="horizontal" className="gap-2 text-xs">
                <MoveHorizontal className="size-3.5" />
                Horizontal
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="vertical" className="gap-2 text-xs">
                <MoveVertical className="size-3.5" />
                Vertical
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Arrangement</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={layoutPrefs.arrange}
              onValueChange={(value) => onChangeLayoutPrefs?.({ arrange: value as LayoutArrange })}
            >
              {LAYOUT_ARRANGE_MENU.map(({ value, label, hint, Icon }) => (
                <DropdownMenuRadioItem key={value} value={value} disabled={isLocked} className="gap-2 text-xs" title={hint}>
                  <Icon className="size-3.5" />
                  {label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Spacing</DropdownMenuLabel>
            <div role="radiogroup" aria-label="Spacing" className="mx-1 mb-1 grid grid-cols-3 gap-0.5 rounded-lg bg-surface-raised p-0.5">
              {LAYOUT_SPACING_MENU.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={layoutPrefs.spacing === value}
                  disabled={isLocked}
                  onClick={() => onChangeLayoutPrefs?.({ spacing: value })}
                  className={cn(
                    'h-6 rounded-md text-xs font-medium transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50',
                    layoutPrefs.spacing === value
                      ? 'bg-surface text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-xs text-muted-foreground">Edge routing</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={edgeStyle}
              onValueChange={(value) => onChangeEdgeStyle?.(value as WorkflowEdgeStyle)}
            >
              {EDGE_ROUTING_MENU.map(({ value, Icon }) => (
                <DropdownMenuRadioItem key={value} value={value} className="gap-2 text-xs" title={EDGE_ROUTING_HINTS[value]}>
                  <Icon className="size-3.5" />
                  {EDGE_ROUTING_LABELS[value]}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {onOpenCommandPalette && (
          <>
            <div className="h-4 w-px bg-border mx-0.5" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onOpenCommandPalette}
              title="Command Palette & Search (Ctrl+K)"
              aria-label="Command palette and search"
              className="rounded-xl"
            >
              <Search className="size-4" />
            </Button>
          </>
        )}
      </div>

      {isOutlineOpen && (
        <AgentOutlinePanel
          nodes={nodes}
          edges={edges}
          onFocusNode={onFocusNodeById}
          onClose={() => setIsOutlineOpen(false)}
          className="absolute left-5 top-5 z-20"
        />
      )}

      {/* Floating Canvas View Controls (Docked at Bottom Left) */}
      <div
        role="group"
        aria-label="Canvas controls"
        className="absolute bottom-5 left-5 z-20 flex h-9 items-center gap-1 rounded-[14px] border border-border bg-surface p-1 shadow-sm select-none"
      >
        {/* SECTION 1: Mode Switch (Select / Pan) */}
        <div role="group" aria-label="Canvas tool" className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            onClick={() => setInteractionMode('select')}
            aria-label="Select"
            aria-pressed={interactionMode === 'select'}
            title="Select (V) - Click and drag to box-select"
            className={cn(
              canvasControlClass,
              interactionMode === 'select' && 'bg-surface-raised text-foreground',
            )}
          >
            <MousePointer2 className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            onClick={() => setInteractionMode('pan')}
            aria-label="Pan"
            aria-pressed={interactionMode === 'pan'}
            title="Pan (H) - Drag canvas freely"
            className={cn(
              canvasControlClass,
              interactionMode === 'pan' && 'bg-surface-raised text-foreground',
            )}
          >
            <Hand className="size-3.5" />
          </Button>
        </div>

        <div className="h-4 w-px shrink-0 bg-border" />

        {/* SECTION 2: Zoom Controls (- 100% +) */}
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            onClick={() => reactFlowInstance.zoomOut({ duration: 200 })}
            aria-label="Zoom out"
            title="Zoom out (Ctrl -)"
            className={canvasControlClass}
          >
            <Minus className="size-3.5" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                type="button"
                aria-label={`Zoom level ${Math.round(zoom * 100)}%`}
                title="Zoom options"
                className={cn(
                  canvasControlClass,
                  'w-12 text-xs font-semibold tabular-nums text-foreground data-[state=open]:bg-surface-raised',
                )}
              >
                {Math.round(zoom * 100)}%
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" sideOffset={8} className="min-w-44">
              <DropdownMenuItem onSelect={() => reactFlowInstance.fitView({ padding: 0.2, duration: 250 })}>
                Zoom to fit
                <DropdownMenuShortcut keys={['Shift', '1']} />
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {ZOOM_PRESETS.map((preset) => {
                const isCurrent = Math.round(zoom * 100) === preset * 100;
                return (
                  <DropdownMenuItem
                    key={preset}
                    onSelect={() => reactFlowInstance.zoomTo(preset, { duration: 250 })}
                    className={cn(isCurrent && 'font-semibold')}
                  >
                    Zoom to {preset * 100}%
                    {preset === 1 ? (
                      <DropdownMenuShortcut keys={['Shift', '0']} />
                    ) : null}
                    {isCurrent && (
                      <Check className={cn('size-3.5 text-primary', preset !== 1 && 'ml-auto')} />
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            onClick={() => reactFlowInstance.zoomIn({ duration: 200 })}
            aria-label="Zoom in"
            title="Zoom in (Ctrl +)"
            className={canvasControlClass}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>

        <div className="h-4 w-px shrink-0 bg-border" />

        {/* SECTION 3: History (Undo / Redo) */}
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
            className={canvasControlClass}
          >
            <Undo2 className="size-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            aria-label="Redo"
            title="Redo (Ctrl+Y)"
            className={canvasControlClass}
          >
            <Redo2 className="size-3.5" />
          </Button>
        </div>

        <div className="h-4 w-px shrink-0 bg-border" />

        {/* SECTION 4: Agent outline */}
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          onClick={() => setIsOutlineOpen((v) => !v)}
          aria-label="Agent outline"
          aria-pressed={isOutlineOpen}
          title={agentCount > 0 ? `Agents & teams (${agentCount})` : 'Agents & teams'}
          className={cn(canvasControlClass, isOutlineOpen && 'bg-surface-raised text-primary')}
        >
          <Network className="size-3.5" />
        </Button>

        <div className="h-4 w-px shrink-0 bg-border" />

        {/* SECTION 5: Canvas Lock */}
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          onClick={onToggleLock}
          aria-label="Lock canvas"
          aria-pressed={isLocked}
          title={isLocked ? 'Canvas locked (click to unlock)' : 'Lock canvas (prevent changes)'}
          className={cn(canvasControlClass, isLocked && 'bg-warning/15 text-warning hover:bg-warning/20 hover:text-warning')}
        >
          <Lock className="size-3.5" />
        </Button>

        <div className="h-4 w-px shrink-0 bg-border" />

        {/* SECTION 6: Analytics Overlay */}
        <Button
          variant="ghost"
          size="icon-sm"
          type="button"
          onClick={() => setIsAnalyticsOverlayOpen((v) => !v)}
          aria-label="Toggle Analytics Overlay"
          aria-pressed={isAnalyticsOverlayOpen}
          title={isAnalyticsOverlayOpen ? 'Hide Analytics Overlay' : 'Show Analytics Overlay'}
          className={cn(
            canvasControlClass,
            isAnalyticsOverlayOpen && 'bg-primary/20 text-primary font-semibold',
          )}
        >
          <BarChart3 className="size-3.5" />
        </Button>
      </div>

      {/* Floating Analytics Overlay Controls Banner */}
      {isAnalyticsOverlayOpen && (
        <div
          role="region"
          aria-label="Workflow Analytics Overlay Controls"
          className="absolute top-4 left-4 z-30 flex items-center gap-2 rounded-xl border border-border-strong bg-surface p-2 shadow-lg text-xs select-none"
        >
          <div className="flex items-center gap-1.5 font-semibold text-foreground px-1">
            <BarChart3 className="size-4 text-primary" />
            <span>Overlay:</span>
          </div>

          <div className="flex items-center gap-1">
            {(
              [
                { id: 'duration', label: 'Latency' },
                { id: 'cost', label: 'Cost' },
                { id: 'runs', label: 'Runs' },
                { id: 'errors', label: 'Errors' },
              ] as const
            ).map((m) => (
              <Button
                key={m.id}
                type="button"
                variant={overlayMetric === m.id ? 'primary' : 'ghost'}
                size="xs"
                aria-pressed={overlayMetric === m.id}
                onClick={() => setOverlayMetric(m.id)}
                className="rounded-md"
              >
                {m.label}
              </Button>
            ))}
          </div>

          <div className="h-3 w-px bg-border" />

          <div className="flex items-center gap-1">
            {(['24H', '7D', '30D'] as const).map((r) => (
              <Button
                key={r}
                type="button"
                variant={overlayRange === r ? 'secondary' : 'ghost'}
                size="xs"
                aria-pressed={overlayRange === r}
                onClick={() => setOverlayRange(r)}
                className="h-5 rounded-md px-1.5 text-2xs"
              >
                {r}
              </Button>
            ))}
          </div>

          <div className="h-3 w-px bg-border" />

          {/* Color Legend */}
          <div className="flex items-center gap-2 text-2xs text-muted-foreground px-1">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-success" />
              Optimal
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-warning" />
              Elevated
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-destructive" />
              Hotspot
            </span>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => setIsAnalyticsOverlayOpen(false)}
            aria-label="Close analytics overlay"
            className="ml-1 size-5"
          >
            <X className="size-3" />
          </Button>
        </div>
      )}

      {/* Node Catalog Grid Modal */}
      <NodeCatalogModal
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        onSelectNode={(item) => {
          // Drop the new node in the middle of the visible canvas (not the window — the
          // header and side panels offset it)
          const rect = canvasRef.current?.getBoundingClientRect();
          const position = reactFlowInstance.screenToFlowPosition({
            x: rect ? rect.left + rect.width / 2 - 120 : window.innerWidth / 2,
            y: rect ? rect.top + rect.height / 2 - 40 : window.innerHeight / 2,
          });

          const newNode: Node = {
            id: `${item.type.toLowerCase()}-${Date.now().toString(36)}`,
            type: item.type,
            position,
            data: {
              label: item.label,
              subtitle: item.subtitle,
              config: item.defaultConfig || {},
            },
          };
          onAddNode(newNode);
        }}
      />

      <WorkflowLayoutContext.Provider
        value={{
          direction,
          edgeStyle,
          setDirection: onChangeDirection,
          setEdgeStyle: onChangeEdgeStyle,
          updateNodeMetadata: onUpdateNodeMetadata,
        }}
      >
        <ReactFlow
          nodes={displayNodes}
          edges={edges}
          onNodesChange={isLocked ? undefined : onNodesChange}
          onEdgesChange={isLocked ? undefined : onEdgesChange}
          onConnect={isLocked ? undefined : onConnect}
          onConnectEnd={isLocked ? undefined : onConnectEnd}
          // Agent slots and type-safe connection validator
          isValidConnection={(connection) => validateWorkflowConnection(connection as Connection, nodes, edges).valid}
          onReconnect={isLocked ? undefined : onReconnect}
          onReconnectStart={onReconnectStart}
          onReconnectEnd={onReconnectEnd}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onPaneContextMenu={handlePaneContextMenu}
          onNodeContextMenu={handleNodeContextMenu}
          onEdgeContextMenu={handleEdgeContextMenu}
          nodeTypes={STUDIO_NODE_TYPES}
          edgeTypes={STUDIO_EDGE_TYPES}
          connectionMode={ConnectionMode.Loose}
          connectionLineComponent={connectionLine}
        selectionMode={SelectionMode.Partial}
        panOnDrag={interactionMode === 'pan' ? true : [1, 2]}
        selectionOnDrag={interactionMode === 'select'}
        // Wheel zooms toward the cursor; pan by dragging (Pan tool) or with middle/right mouse
        panOnScroll={false}
        zoomOnScroll={true}
        zoomOnPinch={true}
        nodesDraggable={!isLocked}
        nodesConnectable={!isLocked}
        elementsSelectable={true}
        defaultEdgeOptions={{
          animated: false,
          type: 'workflow',
        }}
        snapToGrid={true}
        snapGrid={[16, 16]}
        deleteKeyCode={isLocked ? [] : ['Backspace', 'Delete']}
        proOptions={{ hideAttribution: true }}
        fitView
        // Small graphs open at a readable size instead of being blown up to fill the pane
        fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        className={cn(
          'bg-dot-pattern',
          interactionMode === 'pan' && 'cursor-grab active:cursor-grabbing',
        )}
      >
        {/* Multi-Node Selection Toolbar */}
        {selectedNodes.length >= 2 && (
          <Panel position="top-center" className="!mt-3">
            <div
              role="toolbar"
              aria-label="Selection actions"
              className="flex h-9 items-center gap-1 rounded-[14px] border border-border bg-surface p-1 shadow-sm select-none animate-in fade-in slide-in-from-top-1 duration-150"
            >
              <span className="px-2 text-xs font-semibold text-foreground tabular-nums">
                {selectedNodes.length} selected
              </span>

              {!isLocked && (
                <>
                  <div className="h-4 w-px shrink-0 bg-border" />
                  {SELECTION_ALIGN_ACTIONS.map(({ type, label, icon: Icon }) => (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      key={type}
                      type="button"
                      onClick={() => onBatchAlign(type, selectedNodes.map((n) => n.id))}
                      aria-label={label}
                      title={label}
                      className={canvasControlClass}
                    >
                      <Icon className="size-3.5" />
                    </Button>
                  ))}

                  <div className="h-4 w-px shrink-0 bg-border" />

                  <Button
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    onClick={() => onBatchDuplicate(selectedNodes.map((n) => n.id))}
                    aria-label="Duplicate selected"
                    title="Duplicate selected"
                    className={canvasControlClass}
                  >
                    <Copy className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    onClick={() => onBatchGroup(selectedNodes.map((n) => n.id))}
                    aria-label="Group into stage"
                    title="Group into stage"
                    className={canvasControlClass}
                  >
                    <Layers className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    type="button"
                    onClick={() => onDeleteNodes(selectedNodes.map((n) => n.id))}
                    aria-label="Delete selected"
                    title="Delete selected (Del)"
                    className={cn(canvasControlClass, 'hover:bg-destructive/15 hover:text-destructive')}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </>
              )}
            </div>
          </Panel>
        )}

        <Background gap={18} size={1} color="color-mix(in oklab, var(--muted-foreground) 30%, transparent)" />
        <MiniMap
          nodeColor={(n) => {
            const t = n.type || '';
            if (t.includes('START') || t.includes('TRIGGER')) return 'var(--success)';
            if (t.includes('AGENT')) return 'var(--primary)';
            if (t.includes('FIRECRAWL')) return 'var(--warning)';
            if (t.includes('TOOL') || t.includes('MCP')) return 'var(--primary)';
            if (t.includes('TRANSFORM') || t.includes('CODE')) return 'var(--accent-cyan)';
            if (t.includes('IF') || t.includes('CONDITION')) return 'var(--accent-violet)';
            if (t.includes('USER') || t.includes('APPROVAL')) return 'var(--destructive)';
            if (t.includes('NOTE')) return 'var(--accent-amber)';
            if (t.includes('GROUP')) return 'var(--muted-foreground)';
            if (t.includes('APP_CONNECTOR')) return 'var(--accent-cyan)';
            if (t.includes('END') || t.includes('OUTPUT')) return 'var(--success)';
            // Prompt / LLM / knowledge cards plugged into an agent, and anything else: quiet grey
            return 'var(--border-strong)';
          }}
          nodeStrokeWidth={3}
          className="!bg-surface !border-border !rounded-xl !shadow-sm"
          maskColor="rgba(0, 0, 0, 0.4)"
        />
        <RemeasureHandlesOnDirection direction={direction} />
      </ReactFlow>
      </WorkflowLayoutContext.Provider>

      {/* Right Click Context Menu */}
      <CanvasContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        targetNode={contextMenu.targetNode}
        targetEdge={contextMenu.targetEdge}
        hasClipboard={hasClipboard}
        onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false, targetNode: null, targetEdge: null }))}
        onAutoLayout={handleAutoLayoutClick}
        onFitView={() => reactFlowInstance.fitView({ padding: 0.2, duration: 300 })}
        onAddNode={(pos) => {
          const flowPos = reactFlowInstance.screenToFlowPosition(pos);
          onAddNode({
            id: `agent-${Date.now().toString(36)}`,
            type: 'AGENT',
            position: flowPos,
            data: { label: 'AI Agent', subtitle: 'Autonomous Reasoning', config: {} },
          });
        }}
        onDuplicateNode={(node) => onDuplicateNode(node)}
        onCopyNode={onCopyNode}
        onCutNode={onCutNode}
        onPaste={onPaste}
        onSelectAll={onSelectAll}
        onDeleteNode={(id: string) => onDeleteNodes([id])}
        onTestNode={(node) => onTestNode(node)}
        onInspectNode={(node) => onInspectNode(node)}
        onInspectEdge={onInspectEdge}
        onDeleteEdge={onDeleteEdge}
        onInsertNodeOnEdge={onInsertNodeOnEdge}
        onEditEdgeLabel={onEditEdgeLabel}
        onToggleEdgeAnimated={onToggleEdgeAnimated}
        onExportJson={onExportJson}
      />
    </div>
  );
}

/**
 * Cards move their handles (left/right ↔ top/bottom) when the flow direction
 * changes, but React Flow keeps the handle positions it measured earlier, so
 * wires kept leaving the old sides. Re-measure every card once it has redrawn.
 */
function RemeasureHandlesOnDirection({ direction }: { direction: WorkflowDirection }) {
  const updateNodeInternals = useUpdateNodeInternals();
  const nodeIds = useStore((s) => s.nodes.map((n) => n.id).join('|'));
  useEffect(() => {
    const ids = nodeIds ? nodeIds.split('|') : [];
    if (ids.length === 0) return;
    const frame = requestAnimationFrame(() => updateNodeInternals(ids));
    return () => cancelAnimationFrame(frame);
    // Only on a direction change (and the first render); new cards measure themselves
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [direction, updateNodeInternals]);
  return null;
}

export function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const { activeWorkspace, user } = useStudioSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // The active tab lives in the URL (?tab=) so refresh / back / shared links keep it
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: AgentTab = isAgentTab(tabParam) ? tabParam : 'build';
  const setActiveTab = useCallback(
    (tab: AgentTab) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (tab === 'build') next.delete('tab');
          else next.set('tab', tab);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );
  // `?copilot=1` (an agent fresh from "Create with one prompt") opens the Copilot.
  const [showAiPanel, setShowAiPanel] = useState(() => searchParams.get('copilot') === '1');
  const copilotWelcome = useRef(searchParams.get('copilot') === '1').current;
  const [canvasLockToggled, setIsCanvasLocked] = useState(false);
  // Bumped when a different graph is loaded, remounting the canvas so it fits the new graph
  const [canvasEpoch, setCanvasEpoch] = useState(0);
  const [workflowDirection, setWorkflowDirection] = useState<WorkflowDirection>('horizontal');
  const [workflowEdgeStyle, setWorkflowEdgeStyle] = useState<WorkflowEdgeStyle>('smooth');
  const [layoutPrefs, setLayoutPrefs] = useState<LayoutPrefs>(DEFAULT_LAYOUT_PREFS);
  const [nodes, setNodes] = useState<Node[]>(INITIAL_NODES);
  const measuredSizeRef = useRef<MeasuredSizeReader | null>(null);
  const [edges, setEdges] = useState<Edge[]>(INITIAL_EDGES);
  // Graph-level settings saved with the canvas (`settings.limits` caps a run).
  const [graphSettings, setGraphSettings] = useState<Record<string, unknown> | undefined>(undefined);
  const graphSettingsRef = useRef(graphSettings);
  graphSettingsRef.current = graphSettings;
  // "Save" in a drawer persists right after the draft is in state (not the render before it).
  const [saveRequest, setSaveRequest] = useState(0);
  const requestSaveNow = useCallback(() => setSaveRequest((n) => n + 1), []);
  // Track the inspected node by id and read it from live canvas state, so the
  // inspector never shows a stale copy (after a drag, undo, or keyboard delete).
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = useMemo(
    () => (selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) ?? null : null),
    [nodes, selectedNodeId],
  );
  const setSelectedNode = useCallback((node: Node | null) => setSelectedNodeId(node?.id ?? null), []);
  // Forget a deleted node, so undoing the delete doesn't silently reopen its inspector
  useEffect(() => {
    if (selectedNodeId && !selectedNode) setSelectedNodeId(null);
  }, [selectedNodeId, selectedNode]);

  // The agent capability module open in the inspector (Prompt, LLM, …). Opening
  // another node closes it, unless that node was opened *at* a module.
  const [activeModule, setActiveModule] = useState<{ id: AgentModuleId; section?: string; field?: string } | null>(null);
  const pendingModuleRef = useRef<string | null>(null);
  const clearEdgeSelectionRef = useRef<() => void>(() => undefined);
  useEffect(() => {
    if (pendingModuleRef.current === selectedNodeId) pendingModuleRef.current = null;
    else setActiveModule(null);
  }, [selectedNodeId]);
  const openModuleFor = useCallback((agentId: string, module: { id: AgentModuleId; section?: string; field?: string } | null) => {
    pendingModuleRef.current = agentId;
    setSelectedNodeId(agentId);
    clearEdgeSelectionRef.current();
    setActiveModule(module);
  }, []);
  // Unsaved module edits: clicks that would close the drawer ask first.
  const moduleDirtyRef = useRef(false);
  const handleModuleDirtyChange = useCallback((dirty: boolean) => {
    moduleDirtyRef.current = dirty;
  }, []);
  const confirmLeaveModule = useCallback(async () => {
    if (!moduleDirtyRef.current) return true;
    const ok = await confirm({
      title: 'Discard unsaved changes?',
      description: 'The settings drawer has edits that haven’t been saved.',
      confirmLabel: 'Discard',
      cancelLabel: 'Keep editing',
      destructive: true,
    });
    if (ok) moduleDirtyRef.current = false;
    return ok;
  }, []);
  const [isDirty, setIsDirty] = useState(false);
  // Auto-save: on by default, remembered with the member's workspace preferences
  const [autoSaveEnabled, toggleAutoSave] = useMemberPreference<boolean>(
    AUTO_SAVE_PREF_KEY,
    true,
    (raw) => (typeof raw === 'boolean' ? raw : undefined),
  );
  const [lastSaved, setLastSaved] = useState<{ at: number; auto: boolean } | null>(null);
  /** The edit an auto-save failed on; it waits for a new edit before trying again. */
  const [autoSaveFailedAt, setAutoSaveFailedAt] = useState<string | null>(null);
  const saveKeyRef = useRef('');
  const reactFlowRef = useRef<any>(null);
  // What each step produced in the latest test run — shown on the cards, never saved.
  const [runResults, setRunResults] = useState<Record<string, NodeRunResult>>({});

  const focusNode = useCallback((node: Node) => {
    setTimeout(() => {
      if (reactFlowRef.current && node?.position) {
        const x = node.position.x + 120;
        const y = node.position.y + 60;
        try {
          // Keep the user's zoom level; just bring the node into view
          reactFlowRef.current.setCenter(x, y, { zoom: reactFlowRef.current.getZoom(), duration: 400 });
        } catch (err) {
          console.warn('Could not focus on node', err);
        }
      }
    }, 50);
  }, []);

  // History & Undo / Redo
  // Every graph change is recorded automatically once it settles (no handler has to
  // remember to push). Selection, drag-in-progress and measured sizes are ignored.
  const historyRef = useRef<{ stack: GraphSnapshot[]; index: number; reset: boolean }>({
    stack: [],
    index: -1,
    reset: true,
  });
  const [historyFlags, setHistoryFlags] = useState({ canUndo: false, canRedo: false });
  const syncHistoryFlags = useCallback(() => {
    const { stack, index } = historyRef.current;
    setHistoryFlags({ canUndo: index > 0, canRedo: index < stack.length - 1 });
  }, []);

  useEffect(() => {
    if (nodes.some((n) => n.dragging)) return; // record once the drag ends
    const timer = setTimeout(() => {
      const snapshot = toGraphSnapshot(nodes, edges, { direction: workflowDirection, edgeStyle: workflowEdgeStyle });
      const h = historyRef.current;
      if (h.reset) {
        // Fresh load / restored version: this graph is the new baseline
        historyRef.current = { stack: [snapshot], index: 0, reset: false };
      } else if (h.stack[h.index]?.key !== snapshot.key) {
        const stack = [...h.stack.slice(0, h.index + 1), snapshot].slice(-HISTORY_LIMIT);
        historyRef.current = { stack, index: stack.length - 1, reset: false };
      } else {
        return;
      }
      syncHistoryFlags();
    }, HISTORY_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [nodes, edges, workflowDirection, workflowEdgeStyle, syncHistoryFlags]);

  const graphRef = useRef({ nodes, edges });
  graphRef.current = { nodes, edges };
  const layoutRef = useRef<CanvasLayout>({ direction: workflowDirection, edgeStyle: workflowEdgeStyle });
  layoutRef.current = { direction: workflowDirection, edgeStyle: workflowEdgeStyle };

  const stepHistory = useCallback(
    (direction: -1 | 1) => {
      const h = historyRef.current;
      // Commit an edit that hasn't settled yet, so Undo right after it reverts *it*
      const current = toGraphSnapshot(graphRef.current.nodes, graphRef.current.edges, layoutRef.current);
      if (!h.reset && h.stack[h.index] && h.stack[h.index].key !== current.key) {
        h.stack = [...h.stack.slice(0, h.index + 1), current].slice(-HISTORY_LIMIT);
        h.index = h.stack.length - 1;
      }
      const target = h.stack[h.index + direction];
      if (!target) {
        syncHistoryFlags();
        return;
      }
      h.index += direction;
      setNodes(target.nodes);
      setEdges(target.edges);
      if (target.layout) {
        setWorkflowDirection(target.layout.direction);
        setWorkflowEdgeStyle(target.layout.edgeStyle);
      }
      setIsDirty(true);
      syncHistoryFlags();
    },
    [syncHistoryFlags],
  );
  const undo = useCallback(() => stepHistory(-1), [stepHistory]);
  const redo = useCallback(() => stepHistory(1), [stepHistory]);
  // Toast "Undo" buttons outlive the render that created them; always call the latest undo
  const undoRef = useRef(undo);
  undoRef.current = undo;
  const undoAction = useMemo(() => ({ label: 'Undo', onClick: () => undoRef.current() }), []);

  // Modals & Drawers
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [isTestDrawerOpen, setIsTestDrawerOpen] = useState(false);
  const [isSnapshotDialogOpen, setIsSnapshotDialogOpen] = useState(false);
  const [snapshotChangelog, setSnapshotChangelog] = useState('');
  const [diffModalTarget, setDiffModalTarget] = useState<AgentVersion | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<AgentSettingsDraft | null>(null);
  const [isPublishPopoverOpen, setIsPublishPopoverOpen] = useState(false);
  /** Which header tab menu is open — only one at a time. */
  const [openTabMenu, setOpenTabMenu] = useState<string | null>(null);

  // Command palette, template export & presentation mode
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isTemplateExportOpen, setIsTemplateExportOpen] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);

  // Canvas clipboard state
  const clipboardRef = useRef<{ nodes: Node[]; edges: Edge[] } | null>(null);
  const [hasClipboard, setHasClipboard] = useState(false);

  // Edge data flow inspector state
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  clearEdgeSelectionRef.current = () => setSelectedEdgeId(null);
  const selectedEdge = useMemo(
    () => (selectedEdgeId ? edges.find((e) => e.id === selectedEdgeId) ?? null : null),
    [edges, selectedEdgeId],
  );

  // Edge split & empty-space drop contexts
  const [edgeSplitContext, setEdgeSplitContext] = useState<{
    edge: Edge;
    position: { x: number; y: number };
  } | null>(null);
  const [dropContext, setDropContext] = useState<{
    position: { x: number; y: number };
    fromNode: Node;
    fromHandle?: string;
  } | null>(null);
  const [isCatalogModalOpen, setIsCatalogModalOpen] = useState(false);

  // Inline rename state in canvas header
  const [isEditingHeaderName, setIsEditingHeaderName] = useState(false);
  const [headerNameInput, setHeaderNameInput] = useState('');

  // Settings category, tag input & avatar mode state
  const [isCreatingCustomCategory, setIsCreatingCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [tagInput, setTagInput] = useState('');

  const agentQueryKey = ['agent-detail', activeWorkspace.id, agentId];

  // Fetch Agent Details
  const {
    data: agent,
    isLoading: isAgentLoading,
    isError: isAgentError,
    error: agentError,
    refetch: refetchAgent,
  } = useQuery({
    queryKey: agentQueryKey,
    queryFn: async () => {
      if (!agentId) throw new Error('Agent ID required');
      return agentsApi.get(activeWorkspace.id, agentId);
    },
    enabled: !!agentId && !!activeWorkspace.id,
  });

  // The server only lets an agent's creator or a workspace admin change it. Mirror
  // that here so everyone else gets a read-only canvas up front, not a 403 on save.
  const canManage = !agent || canManageOwnedAIResource(agent.creatorId, { userId: user.id, permissions: activeWorkspace.permissions });
  const isCanvasLocked = canvasLockToggled || !canManage;

  // Fetch Agent Executions
  const { data: executions = [] } = useQuery({
    queryKey: ['agent-executions', activeWorkspace.id, agentId],
    queryFn: async () => (agentId ? agentsApi.logs(activeWorkspace.id, agentId) : []),
    enabled: activeTab === 'executions' && !!agentId,
  });

  // Fetch Agent Versions
  const { data: versions = [], refetch: refetchVersions } = useQuery({
    queryKey: ['agent-versions', activeWorkspace.id, agentId],
    queryFn: async (): Promise<AgentVersion[]> => {
      if (!agentId) return [];
      return (await agentsApi.getVersions(activeWorkspace.id, agentId)) ?? [];
    },
    enabled: !!agentId,
  });

  const isPublished =
    (agent?.configuration as { status?: string } | undefined)?.status === 'published';

  // Determine the next version number to publish
  const targetPublishVersion = useMemo(() => {
    if (!versions || versions.length === 0) {
      return isPublished ? 'v2.0' : 'v1.0';
    }
    const maxVerNum = versions.reduce((max, v) => Math.max(max, Number(v.version) || 0), 0);
    const latest = versions.find((v) => v.version === maxVerNum) || versions[0];
    const isLatestPublished =
      latest?.status?.toUpperCase() === 'PUBLISHED' || isPublished;

    if (isLatestPublished) {
      return `v${(maxVerNum || 1) + 1}.0`;
    }
    return `v${maxVerNum || 1}.0`;
  }, [versions, isPublished]);

  // The version that is actually live (not the one the next publish would create)
  const liveVersionTag = useMemo(() => {
    const published = versions.filter((v) => v.status?.toUpperCase() === 'PUBLISHED');
    if (published.length === 0) return null;
    const latest = published.reduce((a, b) => (Number(b.version) > Number(a.version) ? b : a));
    return latest.versionTag ?? `v${latest.version}`;
  }, [versions]);

  // `curl` for the execute endpoint, built from the API base URL the app is really using
  const apiCurlSnippet = (promptText: string) => {
    // Same route and body the Deploy tab documents; the key is created there.
    const prompt = JSON.stringify(promptText).replace(/'/g, "'\\''");
    return `curl -X POST "${deploymentApiBase()}/agents/${agentId}/execute" \\
  -H "Authorization: Bearer YOUR_AGENT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": ${prompt}}'`;
  };

  // Hydrate the canvas and the settings form whenever the stored agent changes.
  // Other saves (Memory/Widget tabs, header rename) refetch the agent too; those must
  // not wipe unsaved canvas/settings edits. Only a version restore forces a reload.
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;
  // The settings form as loaded — what "changed" is measured against when saving.
  const settingsBaselineRef = useRef<AgentSettingsDraft | null>(null);
  const forceHydrateRef = useRef(false);
  useEffect(() => {
    if (!agent) return;
    if (isDirtyRef.current && !forceHydrateRef.current) {
      // Keep local edits; still reflect a name change made from the header
      setSettingsDraft((draft) => (draft ? { ...draft, name: agent.name } : draft));
      return;
    }
    forceHydrateRef.current = false;
    const graph = parseGraph(agent.graphJson);
    if (graph) {
      if (graph.layout?.direction) {
        setWorkflowDirection(graph.layout.direction);
      }
      if (graph.layout?.edgeStyle) {
        setWorkflowEdgeStyle(graph.layout.edgeStyle);
      }
      setLayoutPrefs({
        arrange: graph.layout?.arrange ?? DEFAULT_LAYOUT_PREFS.arrange,
        spacing: graph.layout?.spacing ?? DEFAULT_LAYOUT_PREFS.spacing,
      });
      setGraphSettings(graph.settings);
      // A save round-trip returns the graph already on the canvas — leave it (and the
      // undo history) alone. Only a different graph (first load, restored version)
      // replaces the canvas and becomes the new undo baseline.
      const incoming = toGraphSnapshot(graph.nodes, graph.edges);
      const onCanvas = toGraphSnapshot(graphRef.current.nodes, graphRef.current.edges);
      if (incoming.key !== onCanvas.key) {
        setNodes(graph.nodes);
        setEdges(graph.edges);
        historyRef.current.reset = true;
        setCanvasEpoch((n) => n + 1);
      }
    }
    const config = (agent.configuration || {}) as any;
    const hydrated: AgentSettingsDraft = {
      name: agent.name,
      role: agent.role || 'Autonomous Specialist',
      description: agent.description ?? '',
      model: agent.model || 'gpt-4o',
      category: config.category || 'Customer Support',
      theme: config.theme || 'emerald',
      icon: config.icon || 'Bot',
      // One identity value — a photo or `icon:<icon>:<color>` — folding in what older agents kept in configuration.
      avatar: aiEntityAvatarFromLegacy(agent.avatarUrl, config) ?? formatAiEntityIconAvatar(config.icon || 'bot', config.theme || 'emerald'),
      tags: Array.isArray(config.tags) ? config.tags : ['support', 'autonomous'],
      ownerName: config.owner?.name || '',
      ownerEmail: config.owner?.email || '',
      runtime: {
        pii: config.runtime?.guardrails?.pii,
        maxTokensPerRun: config.runtime?.guardrails?.maxTokensPerRun,
        autonomy: config.runtime?.autonomy,
      },
    };
    settingsBaselineRef.current = hydrated;
    setSettingsDraft(hydrated);
    setHeaderNameInput(agent.name);
    setIsDirty(false);
  }, [agent]);

  const updateSettings = (patch: Partial<AgentSettingsDraft>) => {
    setSettingsDraft((draft) => (draft ? { ...draft, ...patch } : draft));
    setIsDirty(true);
  };

  const availableCategories = useMemo(() => {
    const set = new Set<string>(DEFAULT_CATEGORIES);
    if (settingsDraft?.category) {
      set.add(settingsDraft.category);
    }
    return Array.from(set);
  }, [settingsDraft?.category]);

  const handleSaveHeaderName = async () => {
    const trimmed = headerNameInput.trim();
    const current = settingsDraft?.name ?? agent?.name;
    setIsEditingHeaderName(false);
    if (!trimmed || !agentId || trimmed === current) {
      setHeaderNameInput(current ?? '');
      return;
    }
    // Optimistic: show the new name right away, roll back if the server rejects it
    setSettingsDraft((draft) => (draft ? { ...draft, name: trimmed } : draft));
    try {
      await agentsApi.update(activeWorkspace.id, agentId, { name: trimmed });
      queryClient.invalidateQueries({ queryKey: agentQueryKey });
      queryClient.invalidateQueries({ queryKey: ['agents', activeWorkspace.id] });
      toast.success('Agent renamed');
    } catch (err) {
      setSettingsDraft((draft) => (draft ? { ...draft, name: current ?? draft.name } : draft));
      setHeaderNameInput(current ?? '');
      toast.error(errorMessage(err, 'Could not rename the agent'));
    }
  };

  const handleAddTag = () => {
    const trimmed = tagInput.trim().toLowerCase();
    if (!trimmed) return;
    const currentTags = settingsDraft?.tags || [];
    if (!currentTags.includes(trimmed)) {
      updateSettings({ tags: [...currentTags, trimmed] });
    }
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = settingsDraft?.tags || [];
    updateSettings({ tags: currentTags.filter((t) => t !== tagToRemove) });
  };

  const handleCreateCustomCategory = () => {
    const trimmed = customCategoryInput.trim();
    if (!trimmed) return;
    updateSettings({ category: trimmed });
    setCustomCategoryInput('');
    setIsCreatingCustomCategory(false);
    toast.success(`Category "${trimmed}" added`);
  };

  /** Everything a save writes, as one string — tells whether an edit landed while a save was in flight. */
  const saveKey = useMemo(
    () =>
      JSON.stringify([
        toGraphSnapshot(nodes.map(withoutRunStatus), edges).key,
        settingsDraft,
        graphSettings,
        workflowDirection,
        workflowEdgeStyle,
        layoutPrefs,
      ]),
    [nodes, edges, settingsDraft, graphSettings, workflowDirection, workflowEdgeStyle, layoutPrefs],
  );
  saveKeyRef.current = saveKey;

  /** Persists the canvas (or the given graph) and the settings form in one request. */
  const persistAgent = async (graph?: { nodes: Node[]; edges: Edge[] }) => {
    if (!agentId) return;
    const config = (agent?.configuration || {}) as any;
    const current = graph ?? { nodes, edges };
    const patch: any = {
      // A run's live status rings are view state, not part of the graph.
      graphJson: JSON.stringify({
        nodes: current.nodes.map(withoutRunStatus),
        edges: current.edges,
        ...(graphSettingsRef.current ? { settings: graphSettingsRef.current } : {}),
        layout: {
          direction: workflowDirection,
          edgeStyle: workflowEdgeStyle,
          ...layoutPrefs,
        },
      }),
      ...(settingsDraft
        ? {
            name: settingsDraft.name.trim() || agent?.name,
            role: settingsDraft.role?.trim() || agent?.role,
            description: settingsDraft.description,
            avatarUrl: settingsDraft.avatar || null,
          }
        : {}),
    };
    // `model` and `configuration` are plan-gated on the server even when unchanged,
    // so they're only sent when they really changed — a canvas or name edit saves on every plan.
    if (settingsDraft) {
      const configuration: Record<string, unknown> = {
        ...config,
        category: settingsDraft.category,
        theme: settingsDraft.theme,
        icon: settingsDraft.icon,
        avatar: settingsDraft.avatar.startsWith('icon:') ? '' : settingsDraft.avatar,
        tags: settingsDraft.tags,
        owner: {
          name: settingsDraft.ownerName,
          email: settingsDraft.ownerEmail,
        },
      };
      const runtimeEdit = settingsDraft.runtime;
      const baseline = settingsBaselineRef.current;
      if (!baseline || JSON.stringify(runtimeEdit) !== JSON.stringify(baseline.runtime)) {
        // Only what the form owns is overwritten; the rest of the saved runtime stays.
        const savedRuntime = (config.runtime ?? {}) as { guardrails?: Record<string, unknown> } & Record<string, unknown>;
        const guardrails = { ...(savedRuntime.guardrails ?? {}) };
        if (runtimeEdit.pii) guardrails.pii = runtimeEdit.pii;
        else delete guardrails.pii;
        if (runtimeEdit.maxTokensPerRun) guardrails.maxTokensPerRun = runtimeEdit.maxTokensPerRun;
        else delete guardrails.maxTokensPerRun;
        configuration.runtime = {
          ...savedRuntime,
          version: 1,
          ...(runtimeEdit.autonomy ? { autonomy: runtimeEdit.autonomy } : {}),
          guardrails,
        };
      }
      if (!baseline || settingsDraft.model !== baseline.model) patch.model = settingsDraft.model;
      const configKeys = ['category', 'theme', 'icon', 'avatar', 'tags', 'ownerName', 'ownerEmail', 'runtime'] as const;
      if (!baseline || configKeys.some((k) => JSON.stringify(settingsDraft[k]) !== JSON.stringify(baseline[k]))) {
        patch.configuration = configuration;
      }
    }
    // No local fallback: a save that didn't reach the server must say so.
    const savingKey = saveKeyRef.current;
    await agentsApi.update(activeWorkspace.id, agentId, patch);
    queryClient.invalidateQueries({ queryKey: agentQueryKey });
    queryClient.invalidateQueries({ queryKey: ['agents', activeWorkspace.id] });
    // An edit made while this was saving isn't in it — stay unsaved for the next save
    if (graph || saveKeyRef.current === savingKey) setIsDirty(false);
  };

  /** The canvas as the Copilot reads it: run status rings left out. */
  const copilotGraph = useMemo<StudioCanvasGraph>(
    () => ({
      nodes: nodes.map((n) => {
        const clean = withoutRunStatus(n);
        const data = (clean.data ?? {}) as Record<string, unknown>;
        return {
          id: clean.id,
          type: String(clean.type ?? ''),
          position: clean.position,
          data: { ...data, label: typeof data['label'] === 'string' ? data['label'] : String(clean.type ?? ''), config: (data['config'] as Record<string, unknown>) ?? {} },
        };
      }),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null, ...(typeof e.label === 'string' ? { label: e.label } : {}) })),
    }),
    [nodes, edges],
  );

  /**
   * Puts a Copilot change on the canvas, saves it and records a version named
   * after it. A change that adds or removes steps is laid out again.
   */
  const applyCopilotGraph = useCallback(
    async (graph: StudioCanvasGraph, summary: string): Promise<number | undefined> => {
      if (!agentId) return undefined;
      const diff = diffStudioGraphs(copilotGraph, graph);
      const nextEdges = graph.edges as unknown as Edge[];
      const placed = graph.nodes as unknown as Node[];
      const layoutDir = workflowDirection === 'vertical' ? 'TB' : 'LR';
      const nextNodes =
        diff.added.length || diff.removed.length
          ? layoutWorkflow(withMeasuredSizes(placed, measuredSizeRef.current), nextEdges, { direction: layoutDir, ...layoutPrefs })
          : placed;
      const previous = { nodes: graphRef.current.nodes, edges: graphRef.current.edges };
      setNodes(nextNodes);
      setEdges(nextEdges);
      try {
        // Only the graph: the Copilot changes nothing else, and the settings
        // form's fields (model, configuration) are plan-gated on some tiers.
        await agentsApi.update(activeWorkspace.id, agentId, {
          graphJson: JSON.stringify({
            nodes: nextNodes.map(withoutRunStatus),
            edges: nextEdges,
            ...(graphSettingsRef.current ? { settings: graphSettingsRef.current } : {}),
            layout: { direction: workflowDirection, edgeStyle: workflowEdgeStyle, ...layoutPrefs },
          }),
        });
      } catch (err) {
        // Not saved, so not on the canvas either.
        setNodes(previous.nodes);
        setEdges(previous.edges);
        throw err;
      }
      queryClient.invalidateQueries({ queryKey: agentQueryKey });
      const version = await agentsApi.createVersion(activeWorkspace.id, agentId, summary);
      queryClient.invalidateQueries({ queryKey: ['agent-versions', activeWorkspace.id, agentId] });
      return (version as { version?: number } | undefined)?.version;
    },
    // agentQueryKey is rebuilt every render from these same ids.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agentId, activeWorkspace.id, copilotGraph, queryClient, workflowDirection, workflowEdgeStyle, layoutPrefs],
  );

  // `?test=1` (from "Create with one prompt") opens the run console once the agent is loaded.
  const openedTest = useRef(false);
  useEffect(() => {
    if (openedTest.current || !agent || searchParams.get('test') !== '1') return;
    openedTest.current = true;
    setIsTestDrawerOpen(true);
  }, [agent, searchParams]);

  /** Shows a run's progress on the canvas (null clears it) without marking the graph edited. */
  /**
   * A step's latest result for its card. An Output step passes its input
   * through, so it shows what flowed into it when it has nothing of its own.
   */
  const resultFor = (n: Node): NodeRunResult | undefined => {
    const own = runResults[n.id];
    if (String(n.type).toUpperCase() !== 'END' || (own && (own.output || own.error || own.cleared))) return own;
    const upstream = runResults[edges.find((e) => e.target === n.id && !isAttachmentEdge(e))?.source ?? ''];
    if (!upstream) return own;
    return { ...upstream, status: own?.status ?? upstream.status, latencyMs: own?.latencyMs ?? 0, tokens: own?.tokens ?? 0 };
  };

  const showRunStatuses = useCallback((statuses: Record<string, CanvasNodeStatus> | null) => {
    // The console stopped watching (closed): don't leave cards saying "Running…".
    if (!statuses) {
      setRunResults((r) =>
        Object.values(r).some((x) => x.status === 'running')
          ? Object.fromEntries(Object.entries(r).map(([k, x]) => [k, x.status === 'running' ? { ...x, status: 'idle' as const } : x]))
          : r,
      );
    }
    setNodes((current) =>
      current.map((n) => {
        const status = statuses?.[n.id] ?? 'idle';
        return (n.data as { status?: string }).status === status || (!statuses && !(n.data as { status?: string }).status)
          ? n
          : { ...n, data: { ...n.data, status } };
      }),
    );
  }, []);

  const errorMessage = (err: unknown, fallback: string) =>
    err instanceof Error && err.message ? err.message : fallback;

  // Mutations — an auto-save is silent unless it fails; Ctrl+S / Save confirms with a toast
  const saveMutation = useMutation({
    mutationFn: (_opts: { auto?: boolean } | void) => persistAgent(),
    onSuccess: (_data, opts) => {
      setLastSaved({ at: Date.now(), auto: isAutoSave(opts) });
      setAutoSaveFailedAt(null);
      if (!isAutoSave(opts)) toast.success('Agent saved');
      queryClient.invalidateQueries({ queryKey: agentQueryKey });
    },
    onError: (err, opts) => {
      if (isAutoSave(opts)) {
        // Don't retry in a loop: wait for the next edit (or Save now)
        setAutoSaveFailedAt(saveKeyRef.current);
        toast.error('Auto-save failed — your changes are still here', {
          description: errorMessage(err, 'The server didn’t accept the save.'),
        });
        return;
      }
      toast.error(errorMessage(err, 'Failed to save the agent'));
    },
  });

  /**
   * Runs, publishes and snapshots all read the *stored* graph. An agent that was never
   * saved from the canvas (seeded, or created before the canvas existed) only has the
   * default scaffold in memory — not dirty, yet not stored — so save that too.
   */
  const saveIfNeeded = async () => {
    if (isDirty || !isStudioGraph(agent?.graphJson)) await persistAgent();
  };

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!agentId) return;
      // Publishing validates and snapshots the stored graph — save first.
      await saveIfNeeded();
      return agentsApi.publish(
        activeWorkspace.id,
        agentId,
        `Published version ${targetPublishVersion}`,
      );
    },
    onSuccess: () => {
      toast.success(`Published update ${targetPublishVersion} successfully`);
      queryClient.invalidateQueries({ queryKey: agentQueryKey });
      queryClient.invalidateQueries({ queryKey: ['agent-versions', activeWorkspace.id, agentId] });
      queryClient.invalidateQueries({ queryKey: ['workspace-agents'] });
      refetchVersions();
    },
    onError: (err) => {
      toast.error(errorMessage(err, 'Failed to publish update'));
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: async () => {
      if (!agentId) return;
      await agentsApi.unpublish(activeWorkspace.id, agentId);
    },
    onSuccess: () => {
      toast.success('Agent unpublished');
      queryClient.invalidateQueries({ queryKey: agentQueryKey });
      queryClient.invalidateQueries({ queryKey: ['agent-versions', activeWorkspace.id, agentId] });
      queryClient.invalidateQueries({ queryKey: ['workspace-agents'] });
      refetchVersions();
    },
    onError: (err) => {
      toast.error(errorMessage(err, 'Failed to unpublish agent'));
    },
  });

  const createSnapshotMutation = useMutation({
    mutationFn: async () => {
      if (!agentId) return;
      // A snapshot captures the stored graph, so include unsaved edits.
      await saveIfNeeded();
      return agentsApi.createVersion(
        activeWorkspace.id,
        agentId,
        snapshotChangelog.trim() || 'Workflow iteration snapshot',
      );
    },
    onSuccess: () => {
      toast.success('Version snapshot created');
      setIsSnapshotDialogOpen(false);
      setSnapshotChangelog('');
      refetchVersions();
    },
    onError: (err) => {
      toast.error(errorMessage(err, 'Failed to create a snapshot'));
    },
  });

  const restoreVersionMutation = useMutation({
    mutationFn: async (versionNumber: number) => {
      if (!agentId) return;
      return agentsApi.restoreVersion(activeWorkspace.id, agentId, versionNumber);
    },
    onSuccess: () => {
      toast.success('Version restored');
      // Replace the canvas even if it had unsaved edits (the user confirmed that), then show it
      forceHydrateRef.current = true;
      refetchAgent();
      setActiveTab('build');
    },
    onError: (err) => {
      toast.error(errorMessage(err, 'Failed to restore that version'));
    },
  });

  // What the live environment lacks for what is on the canvas — an app that isn't connected,
  // a tool the platform doesn't have, a model with no key. Re-checked shortly after edits
  // settle and when the tab is refocused (e.g. after connecting an app in Integrations).
  const readinessGraph = useMemo(
    () =>
      JSON.stringify({
        nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: { x: 0, y: 0 }, data: { label: (n.data as any)?.label, config: (n.data as any)?.config ?? {} } })),
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null })),
      }),
    [nodes, edges],
  );
  const [settledGraph, setSettledGraph] = useState(readinessGraph);
  useEffect(() => {
    const t = setTimeout(() => setSettledGraph(readinessGraph), 1200);
    return () => clearTimeout(t);
  }, [readinessGraph]);
  const { data: readiness } = useQuery({
    queryKey: ['agent-readiness', activeWorkspace.id, agentId, settledGraph],
    queryFn: async () => (await agentsApi.validate(activeWorkspace.id, agentId as string, settledGraph)).checks ?? [],
    enabled: !!agentId && nodes.length > 0,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
  const readinessIssues = useMemo<StudioGraphIssue[]>(
    () => (readiness ?? []).map((c) => ({ nodeId: c.nodeId, level: c.level, message: c.message })),
    [readiness],
  );

  // Live problems per step, from the same compiler the server runs before a run —
  // so "pick a knowledge base" shows on the card, not only after pressing Validate.
  const issuesByNode = useMemo(() => {
    const out = new Map<string, StudioGraphIssue[]>();
    for (const issue of readinessIssues) {
      if (issue.nodeId) out.set(issue.nodeId, [...(out.get(issue.nodeId) ?? []), issue]);
    }
    try {
      const compiled = compileStudioGraph({
        nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: { label: (n.data as any)?.label, config: (n.data as any)?.config ?? {} } })),
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null })),
      } as unknown as Record<string, unknown>);
      for (const issue of compiled.issues) {
        if (!issue.nodeId) continue;
        out.set(issue.nodeId, [...(out.get(issue.nodeId) ?? []), issue]);
      }
    } catch {
      // A graph the compiler can't read yet (mid-edit) simply shows no badges.
    }
    return out;
  }, [nodes, edges, readinessIssues]);

  // Unified issues for header WorkflowHealthBadge
  const allWorkflowIssues = useMemo<WorkflowIssue[]>(() => {
    try {
      const compiled = compileStudioGraph({
        nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: { label: (n.data as any)?.label, config: (n.data as any)?.config ?? {} } })),
        edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle ?? null })),
      } as unknown as Record<string, unknown>);
      return [...compiled.issues, ...readinessIssues].map((iss) => ({
        level: iss.level === 'error' ? 'error' : 'warning',
        message: iss.message,
        nodeId: iss.nodeId,
      }));
    } catch {
      return [];
    }
  }, [nodes, edges, readinessIssues]);

  useEffect(() => {
    if (saveRequest === 0 || saveMutation.isPending) return;
    saveMutation.mutate();
    // Only when a drawer asks; the latest graph is already in this render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveRequest]);

  // Auto-save the draft once edits settle (not mid-drag, not while locked, not
  // again after a failure until something changes)
  useEffect(() => {
    if (!autoSaveEnabled || !isDirty || saveMutation.isPending || publishMutation.isPending || isCanvasLocked) return;
    if (nodes.some((n) => n.dragging)) return;
    if (autoSaveFailedAt !== null && autoSaveFailedAt === saveKey) return;

    const timer = setTimeout(() => {
      saveMutation.mutate({ auto: true });
    }, AUTO_SAVE_DELAY_MS);

    return () => clearTimeout(timer);
    // saveMutation is a new object each render; its pending flag is what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSaveEnabled, isDirty, saveKey, saveMutation.isPending, publishMutation.isPending, isCanvasLocked, autoSaveFailedAt]);

  // The server's last write, until this visit saves for itself
  const agentUpdatedAt = (agent as { updatedAt?: string } | undefined)?.updatedAt;
  useEffect(() => {
    const at = agentUpdatedAt ? Date.parse(agentUpdatedAt) : NaN;
    if (!Number.isNaN(at)) setLastSaved((prev) => prev ?? { at, auto: false });
  }, [agentUpdatedAt]);

  const now = useNow(lastSaved?.at ?? null);
  const saveFailed = isDirty && !saveMutation.isPending && (saveMutation.isError || (autoSaveFailedAt !== null && autoSaveFailedAt === saveKey));
  const saveStatusText = saveMutation.isPending
    ? 'Saving your changes…'
    : saveFailed
      ? 'Your last changes didn’t save'
      : isDirty
        ? autoSaveEnabled
          ? 'Unsaved edits — saving when you pause'
          : 'Unsaved changes'
        : lastSaved
          ? `${lastSaved.auto ? 'Auto-saved' : 'Saved'} ${savedAgo(lastSaved.at, now)}`
          : 'All changes saved';

  const stepIds = useMemo(() => nodes.map((n) => n.id), [nodes]);

  // What's plugged into each agent slot: agents get per-slot summaries for their
  // rows, attached nodes get an "LLM · Agent 1" chip.
  const hostModel = (agent as { model?: string | null } | undefined)?.model || undefined;
  const slotDecorations = useMemo(() => {
    const out = new Map<string, Record<string, unknown>>();
    for (const host of nodes) {
      if (!isSlotHost(host.type)) continue;
      const attached = slotAttachments(host.id, nodes, edges);
      const slots: Record<string, { id: string; label: string; connectorId?: string }[]> = {};
      for (const [slotId, list] of Object.entries(attached)) {
        slots[slotId] = list.map((n) => {
          const cfg = ((n.data as any)?.config ?? {}) as Record<string, unknown>;
          const app = cfg['connectorId'] ?? cfg['provider'];
          return {
            id: n.id,
            label: slotRowLabel(slotId, n),
            // App actions show their app's logo on the agent's Tools row
            ...(typeof app === 'string' && app ? { connectorId: app.toLowerCase().replace(/-/g, '_') } : {}),
          };
        });
        for (const n of list) {
          out.set(n.id, {
            attachedTo: { label: String(host.data?.label || 'Agent'), slot: getSlot(slotId)?.label ?? slotId },
          });
        }
      }
      const supervised = Boolean(supervisorOf(host.id, edges));
      const leads = attached.agents.length > 0;
      const modules = readAgentModules(host, nodes, edges, graphSettings);
      out.set(host.id, {
        ...out.get(host.id),
        slots,
        moduleSummaries: summarizeAgentModules(modules, { issuesByNode, stepIds, modelLabel: (m) => String(modelLabel(m)) }),
        promptPreview: modules.prompt.text.slice(0, 240),
        builtinTools: modules.tools.entries.filter((t) => t.kind === 'builtin').map((t) => t.toolName),
        // Apps given as tool-list entries (no card on the canvas) still show their logo.
        toolApps: [...new Set(modules.tools.entries.filter((t) => t.kind === 'connector' && !t.nodeId && t.provider).map((t) => t.provider!.toLowerCase()))],
        team: {
          role: leads && supervised ? 'lead' : leads ? 'supervisor' : supervised ? 'member' : 'solo',
          issues: agentIssues(host, nodes, edges),
          // A step with no model runs on the saved agent's own, so show that rather than "Choose a model".
          model: resolveAgentModel(host.id, nodes, edges) ?? (hostModel ? { model: hostModel, inherited: true } : null),
        },
      });
    }
    return out;
  }, [nodes, edges, graphSettings, issuesByNode, stepIds, hostModel]);

  // Connection labels and the "flowing" animation are saved on the edge's data
  const [editingEdgeLabelId, setEditingEdgeLabelId] = useState<string | null>(null);

  const updateEdgeData = useCallback((edgeId: string, patch: Record<string, unknown>) => {
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id !== edgeId) return e;
        const data = { ...(e.data ?? {}), ...patch };
        for (const key of Object.keys(patch)) if (patch[key] === undefined) delete data[key];
        return { ...e, data };
      }),
    );
    setIsDirty(true);
  }, []);

  const handleRenameEdgeLabel = useCallback(
    (edgeId: string, label: string) => {
      setEditingEdgeLabelId(null);
      updateEdgeData(edgeId, { label: label || undefined });
    },
    [updateEdgeData],
  );

  const handleToggleEdgeAnimated = useCallback(
    (edge: Edge) => updateEdgeData(edge.id, { animated: (edge.data as any)?.animated === true ? undefined : true }),
    [updateEdgeData],
  );

  /** Jump to a node from the agent outline. */
  const handleFocusNodeById = useCallback((nodeId: string) => {
    setNodes((nds) => nds.map((n) => (n.selected === (n.id === nodeId) ? n : { ...n, selected: n.id === nodeId })));
    reactFlowRef.current?.fitView({ nodes: [{ id: nodeId }], duration: 350, maxZoom: 1.1, padding: 0.6 });
  }, []);

  // ReactFlow Event Handlers
  // React Flow also reports selection and measured sizes as "changes"; only
  // real edits (move, add, remove…) should light the unsaved indicator.
  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((nds) => applyNodeChanges(changes, nds));
      if (changes.some((c) => c.type !== 'select' && c.type !== 'dimensions')) {
        setIsDirty(true);
      }
      // Keyboard Delete / Backspace goes through here rather than handleDeleteNodes
      const removed = changes.filter((c) => c.type === 'remove').length;
      if (removed > 0) {
        toast(removed === 1 ? 'Node deleted' : `${removed} nodes deleted`, { action: undoAction });
      }
    },
    [undoAction],
  );

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
    if (changes.some((c) => c.type !== 'select')) setIsDirty(true);
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    const refusal = slotConnectionError(connection, graphRef.current.nodes, graphRef.current.edges);
    if (refusal) {
      toast.error(refusal);
      return;
    }
    setEdges((eds) => {
      // Agent slots: a second Prompt / LLM replaces the first instead of stacking
      if (getSlot(connection.sourceHandle)) {
        return withSlotConnection(eds, {
          ...connection,
          id: `e-${connection.source}-${connection.sourceHandle}-${connection.target}-${Date.now().toString(36)}`,
        } as Edge);
      }
      return addEdge({ ...connection, animated: true }, eds);
    });
    setIsDirty(true);
  }, []);

  const onNodeClick = useCallback(async (_: React.MouseEvent, node: Node) => {
    if (node.id !== selectedNodeId && !(await confirmLeaveModule())) return;
    setSelectedNode(node);
    setSelectedEdgeId(null);
  }, [setSelectedNode, selectedNodeId, confirmLeaveModule]);

  const onPaneClick = useCallback(async () => {
    if (!(await confirmLeaveModule())) return;
    setSelectedNode(null);
    setSelectedEdgeId(null);
  }, [setSelectedNode, confirmLeaveModule]);

  const handleUpdateNode = useCallback((nodeId: string, updatedData: any) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...updatedData } } : n)),
    );
    setIsDirty(true);
  }, []);

  /** Merge into a node's config from the latest state (inline editors fire in quick succession). */
  const handleUpdateNodeConfig = useCallback((nodeId: string, patch: Record<string, unknown>) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, config: { ...((n.data as any)?.config || {}), ...patch } } }
          : n,
      ),
    );
    setIsDirty(true);
  }, []);

  /** A module drawer's Save: its draft configs (and run limits) into the graph. */
  const handleApplyModuleDraft = useCallback((draft: ModuleDraft) => {
    if (Object.keys(draft.configs).length > 0) {
      setNodes((nds) =>
        nds.map((n) => (draft.configs[n.id] ? { ...n, data: { ...n.data, config: draft.configs[n.id] } } : n)),
      );
    }
    if (draft.graphSettings !== undefined) setGraphSettings(draft.graphSettings);
    setIsDirty(true);
  }, []);

  const handleDeleteNodes = useCallback(
    (nodeIds: string[]) => {
      if (nodeIds.length === 0) return;
      const ids = new Set(nodeIds);
      setNodes((nds) => nds.filter((n) => !ids.has(n.id)));
      setEdges((eds) => eds.filter((e) => !ids.has(e.source) && !ids.has(e.target)));
      // The inspector closes on its own: selectedNode is derived from `nodes`
      setIsDirty(true);
      toast(nodeIds.length === 1 ? 'Node deleted' : `${nodeIds.length} nodes deleted`, {
        action: undoAction,
      });
    },
    [undoAction],
  );
  const handleDeleteNode = useCallback((nodeId: string) => handleDeleteNodes([nodeId]), [handleDeleteNodes]);

  const handleAddNode = useCallback(
    (node: Node, options?: { silent?: boolean }) => {
      const withSelected: Node = {
        ...node,
        selected: true,
      };
      setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), withSelected]);
      setSelectedNode(withSelected);
      setIsDirty(true);
      focusNode(node);
      if (!options?.silent) toast.success(`Added "${node.data?.label || 'Node'}"`);
    },
    [focusNode, setSelectedNode],
  );

  const handleConnectNextNode = useCallback(
    (sourceNode: Node, item: any, handleId?: string, options?: { select?: boolean }) => {
      const select = options?.select !== false;
      const newNodeId = `${item.type.toLowerCase()}-${Date.now().toString(36)}`;
      const slot = isSlotHost(sourceNode.type) ? getSlot(handleId) : undefined;
      let xPos = sourceNode.position.x + 320;
      let yPos = sourceNode.position.y;
      if (slot) {
        ({ x: xPos, y: yPos } = attachmentPosition(sourceNode, nodes, edges));
      } else if (isSlotHost(sourceNode.type)) {
        if (workflowDirection === 'vertical') {
          xPos = sourceNode.position.x;
          yPos = sourceNode.position.y + (sourceNode.measured?.height ?? 300) + 100;
        } else {
          // Attachments hang below an agent, so its next step simply goes to its right
          xPos = sourceNode.position.x + (sourceNode.measured?.width ?? 290) + 120;
        }
      } else if (workflowDirection === 'vertical') {
        if (handleId === 'false') {
          xPos += 140;
          yPos += 180;
        } else if (handleId === 'true') {
          xPos -= 140;
          yPos += 180;
        } else {
          xPos = sourceNode.position.x;
          yPos = sourceNode.position.y + 180;
        }
      } else if (handleId === 'false') {
        yPos += 90;
      } else if (handleId === 'true') {
        yPos -= 50;
      }

      const newNode: Node = {
        id: newNodeId,
        type: item.type,
        position: { x: xPos, y: yPos },
        data: {
          title: item.label,
          label: item.label,
          description: item.subtitle || item.description || '',
          subtitle: item.subtitle || item.description || '',
          config: item.defaultConfig || {},
        },
        selected: select,
      };

      const newEdge: Edge = {
        id: `e-${sourceNode.id}-${newNodeId}-${Date.now().toString(36)}`,
        source: sourceNode.id,
        target: newNodeId,
        sourceHandle: handleId || undefined,
        animated: true,
      };

      setNodes((nds) => [
        ...nds.map((n) => {
          const selected = select ? false : n.selected;
          return { ...n, selected };
        }),
        newNode,
      ]);
      setEdges((eds) => (slot ? withSlotConnection(eds, { ...newEdge, animated: false }) : [...eds, newEdge]));
      if (select) {
        setSelectedNode(newNode);
        focusNode(newNode);
      }
      setIsDirty(true);
      toast.success(
        slot
          ? `${item.label} plugged into ${sourceNode.data?.label || 'agent'} → ${slot.label}`
          : `Connected "${item.label}" to "${sourceNode.data?.label || 'Node'}"`,
      );
    },
    [focusNode, nodes, edges, workflowDirection, setSelectedNode],
  );

  /** Opens a node's panel (optionally at one of its modules), asking first if a drawer has unsaved edits. */
  const requestOpenModule = useCallback(
    async (nodeId: string, module: { id: AgentModuleId; section?: string; field?: string } | null) => {
      if (nodeId !== selectedNodeId && !(await confirmLeaveModule())) return;
      openModuleFor(nodeId, module);
    },
    [selectedNodeId, confirmLeaveModule, openModuleFor],
  );

  /** What a module drawer may change on the canvas for the agent it is showing. */
  const moduleActions = useMemo<ModuleActions | undefined>(() => {
    if (!selectedNode || !isSlotHost(selectedNode.type)) return undefined;
    const agentNode = selectedNode;
    return {
      attach: (item, slot) => handleConnectNextNode(agentNode, item, slot, { select: false }),
      deleteNode: (nodeId) => handleDeleteNode(nodeId),
      detach: (targetId, slot) => {
        setEdges((eds) => eds.filter((e) => !(e.source === agentNode.id && e.target === targetId && e.sourceHandle === slot)));
        setIsDirty(true);
        toast('Unplugged from the agent', { action: undoAction });
      },
      connect: (targetId, slot) => onConnect({ source: agentNode.id, sourceHandle: slot, target: targetId, targetHandle: null }),
      selectNode: (nodeId, module) => {
        void requestOpenModule(nodeId, module ? { id: module } : null).then(() => {
          const target = graphRef.current.nodes.find((n) => n.id === nodeId);
          if (target) focusNode(target);
        });
      },
      runAgentTest: () => setIsTestDrawerOpen(true),
    };
  }, [selectedNode, handleConnectNextNode, handleDeleteNode, undoAction, onConnect, requestOpenModule, focusNode]);

  // Auto layout glides nodes to their new spots (edges follow, since positions are
  // interpolated in state rather than with CSS). Returns how long the move takes,
  // or null when the graph is already tidy.
  const layoutAnimationRef = useRef<{ frame: number | null; timer: ReturnType<typeof setTimeout> | null }>({
    frame: null,
    timer: null,
  });
  const handleAutoLayout = useCallback(
    (explicitDir?: 'LR' | 'TB', prefs: LayoutPrefs = layoutPrefs): number | null => {
      const dir = explicitDir || (workflowDirection === 'vertical' ? 'TB' : 'LR');
      const target = layoutWorkflow(withMeasuredSizes(nodes, measuredSizeRef.current), edges, { direction: dir, ...prefs });
      const targetById = new Map(target.map((n) => [n.id, n]));
      const moved = nodes.some((n) => {
        const t = targetById.get(n.id);
        return (
          !!t &&
          (Math.abs(t.position.x - n.position.x) > 1 ||
            Math.abs(t.position.y - n.position.y) > 1 ||
            t.style?.width !== n.style?.width ||
            t.style?.height !== n.style?.height)
        );
      });
      if (!moved) {
        toast('Already tidy — nothing to move');
        return null;
      }

      const anim = layoutAnimationRef.current;
      if (anim.frame !== null) cancelAnimationFrame(anim.frame);
      if (anim.timer !== null) clearTimeout(anim.timer);

      const reduceMotion =
        typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const duration = reduceMotion ? 0 : LAYOUT_ANIMATION_MS;
      const start = new Map(nodes.map((n) => [n.id, n.position]));

      // Merge onto the latest state so selection etc. made meanwhile isn't lost
      const finish = () => {
        if (anim.frame !== null) cancelAnimationFrame(anim.frame);
        if (anim.timer !== null) clearTimeout(anim.timer);
        anim.frame = null;
        anim.timer = null;
        setNodes((cur) =>
          cur.map((n) => {
            const t = targetById.get(n.id);
            return t ? { ...n, position: t.position, style: t.style } : n;
          }),
        );
      };

      if (duration > 0) {
        const t0 = performance.now();
        const step = (now: number) => {
          const p = Math.min(1, (now - t0) / duration);
          const ease = 1 - Math.pow(1 - p, 3); // ease-out cubic
          if (p >= 1) return finish();
          setNodes((cur) =>
            cur.map((n) => {
              const from = start.get(n.id);
              const to = targetById.get(n.id)?.position;
              if (!from || !to) return n;
              return { ...n, position: { x: from.x + (to.x - from.x) * ease, y: from.y + (to.y - from.y) * ease } };
            }),
          );
          anim.frame = requestAnimationFrame(step);
        };
        anim.frame = requestAnimationFrame(step);
        // Background tabs pause animation frames; still land on the final layout
        anim.timer = setTimeout(finish, duration + 120);
      } else {
        finish();
      }

      setIsDirty(true);
      toast.success('Layout tidied', { action: undoAction });
      return duration;
    },
    [nodes, edges, undoAction, workflowDirection, layoutPrefs],
  );

  // Picking an arrangement or spacing is remembered for this agent and applied right away
  const handleChangeLayoutPrefs = useCallback(
    (patch: Partial<LayoutPrefs>) => {
      if (isCanvasLocked) return;
      const next = { ...layoutPrefs, ...patch };
      if (next.arrange === layoutPrefs.arrange && next.spacing === layoutPrefs.spacing) return;
      setLayoutPrefs(next);
      setIsDirty(true);
      const duration = handleAutoLayout(undefined, next);
      if (duration !== null) {
        setTimeout(() => reactFlowRef.current?.fitView({ padding: 0.2, duration: 450 }), duration + 40);
      }
    },
    [isCanvasLocked, layoutPrefs, handleAutoLayout],
  );

  // Plugging something into (or out of) an agent hangs it in the agent's tree right away,
  // without touching the rest of the flow. Waits a beat so new cards are measured first.
  const attachmentSignature = useMemo(
    () =>
      edges
        .filter(isAttachmentEdge)
        .map((e) => `${e.source}:${e.sourceHandle}>${e.target}`)
        .sort()
        .join('|'),
    [edges],
  );
  const lastAttachmentSignature = useRef<string | null>(null);
  useEffect(() => {
    const previous = lastAttachmentSignature.current;
    lastAttachmentSignature.current = attachmentSignature;
    // First sight of a graph keeps its saved positions
    if (previous === null || previous === attachmentSignature || isCanvasLocked) return;
    const timer = setTimeout(() => {
      const { nodes: current, edges: currentEdges } = graphRef.current;
      const target = layoutWorkflow(withMeasuredSizes(current, measuredSizeRef.current), currentEdges, {
        direction: workflowDirection === 'vertical' ? 'TB' : 'LR',
        spacing: layoutPrefs.spacing,
        attachmentsOnly: true,
      });
      const targetById = new Map(target.map((n) => [n.id, n.position]));
      setNodes((cur) =>
        cur.map((n) => {
          const to = targetById.get(n.id);
          return to && (Math.abs(to.x - n.position.x) > 1 || Math.abs(to.y - n.position.y) > 1) ? { ...n, position: to } : n;
        }),
      );
    }, 180);
    return () => clearTimeout(timer);
  }, [attachmentSignature, isCanvasLocked, workflowDirection, layoutPrefs.spacing]);

  const handleChangeDirection = useCallback(
    (newDir: WorkflowDirection) => {
      if (newDir === workflowDirection) return;
      setWorkflowDirection(newDir);
      setIsDirty(true);
      // Run auto layout in the new direction
      const layoutDir = newDir === 'vertical' ? 'TB' : 'LR';
      const target = layoutWorkflow(withMeasuredSizes(nodes, measuredSizeRef.current), edges, { direction: layoutDir, ...layoutPrefs });
      const targetById = new Map(target.map((n) => [n.id, n]));
      setNodes((cur) =>
        cur.map((n) => {
          const t = targetById.get(n.id);
          return t
            ? {
                ...n,
                position: t.position,
                style: t.style,
                data: {
                  ...n.data,
                  direction: newDir,
                },
              }
            : {
                ...n,
                data: {
                  ...n.data,
                  direction: newDir,
                },
              };
        }),
      );
      toast.success(`Workflow layout changed to ${newDir}`, { action: undoAction });
      setTimeout(() => {
        reactFlowRef.current?.fitView({ padding: 0.2, duration: 400 });
      }, 50);
    },
    [workflowDirection, nodes, edges, undoAction, layoutPrefs],
  );

  const handleChangeEdgeStyle = useCallback(
    (newStyle: WorkflowEdgeStyle) => {
      if (newStyle === workflowEdgeStyle) return;
      setWorkflowEdgeStyle(newStyle);
      setIsDirty(true);
      toast.success(`Edge routing: ${EDGE_ROUTING_LABELS[newStyle]}`, { action: undoAction });
    },
    [workflowEdgeStyle, undoAction],
  );

  const handleUpdateNodeMetadata = useCallback(
    (nodeId: string, patch: { title?: string; label?: string; description?: string; subtitle?: string }) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          const currentData = (n.data ?? {}) as Record<string, unknown>;
          const updatedTitle = patch.title ?? patch.label ?? currentData.title ?? currentData.label;
          const updatedDesc = patch.description ?? patch.subtitle ?? currentData.description ?? currentData.subtitle;
          return {
            ...n,
            data: {
              ...currentData,
              title: updatedTitle,
              label: updatedTitle,
              description: updatedDesc,
              subtitle: updatedDesc,
            },
          };
        }),
      );
      setIsDirty(true);
    },
    [],
  );
  useEffect(() => {
    const anim = layoutAnimationRef.current;
    return () => {
      if (anim.frame !== null) cancelAnimationFrame(anim.frame);
      if (anim.timer !== null) clearTimeout(anim.timer);
    };
  }, []);

  const handleDuplicateNode = useCallback(
    (node: Node) => {
      const newNode: Node = {
        id: `${node.type?.toLowerCase() || 'node'}-${Date.now().toString(36)}`,
        type: node.type,
        position: {
          x: node.position.x + 50,
          y: node.position.y + 50,
        },
        data: {
          ...node.data,
          label: `${node.data?.label || 'Node'} (Copy)`,
        },
      };
      handleAddNode(newNode, { silent: true });
      toast.success(`Duplicated "${node.data?.label || 'Node'}"`);
    },
    [handleAddNode],
  );

  const handleDeleteEdge = useCallback(
    (edgeId: string) => {
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      if (selectedEdgeId === edgeId) setSelectedEdgeId(null);
      setIsDirty(true);
      toast('Connection deleted', { action: undoAction });
    },
    [undoAction, selectedEdgeId],
  );

  /** Re-point one end of an edge (from the node panel's Wiring tab). */
  const handleRewireEdge = useCallback(
    (edgeId: string, patch: Partial<Pick<Edge, 'source' | 'target' | 'sourceHandle' | 'targetHandle'>>) => {
      setEdges((eds) => {
        const edge = eds.find((e) => e.id === edgeId);
        if (!edge) return eds;
        const next = { ...edge, ...patch };
        if (next.source === next.target) return eds;
        // Don't create a second copy of a connection that already exists
        if (eds.some((e) => e.id !== edgeId && e.source === next.source && e.target === next.target)) {
          toast.info('Those steps are already connected');
          return eds;
        }
        return eds.map((e) => (e.id === edgeId ? next : e));
      });
      setIsDirty(true);
    },
    [],
  );

  /** Node panel "Cancel": put back the node's data and every edge touching it. */
  const handleRestoreNode = useCallback((nodeId: string, snapshot: NodeSnapshot) => {
    setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: snapshot.data } : n)));
    setEdges((eds) => [
      ...eds.filter((e) => e.source !== nodeId && e.target !== nodeId),
      ...snapshot.edges,
    ]);
    setIsDirty(true);
  }, []);

  const handleReconnectEdge = useCallback((oldEdge: Edge, newConnection: Connection) => {
    setEdges((els) => {
      const next = reconnectEdge(oldEdge, newConnection, els);
      const moved = next.find((e) => !els.includes(e));
      return moved && getSlot(moved.sourceHandle) ? withSlotConnection(next.filter((e) => e !== moved), moved) : next;
    });
    setIsDirty(true);
    toast.success('Connection reconnected');
  }, []);

  const handleInspectEdge = useCallback((edge: Edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);

  const handleUpdateEdge = useCallback((edgeId: string, patch: Partial<Edge>) => {
    setEdges((eds) =>
      eds.map((e) => {
        if (e.id !== edgeId) return e;
        return {
          ...e,
          ...patch,
          data: {
            ...e.data,
            ...(patch.data ?? {}),
          },
        };
      }),
    );
    setIsDirty(true);
  }, []);

  const handleInsertNodeOnEdge = useCallback((edge: Edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    if (!sourceNode || !targetNode) return;

    const midX = Math.round((sourceNode.position.x + targetNode.position.x) / 2);
    const midY = Math.round((sourceNode.position.y + targetNode.position.y) / 2);

    setEdgeSplitContext({
      edge,
      position: { x: midX, y: midY },
    });
    setIsCatalogModalOpen(true);
  }, [nodes]);

  const handleConnectEndDrop = useCallback((pos: { x: number; y: number }, fromNode: Node, fromHandle?: string) => {
    setDropContext({
      position: pos,
      fromNode,
      fromHandle,
    });
    setIsCatalogModalOpen(true);
  }, []);

  const handleSelectCatalogItem = useCallback((item: any) => {
    setIsCatalogModalOpen(false);

    if (edgeSplitContext) {
      const { edge, position } = edgeSplitContext;
      setEdgeSplitContext(null);

      const newNodeId = `${item.type.toLowerCase()}-${Date.now().toString(36)}`;
      const newNode: Node = {
        id: newNodeId,
        type: item.type,
        position,
        data: {
          label: item.label,
          subtitle: item.subtitle,
          config: item.defaultConfig || {},
        },
        selected: true,
      };

      const edgeIn: Edge = {
        id: `e-${edge.source}-${newNodeId}-${Date.now().toString(36)}`,
        source: edge.source,
        sourceHandle: edge.sourceHandle,
        target: newNodeId,
        animated: true,
      };
      const edgeOut: Edge = {
        id: `e-${newNodeId}-${edge.target}-${Date.now().toString(36)}`,
        source: newNodeId,
        target: edge.target,
        targetHandle: edge.targetHandle,
        animated: true,
      };

      setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), newNode]);
      setEdges((eds) => [...eds.filter((e) => e.id !== edge.id), edgeIn, edgeOut]);
      setSelectedNode(newNode);
      setIsDirty(true);
      toast.success(`Inserted "${item.label}" between steps`);
      return;
    }

    if (dropContext) {
      const { position, fromNode, fromHandle } = dropContext;
      setDropContext(null);

      const newNodeId = `${item.type.toLowerCase()}-${Date.now().toString(36)}`;
      const newNode: Node = {
        id: newNodeId,
        type: item.type,
        position,
        data: {
          label: item.label,
          subtitle: item.subtitle,
          config: item.defaultConfig || {},
        },
        selected: true,
      };

      const newEdge: Edge = {
        id: `e-${fromNode.id}-${newNodeId}-${Date.now().toString(36)}`,
        source: fromNode.id,
        sourceHandle: fromHandle,
        target: newNodeId,
        animated: true,
      };

      setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), newNode]);
      setEdges((eds) => [...eds, newEdge]);
      setSelectedNode(newNode);
      setIsDirty(true);
      toast.success(`Connected "${item.label}" to "${fromNode.data?.label || 'step'}"`);
      return;
    }

    // Default addition (e.g. from Command Palette)
    const position = {
      x: window.innerWidth / 2 - 120,
      y: window.innerHeight / 2 - 40,
    };
    const newNode: Node = {
      id: `${item.type.toLowerCase()}-${Date.now().toString(36)}`,
      type: item.type,
      position,
      data: {
        label: item.label,
        subtitle: item.subtitle,
        config: item.defaultConfig || {},
      },
      selected: true,
    };
    handleAddNode(newNode);
  }, [edgeSplitContext, dropContext, handleAddNode, setSelectedNode]);

  const handleCopySelected = useCallback((nodeToCopy?: Node) => {
    let selected = nodes.filter((n) => n.selected);
    if (selected.length === 0 && nodeToCopy) {
      selected = [nodeToCopy];
    }
    if (selected.length === 0 && selectedNode) {
      selected = [selectedNode];
    }
    if (selected.length === 0) return;

    const selIds = new Set(selected.map((n) => n.id));
    const selEdges = edges.filter((e) => selIds.has(e.source) && selIds.has(e.target));
    clipboardRef.current = {
      nodes: selected.map((n) => ({ ...n })),
      edges: selEdges.map((e) => ({ ...e })),
    };
    setHasClipboard(true);
    toast.success(selected.length === 1 ? `Copied "${selected[0].data?.label || 'Node'}"` : `Copied ${selected.length} steps`);
  }, [nodes, edges, selectedNode]);

  const handleCutSelected = useCallback((nodeToCut?: Node) => {
    handleCopySelected(nodeToCut);
    let targets = nodes.filter((n) => n.selected).map((n) => n.id);
    if (targets.length === 0 && nodeToCut) targets = [nodeToCut.id];
    if (targets.length === 0 && selectedNode) targets = [selectedNode.id];
    if (targets.length > 0) {
      handleDeleteNodes(targets);
    }
  }, [handleCopySelected, nodes, selectedNode, handleDeleteNodes]);

  const handlePaste = useCallback(() => {
    if (!clipboardRef.current || clipboardRef.current.nodes.length === 0) return;
    const { nodes: clipNodes, edges: clipEdges } = clipboardRef.current;

    const idMap = new Map<string, string>();
    const newNodes: Node[] = clipNodes.map((n) => {
      const newId = generateId((n.type?.toLowerCase() || 'node'));
      idMap.set(n.id, newId);
      return {
        ...n,
        id: newId,
        position: { x: n.position.x + 50, y: n.position.y + 50 },
        selected: true,
        data: {
          ...n.data,
          label: `${n.data?.label || 'Node'} (Copy)`,
        },
      };
    });

    const newEdges: Edge[] = clipEdges.map((e) => ({
      ...e,
      id: `e-${idMap.get(e.source) || e.source}-${idMap.get(e.target) || e.target}-${Date.now().toString(36)}`,
      source: idMap.get(e.source) || e.source,
      target: idMap.get(e.target) || e.target,
    }));

    setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), ...newNodes]);
    setEdges((eds) => [...eds, ...newEdges]);
    setIsDirty(true);
    if (newNodes.length > 0) {
      setSelectedNode(newNodes[0]);
      focusNode(newNodes[0]);
    }
    toast.success(newNodes.length === 1 ? 'Pasted step' : `Pasted ${newNodes.length} steps`, { action: undoAction });
  }, [focusNode, setSelectedNode, undoAction]);

  const handleSelectAll = useCallback(() => {
    setNodes((nds) => nds.map((n) => ({ ...n, selected: true })));
  }, []);

  const handleBatchAlign = useCallback(
    (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom', selectedIds: string[]) => {
      if (selectedIds.length < 2) return;
      setNodes((nds) => {
        const selected = nds.filter((n) => selectedIds.includes(n.id));
        if (selected.length < 2) return nds;

        let targetVal = 0;
        if (type === 'left') targetVal = Math.min(...selected.map((n) => n.position.x));
        else if (type === 'right') targetVal = Math.max(...selected.map((n) => n.position.x));
        else if (type === 'center')
          targetVal = Math.round(selected.reduce((a, n) => a + n.position.x, 0) / selected.length);
        else if (type === 'top') targetVal = Math.min(...selected.map((n) => n.position.y));
        else if (type === 'bottom') targetVal = Math.max(...selected.map((n) => n.position.y));
        else if (type === 'middle')
          targetVal = Math.round(selected.reduce((a, n) => a + n.position.y, 0) / selected.length);

        return nds.map((n) => {
          if (!selectedIds.includes(n.id)) return n;
          if (type === 'left' || type === 'right' || type === 'center') {
            return { ...n, position: { ...n.position, x: targetVal } };
          } else {
            return { ...n, position: { ...n.position, y: targetVal } };
          }
        });
      });
      setIsDirty(true);
      toast.success(`Aligned ${selectedIds.length} nodes (${type})`);
    },
    [],
  );

  const handleBatchDuplicate = useCallback((selectedIds: string[]) => {
    if (!selectedIds.length) return;
    const newNodes: Node[] = [];
    setNodes((prev) => {
      const selected = prev.filter((n) => selectedIds.includes(n.id));
      selected.forEach((n) => {
        const newId = generateId((n.type?.toLowerCase() || 'node'));
        newNodes.push({
          ...n,
          id: newId,
          position: { x: n.position.x + 40, y: n.position.y + 40 },
          selected: true,
          data: {
            ...n.data,
            label: `${n.data?.label || 'Node'} (Copy)`,
          },
        });
      });
      return [...prev.map((n) => ({ ...n, selected: false })), ...newNodes];
    });
    setIsDirty(true);
    toast.success(`Duplicated ${selectedIds.length} nodes`);
  }, []);

  const handleBatchGroup = useCallback((selectedIds: string[]) => {
    if (selectedIds.length < 2) return;
    setNodes((prev) => {
      const selected = prev.filter((n) => selectedIds.includes(n.id));
      if (selected.length < 2) return prev;
      const minX = Math.min(...selected.map((n) => n.position.x)) - 24;
      const minY = Math.min(...selected.map((n) => n.position.y)) - 48;
      const maxX = Math.max(...selected.map((n) => n.position.x + (n.measured?.width || 240))) + 24;
      const maxY = Math.max(...selected.map((n) => n.position.y + (n.measured?.height || 120))) + 24;

      const groupNode: Node = {
        id: `group-${Date.now().toString(36)}`,
        type: 'GROUP',
        position: { x: minX, y: minY },
        style: { width: Math.max(340, maxX - minX), height: Math.max(220, maxY - minY) },
        data: {
          label: 'Stage Group',
          subtitle: `${selected.length} grouped steps`,
          config: {},
        },
      };
      return [groupNode, ...prev];
    });
    setIsDirty(true);
    toast.success(`Grouped ${selectedIds.length} nodes into stage`);
  }, []);

  const handleExportJson = useCallback(() => {
    const exportData = {
      name: agent?.name || 'workflow-agent',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      nodes,
      edges,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(agent?.name || 'workflow').toLowerCase().replace(/\s+/g, '-')}-graph.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Workflow exported as JSON');
  }, [agent, nodes, edges]);

  // Keyboard shortcuts. Handlers are read through a ref so the listener is bound once.
  const shortcutHandlersRef = useRef<{
    undo: () => void;
    redo: () => void;
    save: () => void;
    publish: () => void;
    duplicate: () => void;
    copy: () => void;
    cut: () => void;
    paste: () => void;
    selectAll: () => void;
    openCommandPalette: () => void;
    clearSelection: () => void;
    canEditGraph: boolean;
  } | null>(null);
  shortcutHandlersRef.current = {
    undo,
    redo,
    save: () => {
      if (isDirty && !saveMutation.isPending) saveMutation.mutate();
      else if (!isDirty) toast('Everything is already saved');
    },
    publish: () => {
      if (!publishMutation.isPending) publishMutation.mutate();
    },
    duplicate: () => {
      if (selectedNode) handleDuplicateNode(selectedNode);
    },
    copy: () => handleCopySelected(),
    cut: () => handleCutSelected(),
    paste: () => handlePaste(),
    selectAll: () => handleSelectAll(),
    openCommandPalette: () => setIsCommandPaletteOpen(true),
    clearSelection: () => {
      if (moduleDirtyRef.current) {
        void confirmLeaveModule().then((ok) => {
          if (ok) setSelectedNodeId(null);
        });
        return;
      }
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setNodes((nds) => (nds.some((n) => n.selected) ? nds.map((n) => (n.selected ? { ...n, selected: false } : n)) : nds));
    },
    canEditGraph: activeTab === 'build' && !isCanvasLocked,
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const h = shortcutHandlersRef.current;
      if (!h) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      // Save works everywhere, including while typing in a settings field
      if (mod && key === 's') {
        e.preventDefault();
        h.save();
        return;
      }
      if (mod && e.shiftKey && key === 'p') {
        e.preventDefault();
        h.publish();
        return;
      }
      if (mod && key === 'k') {
        e.preventDefault();
        h.openCommandPalette();
        return;
      }
      if (isTypingTarget(e.target)) return;

      if (e.key === 'Escape') {
        if (isPresentationMode) {
          setIsPresentationMode(false);
          return;
        }
        h.clearSelection();
      } else if (mod && key === 'z' && h.canEditGraph) {
        e.preventDefault();
        if (e.shiftKey) h.redo();
        else h.undo();
      } else if (mod && key === 'y' && h.canEditGraph) {
        e.preventDefault();
        h.redo();
      } else if (mod && key === 'd' && h.canEditGraph) {
        e.preventDefault();
        h.duplicate();
      } else if (mod && key === 'c' && h.canEditGraph) {
        e.preventDefault();
        h.copy();
      } else if (mod && key === 'x' && h.canEditGraph) {
        e.preventDefault();
        h.cut();
      } else if (mod && key === 'v' && h.canEditGraph) {
        e.preventDefault();
        h.paste();
      } else if (mod && key === 'a' && h.canEditGraph) {
        e.preventDefault();
        h.selectAll();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPresentationMode]);

  // Warn before closing / reloading the tab with unsaved edits
  useEffect(() => {
    if (!isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleBack = async () => {
    if (
      isDirty &&
      !(await confirm({
        title: 'Leave without saving?',
        description: 'You have unsaved changes to this agent. They will be lost if you leave now.',
        confirmLabel: 'Leave',
        destructive: true,
      }))
    ) {
      return;
    }
    navigate('/agents');
  };

  const handleRestoreVersion = async (version: AgentVersion) => {
    const tag = version.versionTag ?? `v${version.version}`;
    const ok = await confirm({
      title: `Restore ${tag}?`,
      description: isDirty
        ? `The canvas will be replaced with ${tag}, and your unsaved changes will be lost.`
        : `The canvas will be replaced with ${tag}. You can still restore any other version afterwards.`,
      confirmLabel: 'Restore',
      destructive: isDirty,
    });
    if (ok) restoreVersionMutation.mutate(version.version);
  };

  const handleValidateGraph = async () => {
    if (!agentId) return;
    try {
      // Validates what is on the canvas now, saved or not.
      const res = await agentsApi.validate(
        activeWorkspace.id,
        agentId,
        JSON.stringify({ nodes, edges, ...(graphSettings ? { settings: graphSettings } : {}) }),
      );
      setValidationResult(res);
      setIsValidationOpen(true);
    } catch (e) {
      toast.error(errorMessage(e, 'Validation failed'));
    }
  };

  if (isAgentLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <LoadingState label="Loading agent workspace…" />
      </div>
    );
  }

  if (isAgentError) {
    return (
      <ErrorState
        fullPage
        title="Could not load this agent"
        description={errorMessage(agentError, 'Request failed')}
        onRetry={() => void refetchAgent()}
        action={
          <Button variant="outline" size="sm" onClick={() => navigate('/agents')}>
            Back to Agents
          </Button>
        }
      />
    );
  }

  if (!agent) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <h2 className="text-base font-semibold text-foreground">Agent Not Found</h2>
        <Button variant="outline" size="sm" onClick={() => navigate('/agents')}>
          Back to Agents
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-background">
      {/* Presentation Mode Float Bar */}
      {isPresentationMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-1.5 shadow-lg animate-in fade-in slide-in-from-top-2 duration-200">
          <Eye className="size-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Presentation Mode</span>
          <div className="h-3 w-px bg-border mx-1" />
          <Button
            variant="ghost"
            size="xs"
            onClick={() => setIsPresentationMode(false)}
            className="h-6 px-2.5 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-surface-raised cursor-pointer"
          >
            Exit (Esc)
          </Button>
        </div>
      )}

      {/* Top Navbar */}
      {!isPresentationMode && (
        <header className="relative flex h-13 shrink-0 items-center justify-between gap-2 border-b border-border bg-background px-3.5 z-30 select-none">
        {/* Left: Back, Identity, Status */}
        <div className="flex h-13 items-center gap-2 shrink-0 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            aria-label="Back to agents"
            className="h-8 w-8 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent shrink-0"
            title="Back to agents"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-2 min-w-0">
            <AgentAvatar
              agent={agent}
              icon={settingsDraft?.icon}
              avatarUrl={settingsDraft?.avatar}
              theme={settingsDraft?.theme}
              size="sm"
            />

            {isEditingHeaderName ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSaveHeaderName();
                }}
                className="flex items-center gap-1 shrink-0"
              >
                <Input
                  value={headerNameInput}
                  onChange={(e) => setHeaderNameInput(e.target.value)}
                  className="h-7 text-xs font-semibold w-36 bg-background"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setHeaderNameInput(agent.name);
                      setIsEditingHeaderName(false);
                    }
                  }}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-success hover:text-success"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setHeaderNameInput(agent.name);
                    setIsEditingHeaderName(false);
                  }}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </form>
            ) : (
              <div
                className="flex items-center gap-1.5 group cursor-pointer min-w-0"
                onClick={() => {
                  setHeaderNameInput(settingsDraft?.name ?? agent.name);
                  setIsEditingHeaderName(true);
                }}
                title="Click to rename agent"
              >
                <span className="text-sm font-semibold text-foreground hover:text-primary transition-colors whitespace-nowrap truncate max-w-[140px] sm:max-w-[180px] lg:max-w-[220px]">
                  {settingsDraft?.name ?? agent.name}
                </span>
                <Edit2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </div>
            )}

            {/* One chip: lifecycle (Draft / Published) + live save state; opens save options */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  aria-label={`${isPublished ? 'Published' : 'Draft'} — ${saveStatusText}. Save options`}
                  className={cn(
                    'shrink-0 rounded-full',
                    isPublished ? 'border-success/30 bg-success/10 text-success hover:bg-success/15' : 'text-muted-foreground',
                  )}
                >
                  <span>{isPublished ? 'Published' : 'Draft'}</span>
                  <span className="h-3 w-px bg-current opacity-30" />
                  {saveMutation.isPending ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                      <span className="hidden md:inline">Saving…</span>
                    </span>
                  ) : saveFailed ? (
                    <span className="flex items-center gap-1 text-destructive">
                      <AlertTriangle className="h-3 w-3" aria-hidden />
                      <span className="hidden md:inline">Not saved</span>
                    </span>
                  ) : isDirty ? (
                    <span className="flex items-center gap-1 text-warning">
                      <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
                      <span className="hidden md:inline">{autoSaveEnabled ? 'Editing…' : 'Unsaved'}</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-success/90">
                      <Check className="h-3 w-3" aria-hidden />
                      <span className="hidden md:inline tabular-nums">
                        {lastSaved ? `${lastSaved.auto ? 'Auto-saved' : 'Saved'} ${savedAgo(lastSaved.at, now)}` : 'Saved'}
                      </span>
                    </span>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                <div className="px-2 py-1.5">
                  <p className="text-xs font-medium text-foreground">{saveStatusText}</p>
                  <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                    {autoSaveEnabled
                      ? `Your draft saves itself ${AUTO_SAVE_DELAY_MS / 1000}s after you stop editing. Publishing makes it live.`
                      : 'Auto-save is off — save with Ctrl+S. Publishing makes it live.'}
                  </p>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem checked={autoSaveEnabled} onCheckedChange={(v) => toggleAutoSave(!!v)} className="text-xs">
                  Auto-save draft
                </DropdownMenuCheckboxItem>
                <DropdownMenuItem
                  disabled={!isDirty || saveMutation.isPending}
                  onSelect={() => saveMutation.mutate()}
                  className="gap-2 text-xs"
                >
                  <Save className="h-3.5 w-3.5" /> {saveFailed ? 'Try saving again' : 'Save now'}
                  <DropdownMenuShortcut>Ctrl+S</DropdownMenuShortcut>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setActiveTab('versions')} className="gap-2 text-xs">
                  <Clock className="h-3.5 w-3.5" /> Version history
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <nav aria-label="Agent sections" className="flex min-w-0 flex-1 items-center justify-center gap-1 xl:pointer-events-none xl:absolute xl:inset-x-0 xl:top-0 xl:h-13 xl:flex-none [&>*]:xl:pointer-events-auto">
          {AGENT_TAB_GROUPS.map((group) => {
            const GroupIcon = group.icon;
            const isActive = group.tabs.includes(activeTab);
            const triggerClass = cn(
              'relative flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3.5 text-sm font-semibold transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive ? 'bg-accent text-foreground' : 'text-foreground/70 hover:bg-accent/60 hover:text-foreground',
            );
            const inner = (
              <>
                <GroupIcon className={cn('h-3.5 w-3.5 shrink-0', isActive && 'text-primary')} />
                <span>{group.label}</span>
              </>
            );
            if (group.tabs.length === 1) {
              return (
                <button key={group.label} type="button" onClick={() => setActiveTab(group.tabs[0])} aria-current={isActive ? 'page' : undefined} className={triggerClass}>
                  {inner}
                </button>
              );
            }
            return (
              <DropdownMenu key={group.label} modal={false} open={openTabMenu === group.label} onOpenChange={(open) => setOpenTabMenu(open ? group.label : null)}>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-current={isActive ? 'page' : undefined} className={triggerClass}>
                    {inner}
                    <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" sideOffset={6} className="w-48">
                  {group.tabs.map((id) => {
                    const tab = AGENT_TABS.find((t) => t.id === id)!;
                    return (
                      <DropdownMenuItem key={id} onSelect={() => setActiveTab(id)} className={cn('gap-2 text-xs', activeTab === id && 'font-semibold text-foreground')}>
                        <tab.icon className="h-3.5 w-3.5" />
                        {tab.label}
                        {activeTab === id && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}
        </nav>

        {/* Right: Actions */}
        <div className="flex h-13 items-center gap-1.5 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsTestDrawerOpen(true)}
            className="h-8 gap-1.5 text-xs font-medium rounded-md border-success/30 bg-success/10 text-success hover:bg-success/20"
            title="Test run this agent workflow"
          >
            <Play className="h-3.5 w-3.5 fill-success" />
            <span className="hidden md:inline">Test Run</span>
          </Button>

          {/* Save Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !isDirty}
            aria-keyshortcuts="Control+S"
            aria-label={isDirty ? 'Save changes' : 'All changes saved'}
            className={cn(
              "h-8 gap-1.5 text-xs rounded-md transition-all",
              !isDirty && !saveMutation.isPending && "w-8 px-0",
              isDirty
                ? "border-warning/40 text-warning bg-warning/10 hover:bg-warning/20 font-medium"
                : "border-border/60 text-muted-foreground hover:text-foreground"
            )}
            title={isDirty ? 'Save changes (Ctrl+S)' : 'All changes saved'}
          >
            {saveMutation.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            {/* Label only while there is something to save */}
            {(isDirty || saveMutation.isPending) && (
              <span className="hidden sm:inline">{saveMutation.isPending ? 'Saving…' : 'Save'}</span>
            )}
          </Button>

          {/* Publish Dropdown Popover matching reference design */}
          <Popover open={isPublishPopoverOpen} onOpenChange={setIsPublishPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="sm"
                className={cn('h-8 gap-1.5 rounded-md font-semibold', isPublishPopoverOpen && 'ring-2 ring-primary/40')}
              >
                <span>Publish</span>
                <ChevronDown className={cn("size-3.5 transition-transform duration-200", isPublishPopoverOpen && "rotate-180")} />
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={8}
              className="w-80 rounded-xl border border-border bg-surface p-3.5 shadow-lg text-foreground"
            >
              {/* Status & Timeline Section */}
              <div className="relative pl-6 py-1">
                {/* Vertical Track Line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-border/80" />

                {/* Top: Publish Status */}
                <div className="relative flex items-center gap-2 mb-3">
                  <div
                    className={cn(
                      "absolute -left-6 size-3.5 rounded-full border-2 bg-surface flex items-center justify-center",
                      isPublished ? "border-success bg-success/20" : "border-muted-foreground/60"
                    )}
                  >
                    {isPublished && <div className="size-1.5 rounded-full bg-success" />}
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">
                    {isPublished
                      ? liveVersionTag
                        ? `Published · ${liveVersionTag} live`
                        : 'Published'
                      : 'Not published yet'}
                  </span>
                </div>

                {/* Center: Big Publish Action Button */}
                <div className="my-2.5 -ml-3">
                  <Button
                    type="button"
                    size="lg"
                    onClick={async () => {
                      await publishMutation.mutateAsync();
                      setIsPublishPopoverOpen(false);
                    }}
                    loading={publishMutation.isPending}
                    className="w-full rounded-xl font-semibold"
                  >
                    <span>{isPublished ? 'Publish update' : 'Publish'}</span>
                    <span className="rounded-md bg-primary-foreground/20 px-1.5 py-0.5 text-2xs font-mono font-bold text-primary-foreground">
                      {targetPublishVersion}
                    </span>
                    <div className="flex items-center gap-1 ml-1">
                      <kbd className="rounded-md bg-primary-foreground/20 px-1.5 py-0.5 text-2xs font-medium font-sans text-primary-foreground leading-none">
                        Ctrl Shift
                      </kbd>
                      <kbd className="rounded-md bg-primary-foreground/20 px-1.5 py-0.5 text-2xs font-medium font-sans text-primary-foreground leading-none">
                        P
                      </kbd>
                    </div>
                  </Button>
                </div>

                {/* Bottom: Auto-save status */}
                <div className="relative flex items-center gap-2 mt-3">
                  <div
                    className={cn(
                      "absolute -left-6 size-3.5 rounded-full border-2 bg-surface flex items-center justify-center",
                      isDirty ? "border-warning bg-warning/20" : "border-success/80 bg-success/20"
                    )}
                  >
                    <div className={cn("size-1.5 rounded-full", isDirty ? "bg-warning animate-pulse" : "bg-success")} />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">
                    {saveStatusText}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border my-3" />

              {/* Links & Endpoints */}
              <div className="space-y-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsPublishPopoverOpen(false);
                    // The Studio's own end-user chat page for this agent
                    window.open(`${window.location.origin}${scopeStudioPath(activeWorkspace.slug, `/chat/${agent.id}`)}`, '_blank', 'noopener');
                  }}
                  className="group h-auto w-full justify-between rounded-xl p-2 text-foreground"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-surface-raised border border-border/60 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                      <Globe className="size-4" />
                    </div>
                    <span>Open web app</span>
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setIsPublishPopoverOpen(false);
                    navigator.clipboard
                      .writeText(apiCurlSnippet('Execute task'))
                      .then(() => toast.success('API request copied as cURL'))
                      .catch(() => toast.error('Could not copy to the clipboard'));
                  }}
                  className="group h-auto w-full justify-between rounded-xl p-2 text-foreground"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-surface-raised border border-border/60 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                      <Radio className="size-4" />
                    </div>
                    <span>Copy API request</span>
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
                </Button>

                {isPublished && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setIsPublishPopoverOpen(false);
                      unpublishMutation.mutate();
                    }}
                    disabled={unpublishMutation.isPending}
                    className="group mt-1 h-auto w-full justify-between rounded-xl p-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
                        <RotateCcw className="size-4" />
                      </div>
                      <span>Unpublish Agent</span>
                    </div>
                    <span className="text-2xs text-destructive/80 font-normal">Revert to Draft</span>
                  </Button>
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Secondary actions */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent shrink-0"
                title="More actions"
                aria-label="More actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onSelect={() => void handleValidateGraph()} className="gap-2 text-xs">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                Validate workflow
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setIsTemplateExportOpen(true)} className="gap-2 text-xs">
                <Layers className="h-3.5 w-3.5 text-primary" />
                Export as template
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setIsPresentationMode(true)} className="gap-2 text-xs">
                <Eye className="h-3.5 w-3.5" />
                Presentation mode
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      )}

      {!canManage && (
        <div role="status" className="flex shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-4 py-2 text-xs text-muted-foreground">
          <Lock className="size-3.5 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold text-foreground">View only.</strong> Only this agent’s creator or a workspace admin can edit it.
          </span>
        </div>
      )}

      {/* Main Tab Views */}
      <div className="flex-1 overflow-hidden">
        {/* TAB 1: BUILD CANVAS */}
        {activeTab === 'build' && (
          <div className="flex h-full w-full overflow-hidden">
            {/* Canvas, with the node panel floating over its right edge */}
            <div className="relative min-w-0 flex-1">
            <ReactFlowProvider key={canvasEpoch}>
              <WorkflowCanvasInner
                measuredSizeRef={measuredSizeRef}
                direction={workflowDirection}
                onChangeDirection={handleChangeDirection}
                edgeStyle={workflowEdgeStyle}
                onChangeEdgeStyle={handleChangeEdgeStyle}
                layoutPrefs={layoutPrefs}
                onChangeLayoutPrefs={handleChangeLayoutPrefs}
                isCopilotOpen={showAiPanel}
                onToggleCopilot={agentId && settingsDraft ? () => setShowAiPanel((open) => !open) : undefined}
                onUpdateNodeMetadata={handleUpdateNodeMetadata}
                nodes={nodes.map((n) => ({
                  ...n,
                  data: {
                    ...n.data,
                    direction: workflowDirection,
                    edgeStyle: workflowEdgeStyle,
                    onUpdateMetadata: (patch: any) => handleUpdateNodeMetadata(n.id, patch),
                    ...slotDecorations.get(n.id),
                    issues: issuesByNode.get(n.id),
                    run: resultFor(n),
                    onClearRun: () =>
                      setRunResults((r) => ({ ...r, [n.id]: { status: 'idle', output: '', tokens: 0, latencyMs: 0, cleared: true } })),
                    ...(isSlotHost(n.type)
                      ? {
                          onOpenModule: (id: AgentModuleId, target?: { section?: string; field?: string }) =>
                            void requestOpenModule(n.id, { id, ...target }),
                        }
                      : {}),
                    onUpdateConfig: (patch: Record<string, unknown>) => handleUpdateNodeConfig(n.id, patch),
                    onTest: () => setIsTestDrawerOpen(true),
                    onEdit: () => void requestOpenModule(n.id, null),
                    onDuplicate: () => handleDuplicateNode(n),
                    onDelete: () => handleDeleteNode(n.id),
                    onConnectNext: (item: any, handleId?: string) =>
                      handleConnectNextNode(n, item, handleId),
                  },
                }))}
                edges={edges.map((e) => {
                  const attachment = isAttachmentEdge(e);
                  const sourceStatus = runResults[e.source]?.status;
                  return {
                    ...e,
                    type: 'workflow',
                    // Saved edges may carry `animated`; flow only animates while its step runs
                    animated: false,
                    markerEnd: undefined,
                    // Things plugged into an agent slot are drawn dashed; the run order stays solid
                    ...(attachment ? { style: { ...e.style, strokeDasharray: '5 5' } } : {}),
                    data: {
                      ...e.data,
                      edgeStyle: workflowEdgeStyle,
                      status: sourceStatus === 'running' ? 'running' : sourceStatus === 'success' && !attachment ? 'done' : undefined,
                      attachment,
                      onDelete: (id: string) => handleDeleteEdge(id),
                      isEditingLabel: editingEdgeLabelId === e.id,
                      onStartLabelEdit: isCanvasLocked ? undefined : (id: string) => setEditingEdgeLabelId(id),
                      onRenameLabel: handleRenameEdgeLabel,
                      onCancelLabelEdit: () => setEditingEdgeLabelId(null),
                    },
                  };
                })}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                onAddNode={handleAddNode}
                onAutoLayout={handleAutoLayout}
                onDeleteNodes={handleDeleteNodes}
                onDuplicateNode={handleDuplicateNode}
                onTestNode={() => setIsTestDrawerOpen(true)}
                onInspectNode={(node) => setSelectedNode(node)}
                onDeleteEdge={handleDeleteEdge}
                onReconnectEdge={handleReconnectEdge}
                canUndo={historyFlags.canUndo}
                canRedo={historyFlags.canRedo}
                onUndo={undo}
                onRedo={redo}
                onExportJson={handleExportJson}
                onBatchAlign={handleBatchAlign}
                onBatchDuplicate={handleBatchDuplicate}
                onBatchGroup={handleBatchGroup}
                onInitFlow={(instance) => {
                  reactFlowRef.current = instance;
                }}
                onEdgeClick={(_, edge) => handleInspectEdge(edge)}
                onInspectEdge={handleInspectEdge}
                onInsertNodeOnEdge={handleInsertNodeOnEdge}
                onEditEdgeLabel={isCanvasLocked ? undefined : (edge) => setEditingEdgeLabelId(edge.id)}
                onToggleEdgeAnimated={isCanvasLocked ? undefined : handleToggleEdgeAnimated}
                onCopyNode={(node) => handleCopySelected(node)}
                onCutNode={(node) => handleCutSelected(node)}
                onPaste={handlePaste}
                hasClipboard={hasClipboard}
                onSelectAll={handleSelectAll}
                onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
                onConnectEndDrop={handleConnectEndDrop}
                onFocusNodeById={handleFocusNodeById}
                isLocked={isCanvasLocked}
                onToggleLock={() => {
                  const next = !isCanvasLocked;
                  setIsCanvasLocked(next);
                  toast(next ? 'Canvas locked — editing is paused' : 'Canvas unlocked');
                }}
              />
            </ReactFlowProvider>

            {/* Floating node panel (opens when a node is clicked); agents open their capability modules in it */}
            {selectedNode && (
              <NodeInspector
                key={selectedNode.id}
                selectedNode={selectedNode}
                nodes={nodes}
                edges={edges}
                readOnly={isCanvasLocked}
                onUpdateNode={handleUpdateNode}
                onDeleteNode={handleDeleteNode}
                onRewireEdge={handleRewireEdge}
                onDeleteEdge={handleDeleteEdge}
                onConnect={onConnect}
                onRestoreNode={handleRestoreNode}
                onClose={() => setSelectedNode(null)}
                graphSettings={graphSettings}
                issuesByNode={issuesByNode}
                activeModule={activeModule}
                onOpenModule={setActiveModule}
                onOpenAgentModule={(agentId, id) => void requestOpenModule(agentId, { id })}
                onApplyModuleDraft={handleApplyModuleDraft}
                onSaveNow={requestSaveNow}
                moduleActions={moduleActions}
                onModuleDirtyChange={handleModuleDirtyChange}
                className="absolute top-3 right-3 bottom-3 z-30 max-w-[calc(100%-1.5rem)]"
              />
            )}

            {/* Floating edge data inspector (opens when an edge is clicked) */}
            {selectedEdge && !selectedNode && (
              <EdgeDataInspector
                key={selectedEdge.id}
                selectedEdge={selectedEdge}
                nodes={nodes}
                canvasRouting={workflowEdgeStyle}
                onUpdateEdge={handleUpdateEdge}
                onDeleteEdge={handleDeleteEdge}
                onInsertNodeOnEdge={handleInsertNodeOnEdge}
                onClose={() => setSelectedEdgeId(null)}
                className="absolute top-3 right-3 bottom-3 z-30 w-[360px] max-w-[calc(100%-1.5rem)]"
              />
            )}

            {/* Workflow health, floating in the canvas corner; the inspectors take this spot while open */}
            {!selectedNode && !selectedEdge && (
              <div className="absolute top-3 right-3 z-20 rounded-xl bg-surface shadow-lg animate-in fade-in slide-in-from-top-1 duration-200">
                <WorkflowHealthBadge issues={allWorkflowIssues} onClick={handleValidateGraph} className="h-8.5 rounded-xl" />
              </div>
            )}
            </div>

            {/* Right 4th Panel: AI Copilot Prompt Assistant (if open) */}
            {/* Mounted once the agent's own graph is on the canvas (the settings draft is filled in the same pass). */}
            {showAiPanel && agentId && settingsDraft && (
              <AgentCopilotPanel
                workspaceId={activeWorkspace.id}
                workspaceSlug={activeWorkspace.slug}
                agentId={agentId}
                agentName={agent?.name ?? 'this agent'}
                graph={copilotGraph}
                welcome={copilotWelcome}
                onApply={applyCopilotGraph}
                onRunTest={() => setIsTestDrawerOpen(true)}
                onFocusNode={(nodeId) => {
                  const target = graphRef.current.nodes.find((n) => n.id === nodeId);
                  if (target) focusNode(target);
                }}
                onBeforeRun={async () => {
                  await saveIfNeeded();
                }}
                onNodeStatuses={showRunStatuses}
                onNodeResults={setRunResults}
                onClose={() => setShowAiPanel(false)}
              />
            )}
          </div>
        )}

        {/* TAB: APP CONNECTORS & TOOLS */}
        {activeTab === 'connectors' && (
          <AgentConnectorsTab
            agent={agent}
            onChanged={() => queryClient.invalidateQueries({ queryKey: agentQueryKey })}
          />
        )}

        {/* TAB 3: MEMORY & RETENTION */}
        {activeTab === 'memory' && (
          <MemoryTab
            agent={agent}
            onUpdate={async (patch) => {
              if (!agentId) return false;
              // agentService merges partial configuration patches onto the saved one.
              try {
                await agentService.updateAgent(activeWorkspace.id, agentId, patch);
              } catch (err) {
                toast.error(errorMessage(err, 'Could not save changes'));
                return false;
              }
              await queryClient.invalidateQueries({ queryKey: agentQueryKey });
              return true;
            }}
          />
        )}

        {/* TAB 4: VARIABLES & EXPRESSIONS */}
        {activeTab === 'variables' && (
          <VariablesTab />
        )}

        {/* TAB 3: EXECUTIONS */}
        {activeTab === 'executions' && (
          <AgentTabPage
            title="Execution History"
            description={`History of ${agent.name}’s workflow runs, token counts, and execution step breakdowns.`}
            icon={<Activity />}
          >
            {executions.length === 0 ? (
              <EmptyState
                icon={<Bot />}
                title="No executions yet"
                description="Run a test execution from the canvas or trigger via API to see traces here."
                action={
                  <Button size="sm" onClick={() => setIsTestDrawerOpen(true)} className="gap-1.5 text-xs">
                    <Play className="h-3.5 w-3.5" />
                    Run First Test
                  </Button>
                }
              />
            ) : (
              <Card className="divide-y divide-border overflow-hidden">
                {executions.map((exec) => (
                  <div
                    key={exec.id}
                    className="flex items-center justify-between gap-4 p-3.5 transition-colors hover:bg-surface-raised"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-foreground">
                          {exec.id.slice(0, 8)}
                        </span>
                        <Badge
                          variant={
                            exec.status === 'SUCCESS' || exec.status === 'COMPLETED'
                              ? 'success'
                              : exec.status === 'FAILED'
                                ? 'destructive'
                                : 'outline'
                          }
                          className="text-2xs"
                        >
                          {exec.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {exec.promptText || 'Executed workflow task'}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
                      <span>{new Date(exec.executedAt).toLocaleString()}</span>
                      <span>{exec.tokensUsed.toLocaleString()} tokens</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/executions')}
                        className="text-xs text-primary"
                      >
                        Inspect
                      </Button>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </AgentTabPage>
        )}

        {/* TAB: EVALUATION & BENCHMARKS */}
        {activeTab === 'evaluations' && (
          <EvaluationsTab
            agent={agent}
            onUpdate={async (patch) => {
              if (!agentId) return;
              // agentService merges partial configuration patches onto the saved one.
              try {
                await agentService.updateAgent(activeWorkspace.id, agentId, patch);
              } catch (err) {
                toast.error(errorMessage(err, 'Could not save changes'));
                return;
              }
              queryClient.invalidateQueries({ queryKey: agentQueryKey });
              toast.success('Evaluation configuration updated');
            }}
          />
        )}

        {/* TAB 4: VERSIONS */}
        {activeTab === 'versions' && (
          <AgentTabPage
            title="Version history"
            description="Snapshots of the canvas. Compare any version with the current graph, or restore it."
            icon={<Clock />}
            actions={
              <Button
                size="sm"
                onClick={() => setIsSnapshotDialogOpen(true)}
                className="gap-1.5 text-xs"
              >
                <Clock className="h-3.5 w-3.5" />
                Save snapshot
              </Button>
            }
          >
            {versions.length === 0 ? (
              <EmptyState
                icon={<Clock />}
                title="No snapshots created"
                description="Tag your current workflow graph as a version to easily revert changes later."
              />
            ) : (
              <AgentVersionsList
                versions={versions}
                restoring={restoreVersionMutation.isPending}
                onCompare={setDiffModalTarget}
                onRestore={handleRestoreVersion}
              />
            )}
          </AgentTabPage>
        )}

        {/* TAB: DEPLOY */}
        {activeTab === 'deploy' && (
          <AgentDeploymentTab agent={agent} />
        )}

        {/* TAB: MARKETPLACE */}
        {activeTab === 'marketplace' && <AgentMarketplaceTab agent={agent} />}

        {/* TAB 5: SETTINGS */}
        {activeTab === 'settings' && (
          <AgentTabPage
            title="Agent Settings"
            description="Identity, appearance, model, run limits and guardrails."
            icon={<Settings />}
          >
            <AgentSettingsLayout
              items={SETTINGS_NAV}
              isDirty={isDirty}
              isSaving={saveMutation.isPending}
              onSave={() => saveMutation.mutate()}
            >
            {/* 1. Identity & Persona (Module 5.1) */}
            <AgentTabSection id="settings-identity" title="Agent Identity & Behavior" icon={<Bot />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Agent Name">
                  <Input
                    value={settingsDraft?.name ?? agent.name}
                    onChange={(e) => updateSettings({ name: e.target.value })}
                  />
                </Field>
                <Field label="Specialist Role / Title">
                  <Input
                    value={settingsDraft?.role ?? agent.role ?? 'Autonomous Specialist'}
                    onChange={(e) => updateSettings({ role: e.target.value })}
                  />
                </Field>
              </div>

              <Field label="Description & Task Objectives">
                <Textarea
                  rows={3}
                  value={settingsDraft?.description ?? agent.description ?? ''}
                  onChange={(e) => updateSettings({ description: e.target.value })}
                />
              </Field>
            </AgentTabSection>

            {/* Visual Branding & Appearance */}
            <AgentTabSection id="settings-appearance" title="Icon & colour" icon={<Palette />}>
              {/* The same picker coworkers use, so an agent looks the same everywhere it appears. */}
              <AiEntityIdentityPicker
                name={settingsDraft?.name || agent.name}
                kind="agent"
                value={settingsDraft?.avatar}
                onChange={(avatar) => {
                  const parsed = parseAiEntityAvatar(avatar);
                  updateSettings(
                    parsed.type === 'icon'
                      ? { avatar, icon: parsed.icon, ...(parsed.color ? { theme: parsed.color } : {}) }
                      : { avatar },
                  );
                }}
                label="Avatar"
              />
            </AgentTabSection>

            {/* Categorization, Tags & Ownership */}
            <AgentTabSection id="settings-category" title="Category, Tags & Ownership" icon={<Tag />}>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Category with create custom */}
                <div>
                  <Label htmlFor="agent-settings-cat" className="mb-1 block">
                    Category
                  </Label>
                  {!isCreatingCustomCategory ? (
                    <div className="flex items-center gap-2">
                      <AppSelect
                        id="agent-settings-cat"
                        value={settingsDraft?.category || 'Customer Support'}
                        onValueChange={(category) => updateSettings({ category })}
                        options={availableCategories.map((c) => ({ value: c, label: c }))}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsCreatingCustomCategory(true)}
                        className="h-8 shrink-0 text-xs gap-1"
                        title="Create new category"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        New
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Input
                        placeholder="New category name..."
                        value={customCategoryInput}
                        onChange={(e) => setCustomCategoryInput(e.target.value)}
                        className="text-xs h-8"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleCreateCustomCategory();
                          } else if (e.key === 'Escape') {
                            setIsCreatingCustomCategory(false);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleCreateCustomCategory}
                        className="h-8 text-xs shrink-0"
                      >
                        Add
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsCreatingCustomCategory(false)}
                        className="h-8 w-8 p-0 shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Tags Management */}
                <div>
                  <Label htmlFor="agent-settings-tag" className="mb-1 block">
                    Tags
                  </Label>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Input
                      id="agent-settings-tag"
                      placeholder="Add tag (e.g. autonomous, triage)..."
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      className="text-xs h-8"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleAddTag}
                      className="h-8 text-xs shrink-0"
                    >
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 min-h-6">
                    {(settingsDraft?.tags || []).map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 rounded-md bg-surface-raised px-2 py-0.5 text-xs font-medium text-foreground border border-border"
                      >
                        #{t}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={`Remove tag ${t}`}
                          onClick={() => handleRemoveTag(t)}
                          className="size-4 rounded-sm"
                        >
                          <X className="size-2.5" />
                        </Button>
                      </span>
                    ))}
                    {(settingsDraft?.tags || []).length === 0 && (
                      <span className="text-xs text-muted-foreground italic">No tags assigned</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Owner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 border-t border-border">
                <div>
                  <Label htmlFor="agent-settings-owner-name" className="mb-1 block">
                    Agent Owner Name
                  </Label>
                  <Input
                    id="agent-settings-owner-name"
                    placeholder="e.g. Sarah Jenkins"
                    value={settingsDraft?.ownerName || ''}
                    onChange={(e) => updateSettings({ ownerName: e.target.value })}
                    className="text-xs"
                  />
                </div>
                <div>
                  <Label htmlFor="agent-settings-owner-email" className="mb-1 block">
                    Owner Email
                  </Label>
                  <Input
                    id="agent-settings-owner-email"
                    type="email"
                    placeholder="sarah@example.com"
                    value={settingsDraft?.ownerEmail || ''}
                    onChange={(e) => updateSettings({ ownerEmail: e.target.value })}
                    className="text-xs"
                  />
                </div>
              </div>
            </AgentTabSection>

            {/* 2-4. Model, run limits and guardrails — all read and write real agent state */}
            <AgentRuntimeSettings
              nodes={nodes}
              edges={edges}
              graphSettings={graphSettings}
              primaryModel={settingsDraft?.model ?? agent.model ?? 'gpt-4o'}
              onPrimaryModelChange={(model) => updateSettings({ model })}
              onUpdateNodeConfig={handleUpdateNodeConfig}
              onGraphSettingsChange={(next) => {
                setGraphSettings(next);
                setIsDirty(true);
              }}
              runtime={settingsDraft?.runtime ?? {}}
              onRuntimeChange={(patch) => updateSettings({ runtime: { ...(settingsDraft?.runtime ?? {}), ...patch } })}
              readOnly={isCanvasLocked}
              onOpenModule={(agentNodeId, module) => {
                setActiveTab('build');
                void requestOpenModule(agentNodeId, { id: module });
              }}
            />

            {/* 5. API Trigger Snippet (Module 14.2 & 21.1) */}
            <AgentTabSection
              id="settings-api"
              title="REST API Execution Endpoint"
              description="Call this agent from your own code. Create and manage API keys in Deploy."
              icon={<Code2 />}
              className="gap-3"
              actions={
                <Button type="button" variant="outline" size="sm" onClick={() => setActiveTab('deploy')} className="gap-1.5 text-xs">
                  <KeyRound className="size-3.5" />
                  Manage API keys
                </Button>
              }
            >
              <CodeBlock
                language="bash"
                filename="curl-execute.sh"
                code={apiCurlSnippet('Research AI developments and summarize')}
              />
            </AgentTabSection>

            </AgentSettingsLayout>
          </AgentTabPage>
        )}
      </div>

      {/* Validation Dialog */}
      <ValidationModal
        isOpen={isValidationOpen}
        onClose={() => setIsValidationOpen(false)}
        validationResult={validationResult}
        onPublishAnyway={() => {
          setIsValidationOpen(false);
          publishMutation.mutate();
        }}
      />

      {/* Live Test Execution & Debugger Drawer */}
      {agentId && (
        <RunConsoleDrawer
          agentId={agentId}
          agentName={agent?.name ?? 'Agent'}
          nodes={nodes}
          isOpen={isTestDrawerOpen}
          onClose={() => setIsTestDrawerOpen(false)}
          onBeforeRun={async () => {
            await saveIfNeeded();
          }}
          onNodeStatuses={showRunStatuses}
          onNodeResults={setRunResults}
        />
      )}

      {/* Snapshot Version Dialog */}
      <Dialog open={isSnapshotDialogOpen} onOpenChange={setIsSnapshotDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Create Version Snapshot
            </DialogTitle>
          </DialogHeader>

          <DialogBody className="space-y-3 text-xs">
            <p className="text-muted-foreground">
              Snapshots are numbered automatically
              {isDirty ? ' — unsaved changes are saved first' : ''}.
            </p>
            <div>
              <Field label="Changelog / Notes">
                <Textarea
                  rows={3}
                  placeholder="What changed in this workflow graph?"
                  value={snapshotChangelog}
                  onChange={(e) => setSnapshotChangelog(e.target.value)}
                />
              </Field>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsSnapshotDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => createSnapshotMutation.mutate()}
              disabled={createSnapshotMutation.isPending}
            >
              Save Snapshot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VISUAL DIFF MODAL (MODULE 17.2) */}
      <Dialog open={diffModalTarget !== null} onOpenChange={(open) => !open && setDiffModalTarget(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-primary" />
              Graph Diff: Current vs {diffModalTarget?.versionTag || `v${diffModalTarget?.version}`}
            </DialogTitle>
          </DialogHeader>

          <DialogBody className="flex-1 overflow-y-auto space-y-4 text-xs">
            {(() => {
              if (!diffModalTarget) return null;
              const targetGraph = parseGraph((diffModalTarget as any).graphJson) || { nodes: [], edges: [] };
              const currentIds = new Set(nodes.map((n) => n.id));
              const targetIds = new Set(targetGraph.nodes.map((n) => n.id));

              const addedNodes = nodes.filter((n) => !targetIds.has(n.id));
              const removedNodes = targetGraph.nodes.filter((n) => !currentIds.has(n.id));
              const commonNodes = nodes.filter((n) => targetIds.has(n.id));
              const modifiedNodes = commonNodes.filter((n) => {
                const targetNode = targetGraph.nodes.find((t) => t.id === n.id);
                return (
                  targetNode &&
                  (targetNode.data?.label !== n.data?.label ||
                    JSON.stringify(targetNode.data?.config) !== JSON.stringify(n.data?.config))
                );
              });

              return (
                <div className="space-y-4">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg border border-success/20 bg-success/5 p-3">
                      <div className="text-2xs uppercase font-bold text-success-text">
                        Added Nodes
                      </div>
                      <div className="text-xl font-bold text-success">+{addedNodes.length}</div>
                    </div>
                    <div className="rounded-lg border border-warning/20 bg-warning/5 p-3">
                      <div className="text-2xs uppercase font-bold text-warning-text">
                        Modified Nodes
                      </div>
                      <div className="text-xl font-bold text-warning">~{modifiedNodes.length}</div>
                    </div>
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                      <div className="text-2xs uppercase font-bold text-destructive-text">
                        Removed Nodes
                      </div>
                      <div className="text-xl font-bold text-destructive">-{removedNodes.length}</div>
                    </div>
                  </div>

                  {/* Node Diff Breakdown */}
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="bg-surface-raised px-3 py-2 font-semibold text-xs border-b border-border">
                      Detailed Node Differences
                    </div>
                    <div className="divide-y divide-border max-h-60 overflow-y-auto">
                      {addedNodes.map((n) => (
                        <div key={n.id} className="flex items-center justify-between p-2.5 bg-success/5">
                          <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-success" />
                            <span className="font-semibold text-foreground">{String(n.data?.label ?? n.id)}</span>
                            <span className="font-mono text-2xs text-muted-foreground">({n.type})</span>
                          </div>
                          <Badge variant="success" className="text-2xs">Added in Current</Badge>
                        </div>
                      ))}

                      {modifiedNodes.map((n) => (
                        <div key={n.id} className="flex items-center justify-between p-2.5 bg-warning/5">
                          <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-warning" />
                            <span className="font-semibold text-foreground">{String(n.data?.label ?? n.id)}</span>
                            <span className="font-mono text-2xs text-muted-foreground">({n.type})</span>
                          </div>
                          <Badge variant="warning" className="text-2xs">Parameters Modified</Badge>
                        </div>
                      ))}

                      {removedNodes.map((n) => (
                        <div key={n.id} className="flex items-center justify-between p-2.5 bg-destructive/5">
                          <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-destructive" />
                            <span className="font-semibold text-foreground">{String(n.data?.label ?? n.id)}</span>
                            <span className="font-mono text-2xs text-muted-foreground">({n.type})</span>
                          </div>
                          <Badge variant="destructive" className="text-2xs">Missing in Current</Badge>
                        </div>
                      ))}

                      {addedNodes.length === 0 && modifiedNodes.length === 0 && removedNodes.length === 0 && (
                        <div className="p-4 text-center text-muted-foreground">
                          No structural differences detected between the graphs.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </DialogBody>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDiffModalTarget(null)}>
              Close
            </Button>
            {diffModalTarget && (
              <Button
                size="sm"
                onClick={() => {
                  restoreVersionMutation.mutate(diffModalTarget.version);
                  setDiffModalTarget(null);
                }}
                disabled={restoreVersionMutation.isPending}
                className="gap-1"
              >
                <RotateCcw className="size-3.5" />
                Rollback to this Version
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Node Catalog Modal for Edge Split & Empty-Space Drop */}
      <NodeCatalogModal
        isOpen={isCatalogModalOpen}
        onClose={() => {
          setIsCatalogModalOpen(false);
          setEdgeSplitContext(null);
          setDropContext(null);
        }}
        onSelectNode={handleSelectCatalogItem}
      />

      {/* Canvas Command Palette (Ctrl+K) */}
      <CanvasCommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        nodes={nodes}
        onFocusNode={handleFocusNodeById}
        onAddNode={handleSelectCatalogItem}
        onAutoLayout={() => handleAutoLayout()}
        onTestRun={() => setIsTestDrawerOpen(true)}
        onValidate={handleValidateGraph}
        onSave={() => {
          if (isDirty && !saveMutation.isPending) saveMutation.mutate();
        }}
        onPublish={() => {
          if (!publishMutation.isPending) publishMutation.mutate();
        }}
        onUndo={undo}
        onRedo={redo}
        onFitView={() => reactFlowRef.current?.fitView({ padding: 0.2, duration: 300 })}
        isLocked={isCanvasLocked}
        onToggleLock={() => {
          const next = !isCanvasLocked;
          setIsCanvasLocked(next);
          toast(next ? 'Canvas locked — editing is paused' : 'Canvas unlocked');
        }}
        onTogglePresentation={() => setIsPresentationMode((prev) => !prev)}
        onExportJson={handleExportJson}
      />

      {/* Reusable Template Export Modal */}
      <TemplateExportModal
        isOpen={isTemplateExportOpen}
        onClose={() => setIsTemplateExportOpen(false)}
        nodes={nodes}
        edges={edges}
        agentName={settingsDraft?.name || agent?.name || 'AI Workflow'}
      />
    </div>
  );
}
