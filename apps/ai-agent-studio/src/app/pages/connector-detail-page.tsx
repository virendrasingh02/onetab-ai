import {
  AGENT_CAPABILITY_LABELS,
  CONNECTOR_CATEGORIES,
  type ConnectorCapability,
  type ConnectorConnection,
} from '@org/types';
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
import {
  ArrowLeft,
  Bot,
  Pencil,
  CheckCircle2,
  Copy,
  Eye,
  KeyRound,
  Play,
  RefreshCw,
  ShieldAlert,
  Trash2,
  Workflow,
  Wrench,
  XCircle,
  Zap,
} from 'lucide-react';
import { useCallback, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from '../router.js';
import { AddToAgentDialog } from '../components/connectors/add-to-agent-dialog.js';
import { OAuthAppsDialog } from '@org/web-integrations';
import { ConnectDialog } from '../components/connectors/connect-dialog.js';
import {
  SchemaFields,
  coerceSchemaInput,
  missingRequired,
  schemaProperties,
} from '../components/connectors/schema-fields.js';
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

const CATEGORY_LABEL = new Map<string, string>(
  CONNECTOR_CATEGORIES.map((c) => [c.id, c.label]),
);
const PERMISSION_LABEL: Record<string, string> = {
  read: 'Reads',
  write: 'Writes',
  destructive: 'Deletes',
};

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
  const [oauthOpen, setOauthOpen] = useState(false);

  const refresh = useCallback(() => void invalidate(), [invalidate]);
  useOAuthCompletion(refresh);

  if (detail.isLoading)
    return <LoadingState fullPage label="Loading connector…" />;
  if (detail.isError || !detail.data) {
    return (
      <Page width="full">
        <ErrorState
          title="Couldn’t load this connector"
          description={errorMessage(
            detail.error,
            'It may not exist on this server.',
          )}
          onRetry={() => detail.refetch()}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/connectors')}
            >
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
    <Page width="full">
      <div className="mb-3 flex">
        <Button
          variant="link"
          size="xs"
          type="button"
          onClick={() => navigate('/connectors')}
          className="gap-1 px-0 h-auto text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" /> App Connectors
        </Button>
      </div>
      <PageHeader
        title={
          <span className="gap-3 flex items-center">
            <span className="size-11 flex items-center justify-center rounded-xl border border-border bg-surface-raised">
              <AppConnectorIcon
                connectorId={c.slug}
                name={c.name}
                category={c.category}
                size={26}
              />
            </span>
            <span>{c.name}</span>
            <Badge variant={meta.variant}>{meta.label}</Badge>
          </span>
        }
        description={c.description}
        actions={
          <div className="gap-2 flex flex-wrap items-center">
            {c.custom && c.customIntegrationId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`/connectors/${c.slug}/edit`)}
                leadingIcon={<Pencil />}
              >
                Edit connector
              </Button>
            )}
            {c.status !== 'unavailable' && !c.custom && (
              <Button
                size="sm"
                variant={c.status === 'connected' ? 'outline' : 'primary'}
                onClick={() => setConnectOpen(true)}
              >
                {c.status === 'connected'
                  ? 'Add a connection'
                  : c.status === 'needs_attention'
                    ? 'Reconnect'
                    : 'Connect'}
              </Button>
            )}
            {c.status === 'connected' && (
              <Button size="sm" onClick={() => setAgentOpen(true)}>
                <Bot className="mr-1 size-3.5" aria-hidden="true" /> Use in an
                agent
              </Button>
            )}
          </div>
        }
      />

      {c.status === 'unavailable' && (
        <div
          role="status"
          className="mb-4 gap-2 p-3 text-xs flex items-start rounded-lg border border-warning/30 bg-warning/10 text-warning-text"
        >
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span className="min-w-0 flex-1">{c.unavailableReason}</span>
          {c.authType === 'OAUTH2' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setOauthOpen(true)}
              leadingIcon={<KeyRound />}
            >
              Set up OAuth app
            </Button>
          )}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="actions">
            Actions ({c.capabilities.length})
          </TabsTrigger>
          <TabsTrigger value="triggers">
            Triggers ({c.triggers.length})
          </TabsTrigger>
          <TabsTrigger value="connections">
            Connections ({c.connections.length})
          </TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          {c.connections.length === 0 &&
          c.status !== 'unavailable' &&
          !c.custom ? (
            <div className="gap-4 p-5 md:flex-row md:items-center md:justify-between flex flex-col rounded-xl border border-primary/25 bg-primary/5">
              <div className="min-w-0">
                <h2 className="text-sm font-semibold text-foreground">
                  Connect {c.name} to get started
                </h2>
                <ol className="mt-2 gap-1.5 text-xs sm:grid-cols-3 sm:gap-4 grid text-muted-foreground">
                  <Step n={1}>
                    Sign in with{' '}
                    {(AUTH_LABELS[c.authType] ?? c.authType).toLowerCase()}
                  </Step>
                  <Step n={2}>Try an action to check it works</Step>
                  <Step n={3}>Add it to an agent or workflow</Step>
                </ol>
              </div>
              <Button
                size="sm"
                className="shrink-0"
                onClick={() => setConnectOpen(true)}
              >
                Connect {c.name}
              </Button>
            </div>
          ) : (
            <div className="gap-3 lg:grid-cols-4 grid grid-cols-2">
              <Fact label="Calls, 30 days" value={c.usage.calls} />
              <Fact
                label="Succeeded"
                value={
                  c.usage.calls
                    ? `${Math.round(((c.usage.calls - c.usage.failures) / c.usage.calls) * 100)}%`
                    : '—'
                }
              />
              <Fact
                label="Average time"
                value={
                  c.usage.avgDurationMs !== null
                    ? `${c.usage.avgDurationMs} ms`
                    : '—'
                }
              />
              <Fact label="Most used" value={c.usage.topAction ?? '—'} />
            </div>
          )}
          <div className="gap-4 lg:grid-cols-5 grid">
            <Section
              className="lg:col-span-3"
              title="What agents can do with it"
              icon={<Bot className="size-4 text-primary" aria-hidden="true" />}
              aside={
                c.agentCapabilities.length > 0 && (
                  <div className="gap-1.5 flex flex-wrap justify-end">
                    {c.agentCapabilities.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-0.5 font-medium rounded-md bg-brand/10 text-2xs text-brand-text"
                      >
                        {AGENT_CAPABILITY_LABELS[tag]}
                      </span>
                    ))}
                  </div>
                )
              }
            >
              <div className="gap-2 grid grid-cols-3">
                <CountTile
                  icon={<Eye />}
                  count={queries.length}
                  label={queries.length === 1 ? 'Read' : 'Reads'}
                  hint="Look things up"
                  onClick={() => setTab('actions')}
                />
                <CountTile
                  icon={<Wrench />}
                  count={actions.length}
                  label={actions.length === 1 ? 'Action' : 'Actions'}
                  hint={`Change ${c.name}`}
                  onClick={() => setTab('actions')}
                />
                <CountTile
                  icon={<Zap />}
                  count={c.triggers.length}
                  label={c.triggers.length === 1 ? 'Event' : 'Events'}
                  hint="Start an agent"
                  onClick={() => setTab('triggers')}
                />
              </div>
              {c.capabilities.length > 0 ? (
                <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
                  {[...queries, ...actions].slice(0, 5).map((cap) => (
                    <li
                      key={cap.id}
                      className="gap-3 px-3 py-2 flex items-center"
                    >
                      {cap.kind === 'query' ? (
                        <Eye
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      ) : (
                        <Wrench
                          className="size-3.5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="text-xs font-medium block truncate text-foreground">
                          {cap.label}
                        </span>
                        {cap.description && (
                          <span className="block truncate text-2xs text-muted-foreground">
                            {cap.description}
                          </span>
                        )}
                      </span>
                      <span className="gap-1 flex shrink-0 items-center">
                        {cap.requiresConfirmation && (
                          <Badge variant="outline">Asks first</Badge>
                        )}
                        <Badge
                          variant={
                            cap.permissionLevel === 'read'
                              ? 'neutral'
                              : cap.permissionLevel === 'destructive'
                                ? 'destructive'
                                : 'warning'
                          }
                        >
                          {PERMISSION_LABEL[cap.permissionLevel]}
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-xs text-muted-foreground">
                  No agent actions yet.
                </p>
              )}
              {c.capabilities.length > 5 && (
                <Button
                  variant="link"
                  size="xs"
                  className="mt-2 px-0 h-auto"
                  onClick={() => setTab('actions')}
                >
                  See all {c.capabilities.length} actions
                </Button>
              )}
            </Section>
            <Section
              className="lg:col-span-2"
              title="Sign-in & security"
              icon={
                <KeyRound
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              }
            >
              <dl className="text-xs divide-y divide-border">
                <SecurityRow label="Category">
                  {CATEGORY_LABEL.get(c.category) ?? c.category}
                </SecurityRow>
                <SecurityRow label="Sign-in">
                  {AUTH_LABELS[c.authType] ?? c.authType}
                </SecurityRow>
                <SecurityRow label="Acts as">
                  The person who connected it — agents never get more access
                  than that connection.
                </SecurityRow>
                <SecurityRow label="Writes">
                  {actions.length === 0
                    ? 'None — read only'
                    : `${actions.filter((a) => a.requiresConfirmation).length} of ${actions.length} ask for confirmation before they run`}
                </SecurityRow>
              </dl>
              {c.scopes.length > 0 && (
                <div className="mt-4">
                  <h3 className="mb-2 font-medium tracking-wider text-2xs text-muted-foreground uppercase">
                    Permissions requested
                  </h3>
                  <ul className="space-y-1.5 text-xs">
                    {c.scopes.map((s) => (
                      <li key={s.scope} className="gap-2 flex items-start">
                        <code className="px-1.5 py-0.5 shrink-0 rounded-md bg-surface-raised font-mono text-2xs text-foreground">
                          {s.scope}
                        </code>
                        <span className="text-muted-foreground">
                          {s.description}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>
          </div>
        </TabsContent>

        <TabsContent value="actions" className="mt-4">
          {c.capabilities.length === 0 ? (
            <EmptyState
              icon={<Wrench />}
              title="No actions"
              description={`${c.name} doesn’t offer actions yet.`}
            />
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
                const watches = c.capabilities.find(
                  (x) => x.id === t.pollActionId,
                );
                return (
                  <div
                    key={t.id}
                    className="gap-3 p-4 md:flex-row md:items-center md:justify-between flex flex-col rounded-xl border border-border bg-surface"
                  >
                    <div className="min-w-0">
                      <div className="gap-2 text-sm font-medium flex items-center text-foreground">
                        <Zap
                          className="size-4 text-warning"
                          aria-hidden="true"
                        />{' '}
                        {t.label}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t.description}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Checked every 2 minutes through “
                        {watches?.label ?? t.pollActionId}”. Each new item
                        starts one run, and is available to the agent as{' '}
                        <code className="px-1 rounded-md bg-surface-raised">
                          {'{{event}}'}
                        </code>
                        .
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/workflows')}
                    >
                      <Workflow className="mr-1 size-3.5" aria-hidden="true" />{' '}
                      Start an agent with it
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="connections" className="mt-4">
          <ConnectionsList
            connections={c.connections}
            appName={c.name}
            onChanged={refresh}
            onReconnect={() => setConnectOpen(true)}
          />
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          {c.activity.length === 0 ? (
            <EmptyState
              icon={<RefreshCw />}
              title="No activity yet"
              description={`Actions run through ${c.name}, tests and connection changes show up here.`}
            />
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
                        {a.error && (
                          <div
                            className="mt-0.5 max-w-md text-xs font-normal truncate text-destructive-text"
                            title={a.error}
                          >
                            {a.error}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {a.status === 'SUCCESS' ? (
                          <Badge variant="success">Succeeded</Badge>
                        ) : (
                          <Badge variant="destructive">Failed</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.userName ?? 'System'}
                      </TableCell>
                      <TableCell className="text-xs text-right text-muted-foreground tabular-nums">
                        {a.durationMs !== null ? `${a.durationMs} ms` : '—'}
                      </TableCell>
                      <TableCell
                        className="text-xs text-right text-muted-foreground"
                        title={new Date(a.at).toLocaleString()}
                      >
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

      <ConnectDialog
        connector={c}
        open={connectOpen}
        onOpenChange={setConnectOpen}
        onConnected={refresh}
      />
      <OAuthAppsDialog
        workspaceId={activeWorkspace?.id}
        open={oauthOpen}
        onOpenChange={setOauthOpen}
        initialProvider={c.provider}
      />
      <AddToAgentDialog
        connector={c}
        open={agentOpen}
        onOpenChange={setAgentOpen}
      />
    </Page>
  );
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-3.5 rounded-xl border border-border bg-surface">
      <div className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {label}
      </div>
      <div className="mt-1 text-lg font-semibold truncate text-foreground tabular-nums">
        {value}
      </div>
    </div>
  );
}

function Section({
  title,
  icon,
  aside,
  className,
  children,
}: {
  title: string;
  icon: ReactNode;
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`min-w-0 p-4 rounded-xl border border-border bg-surface ${className ?? ''}`}
    >
      <div className="mb-3 gap-2 flex flex-wrap items-center justify-between">
        <h2 className="gap-2 text-sm font-semibold flex items-center text-foreground">
          {icon}
          {title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="gap-2 flex items-center">
      <span className="size-5 font-semibold flex shrink-0 items-center justify-center rounded-full bg-primary/15 text-2xs text-primary-text">
        {n}
      </span>
      {children}
    </li>
  );
}

function CountTile({
  icon,
  count,
  label,
  hint,
  onClick,
}: {
  icon: ReactNode;
  count: number;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-w-0 p-3 rounded-lg border border-border bg-surface-raised text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="gap-1.5 [&>svg]:size-3.5 flex items-center text-muted-foreground">
        {icon}
        <span className="font-medium tracking-wider text-2xs uppercase">
          {label}
        </span>
      </span>
      <span className="mt-1 text-xl font-semibold block text-foreground tabular-nums">
        {count}
      </span>
      <span className="block truncate text-2xs text-muted-foreground">
        {hint}
      </span>
    </button>
  );
}

function SecurityRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="gap-3 py-2 first:pt-0 last:pb-0 grid grid-cols-[5.5rem_1fr]">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{children}</dd>
    </div>
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
  const [result, setResult] = useState<{
    ok: boolean;
    message: string;
    data?: unknown;
  } | null>(null);
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
      const res = await runConnectorAction(
        workspaceId,
        connectionId,
        capability,
        coerceSchemaInput(capability.inputSchema, values),
      );
      setResult({
        ok: res.success,
        message: res.message ?? (res.success ? 'Done.' : 'It didn’t work.'),
        data: res.data,
      });
    } catch (error) {
      const message = errorMessage(
        error,
        `${appName} → ${capability.label} failed.`,
      );
      setResult({ ok: false, message });
      toast.error(`${appName} → ${capability.label} failed`, {
        description: message,
      });
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
        className="gap-3 p-4 flex w-full items-start justify-between rounded-xl text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="min-w-0">
          <span className="gap-2 text-sm font-medium flex items-center text-foreground">
            {capability.kind === 'query' ? (
              <Eye
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
            ) : (
              <Wrench
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
            )}
            {capability.label}
          </span>
          {capability.description && (
            <span className="mt-0.5 text-xs block text-muted-foreground">
              {capability.description}
            </span>
          )}
        </span>
        <span className="gap-1.5 flex shrink-0 items-center">
          <Badge
            variant={
              capability.permissionLevel === 'read'
                ? 'neutral'
                : capability.permissionLevel === 'destructive'
                  ? 'destructive'
                  : 'warning'
            }
          >
            {PERMISSION_LABEL[capability.permissionLevel]}
          </Badge>
          {capability.requiresConfirmation && (
            <Badge variant="outline">Asks first</Badge>
          )}
        </span>
      </button>
      {open && (
        <div className="space-y-3 p-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            Tool name{' '}
            <code className="px-1 rounded-md bg-surface-raised">
              {capability.toolName}
            </code>{' '}
            · Workflow step{' '}
            <code className="px-1 rounded-md bg-surface-raised">
              {capability.actionRef}
            </code>
          </div>
          {schemaProperties(capability.inputSchema).length > 0 && (
            <SchemaFields
              schema={capability.inputSchema}
              values={values}
              onChange={setValues}
              idPrefix={`run-${capability.id}`}
            />
          )}
          <div className="gap-2 flex items-center">
            <Button
              size="sm"
              onClick={run}
              loading={running}
              disabled={!connectionId || missing.length > 0}
            >
              <Play className="mr-1 size-3.5" aria-hidden="true" />{' '}
              {capability.kind === 'query' ? 'Try it' : 'Run it'}
            </Button>
            {!connectionId && (
              <span className="text-xs text-muted-foreground">
                Connect {appName} to try it.
              </span>
            )}
            {connectionId && missing.length > 0 && (
              <span className="text-xs text-muted-foreground">
                Fill in {missing.join(', ')}.
              </span>
            )}
          </div>
          {result && (
            <div
              role="status"
              className={
                result.ok
                  ? 'p-3 text-xs rounded-lg border border-success/30 bg-success/10 text-success-text'
                  : 'p-3 text-xs rounded-lg border border-destructive/30 bg-destructive/10 text-destructive-text'
              }
            >
              <div className="gap-1.5 font-medium flex items-center">
                {result.ok ? (
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                ) : (
                  <XCircle className="size-3.5" aria-hidden="true" />
                )}
                {result.message}
              </div>
              {result.data !== undefined && (
                <CodeBlock
                  variant="compact"
                  className="mt-2 max-h-72 overflow-auto"
                  language="json"
                  code={JSON.stringify(result.data, null, 2).slice(0, 20_000)}
                />
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
    return (
      <EmptyState
        icon={<KeyRound />}
        title="Not connected"
        description={`Connect ${appName} to let agents and workflows use it.`}
      />
    );
  }

  const test = async (id: string) => {
    if (!activeWorkspace) return;
    setBusy(id);
    try {
      const res = await testConnection(activeWorkspace.id, id);
      if (res.success) toast.success(res.message);
      else
        toast.error(`${appName} connection failed`, {
          description: res.message,
        });
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
          <div
            key={conn.id}
            className="gap-3 p-4 md:flex-row md:items-center md:justify-between flex flex-col rounded-xl border border-border bg-surface"
          >
            <div className="min-w-0">
              <div className="gap-2 text-sm font-medium flex flex-wrap items-center text-foreground">
                {conn.accountEmail ??
                  conn.accountName ??
                  conn.displayName ??
                  appName}
                <Badge
                  variant={
                    healthy
                      ? 'success'
                      : conn.status === 'DISCONNECTED'
                        ? 'neutral'
                        : 'warning'
                  }
                >
                  {conn.status.toLowerCase()}
                </Badge>
                <Badge variant="outline">
                  {conn.scopeType === 'USER'
                    ? conn.mine
                      ? 'Yours'
                      : 'Personal'
                    : 'Whole workspace'}
                </Badge>
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Connected {timeAgo(conn.createdAt)}
                {conn.lastSyncAt && ` · synced ${timeAgo(conn.lastSyncAt)}`}
              </div>
              {conn.lastErrorMessage && (
                <div className="mt-1 text-xs text-destructive-text">
                  {conn.lastErrorMessage}
                </div>
              )}
              {conn.webhookUrl && (
                <div className="mt-2 min-w-0 gap-1.5 text-xs flex items-center text-muted-foreground">
                  <span className="shrink-0">Webhook address</span>
                  <code className="min-w-0 px-1.5 py-0.5 truncate rounded-md bg-surface-muted font-mono text-foreground">
                    {conn.webhookUrl}
                  </code>
                  <Button
                    size="xs"
                    variant="ghost"
                    aria-label="Copy webhook address"
                    onClick={() => {
                      void navigator.clipboard
                        ?.writeText(conn.webhookUrl as string)
                        .then(
                          () => toast.success('Webhook address copied.'),
                          () =>
                            toast.error(
                              'Couldn’t copy. Select the address and copy it by hand.',
                            ),
                        );
                    }}
                  >
                    <Copy className="size-3" aria-hidden="true" />
                  </Button>
                </div>
              )}
            </div>
            <div className="gap-1.5 flex shrink-0 items-center">
              {!healthy && (
                <Button size="xs" onClick={onReconnect}>
                  Reconnect
                </Button>
              )}
              <Button
                size="xs"
                variant="outline"
                onClick={() => test(conn.id)}
                loading={busy === conn.id}
                disabled={!!busy}
              >
                Test
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => remove(conn)}
                disabled={!!busy}
                aria-label={`Disconnect ${appName}`}
              >
                <Trash2
                  className="size-3.5 text-destructive"
                  aria-hidden="true"
                />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ConnectorDetailPage;
