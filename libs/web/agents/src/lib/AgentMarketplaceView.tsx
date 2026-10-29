import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { integrationsApi, queryKeys } from '@org/api-client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type {
  MarketplaceListing,
  MarketplaceListingDetail,
  MarketplaceInstallation,
} from '@org/types';
import { AiEntityAvatar, confirm, toast } from '@org/ui';
import { studioWorkspacePath } from '@org/platform';
import {
  useCurrentWorkspace,
  useWorkspacePermission,
} from '@org/web-workspace';
import { useCurrentUser } from '@org/auth';
import { WorkspacePermission } from '@org/types';
import {
  useMarketplaceBrowse,
  useMarketplaceInstallations,
  useMarketplaceApprovals,
  useMarketplaceMutations,
} from './marketplace/use-marketplace';
import { useAgentApprovals } from './marketplace/use-agent-install';
import { useAgents } from './use-agents';
import {
  MarketplaceHeader,
  MarketplaceTabs,
  type MarketplaceActiveTab,
  MarketplaceDiscoverView,
  MarketplaceCatalogView,
  MarketplaceInstalledView,
  MarketplaceWorkspaceView,
  MarketplaceWorkspaceAgentsView,
  openStudioTab,
  useWorkspaceCoworkers,
  MarketplaceDeveloperView,
  UniversalInstallModal,
  AgentInstallDialog,
  AgentInstallsSection,
  AgentAdminPanel,
  RequestAccessModal,
  IntegrationConfigModal,
  AppDetailPage,
  AgentDetailPage,
} from './marketplace';

/* --------------------------------------------------------------- avatar ---- */

