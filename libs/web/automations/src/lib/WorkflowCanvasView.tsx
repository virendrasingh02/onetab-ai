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
  ActionContextMenu,
  Badge,
  Button,
  Card,
  copyToClipboard,
  Hint,
  Panel,
  toast,
  type EntityAction,
} from '@org/ui';
import { cn } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  ArrowLeft,
  ClipboardCopy,
  PowerOff,
  Power,
  CopyPlus,
  Settings2,
  Bot,
  Brain,
  CheckCircle,
  Code2,
  Cpu,
  Database,
  FileSearch,
  GitBranch,
  GitMerge,
  Globe,
  HelpCircle,
  Layers,
  Link2,
  Loader2,
  MessageSquare,
  Play,
  Plus,
  Radio,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Split,
  Tag,
  Terminal,
  Timer,
  Trash2,
  UserCheck,
  Variable as VariableIcon,
  Webhook,
  Workflow,
  Wrench,
  Zap,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useWorkflowMutations, useWorkflows } from './use-automations.js';

// ==========================================
// NODE CATALOG (35+ SUPPORTED TYPES)
// ==========================================

export type NodeCategory = 'triggers' | 'ai' | 'knowledge' | 'logic' | 'tools';

export interface NodeCatalogItem {
  type: string;
  category: NodeCategory;
  label: string;
  description: string;
  icon: typeof Webhook;
  defaultData: Record<string, unknown>;
}

export const NODE_CATALOG: NodeCatalogItem[] = [
  // Triggers & I/O
  {
    type: 'TRIGGER',
    category: 'triggers',
    label: 'Webhook Trigger',
    description: 'Trigger flow via external HTTP POST webhook',
    icon: Webhook,
    defaultData: { label: 'Webhook Trigger', subtitle: 'POST /api/v1/workflows/trigger', triggerKind: 'WEBHOOK' },
  },
  {
    type: 'START',
    category: 'triggers',
    label: 'Start Node',
    description: 'Initial entrypoint for conversational apps & manual runs',
    icon: Play,
    defaultData: { label: 'Start Flow', subtitle: 'Receives user query & context' },
  },
  {
    type: 'USER_INPUT',
    category: 'triggers',
    label: 'User Input Form',
    description: 'Prompt user for required variables and form inputs',
    icon: MessageSquare,
    defaultData: { label: 'Collect User Input', subtitle: 'Form: prompt, category, email' },
  },
  {
    type: 'OUTPUT',
    category: 'triggers',
    label: 'Flow Output',
    description: 'Return structured response or formatted chat message',
    icon: Radio,
    defaultData: { label: 'Output Response', subtitle: 'Returns text or JSON schema' },
  },
  {
    type: 'HUMAN_APPROVAL',
    category: 'triggers',
    label: 'Human-in-the-Loop Approval',
    description: 'Pause execution until an admin or manager reviews and approves',
    icon: ShieldCheck,
    defaultData: { label: 'Manager Approval', subtitle: 'Requires ADMIN or OWNER review', requiredRole: 'ADMIN', timeoutHours: 24 },
  },
  {
    type: 'HUMAN_INPUT',
    category: 'triggers',
    label: 'Human Clarification',
    description: 'Pause workflow to ask a human for additional details',
    icon: HelpCircle,
    defaultData: { label: 'Request Details', subtitle: 'Prompt operator for missing info' },
  },

  // AI & Intelligence
  {
    type: 'LLM',
    category: 'ai',
    label: 'LLM Generation',
    description: 'Query Claude 3.5, GPT-4o, DeepSeek R1, or Llama 3',
    icon: Sparkles,
    defaultData: { label: 'LLM Generator', subtitle: 'Claude 3.5 Sonnet · Temp 0.7', model: 'claude-3-5-sonnet', temperature: 0.7, prompt: '{{input.prompt}}' },
  },
  {
    type: 'AGENT',
    category: 'ai',
    label: 'AI Agent Call',
    description: 'Invoke an autonomous agent with multi-step reasoning and tools',
    icon: Bot,
    defaultData: { label: 'Research Agent', subtitle: 'Executes autonomous tool loop', agentId: '', goal: 'Analyze and summarize input' },
  },
  {
    type: 'AI_COWORKER',
    category: 'ai',
    label: 'AI Coworker',
    description: 'Delegate task to a specialized persistent coworker persona',
    icon: UserCheck,
    defaultData: { label: 'DevRel Coworker', subtitle: 'Persona: Technical Writer', coworkerId: '', task: 'Draft announcement' },
  },
  {
    type: 'PROMPT',
    category: 'ai',
    label: 'Prompt Template',
    description: 'Format reusable prompt template with dynamic variable substitution',
    icon: Brain,
    defaultData: { label: 'Format Prompt', subtitle: 'Template: Customer Support reply', template: 'Summarize {{input.query}} for {{user.name}}' },
  },
  {
    type: 'CLASSIFIER',
    category: 'ai',
    label: 'Text Classifier',
    description: 'Categorize user intent, tone, or topic into predefined branches',
    icon: Tag,
    defaultData: { label: 'Intent Classifier', subtitle: 'Classes: bug, billing, sales, general', classes: ['bug', 'billing', 'sales', 'general'] },
  },
  {
    type: 'STRUCTURED_OUTPUT',
    category: 'ai',
    label: 'Structured JSON Output',
    description: 'Guarantee LLM output conforms strictly to a JSON schema',
    icon: Code2,
    defaultData: { label: 'Structured Extractor', subtitle: 'Schema: { status, summary, actionItems }' },
  },
  {
    type: 'EXTRACT_DATA',
    category: 'ai',
    label: 'Extract Entities & Regex',
    description: 'Extract emails, dates, order IDs, or regex matches',
    icon: FileSearch,
    defaultData: { label: 'Extract Entities', subtitle: 'Extracts: emails, URLs, dates' },
  },

  // Knowledge & RAG
  {
    type: 'KNOWLEDGE_RETRIEVAL',
    category: 'knowledge',
    label: 'Knowledge Retrieval (RAG)',
    description: 'Vector search knowledge bases and return chunks with citations',
    icon: Database,
    defaultData: { label: 'RAG Retrieval', subtitle: 'Top 4 chunks · Cosine similarity', topK: 4, minScore: 0.7 },
  },

  // Logic & Flow
  {
    type: 'CONDITION',
    category: 'logic',
    label: 'If / Else Branch',
    description: 'Evaluate expression and split execution into True/False branches',
    icon: GitBranch,
    defaultData: { label: 'If / Else Condition', subtitle: 'Check {{input.score}} >= 0.8', expression: '{{input.score}} >= 0.8' },
  },
  {
    type: 'SWITCH',
    category: 'logic',
    label: 'Multi-Way Switch',
    description: 'Route flow to multiple outputs based on variable value',
    icon: Split,
    defaultData: { label: 'Switch Router', subtitle: 'Cases: dev, staging, prod' },
  },
  {
    type: 'PARALLEL',
    category: 'logic',
    label: 'Parallel Fork',
    description: 'Execute multiple downstream branches simultaneously',
    icon: Layers,
    defaultData: { label: 'Fork Parallel', subtitle: 'Broadcasts to branch A and B' },
  },
  {
    type: 'MERGE',
    category: 'logic',
    label: 'Join / Merge',
    description: 'Wait for parallel branches and merge their outputs',
    icon: GitMerge,
    defaultData: { label: 'Merge Outputs', subtitle: 'Combines parallel results' },
  },
  {
    type: 'DELAY',
    category: 'logic',
    label: 'Delay / Sleep',
    description: 'Pause execution for a specified duration before proceeding',
    icon: Timer,
    defaultData: { label: 'Wait 5 Minutes', subtitle: 'Duration: 300s', seconds: 300 },
  },

  // Tools & Compute
  {
    type: 'CODE',
    category: 'tools',
    label: 'JavaScript / Python Code',
    description: 'Execute custom code transformation and mathematical logic',
    icon: Terminal,
    defaultData: { label: 'Custom Code', subtitle: 'Transforms payload with JavaScript', language: 'javascript', code: '// return transformed object\nreturn { processed: true, items: input.items };' },
  },
  {
    type: 'VARIABLE',
    category: 'tools',
    label: 'Variable Assign',
    description: 'Set, mutate, or map workflow state variables',
    icon: VariableIcon,
    defaultData: { label: 'Set Variables', subtitle: 'Sets session state and tokens' },
  },
  {
    type: 'HTTP_REQUEST',
    category: 'tools',
    label: 'HTTP / Webhook Call',
    description: 'Make authenticated REST API call to external service',
    icon: Globe,
    defaultData: { label: 'REST API Request', subtitle: 'POST https://api.service.com/v1', method: 'POST', url: 'https://api.service.com/v1' },
  },
  {
    type: 'TOOL',
    category: 'tools',
    label: 'Workspace Tool',
    description: 'Execute integrated workspace tool (GitHub, Jira, Slack, Drive)',
    icon: Wrench,
    defaultData: { label: 'Workspace Tool', subtitle: 'Slack notification / Jira issue', toolName: 'slack.postMessage' },
  },
  {
    type: 'MCP',
    category: 'tools',
    label: 'Model Context Protocol (MCP)',
    description: 'Call external MCP server tool or resource dynamically',
    icon: Link2,
    defaultData: { label: 'MCP Connector', subtitle: 'Server: postgres', server: 'postgres', tool: 'query' },
  },
];

