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
import {
  Badge,
  Button,
  Card,
  Hint,
  Panel,
  toast,
} from '@org/ui';
import { cn } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  ArrowLeft,
  CheckCircle,
  Cpu,
  GitBranch,
  Globe,
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

// Custom Node Components
function TriggerNode({ data, selected }: NodeProps) {
  return (
    <Card
      className={cn(
        'p-3 min-w-52 border-2 bg-surface shadow-md rounded-xl transition-all duration-200',
        selected ? 'border-accent-amber ring-2 ring-accent-amber/20' : 'border-accent-amber/40',
      )}
    >
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-accent-amber" />
      <div className="flex items-center gap-2 mb-1.5">
        <div className="p-1.5 rounded-lg bg-accent-amber/10 text-accent-amber shrink-0">
          <Webhook className="size-4" />
        </div>
        <div>
          <Badge variant="warning" className="text-[9px] px-1.5 py-0 mb-0.5">
            Trigger
          </Badge>
          <h4 className="text-xs font-semibold text-foreground truncate">
            {String(data.label || 'Custom Trigger')}
          </h4>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground font-mono truncate">
        {String(data.subtitle || 'Webhook / Cron event')}
      </p>
    </Card>
  );
}

function ConditionNode({ data, selected }: NodeProps) {
  return (
    <Card
      className={cn(
        'p-3 min-w-52 border-2 bg-surface shadow-md rounded-xl transition-all duration-200',
        selected ? 'border-accent-blue ring-2 ring-accent-blue/20' : 'border-accent-blue/40',
      )}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-accent-blue" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-accent-blue" />
      <div className="flex items-center gap-2 mb-1.5">
        <div className="p-1.5 rounded-lg bg-accent-blue/10 text-accent-blue shrink-0">
          <GitBranch className="size-4" />
        </div>
        <div>
          <Badge variant="primary" className="text-[9px] px-1.5 py-0 mb-0.5">
            Condition
          </Badge>
          <h4 className="text-xs font-semibold text-foreground truncate">
            {String(data.label || 'Filter Logic')}
          </h4>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground font-mono truncate">
        {String(data.subtitle || 'Check payload payload.status == 200')}
      </p>
    </Card>
  );
}

function AiActionNode({ data, selected }: NodeProps) {
  return (
    <Card
      className={cn(
        'p-3 min-w-52 border-2 bg-surface shadow-md rounded-xl transition-all duration-200',
        selected ? 'border-accent-violet ring-2 ring-accent-violet/20' : 'border-accent-violet/40',
      )}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-accent-violet" />
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 bg-accent-violet" />
      <div className="flex items-center gap-2 mb-1.5">
        <div className="p-1.5 rounded-lg bg-accent-violet/10 text-accent-violet shrink-0">
          <Cpu className="size-4" />
        </div>
        <div>
          <Badge variant="neutral" className="text-[9px] px-1.5 py-0 mb-0.5 bg-accent-violet/15 text-accent-violet">
            AI Agent
          </Badge>
          <h4 className="text-xs font-semibold text-foreground truncate">
            {String(data.label || 'Summarizer Agent')}
          </h4>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground font-mono truncate">
        {String(data.subtitle || 'Generate summary with Llama 3')}
      </p>
    </Card>
  );
}

