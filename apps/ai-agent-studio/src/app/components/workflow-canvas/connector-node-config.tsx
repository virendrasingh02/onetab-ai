import type { ConnectorCapability, ConnectorSummary } from '@org/types';
import { AppSelect, Badge, Button, Checkbox, CodeBlock, Label, Switch, confirm, toast } from '@org/ui';
import type { Node } from '@xyflow/react';
import { Braces, Play, Plug, ShieldCheck, Zap } from 'lucide-react';
import { useMemo, useState } from 'react';
import { errorMessage, runConnectorAction, usableConnection, useConnectors, useInvalidateConnectors } from '../../services/connectors.js';
import { useStudioSession } from '../../session-guard.js';
import { AppConnectorIcon } from '../common/app-connector-icon.jsx';
import { ConnectDialog } from '../connectors/connect-dialog.js';
import { SchemaFields, coerceSchemaInput, inputToFieldValues, missingRequired, schemaProperties } from '../connectors/schema-fields.js';

/** Actions that send, publish, refund or delete ask a person first unless the card says otherwise. */
const needsApprovalByDefault = (c: Pick<ConnectorCapability, 'requiresConfirmation' | 'permissionLevel'> | undefined) =>
  !!c && (c.requiresConfirmation || c.permissionLevel === 'destructive');

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
 *
 * An app card (`actionIds` set — one card per app) also manages which of the
 * app's actions an agent gets when the card is plugged into its Tools; as a
 * step of its own it runs the one picked action.
 */
