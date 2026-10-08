import { Button, CodeBlock, Input, AIModelBadge, toast } from '@org/ui';
import { cn } from '@org/utils';
import type { Connection, Edge, Node } from '@xyflow/react';
import {
  Boxes,
  Braces,
  Cpu,
  Flame,
  MessageSquare,
  Play,
  Shield,
  Sliders,
  Trash2,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { workflowService } from '../../services/workflowService.js';
import { connectorService } from '../../services/connectorService.js';
import { CONNECTOR_CATALOG, getConnectorMeta } from '../../services/connectorCatalog.js';
import { AppConnectorIcon } from '../common/app-connector-icon.jsx';
import { MODEL_OPTIONS } from './custom-nodes.js';
import { getNodeIcon, getStatusBadge, NodeWiringPanel } from './node-wiring-panel.js';

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
}

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
}: NodeInspectorProps) {
  const [showVariablePicker, setShowVariablePicker] = useState(false);
  const [targetField, setTargetField] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
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

  const updateLabel = (label: string) => {
    onUpdateNode(selectedNode.id, {
      ...data,
      label,
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
      className={cn(
        'flex flex-col overflow-hidden rounded-2xl border border-border bg-surface text-foreground shadow-2xl select-none',
        'animate-in fade-in slide-in-from-right-2 duration-150',
        className,
      )}
      onKeyDown={(e) => {
        // Esc closes the panel (keeping edits) unless a field wants it
        if (e.key === 'Escape' && !(e.target as HTMLElement).closest('input, textarea, select, [role="listbox"]')) {
          e.stopPropagation();
          onClose();
        }
      }}
    >
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
        <div role="tabpanel" className="flex-1 overflow-y-auto p-4">
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
      <div role="tabpanel" className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
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

        {/* General: Node Label */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-foreground">
            Node Label
          </label>
          <Input
            value={data.label || ''}
            onChange={(e) => updateLabel(e.target.value)}
            placeholder="Display label"
            className="h-8 text-xs"
          />
        </div>

        {/* 1. AGENT PROPERTIES */}
        {nodeType === 'AGENT' && (
          <div className="space-y-3.5 pt-2 border-t border-border">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-foreground">
                  Instructions / System Prompt
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setTargetField('instructions');
                    setShowVariablePicker(true);
                  }}
                  className="text-[10px] font-medium text-primary hover:underline"
                >
                  Insert Variable
                </button>
              </div>
              <textarea
                rows={4}
                value={config.instructions || ''}
                onChange={(e) => updateConfig('instructions', e.target.value)}
                placeholder="Give this agent its specialized role, guidelines and goals…"
                className="w-full rounded-md border border-border bg-surface-raised p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-foreground">
                  Model
                </label>
                <AIModelBadge modelId={config.model || 'llama3:latest'} size="xs" variant="subtle" />
              </div>
              <select
                value={config.model || 'llama3:latest'}
                onChange={(e) => updateConfig('model', e.target.value)}
                className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {MODEL_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <label className="font-semibold text-foreground">
                  Temperature: {config.temperature ?? 0.7}
                </label>
                <span className="text-muted-foreground">
                  {(config.temperature ?? 0.7) < 0.4 ? 'Strict' : 'Creative'}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config.temperature ?? 0.7}
                onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
                className="w-full accent-primary"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-raised/60 px-3 py-2">
              <span className="text-muted-foreground">
                {((config.tools as string[]) || []).length} tool(s) attached
              </span>
              <button
                type="button"
                onClick={() => setTab('wiring')}
                className="text-[11px] font-medium text-primary hover:underline"
              >
                Manage in Wiring
              </button>
            </div>
          </div>
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
              <select
                value={config.toolName || 'search_docs'}
                onChange={(e) => updateConfig('toolName', e.target.value)}
                className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono"
              >
                <option value="search_docs">search_docs</option>
                <option value="create_task">create_task</option>
                <option value="create_doc">create_doc</option>
                <option value="list_projects">list_projects</option>
                <option value="list_tasks">list_tasks</option>
                <option value="send_channel_message">send_channel_message</option>
                <option value="save_memory">save_memory</option>
                <option value="list_memory">list_memory</option>
                <option value="firecrawl_search">firecrawl_search</option>
                <option value="firecrawl_scrape">firecrawl_scrape</option>
              </select>
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

        {/* 3b. UNIVERSAL APP CONNECTOR ACTION PROPERTIES */}
        {(nodeType === 'APP_CONNECTOR_ACTION' ||
          nodeType === 'TEAMS_SEND_MESSAGE' ||
          nodeType === 'TEAMS_CREATE_MEETING') && (() => {
          const currentConnectorId = config.connectorId || (nodeType.startsWith('TEAMS_') ? 'microsoft_teams' : 'custom_rest_api');
          const meta = getConnectorMeta(currentConnectorId);
          const currentConnector = CONNECTOR_CATALOG.find((c) => c.id === currentConnectorId) || meta;
          const availableActions = currentConnector?.actions || [];

          return (
            <div className="space-y-3.5 pt-2 border-t border-border">
              <div className="rounded-lg bg-primary/10 p-2.5 text-xs text-primary flex items-start gap-2.5">
                <div className="p-1.5 rounded-lg bg-surface border border-border/80 shrink-0 shadow-2xs">
                  <AppConnectorIcon connectorId={currentConnectorId} size={18} />
                </div>
                <div>
                  <div className="font-semibold text-foreground flex items-center gap-1.5">
                    {meta?.name || 'Universal App Connector'}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">
                    Execute actions across SaaS, databases, APIs, or internal microservices with enterprise auth.
                  </p>
                </div>
              </div>

              {/* Connector Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground">
                  App Connector
                </label>
                <select
                  value={currentConnectorId}
                  onChange={(e) => {
                    const newConnId = e.target.value;
                    const newMeta = getConnectorMeta(newConnId);
                    const newConn = CONNECTOR_CATALOG.find((c) => c.id === newConnId);
                    updateConfig('connectorId', newConnId);
                    if (newConn?.actions?.[0]) {
                      updateConfig('actionId', newConn.actions[0].id);
                    }
                  }}
                  className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-medium"
                >
                  {CONNECTOR_CATALOG.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.category})
                    </option>
                  ))}
                </select>
              </div>

              {/* Action Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground">
                  Action to Execute
                </label>
                <select
                  value={config.actionId || (availableActions[0]?.id || 'execute_action')}
                  onChange={(e) => updateConfig('actionId', e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono text-[11px]"
                >
                  {availableActions.map((act) => (
                    <option key={act.id} value={act.id}>
                      {act.name} ({act.id})
                    </option>
                  ))}
                  {availableActions.length === 0 && (
                    <option value="call_endpoint">Call Endpoint</option>
                  )}
                </select>
              </div>

              {/* Connection Selector */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-foreground">
                  Account Connection
                </label>
                <select
                  value={config.connectionId || 'conn-ms-teams-corp'}
                  onChange={(e) => updateConfig('connectionId', e.target.value)}
                  className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="conn-ms-teams-corp">Company Teams (user@company.com - Connected)</option>
                  <option value="conn-ms-teams-client">Client Teams (Engineering workspace - Connected)</option>
                  <option value="conn-ms-teams-test">Test Teams Sandbox (QA environment)</option>
                  <option value="conn-github-core">Primary GitHub Org (onetab-ai-org)</option>
                  <option value="conn-slack-corp">OneTab Workspace Slack (bot@onetab.ai)</option>
                  <option value="conn-gmail-support">Support Operations Gmail</option>
                </select>
              </div>

              {/* Dynamic Payload or Message Expression */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-foreground">
                    Action Input Payload / Expression
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setTargetField('message');
                      setShowVariablePicker(true);
                    }}
                    className="text-[10px] font-medium text-primary hover:underline"
                  >
                    Insert Variable
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={config.message || config.payload || '{{agent.output}}'}
                  onChange={(e) => {
                    updateConfig('message', e.target.value);
                    updateConfig('payload', e.target.value);
                  }}
                  placeholder="Type message, template, or dynamic expression {{agent.output}}"
                  className="w-full font-mono rounded-md border border-border bg-surface-raised p-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Approval Requirement Checkbox */}
              <div className="flex items-center justify-between rounded-lg border border-border bg-surface-raised/50 p-2.5">
                <div>
                  <div className="text-xs font-medium text-foreground">Human Approval Gate</div>
                  <div className="text-[10px] text-muted-foreground">Pause for supervisor confirmation before running</div>
                </div>
                <input
                  type="checkbox"
                  checked={config.requireApproval === true}
                  onChange={(e) => updateConfig('requireApproval', e.target.checked)}
                  className="rounded border-border accent-primary size-4"
                />
              </div>

              {/* Live Test Sandbox Button */}
              <div className="pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs gap-1.5 border-primary/30 hover:bg-primary/5 text-primary"
                  onClick={async () => {
                    try {
                      const res = await connectorService.executeAction(
                        currentConnectorId,
                        config.actionId || availableActions[0]?.id || 'execute_action',
                        {
                          message: config.message || 'Test action from Agent Studio Canvas',
                          teamId: config.teamId || 'team-eng-core',
                          channelId: config.channelId || 'general',
                        },
                        config.connectionId || 'conn-ms-teams-corp'
                      );
                      toast.success(`Action "${res.actionId || config.actionId || 'Execute'}" ran successfully in sandbox!`);
                    } catch (err: any) {
                      toast.error(`Execution failed: ${err.message}`);
                    }
                  }}
                >
                  <Play className="size-3.5 fill-current" /> Run Test Action
                </Button>
              </div>
            </div>
          );
        })()}

        {/* 3c. APP CONNECTOR / TEAMS TRIGGER PROPERTIES */}
        {(nodeType === 'APP_CONNECTOR_TRIGGER' || nodeType === 'TEAMS_TRIGGER_MESSAGE') && (
          <div className="space-y-3.5 pt-2 border-t border-border">
            <div className="rounded-lg bg-emerald-500/10 p-2.5 text-xs text-emerald-600 dark:text-emerald-400">
              <div className="font-semibold flex items-center gap-1.5">
                <Boxes className="size-3.5" /> App Connector Event Trigger
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                Listens for inbound webhooks and events from the connected SaaS application.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">
                Listening Connection
              </label>
              <select
                value={config.connectionId || 'conn-ms-teams-corp'}
                onChange={(e) => updateConfig('connectionId', e.target.value)}
                className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="conn-ms-teams-corp">Company Teams (user@company.com - Connected)</option>
                <option value="conn-ms-teams-client">Client Teams (Engineering workspace - Connected)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-foreground">
                Trigger Event
              </label>
              <select
                value={config.triggerId || 'new_message'}
                onChange={(e) => updateConfig('triggerId', e.target.value)}
                className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary font-mono text-[11px]"
              >
                <option value="new_message">New Message in Channel or Chat</option>
                <option value="mention">Bot Mentioned (@AI-Agent)</option>
                <option value="meeting_event">Meeting Scheduled / Updated</option>
              </select>
            </div>
          </div>
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
              />
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
              <select
                value={config.knowledgeBaseId || 'kb-support-docs'}
                onChange={(e) => updateConfig('knowledgeBaseId', e.target.value)}
                className="h-8 w-full rounded-md border border-border bg-surface-raised px-2.5 text-xs text-foreground"
              >
                <option value="kb-support-docs">Product Documentation & FAQs</option>
                <option value="kb-api-reference">API Contracts & SDK Guides</option>
                <option value="kb-legal-terms">Compliance & Terms of Service</option>
              </select>
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

        {/* Test Node Action & Simulation Preview */}
        <div className="pt-4 border-t border-border space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
              Node Execution Sandbox
            </span>
            <Button
              size="xs"
              variant="outline"
              onClick={async () => {
                setIsTesting(true);
                setTestResult(null);
                try {
                  const res = await workflowService.simulateTestNode(selectedNode, config);
                  setTestResult(res);
                  toast.success(`Node "${selectedNode.data?.label || selectedNode.id}" executed successfully`);
                } catch {
                  toast.error('Node test failed');
                } finally {
                  setIsTesting(false);
                }
              }}
              loading={isTesting}
              className="gap-1 text-xs"
            >
              <Cpu className="size-3 text-success" />
              Test Node
            </Button>
          </div>

          {testResult && (
            <div className="space-y-1 font-mono text-[10px]">
              <div className="flex items-center justify-between text-muted-foreground pb-1">
                <span className="text-success font-bold">{testResult.status}</span>
                <span>{testResult.latencyMs}ms</span>
              </div>
              <CodeBlock
                variant="compact"
                language="json"
                code={JSON.stringify(testResult.output, null, 2)}
              />
            </div>
          )}
        </div>
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
    </aside>
  );
}
