/**
 * The workflow editor — `/w/:slug/ai/workflows/:id`.
 *
 * A workflow is a graph of steps the engine runs in order from its trigger,
 * following only the branch a condition or classifier chose. Everything on
 * screen maps to something `WorkflowEngineService` does: the inspector is
 * generated from `workflow-catalog.ts`, the Variables list is the context keys
 * earlier steps really produce, and after a test run each step shows how it
 * went.
 */

import { automationsApi, queryKeys } from '@org/api-client';
import type { AutomationWorkflowDetail } from '@org/types';
import {
  ActionContextMenu,
  Badge,
  Button,
  Card,
  confirm,
  copyToClipboard,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogBody,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  Hint,
  Input,
  LoadingState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  toast,
  type EntityAction,
} from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import { AgentBuilderOptionsProvider, BuilderOptionSelect } from '@org/web-agents';
import { useCanManageAIResource, useCurrentWorkspace, useWorkspacePermission } from '@org/web-workspace';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  ReactFlowProvider,
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
  ArrowLeft,
  ClipboardCopy,
  Clock,
  CopyPlus,
  Cpu,
  ExternalLink,
  Play,
  Plus,
  Power,
  PowerOff,
  RotateCcw,
  Save,
  Settings2,
  Share2,
  Trash2,
  Workflow,
} from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useWorkflowMutations } from './use-automations.js';
import {
  PALETTE,
  WORKFLOW_EVENTS,
  catalogItem,
  isFieldShown,
  missingFields,
  triggerTypeFor,
  type NodeCatalogItem,
  type NodeCategory,
  type WorkflowField,
} from './workflow-catalog.js';

export { NODE_CATALOG, type NodeCatalogItem, type NodeCategory } from './workflow-catalog.js';

function aiPath(slug: string | undefined, ...rest: string[]) {
  return [`/w/${slug ?? ''}/ai`, ...rest].join('/');
}

const CATEGORY_STYLE: Record<NodeCategory, { border: string; bg: string; text: string; handle: string; hex: string }> = {
  triggers: { border: 'border-accent-amber/50', bg: 'bg-accent-amber/10', text: 'text-accent-amber', handle: '!bg-accent-amber', hex: '#f59e0b' },
  ai: { border: 'border-accent-violet/50', bg: 'bg-accent-violet/10', text: 'text-accent-violet', handle: '!bg-accent-violet', hex: '#8b5cf6' },
  knowledge: { border: 'border-accent-blue/50', bg: 'bg-accent-blue/10', text: 'text-accent-blue', handle: '!bg-accent-blue', hex: '#3b82f6' },
  logic: { border: 'border-accent-cyan/50', bg: 'bg-accent-cyan/10', text: 'text-accent-cyan', handle: '!bg-accent-cyan', hex: '#06b6d4' },
  tools: { border: 'border-accent-green/50', bg: 'bg-accent-green/10', text: 'text-accent-green', handle: '!bg-accent-green', hex: '#10b981' },
};

/** Per-step outcome of the last test run, painted onto the cards. */
const RunStatusContext = createContext<Record<string, string>>({});

function nodeSummary(item: NodeCatalogItem | undefined, data: Record<string, unknown>): string {
  if (!item) return String(data['subtitle'] ?? '');
  if (item.type === 'TRIGGER') {
    const kind = String(data['triggerKind'] ?? 'MANUAL');
    if (kind === 'CRON') return `Schedule · ${String(data['cron'] ?? '')}`;
    if (kind === 'EVENT') return WORKFLOW_EVENTS.find((e) => e.value === data['event'])?.label ?? 'On an event';
    return 'On request';
  }
  const first = item.fields.find((f) => f.required) ?? item.fields[0];
  if (!first) return item.description;
  const label = data[`${first.key}Label`];
  const value = label ?? data[first.key];
  return value ? String(value).slice(0, 60) : `Set ${first.label.toLowerCase()}`;
}