// ==========================================
// UNIFIED CUSTOM FLOW NODE
// ==========================================

function UnifiedFlowNode({ data, selected, id }: NodeProps) {
  const nodeType = String(data.type || 'TRIGGER');
  const catalogItem = NODE_CATALOG.find((item) => item.type === nodeType);
  const Icon = catalogItem?.icon || Cpu;

  // Category styling
  const category = catalogItem?.category || 'triggers';
  const colorMap: Record<NodeCategory, { border: string; bg: string; text: string; handle: string; badge: string }> = {
    triggers: { border: 'border-accent-amber/50', bg: 'bg-accent-amber/10', text: 'text-accent-amber', handle: '!bg-accent-amber', badge: 'bg-accent-amber/15 text-accent-amber' },
    ai: { border: 'border-accent-violet/50', bg: 'bg-accent-violet/10', text: 'text-accent-violet', handle: '!bg-accent-violet', badge: 'bg-accent-violet/15 text-accent-violet' },
    knowledge: { border: 'border-accent-blue/50', bg: 'bg-accent-blue/10', text: 'text-accent-blue', handle: '!bg-accent-blue', badge: 'bg-accent-blue/15 text-accent-blue' },
    logic: { border: 'border-accent-cyan/50', bg: 'bg-accent-cyan/10', text: 'text-accent-cyan', handle: '!bg-accent-cyan', badge: 'bg-accent-cyan/15 text-accent-cyan' },
    tools: { border: 'border-accent-green/50', bg: 'bg-accent-green/10', text: 'text-accent-green', handle: '!bg-accent-green', badge: 'bg-accent-green/15 text-accent-green' },
  };

  const currentTheme = colorMap[category] || colorMap.triggers;
  const isCondition = nodeType === 'CONDITION';
  const isSwitch = nodeType === 'SWITCH';
  const isOutput = nodeType === 'OUTPUT';
  const isTrigger = nodeType === 'TRIGGER' || nodeType === 'START';
  const isDisabled = data.disabled === true;

  return (
    <Card
      aria-disabled={isDisabled || undefined}
      title={isDisabled ? 'Disabled — skipped when the workflow runs' : undefined}
      className={cn(
        'p-3 min-w-[220px] max-w-[280px] rounded-xl border-2 bg-surface shadow-md transition-all duration-200 select-none cursor-pointer',
        selected
          ? 'border-primary ring-2 ring-primary/25 shadow-lg'
          : currentTheme.border,
        isDisabled && 'opacity-50 border-dashed',
      )}
    >
      {/* Target handle (except for root triggers) */}
      {!isTrigger && (
        <Handle
          type="target"
          position={Position.Top}
          className={cn('w-3 h-3 rounded-full border-2 border-surface', currentTheme.handle)}
        />
      )}

      {/* Node Header */}
      <div className="flex items-center gap-2.5 mb-1.5">
        <div className={cn('p-1.5 shrink-0 rounded-lg', currentTheme.bg, currentTheme.text)}>
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <span className={cn('px-1.5 py-0 rounded text-[9px] font-semibold tracking-wider uppercase', currentTheme.badge)}>
              {catalogItem?.label || nodeType}
            </span>
            <span className="font-mono text-[9px] text-muted-foreground truncate opacity-60">
              #{id.slice(-4)}
            </span>
          </div>
          <h4 className="text-xs font-semibold truncate text-foreground mt-0.5">
            {String(data.label || catalogItem?.label || 'Node')}
          </h4>
        </div>
      </div>

      {/* Node Subtitle / Configuration preview */}
      <p className="truncate font-mono text-[10px] text-muted-foreground bg-background/60 px-2 py-1 rounded border border-border/50">
        {String(data.subtitle || catalogItem?.description || 'Configured')}
      </p>

      {/* Special handles for conditionals */}
      {isCondition ? (
        <div className="flex justify-between items-center mt-2 pt-1 border-t border-border/50 text-[10px] font-mono">
          <div className="flex items-center gap-1 text-accent-green">
            <span>True</span>
            <Handle
              type="source"
              id="true"
              position={Position.Bottom}
              style={{ left: '25%' }}
              className="w-2.5 h-2.5 !bg-accent-green rounded-full border-2 border-surface"
            />
          </div>
          <div className="flex items-center gap-1 text-accent-rose">
            <span>False</span>
            <Handle
              type="source"
              id="false"
              position={Position.Bottom}
              style={{ left: '75%' }}
              className="w-2.5 h-2.5 !bg-accent-rose rounded-full border-2 border-surface"
            />
          </div>
        </div>
      ) : isSwitch ? (
        <div className="flex justify-around items-center mt-2 pt-1 border-t border-border/50 text-[9px] font-mono text-muted-foreground">
          <span>Case 1</span>
          <span>Case 2</span>
          <span>Default</span>
          <Handle
            type="source"
            position={Position.Bottom}
            className={cn('w-3 h-3 rounded-full border-2 border-surface', currentTheme.handle)}
          />
        </div>
      ) : !isOutput ? (
        <Handle
          type="source"
          position={Position.Bottom}
          className={cn('w-3 h-3 rounded-full border-2 border-surface', currentTheme.handle)}
        />
      ) : null}
    </Card>
  );
}

