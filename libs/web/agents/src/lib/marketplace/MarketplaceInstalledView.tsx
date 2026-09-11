import React, { useState, useMemo } from 'react';
import type { MarketplaceInstallation } from '@org/types';
import {
  Button,
  Card,
  EmptyState,
  Switch,
} from '@org/ui';
import { renderEntityIcon } from './MarketplaceCard';
import {
  Check,
  Settings,
  ShieldAlert,
  Trash2,
  XCircle,
} from 'lucide-react';
import { cn } from '@org/utils';

interface MarketplaceInstalledViewProps {
  installations: MarketplaceInstallation[];
  approvals: MarketplaceInstallation[];
  isAdmin: boolean;
  onConfigure: (installation: MarketplaceInstallation) => void;
  onToggleEnabled: (slug: string, enabled: boolean) => void;
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
  const [filter, setFilter] = useState<'all' | 'active' | 'disabled' | 'agents' | 'apps'>('all');
  const [confirmUninstallSlug, setConfirmUninstallSlug] = useState<string | null>(null);

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
    <div className="space-y-8 py-3">
      {/* Admin Approval Queue Section (if admin or if there are requests) */}
      {isAdmin && pendingApprovals.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="size-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
                <ShieldAlert className="size-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground">
                  Pending Access Requests ({pendingApprovals.length})
                </h3>
                <p className="text-xs text-muted-foreground">
                  Workspace members have requested the following apps or agents. Review and grant permissions.
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-amber-500/20 rounded-xl border border-amber-500/20 bg-surface overflow-hidden">
            {pendingApprovals.map((req) => {
              const reqSlug = req.listingSlug || req.listing?.slug || '';
              const reqName = req.name || req.listing?.name || 'Integration';
              const reqKind = req.kind || req.listing?.kind || 'INTEGRATION';
              const reqIcon = req.iconUrl || req.listing?.iconUrl || undefined;

              return (
                <div
                  key={req.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {renderEntityIcon(reqIcon, reqKind, 'size-10')}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-semibold text-sm text-foreground">
                          {reqName}
                        </h4>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          {reqKind === 'AGENT' ? 'AI Agent' : 'Integration'}
                        </span>
                      </div>

                      <p className="text-xs text-muted-foreground mt-0.5">
                        Requested by{' '}
                        <span className="font-medium text-foreground">
                          {req.requesterName || req.requestedBy || 'Team member'}
                        </span>
                      </p>

                      {req.requestReason && (
                        <p className="text-xs italic text-muted-foreground/90 mt-1 bg-surface-raised/50 px-2.5 py-1 rounded-md border border-border/60">
                          "{req.requestReason}"
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-auto flex-shrink-0">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => onReject(reqSlug)}
                      className="text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 border-rose-500/30"
                    >
                      <XCircle className="size-3.5 mr-1" />
                      Reject
                    </Button>
                    <Button
                      variant="primary"
                      size="xs"
                      onClick={() => onApprove(reqSlug)}
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Check className="size-3.5 mr-1" />
                      Approve & Install
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center justify-between gap-4 border-b border-border/60 pb-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'All Installed', count: installations.length },
            {
              id: 'active',
              label: 'Active',
              count: installations.filter((i) => i.enabled).length,
            },
            {
              id: 'disabled',
              label: 'Disabled',
              count: installations.filter((i) => !i.enabled).length,
            },
            {
              id: 'agents',
              label: 'AI Agents',
              count: installations.filter((i) => i.kind === 'AGENT').length,
            },
            {
              id: 'apps',
              label: 'Apps',
              count: installations.filter((i) => i.kind === 'INTEGRATION').length,
            },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id as any)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5',
                filter === tab.id
                  ? 'bg-surface-raised text-foreground font-semibold border border-border/80 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-surface-raised/40',
              )}
            >
              <span>{tab.label}</span>
              <span className="text-[10px] text-muted-foreground/80 px-1.5 py-0.2 rounded-full bg-muted">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <Button
          variant="outline"
          size="xs"
          onClick={onBrowseMore}
          className="text-xs whitespace-nowrap"
        >
          Browse Directory
        </Button>
      </div>

      {/* Installations Table / List */}
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
                Browse Marketplace
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={() => setFilter('all')}>
                Show all installed
              </Button>
            )
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredInstallations.map((item) => {
            const itemSlug = item.listingSlug || item.listing?.slug || item.listingId;
            const itemName = item.name || item.listing?.name || 'Integration';
            const itemKind = item.kind || item.listing?.kind || 'INTEGRATION';
            const itemIcon = item.iconUrl || item.listing?.iconUrl || undefined;
            const isEnabled = item.enabled ?? (item.status === 'ACTIVE');

            return (
              <Card
                key={item.id || itemSlug}
                className="p-4 flex flex-col justify-between border border-border/80 bg-surface hover:shadow-xs transition-shadow rounded-2xl"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {renderEntityIcon(itemIcon, itemKind, 'size-11')}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-semibold text-sm text-foreground truncate">
                            {itemName}
                          </h4>
                          <span
                            className={cn(
                              'text-[10px] font-semibold px-2 py-0.2 rounded-full border',
                              itemKind === 'AGENT'
                                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
                            )}
                          >
                            {itemKind === 'AGENT' ? 'AI Agent' : 'App'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          Installed {new Date(item.installedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    {/* Enable / Disable toggle */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {isEnabled ? 'Active' : 'Disabled'}
                      </span>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) =>
                          onToggleEnabled(itemSlug, checked)
                        }
                        title={isEnabled ? 'Click to disable' : 'Click to enable'}
                      />
                    </div>
                  </div>

                  {/* Granted scopes or command previews */}
                  {item.grantedScopes && item.grantedScopes.length > 0 && (
                    <div className="mb-4">
                      <p className="text-[11px] font-medium text-muted-foreground mb-1.5">
                        Granted Scopes:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {item.grantedScopes.slice(0, 3).map((scope) => (
                          <span
                            key={scope}
                            className="px-1.5 py-0.5 rounded bg-surface-raised border border-border/60 text-[10px] font-mono text-muted-foreground"
                          >
                            {scope}
                          </span>
                        ))}
                        {item.grantedScopes.length > 3 && (
                          <span className="text-[10px] text-muted-foreground/70 self-center">
                            +{item.grantedScopes.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => onConfigure(item)}
                    className="text-xs"
                  >
                    <Settings className="size-3 mr-1" />
                    Configure
                  </Button>

                  {confirmUninstallSlug === itemSlug ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-rose-500 font-medium">
                        Confirm?
                      </span>
                      <Button
                        variant="destructive"
                        size="xs"
                        className="text-xs"
                        onClick={() => {
                          onUninstall(itemSlug);
                          setConfirmUninstallSlug(null);
                        }}
                      >
                        Yes, Remove
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="text-xs"
                        onClick={() => setConfirmUninstallSlug(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setConfirmUninstallSlug(itemSlug)}
                      className="text-xs text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400"
                    >
                      <Trash2 className="size-3 mr-1" />
                      Uninstall
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
