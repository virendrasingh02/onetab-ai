import { CONNECTOR_CATEGORIES, AGENT_CAPABILITY_LABELS, type ConnectorCategory } from '@org/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Page,
  PageHeader,
  SegmentedControl,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@org/ui';
import { cn } from '@org/utils';
import { Bot, ChevronRight, Plug, Search, Star, Wrench, Zap, Eye } from 'lucide-react';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AddToAgentDialog } from '../components/connectors/add-to-agent-dialog.js';
import { ConnectDialog } from '../components/connectors/connect-dialog.js';
import { AppConnectorIcon } from '../components/common/app-connector-icon.jsx';
import {
  AUTH_LABELS,
  STATUS_META,
  errorMessage,
  useConnectors,
  useInvalidateConnectors,
  useOAuthCompletion,
  useStarredConnectors,
  type ConnectorSummary,
} from '../services/connectors.js';

type StatusFilter = 'all' | 'connected' | 'available';

const CATEGORY_LABEL = new Map<string, string>(CONNECTOR_CATEGORIES.map((c) => [c.id, c.label]));

/**
 * App Connectors center. Every connector the server has an adapter for, with
 * what it can do (actions, reads, triggers, agent capabilities), whether it's
 * connected here, and its real usage. Connect, test, use in an agent, or open
 * it for actions, triggers, connections and history.
 */
