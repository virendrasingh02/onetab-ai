import type { ConnectorCapability, ConnectorSummary } from '@org/types';
import { AppSelect, Badge, Button, CodeBlock, Label, SearchInput, Switch, confirm, toast } from '@org/ui';
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
            <div
              className={
                connection
                  ? 'flex items-center gap-2.5 rounded-lg border border-border bg-surface-raised/60 p-2.5'
                  : 'flex items-center gap-2.5 rounded-lg border border-warning/40 bg-warning/5 p-2.5'
              }
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface">
                <AppConnectorIcon connectorId={connector.slug} name={connector.name} category={connector.category} size={18} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs font-medium text-foreground">
                  {connection ? (connection.accountEmail ?? connection.accountName ?? connection.displayName ?? connector.name) : `Connect ${connector.name}`}
                </span>
                <span className={connection ? 'truncate text-2xs text-muted-foreground' : 'text-2xs text-warning-text'}>
                  {connection ? `${connector.name} account` : 'Needed before this card can run'}
                </span>
              </span>
              {connection ? (
                <Badge variant="success" className="shrink-0">Connected</Badge>
              ) : (
                <Button size="xs" className="shrink-0" disabled={readOnly} onClick={() => setConnectOpen(true)}>
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
  const [filter, setFilter] = useState('');
  const on = new Set(actionIds);
  const q = filter.trim().toLowerCase();
  const matches = (c: ConnectorCapability) => !q || `${c.label} ${c.description ?? ''}`.toLowerCase().includes(q);
  const groups: Array<{ title: string; hint: string; caps: ConnectorCapability[] }> = [
    { title: 'Makes changes', hint: 'Sends, creates or updates things', caps: connector.capabilities.filter((c) => c.kind === 'action' && matches(c)) },
    { title: 'Reads only', hint: 'Looks things up, changes nothing', caps: connector.capabilities.filter((c) => c.kind === 'query' && matches(c)) },
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
  const shown = groups.reduce((n, g) => n + g.caps.length, 0);

  return (
    <div className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs font-semibold text-foreground">What the agent can do in {connector.name}</span>
          <span className="text-2xs text-muted-foreground">
            {asTool
              ? 'The agent picks from the actions switched on and fills in their inputs.'
              : 'Used when this card is plugged into an agent’s Tools.'}
          </span>
        </span>
        <Badge variant={on.size ? 'primary' : 'warning'} className="shrink-0 text-2xs">
          {on.size}/{total} on
        </Badge>
      </div>
      {total > 6 && (
        <SearchInput value={filter} onValueChange={setFilter} placeholder="Filter actions" label={`Filter ${connector.name} actions`} className="h-8 text-xs" />
      )}
      <fieldset disabled={readOnly} className="min-w-0 space-y-2">
        {groups.map(({ title, hint, caps }) => {
          if (caps.length === 0) return null;
          const onCount = caps.filter((c) => on.has(c.id)).length;
          const allOn = onCount === caps.length;
          return (
            <section key={title} aria-label={title} className="overflow-hidden rounded-lg border border-border">
              <div className="flex items-center justify-between gap-2 bg-surface-raised/60 px-2.5 py-1.5">
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span className="shrink-0 whitespace-nowrap text-xs font-semibold text-foreground">{title}</span>
                  <span className="truncate text-2xs text-muted-foreground">
                    {onCount}/{caps.length} · {hint}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="h-5 shrink-0 px-1.5 text-2xs"
                  onClick={() => setGroup(caps, !allOn)}
                >
                  {allOn ? 'Turn all off' : 'Turn all on'}
                </Button>
              </div>
              <ul className="divide-y divide-border/60">
                {caps.map((c) => {
                  const id = `app-action-${connector.provider}-${c.id}`;
                  const enabled = on.has(c.id);
                  return (
                    <li key={c.id}>
                      <Label
                        htmlFor={id}
                        className="flex cursor-pointer items-start gap-3 bg-surface px-2.5 py-2 font-normal hover:bg-surface-raised/60"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-foreground">
                            <span className={enabled ? undefined : 'text-muted-foreground'}>{c.label}</span>
                            {c.permissionLevel === 'destructive' ? (
                              <Badge variant="destructive" className="py-0 text-2xs">Can’t be undone</Badge>
                            ) : (
                              c.requiresConfirmation && (
                                <Badge variant="warning" className="gap-1 py-0 text-2xs font-normal">
                                  <ShieldCheck className="size-3" aria-hidden="true" /> Sensitive
                                </Badge>
                              )
                            )}
                          </span>
                          {c.description && (
                            <span className="mt-0.5 line-clamp-2 block text-2xs text-muted-foreground" title={c.description}>
                              {c.description}
                            </span>
                          )}
                        </span>
                        <Switch id={id} checked={enabled} onCheckedChange={(checked) => toggle(c.id, checked)} className="mt-0.5 shrink-0" />
                      </Label>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {shown === 0 && <p className="px-1 text-xs text-muted-foreground">No {connector.name} action matches “{filter}”.</p>}
      </fieldset>
      {on.size === 0 && <p className="text-xs text-warning-text">Switch on at least one action, or the agent gets nothing from {connector.name}.</p>}
    </div>
  );
}
