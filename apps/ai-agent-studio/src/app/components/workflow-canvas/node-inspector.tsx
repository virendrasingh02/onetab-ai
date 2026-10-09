import { Button, Input, AIModelBadge, AppSelect, Switch, toast } from '@org/ui';
import { cn } from '@org/utils';
import type { StudioGraphIssue } from '@org/types';
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
import { MODEL_OPTIONS } from './custom-nodes.js';
import { getNodeIcon, getStatusBadge, NodeWiringPanel } from './node-wiring-panel.js';
import {
  MODULE_BY_SLOT,
  readAgentModules,
  summarizeAgentModules,
  type AgentModuleId,
  type ModuleDraft,
} from './agent-config/agent-module-model.js';
import { AgentModulesOverview } from './agent-config/agent-modules-overview.js';
import { ModuleDrawer, type ModuleActions } from './agent-config/module-drawer.js';
import { useBuiltinTools, useKnowledgeBases, useMediaQuery } from './agent-config/use-agent-config-data.js';

const COMMON_VARIABLES = [
  '{{input.message}}',
  '{{input.query}}',
  '{{agent.output}}',
  '{{firecrawl.markdown}}',
  '{{firecrawl.searchResults}}',
  '{{user.name}}',
  '{{workspace.name}}',
  '{{customer.email}}',
];

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
  const [tab, setTab] = useState<'settings' | 'wiring'>('settings');

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
        <p className="mt-1 text-[11px] leading-relaxed">
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
        isPhone ? '!fixed !inset-0 !z-50 !h-dvh !w-full !max-w-none rounded-none border-0' : 'rounded-2xl',
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
              'inline-flex h-5 shrink-0 items-center rounded-md border px-1.5 text-[11px] font-semibold',
              statusBadge.className,
            )}
          >
            {statusBadge.label}
          </span>
        ) : (
          <span className="inline-flex h-5 shrink-0 items-center rounded-md border border-border bg-surface-raised px-1.5 font-mono text-[10px] text-muted-foreground">
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
      <div role="tablist" aria-label="Node panel" className="flex gap-5 border-b border-border px-4">
        {(['settings', 'wiring'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              '-mb-px border-b-2 pb-2.5 text-sm font-medium capitalize transition-colors',
              tab === id
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {id}
          </button>
        ))}
      </div>

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

      {/* Settings tab */}
      {tab === 'settings' && (
      <div role="tabpanel" className="relative flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Variable picker, opened by the "Insert Variable" links below */}
        {showVariablePicker && targetField && (
          <div className="sticky top-0 z-10 rounded-xl border border-primary/30 bg-surface p-3 shadow-lg animate-in fade-in slide-in-from-top-1 duration-100">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                <Braces className="size-3.5 text-primary" />
                Insert a variable
              </span>
              <button
                type="button"
                onClick={() => setShowVariablePicker(false)}
                aria-label="Close variable picker"
                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => insertVariable(v)}
                  className="rounded-md border border-border bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-foreground transition-colors hover:border-primary/50 hover:text-primary"
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* General: Title & Description */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-foreground">
              Node Title
            </label>
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
              <label className="text-[11px] font-semibold text-foreground">
                Description
              </label>
              {/* Hidden on the card by default; this puts it under the title. */}
              <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-muted-foreground select-none">
                Show on card
                <Switch
                  checked={data.showDescription === true}
                  onCheckedChange={(checked) =>
                    onUpdateNode(selectedNode.id, { ...data, showDescription: checked })
                  }
                  aria-label="Show description on card"
                  className="scale-75"
                />
              </label>
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
          <button
            type="button"
            onClick={() => onOpenAgentModule(ownerSlot.agent.id, ownerSlot.module.id)}
            className="flex w-full items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-left text-[11px] text-foreground hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            <Link2 className="size-3.5 shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              Plugged into <strong>{String((ownerSlot.agent.data as { label?: string } | undefined)?.label ?? 'an agent')}</strong> → {ownerSlot.module.label}.
              <span className="block text-muted-foreground">Open the full {ownerSlot.module.label} settings</span>
            </span>
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          </button>
        )}

        {/* 2. FIRECRAWL PROPERTIES */}
        {nodeType.startsWith('FIRECRAWL') && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="rounded-lg bg-warning/10 p-2.5 text-xs text-warning">
              <div className="font-semibold flex items-center gap-1.5">
                <Flame className="size-3.5" /> Firecrawl Web Integration
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                Connects directly to Firecrawl API or built-in intelligent scraper to convert pages to markdown.
              </p>
            </div>

            {nodeType === 'FIRECRAWL_SEARCH' && (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-foreground">
                      Search Query
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setTargetField('query');
                        setShowVariablePicker(true);
                      }}
                      className="text-[10px] font-medium text-primary hover:underline"
                    >
                      Use Variable
                    </button>
                  </div>
                  <Input
                    value={config.query || ''}
                    onChange={(e) => updateConfig('query', e.target.value)}
                    placeholder="e.g. {{input.query}} or AI news"
                    className="h-8 text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-foreground">
                    Result Limit: {config.limit || 5}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="15"
                    value={config.limit || 5}
                    onChange={(e) => updateConfig('limit', parseInt(e.target.value, 10))}
                    className="w-full accent-primary"
                  />
                </div>
              </>
            )}

            {(nodeType === 'FIRECRAWL_SCRAPE' || nodeType === 'FIRECRAWL_CRAWL' || nodeType === 'FIRECRAWL_EXTRACT') && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-foreground">
                    Target URL
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetField('url');
                      setShowVariablePicker(true);
                    }}
                    className="text-[10px] font-medium text-primary hover:underline"
                  >
                    Use Variable
                  </button>
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
                <label className="text-[11px] font-semibold text-foreground">
                  Extraction Objective / Prompt
                </label>
                <textarea
                  rows={3}
                  value={config.prompt || ''}
                  onChange={(e) => updateConfig('prompt', e.target.value)}
                  placeholder="Extract product price, features, and company contacts…"
                  className="w-full rounded-md border border-border bg-surface-raised p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            )}
          </div>
        )}

        {/* 3. MCP TOOL PROPERTIES */}
        {(nodeType === 'MCP_TOOL' || nodeType === 'TOOL') && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">
                MCP Tool Name
              </label>
              <BuiltinToolSelect value={config.toolName || 'search_docs'} disabled={readOnly} onChange={(v) => updateConfig('toolName', v)} />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">
                Timeout (seconds): {config.timeout || 30}s
              </label>
              <input
                type="range"
                min="5"
                max="120"
                value={config.timeout || 30}
                onChange={(e) => updateConfig('timeout', parseInt(e.target.value, 10))}
                className="w-full accent-primary"
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
              <label className="text-[11px] font-semibold text-foreground">
                Variable to Compare
              </label>
              <Input
                value={config.variable || ''}
                onChange={(e) => updateConfig('variable', e.target.value)}
                placeholder="e.g. status or price"
                className="h-8 text-xs font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">
                Operator
              </label>
              <select
                value={config.operator || 'equals'}
                onChange={(e) => updateConfig('operator', e.target.value)}
                className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="equals">Equals (==)</option>
                <option value="not_equals">Not Equals (!=)</option>
                <option value="contains">Contains substring</option>
                <option value="greater_than">Greater than (&gt;)</option>
                <option value="less_than">Less than (&lt;)</option>
                <option value="is_empty">Is Empty</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">
                Expected Value
              </label>
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
              <label className="text-[11px] font-semibold text-foreground">
                Approval Action Name
              </label>
              <Input
                value={config.action || ''}
                onChange={(e) => updateConfig('action', e.target.value)}
                placeholder="e.g. Approve sending outbound email"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">
                Description / Context for Approver
              </label>
              <textarea
                rows={3}
                value={config.description || ''}
                onChange={(e) => updateConfig('description', e.target.value)}
                placeholder="Explain why this operation needs human approval…"
                className="w-full rounded-md border border-border bg-surface-raised p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-foreground">
                Strict Gate (pause execution)
              </span>
              <input
                type="checkbox"
                checked={config.required !== false}
                onChange={(e) => updateConfig('required', e.target.checked)}
                className="rounded border-border accent-primary"
              />
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
              <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                Applies automated PII redaction, token budgets, and prompt injection defenses to protect outputs.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">
                Guardrail Mode
              </label>
              <select
                value={config.policy || 'pii-redaction'}
                onChange={(e) => updateConfig('policy', e.target.value)}
                className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="pii-redaction">PII Redaction & Sanitization</option>
                <option value="cost-cap">Cost & Token Budget Cap</option>
                <option value="prompt-injection">Prompt Injection Defense</option>
                <option value="content-safety">Content Safety & Toxicity Filter</option>
              </select>
            </div>

            {config.policy !== 'cost-cap' ? (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground">
                  Policy Enforcement Action
                </label>
                <select
                  value={config.action || 'redact'}
                  onChange={(e) => updateConfig('action', e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="redact">Redact (Replace sensitive tokens with [redacted])</option>
                  <option value="block">Block (Halt execution on policy violation)</option>
                  <option value="warn">Warn (Record finding in audit trace without modifying payload)</option>
                </select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground">
                  Max Tokens Cap Per Run: {config.maxTokens || 4096}
                </label>
                <Input
                  type="number"
                  min={100}
                  max={64000}
                  value={config.maxTokens || 4096}
                  onChange={(e) => updateConfig('maxTokens', parseInt(e.target.value, 10) || 4096)}
                  className="h-8 text-xs font-mono"
                />
                <span className="text-[10px] text-muted-foreground">Hard cap applied by execution engine</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">
                Custom Banned Words / RegEx (Optional)
              </label>
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
                <label className="text-[11px] font-semibold text-foreground">
                  {nodeType === 'PROMPT_TEMPLATE' ? 'Prompt' : 'Template'}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setTargetField(templateKey);
                    setShowVariablePicker(true);
                  }}
                  className="text-[10px] font-medium text-primary hover:underline"
                >
                  Insert Variable
                </button>
              </div>
              <textarea
                rows={5}
                value={config[templateKey] || ''}
                onChange={(e) => updateConfig(templateKey, e.target.value)}
                placeholder="Draft formatted output: {{agent.output}} &#10;Source: {{firecrawl.url}}"
                className="w-full font-mono rounded-md border border-border bg-surface-raised p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            </div>
          </div>
        )}

        {/* 6b. WIDGET NODES CONFIGURATION */}
        {nodeType.startsWith('WIDGET_') && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="rounded-lg bg-indigo-500/10 p-2.5 text-xs text-indigo-400">
              <div className="font-semibold flex items-center gap-1.5">
                <LayoutDashboard className="size-3.5 text-indigo-400" /> Widget Configuration
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                Configure rendering, data source binding, user interactions, and event execution for this widget canvas node.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">Widget Type</label>
              <select
                value={config.componentType || 'metric_card'}
                onChange={(e) => updateConfig('componentType', e.target.value)}
                className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <optgroup label="Data & Visualization">
                  <option value="metric_card">Metric Card</option>
                  <option value="bar_chart">Bar Chart</option>
                  <option value="line_chart">Line Chart</option>
                  <option value="table_view">Data Table</option>
                  <option value="progress_summary">Progress Summary</option>
                </optgroup>
                <optgroup label="Interactive Inputs">
                  <option value="form_input">Form Input</option>
                  <option value="dynamic_form">Dynamic Form</option>
                  <option value="approval_form">Approval Form</option>
                </optgroup>
                <optgroup label="AI-Powered">
                  <option value="ai_summary">AI Summary</option>
                  <option value="entity_extractor">Entity Extractor</option>
                  <option value="sentiment_analysis">Sentiment Analysis</option>
                </optgroup>
                <optgroup label="App Connector & Productivity">
                  <option value="action_card">Action Card</option>
                  <option value="task_list">Task List</option>
                  <option value="meeting_notes">Meeting Notes</option>
                </optgroup>
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-foreground">Data Binding Path</label>
                <button
                  type="button"
                  onClick={() => {
                    setTargetField('dataPath');
                    setShowVariablePicker(true);
                  }}
                  className="text-[10px] font-medium text-primary hover:underline"
                >
                  Use Variable
                </button>
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
                <label className="text-[11px] font-semibold text-foreground">Action / Event Name</label>
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
                <label className="text-[11px] font-semibold text-foreground">Display Size</label>
                <select
                  value={config.size || 'md'}
                  onChange={(e) => updateConfig('size', e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="sm">Small (1x1)</option>
                  <option value="md">Medium (2x2)</option>
                  <option value="lg">Large (3x2)</option>
                  <option value="full">Full Width</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground">Auto-Refresh</label>
                <select
                  value={config.refreshInterval || '0'}
                  onChange={(e) => updateConfig('refreshInterval', parseInt(e.target.value, 10))}
                  className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="0">Manual only</option>
                  <option value="15">Every 15s</option>
                  <option value="60">Every 1m</option>
                  <option value="300">Every 5m</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* LLM / CHAT MODEL (also editable on the canvas node) */}
        {nodeType === 'AI_CHAT_MODEL' && (
          <div className="space-y-3.5 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-foreground">Model</label>
                <AIModelBadge modelId={config.model || 'gpt-4o'} size="xs" variant="subtle" />
              </div>
              <select
                value={config.model || 'gpt-4o'}
                onChange={(e) => updateConfig('model', e.target.value)}
                className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {!MODEL_OPTIONS.some((m) => m.value === (config.model || 'gpt-4o')) && (
                  <option value={config.model}>{config.model}</option>
                )}
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">
                Temperature: {config.temperature ?? 0.7}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={config.temperature ?? 0.7}
                onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">Max tokens</label>
              <input
                type="number"
                min={1}
                step={256}
                value={config.maxTokens ?? 2048}
                onChange={(e) => {
                  const v = e.target.valueAsNumber;
                  if (Number.isFinite(v) && v >= 1) updateConfig('maxTokens', Math.round(v));
                }}
                className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
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
                <label className="text-[11px] font-semibold text-foreground">Cron Expression</label>
                <Input
                  value={config.cron || '0 9 * * 1-5'}
                  onChange={(e) => updateConfig('cron', e.target.value)}
                  placeholder="0 9 * * 1-5"
                  className="h-8 text-xs font-mono"
                />
                <span className="text-[10px] text-muted-foreground">Every weekday at 09:00 UTC</span>
              </div>
            )}
            {nodeType === 'TRIGGER_WEBHOOK' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground">HTTP Method</label>
                <select
                  value={config.httpMethod || 'POST'}
                  onChange={(e) => updateConfig('httpMethod', e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground"
                >
                  <option value="POST">POST (Recommended)</option>
                  <option value="GET">GET</option>
                  <option value="PUT">PUT</option>
                </select>
              </div>
            )}
            {nodeType === 'TRIGGER_CHAT' && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground">Welcome Greeting</label>
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
              <label className="text-[11px] font-semibold text-foreground">Knowledge Base</label>
              <KnowledgeBaseSelect value={config.knowledgeBaseId || ''} disabled={readOnly} onChange={(v) => updateConfig('knowledgeBaseId', v)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">Top Chunks (Top-K): {config.topK || 4}</label>
              <input
                type="range"
                min="1"
                max="10"
                value={config.topK || 4}
                onChange={(e) => updateConfig('topK', parseInt(e.target.value, 10))}
                className="w-full accent-primary"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">Min Similarity Score: {config.minScore || 0.75}</label>
              <input
                type="range"
                min="0.5"
                max="0.95"
                step="0.05"
                value={config.minScore || 0.75}
                onChange={(e) => updateConfig('minScore', parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </div>
          </div>
        )}

        {/* 9. CODE EXECUTION CONFIGURATION */}
        {(nodeType === 'CODE_JAVASCRIPT' || nodeType === 'CODE' || nodeType === 'CODE_PYTHON') && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">Sandboxed Code</label>
              <textarea
                rows={8}
                value={config.code || '// Custom transformation\nreturn input;'}
                onChange={(e) => updateConfig('code', e.target.value)}
                className="w-full font-mono rounded-md border border-border bg-zinc-950 text-zinc-100 p-2.5 text-xs focus:border-primary focus:outline-none"
              />
            </div>
          </div>
        )}

        {/* 10. HTTP REQUEST & DATABASE */}
        {nodeType === 'HTTP_REQUEST' && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">HTTP Method</label>
              <select
                value={config.method || 'GET'}
                onChange={(e) => updateConfig('method', e.target.value)}
                className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">Endpoint URL</label>
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
              <label className="text-[11px] font-semibold text-foreground">SQL Query</label>
              <textarea
                rows={4}
                value={config.query || 'SELECT * FROM records LIMIT 20;'}
                onChange={(e) => updateConfig('query', e.target.value)}
                className="w-full font-mono rounded-md border border-border bg-zinc-950 text-zinc-100 p-2.5 text-xs"
              />
            </div>
          </div>
        )}

        {/* 11. ANNOTATIONS: STICKY NOTE & GROUP */}
        {(nodeType === 'STICKY_NOTE' || nodeType === 'NOTE') && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">Note Content</label>
              <textarea
                rows={6}
                value={config.note || ''}
                onChange={(e) => updateConfig('note', e.target.value)}
                placeholder="Document your architecture or steps here…"
                className="w-full rounded-md border border-warning bg-amber-50 dark:bg-amber-950/20 p-2.5 text-xs text-foreground"
              />
            </div>
          </div>
        )}

        {nodeType === 'GROUP' && (
          <div className="space-y-3 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">Stage Title</label>
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
      {missing && <p className="text-[10px] text-destructive">That knowledge base no longer exists — pick another.</p>}
    </div>
  );
}