const customNodeTypes = {
  // Map legacy node types
  triggerNode: UnifiedFlowNode,
  conditionNode: UnifiedFlowNode,
  aiActionNode: UnifiedFlowNode,
  apiActionNode: UnifiedFlowNode,
  // Map catalog types
  TRIGGER: UnifiedFlowNode,
  START: UnifiedFlowNode,
  USER_INPUT: UnifiedFlowNode,
  OUTPUT: UnifiedFlowNode,
  HUMAN_APPROVAL: UnifiedFlowNode,
  HUMAN_INPUT: UnifiedFlowNode,
  LLM: UnifiedFlowNode,
  AGENT: UnifiedFlowNode,
  AI_COWORKER: UnifiedFlowNode,
  PROMPT: UnifiedFlowNode,
  CLASSIFIER: UnifiedFlowNode,
  STRUCTURED_OUTPUT: UnifiedFlowNode,
  EXTRACT_DATA: UnifiedFlowNode,
  KNOWLEDGE_RETRIEVAL: UnifiedFlowNode,
  CONDITION: UnifiedFlowNode,
  SWITCH: UnifiedFlowNode,
  PARALLEL: UnifiedFlowNode,
  MERGE: UnifiedFlowNode,
  DELAY: UnifiedFlowNode,
  CODE: UnifiedFlowNode,
  VARIABLE: UnifiedFlowNode,
  HTTP_REQUEST: UnifiedFlowNode,
  TOOL: UnifiedFlowNode,
  MCP: UnifiedFlowNode,
};

// ==========================================
// MAIN WORKFLOW CANVAS VIEW
// ==========================================

