import type { ConnectorSummary } from '@org/types';
import { AppSelect, Badge, Button, CodeBlock, confirm, toast } from '@org/ui';
import type { Node } from '@xyflow/react';
import { Braces, ExternalLink, Play, ShieldCheck, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage, runConnectorAction, usableConnection, useConnectors } from '../../services/connectors.js';
import { useStudioSession } from '../../session-guard.js';
import { AppConnectorIcon } from '../common/app-connector-icon.jsx';
import { SchemaFields, coerceSchemaInput, inputToFieldValues, missingRequired, schemaProperties } from '../connectors/schema-fields.js';

/** Legacy provider ids from the first connector release (`microsoft-teams`). */
const providerOf = (config: Record<string, unknown>) =>
  String(config['provider'] ?? config['connectorId'] ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_');

/**
 * Configures an app action or app event card from the live connector
 * manifests: pick the app, the capability, and its inputs (any of which may
 * be a `{{variable}}`). An action can be run once for real from here.
 */
export function ConnectorNodeConfig({
  node,
  nodes,
  kind,
  config,
  setConfig,
  readOnly,
}: {
  node: Node;
  nodes: Node[];
  kind: 'action' | 'trigger';
  config: Record<string, unknown>;
  setConfig: (patch: Record<string, unknown>) => void;
  readOnly?: boolean;
}) {
  const navigate = useNavigate();
  const { activeWorkspace } = useStudioSession();
  const connectors = useConnectors();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; data?: unknown } | null>(null);

  const list = useMemo(
    () => (connectors.data ?? []).filter((c) => (kind === 'trigger' ? c.triggers.length > 0 : c.capabilities.length > 0)),
    [connectors.data, kind],
  );
  const provider = providerOf(config);
  const connector: ConnectorSummary | undefined = list.find((c) => c.provider === provider);
  const capabilityId = String(config[kind === 'action' ? 'actionId' : 'triggerId'] ?? '');
  const capability = kind === 'action' ? connector?.capabilities.find((c) => c.id === capabilityId) : undefined;
  const trigger = kind === 'trigger' ? connector?.triggers.find((t) => t.id === capabilityId) : undefined;
  const schema =
    kind === 'action'
      ? capability?.inputSchema
      : (trigger?.inputSchema ?? connector?.capabilities.find((c) => c.id === trigger?.pollActionId)?.inputSchema);
  const values = inputToFieldValues(config['input'] as Record<string, unknown> | undefined);
  const missing = schema ? missingRequired(schema, values) : [];
  const connection = connector ? usableConnection(connector) : null;

  const variables = useMemo(() => {
    const items = [{ value: '{{__last}}', label: 'Previous step’s result' }];
    const startsOnApp = nodes.some((n) => n.type === 'APP_CONNECTOR_TRIGGER' || n.type === 'TRIGGER_APP_EVENT');
    if (startsOnApp) items.push({ value: '{{event}}', label: 'The item that started the run' });
    for (const n of nodes) {
      if (n.id === node.id || n.type === 'STICKY_NOTE') continue;
      const label = String((n.data as { label?: unknown })?.label ?? n.type);
      items.push({ value: `{{${n.id}}}`, label: `Output of “${label}”` });
    }
    return items;
  }, [nodes, node.id]);

  const setInput = (next: Record<string, string>) => setConfig({ input: coerceSchemaInput(schema, next) });

  const runOnce = async () => {
    if (!activeWorkspace || !connection || !capability) return;
    if (/\{\{[^}]+\}\}/.test(JSON.stringify(config['input'] ?? {}))) {
      toast.error('Variables only have values inside a run', { description: 'Use Test run on the canvas, or replace them with sample values to try this action alone.' });
      return;
    }
    if (capability.kind === 'action') {
      const ok = await confirm({
        title: `Run “${capability.label}” in ${connector?.name}?`,
        description: `This really changes something in ${connector?.name} with your connection.`,
        confirmLabel: 'Run it',
        destructive: capability.permissionLevel === 'destructive',
      });
      if (!ok) return;
    }
    setRunning(true);
    setResult(null);
    try {
      const res = await runConnectorAction(activeWorkspace.id, connection.id, capability, (config['input'] as Record<string, unknown>) ?? {});
      setResult({ ok: res.success, message: res.message ?? (res.success ? 'Done.' : 'It didn’t work.'), data: res.data });
    } catch (error) {
      setResult({ ok: false, message: errorMessage(error, `${connector?.name} → ${capability.label} failed.`) });
    } finally {
      setRunning(false);
    }
  };

  if (connectors.isLoading) return <p className="text-xs text-muted-foreground">Loading apps…</p>;
  if (connectors.isError) return <p className="text-xs text-destructive-text">Couldn’t load apps: {errorMessage(connectors.error, '')}</p>;

  return (
    <div className="space-y-3.5 border-t border-border pt-3">
      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold text-foreground">App</span>
        <AppSelect
          value={connector?.provider ?? ''}
          onValueChange={(p) => {
            const next = list.find((c) => c.provider === p);
            const first = kind === 'action' ? next?.capabilities[0]?.id : next?.triggers[0]?.id;
            setConfig({
              provider: p,
              connectorId: next?.slug,
              [kind === 'action' ? 'actionId' : 'triggerId']: first,
              input: kind === 'trigger' ? { ...(next?.triggers[0]?.defaultInput ?? {}) } : {},
            });
          }}
          searchable
          placeholder={list.length ? 'Choose an app' : 'No apps offer this yet'}
          options={list.map((c) => ({ value: c.provider, label: c.status === 'connected' ? c.name : `${c.name} (not connected)` }))}
        />
      </div>

      {connector && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-raised/60 p-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <AppConnectorIcon connectorId={connector.slug} name={connector.name} category={connector.category} size={18} />
            <span className="truncate text-xs text-foreground">
              {connection ? `As ${connection.accountEmail ?? connection.accountName ?? connection.displayName ?? connector.name}` : `${connector.name} isn’t connected`}
            </span>
          </div>
          {connection ? (
            <Badge variant="success">Connected</Badge>
          ) : (
            <Button size="xs" variant="outline" onClick={() => navigate(`/connectors/${connector.slug}`)}>
              Connect <ExternalLink className="ml-0.5 size-3" aria-hidden="true" />
            </Button>
          )}
        </div>
      )}

      {connector && (
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-foreground">{kind === 'action' ? 'Action' : 'Event'}</span>
          <AppSelect
            value={capabilityId}
            onValueChange={(id) =>
              setConfig({
                [kind === 'action' ? 'actionId' : 'triggerId']: id,
                input: kind === 'trigger' ? { ...(connector.triggers.find((t) => t.id === id)?.defaultInput ?? {}) } : {},
              })
            }
            searchable
            placeholder="Choose…"
            options={
              kind === 'action'
                ? connector.capabilities.map((c) => ({ value: c.id, label: `${c.label}${c.kind === 'query' ? '' : ' · writes'}` }))
                : connector.triggers.map((t) => ({ value: t.id, label: t.label }))
            }
          />
          {(capability?.description || trigger?.description) && (
            <p className="text-[11px] text-muted-foreground">{capability?.description ?? trigger?.description}</p>
          )}
        </div>
      )}

      {capability?.requiresConfirmation && (
        <p className="flex items-start gap-1.5 rounded-lg border border-warning/30 bg-warning/10 p-2.5 text-[11px] text-warning-text">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          {connector?.name} asks before running this. In a live run it runs once the run reaches it — put a Human Approval card before it if
          someone should check first. Test runs never run it.
        </p>
      )}

      {kind === 'trigger' && trigger && (
        <p className="flex items-start gap-1.5 rounded-lg border border-border bg-surface-raised/60 p-2.5 text-[11px] text-muted-foreground">
          <Zap className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
          Once the agent is switched on, {connector?.name} is checked every 2 minutes and each new item starts one run. The item is{' '}
          <code className="rounded bg-surface px-1">{'{{event}}'}</code> in later steps.
        </p>
      )}

      {schema && schemaProperties(schema).length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-foreground">{kind === 'action' ? 'Inputs' : 'Only for'}</span>
            {kind === 'action' && (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Braces className="size-3" aria-hidden="true" /> Any field takes a variable
              </span>
            )}
          </div>
          <fieldset disabled={readOnly}>
            <SchemaFields schema={schema} values={values} onChange={setInput} idPrefix={`node-${node.id}`} allowVariables={kind === 'action'} />
          </fieldset>
          {kind === 'action' && (
            <div className="flex flex-wrap gap-1" aria-label="Variables you can use">
              {variables.slice(0, 8).map((v) => (
                <button
                  key={v.value}
                  type="button"
                  title={v.label}
                  onClick={() => {
                    navigator.clipboard?.writeText(v.value).then(
                      () => toast.success(`Copied ${v.value}`, { description: v.label }),
                      () => toast.message(v.value),
                    );
                  }}
                  className="rounded-md border border-border bg-surface-raised px-1.5 py-0.5 font-mono text-[10px] text-foreground hover:border-primary/50"
                >
                  {v.value}
                </button>
              ))}
            </div>
          )}
          {missing.length > 0 && <p className="text-[11px] text-warning-text">Still needed: {missing.join(', ')}.</p>}
        </div>
      )}

      {kind === 'action' && capability && (
        <div className="space-y-2">
          <Button
            size="sm"
            variant="outline"
            className="w-full gap-1.5"
            onClick={runOnce}
            loading={running}
            disabled={!connection || missing.length > 0 || readOnly}
          >
            <Play className="size-3.5" aria-hidden="true" /> Run once now
          </Button>
          {result && (
            <div
              role="status"
              className={
                result.ok
                  ? 'rounded-lg border border-success/30 bg-success/10 p-2.5 text-[11px] text-success-text'
                  : 'rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-[11px] text-destructive-text'
              }
            >
              <div className="font-medium">{result.message}</div>
              {result.data !== undefined && (
                <CodeBlock variant="compact" className="mt-2 max-h-56 overflow-auto" language="json" code={JSON.stringify(result.data, null, 2).slice(0, 10_000)} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