export function ConnectorsPage() {
  const navigate = useNavigate();
  const connectors = useConnectors();
  const invalidate = useInvalidateConnectors();
  const { starred, toggle } = useStarredConnectors();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ConnectorCategory | 'all'>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [connecting, setConnecting] = useState<ConnectorSummary | null>(null);
  const [addingToAgent, setAddingToAgent] = useState<ConnectorSummary | null>(null);

  const refresh = useCallback(() => void invalidate(), [invalidate]);
  useOAuthCompletion(refresh);

  const list = useMemo(() => connectors.data ?? [], [connectors.data]);
  const presentCategories = useMemo(
    () => CONNECTOR_CATEGORIES.filter((c) => list.some((x) => x.category === c.id)),
    [list],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list
      .filter((c) => category === 'all' || c.category === category)
      .filter((c) => (status === 'connected' ? c.status === 'connected' || c.status === 'needs_attention' : status === 'available' ? c.status === 'not_connected' : true))
      .filter((c) => {
        if (!q) return true;
        return (
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          (CATEGORY_LABEL.get(c.category) ?? '').toLowerCase().includes(q) ||
          c.capabilities.some((a) => a.label.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)) ||
          c.triggers.some((t) => t.label.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => Number(starred.includes(b.provider)) - Number(starred.includes(a.provider)));
  }, [list, category, status, query, starred]);

  const stats = useMemo(
    () => ({
      connected: list.filter((c) => c.status === 'connected').length,
      attention: list.filter((c) => c.status === 'needs_attention').length,
      actions: list.reduce((n, c) => n + c.counts.actions + c.counts.queries, 0),
      triggers: list.reduce((n, c) => n + c.counts.triggers, 0),
      calls: list.reduce((n, c) => n + c.usage.calls, 0),
      failures: list.reduce((n, c) => n + c.usage.failures, 0),
    }),
    [list],
  );

  return (
    <Page>
      <PageHeader
        title="App Connectors"
        description="Connect the apps your agents work in. Every action, read and event a connector offers becomes a tool, a workflow step or a trigger in the Studio."
        icon={<Plug />}
        actions={
          <Button size="sm" variant="outline" onClick={() => navigate('/workflows')}>
            Open the canvas
          </Button>
        }
      />

      {connectors.isLoading ? (
        <LoadingState label="Loading connectors…" />
      ) : connectors.isError ? (
        <ErrorState
          title="Couldn’t load connectors"
          description={errorMessage(connectors.error, 'The server didn’t answer.')}
          onRetry={() => connectors.refetch()}
        />
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Connected" value={`${stats.connected} / ${list.length}`} hint={stats.attention ? `${stats.attention} need attention` : undefined} />
            <Stat label="Actions & reads" value={stats.actions} />
            <Stat label="Triggers" value={stats.triggers} />
            <Stat
              label="Calls, last 30 days"
              value={stats.calls}
              hint={stats.calls ? `${Math.round(((stats.calls - stats.failures) / stats.calls) * 100)}% succeeded` : 'No calls yet'}
            />
          </div>

          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search apps, actions or events"
                aria-label="Search connectors"
                className="pl-9"
              />
            </div>
            <SegmentedControl<StatusFilter>
              aria-label="Connection status"
              size="sm"
              value={status}
              onChange={setStatus}
              options={[
                { value: 'all', label: `All (${list.length})` },
                { value: 'connected', label: `Connected (${stats.connected + stats.attention})` },
                { value: 'available', label: 'Not connected' },
              ]}
            />
          </div>

          <div className="mb-5 flex gap-1.5 overflow-x-auto pb-1" role="toolbar" aria-label="Categories">
            {[{ id: 'all' as const, label: 'All' }, ...presentCategories].map((c) => (
              <button
                key={c.id}
                type="button"
                aria-pressed={category === c.id}
                onClick={() => setCategory(c.id)}
                className={cn(
                  'whitespace-nowrap rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  category === c.id
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-surface text-muted-foreground hover:bg-surface-raised hover:text-foreground',
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Plug />}
              title={list.length ? 'No connectors match' : 'No connectors on this server'}
              description={list.length ? 'Try another search or clear the filters.' : 'Connectors appear here once their adapters are installed on the server.'}
              action={
                list.length ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setQuery('');
                      setCategory('all');
                      setStatus('all');
                    }}
                  >
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((c) => (
                <ConnectorCard
                  key={c.provider}
                  connector={c}
                  starred={starred.includes(c.provider)}
                  onStar={() => toggle(c.provider)}
                  onOpen={() => navigate(`/connectors/${c.slug}`)}
                  onConnect={() => setConnecting(c)}
                  onAddToAgent={() => setAddingToAgent(c)}
                />
              ))}
            </div>
          )}
        </>
      )}

      <ConnectDialog
        connector={connecting}
        open={!!connecting}
        onOpenChange={(o) => !o && setConnecting(null)}
        onConnected={refresh}
      />
      <AddToAgentDialog connector={addingToAgent} open={!!addingToAgent} onOpenChange={(o) => !o && setAddingToAgent(null)} />
    </Page>
  );
}

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3.5">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function ConnectorCard({
  connector: c,
  starred,
  onStar,
  onOpen,
  onConnect,
  onAddToAgent,
}: {
  connector: ConnectorSummary;
  starred: boolean;
  onStar: () => void;
  onOpen: () => void;
  onConnect: () => void;
  onAddToAgent: () => void;
}) {
  const meta = STATUS_META[c.status];
  const account = c.connections.find((x) => x.status === 'CONNECTED');
  return (
    <Card className="group flex flex-col justify-between gap-4 p-5 transition-shadow hover:shadow-md">
      <div>
        <div className="mb-3 flex items-start justify-between gap-3">
          <button
            type="button"
            onClick={onOpen}
            className="flex min-w-0 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised">
              <AppConnectorIcon connectorId={c.slug} name={c.name} category={c.category} size={26} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-foreground group-hover:text-primary">{c.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">
                {CATEGORY_LABEL.get(c.category) ?? c.category} · {AUTH_LABELS[c.authType] ?? c.authType}
              </span>
            </span>
          </button>
          <div className="flex shrink-0 items-center gap-1">
            <Badge variant={meta.variant}>{meta.label}</Badge>
            <button
              type="button"
              onClick={onStar}
              aria-pressed={starred}
              aria-label={starred ? `Unstar ${c.name}` : `Star ${c.name}`}
              className="rounded-md p-1 text-muted-foreground hover:text-warning focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Star className={cn('size-4', starred && 'fill-warning text-warning')} aria-hidden="true" />
            </button>
          </div>
        </div>

        <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{c.description}</p>

        <div className="mb-3 flex flex-wrap gap-1.5 text-[11px]">
          <CountChip icon={<Wrench className="size-3" />} label={`${c.counts.actions} action${c.counts.actions === 1 ? '' : 's'}`} />
          <CountChip icon={<Eye className="size-3" />} label={`${c.counts.queries} read${c.counts.queries === 1 ? '' : 's'}`} />
          {c.counts.triggers > 0 && <CountChip icon={<Zap className="size-3 text-warning" />} label={`${c.counts.triggers} trigger${c.counts.triggers === 1 ? '' : 's'}`} />}
        </div>

        {c.agentCapabilities.length > 0 && (
          <div className="flex flex-wrap items-center gap-1" aria-label="What agents can do with it">
            <Bot className="size-3.5 text-primary" aria-hidden="true" />
            {c.agentCapabilities.slice(0, 4).map((tag) => (
              <span key={tag} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary-text">
                {AGENT_CAPABILITY_LABELS[tag]}
              </span>
            ))}
          </div>
        )}

        {account && (
          <p className="mt-3 truncate text-[11px] text-muted-foreground">
            As <span className="font-medium text-foreground">{account.accountEmail ?? account.accountName ?? account.displayName}</span>
            {c.usage.calls > 0 && ` · ${c.usage.calls} call${c.usage.calls === 1 ? '' : 's'} in 30 days`}
          </p>
        )}
        {c.status === 'needs_attention' && (
          <p className="mt-2 text-[11px] text-warning-text">{c.connections.find((x) => x.lastErrorMessage)?.lastErrorMessage ?? 'The connection stopped working. Reconnect it.'}</p>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-3">
        {c.status === 'unavailable' ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex-1 text-[11px] text-muted-foreground">Not set up on this server</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">{c.unavailableReason}</TooltipContent>
          </Tooltip>
        ) : c.status === 'connected' ? (
          <Button size="xs" variant="outline" className="flex-1" onClick={onAddToAgent}>
            <Bot className="mr-1 size-3" aria-hidden="true" />
            Use in an agent
          </Button>
        ) : (
          <Button size="xs" className="flex-1" onClick={onConnect}>
            {c.status === 'needs_attention' ? 'Reconnect' : 'Connect'}
          </Button>
        )}
        <Button size="xs" variant="ghost" onClick={onOpen} aria-label={`Open ${c.name}`}>
          Details
          <ChevronRight className="ml-0.5 size-3" aria-hidden="true" />
        </Button>
      </div>
    </Card>
  );
}

function CountChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-raised px-2 py-0.5 font-medium text-foreground">
      <span className="text-muted-foreground" aria-hidden="true">
        {icon}
      </span>
      {label}
    </span>
  );
}

export default ConnectorsPage;
