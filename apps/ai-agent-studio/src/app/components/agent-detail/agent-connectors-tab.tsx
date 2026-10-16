import {
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  LoadingState,
  confirm,
  toast,
  Input,
  ResponsiveTabs,
  Button,
} from '@org/ui';
import { cn } from '@org/utils';
import { CONNECTOR_CATEGORIES } from '@org/types';
import { Bot, Check, ExternalLink, Plus, Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from '../../router.js';
import {
  agentConnectorActions,
  detachConnectorFromAgent,
  errorMessage,
  useConnectors,
  type AgentWithApps,
  type ConnectorSummary,
} from '../../services/connectors.js';
import { useStudioSession } from '../../session-guard.js';
import { AppConnectorIcon } from '../common/app-connector-icon.jsx';
import { AddToAgentDialog } from '../connectors/add-to-agent-dialog.js';
import { AgentGroupsMenu } from '../connectors/agent-groups-menu.js';

const CATEGORY_LABEL = new Map<string, string>(CONNECTOR_CATEGORIES.map((c) => [c.id, c.label]));
const ENABLED_TAB = '__enabled';
const ALL_TAB = '__all';

interface AppRow {
  connector: ConnectorSummary;
  /** Action ids the agent may use; empty when the app isn't given to it. */
  actions: string[];
}

/**
 * The apps this agent can act in, as one searchable catalog: a check marks an
 * app the agent already has, a plus gives it one. Giving it an app links the
 * connection (that is what the runtime offers the model) and, when only some
 * actions are picked, narrows that app to them — built-in tools are untouched.
 */
export function AgentConnectorsTab({ agent, onChanged }: { agent: AgentWithApps; onChanged: () => void }) {
  const navigate = useNavigate();
  const { activeWorkspace } = useStudioSession();
  const connectors = useConnectors();
  const [adding, setAdding] = useState<ConnectorSummary | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<string>(ALL_TAB);

  const rows = useMemo<AppRow[]>(() => {
    const all = (connectors.data ?? []).filter((c) => c.capabilities.length > 0);
    return all
      .map((c) => ({ connector: c, actions: agentConnectorActions(agent, c) }))
      // Enabled first, then ready-to-add, then the rest; alphabetical inside each
      .sort((a, b) => rank(a) - rank(b) || a.connector.name.localeCompare(b.connector.name));
  }, [connectors.data, agent]);

  const enabledCount = rows.filter((r) => r.actions.length > 0).length;
  const categories = useMemo(
    () => CONNECTOR_CATEGORIES.filter((c) => rows.some((r) => r.connector.category === c.id)),
    [rows],
  );

  // Up to three apps worth adding next: connected ones first, then the most used
  const suggested = useMemo(
    () =>
      rows
        .filter((r) => r.actions.length === 0 && r.connector.status !== 'unavailable')
        .sort(
          (a, b) =>
            Number(b.connector.status === 'connected') - Number(a.connector.status === 'connected') ||
            b.connector.usage.calls - a.connector.usage.calls,
        )
        .slice(0, 3),
    [rows],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (tab === ENABLED_TAB && r.actions.length === 0) return false;
      if (tab !== ALL_TAB && tab !== ENABLED_TAB && r.connector.category !== tab) return false;
      if (!q) return true;
      return `${r.connector.name} ${r.connector.description} ${CATEGORY_LABEL.get(r.connector.category) ?? ''}`.toLowerCase().includes(q);
    });
  }, [rows, tab, query]);

  if (connectors.isLoading) return <LoadingState label="Loading connectors…" />;
  if (connectors.isError) {
    return <ErrorState title="Couldn’t load connectors" description={errorMessage(connectors.error, '')} onRetry={() => connectors.refetch()} />;
  }

  const remove = async (connector: ConnectorSummary) => {
    if (!activeWorkspace) return;
    const ok = await confirm({
      title: `Remove ${connector.name} from ${agent.name}?`,
      description: `${agent.name} won’t be able to use ${connector.name} any more. The connection itself stays.`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    setBusy(connector.provider);
    try {
      await detachConnectorFromAgent(activeWorkspace.id, agent, connector);
      toast.success(`${connector.name} removed from ${agent.name}.`);
      onChanged();
    } catch (error) {
      toast.error(errorMessage(error, `Couldn’t remove ${connector.name}.`));
    } finally {
      setBusy(null);
    }
  };

  /** What clicking an app does: pick its actions when connected, otherwise go connect it. */
  const openApp = (c: ConnectorSummary) => {
    if (c.status === 'unavailable') return;
    if (c.status === 'connected') setAdding(c);
    else navigate(`/connectors/${c.slug}`);
  };

  const tabs = [
    { id: ALL_TAB, label: 'All' },
    ...(enabledCount ? [{ id: ENABLED_TAB, label: `Enabled · ${enabledCount}` }] : []),
    ...categories.map((c) => ({ id: c.id as string, label: c.label })),
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-8 sm:px-6">
        <header className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Apps</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {agent.name} acts through each connection with its owner’s permissions. Write actions follow its approval rules.
            </p>
          </div>
          <AgentGroupsMenu agent={agent} onChanged={onChanged} />
          <Button
            variant="link"
            size="xs"
            type="button"
            onClick={() => navigate('/connectors')}
            className="h-auto shrink-0 gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            All connectors <ExternalLink className="size-3" aria-hidden="true" />
          </Button>
        </header>

        {/* Suggested next apps */}
        {suggested.length > 0 && !query && tab === ALL_TAB && (
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0">
            {suggested.map(({ connector: c }) => (
              <button
                key={c.provider}
                type="button"
                onClick={() => openApp(c)}
                className="group flex min-h-28 w-60 shrink-0 snap-start flex-col justify-between gap-4 rounded-2xl border border-border bg-surface p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-raised sm:w-auto cursor-pointer"
              >
                <AppTile connector={c} />
                <span className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{c.description || `Use ${c.name} from this agent`}</span>
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search apps"
          aria-label="Search apps"
          prefix={<Search className="size-4 text-muted-foreground" aria-hidden="true" />}
          className="h-10 text-sm"
        />

        {/* Category pills */}
        <ResponsiveTabs
          aria-label="App categories"
          variant="pill"
          size="sm"
          value={tab}
          onValueChange={setTab}
          items={tabs.map((t) => ({ value: t.id, label: t.label }))}
        />

        {/* Catalog */}
        {visible.length === 0 ? (
          <EmptyState
            icon={<Search />}
            title={query ? `No apps match “${query.trim()}”` : 'No apps here yet'}
            description={query ? 'Try another name, or look in All.' : 'Give this agent an app from All, and it can read from it and act in it.'}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {visible.map(({ connector: c, actions }) => {
              const enabled = actions.length > 0;
              const unavailable = c.status === 'unavailable';
              return (
                <div
                  key={c.provider}
                  role="button"
                  tabIndex={unavailable ? -1 : 0}
                  aria-disabled={unavailable}
                  onClick={() => openApp(c)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openApp(c);
                    }
                  }}
                  title={unavailable ? c.unavailableReason || 'Not set up on this server yet' : undefined}
                  className={cn(
                    'group flex items-center gap-3 rounded-2xl border border-border bg-surface p-3.5 text-left outline-none transition-colors',
                    'focus-visible:ring-2 focus-visible:ring-primary/50',
                    unavailable ? 'cursor-not-allowed opacity-55' : 'cursor-pointer hover:border-border-strong hover:bg-surface-raised',
                  )}
                >
                  <AppTile connector={c} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-foreground">{c.name}</span>
                      {enabled && c.status !== 'connected' && (
                        <Badge variant="warning" className="shrink-0 text-[10px]">
                          {c.status === 'needs_attention' ? 'Reconnect' : 'Not connected'}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {enabled
                        ? actions.length === c.capabilities.length
                          ? `Every action · ${c.description}`
                          : `${actions.length} of ${c.capabilities.length} actions · ${c.description}`
                        : unavailable
                          ? 'Not set up on this server yet'
                          : c.description || `${c.capabilities.length} actions`}
                    </p>
                  </div>

                  {enabled ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => e.stopPropagation()}
                          aria-label={`Manage ${c.name}`}
                          title="Enabled — manage"
                          disabled={busy === c.provider}
                          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-success transition-colors hover:bg-success/10 cursor-pointer disabled:opacity-50"
                        >
                          <Check className="size-4 stroke-[2.5]" aria-hidden="true" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem disabled={c.status !== 'connected'} onSelect={() => setAdding(c)} className="gap-2 text-xs">
                          <SlidersHorizontal className="size-3.5" /> Change actions
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => navigate(`/connectors/${c.slug}`)} className="gap-2 text-xs">
                          <ExternalLink className="size-3.5" /> Open connector
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => void remove(c)} className="gap-2 text-xs text-destructive focus:text-destructive">
                          <Trash2 className="size-3.5" /> Remove from agent
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : (
                    <span
                      aria-hidden="true"
                      title={c.status === 'connected' ? `Add ${c.name}` : `Connect ${c.name}`}
                      className={cn(
                        'flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg border border-border text-muted-foreground transition-colors',
                        c.status === 'connected' || unavailable ? 'w-8' : 'px-2.5 text-xs font-medium',
                        !unavailable && 'group-hover:border-border-strong group-hover:text-foreground',
                      )}
                    >
                      {c.status === 'connected' || unavailable ? <Plus className="size-4" /> : 'Connect'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-border-strong bg-surface-muted p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Need another app?</p>
            <p className="text-xs text-muted-foreground">
              Connect a new app once and every agent in the workspace can use it. Anything with a REST API works as a custom API.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {!query && (
              <Button type="button" variant="outline" size="sm" onClick={() => setQuery('custom')} className="gap-1.5">
                <Plus className="size-3.5" aria-hidden="true" /> Custom API
              </Button>
            )}
            <Button type="button" size="sm" onClick={() => navigate('/connectors')} className="gap-1.5">
              <ExternalLink className="size-3.5" aria-hidden="true" /> Browse all connectors
            </Button>
          </div>
        </div>

        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Bot className="size-3.5" aria-hidden="true" /> Canvas agents get apps by plugging an app action into the agent’s Tools slot.
        </p>
      </div>

      <AddToAgentDialog
        connector={adding}
        open={!!adding}
        presetAgentId={agent.id}
        onOpenChange={(o) => {
          if (!o) {
            setAdding(null);
            onChanged();
          }
        }}
      />
    </div>
  );
}

function rank(r: AppRow): number {
  if (r.actions.length > 0) return 0;
  if (r.connector.status === 'connected') return 1;
  if (r.connector.status === 'unavailable') return 3;
  return 2;
}

/** The app's logo on a raised square, as in an app store. */
function AppTile({ connector: c }: { connector: ConnectorSummary }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised">
      <AppConnectorIcon connectorId={c.slug} name={c.name} category={c.category} size={22} />
    </span>
  );
}
