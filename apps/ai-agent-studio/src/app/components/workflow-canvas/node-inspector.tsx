import { Badge, Button, Input, AIModelBadge, AppSelect, Switch, toast, Label, Textarea, Checkbox, Slider, Tabs, TabsList, TabsTrigger } from '@org/ui';
import { cn } from '@org/utils';
import { AGENT_EVENTS, type StudioGraphIssue } from '@org/types';
import type { Connection, Edge, Node } from '@xyflow/react';
import {
  Braces,
  ChevronRight,
  Flame,
  LayoutDashboard,
  Link2,
  Shield,
  Sliders,
  Trash2,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getSlot, isSlotHost } from './agent-slots.js';
import { ConnectorNodeConfig } from './connector-node-config.js';
import { getNodeIcon, getStatusBadge, NodeWiringPanel } from './node-wiring-panel.js';
import {
  MODULE_BY_SLOT,
  readAgentModules,
  summarizeAgentModules,
  type AgentModuleId,
  type ModuleDraft,
} from './agent-config/agent-module-model.js';
import { AgentModulesOverview } from './agent-config/agent-modules-overview.js';
import { useConnectors } from '../../services/connectors.js';
import { variableOptions } from './variable-options.js';
import { ModuleDrawer, type ModuleActions } from './agent-config/module-drawer.js';
import { useBuiltinTools, useKnowledgeBases, useMediaQuery, useModelOptions } from './agent-config/use-agent-config-data.js';

/** A node's data plus every edge touching it — what Cancel puts back. */
export interface NodeSnapshot {
  data: Record<string, unknown>;
  edges: Edge[];
}

interface NodeInspectorProps {
  selectedNode: Node | null;
  /** Whole graph, for the Wiring tab. */
  nodes: Node[];
  edges: Edge[];
  readOnly?: boolean;
  onUpdateNode: (nodeId: string, updatedData: any) => void;
  onDeleteNode: (nodeId: string) => void;
  onRewireEdge: (edgeId: string, patch: Partial<Pick<Edge, 'source' | 'target' | 'sourceHandle' | 'targetHandle'>>) => void;
  onDeleteEdge: (edgeId: string) => void;
  onConnect: (connection: Connection) => void;
  /** Cancel: put the node's data and wiring back the way they were when the panel opened. */
  onRestoreNode: (nodeId: string, snapshot: NodeSnapshot) => void;
  onClose: () => void;
  className?: string;
  /** Graph-level settings (run limits) — the Sub-agents module edits them. */
  graphSettings?: Record<string, unknown>;
  /** Compiler issues per node, for module validation. */
  issuesByNode?: Map<string, StudioGraphIssue[]>;
  /** Agents: the capability module open in the drawer, and where to land in it. */
  activeModule?: { id: AgentModuleId; section?: string; field?: string } | null;
  onOpenModule?: (module: { id: AgentModuleId; section?: string; field?: string } | null) => void;
  /** Opens another agent's module (from a Prompt / LLM / knowledge card plugged into it). */
  onOpenAgentModule?: (agentId: string, module: AgentModuleId) => void;
  /** Writes a module drawer's draft into the graph. */
  onApplyModuleDraft?: (draft: ModuleDraft) => void;
  /** Saves the agent now. */
  onSaveNow?: () => void;
  moduleActions?: ModuleActions;
  /** Reports unsaved module edits, so the page can guard clicks that would close the panel. */
  onModuleDirtyChange?: (dirty: boolean) => void;
}

/** Workspace events a canvas trigger can start on — channel messages also need a channel, which this card can't pick yet. */
const WORKSPACE_EVENT_OPTIONS = AGENT_EVENTS.filter((e) => e.filter !== 'channel').map((e) => ({ value: e.value, label: e.label }));

const WIDTH_KEY = 'studio.inspector.width';
const MIN_WIDTH = 320;
const DEFAULT_WIDTH = 400;
const MODULE_MIN_WIDTH = 420;

function readStoredWidth(): number {
  try {
    const v = Number(localStorage.getItem(WIDTH_KEY));
    return Number.isFinite(v) && v >= MIN_WIDTH ? v : DEFAULT_WIDTH;
  } catch {
    return DEFAULT_WIDTH;
  }
}

const EMPTY_ISSUES = new Map<string, StudioGraphIssue[]>();

const touching = (edges: Edge[], nodeId: string) =>
  edges.filter((e) => e.source === nodeId || e.target === nodeId);

/** Order-insensitive fingerprint of a node's data + wiring, to tell whether anything changed. */
const fingerprint = (data: unknown, edges: Edge[]) =>
  JSON.stringify([
    data,
    edges
      .map((e) => [e.id, e.source, e.target, e.sourceHandle ?? null, e.targetHandle ?? null])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  ]);