export function AgentAvatar({
  avatarUrl,
  name,
  className,
  size = 'md',
}: {
  avatarUrl?: string | null;
  name: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  // Same tile as the sidebar and chat: one round, primary-toned agent identity.
  return (
    <AiEntityAvatar
      kind="agent"
      name={name}
      avatarUrl={avatarUrl}
      size={size}
      className={className}
    />
  );
}

/* ------------------------------------------------------------- main view ---- */

export interface AgentMarketplaceViewProps {
  /**
   * Renders the live connectors (Gmail, GitHub, Jira, Stripe…: connect,
   * sync, disconnect) at the top of "Apps & Integrations". They live in
   * `@org/web-integrations`, so the app supplies them; without it the tab
   * lists marketplace apps only.
   */
  renderIntegrations?: (props: { searchQuery: string }) => ReactNode;
}

export function AgentMarketplaceView({
  renderIntegrations,
}: AgentMarketplaceViewProps = {}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { workspace, workspaceId, slug } = useCurrentWorkspace();

  const activeWorkspaceId = workspaceId || '';
  const activeWorkspaceSlug = slug || 'default';
  const activeWorkspaceName = workspace?.name || 'My Workspace';
  const { can } = useWorkspacePermission();
  const canManage = can(WorkspacePermission.MANAGE_SETTINGS);
  const currentUser = useCurrentUser();

  // Read URL query params
  const rawTab = searchParams.get('tab');
  // `my-agents` / `my-apps` were folded into the combined workspace view;
  // the Integration Hub was folded into "Apps & Integrations".
  const urlTab =
    (rawTab === 'my-agents' || rawTab === 'my-apps'
      ? 'workspace'
      : rawTab === 'integrations'
        ? 'apps'
        : (rawTab as MarketplaceActiveTab | null)) || 'discover';
  const urlApp = searchParams.get('app');
  const urlAgent = searchParams.get('agent');
  const urlQuery = searchParams.get('q') || '';

  const [activeTab, setActiveTab] = useState<MarketplaceActiveTab>(urlTab);
  const [searchQuery, setSearchQuery] = useState(urlQuery);

  // Sync tab state with URL
  useEffect(() => {
    if (urlTab && urlTab !== activeTab) {
      setActiveTab(urlTab);
    }
  }, [urlTab]);

  const handleTabChange = (nextTab: MarketplaceActiveTab) => {
    setActiveTab(nextTab);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', nextTab);
      next.delete('app');
      next.delete('agent');
      return next;
    });
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (query) {
        next.set('q', query);
      } else {
        next.delete('q');
      }
      return next;
    });
  };

  // Queries
  const browseQuery = useMarketplaceBrowse(
    { search: searchQuery, pageSize: 50 },
    activeWorkspaceId,
  );
  const installationsQuery = useMarketplaceInstallations(activeWorkspaceId);
  const approvalsQuery = useMarketplaceApprovals(activeWorkspaceId);

  // Mutations
  const {
    install,
    uninstall,
    setEnabled,
    updateSettings,
    requestAccess,
    resolveApproval,
    publishCustom,
  } = useMarketplaceMutations(activeWorkspaceId);

  // Modals state
  const [installModalListing, setInstallModalListing] =
    useState<MarketplaceListing | null>(null);
  const [requestAccessListing, setRequestAccessListing] =
    useState<MarketplaceListing | null>(null);
  const [configModalItem, setConfigModalItem] =
    useState<MarketplaceInstallation | null>(null);

  /*
   * The connectors the backend can really connect (same query and cache as
   * the Integration Hub). A marketplace INTEGRATION listing for one of them
   * (the seeded GitHub, Slack, Jira…) would only record an "install" without
   * connecting anything, so it's hidden in favour of the live connector card.
   */
  const providersQuery = useQuery({
    queryKey: queryKeys.integrations.providers(activeWorkspaceId),
    queryFn: () => integrationsApi.getProviders(activeWorkspaceId),
    enabled: Boolean(activeWorkspaceId) && Boolean(renderIntegrations),
    staleTime: 60_000,
  });
  const connectorIds = useMemo(
    () =>
      new Set((providersQuery.data ?? []).map((p) => p.provider.toLowerCase())),
    [providersQuery.data],
  );
  const allListings = browseQuery.data?.items || [];
  const listings = useMemo(
    () =>
      allListings.filter(
        (l) =>
          l.kind !== 'INTEGRATION' ||
          !connectorIds.has(l.slug.toLowerCase().replace(/-/g, '_')),
      ),
    [allListings, connectorIds],
  );
  // With the live connectors above it, the marketplace-apps list only shows
  // when there's something in it.
  const showMarketplaceApps =
    !renderIntegrations ||
    browseQuery.isLoading ||
    listings.some((l) => l.kind === 'INTEGRATION');
  const installations = installationsQuery.data || [];
  const approvals = approvalsQuery.data || [];
  const workspaceCoworkers = useWorkspaceCoworkers(activeWorkspaceId);
  // The same published-agent list the sidebar's "AI Agents" section reads.
  const workspaceAgents = useAgents(activeWorkspaceId || undefined);
  const workspaceAgentList = workspaceAgents.data ?? [];

  // Active detail page selection
  const selectedAppListing = useMemo(() => {
    if (!urlApp) return null;
    return listings.find((l) => l.slug === urlApp) || null;
  }, [urlApp, listings]);

  const selectedAgentListing = useMemo(() => {
    if (!urlAgent) return null;
    return listings.find((l) => l.slug === urlAgent) || null;
  }, [urlAgent, listings]);

  const agentApprovals = useAgentApprovals(activeWorkspaceId, canManage);
  const pendingApprovalsCount =
    approvals.filter(
      (a) => a.approvalStatus === 'PENDING' && a.kind !== 'AGENT',
    ).length + (agentApprovals.data?.length ?? 0);

  // Handlers
  const handleSelectListing = (listing: MarketplaceListing) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (listing.kind === 'AGENT') {
        next.set('agent', listing.slug);
      } else {
        next.set('app', listing.slug);
      }
      return next;
    });
  };

  const handleBackToDirectory = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('app');
      next.delete('agent');
      return next;
    });
  };

  /** Agents and automations are built in the standalone AI Agent Studio. */
  const handleOpenStudio = (path?: string) =>
    openStudioTab(path ?? studioWorkspacePath(activeWorkspaceSlug));

  const handleOpenChat = (agentId: string, prompt?: string) => {
    if (prompt) {
      navigate(
        `/w/${activeWorkspaceSlug}/agents/${agentId}/chat?prompt=${encodeURIComponent(
          prompt,
        )}`,
      );
    } else {
      navigate(`/w/${activeWorkspaceSlug}/agents/${agentId}/chat`);
    }
  };

  /** Agents go through the install lifecycle (which also handles requests); apps keep the access-request modal. */
  const handleRequestAccess = (listing: MarketplaceListing) => {
    if (listing.kind === 'AGENT') setInstallModalListing(listing);
    else setRequestAccessListing(listing);
  };

  const handleStartChatForInstalledAgent = (
    agentSlug: string,
    prompt?: string,
  ) => {
    const inst = installations.find(
      (i) => i.listingSlug === agentSlug && i.status === 'ACTIVE' && i.agentId,
    );
    if (inst?.agentId) {
      handleOpenChat(inst.agentId, prompt);
    } else {
      toast.info('Please install the agent first to start chatting.');
      const l = listings.find((x) => x.slug === agentSlug);
      if (l) setInstallModalListing(l);
    }
  };

  const handleInstallConfirm = async (input: {
    listingSlug: string;
    grantedScopes: string[];
    settings: Record<string, unknown>;
  }) => {
    await install.mutateAsync(input);
  };

  const handleRequestAccessConfirm = async (reason: string) => {
    if (!requestAccessListing) return;
    await requestAccess.mutateAsync({
      slug: requestAccessListing.slug,
      reason,
    });
  };

  /** Removing an app cuts its access to the workspace, so it is always confirmed. */
  const handleUninstall = async (slug: string) => {
    const installation = installations.find(
      (i) => (i.listingSlug || i.listing?.slug) === slug,
    );
    const name =
      installation?.name ||
      installation?.listing?.name ||
      listings.find((l) => l.slug === slug)?.name ||
      'this item';
    const confirmed = await confirm({
      title: `Uninstall ${name}?`,
      description:
        'It loses access to this workspace right away. You can install it again later.',
      confirmLabel: 'Uninstall',
      destructive: true,
    });
    if (confirmed) uninstall.mutate(slug);
  };

  const handleSaveSettingsConfirm = async (
    slug: string,
    settings: Record<string, unknown>,
  ) => {
    await updateSettings.mutateAsync({ slug, settings });
  };

  const handlePublishCustomListing = async (data: any) => {
    await publishCustom.mutateAsync(data);
    handleTabChange('discover');
  };

  const showDirectory = !selectedAppListing && !selectedAgentListing;

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      {/* The shared PageBar + PageTabBar every sidebar destination uses. */}
      {showDirectory && (
        <>
          <MarketplaceHeader
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            pendingApprovalsCount={pendingApprovalsCount}
            onOpenApprovals={() => handleTabChange('installed')}
            onOpenStudio={() => handleOpenStudio()}
          />
          <MarketplaceTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
            installedCount={installations.length}
            workspaceCount={workspaceCoworkers.coworkers.length}
            agentsCount={workspaceAgentList.length}
          />
        </>
      )}

      {/* Full-width scroll area: the scrollbar sits on the page edge. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-3 sm:px-6 py-3 sm:py-4 w-full">
          {/* If viewing App Detail */}
          {selectedAppListing ? (
            <AppDetailPage
              app={selectedAppListing as MarketplaceListingDetail}
              onBack={handleBackToDirectory}
              onInstall={() => setInstallModalListing(selectedAppListing)}
              onRequestAccess={() =>
                setRequestAccessListing(selectedAppListing)
              }
              onConfigure={() => {
                const inst = installations.find(
                  (i) => i.listingSlug === selectedAppListing.slug,
                );
                if (inst) setConfigModalItem(inst);
              }}
              onUninstall={() => handleUninstall(selectedAppListing.slug)}
            />
          ) : selectedAgentListing ? (
            /* If viewing Agent Detail */
            <AgentDetailPage
              agent={selectedAgentListing as MarketplaceListingDetail}
              onBack={handleBackToDirectory}
              onInstall={() => setInstallModalListing(selectedAgentListing)}
              onRequestAccess={() => handleRequestAccess(selectedAgentListing)}
              onConfigure={() => {
                const inst = installations.find(
                  (i) => i.listingSlug === selectedAgentListing.slug,
                );
                if (inst) setConfigModalItem(inst);
              }}
              onUninstall={() => handleUninstall(selectedAgentListing.slug)}
              onStartChat={(prompt) =>
                handleStartChatForInstalledAgent(
                  selectedAgentListing.slug,
                  prompt,
                )
              }
            />
          ) : (
            /* Standard Unified Directory View */
            <div className="space-y-4">
              {/* Sub-tab Views */}
              {activeTab === 'discover' && (
                <MarketplaceDiscoverView
                  listings={listings}
                  isLoading={browseQuery.isLoading}
                  onSelectListing={handleSelectListing}
                  onInstall={(l) => setInstallModalListing(l)}
                  onRequestAccess={handleRequestAccess}
                  onConfigure={(l) => {
                    const inst = installations.find(
                      (i) => i.listingSlug === l.slug,
                    );
                    if (inst) setConfigModalItem(inst);
                  }}
                  onViewAllApps={() => handleTabChange('apps')}
                  onViewAllAgents={() => handleTabChange('agents')}
                />
              )}

              {activeTab === 'apps' && renderIntegrations && (
                <section
                  aria-labelledby="mkt-connect-heading"
                  className="space-y-1"
                >
                  <h2
                    id="mkt-connect-heading"
                    className="text-sm font-semibold text-foreground"
                  >
                    Connect your tools
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Sign in once and agents, search and chat can work with them.
                  </p>
                  <div className="pt-3">
                    {renderIntegrations({ searchQuery })}
                  </div>
                </section>
              )}

              {activeTab === 'apps' &&
                renderIntegrations &&
                showMarketplaceApps && (
                  <h2 className="pt-4 text-sm font-semibold border-t border-border/60 text-foreground">
                    More apps from the Marketplace
                  </h2>
                )}

              {activeTab === 'apps' && showMarketplaceApps && (
                <MarketplaceCatalogView
                  listings={listings}
                  kind="INTEGRATION"
                  searchQuery={searchQuery}
                  onSelectListing={handleSelectListing}
                  onInstall={(l) => setInstallModalListing(l)}
                  onRequestAccess={handleRequestAccess}
                  onConfigure={(l) => {
                    const inst = installations.find(
                      (i) => i.listingSlug === l.slug,
                    );
                    if (inst) setConfigModalItem(inst);
                  }}
                />
              )}

              {activeTab === 'agents' && (
                <section
                  aria-labelledby="mkt-ws-agents-heading"
                  className="space-y-1"
                >
                  <h2
                    id="mkt-ws-agents-heading"
                    className="text-sm font-semibold text-foreground"
                  >
                    In this workspace
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Every agent your team has installed or built in the AI Agent
                    Studio, as listed in the sidebar.
                  </p>
                  <div className="pt-3">
                    <MarketplaceWorkspaceAgentsView
                      agents={workspaceAgentList}
                      isLoading={workspaceAgents.isLoading}
                      isError={workspaceAgents.isError}
                      onRetry={() => void workspaceAgents.refetch()}
                      workspaceSlug={activeWorkspaceSlug}
                      searchQuery={searchQuery}
                      onOpenStudio={handleOpenStudio}
                    />
                  </div>
                </section>
              )}

              {activeTab === 'agents' && (
                <h2 className="pt-4 text-sm font-semibold border-t border-border/60 text-foreground">
                  More agents from the Marketplace
                </h2>
              )}

              {activeTab === 'agents' && (
                <MarketplaceCatalogView
                  listings={listings}
                  kind="AGENT"
                  searchQuery={searchQuery}
                  onSelectListing={handleSelectListing}
                  onInstall={(l) => setInstallModalListing(l)}
                  onRequestAccess={handleRequestAccess}
                  onConfigure={(l) => {
                    const inst = installations.find(
                      (i) => i.listingSlug === l.slug,
                    );
                    if (inst) setConfigModalItem(inst);
                  }}
                />
              )}

              {activeTab === 'installed' && (
                <div className="space-y-8 py-3">
                  <section
                    aria-labelledby="installed-agents-heading"
                    className="space-y-3"
                  >
                    <h2
                      id="installed-agents-heading"
                      className="text-sm font-semibold text-foreground"
                    >
                      AI agents
                    </h2>
                    <AgentInstallsSection
                      workspace={{
                        id: activeWorkspaceId,
                        slug: activeWorkspaceSlug,
                      }}
                      currentUserId={currentUser?.id}
                      canManage={canManage}
                      onOpenChat={(agentId) => handleOpenChat(agentId)}
                      onRetry={(inst) => setInstallModalListing(inst.listing)}
                      onBrowse={() => handleTabChange('discover')}
                    />
                  </section>

                  {canManage && (
                    <AgentAdminPanel workspaceId={activeWorkspaceId} />
                  )}

                  <section
                    aria-labelledby="installed-apps-heading"
                    className="space-y-1"
                  >
                    <h2
                      id="installed-apps-heading"
                      className="text-sm font-semibold text-foreground"
                    >
                      Apps &amp; integrations
                    </h2>
                    <MarketplaceInstalledView
                      installations={installations.filter(
                        (i) => i.kind !== 'AGENT',
                      )}
                      approvals={approvals.filter((a) => a.kind !== 'AGENT')}
                      isAdmin={canManage}
                      onConfigure={(inst) => setConfigModalItem(inst)}
                      onToggleEnabled={(slug, enabled) =>
                        setEnabled.mutate({ slug, enabled })
                      }
                      onUninstall={handleUninstall}
                      onApprove={(slug) =>
                        resolveApproval.mutate({ slug, action: 'APPROVE' })
                      }
                      onReject={(slug, reason) =>
                        resolveApproval.mutate({
                          slug,
                          action: 'REJECT',
                          rejectionReason: reason,
                        })
                      }
                      onBrowseMore={() => handleTabChange('discover')}
                    />
                  </section>
                </div>
              )}

              {activeTab === 'workspace' && (
                <MarketplaceWorkspaceView
                  coworkers={workspaceCoworkers.coworkers}
                  isLoading={workspaceCoworkers.isLoading}
                  isError={workspaceCoworkers.isError}
                  onRetry={workspaceCoworkers.refetch}
                  workspaceSlug={activeWorkspaceSlug}
                  searchQuery={searchQuery}
                  onOpenStudio={handleOpenStudio}
                />
              )}

              {activeTab === 'developer' && (
                <MarketplaceDeveloperView
                  onPublishCustom={handlePublishCustomListing}
                  isLoading={publishCustom.isPending}
                  onOpenStudio={() => handleOpenStudio()}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Agents: server-confirmed install lifecycle. Apps: the generic 5-step modal. */}
      {installModalListing && installModalListing.kind === 'AGENT' && (
        <AgentInstallDialog
          open
          onClose={() => setInstallModalListing(null)}
          listing={installModalListing}
          workspace={{
            id: activeWorkspaceId,
            name: activeWorkspaceName,
            slug: activeWorkspaceSlug,
          }}
          onOpenChat={(agentId) => {
            setInstallModalListing(null);
            handleOpenChat(agentId);
          }}
        />
      )}
      {installModalListing && installModalListing.kind !== 'AGENT' && (
        <UniversalInstallModal
          isOpen={Boolean(installModalListing)}
          onClose={() => setInstallModalListing(null)}
          listing={installModalListing}
          currentWorkspace={{
            id: activeWorkspaceId,
            name: activeWorkspaceName,
            slug: activeWorkspaceSlug,
          }}
          onInstall={handleInstallConfirm}
        />
      )}

      {/* Request Access Modal */}
      {requestAccessListing && (
        <RequestAccessModal
          isOpen={Boolean(requestAccessListing)}
          onClose={() => setRequestAccessListing(null)}
          listing={requestAccessListing}
          onSubmit={handleRequestAccessConfirm}
        />
      )}

      {/* Integration Configuration Modal */}
      {configModalItem && (
        <IntegrationConfigModal
          isOpen={Boolean(configModalItem)}
          onClose={() => setConfigModalItem(null)}
          installation={configModalItem}
          onSaveSettings={handleSaveSettingsConfirm}
        />
      )}
    </div>
  );
}
