import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Badge, Button, Card, Hint, Panel, toast } from '@org/ui';
import { cn } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Cpu,
  GitBranch,
  Globe,
  Loader2,
  Plus,
  Radio,
  Save,
  Trash2,
  Webhook,
  Workflow,
  Zap,
} from 'lucide-react';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkflowMutations } from './use-automations.js';

// Custom Node Components
function TriggerNode({ data, selected }: NodeProps) {
  return (
    <Card
      className={cn(
        'p-3 min-w-52 rounded-xl border-2 bg-surface shadow-md transition-all duration-200',
        selected
          ? 'border-accent-amber ring-2 ring-accent-amber/20'
          : 'border-accent-amber/40',
      )}
    >
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-accent-amber"
      />
      <div className="gap-2 mb-1.5 flex items-center">
        <div className="p-1.5 shrink-0 rounded-lg bg-accent-amber/10 text-accent-amber">
          <Webhook className="size-4" />
        </div>
        <div>
          <Badge variant="warning" className="px-1.5 py-0 mb-0.5 text-[9px]">
            Trigger
          </Badge>
          <h4 className="text-xs font-semibold truncate text-foreground">
            {String(data.label || 'Custom Trigger')}
          </h4>
        </div>
      </div>
      <p className="truncate font-mono text-[11px] text-muted-foreground">
        {String(data.subtitle || 'Webhook / Cron event')}
      </p>
    </Card>
  );
}