export function NodeInspector({
  selectedNode,
  nodes,
  edges,
  readOnly,
  onUpdateNode,
  onDeleteNode,
  onRewireEdge,
  onDeleteEdge,
  onConnect,
  onRestoreNode,
  onClose,
  className,
  graphSettings,
  issuesByNode,
  activeModule,
  onOpenModule,
  onOpenAgentModule,
  onApplyModuleDraft,
  onSaveNow,
  moduleActions,
  onModuleDirtyChange,
}: NodeInspectorProps) {
  const connectors = useConnectors();
  const isPhone = useMediaQuery('(max-width: 767px)');
  // Resizable width (desktop and tablet), remembered across sessions.
  const [width, setWidth] = useState(readStoredWidth);
  const widthRef = useRef(width);
  widthRef.current = width;
  const commitWidth = useCallback((w: number) => {
    const max = Math.max(MIN_WIDTH, Math.min(880, Math.round(window.innerWidth * 0.7)));
    const next = Math.round(Math.min(Math.max(w, MIN_WIDTH), max));
    setWidth(next);
    try {
      localStorage.setItem(WIDTH_KEY, String(next));
    } catch {
      // Storage unavailable: the width just isn't remembered.
    }
  }, []);
  const startResize = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = widthRef.current;
    const move = (ev: PointerEvent) => commitWidth(startW + (startX - ev.clientX));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.cursor = '';
    };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const [showVariablePicker, setShowVariablePicker] = useState(false);
  const [targetField, setTargetField] = useState<string | null>(null);
  const [tab, setTab] = useState<'settings' | 'wiring' | 'analytics'>('settings');

  // Edits apply to the canvas live; this is the state Cancel returns to. The parent
  // keys the inspector by node id, so a new node gets a new snapshot.
  const [snapshot] = useState<NodeSnapshot | null>(() =>
    selectedNode ? { data: selectedNode.data as Record<string, unknown>, edges: touching(edges, selectedNode.id) } : null,
  );
  const hasChanges = useMemo(() => {
    if (!selectedNode || !snapshot) return false;
    return (
      fingerprint(selectedNode.data, touching(edges, selectedNode.id)) !== fingerprint(snapshot.data, snapshot.edges)
    );
  }, [selectedNode, edges, snapshot]);

  // Agents: their five capability modules, summarized from the live graph.
  const isAgent = Boolean(selectedNode && isSlotHost(selectedNode.type));
  const stepIds = useMemo(() => nodes.map((n) => n.id), [nodes]);
  const moduleSummaries = useMemo(
    () =>
      selectedNode && isAgent
        ? summarizeAgentModules(readAgentModules(selectedNode, nodes, edges, graphSettings), { issuesByNode, stepIds })
        : [],
    [selectedNode, isAgent, nodes, edges, graphSettings, issuesByNode, stepIds],
  );
  // A card plugged into an agent (Prompt, LLM, knowledge, tool): which agent and module.
  const ownerSlot = useMemo(() => {
    if (!selectedNode) return null;
    const edge = edges.find((e) => e.target === selectedNode.id && getSlot(e.sourceHandle));
    const owner = edge ? nodes.find((n) => n.id === edge.source) : undefined;
    const module = edge ? MODULE_BY_SLOT.get(getSlot(edge.sourceHandle)!.id) : undefined;
    return owner && module ? { agent: owner, module } : null;
  }, [selectedNode, nodes, edges]);
  const showModule = Boolean(isAgent && activeModule && onApplyModuleDraft && moduleActions);
  useEffect(() => {
    if (!showModule) onModuleDirtyChange?.(false);
  }, [showModule, onModuleDirtyChange]);

  if (!selectedNode) {
    return (
      <div
        className={cn(
          'flex h-full w-80 flex-col items-center justify-center border-l border-border bg-surface p-6 text-center text-muted-foreground select-none',
          className,
        )}
      >
        <Sliders className="size-8 text-muted-foreground/40 mb-2" />
        <div className="text-xs font-semibold text-foreground">
          No Node Selected
        </div>
        <p className="mt-1 text-xs leading-relaxed">
          Click any node on the workflow canvas to configure its properties, models, prompts, and tool attachments.
        </p>
      </div>
    );
  }

  const nodeType = (selectedNode.type || '').toUpperCase();
  const data = selectedNode.data as any;
  const config = data.config || {};
  // Prompt nodes keep their text in `prompt` (edited inline on the canvas too); transforms use `template`
  const templateKey = nodeType === 'PROMPT_TEMPLATE' ? 'prompt' : 'template';

  const updateConfig = (key: string, value: any) => {
    onUpdateNode(selectedNode.id, {
      ...data,
      config: {
        ...config,
        [key]: value,
      },
    });
  };

  const pickerVariables = variableOptions(selectedNode, nodes, edges, connectors.data ?? []);

  const insertVariable = (variableStr: string) => {
    if (!targetField) return;
    const current = config[targetField] || '';
    updateConfig(targetField, `${current} ${variableStr}`.trim());
    setShowVariablePicker(false);
    toast.success(`Inserted ${variableStr}`);
  };

  const NodeIcon = getNodeIcon(selectedNode.type);
  const statusBadge = getStatusBadge(data.status);

  const handleCancel = () => {
    if (hasChanges && snapshot) onRestoreNode(selectedNode.id, snapshot);
    onClose();
  };

  return (
    <aside
      aria-label={`${data.label || 'Node'} settings`}
      role={isPhone ? 'dialog' : 'complementary'}
      aria-modal={isPhone || undefined}
      style={isPhone ? undefined : { width: Math.max(width, showModule ? MODULE_MIN_WIDTH : MIN_WIDTH) }}
      className={cn(
        'flex flex-col overflow-hidden border border-border bg-surface text-foreground shadow-2xl',
        'animate-in fade-in slide-in-from-right-2 duration-150 motion-reduce:animate-none',
        className,
        // Phones: a full-screen sheet, not a squeezed side panel.
        isPhone ? '!fixed !inset-0 !z-50 !h-dvh !w-full !max-w-none rounded-none border-0' : 'rounded-xl',
      )}
      onKeyDown={(e) => {
        // Esc closes the panel (keeping edits) unless a field wants it
        if (e.key === 'Escape' && !(e.target as HTMLElement).closest('input, textarea, select, [role="listbox"]')) {
          e.stopPropagation();
          onClose();
        }
      }}
    >
      {!isPhone && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize panel"
          aria-valuenow={width}
          aria-valuemin={MIN_WIDTH}
          tabIndex={0}
          onPointerDown={startResize}
          onDoubleClick={() => commitWidth(DEFAULT_WIDTH)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') commitWidth(width + 24);
            else if (e.key === 'ArrowRight') commitWidth(width - 24);
            else return;
            e.preventDefault();
          }}
          className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize rounded-l-2xl hover:bg-primary/30 focus-visible:bg-primary/40 focus-visible:outline-none"
        />
      )}
      {showModule && activeModule && selectedNode && onApplyModuleDraft && moduleActions ? (
        <ModuleDrawer
          key={`${selectedNode.id}:${activeModule.id}`}
          moduleId={activeModule.id}
          agent={selectedNode}
          nodes={nodes}
          edges={edges}
          graphSettings={graphSettings}
          issuesByNode={issuesByNode ?? EMPTY_ISSUES}
          readOnly={Boolean(readOnly)}
          initialSection={activeModule.section}
          initialField={activeModule.field}
          actions={moduleActions}
          onApply={onApplyModuleDraft}
          onSaveNow={() => onSaveNow?.()}
          onBack={() => onOpenModule?.(null)}
          onClose={onClose}
          onSwitchModule={(id) => onOpenModule?.({ id })}
          onDirtyChange={onModuleDirtyChange}
        />
      ) : (
      <>
      {/* Header: what this step is and how it last ran */}
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <NodeIcon className="size-4 shrink-0 text-primary" />
        <h3 className="min-w-0 truncate text-sm font-semibold" title={data.label || selectedNode.id}>
          {data.label || selectedNode.id}
        </h3>
        {statusBadge ? (
          <span
            className={cn(
              'inline-flex h-5 shrink-0 items-center rounded-md border px-1.5 text-xs font-semibold',
              statusBadge.className,
            )}
          >
            {statusBadge.label}
          </span>
        ) : (
          <span className="inline-flex h-5 shrink-0 items-center rounded-md border border-border bg-surface-raised px-1.5 font-mono text-2xs text-muted-foreground">
            {nodeType}
          </span>
        )}
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {!readOnly && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => onDeleteNode(selectedNode.id)}
              className="text-muted-foreground hover:text-destructive"
              title="Delete node"
              aria-label="Delete node"
            >
              <Trash2 className="size-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            title="Close (Esc)"
            aria-label="Close"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={(next) => setTab(next as typeof tab)} className="gap-0">
        <TabsList variant="underline" aria-label="Node panel" className="px-4">
          {(['settings', 'wiring', 'analytics'] as const).map((id) => (
            <TabsTrigger key={id} value={id} className="capitalize">
              {id}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {tab === 'wiring' && (
        <div role="tabpanel" className="relative flex-1 overflow-y-auto p-4">
          <NodeWiringPanel
            node={selectedNode}
            nodes={nodes}
            edges={edges}
            readOnly={readOnly}
            onRewireEdge={onRewireEdge}
            onDeleteEdge={onDeleteEdge}
            onConnect={onConnect}
            onUpdateConfig={updateConfig}
          />
        </div>
      )}

      {tab === 'analytics' && (
        <div role="tabpanel" className="relative flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <span className="font-semibold text-foreground">Node Execution Telemetry</span>
            {data.analytics ? (
              <Badge
                variant={data.analytics.successRate >= 95 ? 'success' : 'warning'}
                className="text-2xs"
              >
                {data.analytics.successRate.toFixed(1)}% Success
              </Badge>
            ) : (
              <Badge variant="outline" className="text-2xs">
                {data.run ? 'Latest Run Available' : 'No Live Telemetry'}
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2.5 text-center">
            <div className="p-2.5 rounded-lg border border-border bg-surface-raised">
              <div className="text-2xs text-muted-foreground font-semibold">Total Runs</div>
              <div className="mt-1 text-base font-bold text-foreground">
                {data.analytics?.executionCount ?? (data.run ? 1 : 0)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg border border-border bg-surface-raised">
              <div className="text-2xs text-muted-foreground font-semibold">Avg Latency</div>
              <div className="mt-1 text-base font-bold text-foreground">
                {Math.round(data.analytics?.avgDurationMs ?? data.run?.latencyMs ?? 0)}ms
              </div>
            </div>
            <div className="p-2.5 rounded-lg border border-border bg-surface-raised">
              <div className="text-2xs text-muted-foreground font-semibold">Token Usage</div>
              <div className="mt-1 text-base font-bold text-foreground">
                {(data.analytics?.totalTokens ?? data.run?.tokens ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="p-2.5 rounded-lg border border-border bg-surface-raised">
              <div className="text-2xs text-muted-foreground font-semibold">Incurred Cost</div>
              <div className="mt-1 text-base font-bold text-foreground">
                ${(data.analytics?.estimatedCost ?? ((data.run?.tokens ?? 0) * 0.000005)).toFixed(4)}
              </div>
            </div>
          </div>

          {/* Last run output */}
          {data.run && (
            <div className="space-y-1.5 border-t border-border pt-3">
              <span className="font-semibold text-foreground">Latest Step Output</span>
              <pre className="p-2.5 rounded-lg bg-surface-raised border border-border text-2xs font-mono max-h-36 overflow-auto whitespace-pre-wrap break-all text-muted-foreground">
                {data.run.error ? data.run.error : data.run.output || 'No output text'}
              </pre>
            </div>
          )}

          {/* Redacted inputs/parameters */}
          {config && Object.keys(config).length > 0 && (
            <div className="space-y-1.5 border-t border-border pt-3">
              <span className="font-semibold text-foreground">Step Parameters & Inputs</span>
              <pre className="p-2.5 rounded-lg bg-surface-raised border border-border text-2xs font-mono max-h-32 overflow-auto whitespace-pre-wrap break-all text-muted-foreground">
                {JSON.stringify(config, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Settings tab */}
      {tab === 'settings' && (
      <div role="tabpanel" className="relative flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Variable picker, opened by the "Insert Variable" links below */}
        {showVariablePicker && targetField && (
          <div className="sticky top-0 z-10 rounded-xl border border-primary/30 bg-surface p-3 shadow-lg animate-in fade-in slide-in-from-top-1 duration-100">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Braces className="size-3.5 text-primary" />
                Insert a variable
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setShowVariablePicker(false)}
                aria-label="Close variable picker"
              >
                <X className="size-3.5" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {pickerVariables.map((v) => (
                <Button
                  key={v.token}
                  type="button"
                  variant="outline"
                  size="xs"
                  title={v.hint}
                  onClick={() => insertVariable(v.token)}
                  className="h-5 px-1.5 font-mono text-2xs"
                >
                  {v.token}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* General: Title & Description */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-foreground">
              Node Title
            </Label>
            <Input
              value={data.title || data.label || ''}
              onChange={(e) => {
                onUpdateNode(selectedNode.id, {
                  ...data,
                  title: e.target.value,
                  label: e.target.value,
                });
              }}
              placeholder="Display title"
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs font-semibold text-foreground">
                Description
              </Label>
              {/* Hidden on the card by default; this puts it under the title. */}
              <Label className="flex cursor-pointer items-center gap-1.5 text-2xs text-muted-foreground select-none">
                Show on card
                <Switch
                  checked={data.showDescription === true}
                  onCheckedChange={(checked) =>
                    onUpdateNode(selectedNode.id, { ...data, showDescription: checked })
                  }
                  aria-label="Show description on card"
                  className="scale-75"
                />
              </Label>
            </div>
            <Input
              value={data.description || data.subtitle || ''}
              onChange={(e) => {
                onUpdateNode(selectedNode.id, {
                  ...data,
                  description: e.target.value,
                  subtitle: e.target.value,
                });
              }}
              placeholder="Short description or purpose"
              className="h-8 text-xs"
            />
          </div>
        </div>

        {/* 1. AGENTS: the five capability modules (each opens its own drawer) */}
        {isAgent && onOpenModule && (
          <div className="border-t border-border pt-3">
            <AgentModulesOverview
              summaries={moduleSummaries}
              onOpen={(id, target) => onOpenModule({ id, ...target })}
              onRunTest={() => moduleActions?.runAgentTest()}
            />
          </div>
        )}

        {/* A card plugged into an agent: its full settings live in that agent's module */}
        {ownerSlot && onOpenAgentModule && (
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenAgentModule(ownerSlot.agent.id, ownerSlot.module.id)}
            className="h-auto w-full justify-start gap-2 whitespace-normal rounded-lg border-primary/30 bg-primary/5 px-3 py-2 text-left text-xs font-normal text-foreground hover:bg-primary/10"
          >
            <Link2 className="size-3.5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              Plugged into <strong>{String((ownerSlot.agent.data as { label?: string } | undefined)?.label ?? 'an agent')}</strong> → {ownerSlot.module.label}.
              <span className="block text-muted-foreground">Open the full {ownerSlot.module.label} settings</span>
            </span>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          </Button>
        )}

        {/* 2. FIRECRAWL PROPERTIES */}
        {nodeType.startsWith('FIRECRAWL') && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="rounded-lg bg-warning/10 p-2.5 text-xs text-warning">
              <div className="font-semibold flex items-center gap-1.5">
                <Flame className="size-3.5" /> Firecrawl Web Integration
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Connects directly to Firecrawl API or built-in intelligent scraper to convert pages to markdown.
              </p>
            </div>

            {nodeType === 'FIRECRAWL_SEARCH' && (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">
                      Search Query
                    </Label>
                    <Button
                      type="button"
                      variant="link"
                      size="xs"
                      onClick={() => {
                        setTargetField('query');
                        setShowVariablePicker(true);
                      }}
                      className="h-auto text-2xs"
                    >
                      Use Variable
                    </Button>
                  </div>
                  <Input
                    value={config.query || ''}
                    onChange={(e) => updateConfig('query', e.target.value)}
                    placeholder="e.g. {{input.query}} or AI news"
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Result Limit: {config.limit || 5}
                  </Label>
                  <Slider
                    min={1}
                    max={15}
                    value={[Number(config.limit || 5)]}
                    onValueChange={([v]) => updateConfig('limit', v)}
                  />
                </div>
              </>
            )}

            {(nodeType === 'FIRECRAWL_SCRAPE' || nodeType === 'FIRECRAWL_CRAWL' || nodeType === 'FIRECRAWL_EXTRACT') && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-foreground">
                    Target URL
                  </Label>
                  <Button
                    type="button"
                    variant="link"
                    size="xs"
                    onClick={() => {
                      setTargetField('url');
                      setShowVariablePicker(true);
                    }}
                    className="h-auto text-2xs"
                  >
                    Use Variable
                  </Button>
                </div>
                <Input
                  value={config.url || ''}
                  onChange={(e) => updateConfig('url', e.target.value)}
                  placeholder="https://example.com"
                  className="h-8 text-xs font-mono"
                />
              </div>
            )}

            {nodeType === 'FIRECRAWL_EXTRACT' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Extraction Objective / Prompt
                </Label>
                <Textarea rows={3} value={config.prompt || ''} onChange={(e) => updateConfig('prompt', e.target.value)} placeholder="Extract product price, features, and company contacts…" className="text-xs" />
              </div>
            )}
          </div>
        )}

        {/* 3. MCP TOOL PROPERTIES */}
        {(nodeType === 'MCP_TOOL' || nodeType === 'TOOL') && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                MCP Tool Name
              </Label>
              <BuiltinToolSelect value={config.toolName || 'search_docs'} disabled={readOnly} onChange={(v) => updateConfig('toolName', v)} />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Timeout (seconds): {config.timeout || 30}s
              </Label>
              <Slider
                min={5}
                max={120}
                value={[Number(config.timeout || 30)]}
                onValueChange={([v]) => updateConfig('timeout', v)}
              />
            </div>
          </div>
        )}

        {/* 3b. APP ACTIONS AND APP EVENTS — any connector, from its live manifest */}
        {(nodeType === 'APP_CONNECTOR_ACTION' || nodeType === 'TEAMS_SEND_MESSAGE' || nodeType === 'TEAMS_CREATE_MEETING') && (
          <ConnectorNodeConfig
            node={selectedNode}
            nodes={nodes}
            kind="action"
            config={config}
            readOnly={readOnly}
            setConfig={(patch) => onUpdateNode(selectedNode.id, { ...data, config: { ...config, ...patch } })}
          />
        )}
        {nodeType === 'ATTENDANCE_ACTION' && (
          <ConnectorNodeConfig
            node={selectedNode}
            nodes={nodes}
            kind="action"
            config={config}
            readOnly={readOnly}
            lockedProvider="ATTENDANCE"
            setConfig={(patch) => onUpdateNode(selectedNode.id, { ...data, config: { ...config, ...patch } })}
          />
        )}
        {(nodeType === 'APP_CONNECTOR_TRIGGER' || nodeType === 'TEAMS_TRIGGER_MESSAGE') && (
          <ConnectorNodeConfig
            node={selectedNode}
            nodes={nodes}
            kind="trigger"
            config={config}
            readOnly={readOnly}
            setConfig={(patch) => onUpdateNode(selectedNode.id, { ...data, config: { ...config, ...patch } })}
          />
        )}

        {/* 4. IF / ELSE PROPERTIES */}
        {nodeType === 'IF_ELSE' && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Variable to Compare
              </Label>
              <Input
                value={config.variable || ''}
                onChange={(e) => updateConfig('variable', e.target.value)}
                placeholder="e.g. status or price"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Operator
              </Label>
              <AppSelect
                value={config.operator || 'equals'}
                onValueChange={(v) => updateConfig('operator', v)}
                options={[
                  { value: 'equals', label: 'Equals (==)' },
                  { value: 'not_equals', label: 'Not Equals (!=)' },
                  { value: 'contains', label: 'Contains substring' },
                  { value: 'greater_than', label: 'Greater than (>)' },
                  { value: 'less_than', label: 'Less than (<)' },
                  { value: 'is_empty', label: 'Is Empty' },
                ]}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Expected Value
              </Label>
              <Input
                value={config.value || ''}
                onChange={(e) => updateConfig('value', e.target.value)}
                placeholder="e.g. true or approved"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>
        )}

        {/* 5. HUMAN APPROVAL PROPERTIES */}
        {nodeType === 'USER_APPROVAL' && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Approval Action Name
              </Label>
              <Input
                value={config.action || ''}
                onChange={(e) => updateConfig('action', e.target.value)}
                placeholder="e.g. Approve sending outbound email"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Description / Context for Approver
              </Label>
              <Textarea rows={3} value={config.description || ''} onChange={(e) => updateConfig('description', e.target.value)} placeholder="Explain why this operation needs human approval…" className="text-xs" />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-foreground">
                Strict Gate (pause execution)
              </span>
              <Checkbox checked={config.required !== false} onCheckedChange={(c) => updateConfig('required', c === true)} />
            </div>
          </div>
        )}

        {/* 5b. AI GUARDRAIL PROPERTIES */}
        {nodeType === 'AI_GUARDRAIL' && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="rounded-lg bg-success/10 p-2.5 text-xs text-success-text">
              <div className="font-semibold flex items-center gap-1.5">
                <Shield className="size-3.5 text-success" /> Security & Guardrail Filter
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Applies automated PII redaction, token budgets, and prompt injection defenses to protect outputs.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Guardrail Mode
              </Label>
              <AppSelect
                value={config.policy || 'pii-redaction'}
                onValueChange={(v) => updateConfig('policy', v)}
                options={[
                  { value: 'pii-redaction', label: 'PII Redaction & Sanitization' },
                  { value: 'cost-cap', label: 'Cost & Token Budget Cap' },
                  { value: 'prompt-injection', label: 'Prompt Injection Defense' },
                  { value: 'content-safety', label: 'Content Safety & Toxicity Filter' },
                ]}
              />
            </div>

            {config.policy !== 'cost-cap' ? (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Policy Enforcement Action
                </Label>
                <AppSelect
                  value={config.action || 'redact'}
                  onValueChange={(v) => updateConfig('action', v)}
                  options={[
                    { value: 'redact', label: 'Redact (Replace sensitive tokens with [redacted])' },
                    { value: 'block', label: 'Block (Halt execution on policy violation)' },
                    { value: 'warn', label: 'Warn (Record finding in audit trace without modifying payload)' },
                  ]}
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Max Tokens Cap Per Run: {config.maxTokens || 4096}
                </Label>
                <Input
                  type="number"
                  min={100}
                  max={64000}
                  value={config.maxTokens || 4096}
                  onChange={(e) => updateConfig('maxTokens', parseInt(e.target.value, 10) || 4096)}
                  className="h-8 text-xs font-mono"
                />
                <span className="text-2xs text-muted-foreground">Hard cap applied by execution engine</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Custom Banned Words / RegEx (Optional)
              </Label>
              <Input
                value={config.bannedPhrases || ''}
                onChange={(e) => updateConfig('bannedPhrases', e.target.value)}
                placeholder="secret_key, internal_ip, password"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>
        )}

        {/* 6. TRANSFORM / TEMPLATE PROPERTIES */}
        {(nodeType === 'TRANSFORM' || nodeType === 'PROMPT_TEMPLATE') && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">
                  {nodeType === 'PROMPT_TEMPLATE' ? 'Prompt' : 'Template'}
                </Label>
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  onClick={() => {
                    setTargetField(templateKey);
                    setShowVariablePicker(true);
                  }}
                  className="h-auto text-2xs"
                >
                  Insert Variable
                </Button>
              </div>
              <Textarea rows={5} value={config[templateKey] || ''} onChange={(e) => updateConfig(templateKey, e.target.value)} placeholder="Draft formatted output: {{agent.output}} &#10;Source: {{firecrawl.url}}" className="font-mono text-xs" />
            </div>
          </div>
        )}

        {/* 6b. WIDGET NODES CONFIGURATION */}
        {nodeType.startsWith('WIDGET_') && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="rounded-lg bg-primary/10 p-2.5 text-xs text-primary-text">
              <div className="font-semibold flex items-center gap-1.5">
                <LayoutDashboard className="size-3.5 text-primary-text" /> Widget Configuration
              </div>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Configure rendering, data source binding, user interactions, and event execution for this widget canvas node.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Widget Type</Label>
              <AppSelect
                value={config.componentType || 'metric_card'}
                onValueChange={(v) => updateConfig('componentType', v)}
                options={[
                  {
                    label: 'Data & Visualization',
                    options: [
                      { value: 'metric_card', label: 'Metric Card' },
                      { value: 'bar_chart', label: 'Bar Chart' },
                      { value: 'line_chart', label: 'Line Chart' },
                      { value: 'table_view', label: 'Data Table' },
                      { value: 'progress_summary', label: 'Progress Summary' },
                    ],
                  },
                  {
                    label: 'Interactive Inputs',
                    options: [
                      { value: 'form_input', label: 'Form Input' },
                      { value: 'dynamic_form', label: 'Dynamic Form' },
                      { value: 'approval_form', label: 'Approval Form' },
                    ],
                  },
                  {
                    label: 'AI-Powered',
                    options: [
                      { value: 'ai_summary', label: 'AI Summary' },
                      { value: 'entity_extractor', label: 'Entity Extractor' },
                      { value: 'sentiment_analysis', label: 'Sentiment Analysis' },
                    ],
                  },
                  {
                    label: 'App Connector & Productivity',
                    options: [
                      { value: 'action_card', label: 'Action Card' },
                      { value: 'task_list', label: 'Task List' },
                      { value: 'meeting_notes', label: 'Meeting Notes' },
                    ],
                  },
                ]}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">Data Binding Path</Label>
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  onClick={() => {
                    setTargetField('dataPath');
                    setShowVariablePicker(true);
                  }}
                  className="h-auto text-2xs"
                >
                  Use Variable
                </Button>
              </div>
              <Input
                value={config.dataPath || ''}
                onChange={(e) => updateConfig('dataPath', e.target.value)}
                placeholder="e.g. {{prev.output}} or data.metrics"
                className="h-8 text-xs font-mono"
              />
            </div>

            {(nodeType === 'WIDGET_TRIGGER' || nodeType === 'WIDGET_ACTION' || nodeType === 'WIDGET_EVENT_HANDLER') && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Action / Event Name</Label>
                <Input
                  value={config.actionName || config.eventName || ''}
                  onChange={(e) => {
                    updateConfig('actionName', e.target.value);
                    updateConfig('eventName', e.target.value);
                  }}
                  placeholder="e.g. on_submit or export_report"
                  className="h-8 text-xs font-mono"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Display Size</Label>
                <AppSelect
                  value={config.size || 'md'}
                  onValueChange={(v) => updateConfig('size', v)}
                  options={[
                    { value: 'sm', label: 'Small (1x1)' },
                    { value: 'md', label: 'Medium (2x2)' },
                    { value: 'lg', label: 'Large (3x2)' },
                    { value: 'full', label: 'Full Width' },
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Auto-Refresh</Label>
                <AppSelect
                  value={config.refreshInterval || '0'}
                  onValueChange={(v) => updateConfig('refreshInterval', parseInt(v, 10))}
                  options={[
                    { value: '0', label: 'Manual only' },
                    { value: '15', label: 'Every 15s' },
                    { value: '60', label: 'Every 1m' },
                    { value: '300', label: 'Every 5m' },
                  ]}
                />
              </div>
            </div>
          </div>
        )}

        {/* LLM / CHAT MODEL (also editable on the canvas node) */}
        {nodeType === 'AI_CHAT_MODEL' && (
          <div className="space-y-3.5 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-foreground">Model</Label>
                {config.model && <AIModelBadge modelId={config.model} size="xs" variant="subtle" />}
              </div>
              <ModelSelect value={config.model || ''} onChange={(v) => updateConfig('model', v)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">
                Temperature: {config.temperature ?? 0.7}
              </Label>
              <Slider
                min={0}
                max={2}
                step={0.05}
                value={[Number(config.temperature ?? 0.7)]}
                onValueChange={([v]) => updateConfig('temperature', v)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Max tokens</Label>
              <Input
                type="number"
                min={1}
                step={256}
                value={config.maxTokens ?? 2048}
                onChange={(e) => {
                  const v = e.target.valueAsNumber;
                  if (Number.isFinite(v) && v >= 1) updateConfig('maxTokens', Math.round(v));
                }}
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}

        {/* 7. TRIGGER CONFIGURATION */}
        {nodeType.startsWith('TRIGGER') && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="rounded-lg bg-success/10 p-2.5 text-xs text-success-text font-semibold">
              Event Trigger Configuration
            </div>
            {nodeType === 'TRIGGER_SCHEDULE' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Cron Expression</Label>
                <Input
                  value={config.cron || '0 9 * * 1-5'}
                  onChange={(e) => updateConfig('cron', e.target.value)}
                  placeholder="0 9 * * 1-5"
                  className="h-8 text-xs font-mono"
                />
                <span className="text-2xs text-muted-foreground">Every weekday at 09:00 UTC</span>
              </div>
            )}
            {nodeType === 'TRIGGER_APP_EVENT' && !config.provider && !config.connectorId && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Starts when</Label>
                <AppSelect
                  value={String(config.eventType || config.event || '')}
                  onValueChange={(v) => updateConfig('eventType', v)}
                  placeholder="Pick a workspace event"
                  options={WORKSPACE_EVENT_OPTIONS}
                />
                <span className="block text-2xs text-muted-foreground">
                  Switch it on in Copilot. It runs as the agent’s owner, with the event’s details in <span className="font-mono">{'{{event}}'}</span>.
                </span>
              </div>
            )}
            {nodeType === 'TRIGGER_LOCATION' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Starts when its owner</Label>
                  <AppSelect
                    value={String(config.eventType || 'BOTH').toUpperCase()}
                    onValueChange={(v) => updateConfig('eventType', v)}
                    options={[
                      { value: 'BOTH', label: 'Arrives or leaves' },
                      { value: 'ENTER', label: 'Arrives' },
                      { value: 'EXIT', label: 'Leaves' },
                    ]}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Office name</Label>
                  <Input value={config.officeName ?? ''} onChange={(e) => updateConfig('officeName', e.target.value)} placeholder="Main office" className="h-8 text-xs" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['latitude', 'Latitude', '12.9716'],
                      ['longitude', 'Longitude', '77.5946'],
                    ] as const
                  ).map(([key, label, placeholder]) => (
                    <div key={key} className="space-y-1.5">
                      <Label className="text-xs font-semibold text-foreground">{label}</Label>
                      <Input
                        type="number"
                        step="any"
                        value={config[key] ?? ''}
                        onChange={(e) => updateConfig(key, e.target.value === '' ? undefined : Number(e.target.value))}
                        placeholder={placeholder}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  ))}
                </div>
                {(
                  [
                    ['radiusMeters', 'Radius', 100, 25, 1000, 'm'],
                    ['dwellTimeMinutes', 'Must stay', 3, 0, 30, 'min'],
                    ['accuracyThresholdMeters', 'Ignore readings less accurate than', 100, 10, 500, 'm'],
                    ['cooldownMinutes', 'At most once every', 60, 0, 480, 'min'],
                  ] as const
                ).map(([key, label, fallback, min, max, unit]) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-xs font-semibold text-foreground">
                      {label}: {config[key] ?? fallback} {unit}
                    </Label>
                    <Slider min={min} max={max} value={[Number(config[key] ?? fallback)]} onValueChange={([v]) => updateConfig(key, v)} />
                  </div>
                ))}
                <span className="block text-2xs text-muted-foreground">
                  Runs for the agent’s owner, from their device’s location updates. Readings at the edge of the zone are ignored.
                </span>
              </div>
            )}
            {nodeType === 'TRIGGER_WEBHOOK' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">HTTP Method</Label>
                <AppSelect
                  value={config.httpMethod || 'POST'}
                  onValueChange={(v) => updateConfig('httpMethod', v)}
                  options={[
                    { value: 'POST', label: 'POST (Recommended)' },
                    { value: 'GET', label: 'GET' },
                    { value: 'PUT', label: 'PUT' },
                  ]}
                />
                <span className="block text-2xs text-muted-foreground">
                  Switch it on in Copilot to get its URL and secret. Callers send the secret as the <span className="font-mono">x-webhook-secret</span> header; the JSON body is available as <span className="font-mono">{'{{event}}'}</span>.
                </span>
              </div>
            )}
            {nodeType === 'TRIGGER_CHAT' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground">Welcome Greeting</Label>
                <Input
                  value={config.welcomeGreeting || 'Hi! How can I assist you today?'}
                  onChange={(e) => updateConfig('welcomeGreeting', e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            )}
          </div>
        )}

        {/* 8. KNOWLEDGE & RETRIEVAL CONFIGURATION */}
        {(nodeType === 'KB_SEARCH' || nodeType === 'VECTOR_SEARCH' || nodeType === 'KNOWLEDGE_RETRIEVAL') && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Knowledge Base</Label>
              <KnowledgeBaseSelect value={config.knowledgeBaseId || ''} disabled={readOnly} onChange={(v) => updateConfig('knowledgeBaseId', v)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Top Chunks (Top-K): {config.topK || 4}</Label>
              <Slider min={1} max={10} value={[Number(config.topK || 4)]} onValueChange={([v]) => updateConfig('topK', v)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Min Similarity Score: {config.minScore || 0.75}</Label>
              <Slider
                min={0.5}
                max={0.95}
                step={0.05}
                value={[Number(config.minScore || 0.75)]}
                onValueChange={([v]) => updateConfig('minScore', v)}
              />
            </div>
          </div>
        )}

        {/* 9. CODE EXECUTION CONFIGURATION */}
        {(nodeType === 'CODE_JAVASCRIPT' || nodeType === 'CODE' || nodeType === 'CODE_PYTHON') && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Sandboxed Code</Label>
              <Textarea rows={8} value={config.code || '// Custom transformation\nreturn input;'} onChange={(e) => updateConfig('code', e.target.value)} className="font-mono text-xs" />
            </div>
          </div>
        )}

        {/* 10. HTTP REQUEST & DATABASE */}
        {nodeType === 'HTTP_REQUEST' && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">HTTP Method</Label>
              <AppSelect
                value={config.method || 'GET'}
                onValueChange={(v) => updateConfig('method', v)}
                options={[
                  { value: 'GET', label: 'GET' },
                  { value: 'POST', label: 'POST' },
                  { value: 'PUT', label: 'PUT' },
                  { value: 'DELETE', label: 'DELETE' },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Endpoint URL</Label>
              <Input
                value={config.url || ''}
                onChange={(e) => updateConfig('url', e.target.value)}
                placeholder="https://api.example.com/data"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>
        )}

        {nodeType === 'DB_QUERY' && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">SQL Query</Label>
              <Textarea rows={4} value={config.query || 'SELECT * FROM records LIMIT 20;'} onChange={(e) => updateConfig('query', e.target.value)} className="font-mono text-xs" />
            </div>
          </div>
        )}

        {/* 11. ANNOTATIONS: STICKY NOTE & GROUP */}
        {(nodeType === 'STICKY_NOTE' || nodeType === 'NOTE') && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Note Content</Label>
              <Textarea rows={6} value={config.note || ''} onChange={(e) => updateConfig('note', e.target.value)} placeholder="Document your architecture or steps here…" className="text-xs" />
            </div>
          </div>
        )}

        {nodeType === 'GROUP' && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-foreground">Stage Title</Label>
              <Input
                value={config.label || ''}
                onChange={(e) => updateConfig('label', e.target.value)}
                placeholder="e.g. Data Ingestion Stage"
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}

      </div>
      )}

      {/* Footer: Cancel reverts this step's edits + wiring; Save keeps them */}
      <div className="grid grid-cols-2 gap-2.5 border-t border-border p-4">
        <Button variant="outline" onClick={handleCancel} className="h-9 rounded-xl text-sm font-semibold">
          Cancel
        </Button>
        <Button
          onClick={onClose}
          disabled={!hasChanges || readOnly}
          title={hasChanges ? 'Keep these changes' : 'No changes yet'}
          className="h-9 rounded-xl text-sm font-semibold"
        >
          Save step
        </Button>
      </div>
      </>
      )}
    </aside>
  );
}

/** Built-in tools from the live registry (was a hard-coded list of ten). */
function ModelSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const options = useModelOptions(value);
  // Empty = the workspace's default model, which always has a key.
  return <AppSelect searchable value={value} placeholder="Workspace default model" loading={options.isLoading} onValueChange={onChange} options={options.groups} />;
}

function BuiltinToolSelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const tools = useBuiltinTools();
  const options = (tools.data ?? []).map((t) => ({ value: t.name, label: t.name, description: t.description }));
  if (value && tools.data && !options.some((o) => o.value === value)) options.unshift({ value, label: value, description: 'Not in the tool registry' });
  return (
    <AppSelect
      size="sm"
      searchable
      value={value}
      loading={tools.isLoading}
      disabled={disabled}
      aria-label="Tool"
      options={options}
      emptyText={tools.error ? 'Couldn’t load tools' : 'No tools'}
      onValueChange={onChange}
    />
  );
}

/** The workspace's real knowledge bases (was three hard-coded ids that didn't exist). */
function KnowledgeBaseSelect({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const bases = useKnowledgeBases();
  const options = (bases.data ?? []).map((b) => ({ value: b.id, label: b.name, description: `${b._count?.documents ?? 0} documents` }));
  const missing = Boolean(value) && Boolean(bases.data) && !options.some((o) => o.value === value);
  if (missing) options.unshift({ value, label: value, description: 'Not found in this workspace' });
  return (
    <div className="space-y-1">
      <AppSelect
        size="sm"
        searchable
        value={value}
        placeholder="Pick a knowledge base"
        loading={bases.isLoading}
        disabled={disabled}
        aria-label="Knowledge base"
        options={options}
        emptyText={bases.error ? 'Couldn’t load knowledge bases' : 'No knowledge bases yet'}
        onValueChange={onChange}
      />
      {missing && <p className="text-2xs text-destructive">That knowledge base no longer exists — pick another.</p>}
    </div>
  );
}
