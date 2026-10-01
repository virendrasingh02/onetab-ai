import { agentsApi } from '@org/api-client';
import {
  Badge,
  Button,
  CodeBlock,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogBody,
  DialogHeader,
  DialogTitle,
  Input,
  LoadingState,
  Popover,
  PopoverContent,
  PopoverTrigger,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  ConnectionLineType,
  ConnectionMode,
  MarkerType,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  reconnectEdge,
  SelectionMode,
  useOnSelectionChange,
  useReactFlow,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import {
  Activity,
  AlertCircle,
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  ArrowUpRight,
  Award,
  Bot,
  Brain,
  Check,
  ChevronDown,
  Clock,
  Code2,
  Copy,
  Cpu,
  Download,
  Edit2,
  Eye,
  GitBranch,
  Globe,
  Layers,
  Loader2,
  Maximize2,
  MessageSquare,
  Network,
  Palette,
  Play,
  Plus,
  Radio,
  Redo,
  RotateCcw,
  Save,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  Tag,
  Trash2,
  Undo,
  Upload,
  Variable,
  Wand2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AGENT_ICONS,
  AgentAvatar,
  DEFAULT_CATEGORIES,
  THEME_COLORS,
} from '../data/agent-metadata.js';
import { useStudioSession } from '../session-guard.js';
import { STUDIO_NODE_TYPES } from '../components/workflow-canvas/custom-nodes.js';
import { STUDIO_EDGE_TYPES } from '../components/workflow-canvas/custom-edges.jsx';
import { CanvasContextMenu } from '../components/workflow-canvas/canvas-context-menu.jsx';
import { NodeCatalogModal } from '../components/workflow-canvas/node-catalog-modal.js';
import { NodeInspector } from '../components/workflow-canvas/node-inspector.js';
import { ValidationModal } from '../components/workflow-canvas/validation-modal.js';
import { TestDebuggerDrawer } from '../components/workflow-canvas/test-debugger-drawer.jsx';
import { NaturalLanguagePanel } from '../components/workflow-canvas/natural-language-panel.jsx';
import { MultiAgentTab } from '../components/agent-detail/multi-agent-tab.jsx';
import { MemoryTab } from '../components/agent-detail/memory-tab.jsx';
import { VariablesTab } from '../components/agent-detail/variables-tab.jsx';
import { WidgetBuilder } from '../components/agent-detail/widget-builder.jsx';
import { EvaluationsTab } from '../components/agent-detail/evaluations-tab.jsx';
import { agentService } from '../services/agentService.js';
import { workflowService } from '../services/workflowService.js';

const INITIAL_NODES: Node[] = [
  {
    id: 'start-1',
    type: 'START',
    position: { x: 100, y: 200 },
    data: {
      label: 'Workflow Trigger',
      subtitle: 'Manual execution & API trigger',
      config: { triggerType: 'MANUAL' },
    },
  },
  {
    id: 'agent-1',
    type: 'AGENT',
    position: { x: 380, y: 160 },
    data: {
      label: 'Primary Reasoner',
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
      label: 'Workflow Output',
      subtitle: 'Structured result response',
    },
  },
];

const INITIAL_EDGES: Edge[] = [
  { id: 'e1-2', source: 'start-1', target: 'agent-1', animated: true },
  { id: 'e2-3', source: 'agent-1', target: 'end-1' },
];

/** The canvas graph as the API stores it: JSON in `graphJson`. */
function parseGraph(graphJson: string | null | undefined): { nodes: Node[]; edges: Edge[] } | null {
  if (!graphJson) return null;
  try {
    const graph = JSON.parse(graphJson) as { nodes?: unknown; edges?: unknown };
    if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) return null;
    return {
      nodes: graph.nodes as Node[],
      edges: Array.isArray(graph.edges) ? (graph.edges as Edge[]) : [],
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
  selectedNode,
  onDeleteSelected,
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
}: {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onPaneClick: () => void;
  onAddNode: (newNode: Node) => void;
  onAutoLayout: () => void;
  selectedNode: Node | null;
  onDeleteSelected: () => void;
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
  onBatchAlign: (type: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom', selectedIds: string[]) => void;
  onBatchDuplicate: (selectedIds: string[]) => void;
  onBatchGroup: (selectedIds: string[]) => void;
  onInitFlow?: (instance: any) => void;
}) {
  const reactFlowInstance = useReactFlow();
  const edgeReconnectSuccessful = useRef(true);

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
  }>({ isOpen: false, x: 0, y: 0, targetNode: null });

  // Bottom Node Catalog Modal State
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);

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

  // Canvas Right-Click
  const handlePaneContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({
      isOpen: true,
      x: event.clientX,
      y: event.clientY,
      targetNode: null,
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
    });
  }, []);

  const handleAutoLayoutClick = useCallback(() => {
    onAutoLayout();
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.25, duration: 400 });
    }, 60);
  }, [onAutoLayout, reactFlowInstance]);

  return (
    <div
      className="relative flex-1 h-full w-full bg-background select-none overflow-hidden"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Floating Canvas Quick Toolbar (Docked at Bottom Center) */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-2xl border border-border bg-surface/95 backdrop-blur-md p-1.5 shadow-2xl select-none">
        {/* Highlighted Rounded Plus Button */}
        <button
          type="button"
          onClick={() => setIsCatalogOpen((prev) => !prev)}
          title="Add Node to Workflow (Ctrl+K)"
          className={cn(
            'size-8.5 rounded-full transition-all duration-200 cursor-pointer flex items-center justify-center shrink-0',
            'bg-primary text-primary-foreground shadow-md shadow-primary/30',
            'hover:bg-primary-hover hover:scale-110 hover:shadow-lg hover:shadow-primary/50 active:scale-95',
            'ring-2 ring-primary/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            isCatalogOpen && 'ring-4 ring-primary/60 scale-105 shadow-primary/50',
          )}
        >
          <Plus className="size-5 stroke-[2.5]" />
        </button>

        <div className="h-4 w-px bg-border mx-0.5" />

        <Button
          variant="ghost"
          size="xs"
          onClick={handleAutoLayoutClick}
          title="Auto arrange workflow graph cleanly"
          className="gap-1.5 text-xs font-semibold text-foreground hover:text-primary h-8 px-2.5 rounded-xl cursor-pointer"
        >
          <Wand2 className="size-3.5 text-primary" />
          <span>Auto Layout</span>
        </Button>

        <div className="h-4 w-px bg-border mx-0.5" />

        <Button
          variant="ghost"
          size="xs"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
          className="size-8 p-0 rounded-xl disabled:opacity-30 cursor-pointer"
        >
          <Undo className="size-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="xs"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Ctrl+Y)"
          className="size-8 p-0 rounded-xl disabled:opacity-30 cursor-pointer"
        >
          <Redo className="size-3.5" />
        </Button>

        <div className="h-4 w-px bg-border mx-0.5" />

        <Button
          variant="ghost"
          size="xs"
          onClick={() => reactFlowInstance.fitView({ padding: 0.2, duration: 300 })}
          title="Fit to screen"
          className="size-8 p-0 rounded-xl cursor-pointer"
        >
          <Maximize2 className="size-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="xs"
          onClick={() => reactFlowInstance.zoomIn({ duration: 250 })}
          title="Zoom In"
          className="size-8 p-0 rounded-xl cursor-pointer"
        >
          <ZoomIn className="size-3.5" />
        </Button>

        <Button
          variant="ghost"
          size="xs"
          onClick={() => reactFlowInstance.zoomOut({ duration: 250 })}
          title="Zoom Out"
          className="size-8 p-0 rounded-xl cursor-pointer"
        >
          <ZoomOut className="size-3.5" />
        </Button>

        <div className="h-4 w-px bg-border mx-0.5" />

        <Button
          variant="ghost"
          size="xs"
          onClick={onExportJson}
          title="Export Workflow JSON"
          className="size-8 p-0 rounded-xl text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <Download className="size-3.5" />
        </Button>

        {selectedNode && (
          <>
            <div className="h-4 w-px bg-border mx-0.5" />
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onDuplicateNode(selectedNode)}
              title={`Duplicate (${selectedNode.data?.label || selectedNode.id})`}
              className="size-8 p-0 rounded-xl text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <Copy className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="xs"
              onClick={onDeleteSelected}
              title={`Delete selected node (${selectedNode.data?.label || selectedNode.id})`}
              className="gap-1 text-xs font-semibold text-destructive hover:bg-destructive/10 h-8 px-2.5 rounded-xl cursor-pointer"
            >
              <Trash2 className="size-3.5" />
              <span>Delete</span>
            </Button>
          </>
        )}
      </div>

      {/* Node Catalog Grid Modal */}
      <NodeCatalogModal
        isOpen={isCatalogOpen}
        onClose={() => setIsCatalogOpen(false)}
        onSelectNode={(item) => {
          const screenCenterX = window.innerWidth / 2;
          const screenCenterY = window.innerHeight / 2;
          const position = reactFlowInstance.screenToFlowPosition({
            x: screenCenterX,
            y: screenCenterY,
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

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onReconnect={onReconnect}
        onReconnectStart={onReconnectStart}
        onReconnectEnd={onReconnectEnd}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onPaneContextMenu={handlePaneContextMenu}
        onNodeContextMenu={handleNodeContextMenu}
        nodeTypes={STUDIO_NODE_TYPES}
        edgeTypes={STUDIO_EDGE_TYPES}
        connectionMode={ConnectionMode.Loose}
        connectionLineType={ConnectionLineType.SmoothStep}
        selectionMode={SelectionMode.Partial}
        defaultEdgeOptions={{
          animated: true,
          type: 'workflow',
          markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1', width: 14, height: 14 },
          style: { strokeWidth: 2, stroke: '#6366f1' },
        }}
        snapToGrid={true}
        snapGrid={[16, 16]}
        deleteKeyCode={['Backspace', 'Delete']}
        proOptions={{ hideAttribution: true }}
        fitView
        className="bg-dot-pattern"
      >
        {/* Multi-Node Selection Alignment Panel */}
        {selectedNodes.length >= 2 && (
          <Panel position="top-right" className="!m-3">
            <div className="flex items-center gap-1 rounded-xl border border-border bg-surface/95 backdrop-blur-md p-1 shadow-lg select-none">
              <span className="text-[10px] font-bold text-foreground px-2">
                {selectedNodes.length} Selected
              </span>

              <div className="h-3.5 w-px bg-border" />

              <Button
                variant="ghost"
                size="xs"
                onClick={() => onBatchAlign('left', selectedNodes.map((n) => n.id))}
                title="Align Left"
                className="size-7 p-0"
              >
                <AlignLeft className="size-3.5" />
              </Button>

              <Button
                variant="ghost"
                size="xs"
                onClick={() => onBatchAlign('center', selectedNodes.map((n) => n.id))}
                title="Align Center"
                className="size-7 p-0"
              >
                <AlignCenter className="size-3.5" />
              </Button>

              <Button
                variant="ghost"
                size="xs"
                onClick={() => onBatchAlign('right', selectedNodes.map((n) => n.id))}
                title="Align Right"
                className="size-7 p-0"
              >
                <AlignRight className="size-3.5" />
              </Button>

              <div className="h-3.5 w-px bg-border" />

              <Button
                variant="ghost"
                size="xs"
                onClick={() => onBatchDuplicate(selectedNodes.map((n) => n.id))}
                title="Duplicate Selected Nodes"
                className="size-7 p-0"
              >
                <Copy className="size-3.5" />
              </Button>

              <Button
                variant="ghost"
                size="xs"
                onClick={() => onBatchGroup(selectedNodes.map((n) => n.id))}
                title="Group Selected Nodes into Stage Container"
                className="size-7 p-0"
              >
                <Layers className="size-3.5" />
              </Button>

              <div className="h-3.5 w-px bg-border" />

              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  selectedNodes.forEach((n) => onDeleteSelected?.());
                }}
                title="Delete Selected Nodes"
                className="size-7 p-0 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </Panel>
        )}

        <Background gap={18} size={1} />
        <MiniMap
          nodeColor={(n) => {
            const t = n.type || '';
            if (t.includes('START') || t.includes('TRIGGER')) return '#10b981';
            if (t.includes('AGENT')) return '#6366f1';
            if (t.includes('FIRECRAWL')) return '#f59e0b';
            if (t.includes('TOOL') || t.includes('MCP')) return '#6366f1';
            if (t.includes('TRANSFORM') || t.includes('CODE')) return '#0ea5e9';
            if (t.includes('IF') || t.includes('CONDITION')) return '#8b5cf6';
            if (t.includes('USER') || t.includes('APPROVAL')) return '#f43f5e';
            if (t.includes('NOTE')) return '#fbbf24';
            if (t.includes('GROUP')) return '#64748b';
            return '#a855f7';
          }}
          nodeStrokeWidth={3}
          className="!bg-card/85 !border-border !rounded-xl !shadow-sm"
          maskColor="rgba(0, 0, 0, 0.4)"
        />
      </ReactFlow>

      {/* Right Click Context Menu */}
      <CanvasContextMenu
        isOpen={contextMenu.isOpen}
        x={contextMenu.x}
        y={contextMenu.y}
        targetNode={contextMenu.targetNode}
        onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
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
        onDeleteNode={(id) => onDeleteSelected()}
        onTestNode={(node) => onTestNode(node)}
        onInspectNode={(node) => onInspectNode(node)}
      />
    </div>
  );
}