export function ConnectorNodeConfig({
  node,
  nodes,
  kind,
  config,
  setConfig,
  readOnly,
  lockedProvider,
}: {
  node: Node;
  nodes: Node[];
  kind: 'action' | 'trigger';
  config: Record<string, unknown>;
  setConfig: (patch: Record<string, unknown>) => void;
  readOnly?: boolean;
  /** A card bound to one app (e.g. Attendance): no app picker. */
  lockedProvider?: string;
}) {
  const { activeWorkspace } = useStudioSession();
  const connectors = useConnectors();
  const invalidateConnectors = useInvalidateConnectors();
  const [connectOpen, setConnectOpen] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; data?: unknown } | null>(null);

  const list = useMemo(
    () => (connectors.data ?? []).filter((c) => (kind === 'trigger' ? c.triggers.length > 0 : c.capabilities.length > 0)),
    [connectors.data, kind],
  );
  const provider = lockedProvider ?? providerOf(config);
  const connector: ConnectorSummary | undefined = list.find((c) => c.provider === provider);
  const capabilityId = String(config[kind === 'action' ? 'actionId' : 'triggerId'] ?? '');
  const capability = kind === 'action' ? connector?.capabilities.find((c) => c.id === capabilityId) : undefined;
  const trigger = kind === 'trigger' ? connector?.triggers.find((t) => t.id === capabilityId) : undefined;
  const schema =
    kind === 'action'
      ? capability?.inputSchema
      : (trigger?.inputSchema ?? connector?.capabilities.find((c) => c.id === trigger?.pollActionId)?.inputSchema);
  const actionIds = kind === 'action' && Array.isArray(config['actionIds'])
    ? (config['actionIds'] as unknown[]).filter((a): a is string => typeof a === 'string')
    : null;
  /** Plugged into an agent's Tools: the agent picks among the switched-on actions and fills their inputs. */
  const asTool = !!(node.data as { attachedTo?: unknown } | undefined)?.attachedTo;
  const showStep = !(actionIds && asTool);
  const values = inputToFieldValues(config['input'] as Record<string, unknown> | undefined);
  const missing = schema ? missingRequired(schema, values) : [];
  const activeConnections = useMemo(
    () => (connector?.connections ?? []).filter((c) => c.status === 'CONNECTED'),
    [connector?.connections],
  );
  const connection = connector
    ? activeConnections.find((c) => c.id === config['integrationId']) ?? usableConnection(connector)
    : null;

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
      {!lockedProvider && (
      <div className="space-y-1.5">
        <span className="text-xs font-semibold text-foreground">App</span>
        <AppSelect
          value={connector?.provider ?? ''}
          onValueChange={(p) => {
            const next = list.find((c) => c.provider === p);
            const first = kind === 'action' ? next?.capabilities[0]?.id : next?.triggers[0]?.id;
            setConfig({
              provider: p,
              connectorId: next?.slug,
              [kind === 'action' ? 'actionId' : 'triggerId']: first,
              ...(kind === 'action' ? { requireApproval: needsApprovalByDefault(next?.capabilities[0]) } : {}),
              // An app card brings the new app's actions, all switched on.
              ...(actionIds ? { actionIds: next?.capabilities.map((c) => c.id) ?? [] } : {}),
              input: kind === 'trigger' ? { ...(next?.triggers[0]?.defaultInput ?? {}) } : {},
              // An account belongs to one app.
              integrationId: undefined,
            });
          }}
          searchable
          placeholder={list.length ? 'Choose an app' : 'No apps offer this yet'}
          options={list.map((c) => ({ value: c.provider, label: c.status === 'connected' ? c.name : `${c.name} (not connected)` }))}
        />
      </div>
      )}

      {connector && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Connected Account</span>
            {activeConnections.length > 1 && (
              <Badge variant="outline" className="text-2xs py-0 font-normal">
                {activeConnections.length} accounts
              </Badge>
            )}
          </div>
          {activeConnections.length > 1 ? (
            <AppSelect
              value={String(config['integrationId'] ?? connection?.id ?? '')}
              onValueChange={(id) => setConfig({ integrationId: id })}
              placeholder="Select account"
              options={activeConnections.map((c) => ({
                value: c.id,
                label: `${c.accountEmail ?? c.accountName ?? c.displayName ?? 'Account'}${c.mine ? ' (personal)' : ' (shared)'}`,
              }))}
            />
          ) : (
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
                <Button size="xs" variant="outline" disabled={readOnly} onClick={() => setConnectOpen(true)}>
                  <Plug className="size-3" aria-hidden="true" /> Connect
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {connector && actionIds && (
        <AppActionsManager
          connector={connector}
          actionIds={actionIds}
          asTool={asTool}
          readOnly={readOnly}
          onChange={(ids) => setConfig({ actionIds: ids })}
        />
      )}

      {connector && showStep && (
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-foreground">
            {kind === 'trigger' ? 'Event' : actionIds ? 'Runs as a step' : 'Action'}
          </span>
          <AppSelect
            value={capabilityId}
            onValueChange={(id) =>
              setConfig({
                [kind === 'action' ? 'actionId' : 'triggerId']: id,
                ...(kind === 'action' ? { requireApproval: needsApprovalByDefault(connector.capabilities.find((c) => c.id === id)) } : {}),
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
            <p className="text-xs text-muted-foreground">{capability?.description ?? trigger?.description}</p>
          )}
        </div>
      )}

      {kind === 'action' && showStep && capability && capability.kind === 'action' && (
        <div className="space-y-1.5 rounded-lg border border-border bg-surface-raised/60 p-2.5">
          <Label htmlFor={`approval-${node.id}`} className="flex cursor-pointer items-start justify-between gap-3">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <ShieldCheck className="size-3.5 shrink-0 text-warning" aria-hidden="true" />
                Ask a person first
              </span>
              <span className="text-xs font-normal text-muted-foreground">
                The run pauses here and shows exactly what will happen in {connector?.name}. It continues when someone approves; if
                they reject it, nothing after this runs. Test runs never run it.
              </span>
            </span>
            <Switch
              id={`approval-${node.id}`}
              checked={config['requireApproval'] === true || config['requireApproval'] === 'true'}
              disabled={readOnly}
              onCheckedChange={(on) => setConfig({ requireApproval: on })}
            />
          </Label>
          {capability.permissionLevel === 'destructive' && config['requireApproval'] !== true && (
            <p className="text-xs text-warning-text">
              This action can’t be undone. Without approval it runs as soon as the run reaches it.
            </p>
          )}
        </div>
      )}

      {kind === 'trigger' && trigger && (
        <p className="flex items-start gap-1.5 rounded-lg border border-border bg-surface-raised/60 p-2.5 text-xs text-muted-foreground">
          <Zap className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden="true" />
          {trigger.delivery === 'webhook' ? (
            <span>
              Once the agent is switched on, {connector?.name} sends this event the moment it happens — add the connection’s webhook
              address in {connector?.name}’s settings (it’s shown on the connector page). The item is{' '}
              <code className="rounded-md bg-surface px-1">{'{{event}}'}</code> in later steps.
            </span>
          ) : (
            <span>
              Once the agent is switched on, {connector?.name} is checked every 2 minutes and each new item starts one run. The item is{' '}
              <code className="rounded-md bg-surface px-1">{'{{event}}'}</code> in later steps.
            </span>
          )}
        </p>
      )}

      {showStep && schema && schemaProperties(schema).length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">{kind === 'action' ? 'Inputs' : 'Only for'}</span>
            {kind === 'action' && (
              <span className="flex items-center gap-1 text-2xs text-muted-foreground">
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
                <Button
                  variant="outline"
                  size="xs"
                  key={v.value}
                  type="button"
                  title={v.label}
                  onClick={() => {
                    navigator.clipboard?.writeText(v.value).then(
                      () => toast.success(`Copied ${v.value}`, { description: v.label }),
                      () => toast.message(v.value),
                    );
                  }}
                  className="h-auto px-1.5 py-0.5 font-mono text-2xs font-normal"
                >
                  {v.value}
                </Button>
              ))}
            </div>
          )}
          {missing.length > 0 && <p className="text-xs text-warning-text">Still needed: {missing.join(', ')}.</p>}
        </div>
      )}

      {kind === 'action' && showStep && capability && (
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
                  ? 'rounded-lg border border-success/30 bg-success/10 p-2.5 text-xs text-success-text'
                  : 'rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive-text'
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

      <ConnectDialog
        connector={connector ?? null}
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onConnected={() => void invalidateConnectors()}
      />
    </div>
  );
}