function ConditionNode({ data, selected }: NodeProps) {
  return (
    <Card
      className={cn(
        'p-3 min-w-52 rounded-xl border-2 bg-surface shadow-md transition-all duration-200',
        selected
          ? 'border-accent-blue ring-2 ring-accent-blue/20'
          : 'border-accent-blue/40',
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-accent-blue"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-accent-blue"
      />
      <div className="gap-2 mb-1.5 flex items-center">
        <div className="p-1.5 shrink-0 rounded-lg bg-accent-blue/10 text-accent-blue">
          <GitBranch className="size-4" />
        </div>
        <div>
          <Badge variant="primary" className="px-1.5 py-0 mb-0.5 text-[9px]">
            Condition
          </Badge>
          <h4 className="text-xs font-semibold truncate text-foreground">
            {String(data.label || 'Filter Logic')}
          </h4>
        </div>
      </div>
      <p className="truncate font-mono text-[11px] text-muted-foreground">
        {String(data.subtitle || 'Check payload payload.status == 200')}
      </p>
    </Card>
  );
}

function AiActionNode({ data, selected }: NodeProps) {
  return (
    <Card
      className={cn(
        'p-3 min-w-52 rounded-xl border-2 bg-surface shadow-md transition-all duration-200',
        selected
          ? 'border-accent-violet ring-2 ring-accent-violet/20'
          : 'border-accent-violet/40',
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-accent-violet"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-accent-violet"
      />
      <div className="gap-2 mb-1.5 flex items-center">
        <div className="p-1.5 shrink-0 rounded-lg bg-accent-violet/10 text-accent-violet">
          <Cpu className="size-4" />
        </div>
        <div>
          <Badge
            variant="neutral"
            className="px-1.5 py-0 mb-0.5 bg-accent-violet/15 text-[9px] text-accent-violet"
          >
            AI Agent
          </Badge>
          <h4 className="text-xs font-semibold truncate text-foreground">
            {String(data.label || 'Summarizer Agent')}
          </h4>
        </div>
      </div>
      <p className="truncate font-mono text-[11px] text-muted-foreground">
        {String(data.subtitle || 'Generate summary with Llama 3')}
      </p>
    </Card>
  );
}

function ApiActionNode({ data, selected }: NodeProps) {
  return (
    <Card
      className={cn(
        'p-3 min-w-52 rounded-xl border-2 bg-surface shadow-md transition-all duration-200',
        selected
          ? 'border-accent-green ring-2 ring-accent-green/20'
          : 'border-accent-green/40',
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-accent-green"
      />
      <div className="gap-2 mb-1.5 flex items-center">
        <div className="p-1.5 shrink-0 rounded-lg bg-accent-green/10 text-accent-green">
          <Globe className="size-4" />
        </div>
        <div>
          <Badge
            variant="neutral"
            className="px-1.5 py-0 mb-0.5 bg-accent-green/15 text-[9px] text-accent-green"
          >
            API / Webhook
          </Badge>
          <h4 className="text-xs font-semibold truncate text-foreground">
            {String(data.label || 'Matrix Channel Alert')}
          </h4>
        </div>
      </div>
      <p className="truncate font-mono text-[11px] text-muted-foreground">
        {String(data.subtitle || 'POST payload to #announcements')}
      </p>
    </Card>
  );
}

const nodeTypes = {
  triggerNode: TriggerNode,
  conditionNode: ConditionNode,
  aiActionNode: AiActionNode,
  apiActionNode: ApiActionNode,
};

/* The canvas opens empty — nodes come from the toolbar above it. */
const initialNodes: Node[] = [];
const initialEdges: Edge[] = [];

export function WorkflowCanvasView() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState('Untitled Workflow');
  const navigate = useNavigate();
  const { slug, workspaceId } = useCurrentWorkspace();
  const { create, update } = useWorkflowMutations(workspaceId);
  const isSaving = create.isPending || update.isPending;

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(`/w/${slug}/automations?tab=all`);
    }
  };

  const onConnect = useCallback(
    (params: Connection) =>
      setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges],
  );

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  };

  const addNode = (type: string, label: string, subtitle: string) => {
    const newNodeId = `node-${Date.now()}`;
    const newNode: Node = {
      id: newNodeId,
      type,
      position: {
        x: 250 + (nodes.length % 3) * 50,
        y: 200 + nodes.length * 30,
      },
      data: { label, subtitle },
    };
    setNodes((nds) => [...nds, newNode]);
    toast.success(`Added ${label}`, {
      description: 'Node placed onto canvas.',
    });
  };

  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    const label = (selectedNode.data as { label?: string })?.label || 'Node';
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) =>
      eds.filter(
        (e) => e.source !== selectedNode.id && e.target !== selectedNode.id,
      ),
    );
    setSelectedNode(null);
    toast.info(`Deleted ${label}`, {
      description: 'Node removed from workflow canvas.',
    });
  };

  const handleSave = async () => {
    if (!workspaceId) {
      toast.error('Cannot save yet', {
        description: 'Workspace is still loading — try again in a moment.',
      });
      return;
    }
    if (nodes.length === 0) {
      toast.error('Nothing to save', {
        description: 'Add at least one node to the canvas first.',
      });
      return;
    }

    const input = {
      name: workflowName.trim() || 'Untitled Workflow',
      triggerType: 'WEBHOOK',
      nodesJson: JSON.stringify(nodes),
      edgesJson: JSON.stringify(edges),
    };

    try {
      if (workflowId) {
        await update.mutateAsync({ workflowId, input });
      } else {
        const created = await create.mutateAsync(input);
        setWorkflowId(created.id);
      }
      setIsSaved(true);
      toast.success('Workflow saved', {
        description: `${nodes.length} nodes and ${edges.length} connections persisted to the workspace.`,
      });
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      toast.error('Save failed', {
        description:
          err instanceof Error
            ? err.message
            : 'Could not save the workflow graph. Nothing was persisted.',
      });
    }
  };

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      {/* Channel-style Header */}
      <div className="border-b border-border bg-background">
        <div className="gap-2.5 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between">
          <div className="min-w-0 gap-2 flex items-center">
            <Hint label="Back to Automations">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleBack}
                aria-label="Back to Automations"
                className="shrink-0 text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
              </Button>
            </Hint>

            <div className="h-4 w-px shrink-0 bg-border" />

            <div className="min-w-0 gap-2 flex items-center">
              <div className="size-7 flex shrink-0 items-center justify-center rounded-md bg-accent-amber-soft text-accent-amber">
                <Workflow className="size-4" aria-hidden />
              </div>
              <div className="min-w-0 gap-1.5 flex items-center">
                <input
                  type="text"
                  value={workflowName}
                  onChange={(e) => setWorkflowName(e.target.value)}
                  aria-label="Workflow name"
                  placeholder="Untitled Workflow"
                  className="min-w-0 px-1 -mx-1 text-sm font-semibold tracking-tight truncate rounded-md border border-transparent bg-transparent text-foreground outline-none hover:border-border focus:border-primary focus:bg-background"
                />
                <Badge
                  variant="neutral"
                  className="px-1.5 py-0 font-medium shrink-0 text-[10px]"
                >
                  Automations
                </Badge>
              </div>
            </div>

            {/* <span className="lg:inline-block text-xs max-w-md ml-1 pl-2.5 hidden truncate border-l border-border/80 text-muted-foreground">
              Design interactive automation graphs with custom triggers, AI
              agents, conditions, and API nodes. Executing conditions and
              outgoing API/webhook actions for real is not built yet — saving
              stores the graph so it is there when that lands.
            </span> */}
          </div>

          <div className="gap-2 flex items-center">
            {isSaved ? (
              <Badge
                variant="success"
                className="gap-1 px-2 py-0.5 text-xs font-normal"
              >
                <CheckCircle className="size-3.5" />
                Saved
              </Badge>
            ) : null}

            <Button
              size="sm"
              disabled={isSaving}
              leadingIcon={
                isSaving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )
              }
              onClick={handleSave}
            >
              {isSaving ? 'Saving…' : isSaved ? 'Saved' : 'Save'}
            </Button>
          </div>
        </div>

        <div className="gap-1.5 px-3 sm:px-6 pb-2 flex items-center text-[11px] text-muted-foreground">
          <AlertTriangle
            className="size-3 shrink-0 text-accent-amber"
            aria-hidden
          />
          <span>
            Save persists this graph to the workspace. Running it (conditions,
            API calls, retries) is not implemented yet — the trigger endpoint
            exists but every step currently no-ops.
          </span>
        </div>
      </div>

      {/* Canvas workspace */}
      <div className="min-h-0 p-3 sm:p-4 gap-1 flex flex-1 flex-col">
        {/* Top Controls & Node Addition Toolbar */}
        <Card className="bottom-3 p-3 mb-3 gap-3 absolute z-50 flex flex-wrap items-center justify-between border-border bg-surface">
          <div className="gap-2 flex items-center">
            <span className="text-xs font-semibold tracking-wider text-foreground text-subtle uppercase">
              Add Node:
            </span>
            <Button
              variant="outline"
              size="sm"
              leadingIcon={<Plus className="size-3.5" />}
              onClick={() =>
                addNode(
                  'triggerNode',
                  'Custom Trigger',
                  'Event Webhook Listener',
                )
              }
            >
              Webhook Trigger
            </Button>
            <Button
              variant="outline"
              size="sm"
              leadingIcon={<Plus className="size-3.5" />}
              onClick={() =>
                addNode(
                  'conditionNode',
                  'Branch Condition',
                  'Evaluate logic expression',
                )
              }
            >
              Condition Step
            </Button>
            <Button
              variant="outline"
              size="sm"
              leadingIcon={<Plus className="size-3.5" />}
              onClick={() =>
                addNode(
                  'aiActionNode',
                  'AI Agent Task',
                  'Ollama RAG / Analysis',
                )
              }
            >
              AI Agent Action
            </Button>
            <Button
              variant="outline"
              size="sm"
              leadingIcon={<Plus className="size-3.5" />}
              onClick={() =>
                addNode(
                  'apiActionNode',
                  'Outgoing Webhook',
                  'REST / Matrix Notification',
                )
              }
            >
              API Outgoing Action
            </Button>
          </div>

          <div className="gap-2 right-3 left-3 bottom-3 absolute z-0 flex items-center">
            <Badge variant="outline" className="font-mono text-[11px]">
              {nodes.length} Nodes · {edges.length} Connections
            </Badge>
          </div>
        </Card>

        {/* ReactFlow Interactive Canvas Area */}
        <div className="gap-4 flex h-[600px] w-full">
          <div className="relative h-full flex-1 overflow-hidden rounded-xl border border-border bg-background shadow-sm">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onNodeClick={onNodeClick}
              nodeTypes={nodeTypes}
              fitView
              attributionPosition="bottom-right"
            >
              <Controls className="!border-border !bg-surface !shadow-md" />
              <MiniMap
                className="!border-border !bg-surface"
                nodeColor={(node) => {
                  if (node.type === 'triggerNode') return '#f59e0b';
                  if (node.type === 'conditionNode') return '#3b82f6';
                  if (node.type === 'aiActionNode') return '#8b5cf6';
                  return '#10b981';
                }}
              />
              <Background gap={16} size={1} color="#64748b" />
            </ReactFlow>
          </div>

          {/* Selected Node Details & Inspector Panel */}
          <Panel className="w-80 flex h-full shrink-0 flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold gap-2 mb-3 flex items-center text-foreground">
                <Zap className="size-4 text-primary" />
                <span>Node Inspector</span>
              </h3>

              {selectedNode ? (
                <div className="space-y-3">
                  <Card className="p-3 space-y-2 bg-surface">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] text-subtle uppercase">
                        Node ID: {selectedNode.id}
                      </span>
                      <Badge variant="primary" className="text-[10px]">
                        {selectedNode.type}
                      </Badge>
                    </div>

                    <div>
                      <label className="font-medium block text-[11px] text-muted-foreground">
                        Node Label
                      </label>
                      <input
                        type="text"
                        value={String(selectedNode.data.label || '')}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNodes((nds) =>
                            nds.map((n) =>
                              n.id === selectedNode.id
                                ? { ...n, data: { ...n.data, label: val } }
                                : n,
                            ),
                          );
                          setSelectedNode((prev) =>
                            prev
                              ? { ...prev, data: { ...prev.data, label: val } }
                              : null,
                          );
                        }}
                        className="mt-1 p-1.5 text-xs w-full rounded-md border border-border bg-background text-foreground outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="font-medium block text-[11px] text-muted-foreground">
                        Subtitle / Configuration
                      </label>
                      <input
                        type="text"
                        value={String(selectedNode.data.subtitle || '')}
                        onChange={(e) => {
                          const val = e.target.value;
                          setNodes((nds) =>
                            nds.map((n) =>
                              n.id === selectedNode.id
                                ? { ...n, data: { ...n.data, subtitle: val } }
                                : n,
                            ),
                          );
                          setSelectedNode((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  data: { ...prev.data, subtitle: val },
                                }
                              : null,
                          );
                        }}
                        className="mt-1 p-1.5 text-xs w-full rounded-md border border-border bg-background font-mono text-foreground outline-none focus:border-primary"
                      />
                    </div>
                  </Card>

                  <Card className="p-3 space-y-1.5 text-xs bg-surface text-muted-foreground">
                    <span className="font-semibold block text-foreground">
                      Execution Info
                    </span>
                    <p>
                      • Drag handles to connect nodes into automation graphs.
                    </p>
                    <p>• Drag nodes anywhere on canvas to reposition.</p>
                  </Card>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  Click on any node in the ReactFlow canvas to inspect or modify
                  its parameters.
                </p>
              )}
            </div>

            {selectedNode ? (
              <Button
                variant="destructive"
                size="sm"
                className="mt-4 w-full"
                leadingIcon={<Trash2 className="size-4" />}
                onClick={deleteSelectedNode}
              >
                Delete Node
              </Button>
            ) : null}
          </Panel>
        </div>
      </div>
    </div>
  );
}