function StepNode({ data, selected, id }: NodeProps) {
  const type = String((data as Record<string, unknown>)['type'] ?? '');
  const item = catalogItem(type);
  const Icon = item?.icon ?? Cpu;
  const style = CATEGORY_STYLE[item?.category ?? 'tools'];
  const record = data as Record<string, unknown>;
  const isTrigger = type === 'TRIGGER' || type === 'START' || type === 'USER_INPUT';
  const branches = item?.branches?.(record) ?? null;
  const isEnd = type === 'OUTPUT';
  const disabled = record['disabled'] === true;
  const runStatus = useContext(RunStatusContext)[id];

  return (
    <Card
      aria-disabled={disabled || undefined}
      className={cn(
        'w-[240px] cursor-pointer select-none rounded-xl border-2 bg-surface p-3 shadow-md transition-shadow',
        selected ? 'border-primary shadow-lg ring-2 ring-primary/25' : style.border,
        disabled && 'border-dashed opacity-50',
        runStatus === 'SUCCESS' && 'ring-2 ring-success/60',
        runStatus === 'FAILED' && 'ring-2 ring-destructive/70',
        runStatus === 'WAITING' && 'ring-2 ring-warning/70',
      )}
    >
      {!isTrigger ? (
        <Handle type="target" position={Position.Top} className={cn('h-3 w-3 rounded-full border-2 border-surface', style.handle)} />
      ) : null}
      <div className="flex items-center gap-2.5">
        <span className={cn('shrink-0 rounded-lg p-1.5', style.bg, style.text)}>
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn('text-[10px] font-semibold uppercase tracking-wider', style.text)}>{item?.label ?? type}</p>
          <p className="truncate text-xs font-semibold text-foreground">{String(record['label'] || item?.label || 'Step')}</p>
        </div>
        {runStatus ? (
          <span className="sr-only">Last run: {runStatus.toLowerCase()}</span>
        ) : null}
      </div>
      <p className="mt-1.5 truncate rounded border border-border/50 bg-background/60 px-2 py-1 font-mono text-[10px] text-muted-foreground">
        {nodeSummary(item, record)}
      </p>
      {branches ? (
        <div className="relative mt-2 flex justify-between gap-1 border-t border-border/50 pt-1 font-mono text-[9px] text-muted-foreground">
          {branches.map((branch, index) => (
            <span key={branch} className="relative flex-1 truncate text-center">
              {branch}
              <Handle
                type="source"
                id={branch}
                position={Position.Bottom}
                style={{ left: `${((index + 0.5) / branches.length) * 100}%` }}
                className={cn('h-2.5 w-2.5 rounded-full border-2 border-surface', style.handle)}
              />
            </span>
          ))}
        </div>
      ) : !isEnd ? (
        <Handle type="source" position={Position.Bottom} className={cn('h-3 w-3 rounded-full border-2 border-surface', style.handle)} />
      ) : null}
    </Card>
  );
}

const nodeTypes = Object.fromEntries(
  [...new Set([...PALETTE.map((i) => i.type), ...['START', 'USER_INPUT', 'HUMAN_INPUT', 'PARALLEL', 'SWITCH', 'STRUCTURED_OUTPUT', 'CODE', 'triggerNode', 'conditionNode', 'aiActionNode', 'apiActionNode', 'ACTION']])].map((t) => [t, StepNode]),
);

function starterGraph(): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: [
      { id: 'trigger', type: 'TRIGGER', position: { x: 240, y: 60 }, data: { type: 'TRIGGER', label: 'Start', triggerKind: 'MANUAL' } },
      { id: 'result', type: 'OUTPUT', position: { x: 240, y: 260 }, data: { type: 'OUTPUT', label: 'Result', template: '' } },
    ],
    edges: [{ id: 'trigger-result', source: 'trigger', target: 'result', animated: true }],
  };
}

/** Reads a stored graph, bringing older node shapes up to the current catalog. */
function loadGraph(workflow: AutomationWorkflowDetail | null): { nodes: Node[]; edges: Edge[] } {
  if (!workflow) return starterGraph();
  try {
    const nodes = (JSON.parse(workflow.nodesJson || '[]') as Node[]).map((n) => {
      const data = { ...(n.data as Record<string, unknown>) };
      const type = String(data['type'] ?? n.type);
      data['type'] = type;
      // Older workflows called "run on request" a webhook; it never had a public URL.
      if (type === 'TRIGGER' && (data['triggerKind'] === 'WEBHOOK' || !data['triggerKind'])) data['triggerKind'] = 'MANUAL';
      return { ...n, type, data };
    });
    const edges = JSON.parse(workflow.edgesJson || '[]') as Edge[];
    return nodes.length ? { nodes, edges } : starterGraph();
  } catch {
    return starterGraph();
  }
}

function graphSignature(name: string, nodes: Node[], edges: Edge[]): string {
  return JSON.stringify({
    name,
    nodes: nodes.map((n) => ({ id: n.id, type: n.type, position: n.position, data: n.data })),
    edges: edges.map((e) => ({ s: e.source, t: e.target, h: e.sourceHandle ?? null })),
  });
}

