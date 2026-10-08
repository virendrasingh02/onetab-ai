import { Badge, Button, EmptyState, ErrorState, LoadingState, confirm, toast } from '@org/ui';
import { Bot, ChevronRight, Plug, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

/**
 * The apps this agent can act in. Giving it an app links the connection (that
 * is what the runtime offers the model) and, when only some actions are
 * picked, narrows that app to them — the agent's built-in tools are untouched.
 */
export function AgentConnectorsTab({ agent, onChanged }: { agent: AgentWithApps; onChanged: () => void }) {
  const navigate = useNavigate();
  const { activeWorkspace } = useStudioSession();
  const connectors = useConnectors();
  const [adding, setAdding] = useState<ConnectorSummary | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const { attached, available } = useMemo(() => {
    const all = connectors.data ?? [];
    const attached = all
      .map((c) => ({ connector: c, actions: agentConnectorActions(agent, c) }))
      .filter((x) => x.actions.length > 0);
    const attachedSet = new Set(attached.map((x) => x.connector.provider));
    return { attached, available: all.filter((c) => !attachedSet.has(c.provider) && c.capabilities.length > 0) };
  }, [connectors.data, agent]);

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

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Apps this agent can use</h2>
            <p className="text-xs text-muted-foreground">It acts through each connection with its owner’s permissions. Write actions follow its approval rules.</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => navigate('/connectors')}>
            All connectors
          </Button>
        </div>
        {attached.length === 0 ? (
          <EmptyState
            icon={<Plug />}
            title="No apps yet"
            description="Give this agent an app below, and it can read from it and act in it when a task needs it."
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {attached.map(({ connector: c, actions }) => (
              <div key={c.provider} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised">
                      <AppConnectorIcon connectorId={c.slug} name={c.name} category={c.category} size={22} />
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-foreground">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {actions.length === c.capabilities.length ? 'Every action' : `${actions.length} of ${c.capabilities.length} actions`}
                      </div>
                    </div>
                  </div>
                  {c.status !== 'connected' && <Badge variant="warning">Connection {c.status === 'needs_attention' ? 'broken' : 'missing'}</Badge>}
                </div>
                <div className="mt-3 flex flex-wrap gap-1">
                  {c.capabilities
                    .filter((cap) => actions.includes(cap.id))
                    .slice(0, 6)
                    .map((cap) => (
                      <span key={cap.id} className="rounded-md border border-border bg-surface-raised px-1.5 py-0.5 text-[10px] text-foreground">
                        {cap.label}
                      </span>
                    ))}
                  {actions.length > 6 && <span className="text-[10px] text-muted-foreground">+{actions.length - 6} more</span>}
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
                  <Button size="xs" variant="outline" onClick={() => setAdding(c)} disabled={c.status !== 'connected'}>
                    Change actions
                  </Button>
                  <Button size="xs" variant="ghost" onClick={() => navigate(`/connectors/${c.slug}`)}>
                    Open <ChevronRight className="ml-0.5 size-3" aria-hidden="true" />
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => remove(c)}
                    loading={busy === c.provider}
                    aria-label={`Remove ${c.name} from ${agent.name}`}
                  >
                    <Trash2 className="size-3.5 text-destructive" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Add an app</h2>
        {available.length === 0 ? (
          <p className="text-xs text-muted-foreground">Every app with actions is already available to this agent.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((c) => (
              <div key={c.provider} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <AppConnectorIcon connectorId={c.slug} name={c.name} category={c.category} size={20} />
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium text-foreground">{c.name}</div>
                    <div className="text-[10px] text-muted-foreground">{c.capabilities.length} actions</div>
                  </div>
                </div>
                {c.status === 'connected' ? (
                  <Button size="xs" variant="outline" onClick={() => setAdding(c)}>
                    <Plus className="mr-0.5 size-3" aria-hidden="true" /> Add
                  </Button>
                ) : c.status === 'unavailable' ? (
                  <span className="text-[10px] text-muted-foreground">Not set up</span>
                ) : (
                  <Button size="xs" variant="ghost" onClick={() => navigate(`/connectors/${c.slug}`)}>
                    Connect
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Bot className="size-3.5" aria-hidden="true" /> Canvas agents get apps by plugging an app action into the agent’s Tools slot.
        </p>
      </section>

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
