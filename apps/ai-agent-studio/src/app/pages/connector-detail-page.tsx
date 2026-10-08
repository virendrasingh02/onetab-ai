import { AGENT_CAPABILITY_LABELS, CONNECTOR_CATEGORIES, type ConnectorCapability, type ConnectorConnection } from '@org/types';
import {
  Badge,
  Button,
  CodeBlock,
  EmptyState,
  ErrorState,
  LoadingState,
  Page,
  PageHeader,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  confirm,
  toast,
} from '@org/ui';
import { ArrowLeft, Bot, CheckCircle2, Eye, KeyRound, Play, RefreshCw, ShieldAlert, Trash2, Workflow, Wrench, XCircle, Zap } from 'lucide-react';
import { useCallback, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AddToAgentDialog } from '../components/connectors/add-to-agent-dialog.js';
import { ConnectDialog } from '../components/connectors/connect-dialog.js';
import { SchemaFields, coerceSchemaInput, missingRequired, schemaProperties } from '../components/connectors/schema-fields.js';
import { AppConnectorIcon } from '../components/common/app-connector-icon.jsx';
import {
  AUTH_LABELS,
  STATUS_META,
  disconnectConnection,
  errorMessage,
  runConnectorAction,
  testConnection,
  timeAgo,
  useConnectorDetail,
  useInvalidateConnectors,
  useOAuthCompletion,
  usableConnection,
} from '../services/connectors.js';
import { useStudioSession } from '../session-guard.js';

const CATEGORY_LABEL = new Map<string, string>(CONNECTOR_CATEGORIES.map((c) => [c.id, c.label]));
const PERMISSION_LABEL: Record<string, string> = { read: 'Reads', write: 'Writes', destructive: 'Deletes' };

