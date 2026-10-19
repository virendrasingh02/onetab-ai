import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ExternalIntegration, IntegrationCapabilities } from '@org/types';
import {
  Badge,
  Button,
  ConnectionCard,
  ConnectionList,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  SearchInput,
  Skeleton,
  toast,
  toConnectionState,
} from '@org/ui';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  IntegrationAppIcon,
  useIntegrationActions,
  useIntegrationMutations,
  useIntegrationProviders,
  useIntegrations,
} from '@org/web-integrations';
import { ExternalLink, Layers, ListChecks, RefreshCw } from 'lucide-react';

/** A workspace connection joined with its provider's registry entry. */
interface ConnectionRow {
  integration: ExternalIntegration;
  id: string;
  name: string;
  description: string;
  capabilities?: IntegrationCapabilities;
}

const CAPABILITY_FLAGS: Array<{ key: keyof IntegrationCapabilities; label: string }> = [
  { key: 'supportsSync', label: 'Data sync' },
  { key: 'supportsWebhooks', label: 'Webhooks' },
  { key: 'supportsMessaging', label: 'Messaging' },
  { key: 'supportsCustomEndpoints', label: 'Custom endpoints' },
];

const PERMISSION_VARIANT = {
  read: 'neutral',
  write: 'info',
  destructive: 'destructive',
} as const;

/**
 * The workspace's linked apps as seen from automations: the same connection
 * data and card as the Integration Hub, plus the actions each app exposes to
 * workflows. Connecting and credentials stay in the Hub.
 */
export function AutomationConnectionsTab() {
  const navigate = useNavigate();
  const { workspaceId, slug } = useCurrentWorkspace();
  const integrations = useIntegrations(workspaceId);
  const providers = useIntegrationProviders(workspaceId);
  const { sync } = useIntegrationMutations(workspaceId);

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ConnectionRow | null>(null);

  const openHub = () => navigate(`/w/${slug}/integrations`);

  const rows = useMemo<ConnectionRow[]>(() => {
    const byProvider = new Map(
      (providers.data ?? []).map((p) => [p.provider.toUpperCase(), p]),
    );
    return (integrations.data ?? [])
      .filter((i) => toConnectionState(i.status) !== 'disconnected')
      .map((integration) => {
        const capabilities = byProvider.get(integration.provider.toUpperCase());
        return {
          integration,
          id: integration.provider.toLowerCase(),
          name: capabilities?.displayName ?? integration.displayName ?? integration.provider,
          description: capabilities?.description ?? '',
          capabilities,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [integrations.data, providers.data]);

  const term = search.trim().toLowerCase();
  const filtered = term
    ? rows.filter((r) =>
        [r.name, r.description, r.capabilities?.category ?? ''].some((v) =>
          v.toLowerCase().includes(term),
        ),
      )
    : rows;

  const syncNow = (row: ConnectionRow) =>
    sync.mutate(row.integration.id, {
      onSuccess: () => toast.success(`${row.name} sync started`),
      onError: (err: unknown) =>
        toast.error(err instanceof Error ? err.message : `Could not sync ${row.name}`),
    });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg text-foreground">App Connections</h3>
          <p className="text-sm text-muted-foreground">
            Apps linked to this workspace and the actions they expose to your automations.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-full sm:w-64">
            <SearchInput
              placeholder="Search connections…"
              value={search}
              onValueChange={setSearch}
            />
          </div>
          <Button size="sm" variant="outline" onClick={openHub}>
            Manage in Hub
            <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
          </Button>
        </div>
      </div>

      <ConnectionList
        isLoading={integrations.isLoading}
        error={integrations.error}
        onRetry={() => void integrations.refetch()}
        isEmpty={filtered.length === 0}
        emptyTitle={term ? 'No matching connections' : 'No connected apps'}
        emptyDescription={
          term
            ? 'Try a different search.'
            : 'Connect an app in the Integration Hub to use it in automations.'
        }
        emptyAction={
          term ? undefined : (
            <Button size="sm" onClick={openHub}>
              Open Integration Hub
            </Button>
          )
        }
      >
        {filtered.map((row) => {
          const state = toConnectionState(row.integration.status);
          const syncing = sync.isPending && sync.variables === row.integration.id;
          return (
            <ConnectionCard
              key={row.integration.id}
              name={row.name}
              description={row.description}
              icon={<IntegrationAppIcon id={row.id} name={row.name} />}
              state={state}
              account={row.integration.displayName}
              lastSyncAt={row.integration.lastSyncAt}
              errorMessage={row.integration.lastErrorMessage}
              permissions={row.integration.scopes}
              onReconnect={openHub}
              actions={
                <>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`View ${row.name} actions`}
                    title="View actions"
                    onClick={() => setSelected(row)}
                  >
                    <ListChecks className="size-3.5" />
                  </Button>
                  {state === 'connected' && row.capabilities?.supportsSync ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Sync ${row.name} now`}
                      title="Sync now"
                      disabled={syncing}
                      onClick={() => syncNow(row)}
                    >
                      <RefreshCw className={`size-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    </Button>
                  ) : null}
                </>
              }
            />
          );
        })}
      </ConnectionList>

      <ConnectionActionsDialog
        workspaceId={workspaceId}
        row={selected}
        onClose={() => setSelected(null)}
        onOpenHub={openHub}
      />
    </div>
  );
}

function ConnectionActionsDialog({
  workspaceId,
  row,
  onClose,
  onOpenHub,
}: {
  workspaceId: string | undefined;
  row: ConnectionRow | null;
  onClose: () => void;
  onOpenHub: () => void;
}) {
  const actions = useIntegrationActions(workspaceId, row?.integration.id);
  const flags = CAPABILITY_FLAGS.filter((f) => row?.capabilities?.[f.key] === true);

  return (
    <Dialog open={!!row} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        {row ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="size-10 p-2 flex shrink-0 items-center justify-center rounded-xl border border-border bg-surface">
                  <IntegrationAppIcon id={row.id} name={row.name} />
                </div>
                <div>
                  <DialogTitle>{row.name}</DialogTitle>
                  {row.integration.displayName ? (
                    <p className="text-xs text-muted-foreground">{row.integration.displayName}</p>
                  ) : null}
                </div>
              </div>
            </DialogHeader>

            <DialogBody className="space-y-4 py-2">
              {row.description ? (
                <p className="text-sm text-muted-foreground leading-relaxed">{row.description}</p>
              ) : null}

              {flags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {flags.map((f) => (
                    <Badge key={f.key} variant="outline" className="rounded-full">
                      {f.label}
                    </Badge>
                  ))}
                </div>
              ) : null}

              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-primary" />
                  Actions
                </h4>
                {actions.isLoading ? (
                  <div className="space-y-1.5">
                    {Array.from({ length: 3 }, (_, i) => (
                      <Skeleton key={i} className="h-12 rounded-md" />
                    ))}
                  </div>
                ) : actions.error ? (
                  <p className="text-sm text-destructive">Could not load actions for this app.</p>
                ) : (actions.data ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">This app exposes no actions.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {actions.data?.map((action) => (
                      <li key={action.id} className="p-2.5 rounded-md bg-muted/40">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium text-foreground">{action.label}</span>
                          <Badge
                            variant={PERMISSION_VARIANT[action.permissionLevel]}
                            className="rounded-full capitalize"
                          >
                            {action.permissionLevel}
                          </Badge>
                        </div>
                        {action.description ? (
                          <p className="text-xs text-muted-foreground mt-0.5">{action.description}</p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </DialogBody>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button onClick={onOpenHub}>Configure in Integration Hub</Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
