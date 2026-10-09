import { agentsApi } from '@org/api-client';
import { AppSelect, Badge, Button, Checkbox, confirm, Input, SearchInput, Textarea } from '@org/ui';
import { cn } from '@org/utils';
import { connectorActionRef, READ_ONLY_AGENT_TOOLS, type CanvasToolPolicy, type ConnectorCapability, type ConnectorSummary } from '@org/types';
import { ChevronRight, ExternalLink, Eye, Loader2, Play, Plug, ShieldAlert, Trash2, Wrench } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AppConnectorIcon } from '../../common/app-connector-icon.jsx';
import { runConnectorAction, usableConnection, useConnectors } from '../../../services/connectors.js';
import type { ToolEntryView } from './agent-module-model.js';
import { IssueList, LoadError, OutputBlock, SectionEmpty, SettingField, SettingSection, StatGrid, fieldDomId, useSections } from './config-primitives.js';
import type { ModuleEditorProps } from './module-drawer.js';
import { useBuiltinTools, useDebouncedValue, useWorkspaceId, type BuiltinTool } from './use-agent-config-data.js';

const POLICY_OPTIONS = [
  { value: 'default', label: 'Default', description: 'Follows the agent’s autonomy setting' },
  { value: 'ask_user', label: 'Ask first', description: 'Waits for a person to approve every call' },
  { value: 'blocked', label: 'Blocked', description: 'Calls are refused' },
];

type Risk = 'read' | 'write' | 'destructive';
const RISK_BADGE: Record<Risk, { label: string; variant: 'neutral' | 'warning' | 'destructive' }> = {
  read: { label: 'Reads', variant: 'neutral' },
  write: { label: 'Writes', variant: 'warning' },
  destructive: { label: 'Deletes', variant: 'destructive' },
};

/** What a tool can do, from its connector manifest or the read-only list. */
function riskOf(entry: ToolEntryView, capability: ConnectorCapability | undefined): Risk {
  if (capability) return capability.permissionLevel;
  return READ_ONLY_AGENT_TOOLS.includes(entry.toolName) ? 'read' : 'write';
}

/** The key a policy is stored under: the `PROVIDER.action` ref for app tools, else the tool name. */
const policyKey = (e: ToolEntryView) => (e.kind === 'connector' && e.provider && e.actionId ? connectorActionRef(e.provider, e.actionId) : e.key.startsWith('node:') ? e.toolName : e.key);