export function WorkflowCanvasView() {
  const { workflowId: routeId } = useParams<{ workflowId?: string }>();
  const [params] = useSearchParams();
  const workflowId = routeId && routeId !== 'new' ? routeId : params.get('id');
  const { workspaceId, slug } = useCurrentWorkspace();
  const [epoch, setEpoch] = useState(0);

  const detail = useQuery({
    queryKey: queryKeys.automations.detail(workspaceId ?? '', workflowId ?? ''),
    queryFn: () => automationsApi.get(workspaceId as string, workflowId as string),
    enabled: Boolean(workspaceId && workflowId),
  });

  if (workflowId && detail.isLoading) return <LoadingState fullPage label="Opening workflow…" />;
  if (workflowId && !detail.data) {
    return (
      <div className="grid flex-1 place-items-center p-6">
        <EmptyState
          icon={<Workflow />}
          title="Workflow not found"
          description="It may have been deleted, or it belongs to another workspace."
          action={
            <Button asChild variant="outline">
              <Link to={aiPath(slug, 'workflows')}>Back to workflows</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <AgentBuilderOptionsProvider workspaceId={workspaceId}>
      <ReactFlowProvider key={`${workflowId ?? 'new'}:${epoch}`}>
        <WorkflowEditor workflow={detail.data ?? null} onReload={() => setEpoch((n) => n + 1)} />
      </ReactFlowProvider>
    </AgentBuilderOptionsProvider>
  );
}

function WorkflowEditor({
  workflow,
  onReload,
}: {
  workflow: AutomationWorkflowDetail | null;
  onReload: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { workspaceId, slug } = useCurrentWorkspace();
  const { can } = useWorkspacePermission();
  const canManageResource = useCanManageAIResource();
  const canEdit = workflow ? canManageResource(workflow.creatorId) : can('create');
  const { create, update, trigger } = useWorkflowMutations(workspaceId);

  const initial = useMemo(() => loadGraph(workflow), [workflow]);
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initial.edges);
  const [name, setName] = useState(workflow?.name ?? 'Untitled workflow');
  const [savedSignature, setSavedSignature] = useState(() =>
    workflow ? graphSignature(workflow.name, initial.nodes, initial.edges) : '',
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [nodeMenu, setNodeMenu] = useState<{ node: Node; x: number; y: number } | null>(null);
  const [runOpen, setRunOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);
  const [runStatus, setRunStatus] = useState<Record<string, string>>({});

  const dirty = graphSignature(name, nodes, edges) !== savedSignature;
  const selected = nodes.find((n) => n.id === selectedId) ?? null;
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.automations.all(workspaceId ?? '') });

  const updateNodeData = useCallback(
    (nodeId: string, patch: Record<string, unknown>) =>
      setNodes((nds) => nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n))),
    [setNodes],
  );

  /** Saves the canvas; resolves to the workflow id, or null if it failed. */
  const saveNow = useCallback(async (): Promise<string | null> => {
    const triggers = nodes.filter((n) => ['TRIGGER', 'START'].includes(String(n.type)));
    if (triggers.length !== 1) {
      toast.error(triggers.length ? 'Keep one trigger' : 'Add a trigger', {
        description: 'A workflow starts from exactly one trigger step.',
      });
      return null;
    }
    for (const n of nodes) {
      const missing = missingFields(String(n.type), n.data as Record<string, unknown>);
      if (missing.length) {
        setSelectedId(n.id);
        toast.error(`“${String((n.data as Record<string, unknown>)['label'] ?? n.type)}” needs ${missing.join(', ')}`);
        return null;
      }
    }
    const input = {
      name: name.trim() || 'Untitled workflow',
      nodesJson: JSON.stringify(nodes.map(({ selected: _s, dragging: _d, ...n }) => n)),
      edgesJson: JSON.stringify(edges),
      triggerType: triggerTypeFor(triggers[0]?.data as Record<string, unknown>),
    };
    try {
      if (workflow) {
        await update.mutateAsync({ workflowId: workflow.id, input });
        setSavedSignature(graphSignature(input.name, nodes, edges));
        toast.success('Saved');
        return workflow.id;
      }
      const created = await create.mutateAsync(input);
      toast.success('Workflow created', { description: 'Test it, then publish to switch it on.' });
      navigate(aiPath(slug, 'workflows', created.id), { replace: true });
      return created.id;
    } catch (err) {
      toast.error('Could not save the workflow', {
        description: err instanceof Error ? err.message : undefined,
      });
      return null;
    }
  }, [create, edges, name, navigate, nodes, slug, update, workflow]);

  useEffect(() => {
    if (!canEdit) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveNow();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canEdit, saveNow]);

  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const publish = useMutation({
    mutationFn: (id: string) => automationsApi.publish(workspaceId as string, id),
    onSuccess: (version) => {
      toast.success(`Published v${version.versionNumber}`, { description: 'The workflow is on and will run on its trigger.' });
      void refresh();
    },
    onError: (err) => toast.error('Could not publish', { description: err instanceof Error ? err.message : undefined }),
  });

  const setActive = useMutation({
    mutationFn: (isActive: boolean) => automationsApi.update(workspaceId as string, workflow!.id, { isActive }),
    onSuccess: (_row, isActive) => {
      toast.success(isActive ? 'Workflow switched on' : 'Workflow paused', {
        description: isActive ? undefined : 'Schedules and events won’t start it until you switch it back on.',
      });
      void refresh();
    },
    onError: () => toast.error('Could not change that'),
  });

  const connect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges],
  );

  const addStep = (item: NodeCatalogItem, from?: Node) => {
    const id = `${item.type.toLowerCase()}_${Math.random().toString(36).slice(2, 7)}`;
    const base = from ?? nodes[nodes.length - 1];
    const node: Node = {
      id,
      type: item.type,
      position: base ? { x: base.position.x, y: base.position.y + 170 } : { x: 240, y: 120 },
      data: { type: item.type, ...item.defaultData },
    };
    setNodes((nds) => [...nds.map((n) => ({ ...n, selected: false })), node]);
    if (from) setEdges((eds) => addEdge({ id: `${from.id}-${id}`, source: from.id, target: id, animated: true }, eds));
    setSelectedId(id);
    setPaletteOpen(false);
  };

  const removeNode = (node: Node) => {
    setNodes((nds) => nds.filter((n) => n.id !== node.id));
    setEdges((eds) => eds.filter((e) => e.source !== node.id && e.target !== node.id));
    if (selectedId === node.id) setSelectedId(null);
  };

  const nodeActions = (node: Node): EntityAction[] => {
    const disabled = (node.data as { disabled?: boolean }).disabled === true;
    if (!canEdit) return [];
    return [
      { id: 'configure', group: 'edit', label: 'Configure', icon: Settings2, run: () => setSelectedId(node.id) },
      {
        id: 'add-next',
        group: 'edit',
        label: 'Add next step',
        icon: Plus,
        children: (['ai', 'knowledge', 'logic', 'tools', 'triggers'] as const).map((category) => ({
          id: `add-${category}`,
          label: category === 'ai' ? 'AI' : category.charAt(0).toUpperCase() + category.slice(1),
          children: PALETTE.filter((i) => i.category === category && i.type !== 'TRIGGER').map((item) => ({
            id: `add-${item.type}`,
            label: item.label,
            icon: item.icon,
            run: () => addStep(item, node),
          })),
        })),
      },
      {
        id: 'duplicate',
        group: 'edit',
        label: 'Duplicate',
        icon: CopyPlus,
        run: () => {
          const copy = { ...node, id: `${String(node.type).toLowerCase()}_${Math.random().toString(36).slice(2, 7)}`, selected: false, position: { x: node.position.x + 40, y: node.position.y + 60 }, data: { ...node.data } };
          setNodes((nds) => [...nds, copy]);
        },
      },
      {
        id: 'toggle',
        group: 'state',
        label: disabled ? 'Turn step on' : 'Skip this step',
        icon: disabled ? Power : PowerOff,
        run: () => updateNodeData(node.id, { disabled: !disabled }),
      },
      {
        id: 'copy',
        group: 'state',
        label: 'Copy settings',
        icon: ClipboardCopy,
        run: () => copyToClipboard(JSON.stringify({ type: node.type, data: node.data }, null, 2), 'Settings'),
      },
      { id: 'delete', group: 'danger', label: 'Delete step', icon: Trash2, destructive: true, run: () => removeNode(node) },
    ];
  };

  const runWith = async (payload: Record<string, unknown>) => {
    const id = dirty || !workflow ? await saveNow() : workflow.id;
    if (!id) return null;
    try {
      const result = await trigger.mutateAsync({ workflowId: id, payload });
      setRunStatus(Object.fromEntries(result.results.map((r) => [r.stepId, r.status])));
      return result;
    } catch (err) {
      toast.error('The run could not start', { description: err instanceof Error ? err.message : undefined });
      return null;
    }
  };

  const isActive = workflow?.isActive ?? false;
  const triggerNode = nodes.find((n) => n.type === 'TRIGGER' || n.type === 'START');

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Hint label="Back to workflows">
            <Button variant="ghost" size="icon-sm" asChild aria-label="Back to workflows">
              <Link to={aiPath(slug, 'workflows')}>
                <ArrowLeft className="size-4" />
              </Link>
            </Button>
          </Hint>
          <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Workflow className="size-4" />
          </span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            readOnly={!canEdit}
            aria-label="Workflow name"
            className="h-8 w-44 border-transparent bg-transparent px-1.5 text-sm font-semibold shadow-none hover:border-border focus-visible:border-primary sm:w-64"
          />
          {workflow ? (
            <Badge variant={isActive ? 'success' : 'neutral'} className="shrink-0 text-[10px]">
              {isActive ? 'On' : 'Paused'}
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              Not saved yet
            </Badge>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {workflow && canEdit ? (
            <label className="mr-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Switch
                checked={isActive}
                disabled={setActive.isPending}
                onCheckedChange={(on) => setActive.mutate(on)}
                aria-label="Workflow on"
              />
              On
            </label>
          ) : null}
          {workflow ? (
            <Button variant="ghost" size="sm" leadingIcon={<Clock />} onClick={() => setVersionsOpen(true)}>
              Versions
            </Button>
          ) : null}
          <Button variant="outline" size="sm" leadingIcon={<Play />} onClick={() => setRunOpen(true)} disabled={!can('create')}>
            Test run
          </Button>
          {workflow && canEdit ? (
            <Button
              variant="outline"
              size="sm"
              leadingIcon={<Share2 />}
              loading={publish.isPending}
              onClick={async () => {
                const id = dirty ? await saveNow() : workflow.id;
                if (id) publish.mutate(id);
              }}
            >
              Publish
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              size="sm"
              leadingIcon={<Save />}
              loading={create.isPending || update.isPending}
              disabled={workflow ? !dirty : false}
              onClick={() => void saveNow()}
            >
              {workflow ? (dirty ? 'Save' : 'Saved') : 'Create workflow'}
            </Button>
          ) : null}
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div role="region" aria-label="Workflow canvas" className="relative h-full min-w-0 flex-1">
          <RunStatusContext.Provider value={runStatus}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={canEdit ? onNodesChange : undefined}
              onEdgesChange={canEdit ? onEdgesChange : undefined}
              onConnect={canEdit ? connect : undefined}
              nodesDraggable={canEdit}
              nodesConnectable={canEdit}
              onNodeClick={(_, node) => setSelectedId(node.id)}
              onPaneClick={() => {
                setSelectedId(null);
                setNodeMenu(null);
              }}
              onNodeContextMenu={(event, node) => {
                event.preventDefault();
                setNodeMenu({ node, x: event.clientX, y: event.clientY });
              }}
              nodeTypes={nodeTypes}
              fitView
            >
              <Controls className="!rounded-lg !border-border !bg-surface !shadow-md" />
              <MiniMap
                className="!hidden !rounded-lg !border-border !bg-surface !shadow-md sm:!block"
                nodeColor={(node) => CATEGORY_STYLE[catalogItem(String(node.type))?.category ?? 'tools'].hex}
              />
              <Background gap={18} size={1} color="currentColor" className="text-border/40" />
            </ReactFlow>
          </RunStatusContext.Provider>
          <ActionContextMenu
            at={nodeMenu ? { x: nodeMenu.x, y: nodeMenu.y } : null}
            onClose={() => setNodeMenu(null)}
            actions={() => (nodeMenu ? nodeActions(nodeMenu.node) : [])}
            entityType="workflow-node"
            entity={nodeMenu?.node}
            scope={nodeMenu ? `workflow-node:${nodeMenu.node.id}` : undefined}
          />

          {canEdit ? (
            // On a phone the step settings cover the canvas; don't float over them.
            <div className={cn('absolute left-3 top-3 z-30', selected && 'max-md:hidden')}>
              <Button size="sm" leadingIcon={<Plus />} onClick={() => setPaletteOpen(!paletteOpen)} aria-expanded={paletteOpen} className="shadow-lg">
                Add step
              </Button>
              {paletteOpen ? (
                <StepPalette
                  onPick={(item) => addStep(item, selected ?? undefined)}
                  hasTrigger={Boolean(triggerNode)}
                  onClose={() => setPaletteOpen(false)}
                />
              ) : null}
            </div>
          ) : null}
        </div>

        <aside
          aria-label="Step settings"
          className={cn(
            'z-20 flex h-full w-full max-w-sm shrink-0 flex-col border-l border-border bg-surface',
            'absolute inset-y-0 right-0 md:static md:w-80',
            !selected && 'hidden md:flex',
          )}
        >
          {selected ? (
            <StepInspector
              node={selected}
              nodes={nodes}
              edges={edges}
              readOnly={!canEdit}
              onChange={(patch) => updateNodeData(selected.id, patch)}
              onDelete={() => removeNode(selected)}
              onClose={() => setSelectedId(null)}
            />
          ) : (
            <div className="m-auto max-w-xs space-y-2 p-6 text-center">
              <Workflow className="mx-auto size-6 text-muted-foreground" aria-hidden />
              <p className="text-sm font-semibold text-foreground">Select a step to set it up</p>
              <p className="text-xs text-muted-foreground">
                Steps run top to bottom from the trigger. Drag from a step’s bottom dot to connect the next one; a
                condition or classifier sends the run down only the branch it picks.
              </p>
            </div>
          )}
        </aside>
      </div>

      <RunDialog
        open={runOpen}
        onOpenChange={setRunOpen}
        triggerData={(triggerNode?.data as Record<string, unknown>) ?? {}}
        running={trigger.isPending || create.isPending || update.isPending}
        dirty={dirty || !workflow}
        runsPath={aiPath(slug, 'runs')}
        onRun={runWith}
      />
      {workflow ? (
        <VersionsDialog
          open={versionsOpen}
          onOpenChange={setVersionsOpen}
          workspaceId={workspaceId as string}
          workflowId={workflow.id}
          canEdit={canEdit}
          dirty={dirty}
          onRestored={() => {
            void refresh();
            onReload();
          }}
        />
      ) : null}
    </div>
  );
}