/** One connector: what it can do, its connections, a real action runner and its history. */
export function ConnectorDetailPage() {
  const { connectorId = '' } = useParams();
  const navigate = useNavigate();
  const { activeWorkspace } = useStudioSession();
  const detail = useConnectorDetail(connectorId);
  const invalidate = useInvalidateConnectors();
  const [tab, setTab] = useState('overview');
  const [connectOpen, setConnectOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);

  const refresh = useCallback(() => void invalidate(), [invalidate]);
  useOAuthCompletion(refresh);

  if (detail.isLoading) return <LoadingState fullPage label="Loading connector…" />;
  if (detail.isError || !detail.data) {
    return (
      <Page>
        <ErrorState
          title="Couldn’t load this connector"
          description={errorMessage(detail.error, 'It may not exist on this server.')}
          onRetry={() => detail.refetch()}
          action={
            <Button variant="outline" size="sm" onClick={() => navigate('/connectors')}>
              All connectors
            </Button>
          }
        />
      </Page>
    );
  }

  const c = detail.data;
  const meta = STATUS_META[c.status];
  const queries = c.capabilities.filter((x) => x.kind === 'query');
  const actions = c.capabilities.filter((x) => x.kind === 'action');

  return (
    <Page>
      <button
        type="button"
        onClick={() => navigate('/connectors')}
        className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden="true" /> App Connectors
      </button>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl border border-border bg-surface-raised">
              <AppConnectorIcon connectorId={c.slug} name={c.name} category={c.category} size={26} />
            </span>
            <span>{c.name}</span>
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </span>
        }
        description={c.description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {c.status !== 'unavailable' && (
              <Button size="sm" variant={c.status === 'connected' ? 'outline' : 'primary'} onClick={() => setConnectOpen(true)}>
                {c.status === 'connected' ? 'Add a connection' : c.status === 'needs_attention' ? 'Reconnect' : 'Connect'}
              </Button>
            )}
            {c.status === 'connected' && (
              <Button size="sm" onClick={() => setAgentOpen(true)}>
                <Bot className="mr-1 size-3.5" aria-hidden="true" /> Use in an agent
              </Button>
            )}
          </div>
        }
      />

      {c.status === 'unavailable' && (
        <div role="status" className="mb-4 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning-text">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {c.unavailableReason}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="actions">Actions ({c.capabilities.length})</TabsTrigger>
          <TabsTrigger value="triggers">Triggers ({c.triggers.length})</TabsTrigger>
          <TabsTrigger value="connections">Connections ({c.connections.length})</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Fact label="Calls, 30 days" value={c.usage.calls} />
            <Fact label="Succeeded" value={c.usage.calls ? `${Math.round(((c.usage.calls - c.usage.failures) / c.usage.calls) * 100)}%` : '—'} />
            <Fact label="Average time" value={c.usage.avgDurationMs !== null ? `${c.usage.avgDurationMs} ms` : '—'} />
            <Fact label="Most used" value={c.usage.topAction ?? '—'} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="What agents can do with it" icon={<Bot className="size-4 text-primary" aria-hidden="true" />}>
              {c.agentCapabilities.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {c.agentCapabilities.map((tag) => (
                    <span key={tag} className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary-text">
                      {AGENT_CAPABILITY_LABELS[tag]}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No agent actions yet.</p>
              )}
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                <li>
                  <Eye className="mr-1 inline size-3.5" aria-hidden="true" />
                  {queries.length} read{queries.length === 1 ? '' : 's'} an agent can use to look things up
                </li>
                <li>
                  <Wrench className="mr-1 inline size-3.5" aria-hidden="true" />
                  {actions.length} action{actions.length === 1 ? '' : 's'} that change things in {c.name}
                </li>
                <li>
                  <Zap className="mr-1 inline size-3.5" aria-hidden="true" />
                  {c.triggers.length} event{c.triggers.length === 1 ? '' : 's'} that can start an agent
                </li>
              </ul>
            </Section>
            <Section title="Sign-in & security" icon={<KeyRound className="size-4 text-muted-foreground" aria-hidden="true" />}>
              <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">Category</dt>
                <dd>{CATEGORY_LABEL.get(c.category) ?? c.category}</dd>
                <dt className="text-muted-foreground">Sign-in</dt>
                <dd>{AUTH_LABELS[c.authType] ?? c.authType}</dd>
                <dt className="text-muted-foreground">Acts as</dt>
                <dd>The person who connected it — agents never get more access than that connection.</dd>
                <dt className="text-muted-foreground">Writes</dt>
                <dd>{actions.filter((a) => a.requiresConfirmation).length} of {actions.length} need confirmation before they run</dd>
              </dl>
              {c.scopes.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {c.scopes.map((s) => (
                    <li key={s.scope}>
                      <code className="mr-1 rounded bg-surface-raised px-1 py-0.5 text-[10px]">{s.scope}</code>
                      {s.description}
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          </div>
        </TabsContent>

        <TabsContent value="actions" className="mt-4">
          {c.capabilities.length === 0 ? (
            <EmptyState icon={<Wrench />} title="No actions" description={`${c.name} doesn’t offer actions yet.`} />
          ) : (
            <div className="space-y-3">
              {[...queries, ...actions].map((cap) => (
                <ActionRow
                  key={cap.id}
                  capability={cap}
                  connectionId={usableConnection(c)?.id ?? null}
                  appName={c.name}
                  workspaceId={activeWorkspace?.id}
                  onRan={refresh}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="triggers" className="mt-4">
          {c.triggers.length === 0 ? (
            <EmptyState
              icon={<Zap />}
              title="No events yet"
              description={`${c.name} has no events that can start an agent. Agents can still use its actions, or run on a schedule.`}
            />
          ) : (
            <div className="space-y-3">
              {c.triggers.map((t) => {
                const watches = c.capabilities.find((x) => x.id === t.pollActionId);
                return (
                  <div key={t.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Zap className="size-4 text-warning" aria-hidden="true" /> {t.label}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Checked every 2 minutes through “{watches?.label ?? t.pollActionId}”. Each new item starts one run, and is available to the agent as{' '}
                        <code className="rounded bg-surface-raised px-1">{'{{event}}'}</code>.
                      </p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => navigate('/workflows')}>
                      <Workflow className="mr-1 size-3.5" aria-hidden="true" /> Start an agent with it
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="connections" className="mt-4">
          <ConnectionsList connections={c.connections} appName={c.name} onChanged={refresh} onReconnect={() => setConnectOpen(true)} />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          {c.activity.length === 0 ? (
            <EmptyState icon={<RefreshCw />} title="No activity yet" description={`Actions run through ${c.name}, tests and connection changes show up here.`} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>What</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Who</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                    <TableHead className="text-right">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {c.activity.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell className="text-xs font-medium">
                        {a.label}
                        {a.error && <div className="mt-0.5 max-w-md truncate text-[11px] font-normal text-destructive-text" title={a.error}>{a.error}</div>}
                      </TableCell>
                      <TableCell>
                        {a.status === 'SUCCESS' ? (
                          <Badge variant="success">Succeeded</Badge>
                        ) : (
                          <Badge variant="destructive">Failed</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{a.userName ?? 'System'}</TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">{a.durationMs !== null ? `${a.durationMs} ms` : '—'}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground" title={new Date(a.at).toLocaleString()}>
                        {timeAgo(a.at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ConnectDialog connector={c} open={connectOpen} onOpenChange={setConnectOpen} onConnected={refresh} />
      <AddToAgentDialog connector={c} open={agentOpen} onOpenChange={setAgentOpen} />
    </Page>
  );
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3.5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-lg font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

/** One action with an inline runner that calls the app for real. */
function ActionRow({
  capability,
  connectionId,
  appName,
  workspaceId,
  onRan,
}: {
  capability: ConnectorCapability;
  connectionId: string | null;
  appName: string;
  workspaceId: string | undefined;
  onRan: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string; data?: unknown } | null>(null);
  const missing = missingRequired(capability.inputSchema, values);

  const run = async () => {
    if (!workspaceId || !connectionId) return;
    if (capability.kind === 'action') {
      const ok = await confirm({
        title: `Run “${capability.label}” in ${appName}?`,
        description: `This really ${capability.permissionLevel === 'destructive' ? 'deletes something' : 'changes something'} in ${appName} with your connection.`,
        confirmLabel: 'Run it',
        destructive: capability.permissionLevel === 'destructive',
      });
      if (!ok) return;
    }
    setRunning(true);
    setResult(null);
    try {
      const res = await runConnectorAction(workspaceId, connectionId, capability, coerceSchemaInput(capability.inputSchema, values));
      setResult({ ok: res.success, message: res.message ?? (res.success ? 'Done.' : 'It didn’t work.'), data: res.data });
    } catch (error) {
      const message = errorMessage(error, `${appName} → ${capability.label} failed.`);
      setResult({ ok: false, message });
      toast.error(`${appName} → ${capability.label} failed`, { description: message });
    } finally {
      setRunning(false);
      onRan();
    }
  };

  return (
    <div className="rounded-xl border border-border bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl"
      >
        <span className="min-w-0">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            {capability.kind === 'query' ? <Eye className="size-4 text-muted-foreground" aria-hidden="true" /> : <Wrench className="size-4 text-muted-foreground" aria-hidden="true" />}
            {capability.label}
          </span>
          {capability.description && <span className="mt-0.5 block text-xs text-muted-foreground">{capability.description}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <Badge variant={capability.permissionLevel === 'read' ? 'neutral' : capability.permissionLevel === 'destructive' ? 'destructive' : 'warning'}>
            {PERMISSION_LABEL[capability.permissionLevel]}
          </Badge>
          {capability.requiresConfirmation && <Badge variant="outline">Asks first</Badge>}
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-border p-4">
          <div className="text-[11px] text-muted-foreground">
            Tool name <code className="rounded bg-surface-raised px-1">{capability.toolName}</code> · Workflow step{' '}
            <code className="rounded bg-surface-raised px-1">{capability.actionRef}</code>
          </div>
          {schemaProperties(capability.inputSchema).length > 0 && (
            <SchemaFields schema={capability.inputSchema} values={values} onChange={setValues} idPrefix={`run-${capability.id}`} />
          )}
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={run} loading={running} disabled={!connectionId || missing.length > 0}>
              <Play className="mr-1 size-3.5" aria-hidden="true" /> {capability.kind === 'query' ? 'Try it' : 'Run it'}
            </Button>
            {!connectionId && <span className="text-xs text-muted-foreground">Connect {appName} to try it.</span>}
            {connectionId && missing.length > 0 && <span className="text-xs text-muted-foreground">Fill in {missing.join(', ')}.</span>}
          </div>
          {result && (
            <div
              role="status"
              className={
                result.ok
                  ? 'rounded-lg border border-success/30 bg-success/10 p-3 text-xs text-success-text'
                  : 'rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive-text'
              }
            >
              <div className="flex items-center gap-1.5 font-medium">
                {result.ok ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <XCircle className="size-3.5" aria-hidden="true" />}
                {result.message}
              </div>
              {result.data !== undefined && (
                <CodeBlock variant="compact" className="mt-2 max-h-72 overflow-auto" language="json" code={JSON.stringify(result.data, null, 2).slice(0, 20_000)} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConnectionsList({
  connections,
  appName,
  onChanged,
  onReconnect,
}: {
  connections: ConnectorConnection[];
  appName: string;
  onChanged: () => void;
  onReconnect: () => void;
}) {
  const { activeWorkspace } = useStudioSession();
  const [busy, setBusy] = useState<string | null>(null);

  if (connections.length === 0) {
    return <EmptyState icon={<KeyRound />} title="Not connected" description={`Connect ${appName} to let agents and workflows use it.`} />;
  }

  const test = async (id: string) => {
    if (!activeWorkspace) return;
    setBusy(id);
    try {
      const res = await testConnection(activeWorkspace.id, id);
      if (res.success) toast.success(res.message);
      else toast.error(`${appName} connection failed`, { description: res.message });
    } catch (error) {
      toast.error(errorMessage(error, 'The test didn’t run.'));
    } finally {
      setBusy(null);
      onChanged();
    }
  };

  const remove = async (conn: ConnectorConnection) => {
    if (!activeWorkspace) return;
    const ok = await confirm({
      title: `Disconnect ${conn.accountEmail ?? conn.displayName ?? appName}?`,
      description: `Agents and workflows that use this ${appName} connection stop working until it’s connected again.`,
      confirmLabel: 'Disconnect',
      destructive: true,
    });
    if (!ok) return;
    setBusy(conn.id);
    try {
      await disconnectConnection(activeWorkspace.id, conn.id);
      toast.success(`${appName} disconnected.`);
    } catch (error) {
      toast.error(errorMessage(error, 'Couldn’t disconnect.'));
    } finally {
      setBusy(null);
      onChanged();
    }
  };

  return (
    <div className="space-y-2">
      {connections.map((conn) => {
        const healthy = conn.status === 'CONNECTED';
        return (
          <div key={conn.id} className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                {conn.accountEmail ?? conn.accountName ?? conn.displayName ?? appName}
                <Badge variant={healthy ? 'success' : conn.status === 'DISCONNECTED' ? 'neutral' : 'warning'}>{conn.status.toLowerCase()}</Badge>
                <Badge variant="outline">{conn.scopeType === 'USER' ? (conn.mine ? 'Yours' : 'Personal') : 'Whole workspace'}</Badge>
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                Connected {timeAgo(conn.createdAt)}
                {conn.lastSyncAt && ` · synced ${timeAgo(conn.lastSyncAt)}`}
              </div>
              {conn.lastErrorMessage && <div className="mt-1 text-[11px] text-destructive-text">{conn.lastErrorMessage}</div>}
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {!healthy && (
                <Button size="xs" onClick={onReconnect}>
                  Reconnect
                </Button>
              )}
              <Button size="xs" variant="outline" onClick={() => test(conn.id)} loading={busy === conn.id} disabled={!!busy}>
                Test
              </Button>
              <Button size="xs" variant="ghost" onClick={() => remove(conn)} disabled={!!busy} aria-label={`Disconnect ${appName}`}>
                <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ConnectorDetailPage;