/** Which of an app's actions the card brings: grouped into what changes things and what only reads. */
function AppActionsManager({
  connector,
  actionIds,
  asTool,
  readOnly,
  onChange,
}: {
  connector: ConnectorSummary;
  actionIds: string[];
  asTool: boolean;
  readOnly?: boolean;
  onChange: (ids: string[]) => void;
}) {
  const on = new Set(actionIds);
  const groups: Array<[string, ConnectorCapability[]]> = [
    ['Actions', connector.capabilities.filter((c) => c.kind === 'action')],
    ['Reads', connector.capabilities.filter((c) => c.kind === 'query')],
  ];
  // Keep the manifest's order so the saved list reads the same way the panel does.
  const set = (ids: Set<string>) => onChange(connector.capabilities.map((c) => c.id).filter((id) => ids.has(id)));
  const toggle = (id: string, checked: boolean) => {
    const next = new Set(on);
    if (checked) next.add(id);
    else next.delete(id);
    set(next);
  };
  const setGroup = (caps: ConnectorCapability[], checked: boolean) => {
    const next = new Set(on);
    for (const c of caps) {
      if (checked) next.add(c.id);
      else next.delete(c.id);
    }
    set(next);
  };
  const total = connector.capabilities.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">{connector.name} actions</span>
        <Badge variant={on.size ? 'primary' : 'warning'} className="text-2xs">
          {on.size} of {total} on
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {asTool
          ? `The agent can use every action switched on here, and fills in their inputs itself.`
          : `Plug this card into an agent’s Tools to let it use the actions switched on here. On its own it runs as one step.`}
      </p>
      <fieldset disabled={readOnly} className="divide-y divide-border overflow-hidden rounded-lg border border-border">
        {groups.map(([title, caps]) =>
          caps.length === 0 ? null : (
            <div key={title} className="bg-surface-raised/40">
              <div className="flex items-center justify-between px-2.5 py-1.5">
                <span className="text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {title} · {caps.filter((c) => on.has(c.id)).length}/{caps.length}
                </span>
                <span className="flex gap-1">
                  <Button type="button" variant="ghost" size="xs" className="h-5 px-1.5 text-2xs" onClick={() => setGroup(caps, true)}>
                    All
                  </Button>
                  <Button type="button" variant="ghost" size="xs" className="h-5 px-1.5 text-2xs" onClick={() => setGroup(caps, false)}>
                    None
                  </Button>
                </span>
              </div>
              {caps.map((c) => (
                <Label
                  key={c.id}
                  htmlFor={`app-action-${connector.provider}-${c.id}`}
                  className="flex cursor-pointer items-start gap-2.5 border-t border-border/60 bg-surface px-2.5 py-2 font-normal hover:bg-surface-raised/60"
                >
                  <Checkbox
                    id={`app-action-${connector.provider}-${c.id}`}
                    checked={on.has(c.id)}
                    onCheckedChange={(checked) => toggle(c.id, checked === true)}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                      {c.label}
                      {c.permissionLevel === 'destructive' && <Badge variant="destructive" className="py-0 text-2xs">Deletes</Badge>}
                      {c.requiresConfirmation && c.permissionLevel !== 'destructive' && (
                        <ShieldCheck className="size-3 text-warning" aria-label="Sensitive" />
                      )}
                    </span>
                    {c.description && <span className="block truncate text-2xs text-muted-foreground">{c.description}</span>}
                  </span>
                </Label>
              ))}
            </div>
          ),
        )}
      </fieldset>
      {on.size === 0 && <p className="text-xs text-warning-text">Switch on at least one action, or the agent gets nothing from {connector.name}.</p>}
    </div>
  );
}