function ApiActionNode({ data, selected }: NodeProps) {
  return (
    <Card
      className={cn(
        'p-3 min-w-52 border-2 bg-surface shadow-md rounded-xl transition-all duration-200',
        selected ? 'border-accent-green ring-2 ring-accent-green/20' : 'border-accent-green/40',
      )}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 bg-accent-green" />
      <div className="flex items-center gap-2 mb-1.5">
        <div className="p-1.5 rounded-lg bg-accent-green/10 text-accent-green shrink-0">
          <Globe className="size-4" />
        </div>
        <div>
          <Badge variant="neutral" className="text-[9px] px-1.5 py-0 mb-0.5 bg-accent-green/15 text-accent-green">
            API / Webhook
          </Badge>
          <h4 className="text-xs font-semibold text-foreground truncate">
            {String(data.label || 'Matrix Channel Alert')}
          </h4>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground font-mono truncate">
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
  const navigate = useNavigate();
  const { slug } = useCurrentWorkspace();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(`/w/${slug}/automations?tab=all`);
    }
  };

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
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
      position: { x: 250 + (nodes.length % 3) * 50, y: 200 + nodes.length * 30 },
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
      eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id),
    );
    setSelectedNode(null);
    toast.info(`Deleted ${label}`, {
      description: 'Node removed from workflow canvas.',
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Channel-style Header */}
      <div className="border-b border-border bg-background">
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 sm:px-6 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <Hint label="Back to Automations">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleBack}
                aria-label="Back to Automations"
                className="text-muted-foreground hover:text-foreground shrink-0"
              >
                <ArrowLeft className="size-4" />
              </Button>
            </Hint>

            <div className="h-4 w-px bg-border shrink-0" />

            <div className="flex min-w-0 items-center gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-amber-soft text-accent-amber">
                <Workflow className="size-4" aria-hidden />
              </div>
              <div className="flex min-w-0 items-center gap-1.5">
                <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
                  Workflow Builder
                </h2>
                <Badge variant="neutral" className="px-1.5 py-0 text-[10px] font-medium shrink-0">
                  Automations
                </Badge>
              </div>
            </div>

            <span className="hidden lg:inline-block text-xs text-muted-foreground truncate max-w-md ml-1 pl-2.5 border-l border-border/80">
              Design interactive automation graphs with custom triggers, AI agents, conditions, and API nodes.
            </span>
          </div>

          <div className="flex items-center gap-2">
            {isSaved ? (
              <Badge variant="success" className="gap-1 px-2 py-0.5 text-xs font-normal">
                <CheckCircle className="size-3.5" />
                Saved
              </Badge>
            ) : null}

            <Button
              size="sm"
              leadingIcon={<Save className="size-3.5" />}
              onClick={() => {
                setIsSaved(true);
                toast.success('Workflow saved', {
                  description: 'Workflow graph logic saved successfully.',
                });
                setTimeout(() => setIsSaved(false), 3000);
              }}
            >
              {isSaved ? 'Saved' : 'Save Graph'}
            </Button>
          </div>
        </div>
      </div>

      {/* Canvas workspace */}
      <div className="flex flex-1 flex-col min-h-0 p-3 sm:p-4 gap-3">

      {/* Top Controls & Node Addition Toolbar */}
      <Card className="p-3 bg-surface border-border mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground uppercase tracking-wider text-subtle">
            Add Node:
          </span>
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<Plus className="size-3.5" />}
            onClick={() =>
              addNode('triggerNode', 'Custom Trigger', 'Event Webhook Listener')
            }
          >
            Webhook Trigger
          </Button>
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<Plus className="size-3.5" />}
            onClick={() =>
              addNode('conditionNode', 'Branch Condition', 'Evaluate logic expression')
            }
          >
            Condition Step
          </Button>
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<Plus className="size-3.5" />}
            onClick={() =>
              addNode('aiActionNode', 'AI Agent Task', 'Ollama RAG / Analysis')
            }
          >
            AI Agent Action
          </Button>
          <Button
            variant="outline"
            size="sm"
            leadingIcon={<Plus className="size-3.5" />}
            onClick={() =>
              addNode('apiActionNode', 'Outgoing Webhook', 'REST / Matrix Notification')
            }
          >
            API Outgoing Action
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="neutral" className="gap-1 font-mono text-[11px]">
            <Radio className="size-3 text-accent-green" />
            <span>ReactFlow Powered Engine</span>
          </Badge>
          <Badge variant="outline" className="font-mono text-[11px]">
            {nodes.length} Nodes · {edges.length} Connections
          </Badge>
        </div>
      </Card>

      {/* ReactFlow Interactive Canvas Area */}
      <div className="flex gap-4 h-[600px] w-full">
        <div className="flex-1 h-full rounded-xl border border-border bg-background overflow-hidden relative shadow-sm">
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
            <Controls className="!bg-surface !border-border !shadow-md" />
            <MiniMap
              className="!bg-surface !border-border"
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
        <Panel className="w-80 h-full flex flex-col justify-between shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
              <Zap className="size-4 text-primary" />
              <span>Node Inspector</span>
            </h3>

            {selectedNode ? (
              <div className="space-y-3">
                <Card className="p-3 bg-surface space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono uppercase text-subtle">
                      Node ID: {selectedNode.id}
                    </span>
                    <Badge variant="primary" className="text-[10px]">
                      {selectedNode.type}
                    </Badge>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block">
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
                          prev ? { ...prev, data: { ...prev.data, label: val } } : null,
                        );
                      }}
                      className="w-full mt-1 p-1.5 rounded-md border border-border bg-background text-xs text-foreground outline-none focus:border-primary"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground block">
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
                          prev ? { ...prev, data: { ...prev.data, subtitle: val } } : null,
                        );
                      }}
                      className="w-full mt-1 p-1.5 rounded-md border border-border bg-background text-xs font-mono text-foreground outline-none focus:border-primary"
                    />
                  </div>
                </Card>

                <Card className="p-3 bg-surface space-y-1.5 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground block">
                    Execution Info
                  </span>
                  <p>• Drag handles to connect nodes into automation graphs.</p>
                  <p>• Drag nodes anywhere on canvas to reposition.</p>
                </Card>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                Click on any node in the ReactFlow canvas to inspect or modify its parameters.
              </p>
            )}
          </div>

          {selectedNode ? (
            <Button
              variant="destructive"
              size="sm"
              className="w-full mt-4"
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
