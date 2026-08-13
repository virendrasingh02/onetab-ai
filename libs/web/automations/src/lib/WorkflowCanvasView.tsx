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
  Page,
  PageHeader,
  Panel,
} from '@org/ui';
import { cn } from '@org/utils';
import {
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

// Custom Node Components
function TriggerNode({ data, selected }: NodeProps) {
  return (
    <Card
      className={cn(
        'w-64 p-3 shadow-md bg-background border-2 transition-all',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-accent-amber/30',
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="p-1.5 rounded-md bg-accent-amber-soft text-accent-amber">
          <Webhook className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <Badge variant="warning" className="text-[9px] uppercase px-1.5 py-0">
            Trigger
          </Badge>
          <h4 className="text-xs font-semibold text-foreground truncate">
            {String(data.label || 'Webhook Event')}
          </h4>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground font-mono truncate">
        {String(data.subtitle || 'POST /api/v1/webhook')}
      </p>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-accent-amber !size-3 !border-2 !border-background"
      />
    </Card>
  );
}

function ConditionNode({ data, selected }: NodeProps) {
  return (
    <Card
      className={cn(
        'w-64 p-3 shadow-md bg-background border-2 transition-all',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-accent-blue/30',
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-accent-blue !size-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2 mb-1.5">
        <span className="p-1.5 rounded-md bg-accent-blue-soft text-accent-blue">
          <GitBranch className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <Badge variant="neutral" className="text-[9px] uppercase px-1.5 py-0">
            Condition
          </Badge>
          <h4 className="text-xs font-semibold text-foreground truncate">
            {String(data.label || 'Branch Check')}
          </h4>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground font-mono truncate">
        {String(data.subtitle || 'if payload.type == "urgent"')}
      </p>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-accent-blue !size-3 !border-2 !border-background"
      />
    </Card>
  );
}

function AiActionNode({ data, selected }: NodeProps) {
  return (
    <Card
      className={cn(
        'w-64 p-3 shadow-md bg-background border-2 transition-all',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-accent-violet/30',
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-accent-violet !size-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2 mb-1.5">
        <span className="p-1.5 rounded-md bg-accent-violet-soft text-accent-violet">
          <Cpu className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <Badge variant="primary" className="text-[9px] uppercase px-1.5 py-0">
            AI Agent Step
          </Badge>
          <h4 className="text-xs font-semibold text-foreground truncate">
            {String(data.label || 'Ollama AI Task')}
          </h4>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground font-mono truncate">
        {String(data.subtitle || 'Summarize payload via Llama3')}
      </p>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-accent-violet !size-3 !border-2 !border-background"
      />
    </Card>
  );
}

function ApiActionNode({ data, selected }: NodeProps) {
  return (
    <Card
      className={cn(
        'w-64 p-3 shadow-md bg-background border-2 transition-all',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-accent-green/30',
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-accent-green !size-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2 mb-1.5">
        <span className="p-1.5 rounded-md bg-accent-green-soft text-accent-green">
          <Globe className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <Badge variant="neutral" className="text-[9px] uppercase px-1.5 py-0">
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
  };

  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id),
    );
    setSelectedNode(null);
  };

  return (
    <Page width="full">
      <PageHeader
        title="Workflow Builder"
        description="Design interactive automation graphs with custom triggers, AI agents, conditions, and API nodes."
        icon={<Workflow />}
        accent="amber"
        actions={
          <div className="flex items-center gap-2">
            {isSaved ? (
              <Badge variant="primary" className="gap-1 px-3 py-1">
                <CheckCircle className="size-3.5" />
                Workflow Saved
              </Badge>
            ) : null}
            <Button
              leadingIcon={<Save />}
              onClick={() => {
                setIsSaved(true);
                setTimeout(() => setIsSaved(false), 3000);
              }}
            >
              Save Graph
            </Button>
          </div>
        }
      />

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
    </Page>
  );
}
