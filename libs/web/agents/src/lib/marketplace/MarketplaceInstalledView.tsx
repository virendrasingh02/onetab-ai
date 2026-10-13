import React, { useState, useMemo } from 'react';
import type { MarketplaceInstallation } from '@org/types';
import { Badge, Button, Card, EmptyState, Switch } from '@org/ui';
import { Check, Settings, ShieldAlert, Trash2, XCircle } from 'lucide-react';
import { EntityIcon, KindBadge, SectionTabs } from './marketplace-ui';

type InstalledFilter = 'all' | 'active' | 'disabled' | 'agents' | 'apps';

interface MarketplaceInstalledViewProps {
  installations: MarketplaceInstallation[];
  approvals: MarketplaceInstallation[];
  isAdmin: boolean;
  onConfigure: (installation: MarketplaceInstallation) => void;
  onToggleEnabled: (slug: string, enabled: boolean) => void;
  /** The parent confirms before removing; this just reports the intent. */
  onUninstall: (slug: string) => void;
  onApprove: (slug: string) => void;
  onReject: (slug: string, reason?: string) => void;
  onBrowseMore: () => void;
}

export const MarketplaceInstalledView: React.FC<MarketplaceInstalledViewProps> = ({
  installations,
  approvals,
  isAdmin,
  onConfigure,
  onToggleEnabled,
  onUninstall,
  onApprove,
  onReject,
  onBrowseMore,
}) => {
  const [filter, setFilter] = useState<InstalledFilter>('all');

  const filteredInstallations = useMemo(() => {
    return installations.filter((item) => {
      if (filter === 'active' && !item.enabled) return false;
      if (filter === 'disabled' && item.enabled) return false;
      if (filter === 'agents' && item.kind !== 'AGENT') return false;
      if (filter === 'apps' && item.kind !== 'INTEGRATION') return false;
      return true;
    });
  }, [installations, filter]);

  const pendingApprovals = approvals.filter(
    (a) => a.approvalStatus === 'PENDING',
  );

  return (
    <div className="space-y-6 py-3">
      {/* Admin approval queue */}
      {isAdmin && pendingApprovals.length > 0 && (
        <Card className="p-5 gap-4 border-warning/30 bg-warning/5">
          <div className="gap-2.5 flex items-center">
            <div className="size-8 flex items-center justify-center rounded-lg bg-warning/10 text-warning-text">
              <ShieldAlert className="size-4" aria-hidden />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Pending access requests ({pendingApprovals.length})
              </h3>
              <p className="text-xs text-muted-foreground">
                Workspace members have requested the following apps or agents. Review and grant permissions.
              </p>
            </div>
          </div>

          <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
            {pendingApprovals.map((req) => {
              const reqSlug = req.listingSlug || req.listing?.slug || '';
              const reqName = req.name || req.listing?.name || 'Integration';
              const reqKind = req.kind || req.listing?.kind || 'INTEGRATION';
              const reqIcon = req.iconUrl || req.listing?.iconUrl || undefined;

              return (
                <div
                  key={req.id}
                  className="gap-4 p-4 md:flex-row md:items-center flex flex-col justify-between"
                >
                  <div className="min-w-0 gap-3 flex items-start">
                    <EntityIcon iconUrl={reqIcon} kind={reqKind} />
                    <div className="min-w-0">
                      <div className="gap-2 flex items-center">
                        <h4 className="text-sm font-semibold text-foreground">
                          {reqName}
                        </h4>
                        <KindBadge kind={reqKind} />
                      </div>

                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Requested by{' '}
                        <span className="font-medium text-foreground">
                          {req.requesterName || req.requestedBy || 'Team member'}
                        </span>
                      </p>

                      {req.requestReason && (
                        <p className="mt-1 rounded-md border border-border/60 bg-surface-raised/50 px-2.5 py-1 text-xs italic text-muted-foreground">
                          “{req.requestReason}”
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="gap-2 flex shrink-0 items-center self-end md:self-auto">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => onReject(reqSlug)}
                      className="border-destructive/30 text-destructive-text hover:bg-destructive/10"
                    >
                      <XCircle aria-hidden />
                      Reject
                    </Button>
                    <Button
                      variant="success"
                      size="xs"
                      onClick={() => onApprove(reqSlug)}
                    >
                      <Check aria-hidden />
                      Approve & install
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="gap-3 flex items-center justify-between">
        <SectionTabs
          aria-label="Filter installed items"
          value={filter}
          onValueChange={setFilter}
          className="flex-1"
          items={[
            { value: 'all', label: 'All installed', count: installations.length },
            {
              value: 'active',
              label: 'Active',
              count: installations.filter((i) => i.enabled).length,
            },
            {
              value: 'disabled',
              label: 'Disabled',
              count: installations.filter((i) => !i.enabled).length,
            },
            {
              value: 'agents',
              label: 'AI agents',
              count: installations.filter((i) => i.kind === 'AGENT').length,
            },
            {
              value: 'apps',
              label: 'Apps',
              count: installations.filter((i) => i.kind === 'INTEGRATION').length,
            },
          ]}
        />

        <Button variant="outline" size="sm" onClick={onBrowseMore}>
          Browse directory
        </Button>
      </div>

      {/* Installations */}
      {filteredInstallations.length === 0 ? (
        <EmptyState
          title="No installed integrations or agents"
          description={
            filter === 'all'
              ? 'Your workspace has not installed any apps or agents yet. Browse the marketplace to get started.'
              : 'No installed items match the selected filter.'
          }
          action={
            filter === 'all' ? (
              <Button variant="primary" size="sm" onClick={onBrowseMore}>
                Browse marketplace
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setFilter('all')}>
                Show all installed
              </Button>
            )
          }
        />
      ) : (
        <div className="md:grid-cols-2 gap-4 grid grid-cols-1">
          {filteredInstallations.map((item) => {
            const itemSlug = item.listingSlug || item.listing?.slug || item.listingId;
            const itemName = item.name || item.listing?.name || 'Integration';
            const itemKind = item.kind || item.listing?.kind || 'INTEGRATION';
            const itemIcon = item.iconUrl || item.listing?.iconUrl || undefined;
            const isEnabled = item.enabled ?? item.status === 'ACTIVE';
            const scopes = item.grantedScopes ?? [];

            return (
              <Card
                key={item.id || itemSlug}
                className="p-4 justify-between"
              >
                <div>
                  <div className="mb-3 gap-3 flex items-start justify-between">
                    <div className="min-w-0 gap-3 flex items-center">
                      <EntityIcon iconUrl={itemIcon} kind={itemKind} />
                      <div className="min-w-0">
                        <div className="gap-1.5 flex items-center">
                          <h4 className="text-sm font-semibold truncate text-foreground">
                            {itemName}
                          </h4>
                          <KindBadge kind={itemKind} />
                        </div>
                        <p className="text-xs truncate text-muted-foreground">
                          Installed {new Date(item.installedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="gap-2 flex shrink-0 items-center">
                      <span className="text-xs font-medium text-muted-foreground">
                        {isEnabled ? 'Active' : 'Disabled'}
                      </span>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) =>
                          onToggleEnabled(itemSlug, checked)
                        }
                        aria-label={`${isEnabled ? 'Disable' : 'Enable'} ${itemName}`}
                      />
                    </div>
                  </div>

                  {scopes.length > 0 && (
                    <div className="mb-4">
                      <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
                        Granted scopes
                      </p>
                      <div className="gap-1 flex flex-wrap items-center">
                        {scopes.slice(0, 3).map((scope) => (
                          <Badge key={scope} variant="neutral" className="font-mono">
                            {scope}
                          </Badge>
                        ))}
                        {scopes.length > 3 && (
                          <span className="text-[11px] text-muted-foreground">
                            +{scopes.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="gap-2 pt-3 flex items-center justify-between border-t border-border/60">
                  <Button variant="outline" size="xs" onClick={() => onConfigure(item)}>
                    <Settings aria-hidden />
                    Configure
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => onUninstall(itemSlug)}
                    className="hover:text-destructive-text"
                  >
                    <Trash2 aria-hidden />
                    Uninstall
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
