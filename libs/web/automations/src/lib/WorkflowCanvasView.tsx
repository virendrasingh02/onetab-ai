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
  Toolbar,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  Bot,
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
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-amber-500/40',
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className="p-1.5 rounded-md bg-amber-500/10 text-amber-500">
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
        className="!bg-amber-500 !size-3 !border-2 !border-background"
      />
    </Card>
  );
}

function ConditionNode({ data, selected }: NodeProps) {
  return (
    <Card
      className={cn(
        'w-64 p-3 shadow-md bg-background border-2 transition-all',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-blue-500/40',
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-blue-500 !size-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2 mb-1.5">
        <span className="p-1.5 rounded-md bg-blue-500/10 text-blue-500">
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
        className="!bg-blue-500 !size-3 !border-2 !border-background"
      />
    </Card>
  );
}

function AiActionNode({ data, selected }: NodeProps) {
  return (
    <Card
      className={cn(
        'w-64 p-3 shadow-md bg-background border-2 transition-all',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-violet-500/40',
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-violet-500 !size-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2 mb-1.5">
        <span className="p-1.5 rounded-md bg-violet-500/10 text-violet-500">
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
        className="!bg-violet-500 !size-3 !border-2 !border-background"
      />
    </Card>
  );
}

function ApiActionNode({ data, selected }: NodeProps) {
  return (
    <Card
      className={cn(
        'w-64 p-3 shadow-md bg-background border-2 transition-all',
        selected ? 'border-primary ring-2 ring-primary/20' : 'border-emerald-500/40',
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-emerald-500 !size-3 !border-2 !border-background"
      />
      <div className="flex items-center gap-2 mb-1.5">
        <span className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-500">
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

const initialNodes: Node[] = [
  {
    id: 'n1',
    type: 'triggerNode',
    position: { x: 250, y: 30 },
    data: {
      label: 'Webhook Trigger',
      subtitle: 'POST /api/v1/automations/webhook',
    },
  },
  {
    id: 'n2',
    type: 'conditionNode',
    position: { x: 250, y: 160 },
    data: {
      label: 'Filter Payload Severity',
      subtitle: 'if event.severity == "CRITICAL"',
    },
  },
  {
    id: 'n3',
    type: 'aiActionNode',
    position: { x: 100, y: 300 },
    data: {
      label: 'AI Incident Summarizer',
      subtitle: 'Generate summary with Ollama Llama3',
    },
  },
  {
    id: 'n4',
    type: 'apiActionNode',
    position: { x: 400, y: 300 },
    data: {
      label: 'Post to #engineering-alerts',
      subtitle: 'Matrix Room Notification',
    },
  },
  {
    id: 'n5',
    type: 'apiActionNode',
    position: { x: 100, y: 440 },
    data: {
      label: 'Jira Issue Creator',
      subtitle: 'Create P1 incident ticket',
    },
  },
];

const initialEdges: Edge[] = [
  { id: 'e1-2', source: 'n1', target: 'n2', animated: true },
  { id: 'e2-3', source: 'n2', target: 'n3', label: 'True' },
  { id: 'e2-4', source: 'n2', target: 'n4', label: 'False' },
  { id: 'e3-5', source: 'n3', target: 'n5', animated: true },
];

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
            <Radio className="size-3 text-emerald-500" />
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
            <Background gap={16} size={1} color="#64748b" opacity={0.2} />
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