export function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const { activeWorkspace } = useStudioSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<
    'build' | 'multi_agent' | 'memory' | 'variables' | 'widget' | 'test' | 'executions' | 'versions' | 'settings'
  >('build');
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [nodes, setNodes] = useState<Node[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<Edge[]>(INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const reactFlowRef = useRef<any>(null);

  const focusNode = useCallback((node: Node) => {
    setTimeout(() => {
      if (reactFlowRef.current && node?.position) {
        const x = node.position.x + 120;
        const y = node.position.y + 60;
        try {
          reactFlowRef.current.setCenter(x, y, { zoom: 1.15, duration: 500 });
        } catch (err) {
          console.warn('Could not focus on node', err);
        }
      }
    }, 50);
  }, []);

  // History & Undo / Redo
  const [history, setHistory] = useState<Array<{ nodes: Node[]; edges: Edge[] }>>([
    { nodes: INITIAL_NODES, edges: INITIAL_EDGES },
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const pushHistory = useCallback(
    (newNodes: Node[], newEdges: Edge[]) => {
      setHistory((h) => [...h.slice(0, historyIndex + 1), { nodes: newNodes, edges: newEdges }]);
      setHistoryIndex((i) => i + 1);
    },
    [historyIndex],
  );

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setNodes(prev.nodes);
      setEdges(prev.edges);
      setHistoryIndex((i) => i - 1);
      setIsDirty(true);
      toast.info('Undo');
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setNodes(next.nodes);
      setEdges(next.edges);
      setHistoryIndex((i) => i + 1);
      setIsDirty(true);
      toast.info('Redo');
    }
  }, [history, historyIndex]);

  // Modals & Drawers
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [isTestDrawerOpen, setIsTestDrawerOpen] = useState(false);
  const [isSnapshotDialogOpen, setIsSnapshotDialogOpen] = useState(false);
  const [snapshotChangelog, setSnapshotChangelog] = useState('');
  const [diffModalTarget, setDiffModalTarget] = useState<AgentVersion | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<AgentSettingsDraft | null>(null);
  const [isPublishPopoverOpen, setIsPublishPopoverOpen] = useState(false);

  // Inline rename state in canvas header
  const [isEditingHeaderName, setIsEditingHeaderName] = useState(false);
  const [headerNameInput, setHeaderNameInput] = useState('');

  // Settings category, tag input & avatar mode state
  const [isCreatingCustomCategory, setIsCreatingCustomCategory] = useState(false);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [avatarMode, setAvatarMode] = useState<'icon' | 'upload' | 'url'>('icon');

  const agentQueryKey = ['agent-detail', activeWorkspace.id, agentId];

  // Fetch Agent Details
  const {
    data: agent,
    isLoading: isAgentLoading,
    refetch: refetchAgent,
  } = useQuery({
    queryKey: agentQueryKey,
    queryFn: async () => {
      if (!agentId) throw new Error('Agent ID required');
      try {
        const live = await agentsApi.get(activeWorkspace.id, agentId);
        if (live) return live;
      } catch {
        // Fallback to mock service
      }
      return agentService.getAgentById(activeWorkspace.id, agentId);
    },
    enabled: !!agentId && !!activeWorkspace.id,
  });

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
      try {
        const live = await agentsApi.getVersions(activeWorkspace.id, agentId);
        if (Array.isArray(live) && live.length > 0) return live;
      } catch {
        // Fallback to agentService mock
      }
      return agentService.getVersions(activeWorkspace.id, agentId);
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

  // Hydrate the canvas and the settings form whenever the stored agent changes.
  useEffect(() => {
    if (!agent) return;
    const graph = parseGraph(agent.graphJson);
    if (graph) {
      setNodes(graph.nodes);
      setEdges(graph.edges);
    }
    const config = (agent.configuration || {}) as any;
    setSettingsDraft({
      name: agent.name,
      role: agent.role || 'Autonomous Specialist',
      description: agent.description ?? '',
      model: agent.model || 'gpt-4o',
      category: config.category || 'Customer Support',
      theme: config.theme || 'emerald',
      icon: config.icon || 'Bot',
      avatar: agent.avatarUrl || config.avatar || '',
      tags: Array.isArray(config.tags) ? config.tags : ['support', 'autonomous'],
      ownerName: config.owner?.name || '',
      ownerEmail: config.owner?.email || '',
    });
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
    if (!trimmed || !agentId) {
      setIsEditingHeaderName(false);
      return;
    }
    updateSettings({ name: trimmed });
    try {
      await agentsApi.update(activeWorkspace.id, agentId, { name: trimmed });
    } catch {
      await agentService.updateAgent(activeWorkspace.id, agentId, { name: trimmed });
    }
    queryClient.invalidateQueries({ queryKey: agentQueryKey });
    queryClient.invalidateQueries({ queryKey: ['agents', activeWorkspace.id] });
    setIsEditingHeaderName(false);
    toast.success('Agent name updated');
  };

  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image size must be less than 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        updateSettings({ avatar: dataUrl });
        toast.success('Custom avatar uploaded');
      }
    };
    reader.readAsDataURL(file);
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

  /** Persists the canvas and the settings form in one request. */
  const persistAgent = async () => {
    if (!agentId) return;
    const config = (agent?.configuration || {}) as any;
    const patch: any = {
      graphJson: JSON.stringify({ nodes, edges }),
      ...(settingsDraft
        ? {
            name: settingsDraft.name.trim() || agent?.name,
            role: settingsDraft.role?.trim() || agent?.role,
            description: settingsDraft.description,
            avatarUrl: settingsDraft.avatar || null,
            model: settingsDraft.model,
            configuration: {
              ...config,
              category: settingsDraft.category,
              theme: settingsDraft.theme,
              icon: settingsDraft.icon,
              avatar: settingsDraft.avatar,
              tags: settingsDraft.tags,
              owner: {
                name: settingsDraft.ownerName,
                email: settingsDraft.ownerEmail,
              },
            },
          }
        : {}),
    };
    try {
      await agentsApi.update(activeWorkspace.id, agentId, patch);
    } catch {
      await agentService.updateAgent(activeWorkspace.id, agentId, patch);
    }
    queryClient.invalidateQueries({ queryKey: agentQueryKey });
    queryClient.invalidateQueries({ queryKey: ['agents', activeWorkspace.id] });
    setIsDirty(false);
  };

  const errorMessage = (err: unknown, fallback: string) =>
    err instanceof Error && err.message ? err.message : fallback;

  // Mutations
  const saveMutation = useMutation({
    mutationFn: persistAgent,
    onSuccess: () => {
      toast.success('Agent saved');
      queryClient.invalidateQueries({ queryKey: agentQueryKey });
    },
    onError: (err) => {
      toast.error(errorMessage(err, 'Failed to save the agent'));
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!agentId) return;
      // Publishing validates and snapshots the stored graph — save first.
      if (isDirty) await persistAgent();
      try {
        const res = await agentsApi.publish(
          activeWorkspace.id,
          agentId,
          `Published version ${targetPublishVersion}`,
        );
        if (res?.agent) return res;
      } catch {
        // Fallback to mock service
      }
      return agentService.publishAgent(activeWorkspace.id, agentId);
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
      try {
        await agentsApi.unpublish(activeWorkspace.id, agentId);
      } catch {
        await agentService.unpublishAgent(activeWorkspace.id, agentId);
      }
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
      if (isDirty) await persistAgent();
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
      refetchAgent();
    },
    onError: (err) => {
      toast.error(errorMessage(err, 'Failed to restore that version'));
    },
  });

  // ReactFlow Event Handlers
  // React Flow also reports selection and measured sizes as "changes"; only
  // real edits (move, add, remove…) should light the unsaved indicator.
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    if (changes.some((c) => c.type !== 'select' && c.type !== 'dimensions')) {
      setIsDirty(true);
    }
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
    if (changes.some((c) => c.type !== 'select')) setIsDirty(true);
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => {
      const updated = addEdge({ ...connection, animated: true }, eds);
      setIsDirty(true);
      return updated;
    });
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  const handleUpdateNode = useCallback((nodeId: string, updatedData: any) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === nodeId) {
          const updated = {
            ...n,
            data: {
              ...n.data,
              ...updatedData,
            },
          };
          setSelectedNode(updated);
          return updated;
        }
        return n;
      }),
    );
    setIsDirty(true);
  }, []);

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (selectedNode?.id === nodeId) {
        setSelectedNode(null);
      }
      setIsDirty(true);
      toast.info('Node deleted');
    },
    [selectedNode],
  );

  const handleAddNode = useCallback((node: Node) => {
    const withSelected: Node = {
      ...node,
      selected: true,
    };
    setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), withSelected]);
    setSelectedNode(withSelected);
    setIsDirty(true);
    focusNode(node);
    toast.success(`Added "${node.data?.label || 'Node'}" to canvas`);
  }, [focusNode]);

  const handleConnectNextNode = useCallback(
    (sourceNode: Node, item: any, handleId?: string) => {
      const newNodeId = `${item.type.toLowerCase()}-${Date.now().toString(36)}`;
      const xPos = sourceNode.position.x + 320;
      let yPos = sourceNode.position.y;
      if (handleId === 'false') {
        yPos += 90;
      } else if (handleId === 'true') {
        yPos -= 50;
      }

      const newNode: Node = {
        id: newNodeId,
        type: item.type,
        position: { x: xPos, y: yPos },
        data: {
          label: item.label,
          subtitle: item.subtitle,
          config: item.defaultConfig || {},
        },
        selected: true,
      };

      const newEdge: Edge = {
        id: `e-${sourceNode.id}-${newNodeId}-${Date.now().toString(36)}`,
        source: sourceNode.id,
        target: newNodeId,
        sourceHandle: handleId || undefined,
        animated: true,
      };

      setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), newNode]);
      setEdges((eds) => [...eds, newEdge]);
      setSelectedNode(newNode);
      setIsDirty(true);
      focusNode(newNode);
      toast.success(`Connected "${item.label}" to "${sourceNode.data?.label || 'Node'}"`);
    },
    [focusNode],
  );

  const handleAutoLayout = useCallback(
    (direction: 'LR' | 'TB' = 'LR') => {
      const layouted = workflowService.autoLayout(nodes, edges, direction);
      const newNodes = (layouted && layouted.nodes) || (Array.isArray(layouted) ? layouted : nodes);
      const newEdges = (layouted && layouted.edges) || edges;
      setNodes([...newNodes]);
      setEdges([...newEdges]);
      setIsDirty(true);
      pushHistory(newNodes, newEdges);
      toast.success('Auto-layout applied!');
    },
    [nodes, edges, pushHistory],
  );

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
      handleAddNode(newNode);
      toast.success(`Duplicated "${node.data?.label || 'Node'}"`);
    },
    [handleAddNode],
  );

  const handleDeleteEdge = useCallback((edgeId: string) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
    setIsDirty(true);
    toast.info('Connection deleted');
  }, []);

  const handleReconnectEdge = useCallback((oldEdge: Edge, newConnection: Connection) => {
    setEdges((els) => reconnectEdge(oldEdge, newConnection, els));
    setIsDirty(true);
    toast.success('Connection reconnected');
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
        const newId = `${n.type?.toLowerCase() || 'node'}-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`;
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

  // Keyboard Shortcuts Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
        e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        redo();
        e.preventDefault();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        if (selectedNode) {
          handleDuplicateNode(selectedNode);
          e.preventDefault();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        publishMutation.mutate();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, selectedNode, handleDuplicateNode, publishMutation]);

  const handleValidateGraph = async () => {
    if (!agentId) return;
    try {
      // Validates what is on the canvas now, saved or not.
      const res = await agentsApi.validate(
        activeWorkspace.id,
        agentId,
        JSON.stringify({ nodes, edges }),
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
      {/* Top Navbar */}
      <header className="flex h-13 shrink-0 items-center justify-between border-b border-border bg-card/95 backdrop-blur-xs px-3.5 gap-2 z-30 select-none">
        {/* Left: Back, Identity, Status */}
        <div className="flex items-center gap-2 shrink-0 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/agents')}
            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-raised shrink-0"
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
                  size="sm"
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

            <div className="h-3.5 w-px bg-border/80 shrink-0 mx-0.5" />

            {isPublished ? (
              <Badge variant="success" className="text-[10px] h-5 px-1.5 py-0 font-medium shrink-0">
                Published
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] h-5 px-1.5 py-0 text-muted-foreground font-medium shrink-0">
                Draft
              </Badge>
            )}

            <div className="h-3.5 w-px bg-border/80 shrink-0 mx-0.5 hidden xl:block" />

            {/* Auto-saved / Unsaved Status */}
            <div className="hidden xl:flex items-center shrink-0">
              {isDirty ? (
                <span className="text-[11px] text-warning flex items-center gap-1 font-medium whitespace-nowrap" title="Unsaved changes on canvas">
                  <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
                  Unsaved
                </span>
              ) : (
                <span className="text-[11px] text-success/90 flex items-center gap-1 font-medium whitespace-nowrap" title="All changes saved">
                  <Check className="h-3 w-3" />
                  Saved
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Center: Tabs */}
        <div className="flex items-center gap-0.5 rounded-lg bg-surface-raised/70 p-1 border border-border/60 shrink-0 overflow-x-auto no-scrollbar">
          {[
            { id: 'build', label: 'Canvas', icon: GitBranch },
            { id: 'multi_agent', label: 'Multi-Agent', icon: Network },
            { id: 'memory', label: 'Memory', icon: Brain },
            { id: 'variables', label: 'Variables', icon: Variable },
            { id: 'widget', label: 'Widget', icon: MessageSquare },
            { id: 'executions', label: 'Executions', icon: Activity },
            { id: 'evaluations', label: 'Evaluation', icon: Award },
            { id: 'versions', label: 'Versions', icon: Clock },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap shrink-0 transition-all select-none cursor-pointer',
                  isActive
                    ? 'bg-card text-foreground font-semibold shadow-2xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-card/40',
                )}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant={showAiPanel ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setShowAiPanel(!showAiPanel)}
            className={cn(
              "h-8 gap-1.5 text-xs font-medium rounded-lg",
              showAiPanel ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            )}
            title="Toggle AI Copilot"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="hidden 2xl:inline">Copilot</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleValidateGraph}
            className="h-8 gap-1.5 text-xs font-medium rounded-lg text-muted-foreground hover:text-foreground border-border/80"
            title="Validate workflow graph for errors"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span className="hidden xl:inline">Validate</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsTestDrawerOpen(true)}
            className="h-8 gap-1.5 text-xs font-medium rounded-lg border-success/30 bg-success/10 text-success hover:bg-success/20"
            title="Test run this agent workflow"
          >
            <Play className="h-3.5 w-3.5 fill-success" />
            <span>Test Run</span>
          </Button>

          {/* Save Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !isDirty}
            className={cn(
              "h-8 gap-1.5 text-xs rounded-lg transition-all",
              isDirty
                ? "border-warning/40 text-warning bg-warning/10 hover:bg-warning/20 font-medium"
                : "border-border/60 text-muted-foreground hover:text-foreground"
            )}
            title={isDirty ? "Save unsaved changes" : "All changes saved"}
          >
            <Save className="h-3.5 w-3.5" />
            <span>Save</span>
          </Button>

          {/* Publish Dropdown Popover matching reference design */}
          <Popover open={isPublishPopoverOpen} onOpenChange={setIsPublishPopoverOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg bg-primary hover:bg-primary-hover active:bg-primary/90",
                  "text-primary-foreground px-3.5 h-8 text-xs font-semibold shadow-xs transition-all duration-150 select-none cursor-pointer focus:outline-hidden",
                  isPublishPopoverOpen && "ring-2 ring-primary/40"
                )}
              >
                <span>Publish</span>
                <ChevronDown className={cn("size-3.5 transition-transform duration-200", isPublishPopoverOpen && "rotate-180")} />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              sideOffset={8}
              className="w-80 rounded-2xl border border-border bg-card/95 p-3.5 shadow-2xl backdrop-blur-md text-foreground"
            >
              {/* Status & Timeline Section */}
              <div className="relative pl-6 py-1">
                {/* Vertical Track Line */}
                <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-border/80" />

                {/* Top: Publish Status */}
                <div className="relative flex items-center gap-2 mb-3">
                  <div
                    className={cn(
                      "absolute -left-6 size-3.5 rounded-full border-2 bg-card flex items-center justify-center",
                      isPublished ? "border-success bg-success/20" : "border-muted-foreground/60"
                    )}
                  >
                    {isPublished && <div className="size-1.5 rounded-full bg-success" />}
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">
                    {isPublished ? `Published · ${targetPublishVersion} live` : 'Not published yet'}
                  </span>
                </div>

                {/* Center: Big Publish Action Button */}
                <div className="my-2.5 -ml-3">
                  <button
                    type="button"
                    onClick={async () => {
                      await publishMutation.mutateAsync();
                      setIsPublishPopoverOpen(false);
                    }}
                    disabled={publishMutation.isPending}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover active:bg-primary/90",
                      "text-primary-foreground py-2.5 px-3 text-xs font-semibold shadow-md transition-all select-none cursor-pointer",
                      "disabled:opacity-60 disabled:cursor-not-allowed"
                    )}
                  >
                    {publishMutation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : null}
                    <span>{isPublished ? 'Publish update' : 'Publish'}</span>
                    <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-mono font-bold text-white shadow-2xs">
                      {targetPublishVersion}
                    </span>
                    <div className="flex items-center gap-1 ml-1">
                      <kbd className="rounded bg-white/20 px-1.5 py-0.5 text-[9px] font-medium font-sans text-white/95 leading-none">
                        Ctrl Shift
                      </kbd>
                      <kbd className="rounded bg-white/20 px-1.5 py-0.5 text-[9px] font-medium font-sans text-white/95 leading-none">
                        P
                      </kbd>
                    </div>
                  </button>
                </div>

                {/* Bottom: Auto-save status */}
                <div className="relative flex items-center gap-2 mt-3">
                  <div
                    className={cn(
                      "absolute -left-6 size-3.5 rounded-full border-2 bg-card flex items-center justify-center",
                      isDirty ? "border-warning bg-warning/20" : "border-success/80 bg-success/20"
                    )}
                  >
                    <div className={cn("size-1.5 rounded-full", isDirty ? "bg-warning animate-pulse" : "bg-success")} />
                  </div>
                  <span className="text-xs text-muted-foreground font-medium">
                    {isDirty ? 'Auto-Saved · unsaved changes' : 'Auto-Saved · in a few seconds'}
                  </span>
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border my-3" />

              {/* Links & Endpoints */}
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsPublishPopoverOpen(false);
                    const url = `https://onetab.ai/agent/${agent.id}`;
                    window.open(url, '_blank');
                    toast.info('Opened web app preview');
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-medium text-foreground hover:bg-surface-raised transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-surface-raised border border-border/60 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                      <Globe className="size-4" />
                    </div>
                    <span>Open web app</span>
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsPublishPopoverOpen(false);
                    const snippet = `curl -X POST "https://api.onetab.ai/v1/workspaces/${activeWorkspace.id}/agents/${agent.id}/execute" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Execute task"}'`;
                    navigator.clipboard.writeText(snippet);
                    toast.success('Copied API Access Point cURL endpoint');
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-medium text-foreground hover:bg-surface-raised transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-surface-raised border border-border/60 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                      <Radio className="size-4" />
                    </div>
                    <span>Access Point</span>
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    setIsPublishPopoverOpen(false);
                    try {
                      await agentsApi.update(activeWorkspace.id, agent.id, { isMarketplace: true });
                    } catch {
                      // Fallback
                    }
                    toast.success('Published to workspace marketplace catalog!');
                  }}
                  className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-medium text-foreground hover:bg-surface-raised transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-lg bg-surface-raised border border-border/60 flex items-center justify-center text-muted-foreground group-hover:text-primary transition-colors">
                      <Store className="size-4" />
                    </div>
                    <span>Publish to Marketplace</span>
                  </div>
                  <ArrowUpRight className="size-4 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
                </button>

                {isPublished && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsPublishPopoverOpen(false);
                      unpublishMutation.mutate();
                    }}
                    disabled={unpublishMutation.isPending}
                    className="w-full flex items-center justify-between p-2 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors group cursor-pointer mt-1"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="size-8 rounded-lg bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
                        <RotateCcw className="size-4" />
                      </div>
                      <span>Unpublish Agent</span>
                    </div>
                    <span className="text-[10px] text-destructive/80 font-normal">Revert to Draft</span>
                  </button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </header>

      {/* Main Tab Views */}
      <div className="flex-1 overflow-hidden">
        {/* TAB 1: BUILD CANVAS */}
        {activeTab === 'build' && (
          <div className="flex h-full w-full overflow-hidden">
            {/* Full-Width Workflow Canvas */}
            <ReactFlowProvider>
              <WorkflowCanvasInner
                nodes={nodes.map((n) => ({
                  ...n,
                  data: {
                    ...n.data,
                    onTest: () => setIsTestDrawerOpen(true),
                    onDuplicate: () => handleDuplicateNode(n),
                    onDelete: () => handleDeleteNode(n.id),
                    onConnectNext: (item: any, handleId?: string) =>
                      handleConnectNextNode(n, item, handleId),
                  },
                }))}
                edges={edges.map((e) => ({
                  ...e,
                  type: 'workflow',
                  markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1', width: 14, height: 14 },
                  data: {
                    ...e.data,
                    onDelete: (id: string) => handleDeleteEdge(id),
                  },
                }))}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                onAddNode={handleAddNode}
                onAutoLayout={handleAutoLayout}
                selectedNode={selectedNode}
                onDeleteSelected={() => selectedNode && handleDeleteNode(selectedNode.id)}
                onDuplicateNode={handleDuplicateNode}
                onTestNode={() => setIsTestDrawerOpen(true)}
                onInspectNode={(node) => setSelectedNode(node)}
                onDeleteEdge={handleDeleteEdge}
                onReconnectEdge={handleReconnectEdge}
                canUndo={historyIndex > 0}
                canRedo={historyIndex < history.length - 1}
                onUndo={undo}
                onRedo={redo}
                onExportJson={handleExportJson}
                onBatchAlign={handleBatchAlign}
                onBatchDuplicate={handleBatchDuplicate}
                onBatchGroup={handleBatchGroup}
                onInitFlow={(instance) => {
                  reactFlowRef.current = instance;
                }}
              />
            </ReactFlowProvider>

            {/* Right 3rd Panel: Node Inspector (opens only when a node is selected) */}
            {selectedNode && (
              <NodeInspector
                selectedNode={selectedNode}
                onUpdateNode={handleUpdateNode}
                onDeleteNode={handleDeleteNode}
                onClose={() => setSelectedNode(null)}
                className="w-80 shrink-0 border-l border-border"
              />
            )}

            {/* Right 4th Panel: AI Copilot Prompt Assistant (if open) */}
            {showAiPanel && (
              <NaturalLanguagePanel
                nodes={nodes}
                edges={edges}
                onApplyDiff={(diff) => {
                  if (diff.addedNodes && diff.addedNodes.length > 0) {
                    setNodes((nds) => [...nds, ...diff.addedNodes]);
                  }
                  if (diff.modifiedNodes && diff.modifiedNodes.length > 0) {
                    setNodes((nds) =>
                      nds.map((n) => {
                        const match = diff.modifiedNodes.find((m) => m.id === n.id);
                        return match || n;
                      }),
                    );
                  }
                  setIsDirty(true);
                }}
                onClose={() => setShowAiPanel(false)}
              />
            )}
          </div>
        )}

        {/* TAB 2: MULTI-AGENT SWARM */}
        {activeTab === 'multi_agent' && (
          <MultiAgentTab
            agent={agent}
            onSave={async (patch) => {
              if (!agentId) return;
              try {
                await agentsApi.update(activeWorkspace.id, agentId, patch);
              } catch {
                await agentService.updateAgent(activeWorkspace.id, agentId, patch);
              }
              queryClient.invalidateQueries({ queryKey: agentQueryKey });
              toast.success('Multi-agent swarm saved');
            }}
          />
        )}

        {/* TAB 3: MEMORY & RETENTION */}
        {activeTab === 'memory' && (
          <MemoryTab
            agent={agent}
            onUpdate={async (patch) => {
              if (!agentId) return;
              try {
                await agentsApi.update(activeWorkspace.id, agentId, patch);
              } catch {
                await agentService.updateAgent(activeWorkspace.id, agentId, patch);
              }
              queryClient.invalidateQueries({ queryKey: agentQueryKey });
              toast.success('Memory policies updated');
            }}
          />
        )}

        {/* TAB 4: VARIABLES & EXPRESSIONS */}
        {activeTab === 'variables' && (
          <VariablesTab />
        )}

        {/* TAB 5: CHAT WIDGET BUILDER */}
        {activeTab === 'widget' && (
          <WidgetBuilder
            agent={agent}
            onUpdate={async (patch) => {
              if (!agentId) return;
              try {
                await agentsApi.update(activeWorkspace.id, agentId, patch);
              } catch {
                await agentService.updateAgent(activeWorkspace.id, agentId, patch);
              }
              queryClient.invalidateQueries({ queryKey: agentQueryKey });
              toast.success('Widget settings updated');
            }}
          />
        )}

        {/* TAB 3: EXECUTIONS */}
        {activeTab === 'executions' && (
          <div className="flex-1 space-y-4 p-6 overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">Execution History for {agent.name}</h2>
                <p className="text-xs text-muted-foreground">
                  History of workflow runs, token counts, and execution step breakdowns.
                </p>
              </div>
            </div>

            {executions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
                <Bot className="h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="text-sm font-semibold text-foreground">No executions yet</h3>
                <p className="text-xs text-muted-foreground max-w-xs mt-1">
                  Run a test execution from the canvas or trigger via API to see traces here.
                </p>
                <Button
                  size="sm"
                  onClick={() => setIsTestDrawerOpen(true)}
                  className="mt-4 gap-1.5 text-xs"
                >
                  <Play className="h-3.5 w-3.5" />
                  Run First Test
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {executions.map((exec) => (
                  <div
                    key={exec.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border bg-card p-3.5 hover:border-primary/40 transition-colors"
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
                          className="text-[10px]"
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
              </div>
            )}
          </div>
        )}

        {/* TAB: EVALUATION & BENCHMARKS */}
        {activeTab === 'evaluations' && (
          <EvaluationsTab
            agent={agent}
            onUpdate={async (patch) => {
              if (!agentId) return;
              try {
                await agentsApi.update(activeWorkspace.id, agentId, patch);
              } catch {
                await agentService.updateAgent(activeWorkspace.id, agentId, patch);
              }
              queryClient.invalidateQueries({ queryKey: agentQueryKey });
              toast.success('Evaluation configuration updated');
            }}
          />
        )}

        {/* TAB 4: VERSIONS */}
        {activeTab === 'versions' && (
          <div className="flex-1 space-y-4 p-6 overflow-y-auto max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">Version Snapshots & Rollback</h2>
                <p className="text-xs text-muted-foreground">
                  Create immutable snapshots of the workflow graph and rollback anytime.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setIsSnapshotDialogOpen(true)}
                className="gap-1.5 text-xs"
              >
                <Clock className="h-3.5 w-3.5" />
                Create Snapshot
              </Button>
            </div>

            {versions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
                <Clock className="h-10 w-10 text-muted-foreground mb-3" />
                <h3 className="text-sm font-semibold text-foreground">No snapshots created</h3>
                <p className="text-xs text-muted-foreground max-w-xs mt-1">
                  Tag your current workflow graph as a version to easily revert changes later.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {versions.map((ver) => (
                  <div
                    key={ver.version}
                    className="flex items-center justify-between rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                          {ver.versionTag ?? `v${ver.version}`}
                        </span>
                        {ver.status ? (
                          <Badge
                            variant={ver.status === 'PUBLISHED' ? 'success' : 'outline'}
                            className="text-[10px]"
                          >
                            {ver.status === 'PUBLISHED' ? 'Published' : 'Snapshot'}
                          </Badge>
                        ) : null}
                        {ver.publishedAt ? (
                          <span className="text-xs text-muted-foreground">
                            {new Date(ver.publishedAt).toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-foreground font-medium">
                        {ver.changeSummary || 'No description provided'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDiffModalTarget(ver)}
                        className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Compare Diff
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => restoreVersionMutation.mutate(ver.version)}
                        disabled={restoreVersionMutation.isPending}
                        className="gap-1.5 text-xs"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restore Graph
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="flex-1 space-y-6 p-6 overflow-y-auto max-w-4xl mx-auto">
            <div>
              <h2 className="text-base font-bold text-foreground">Agent Configuration, Intelligence & Guardrails</h2>
              <p className="text-xs text-muted-foreground">
                Fine-tune identity, model reasoning parameters, dynamic task planning, execution limits, and API integration.
              </p>
            </div>

            {/* 1. Identity & Persona (Module 5.1) */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                <Bot className="size-4 text-primary" />
                Agent Identity & Behavior
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label htmlFor="agent-settings-name" className="font-semibold text-foreground block mb-1">
                    Agent Name
                  </label>
                  <Input
                    id="agent-settings-name"
                    value={settingsDraft?.name ?? agent.name}
                    className="text-xs"
                    onChange={(e) => updateSettings({ name: e.target.value })}
                  />
                </div>

                <div>
                  <label htmlFor="agent-settings-role" className="font-semibold text-foreground block mb-1">
                    Specialist Role / Title
                  </label>
                  <Input
                    id="agent-settings-role"
                    value={settingsDraft?.role ?? agent.role ?? 'Autonomous Specialist'}
                    className="text-xs"
                    onChange={(e) => updateSettings({ role: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="agent-settings-description" className="text-xs font-semibold text-foreground block mb-1">
                  Description & Task Objectives
                </label>
                <Input
                  id="agent-settings-description"
                  value={settingsDraft?.description ?? agent.description ?? ''}
                  className="text-xs"
                  onChange={(e) => updateSettings({ description: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Communication Tone & Style
                  </label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground"
                    defaultValue="concise"
                  >
                    <option value="concise">Concise & Analytical (Default)</option>
                    <option value="friendly">Empathetic & Customer-focused</option>
                    <option value="executive">Executive & Action-oriented</option>
                    <option value="technical">Deep Technical & Code-first</option>
                  </select>
                </div>
                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Fallback Error Response
                  </label>
                  <Input
                    placeholder="I apologize, but I could not fulfill this request."
                    defaultValue="I encountered an unexpected issue while processing your request."
                    className="text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Visual Branding & Appearance */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                <Palette className="size-4 text-success" />
                Icon, Custom Avatar & Theme
              </h3>

              {/* Live Preview */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-3 rounded-lg bg-surface-raised border border-border">
                <AgentAvatar
                  agent={{
                    name: settingsDraft?.name || agent.name,
                    role: settingsDraft?.role || agent.role,
                  }}
                  icon={settingsDraft?.icon}
                  avatarUrl={settingsDraft?.avatar}
                  theme={settingsDraft?.theme}
                  size="lg"
                />
                <div className="space-y-1">
                  <div className="text-xs font-bold text-foreground flex items-center gap-2">
                    <span>{settingsDraft?.name || agent.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {settingsDraft?.category || 'General'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Theme: <span className="font-semibold capitalize text-foreground">{settingsDraft?.theme || 'emerald'}</span> •{' '}
                    Avatar: <span className="font-semibold text-foreground">{settingsDraft?.avatar ? 'Custom Image' : `Icon (${settingsDraft?.icon || 'Bot'})`}</span>
                  </p>
                </div>
              </div>

              {/* Theme Picker */}
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1.5">
                  Theme Accent Color
                </label>
                <div className="flex flex-wrap gap-2">
                  {THEME_COLORS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => updateSettings({ theme: t.id })}
                      className={cn(
                        'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs border transition-all',
                        settingsDraft?.theme === t.id
                          ? 'border-primary ring-2 ring-primary/20 font-bold bg-primary/5 text-foreground'
                          : 'border-border text-muted-foreground hover:border-foreground/30',
                      )}
                    >
                      <span className={cn('h-3 w-3 rounded-full', t.bg)} />
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Avatar / Icon Source Selection */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 border-b border-border pb-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setAvatarMode('icon')}
                    className={cn(
                      'px-2.5 py-1 rounded font-medium transition-colors',
                      avatarMode === 'icon'
                        ? 'bg-primary text-primary-foreground font-bold'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Icon Library
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvatarMode('upload')}
                    className={cn(
                      'px-2.5 py-1 rounded font-medium transition-colors',
                      avatarMode === 'upload'
                        ? 'bg-primary text-primary-foreground font-bold'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Upload Image
                  </button>
                  <button
                    type="button"
                    onClick={() => setAvatarMode('url')}
                    className={cn(
                      'px-2.5 py-1 rounded font-medium transition-colors',
                      avatarMode === 'url'
                        ? 'bg-primary text-primary-foreground font-bold'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    Image URL
                  </button>
                </div>

                {avatarMode === 'icon' && (
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground">Select an icon from the built-in library:</p>
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                      {AGENT_ICONS.map((item) => {
                        const IconComponent = item.icon;
                        const isSelected = settingsDraft?.icon === item.name && !settingsDraft?.avatar;
                        return (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => updateSettings({ icon: item.name, avatar: '' })}
                            title={item.label}
                            className={cn(
                              'flex h-10 w-10 items-center justify-center rounded-lg border transition-all',
                              isSelected
                                ? 'border-primary bg-primary/10 text-primary ring-2 ring-primary/30 shadow-xs'
                                : 'border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground hover:bg-surface-raised',
                            )}
                          >
                            <IconComponent className="h-4 w-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {avatarMode === 'upload' && (
                  <div className="space-y-3">
                    <p className="text-[11px] text-muted-foreground">Upload an avatar image (PNG, JPG, SVG, max 2MB):</p>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-border px-4 py-2 hover:bg-surface-raised transition-colors">
                        <Upload className="h-4 w-4 text-primary" />
                        <span className="text-xs font-medium text-foreground">Choose image file</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarFileUpload}
                        />
                      </label>
                      {settingsDraft?.avatar && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateSettings({ avatar: '' })}
                          className="text-xs text-destructive hover:text-destructive/80 h-8"
                        >
                          Clear Custom Image
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {avatarMode === 'url' && (
                  <div className="space-y-2">
                    <label htmlFor="settings-avatar-url" className="text-[11px] text-muted-foreground block">
                      Direct Image Web Link:
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="settings-avatar-url"
                        placeholder="https://example.com/agent-avatar.png"
                        value={settingsDraft?.avatar || ''}
                        onChange={(e) => updateSettings({ avatar: e.target.value })}
                        className="text-xs flex-1"
                      />
                      {settingsDraft?.avatar && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateSettings({ avatar: '' })}
                          className="text-xs text-muted-foreground h-8"
                        >
                          Clear
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Categorization, Tags & Ownership */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                <Tag className="size-4 text-accent-blue" />
                Category, Tags & Ownership
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {/* Category with create custom */}
                <div>
                  <label htmlFor="agent-settings-cat" className="font-semibold text-foreground block mb-1">
                    Category
                  </label>
                  {!isCreatingCustomCategory ? (
                    <div className="flex items-center gap-2">
                      <select
                        id="agent-settings-cat"
                        value={settingsDraft?.category || 'Customer Support'}
                        onChange={(e) => updateSettings({ category: e.target.value })}
                        className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground"
                      >
                        {availableCategories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
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
                  <label className="font-semibold text-foreground block mb-1">
                    Tags
                  </label>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Input
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
                        className="inline-flex items-center gap-1 rounded-md bg-surface-raised px-2 py-0.5 text-[11px] font-medium text-foreground border border-border"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(t)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                    {(settingsDraft?.tags || []).length === 0 && (
                      <span className="text-[11px] text-muted-foreground italic">No tags assigned</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Owner */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1 border-t border-border">
                <div>
                  <label htmlFor="agent-settings-owner-name" className="font-semibold text-foreground block mb-1">
                    Agent Owner Name
                  </label>
                  <Input
                    id="agent-settings-owner-name"
                    placeholder="e.g. Sarah Jenkins"
                    value={settingsDraft?.ownerName || ''}
                    onChange={(e) => updateSettings({ ownerName: e.target.value })}
                    className="text-xs"
                  />
                </div>
                <div>
                  <label htmlFor="agent-settings-owner-email" className="font-semibold text-foreground block mb-1">
                    Owner Email
                  </label>
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
            </div>

            {/* 2. Model & Inference Configuration (Module 5.2) */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                <Cpu className="size-4 text-accent-violet" />
                Foundation Model & Sampling Configuration
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label htmlFor="agent-settings-model" className="font-semibold text-foreground block mb-1">
                    Primary Reasoning Model
                  </label>
                  <select
                    id="agent-settings-model"
                    value={settingsDraft?.model ?? agent.model ?? 'gpt-4o'}
                    onChange={(e) => updateSettings({ model: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground"
                  >
                    <option value="gpt-4o">OpenAI GPT-4o (Omni multimodal)</option>
                    <option value="gpt-4o-mini">OpenAI GPT-4o Mini (Fast & economical)</option>
                    <option value="claude-3-5-sonnet">Anthropic Claude 3.5 Sonnet</option>
                    <option value="gemini-1.5-pro">Google Gemini 1.5 Pro</option>
                    <option value="llama3:latest">Ollama Llama 3 (Self-hosted)</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-foreground block mb-1">
                    Fallback Model (High Availability)
                  </label>
                  <select
                    className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs text-foreground"
                    defaultValue="claude-3-5-sonnet"
                  >
                    <option value="claude-3-5-sonnet">Anthropic Claude 3.5 Sonnet</option>
                    <option value="gpt-4o-mini">OpenAI GPT-4o Mini</option>
                    <option value="none">No Fallback (Fail Fast)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-1">
                <div>
                  <div className="flex justify-between font-semibold text-foreground mb-1">
                    <span>Temperature</span>
                    <span className="text-muted-foreground font-mono">0.3</span>
                  </div>
                  <input type="range" min="0" max="1" step="0.05" defaultValue="0.3" className="w-full accent-primary" />
                </div>
                <div>
                  <div className="flex justify-between font-semibold text-foreground mb-1">
                    <span>Max Output Tokens</span>
                    <span className="text-muted-foreground font-mono">4,096</span>
                  </div>
                  <input type="range" min="512" max="8192" step="256" defaultValue="4096" className="w-full accent-primary" />
                </div>
                <div className="flex items-center justify-between pt-4">
                  <span className="font-semibold text-foreground">Stream Token Output</span>
                  <input type="checkbox" defaultChecked className="rounded border-border accent-primary" />
                </div>
              </div>
            </div>

            {/* 3. Planning & Execution Controls (Module 5.4) */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                <Network className="size-4 text-success" />
                Autonomous Planning & Step Limits
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Max Reasoning Steps</label>
                  <Input type="number" defaultValue="8" min="1" max="25" className="h-8 text-xs" />
                  <span className="text-[10px] text-muted-foreground">Limits loop iterations before stopping</span>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Execution Timeout (Sec)</label>
                  <Input type="number" defaultValue="90" min="10" max="600" className="h-8 text-xs" />
                  <span className="text-[10px] text-muted-foreground">Terminates frozen web requests or tools</span>
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">Per-Turn Budget Cap ($)</label>
                  <Input type="number" defaultValue="0.25" step="0.01" className="h-8 text-xs" />
                  <span className="text-[10px] text-muted-foreground">Maximum token expense allowed per run</span>
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                <div>
                  <span className="font-semibold text-foreground block">Dynamic Replanning on Failure</span>
                  <span className="text-[10px] text-muted-foreground">Allows agent to select alternative tools if primary tool fails</span>
                </div>
                <input type="checkbox" defaultChecked className="rounded border-border accent-primary" />
              </div>
            </div>

            {/* 4. Guardrails & Safety Defenses (Module 18.2) */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                <ShieldCheck className="size-4 text-accent-blue" />
                Enterprise Safety & Guardrail Policies
              </h3>
              <div className="space-y-2 text-xs">
                <label className="flex items-center justify-between p-2 rounded-lg bg-surface-raised/40 hover:bg-surface-raised cursor-pointer">
                  <div>
                    <span className="font-semibold text-foreground block">Prompt Injection Defense</span>
                    <span className="text-[10px] text-muted-foreground">Pre-scans inbound inputs for jailbreak and system-override attempts</span>
                  </div>
                  <input type="checkbox" defaultChecked className="rounded border-border accent-primary" />
                </label>
                <label className="flex items-center justify-between p-2 rounded-lg bg-surface-raised/40 hover:bg-surface-raised cursor-pointer">
                  <div>
                    <span className="font-semibold text-foreground block">Automatic PII Redaction</span>
                    <span className="text-[10px] text-muted-foreground">Masks credit cards, social security numbers, and emails before model ingestion</span>
                  </div>
                  <input type="checkbox" defaultChecked className="rounded border-border accent-primary" />
                </label>
                <label className="flex items-center justify-between p-2 rounded-lg bg-surface-raised/40 hover:bg-surface-raised cursor-pointer">
                  <div>
                    <span className="font-semibold text-foreground block">Human Sign-off on Outbound Dispatches</span>
                    <span className="text-[10px] text-muted-foreground">Requires human manager approval for emails, database deletes, and external API posts</span>
                  </div>
                  <input type="checkbox" defaultChecked className="rounded border-border accent-primary" />
                </label>
              </div>
            </div>

            {/* 5. API Trigger Snippet (Module 14.2 & 21.1) */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                <Code2 className="h-4 w-4 text-primary" />
                REST API Execution Endpoint
              </h3>
              <CodeBlock
                language="bash"
                filename="curl-execute.sh"
                code={`curl -X POST "https://api.onetab.ai/v1/workspaces/${activeWorkspace.id}/agents/${agent.id}/execute" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Research AI developments and summarize"}'`}
              />
            </div>

            {/* Save Settings Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
              <div>
                <h4 className="text-xs font-bold text-foreground">Save Configuration Changes</h4>
                <p className="text-[11px] text-muted-foreground">
                  Persist all identity, visual styling, category, owner, and model parameter changes to the workspace.
                </p>
              </div>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="gap-1.5 shrink-0"
              >
                <Save className="h-4 w-4" />
                {saveMutation.isPending ? 'Saving...' : 'Save Agent Settings'}
              </Button>
            </div>
          </div>
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
      <TestDebuggerDrawer
        agent={agent}
        nodes={nodes}
        edges={edges}
        isOpen={isTestDrawerOpen}
        onClose={() => setIsTestDrawerOpen(false)}
      />

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
              <label htmlFor="agent-snapshot-notes" className="font-semibold text-foreground block mb-1">
                Changelog / Notes
              </label>
              <Input
                id="agent-snapshot-notes"
                placeholder="What changed in this workflow graph?"
                value={snapshotChangelog}
                onChange={(e) => setSnapshotChangelog(e.target.value)}
                className="text-xs"
              />
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
                      <div className="text-[10px] uppercase font-bold text-success-text">
                        Added Nodes
                      </div>
                      <div className="text-xl font-bold text-success">+{addedNodes.length}</div>
                    </div>
                    <div className="rounded-lg border border-warning/20 bg-warning/5 p-3">
                      <div className="text-[10px] uppercase font-bold text-warning-text">
                        Modified Nodes
                      </div>
                      <div className="text-xl font-bold text-warning">~{modifiedNodes.length}</div>
                    </div>
                    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                      <div className="text-[10px] uppercase font-bold text-destructive-text">
                        Removed Nodes
                      </div>
                      <div className="text-xl font-bold text-destructive">-{removedNodes.length}</div>
                    </div>
                  </div>

                  {/* Node Diff Breakdown */}
                  <div className="rounded-lg border border-border overflow-hidden">
                    <div className="bg-surface-raised px-3 py-2 font-semibold text-[11px] border-b border-border">
                      Detailed Node Differences
                    </div>
                    <div className="divide-y divide-border max-h-60 overflow-y-auto">
                      {addedNodes.map((n) => (
                        <div key={n.id} className="flex items-center justify-between p-2.5 bg-success/5">
                          <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-success" />
                            <span className="font-semibold text-foreground">{n.data?.label || n.id}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">({n.type})</span>
                          </div>
                          <Badge variant="success" className="text-[10px]">Added in Current</Badge>
                        </div>
                      ))}

                      {modifiedNodes.map((n) => (
                        <div key={n.id} className="flex items-center justify-between p-2.5 bg-warning/5">
                          <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-warning" />
                            <span className="font-semibold text-foreground">{n.data?.label || n.id}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">({n.type})</span>
                          </div>
                          <Badge variant="warning" className="text-[10px]">Parameters Modified</Badge>
                        </div>
                      ))}

                      {removedNodes.map((n) => (
                        <div key={n.id} className="flex items-center justify-between p-2.5 bg-destructive/5">
                          <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-destructive" />
                            <span className="font-semibold text-foreground">{n.data?.label || n.id}</span>
                            <span className="font-mono text-[10px] text-muted-foreground">({n.type})</span>
                          </div>
                          <Badge variant="destructive" className="text-[10px]">Missing in Current</Badge>
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
    </div>
  );
}