export function ToolsModule({ view, agent, issues, readOnly, setConfig, actions, jumpTo, testSignal }: ModuleEditorProps) {
  const builtin = useBuiltinTools();
  const connectors = useConnectors();
  const { hidden } = useSections();
  const cfg = ((agent.data as { config?: Record<string, unknown> } | undefined)?.config ?? {}) as Record<string, unknown>;
  const toolList = (Array.isArray(cfg['tools']) ? (cfg['tools'] as unknown[]) : []).filter((t): t is string => typeof t === 'string');
  const entries = view.tools.entries;

  const capabilityOf = (e: ToolEntryView) => connectors.data?.find((c) => c.provider === e.provider)?.capabilities.find((c) => c.id === e.actionId);
  const connectorOf = (e: ToolEntryView) => connectors.data?.find((c) => c.provider === e.provider);

  const setTools = (next: string[]) => setConfig(view.agentId, { tools: next });
  const toggleTool = (name: string, on: boolean) => setTools(on ? [...new Set([...toolList, name])] : toolList.filter((t) => t !== name && !(name === 'search_docs' && t === 'kb_search')));
  const setPolicy = (key: string, policy: string) => {
    const next = { ...view.tools.policies } as Record<string, CanvasToolPolicy>;
    if (policy === 'default') delete next[key];
    else next[key] = policy as CanvasToolPolicy;
    setConfig(view.agentId, { toolPolicies: Object.keys(next).length ? next : undefined });
  };
  const remove = async (e: ToolEntryView) => {
    if (e.nodeId) {
      const ok = await confirm({ title: `Remove “${e.label}”?`, description: 'The tool card is removed from the canvas. Undo with Ctrl+Z.', confirmLabel: 'Remove', destructive: true });
      if (ok) actions.deleteNode(e.nodeId);
      return;
    }
    setTools(toolList.filter((t) => t !== e.key));
  };

  const apps = new Set(entries.filter((e) => e.kind === 'connector').map((e) => e.provider));
  const gated = entries.filter((e) => view.tools.policies[policyKey(e)] === 'ask_user').length;
  const blocked = entries.filter((e) => view.tools.policies[policyKey(e)] === 'blocked').length;

  return (
    <>
      <SettingSection id="overview" title="Overview" description="Tools are functions the agent may call while it works. Built-in tools and app actions are one list.">
        <StatGrid
          items={[
            { label: 'Enabled', value: entries.length },
            { label: 'Built-in', value: entries.filter((e) => e.kind === 'builtin').length },
            { label: 'Apps', value: apps.size },
            { label: 'Ask first', value: gated },
            { label: 'Blocked', value: blocked },
          ]}
        />
        <IssueList issues={issues} onJump={jumpTo} empty={entries.length ? 'Every tool is ready.' : undefined} />
      </SettingSection>

      <SettingSection id="enabled" title="Enabled tools" issues={issues.filter((i) => i.section === 'enabled')}>
        {entries.length === 0 ? (
          <SectionEmpty icon={Wrench} title="No tools yet">
            Turn on built-in tools or app actions below.
          </SectionEmpty>
        ) : (
          <ul className="space-y-1.5">
            {entries.map((e) => {
              const cap = capabilityOf(e);
              const risk = RISK_BADGE[riskOf(e, cap)];
              const connector = connectorOf(e);
              return (
                <li key={e.key} id={e.nodeId ? fieldDomId(`node-${e.nodeId}`) : undefined} className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised/40 px-2.5 py-2 scroll-mt-16">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-surface">
                    {e.kind === 'connector' ? <AppConnectorIcon connectorId={(connector?.slug ?? e.provider ?? '').toLowerCase()} size={14} /> : <Wrench className="size-3.5 text-muted-foreground" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium capitalize text-foreground">{cap?.label ?? e.label}</span>
                    <span className="block truncate font-mono text-[10px] text-muted-foreground">
                      {e.toolName}
                      {connector ? ` · ${connector.name}${connector.status !== 'connected' ? ' (not connected)' : ''}` : ''}
                      {e.nodeId ? ' · canvas card' : ''}
                    </span>
                  </span>
                  <Badge variant={risk.variant} className="h-4 shrink-0 px-1 text-[9px]">{risk.label}</Badge>
                  {(cap?.requiresConfirmation || view.tools.policies[policyKey(e)]) && (
                    <ShieldAlert className="size-3.5 shrink-0 text-warning" aria-label={view.tools.policies[policyKey(e)] === 'blocked' ? 'Blocked' : 'Needs approval'} />
                  )}
                  {e.nodeId && (
                    <Button type="button" variant="ghost" size="icon-xs" aria-label={`Open ${e.label} card`} onClick={() => actions.selectNode(e.nodeId!)}>
                      <ExternalLink className="size-3.5" />
                    </Button>
                  )}
                  {!readOnly && (
                    <Button type="button" variant="ghost" size="icon-xs" aria-label={`Remove ${e.label}`} onClick={() => void remove(e)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SettingSection>

      <BuiltinTools builtin={builtin} enabled={view.tools.builtinNames} readOnly={readOnly} onToggle={toggleTool} />
      <AppTools connectors={connectors} enabledRefs={toolList} readOnly={readOnly} onToggle={toggleTool} />

      <SettingSection id="permissions" title="Permissions" description="A canvas can only tighten permissions. Actions an app marks as needing confirmation, and deletes, always wait for approval.">
        {entries.length === 0 && <p className="text-[11px] text-muted-foreground">Enable a tool first.</p>}
        <ul className="space-y-1.5">
          {entries.map((e) => {
            const key = policyKey(e);
            const cap = capabilityOf(e);
            const forced = cap?.requiresConfirmation || cap?.permissionLevel === 'destructive';
            return (
              <li key={e.key} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs capitalize text-foreground">{cap?.label ?? e.label}</span>
                {forced && <Badge variant="warning" className="h-4 shrink-0 px-1 text-[9px]">Always approved</Badge>}
                <AppSelect
                  size="sm"
                  value={view.tools.policies[key] ?? 'default'}
                  disabled={readOnly}
                  aria-label={`Permission for ${e.label}`}
                  options={POLICY_OPTIONS}
                  onValueChange={(p) => setPolicy(key, p)}
                  className="w-32 shrink-0"
                />
              </li>
            );
          })}
        </ul>
      </SettingSection>

      {!hidden.has('testing') && <ToolTester entries={entries} builtin={builtin.data ?? []} connectors={connectors.data ?? []} testSignal={testSignal} />}
    </>
  );
}

function BuiltinTools({
  builtin,
  enabled,
  readOnly,
  onToggle,
}: {
  builtin: ReturnType<typeof useBuiltinTools>;
  enabled: string[];
  readOnly: boolean;
  onToggle: (name: string, on: boolean) => void;
}) {
  const [filter, setFilter] = useState('');
  const f = useDebouncedValue(filter.trim().toLowerCase(), 120);
  const list = useMemo(
    () => (builtin.data ?? []).filter((t) => !f || t.name.toLowerCase().includes(f) || t.description.toLowerCase().includes(f)),
    [builtin.data, f],
  );
  return (
    <SettingSection id="builtin" title="Built-in tools" description="Platform tools: workspace search, tasks, docs, memory, web…">
      {builtin.error && <LoadError what="built-in tools" error={builtin.error} onRetry={() => void builtin.refetch()} />}
      <SearchInput value={filter} onValueChange={setFilter} placeholder="Filter tools" label="Filter built-in tools" className="h-8 text-xs" />
      {builtin.isLoading && <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Loader2 className="size-3 animate-spin" />Loading tools…</p>}
      <ul className="max-h-80 space-y-0.5 overflow-y-auto pr-1">
        {list.map((t) => {
          const on = enabled.includes(t.name);
          const id = `builtin-${t.name}`;
          return (
            <li key={t.name}>
              <label htmlFor={id} className={cn('flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 hover:bg-surface-raised', on && 'bg-primary/5')}>
                <Checkbox id={id} checked={on} disabled={readOnly} onCheckedChange={(v) => onToggle(t.name, v === true)} className="mt-0.5" />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 font-mono text-[11px] text-foreground">
                    {t.name}
                    {READ_ONLY_AGENT_TOOLS.includes(t.name) && <Badge variant="neutral" className="h-3.5 px-1 font-sans text-[9px]">read-only</Badge>}
                  </span>
                  <span className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{t.description}</span>
                </span>
              </label>
            </li>
          );
        })}
        {builtin.data && list.length === 0 && <li className="px-2 py-3 text-center text-[11px] text-muted-foreground">No tools match.</li>}
      </ul>
    </SettingSection>
  );
}

function AppTools({
  connectors,
  enabledRefs,
  readOnly,
  onToggle,
}: {
  connectors: ReturnType<typeof useConnectors>;
  enabledRefs: string[];
  readOnly: boolean;
  onToggle: (ref: string, on: boolean) => void;
}) {
  const [filter, setFilter] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const f = useDebouncedValue(filter.trim().toLowerCase(), 120);
  const list = useMemo(
    () =>
      (connectors.data ?? [])
        .filter((c) => c.status !== 'unavailable' && c.capabilities.length > 0)
        .filter((c) => !f || c.name.toLowerCase().includes(f) || c.capabilities.some((cap) => cap.label.toLowerCase().includes(f)))
        .sort((a, b) => Number(b.status === 'connected') - Number(a.status === 'connected') || a.name.localeCompare(b.name)),
    [connectors.data, f],
  );
  return (
    <SettingSection id="apps" title="App connectors" description="Every connected app’s actions can be agent tools. The run uses your workspace’s (or the agent owner’s) connection.">
      {connectors.error && <LoadError what="connectors" error={connectors.error} onRetry={() => void connectors.refetch()} />}
      <SearchInput value={filter} onValueChange={setFilter} placeholder="Filter apps and actions" label="Filter apps" className="h-8 text-xs" />
      {connectors.isLoading && <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Loader2 className="size-3 animate-spin" />Loading apps…</p>}
      <ul className="space-y-1">
        {list.map((c) => {
          const isOpen = open === c.provider || Boolean(f);
          const count = c.capabilities.filter((cap) => enabledRefs.includes(cap.actionRef)).length;
          return (
            <li key={c.provider} className="rounded-lg border border-border">
              <button
                type="button"
                onClick={() => setOpen(isOpen && !f ? null : c.provider)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-2 px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <AppConnectorIcon connectorId={c.slug} size={16} />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{c.name}</span>
                {count > 0 && <Badge variant="primary" className="h-4 px-1 text-[9px]">{count} on</Badge>}
                <Badge variant={c.status === 'connected' ? 'success' : 'neutral'} className="h-4 px-1 text-[9px]">{c.status === 'connected' ? 'Connected' : 'Not connected'}</Badge>
                <ChevronRight className={cn('size-3.5 text-muted-foreground transition-transform motion-reduce:transition-none', isOpen && 'rotate-90')} />
              </button>
              {isOpen && (
                <div className="space-y-0.5 border-t border-border px-1.5 py-1.5">
                  {c.status !== 'connected' && (
                    <a href={`/connectors/${c.slug}`} target="_blank" rel="noreferrer" className="mb-1 flex items-center gap-1 px-1 text-[11px] font-medium text-primary hover:underline">
                      <Plug className="size-3" /> Connect {c.name} to use these at run time <ExternalLink className="size-3" />
                    </a>
                  )}
                  {c.capabilities
                    .filter((cap) => !f || cap.label.toLowerCase().includes(f) || c.name.toLowerCase().includes(f))
                    .map((cap) => {
                      const on = enabledRefs.includes(cap.actionRef);
                      const id = `cap-${cap.actionRef}`;
                      const risk = RISK_BADGE[cap.permissionLevel];
                      return (
                        <label key={cap.id} htmlFor={id} className={cn('flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1.5 hover:bg-surface-raised', on && 'bg-primary/5')}>
                          <Checkbox id={id} checked={on} disabled={readOnly} onCheckedChange={(v) => onToggle(cap.actionRef, v === true)} className="mt-0.5" />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                              {cap.label}
                              <Badge variant={risk.variant} className="h-3.5 px-1 text-[9px]">{risk.label}</Badge>
                              {cap.requiresConfirmation && <Badge variant="warning" className="h-3.5 px-1 text-[9px]">Approval</Badge>}
                            </span>
                            <span className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{cap.description}</span>
                          </span>
                        </label>
                      );
                    })}
                </div>
              )}
            </li>
          );
        })}
        {connectors.data && list.length === 0 && <li className="py-3 text-center text-[11px] text-muted-foreground">No apps match.</li>}
      </ul>
    </SettingSection>
  );
}

interface FieldSpec {
  name: string;
  type?: string;
  description?: string;
  required?: boolean;
}

function fieldsOf(entry: ToolEntryView, builtin: BuiltinTool[], capability: ConnectorCapability | undefined): FieldSpec[] {
  if (capability) {
    const schema = capability.inputSchema as { properties?: Record<string, { type?: string; description?: string }>; required?: string[] };
    return Object.entries(schema.properties ?? {}).map(([name, p]) => ({ name, type: p.type, description: p.description, required: schema.required?.includes(name) }));
  }
  const tool = builtin.find((t) => t.name === entry.toolName);
  return Object.entries(tool?.parameters ?? {}).map(([name, p]) => ({ name, type: p.type, description: p.description }));
}

function coerce(value: string, type: string | undefined): unknown {
  if (value === '') return undefined;
  if (type === 'number' || type === 'integer') return Number(value);
  if (type === 'boolean') return value === 'true';
  if (type === 'object' || type === 'array') {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }
  return value;
}

function ToolTester({ entries, builtin, connectors, testSignal }: { entries: ToolEntryView[]; builtin: BuiltinTool[]; connectors: ConnectorSummary[]; testSignal: number }) {
  const workspaceId = useWorkspaceId();
  const [key, setKey] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string; ms: number } | null>(null);
  const selectRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (testSignal > 0) selectRef.current?.querySelector('button')?.focus();
  }, [testSignal]);

  const entry = entries.find((e) => e.key === key);
  const connector = entry?.provider ? connectors.find((c) => c.provider === entry.provider) : undefined;
  const capability = entry && connector ? connector.capabilities.find((c) => c.id === entry.actionId) : undefined;
  const fields = entry ? fieldsOf(entry, builtin, capability) : [];
  const input = Object.fromEntries(fields.map((f) => [f.name, coerce(values[f.name] ?? '', f.type)]).filter(([, v]) => v !== undefined));
  const missing = fields.filter((f) => f.required && (values[f.name] ?? '') === '');
  const readOnlyTool = entry ? (capability ? capability.permissionLevel === 'read' : READ_ONLY_AGENT_TOOLS.includes(entry.toolName)) : true;

  const run = async () => {
    if (!entry) return;
    if (!readOnlyTool) {
      const ok = await confirm({
        title: `Run “${capability?.label ?? entry.label}” for real?`,
        description: 'This tool can change things — the test is not a simulation. Use Preview to check the call first.',
        confirmLabel: 'Run it',
        destructive: capability?.permissionLevel === 'destructive',
      });
      if (!ok) return;
    }
    setRunning(true);
    setResult(null);
    const started = performance.now();
    try {
      let output: unknown;
      if (entry.kind === 'connector') {
        if (!connector || !capability) throw new Error('This app action isn’t in the connector catalog any more.');
        const connection = usableConnection(connector);
        if (!connection) throw new Error(`Connect ${connector.name} first — there’s no connection to run it on.`);
        output = await runConnectorAction(workspaceId, connection.id, capability, input);
      } else {
        output = await agentsApi.testMcpTool(workspaceId, entry.toolName, input);
      }
      setResult({ ok: true, text: typeof output === 'string' ? output : JSON.stringify(output, null, 2), ms: Math.round(performance.now() - started) });
    } catch (e) {
      setResult({ ok: false, text: e instanceof Error ? e.message : String(e), ms: Math.round(performance.now() - started) });
    } finally {
      setRunning(false);
    }
  };

  return (
    <SettingSection id="testing" title="Testing" description="Call one tool with your own input and see exactly what it returns.">
      {entries.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">Enable a tool to test it.</p>
      ) : (
        <>
          <div ref={selectRef}>
            <AppSelect
              size="sm"
              searchable
              value={key}
              placeholder="Choose a tool"
              aria-label="Tool to test"
              options={entries.map((e) => ({ value: e.key, label: e.label, description: e.toolName }))}
              onValueChange={(k) => {
                setKey(k);
                setValues({});
                setResult(null);
              }}
            />
          </div>
          {entry && (
            <>
              {fields.length === 0 && <p className="text-[11px] text-muted-foreground">This tool takes no input.</p>}
              {fields.map((f) => (
                <SettingField key={f.name} label={`${f.name}${f.type ? ` (${f.type})` : ''}`} required={f.required} hint={f.description} htmlFor={`tool-in-${f.name}`}>
                  {f.type === 'object' || f.type === 'array' ? (
                    <Textarea id={`tool-in-${f.name}`} minRows={2} maxRows={8} value={values[f.name] ?? ''} placeholder="JSON" onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} className="font-mono text-[11px]" />
                  ) : (
                    <Input id={`tool-in-${f.name}`} inputSize="sm" value={values[f.name] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} className="text-xs" />
                  )}
                </SettingField>
              ))}
              <div className="flex flex-wrap gap-1.5">
                <Button type="button" variant="outline" size="sm" onClick={() => setPreview((p) => !p)} aria-expanded={preview}>
                  <Eye className="size-3.5" />
                  Preview call
                </Button>
                <Button type="button" size="sm" onClick={() => void run()} disabled={running || missing.length > 0}>
                  {running ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                  {readOnlyTool ? 'Run' : 'Run for real…'}
                </Button>
              </div>
              {missing.length > 0 && <p className="text-[11px] text-muted-foreground">Required: {missing.map((m) => m.name).join(', ')}</p>}
              {preview && <OutputBlock label="Call (dry run — nothing is sent)">{JSON.stringify({ tool: entry.toolName, ...(connector ? { app: connector.name } : {}), input }, null, 2)}</OutputBlock>}
              {result && (
                <OutputBlock label={`${result.ok ? 'Result' : 'Failed'} · ${result.ms} ms`} tone={result.ok ? 'default' : 'error'}>
                  {result.text}
                </OutputBlock>
              )}
            </>
          )}
        </>
      )}
    </SettingSection>
  );
}