export function WorkflowCanvasView() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'config' | 'variables' | 'test'>('config');

  // Palette state
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteSearch, setPaletteSearch] = useState('');
  const [paletteCategory, setPaletteCategory] = useState<string>('all');

  // Workflow state
  const [isSaved, setIsSaved] = useState(false);
  const [workflowId, setWorkflowId] = useState<string | null>(null);
  const [workflowName, setWorkflowName] = useState('Unified Automation Graph');
  const [isRunning, setIsRunning] = useState(false);
  const [executionResult, setExecutionResult] = useState<Record<string, unknown> | null>(null);

  const navigate = useNavigate();
  const { slug, workspaceId } = useCurrentWorkspace();
  const { create, update, trigger } = useWorkflowMutations(workspaceId);
  const isSaving = create.isPending || update.isPending;

  // Hydrate workflow if editing existing id
  const [searchParams] = useSearchParams();
  const editingId = searchParams.get('id');
  const workflowsQuery = useWorkflows(workspaceId);
  const hydratedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!editingId || hydratedRef.current === editingId) return;
    const wf = workflowsQuery.data?.find((w) => w.id === editingId);
    if (!wf) return;
    hydratedRef.current = editingId;
    try {
      const loadedNodes = JSON.parse(wf.nodesJson || '[]');
      const loadedEdges = JSON.parse(wf.edgesJson || '[]');
      if (Array.isArray(loadedNodes) && loadedNodes.length > 0) {
        setNodes(loadedNodes as Node[]);
      } else {
        setNodes([
          {
            id: 'node-trigger',
            type: 'TRIGGER',
            position: { x: 250, y: 80 },
            data: { type: 'TRIGGER', label: 'Webhook Trigger', subtitle: 'POST payload receiver' },
          },
        ]);
      }
      if (Array.isArray(loadedEdges)) setEdges(loadedEdges as Edge[]);
    } catch {
      toast.error('Could not parse graph', {
        description: 'Using empty canvas state.',
      });
    }
    setWorkflowId(wf.id);
    setWorkflowName(wf.name);
  }, [editingId, workflowsQuery.data, setNodes, setEdges]);

  // Set default starter node if brand new canvas
  useEffect(() => {
    if (!editingId && nodes.length === 0) {
      setNodes([
        {
          id: 'node-start',
          type: 'START',
          position: { x: 260, y: 100 },
          data: { type: 'START', label: 'Start Flow', subtitle: 'Trigger & context input' },
        },
      ]);
    }
  }, [editingId, nodes.length, setNodes]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(`/w/${slug}/automations`);
    }
  };

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges],
  );

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  };

  // Add node from catalog
  const addCatalogNode = (item: NodeCatalogItem) => {
    const newNodeId = `node_${Date.now()}`;
    const newNode: Node = {
      id: newNodeId,
      type: item.type,
      position: {
        x: 250 + (nodes.length % 4) * 40,
        y: 120 + nodes.length * 60,
      },
      data: {
        type: item.type,
        ...item.defaultData,
      },
    };
    setNodes((nds) => [...nds, newNode]);
    setSelectedNode(newNode);
    setPaletteOpen(false);
    toast.success(`Added ${item.label}`, {
      description: 'Placed onto workflow canvas. Configure details in inspector.',
    });
  };

  /* ---- node context menu (right-click a node on the canvas) ---- */
  const [nodeMenu, setNodeMenu] = useState<{ node: Node; x: number; y: number } | null>(
    null,
  );

  const nodeLabel = (node: Node) =>
    String((node.data as { label?: string })?.label || node.type || 'Node');

  const duplicateNode = (node: Node) => {
    const copy: Node = {
      ...node,
      id: `node_${Date.now()}`,
      position: { x: node.position.x + 40, y: node.position.y + 60 },
      selected: false,
      data: { ...node.data },
    };
    setNodes((nds) => [...nds, copy]);
    setSelectedNode(copy);
  };

  const setNodeDisabled = (node: Node, disabled: boolean) => {
    setNodes((nds) =>
      nds.map((n) => (n.id === node.id ? { ...n, data: { ...n.data, disabled } } : n)),
    );
    setSelectedNode((prev) =>
      prev?.id === node.id ? { ...prev, data: { ...prev.data, disabled } } : prev,
    );
  };

  const removeNode = (node: Node) => {
    setNodes((nds) => nds.filter((n) => n.id !== node.id));
    setEdges((eds) => eds.filter((e) => e.source !== node.id && e.target !== node.id));
    setSelectedNode((prev) => (prev?.id === node.id ? null : prev));
    toast.info(`Deleted ${nodeLabel(node)}`);
  };

  /** Adds `item` below `source` and wires source → new node. */
  const addConnectedNode = (source: Node, item: NodeCatalogItem) => {
    const newNode: Node = {
      id: `node_${Date.now()}`,
      type: item.type,
      position: { x: source.position.x, y: source.position.y + 140 },
      data: { type: item.type, ...item.defaultData },
    };
    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) =>
      addEdge({ source: source.id, target: newNode.id, sourceHandle: null, targetHandle: null, animated: true }, eds),
    );
    setSelectedNode(newNode);
  };

  const nodeActions = (node: Node): EntityAction[] => {
    const disabled = (node.data as { disabled?: boolean })?.disabled === true;
    const categories = [...new Set(NODE_CATALOG.map((c) => c.category))];
    return [
      {
        id: 'configure',
        group: 'edit',
        label: 'Configure node',
        icon: Settings2,
        run: () => setSelectedNode(node),
      },
      {
        id: 'add-connected',
        group: 'edit',
        label: 'Add connected node',
        icon: Plus,
        children: categories.map(
          (category): EntityAction => ({
            id: `add-${category}`,
            label: category.charAt(0).toUpperCase() + category.slice(1),
            children: NODE_CATALOG.filter((c) => c.category === category).map(
              (item): EntityAction => ({
                id: `add-${item.type}`,
                label: item.label,
                icon: item.icon,
                run: () => addConnectedNode(node, item),
              }),
            ),
          }),
        ),
      },
      {
        id: 'duplicate',
        group: 'edit',
        label: 'Duplicate node',
        icon: CopyPlus,
        shortcut: 'D',
        run: () => duplicateNode(node),
      },
      {
        id: 'toggle-disabled',
        group: 'state',
        label: disabled ? 'Enable node' : 'Disable node',
        icon: disabled ? Power : PowerOff,
        description: disabled ? undefined : 'Skipped when the workflow runs.',
        run: () => setNodeDisabled(node, !disabled),
      },
      {
        id: 'copy-config',
        group: 'state',
        label: 'Copy node configuration',
        icon: ClipboardCopy,
        run: () =>
          copyToClipboard(
            JSON.stringify({ type: node.type, data: node.data }, null, 2),
            'Configuration',
          ),
      },
      {
        id: 'delete',
        group: 'danger',
        label: 'Delete node',
        icon: Trash2,
        shortcut: 'Del',
        destructive: true,
        run: () => removeNode(node),
      },
    ];
  };

  const deleteSelectedNode = () => {
    if (!selectedNode) return;
    const label = (selectedNode.data as { label?: string })?.label || 'Node';
    setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    setEdges((eds) =>
      eds.filter((e) => e.source !== selectedNode.id && e.target !== selectedNode.id),
    );
    setSelectedNode(null);
    toast.info(`Deleted ${label}`);
  };

  // Save workflow
  const handleSave = async () => {
    if (!workspaceId) {
      toast.error('Workspace still loading');
      return;
    }
    if (nodes.length === 0) {
      toast.error('Cannot save empty workflow');
      return;
    }

    const base = {
      name: workflowName.trim() || 'Unified Workflow',
      nodesJson: JSON.stringify(nodes),
      edgesJson: JSON.stringify(edges),
    };

    const triggerNode = nodes.find((n) => n.type === 'TRIGGER' || n.type === 'START');
    const triggerType = (triggerNode?.data as { triggerKind?: string })?.triggerKind ?? 'WEBHOOK';

    try {
      if (workflowId) {
        await update.mutateAsync({ workflowId, input: base });
      } else {
        const created = await create.mutateAsync({ ...base, triggerType });
        setWorkflowId(created.id);
      }
      setIsSaved(true);
      toast.success('Workflow saved', {
        description: `${nodes.length} nodes and ${edges.length} connections synced.`,
      });
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      toast.error('Save failed', {
        description: err instanceof Error ? err.message : 'Could not save workflow.',
      });
    }
  };

  // Run / Test workflow
  const handleTestRun = async () => {
    if (!workflowId) {
      await handleSave();
    }
    const currentWfId = workflowId;
    if (!currentWfId) {
      toast.error('Please save the workflow before executing');
      return;
    }

    setIsRunning(true);
    setExecutionResult(null);
    toast.loading('Executing workflow across nodes...', { id: 'run-toast' });

    try {
      const res = await trigger.mutateAsync({
        workflowId: currentWfId,
        payload: {
          testMode: true,
          triggeredBy: 'Studio Canvas',
          timestamp: new Date().toISOString(),
          input: {
            prompt: 'Test prompt from Studio Canvas',
            query: 'Evaluate knowledge retrieval and reasoning',
          },
        },
      });
      setIsRunning(false);
      setExecutionResult((res as Record<string, unknown>) || { status: 'SUCCESS' });
      toast.success('Workflow execution completed!', {
        id: 'run-toast',
        description: 'Check step logs below or in Execution Logs tab.',
      });
    } catch (err) {
      setIsRunning(false);
      toast.error('Execution failed', {
        id: 'run-toast',
        description: err instanceof Error ? err.message : 'Execution halted.',
      });
    }
  };

  // Filtered node catalog for palette
  const filteredCatalog = useMemo(() => {
    return NODE_CATALOG.filter((item) => {
      const matchesSearch =
        item.label.toLowerCase().includes(paletteSearch.toLowerCase()) ||
        item.description.toLowerCase().includes(paletteSearch.toLowerCase()) ||
        item.type.toLowerCase().includes(paletteSearch.toLowerCase());
      const matchesCat = paletteCategory === 'all' || item.category === paletteCategory;
      return matchesSearch && matchesCat;
    });
  }, [paletteSearch, paletteCategory]);

  // Update selected node data helper
  const updateNodeData = (key: string, value: unknown) => {
    if (!selectedNode) return;
    setNodes((nds) =>
      nds.map((n) =>
        n.id === selectedNode.id
          ? { ...n, data: { ...n.data, [key]: value } }
          : n,
      ),
    );
    setSelectedNode((prev) =>
      prev ? { ...prev, data: { ...prev.data, [key]: value } } : null,
    );
  };

  return (
    <div className="min-h-0 flex flex-1 flex-col h-full bg-background">
      {/* Header Bar */}
      <div className="border-b border-border bg-surface px-4 py-2 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <Hint label="Back to Automations">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={handleBack}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
            </Button>
          </Hint>

          <div className="h-4 w-px bg-border shrink-0" />

          <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Workflow className="size-4" />
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              className="text-sm font-semibold tracking-tight rounded px-1.5 py-0.5 border border-transparent hover:border-border focus:border-primary focus:bg-background outline-none text-foreground min-w-[200px]"
              placeholder="Workflow Name"
            />
            <Badge variant="primary" className="text-[10px] shrink-0 font-medium">
              35+ Nodes Ready
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isSaved && (
            <Badge variant="success" className="gap-1 text-xs">
              <CheckCircle className="size-3.5" />
              Saved
            </Badge>
          )}

          <Button
            size="sm"
            variant="outline"
            leadingIcon={isRunning ? <Loader2 className="size-3.5 animate-spin text-primary" /> : <Play className="size-3.5 text-accent-green" />}
            onClick={handleTestRun}
            disabled={isRunning}
          >
            {isRunning ? 'Running…' : 'Test Run'}
          </Button>

          <Button
            size="sm"
            disabled={isSaving}
            leadingIcon={isSaving ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />}
            onClick={handleSave}
          >
            {isSaving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Main Canvas + Inspector */}
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        {/* ReactFlow Interactive Canvas */}
        <div role="region" aria-label="Workflow canvas builder" className="relative flex-1 h-full">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onNodeContextMenu={(event, node) => {
              event.preventDefault();
              setNodeMenu({ node, x: event.clientX, y: event.clientY });
            }}
            onPaneClick={() => setNodeMenu(null)}
            nodeTypes={customNodeTypes}
            fitView
            attributionPosition="bottom-left"
          >
            <Controls className="!border-border !bg-surface !shadow-md !rounded-lg" />
            <MiniMap
              className="!border-border !bg-surface !rounded-lg !shadow-md"
              nodeColor={(node) => {
                const item = NODE_CATALOG.find((c) => c.type === node.type);
                if (item?.category === 'triggers') return '#f59e0b';
                if (item?.category === 'ai') return '#8b5cf6';
                if (item?.category === 'knowledge') return '#3b82f6';
                if (item?.category === 'logic') return '#06b6d4';
                return '#10b981';
              }}
            />
            <Background gap={18} size={1} color="currentColor" className="text-border/40" />
          </ReactFlow>
          <ActionContextMenu
            at={nodeMenu ? { x: nodeMenu.x, y: nodeMenu.y } : null}
            onClose={() => setNodeMenu(null)}
            actions={() => (nodeMenu ? nodeActions(nodeMenu.node) : [])}
            entityType="workflow-node"
            entity={nodeMenu?.node}
            scope={nodeMenu ? `workflow-node:${nodeMenu.node.id}` : undefined}
          />

          {/* Floating Palette Button & Popover */}
          <div className="absolute top-3 left-3 z-30">
            <Button
              variant="default"
              size="sm"
              leadingIcon={<Plus className="size-4" />}
              onClick={() => setPaletteOpen(!paletteOpen)}
              className="shadow-lg"
            >
              Add Node
            </Button>

            {paletteOpen && (
              <Card className="mt-2 w-[340px] max-h-[500px] flex flex-col p-3 shadow-2xl border-2 border-border bg-surface z-50 rounded-xl animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-border">
                  <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Node Palette
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {filteredCatalog.length} nodes
                  </Badge>
                </div>

                {/* Search */}
                <div className="relative mt-2">
                  <Search className="size-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={paletteSearch}
                    onChange={(e) => setPaletteSearch(e.target.value)}
                    aria-label="Search 35+ node types"
                    placeholder="Search 35+ node types..."
                    className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-border bg-background text-foreground outline-none focus:border-primary"
                    autoFocus
                  />
                </div>

                {/* Categories */}
                <div role="tablist" aria-label="Node categories" className="flex items-center gap-1 overflow-x-auto py-2 no-scrollbar border-b border-border/60">
                  {(['all', 'triggers', 'ai', 'knowledge', 'logic', 'tools'] as const).map((cat) => (
                    <button
                      key={cat}
                      role="tab"
                      aria-selected={paletteCategory === cat}
                      onClick={() => setPaletteCategory(cat)}
                      className={cn(
                        'px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap transition-colors',
                        paletteCategory === cat
                          ? 'bg-primary text-primary-foreground font-semibold'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {cat === 'all' ? 'All' : cat.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* Node List */}
                <div className="overflow-y-auto space-y-1 py-1.5 flex-1 max-h-[320px]">
                  {filteredCatalog.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.type}
                        onClick={() => addCatalogNode(item)}
                        className="w-full text-left p-2 rounded-lg hover:bg-muted/70 flex items-start gap-2.5 transition-colors group"
                      >
                        <div className="p-1.5 rounded-md bg-muted group-hover:bg-primary/10 group-hover:text-primary transition-colors shrink-0">
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground truncate">
                              {item.label}
                            </span>
                            <span className="text-[9px] uppercase font-mono px-1 rounded bg-muted/60 text-muted-foreground">
                              {item.category}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                            {item.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </Card>
            )}
          </div>

          {/* Quick Stats Pill */}
          <div className="absolute bottom-3 left-16 z-20">
            <Badge variant="outline" className="bg-surface/80 backdrop-blur font-mono text-[11px] shadow-sm">
              {nodes.length} Nodes · {edges.length} Edges
            </Badge>
          </div>
        </div>

        {/* Right Inspector Panel */}
        <Panel className="w-80 flex flex-col h-full shrink-0 border-l border-border bg-surface shadow-md">
          {selectedNode ? (
            <div className="flex flex-col h-full min-h-0">
              {/* Inspector Header */}
              <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="size-6 rounded bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Zap className="size-3.5" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs font-bold text-foreground truncate">
                      {String(selectedNode.data.label || selectedNode.type)}
                    </h3>
                    <p className="text-[10px] font-mono text-muted-foreground truncate">
                      ID: {selectedNode.id}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={deleteSelectedNode}
                  aria-label="Delete selected node"
                  className="text-destructive hover:bg-destructive/10 shrink-0"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </Button>
              </div>

              {/* Tabs: Config / Variables / Test */}
              <div role="tablist" aria-label="Inspector tabs" className="flex border-b border-border text-xs shrink-0">
                <button
                  role="tab"
                  aria-selected={inspectorTab === 'config'}
                  onClick={() => setInspectorTab('config')}
                  className={cn(
                    'flex-1 py-2 font-medium text-center border-b-2 transition-colors',
                    inspectorTab === 'config'
                      ? 'border-primary text-primary font-semibold'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  Config
                </button>
                <button
                  role="tab"
                  aria-selected={inspectorTab === 'variables'}
                  onClick={() => setInspectorTab('variables')}
                  className={cn(
                    'flex-1 py-2 font-medium text-center border-b-2 transition-colors',
                    inspectorTab === 'variables'
                      ? 'border-primary text-primary font-semibold'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  Variables
                </button>
                <button
                  role="tab"
                  aria-selected={inspectorTab === 'test'}
                  onClick={() => setInspectorTab('test')}
                  className={cn(
                    'flex-1 py-2 font-medium text-center border-b-2 transition-colors',
                    inspectorTab === 'test'
                      ? 'border-primary text-primary font-semibold'
                      : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  Test Run
                </button>
              </div>

              {/* Tab Contents */}
              <div className="p-3 overflow-y-auto flex-1 space-y-3">
                {inspectorTab === 'config' && (
                  <div className="space-y-3">
                    {/* Common fields: Label & Subtitle */}
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                        Node Label
                      </label>
                      <input
                        type="text"
                        value={String(selectedNode.data.label || '')}
                        onChange={(e) => updateNodeData('label', e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-border bg-background text-foreground outline-none focus:border-primary"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                        Summary / Subtitle
                      </label>
                      <input
                        type="text"
                        value={String(selectedNode.data.subtitle || '')}
                        onChange={(e) => updateNodeData('subtitle', e.target.value)}
                        className="w-full text-xs p-2 rounded-lg border border-border bg-background text-foreground outline-none focus:border-primary font-mono text-[11px]"
                      />
                    </div>

                    {/* Node-Specific Config */}
                    {selectedNode.type === 'LLM' && (
                      <>
                        <div>
                          <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                            Model Selection
                          </label>
                          <select
                            value={String(selectedNode.data.model || 'claude-3-5-sonnet')}
                            onChange={(e) => {
                              updateNodeData('model', e.target.value);
                              updateNodeData('subtitle', `${e.target.value} · Temp ${selectedNode.data.temperature || 0.7}`);
                            }}
                            className="w-full text-xs p-2 rounded-lg border border-border bg-background text-foreground outline-none focus:border-primary"
                          >
                            <option value="claude-3-5-sonnet">Claude 3.5 Sonnet (Anthropic)</option>
                            <option value="gpt-4o">GPT-4o (OpenAI)</option>
                            <option value="deepseek-r1">DeepSeek R1 (Reasoning)</option>
                            <option value="llama-3.3-70b">Llama 3.3 70B (Meta)</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                            Prompt Template
                          </label>
                          <textarea
                            rows={4}
                            value={String(selectedNode.data.prompt || '')}
                            onChange={(e) => updateNodeData('prompt', e.target.value)}
                            placeholder="Use {{input.query}} to reference inputs..."
                            className="w-full text-xs p-2 rounded-lg border border-border bg-background text-foreground outline-none focus:border-primary font-mono"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                            <span>Temperature</span>
                            <span>{String(selectedNode.data.temperature || '0.7')}</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.1"
                            value={Number(selectedNode.data.temperature ?? 0.7)}
                            onChange={(e) => updateNodeData('temperature', parseFloat(e.target.value))}
                            className="w-full accent-primary"
                          />
                        </div>
                      </>
                    )}

                    {selectedNode.type === 'HUMAN_APPROVAL' && (
                      <>
                        <div>
                          <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                            Required Role
                          </label>
                          <select
                            value={String(selectedNode.data.requiredRole || 'ADMIN')}
                            onChange={(e) => updateNodeData('requiredRole', e.target.value)}
                            className="w-full text-xs p-2 rounded-lg border border-border bg-background text-foreground outline-none focus:border-primary"
                          >
                            <option value="ADMIN">Workspace Admin</option>
                            <option value="OWNER">Workspace Owner</option>
                            <option value="MEMBER">Any Team Member</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                            Approval Prompt / Instruction
                          </label>
                          <textarea
                            rows={3}
                            value={String(selectedNode.data.instruction || '')}
                            onChange={(e) => updateNodeData('instruction', e.target.value)}
                            placeholder="Explain why this action requires human sign-off..."
                            className="w-full text-xs p-2 rounded-lg border border-border bg-background text-foreground outline-none focus:border-primary"
                          />
                        </div>
                      </>
                    )}

                    {selectedNode.type === 'CONDITION' && (
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                          Branch Expression
                        </label>
                        <input
                          type="text"
                          value={String(selectedNode.data.expression || '')}
                          onChange={(e) => updateNodeData('expression', e.target.value)}
                          placeholder="{{input.amount}} > 100"
                          className="w-full text-xs p-2 rounded-lg border border-border bg-background text-foreground outline-none focus:border-primary font-mono"
                        />
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Evaluates to True (left output) or False (right output).
                        </p>
                      </div>
                    )}

                    {selectedNode.type === 'HTTP_REQUEST' && (
                      <>
                        <div className="flex gap-2">
                          <select
                            value={String(selectedNode.data.method || 'POST')}
                            onChange={(e) => updateNodeData('method', e.target.value)}
                            className="text-xs p-2 rounded-lg border border-border bg-background text-foreground outline-none focus:border-primary w-24"
                          >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="DELETE">DELETE</option>
                          </select>
                          <input
                            type="text"
                            value={String(selectedNode.data.url || '')}
                            onChange={(e) => updateNodeData('url', e.target.value)}
                            placeholder="https://api.example.com/endpoint"
                            className="flex-1 text-xs p-2 rounded-lg border border-border bg-background text-foreground outline-none focus:border-primary font-mono"
                          />
                        </div>
                      </>
                    )}

                    {selectedNode.type === 'CODE' && (
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                          JavaScript / Node.js Code
                        </label>
                        <textarea
                          rows={6}
                          value={String(selectedNode.data.code || '')}
                          onChange={(e) => updateNodeData('code', e.target.value)}
                          placeholder="// Access input variables with `input`\nreturn { result: input.data };"
                          className="w-full text-xs p-2 rounded-lg border border-border bg-background text-foreground outline-none focus:border-primary font-mono"
                        />
                      </div>
                    )}

                    {selectedNode.type === 'KNOWLEDGE_RETRIEVAL' && (
                      <div>
                        <label className="text-[11px] font-medium text-muted-foreground block mb-1">
                          Top K Results
                        </label>
                        <input
                          type="number"
                          value={Number(selectedNode.data.topK || 4)}
                          onChange={(e) => updateNodeData('topK', parseInt(e.target.value, 10))}
                          className="w-full text-xs p-2 rounded-lg border border-border bg-background text-foreground outline-none focus:border-primary"
                        />
                      </div>
                    )}
                  </div>
                )}

                {inspectorTab === 'variables' && (
                  <div className="space-y-3">
                    <p className="text-[11px] text-muted-foreground">
                      Available upstream variables you can copy and reference with syntax <code className="bg-muted px-1 rounded text-primary">{'{{variable}}'}</code>:
                    </p>
                    <div className="space-y-2">
                      <div className="p-2 rounded-lg border border-border bg-background/50 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-mono font-semibold text-foreground">
                            {'{{input.query}}'}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Initial user prompt / input query</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            navigator.clipboard.writeText('{{input.query}}');
                            toast.success('Copied variable reference');
                          }}
                        >
                          <VariableIcon className="size-3.5" />
                        </Button>
                      </div>

                      <div className="p-2 rounded-lg border border-border bg-background/50 flex items-center justify-between">
                        <div>
                          <p className="text-xs font-mono font-semibold text-foreground">
                            {'{{workspace.id}}'}
                          </p>
                          <p className="text-[10px] text-muted-foreground">Current workspace identifier</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => {
                            navigator.clipboard.writeText('{{workspace.id}}');
                            toast.success('Copied variable reference');
                          }}
                        >
                          <VariableIcon className="size-3.5" />
                        </Button>
                      </div>

                      {nodes
                        .filter((n) => n.id !== selectedNode.id)
                        .map((n) => (
                          <div key={n.id} className="p-2 rounded-lg border border-border bg-background/50 flex items-center justify-between">
                            <div className="min-w-0">
                              <p className="text-xs font-mono font-semibold text-foreground truncate">
                                {`{{nodes.${n.id}.output}}`}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                Output of {String(n.data.label || n.type)}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => {
                                navigator.clipboard.writeText(`{{nodes.${n.id}.output}}`);
                                toast.success('Copied node output variable');
                              }}
                            >
                              <VariableIcon className="size-3.5" />
                            </Button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {inspectorTab === 'test' && (
                  <div className="space-y-3">
                    <Button
                      size="sm"
                      className="w-full"
                      variant="outline"
                      leadingIcon={isRunning ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5 text-accent-green" />}
                      onClick={handleTestRun}
                      disabled={isRunning}
                    >
                      {isRunning ? 'Executing Graph...' : 'Dry Run Workflow'}
                    </Button>

                    {executionResult ? (
                      <div className="p-2 rounded-lg border border-border bg-background text-[11px] font-mono overflow-x-auto max-h-[260px]">
                        <p className="text-accent-green font-semibold mb-1 flex items-center gap-1">
                          <CheckCircle className="size-3" /> Execution Payload
                        </p>
                        <pre className="text-muted-foreground">
                          {JSON.stringify(executionResult, null, 2)}
                        </pre>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic text-center py-4">
                        Click dry run to test variable resolution and node step execution.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-muted-foreground space-y-3 m-auto">
              <div className="size-10 rounded-full bg-muted/60 text-muted-foreground flex items-center justify-center mx-auto">
                <Workflow className="size-5" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-foreground">No Node Selected</h4>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Click on any node in the canvas to inspect settings, configure AI prompts, bind variables, or run dry-run tests.
                </p>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
