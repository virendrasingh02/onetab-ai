import { agentsApi } from '@org/api-client';
import { Badge, Button, Dialog, DialogContent, DialogFooter, DialogBody,
  DialogHeader, DialogTitle, Input, LoadingState, toast } from '@org/ui';
import { cn } from '@org/utils';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
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
  ArrowLeft,
  Bot,
  Check,
  Clock,
  Code2,
  Copy,
  GitBranch,
  Play,
  RotateCcw,
  Save,
  Settings,
  Share2,
  ShieldCheck,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useStudioSession } from '../session-guard.js';
import { STUDIO_NODE_TYPES } from '../components/workflow-canvas/custom-nodes.js';
import { NodeLibrary } from '../components/workflow-canvas/node-library.js';
import { NodeInspector } from '../components/workflow-canvas/node-inspector.js';
import { ValidationModal } from '../components/workflow-canvas/validation-modal.js';
import { TestConsoleDrawer } from '../components/workflow-canvas/test-console-drawer.js';

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
  description: string;
  model: string;
}

function WorkflowCanvasInner({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onPaneClick,
  onDropNode,
}: {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onNodeClick: (event: React.MouseEvent, node: Node) => void;
  onPaneClick: () => void;
  onDropNode: (event: React.DragEvent) => void;
}) {
  const reactFlowInstance = useReactFlow();

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

        onDropNode(event);
        // Add to nodes
        onNodesChange([
          {
            type: 'add',
            item: newNode,
          } as any,
        ]);
      } catch (e) {
        console.error('Failed to drop node', e);
      }
    },
    [reactFlowInstance, onDropNode, onNodesChange],
  );

  return (
    <div
      className="relative flex-1 h-full w-full bg-background select-none"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        nodeTypes={STUDIO_NODE_TYPES}
        fitView
        className="bg-dot-pattern"
      >
        <Controls className="!bg-card !border-border !shadow-sm !rounded-lg" />
        <Background gap={18} size={1} />
        <MiniMap
          nodeStrokeWidth={3}
          className="!bg-card/80 !border-border !rounded-xl"
          maskColor="rgba(0, 0, 0, 0.4)"
        />
      </ReactFlow>
    </div>
  );
}