function StepPalette({
  onPick,
  hasTrigger,
  onClose,
}: {
  onPick: (item: NodeCatalogItem) => void;
  hasTrigger: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const items = PALETTE.filter((item) => !(hasTrigger && item.type === 'TRIGGER')).filter(
    (item) => !needle || item.label.toLowerCase().includes(needle) || item.description.toLowerCase().includes(needle),
  );
  const groups: Array<[NodeCategory, string]> = [
    ['triggers', 'Start, finish and approvals'],
    ['ai', 'AI'],
    ['knowledge', 'Knowledge and web'],
    ['logic', 'Logic'],
    ['tools', 'Tools'],
  ];
  return (
    <Card
      className="mt-2 flex max-h-[70vh] w-[320px] flex-col rounded-xl border-2 border-border bg-surface p-2 shadow-2xl"
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <Input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Find a step"
        aria-label="Find a step"
        className="h-8 text-xs"
      />
      <div className="mt-2 overflow-y-auto">
        {groups.map(([category, title]) => {
          const inGroup = items.filter((i) => i.category === category);
          if (!inGroup.length) return null;
          return (
            <div key={category} className="mb-2">
              <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
              {inGroup.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => onPick(item)}
                    className="flex w-full items-start gap-2.5 rounded-lg p-2 text-left transition-colors hover:bg-muted/70 focus-visible:bg-muted/70 focus-visible:outline-none"
                  >
                    <span className="shrink-0 rounded-md bg-muted p-1.5">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-foreground">{item.label}</span>
                      <span className="block text-[11px] text-muted-foreground">{item.description}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** The `{{…}}` references a step can use: what the steps before it produce. */
function upstreamVariables(nodeId: string, nodes: Node[], edges: Edge[]) {
  const before = new Set<string>();
  const queue = [nodeId];
  while (queue.length) {
    const current = queue.shift() as string;
    for (const e of edges) {
      if (e.target === current && !before.has(e.source)) {
        before.add(e.source);
        queue.push(e.source);
      }
    }
  }
  const vars: Array<{ ref: string; from: string }> = [];
  for (const n of nodes) {
    if (!before.has(n.id)) continue;
    const data = n.data as Record<string, unknown>;
    const item = catalogItem(String(n.type));
    const label = String(data['label'] ?? item?.label ?? n.type);
    if (n.type === 'TRIGGER' || n.type === 'START') {
      const kind = String(data['triggerKind'] ?? 'MANUAL');
      if (kind === 'EVENT' && String(data['event']).startsWith('task.')) {
        vars.push({ ref: '{{title}}', from: 'the task' }, { ref: '{{taskId}}', from: 'the task' });
      } else {
        vars.push({ ref: '{{input.text}}', from: 'the run’s input' });
      }
      continue;
    }
    if (n.type === 'VARIABLE' && data['name']) vars.push({ ref: `{{${String(data['name'])}}}`, from: label });
    for (const key of item?.outputs ?? []) vars.push({ ref: `{{${n.id}.${key}}}`, from: label });
  }
  return vars;
}

function StepInspector({
  node,
  nodes,
  edges,
  readOnly,
  onChange,
  onDelete,
  onClose,
}: {
  node: Node;
  nodes: Node[];
  edges: Edge[];
  readOnly: boolean;
  onChange: (patch: Record<string, unknown>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const data = node.data as Record<string, unknown>;
  const item = catalogItem(String(node.type));
  const vars = useMemo(() => upstreamVariables(node.id, nodes, edges), [node.id, nodes, edges]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border p-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{item?.label ?? node.type}</p>
          <p className="truncate font-mono text-[10px] text-muted-foreground">id: {node.id}</p>
        </div>
        <div className="flex gap-1">
          {!readOnly ? (
            <Hint label="Delete step">
              <Button variant="ghost" size="icon-sm" aria-label="Delete step" onClick={onDelete}>
                <Trash2 className="size-3.5" />
              </Button>
            </Hint>
          ) : null}
          <Button variant="ghost" size="sm" className="md:hidden" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {item?.legacy ? (
          <p className="rounded-md bg-warning/10 p-2 text-xs text-warning-text">{item.description}</p>
        ) : null}
        <fieldset disabled={readOnly} className="m-0 min-w-0 space-y-3 border-0 p-0">
          <Field label="Name">
            <Input value={String(data['label'] ?? '')} onChange={(e) => onChange({ label: e.target.value })} />
          </Field>
          {(item?.fields ?? [])
            .filter((field) => isFieldShown(field, data))
            .map((field) => (
              <StepField key={`${node.id}-${field.key}`} field={field} data={data} onChange={onChange} />
            ))}
        </fieldset>

        {vars.length > 0 ? (
          <section aria-labelledby="step-vars" className="border-t border-border pt-3">
            <h3 id="step-vars" className="mb-1 text-xs font-semibold text-foreground">
              Values you can use here
            </h3>
            <p className="mb-2 text-[11px] text-muted-foreground">Click to copy, then paste into a field.</p>
            <ul className="space-y-1">
              {vars.map((v) => (
                <li key={v.ref}>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(v.ref, 'Reference')}
                    className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-background px-2 py-1 text-left hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <code className="truncate font-mono text-[11px] text-foreground">{v.ref}</code>
                    <span className="shrink-0 text-[10px] text-muted-foreground">{v.from}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function StepField({
  field,
  data,
  onChange,
}: {
  field: WorkflowField;
  data: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
}) {
  const raw = data[field.key];
  const value = Array.isArray(raw) ? raw.join(', ') : raw === undefined || raw === null ? '' : String(raw);
  const invalidJson = useMemo(() => {
    if (field.kind !== 'json' || !value.trim()) return false;
    try {
      JSON.parse(value.replace(/\{\{[^}]+\}\}/g, '0'));
      return false;
    } catch {
      return true;
    }
  }, [field.kind, value]);

  return (
    <Field
      label={field.label}
      required={field.required}
      hint={field.hint}
      error={invalidJson ? 'Not valid JSON yet.' : undefined}
    >
      {field.kind === 'textarea' || field.kind === 'json' ? (
        <Textarea
          rows={field.kind === 'json' ? 5 : 4}
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange({ [field.key]: e.target.value })}
          className="font-mono text-xs"
        />
      ) : field.kind === 'number' ? (
        <Input
          type="number"
          inputMode="decimal"
          min={field.min}
          max={field.max}
          step={field.step}
          value={value}
          onChange={(e) => onChange({ [field.key]: e.target.value === '' ? '' : Number(e.target.value) })}
        />
      ) : field.kind === 'select' ? (
        <Select value={value} onValueChange={(v) => onChange({ [field.key]: v })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.kind === 'source' && field.source ? (
        <BuilderOptionSelect
          source={field.source}
          value={value}
          savedLabel={String(data[`${field.key}Label`] ?? '')}
          filterValue={field.filterBy ? String(data[field.filterBy] ?? '') : undefined}
          onChange={(next, label) =>
            onChange({
              [field.key]: next,
              [`${field.key}Label`]: label,
              // Clearing a provider's model keeps the pair consistent.
              ...(field.key === 'provider' ? { model: '' } : {}),
            })
          }
        />
      ) : (
        <Input
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onChange({ [field.key]: e.target.value })}
          className={field.mono ? 'font-mono text-xs' : undefined}
        />
      )}
    </Field>
  );
}

function samplePayload(trigger: Record<string, unknown>): string {
  if (trigger['triggerKind'] === 'EVENT') {
    const event = String(trigger['event'] ?? 'task.created');
    if (event.startsWith('task.')) return JSON.stringify({ title: 'Example task', taskId: 'task_123', projectId: null }, null, 2);
    return JSON.stringify({ trigger: event }, null, 2);
  }
  return JSON.stringify({ input: { text: '' } }, null, 2);
}

function RunDialog({
  open,
  onOpenChange,
  triggerData,
  running,
  dirty,
  runsPath,
  onRun,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerData: Record<string, unknown>;
  running: boolean;
  dirty: boolean;
  runsPath: string;
  onRun: (payload: Record<string, unknown>) => Promise<{ runId: string; status: string; results: Array<{ stepId: string; status: string; output: unknown }> } | null>;
}) {
  const [text, setText] = useState(() => samplePayload(triggerData));
  const [result, setResult] = useState<Awaited<ReturnType<typeof onRun>>>(null);
  let parsed: Record<string, unknown> | null = null;
  try {
    const value = JSON.parse(text) as unknown;
    parsed = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    parsed = null;
  }
  const failed = result?.results.find((r) => r.status === 'FAILED');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Test run</DialogTitle>
          <DialogDescription>
            Runs the workflow for real with this input and records it in Runs.
            {dirty ? ' Your changes are saved first.' : ''}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          <Field label="Input (JSON)" error={parsed ? undefined : 'Enter a JSON object.'}>
            <Textarea rows={7} value={text} onChange={(e) => setText(e.target.value)} className="font-mono text-xs" />
          </Field>
          {result ? (
            <div role="status" className="space-y-2 rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <Badge
                  variant={result.status === 'SUCCESS' ? 'success' : result.status === 'FAILED' ? 'destructive' : 'warning'}
                >
                  {result.status === 'SUCCESS' ? 'Completed' : result.status === 'FAILED' ? 'Failed' : 'Waiting for approval'}
                </Badge>
                <Button variant="ghost" size="sm" asChild>
                  <Link to={`${runsPath}?run=${result.runId}`}>
                    Open run <ExternalLink className="size-3.5" />
                  </Link>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                {result.results.length} step{result.results.length === 1 ? '' : 's'} ran. Steps on the canvas are outlined green,
                red or amber by how they went.
              </p>
              {failed ? (
                <p className="rounded-md bg-destructive/5 p-2 font-mono text-xs text-destructive">
                  {failed.stepId}: {String((failed.output as { error?: string } | null)?.error ?? 'failed')}
                </p>
              ) : null}
            </div>
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button
            leadingIcon={<Play />}
            loading={running}
            disabled={!parsed}
            onClick={async () => setResult(await onRun(parsed as Record<string, unknown>))}
          >
            Run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VersionsDialog({
  open,
  onOpenChange,
  workspaceId,
  workflowId,
  canEdit,
  dirty,
  onRestored,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  workflowId: string;
  canEdit: boolean;
  dirty: boolean;
  onRestored: () => void;
}) {
  const queryClient = useQueryClient();
  const [summary, setSummary] = useState('');
  const versions = useQuery({
    queryKey: queryKeys.automations.versions(workspaceId, workflowId),
    queryFn: () => automationsApi.versions(workspaceId, workflowId),
    enabled: open,
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.automations.versions(workspaceId, workflowId) });
  const snapshot = useMutation({
    mutationFn: () => automationsApi.createVersion(workspaceId, workflowId, summary.trim() || undefined),
    onSuccess: () => {
      toast.success('Version saved');
      setSummary('');
      void refresh();
    },
    onError: () => toast.error('Could not save a version'),
  });
  const restore = useMutation({
    mutationFn: (version: number) => automationsApi.restoreVersion(workspaceId, workflowId, version),
    onSuccess: (_row, version) => {
      toast.success(`Restored v${version}`);
      onOpenChange(false);
      onRestored();
    },
    onError: () => toast.error('Could not restore that version'),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Versions</DialogTitle>
          <DialogDescription>Publishing saves a version too. Restoring replaces the canvas with that version.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3">
          {canEdit ? (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                snapshot.mutate();
              }}
            >
              <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="What changed?" aria-label="Version note" />
              <Button type="submit" variant="outline" loading={snapshot.isPending}>
                Save version
              </Button>
            </form>
          ) : null}
          {dirty ? <p className="text-xs text-warning-text">Unsaved canvas changes aren’t part of a version — save first.</p> : null}
          {versions.isLoading ? (
            <LoadingState label="Loading versions…" />
          ) : (versions.data ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions yet.</p>
          ) : (
            <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {(versions.data ?? []).map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-foreground">v{v.versionNumber}</span>
                      {v.isPublished ? (
                        <Badge variant="success" className="text-[10px]">
                          Published
                        </Badge>
                      ) : null}
                      <span className="text-xs text-muted-foreground">{formatRelative(v.createdAt)}</span>
                    </div>
                    {v.changeSummary ? <p className="truncate text-xs text-muted-foreground">{v.changeSummary}</p> : null}
                  </div>
                  {canEdit ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      leadingIcon={<RotateCcw />}
                      onClick={async () => {
                        const ok = await confirm({
                          title: `Restore v${v.versionNumber}?`,
                          description: 'The current canvas is replaced. Save a version first if you may want it back.',
                          confirmLabel: 'Restore',
                        });
                        if (ok) restore.mutate(v.versionNumber);
                      }}
                    >
                      Restore
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