export function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const { activeWorkspace } = useStudioSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'build' | 'test' | 'executions' | 'versions' | 'settings'>('build');
  const [nodes, setNodes] = useState<Node[]>(INITIAL_NODES);
  const [edges, setEdges] = useState<Edge[]>(INITIAL_EDGES);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  // Modals & Drawers
  const [isValidationOpen, setIsValidationOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<any | null>(null);
  const [isTestDrawerOpen, setIsTestDrawerOpen] = useState(false);
  const [isSnapshotDialogOpen, setIsSnapshotDialogOpen] = useState(false);
  const [snapshotChangelog, setSnapshotChangelog] = useState('');
  const [settingsDraft, setSettingsDraft] = useState<AgentSettingsDraft | null>(null);

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
      return agentsApi.get(activeWorkspace.id, agentId);
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
    queryFn: async (): Promise<AgentVersion[]> =>
      agentId ? agentsApi.getVersions(activeWorkspace.id, agentId) : [],
    enabled: activeTab === 'versions' && !!agentId,
  });

  const isPublished =
    (agent?.configuration as { status?: string } | undefined)?.status === 'published';

  // Hydrate the canvas and the settings form whenever the stored agent changes.
  useEffect(() => {
    if (!agent) return;
    const graph = parseGraph(agent.graphJson);
    if (graph) {
      setNodes(graph.nodes);
      setEdges(graph.edges);
    }
    setSettingsDraft({
      name: agent.name,
      description: agent.description ?? '',
      model: agent.model || 'gpt-4o',
    });
    setIsDirty(false);
  }, [agent]);

  const updateSettings = (patch: Partial<AgentSettingsDraft>) => {
    setSettingsDraft((draft) => (draft ? { ...draft, ...patch } : draft));
    setIsDirty(true);
  };

  /** Persists the canvas and the settings form in one request. */
  const persistAgent = async () => {
    if (!agentId) return;
    await agentsApi.update(activeWorkspace.id, agentId, {
      graphJson: JSON.stringify({ nodes, edges }),
      ...(settingsDraft
        ? {
            name: settingsDraft.name.trim() || agent?.name,
            description: settingsDraft.description,
            model: settingsDraft.model,
          }
        : {}),
    });
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
      if (isPublished) return agentsApi.unpublish(activeWorkspace.id, agentId);
      // Publishing validates and snapshots the *stored* graph — save first.
      if (isDirty) await persistAgent();
      return agentsApi.publish(activeWorkspace.id, agentId);
    },
    onSuccess: () => {
      toast.success(isPublished ? 'Agent unpublished' : 'Agent published');
      queryClient.invalidateQueries({ queryKey: agentQueryKey });
      queryClient.invalidateQueries({ queryKey: ['agent-versions', activeWorkspace.id, agentId] });
      queryClient.invalidateQueries({ queryKey: ['workspace-agents'] });
    },
    onError: (err) => {
      toast.error(errorMessage(err, isPublished ? 'Failed to unpublish' : 'Failed to publish'));
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
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        {/* Left: Back & Title */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/agents')}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bot className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-foreground">{agent.name}</span>
                {isPublished ? (
                  <Badge variant="success" className="text-[10px] px-1.5 py-0.5">
                    Published
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground px-1.5 py-0.5">
                    Draft
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground truncate max-w-xs">
                {agent.description || 'AI Workflow Agent'}
              </p>
            </div>
          </div>
        </div>

        {/* Center: Tabs */}
        <div className="flex items-center gap-1 rounded-lg bg-surface-raised p-1 border border-border">
          {[
            { id: 'build', label: 'Build Canvas', icon: GitBranch },
            { id: 'test', label: 'Live Test', icon: Play },
            { id: 'executions', label: 'Executions', icon: Activity },
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
                  'flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors',
                  isActive
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Dirty state indicator */}
          <span className="text-[11px] text-muted-foreground mr-1">
            {isDirty ? (
              <span className="text-amber-500 flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                Unsaved changes
              </span>
            ) : (
              <span className="text-emerald-500/80 flex items-center gap-1">
                <Check className="h-3 w-3" />
                Saved
              </span>
            )}
          </span>

          <Button
            variant="outline"
            size="sm"
            onClick={handleValidateGraph}
            className="h-8 gap-1.5 text-xs"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Validate
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsTestDrawerOpen(true)}
            className="h-8 gap-1.5 text-xs text-foreground bg-accent/40"
          >
            <Play className="h-3.5 w-3.5 text-emerald-500 fill-emerald-500" />
            Test Run
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
            className="h-8 gap-1.5 text-xs"
          >
            <Share2 className="h-3.5 w-3.5" />
            {isPublished ? 'Unpublish' : 'Publish'}
          </Button>

          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !isDirty}
            className="h-8 gap-1.5 text-xs"
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>
        </div>
      </header>

      {/* Main Tab Views */}
      <div className="flex-1 overflow-hidden">
        {/* TAB 1: BUILD CANVAS */}
        {activeTab === 'build' && (
          <div className="flex h-full w-full overflow-hidden">
            {/* Left 1st Panel: Node Library */}
            <NodeLibrary className="w-72 shrink-0 border-r border-border" />

            {/* Center 2nd Panel: Workflow Canvas */}
            <ReactFlowProvider>
              <WorkflowCanvasInner
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onPaneClick={onPaneClick}
                onDropNode={() => setIsDirty(true)}
              />
            </ReactFlowProvider>

            {/* Right 3rd Panel: Node Inspector */}
            {selectedNode ? (
              <NodeInspector
                selectedNode={selectedNode}
                onUpdateNode={handleUpdateNode}
                onDeleteNode={handleDeleteNode}
                onClose={() => setSelectedNode(null)}
                className="w-80 shrink-0 border-l border-border"
              />
            ) : (
              <div className="flex w-80 shrink-0 flex-col items-center justify-center border-l border-border bg-card p-6 text-center text-muted-foreground select-none">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/50 mb-3">
                  <GitBranch className="h-6 w-6 text-muted-foreground" />
                </div>
                <h3 className="text-xs font-semibold text-foreground">No Node Selected</h3>
                <p className="mt-1 text-[11px] leading-relaxed">
                  Click any node on the canvas to configure its models, prompts, parameters, and variable bindings.
                </p>
                <div className="mt-6 w-full rounded-xl border border-border/60 bg-surface-raised p-3 text-left">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Workflow Stats
                  </div>
                  <div className="mt-2 space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Nodes:</span>
                      <span className="font-semibold text-foreground">{nodes.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Connections:</span>
                      <span className="font-semibold text-foreground">{edges.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Changes:</span>
                      <span
                        className={cn(
                          'font-semibold',
                          isDirty ? 'text-amber-500' : 'text-emerald-500',
                        )}
                      >
                        {isDirty ? 'Unsaved' : 'Saved'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: LIVE TEST */}
        {activeTab === 'test' && (
          <div className="flex h-full w-full flex-col p-6 overflow-y-auto max-w-4xl mx-auto space-y-6">
            <div>
              <h2 className="text-lg font-bold text-foreground">Interactive Agent Execution Test</h2>
              <p className="text-xs text-muted-foreground">
                Run this workflow in sandbox mode with live step logging and state inspection.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <Button
                onClick={() => setIsTestDrawerOpen(true)}
                className="gap-2"
              >
                <Play className="h-4 w-4" />
                Open Test Execution Drawer
              </Button>
            </div>
          </div>
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
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: SETTINGS */}
        {activeTab === 'settings' && (
          <div className="flex-1 space-y-6 p-6 overflow-y-auto max-w-3xl mx-auto">
            <div>
              <h2 className="text-base font-bold text-foreground">Agent Configuration & API Access</h2>
              <p className="text-xs text-muted-foreground">
                Fine-tune model defaults, system instructions, memory systems, and programmatic webhook integration.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-5 space-y-4">
              <h3 className="text-xs font-bold text-foreground">General Properties</h3>
              <div className="space-y-3">
                <div>
                  <label htmlFor="agent-settings-name" className="text-xs font-semibold text-foreground block mb-1">
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
                  <label htmlFor="agent-settings-description" className="text-xs font-semibold text-foreground block mb-1">
                    Description
                  </label>
                  <Input
                    id="agent-settings-description"
                    value={settingsDraft?.description ?? agent.description ?? ''}
                    className="text-xs"
                    onChange={(e) => updateSettings({ description: e.target.value })}
                  />
                </div>

                <div>
                  <label htmlFor="agent-settings-model" className="text-xs font-semibold text-foreground block mb-1">
                    Default Model
                  </label>
                  <select
                    id="agent-settings-model"
                    value={settingsDraft?.model ?? agent.model ?? 'gpt-4o'}
                    onChange={(e) => updateSettings({ model: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground"
                  >
                    <option value="gpt-4o">OpenAI GPT-4o (Omni multimodal)</option>
                    <option value="gpt-4o-mini">OpenAI GPT-4o Mini (Fast & economical)</option>
                    <option value="claude-3-5-sonnet">Anthropic Claude 3.5 Sonnet</option>
                    <option value="gemini-1.5-pro">Google Gemini 1.5 Pro</option>
                  </select>
                </div>
              </div>
            </div>

            {/* API Trigger Snippet */}
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-foreground flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-primary" />
                  cURL Execution Endpoint
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const snippet = `curl -X POST "https://api.onetab.ai/v1/workspaces/${activeWorkspace.id}/agents/${agent.id}/execute" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Execute task"}'`;
                    navigator.clipboard.writeText(snippet);
                    toast.success('Copied cURL snippet to clipboard');
                  }}
                  className="h-7 text-xs gap-1"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy cURL
                </Button>
              </div>
              <pre className="rounded-lg border border-border bg-muted/50 p-3 font-mono text-[11px] text-foreground overflow-x-auto">
{`curl -X POST "https://api.onetab.ai/v1/workspaces/${activeWorkspace.id}/agents/${agent.id}/execute" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Research AI developments and summarize"}'`}
              </pre>
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

      {/* Live Test Execution Drawer */}
      <TestConsoleDrawer
        agentId={agent.id}
        agentName={agent.name}
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
    </div>
  );
}
