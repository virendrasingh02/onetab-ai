import { useState, useMemo, type ReactNode } from 'react';
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
  type DiscoverKind,
  MarketplaceInstalledView,
  MarketplaceWorkspaceStrip,
  useMarketplaceLayout,
  openStudioTab,
  useWorkspaceCoworkers,
  useWorkspaceAutomations,
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

  // Read URL query params. Two tabs remain: "yours" and "discover". The old
  // tabs still resolve, so sidebar links and bookmarks keep working:
  // installed / workspace / my-* -> Yours; agents / apps / integrations ->
  // Discover filtered to that type.
  const rawTab = searchParams.get('tab');
  const rawKind = searchParams.get('kind');
  const activeTab: MarketplaceActiveTab =
    rawTab === 'discover' ||
    rawTab === 'agents' ||
    rawTab === 'apps' ||
    rawTab === 'integrations'
      ? 'discover'
      : rawTab === 'developer'
        ? 'developer'
        : 'yours';
  const discoverKind: DiscoverKind =
    rawTab === 'agents'
      ? 'agents'
      : rawTab === 'apps' || rawTab === 'integrations'
        ? 'apps'
        : rawKind === 'agents' || rawKind === 'apps'
          ? rawKind
          : 'all';
  const urlApp = searchParams.get('app');
  const urlAgent = searchParams.get('agent');
  const urlQuery = searchParams.get('q') || '';

  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [layout, setLayout] = useMarketplaceLayout();

  const handleTabChange = (
    nextTab: MarketplaceActiveTab,
    kind?: DiscoverKind,
  ) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('tab', nextTab);
      if (nextTab === 'discover' && kind && kind !== 'all')
        next.set('kind', kind);
      else next.delete('kind');
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
  const installations = installationsQuery.data || [];
  const approvals = approvalsQuery.data || [];
  const workspaceCoworkers = useWorkspaceCoworkers(activeWorkspaceId);
  // The same published-agent list the sidebar's "AI Agents" section reads.
  const workspaceAgents = useAgents(activeWorkspaceId || undefined);
  const workspaceAgentList = workspaceAgents.data ?? [];
  const workspaceAutomations = useWorkspaceAutomations(activeWorkspaceId);

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
            onOpenApprovals={() => handleTabChange('yours')}
            onOpenStudio={() => handleOpenStudio()}
          />
          <MarketplaceTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
            yoursCount={
              workspaceAgentList.length +
              workspaceCoworkers.coworkers.length +
              (workspaceAutomations.data?.length ?? 0)
            }
            discoverCount={listings.length}
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
                  kind={discoverKind}
                  onKindChange={(kind) => handleTabChange('discover', kind)}
                  searchQuery={searchQuery}
                  layout={layout}
                  onLayoutChange={setLayout}
                  renderIntegrations={renderIntegrations}
                  onSelectListing={handleSelectListing}
                  onInstall={(l) => setInstallModalListing(l)}
                  onRequestAccess={handleRequestAccess}
                  onConfigure={(l) => {
                    const inst = installations.find(
                      (i) => i.listingSlug === l.slug,
                    );
                    if (inst) setConfigModalItem(inst);
                  }}
                  onOpenBuilder={() => handleTabChange('developer')}
                />
              )}

              {activeTab === 'yours' && (
                <div className="space-y-10">
                  <MarketplaceWorkspaceStrip
                    agents={workspaceAgentList}
                    coworkers={workspaceCoworkers.coworkers}
                    automations={workspaceAutomations.data ?? []}
                    isLoading={
                      workspaceAgents.isLoading ||
                      workspaceCoworkers.isLoading ||
                      workspaceAutomations.isLoading
                    }
                    workspaceSlug={activeWorkspaceSlug}
                    searchQuery={searchQuery}
                    onOpenStudio={handleOpenStudio}
                    layout={layout}
                    onLayoutChange={setLayout}
                  />

                  {/* What came from the Marketplace: install lifecycle, requests and apps. */}
                  <section
                    aria-labelledby="installed-heading"
                    className="space-y-6 pt-8 border-t border-border/60"
                  >
                    <div>
                      <h2
                        id="installed-heading"
                        className="text-sm font-semibold text-foreground"
                      >
                        Installed from the Marketplace
                      </h2>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Install status, access requests and app settings.
                      </p>
                    </div>
                    <AgentInstallsSection
                      workspace={{
                        id: activeWorkspaceId,
                        slug: activeWorkspaceSlug,
                      }}
                      currentUserId={currentUser?.id}
                      canManage={canManage}
                      onOpenChat={(agentId) => handleOpenChat(agentId)}
                      onRetry={(inst) => setInstallModalListing(inst.listing)}
                      onBrowse={() => handleTabChange('discover', 'agents')}
                    />

                    {canManage && (
                      <AgentAdminPanel workspaceId={activeWorkspaceId} />
                    )}

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
                      onBrowseMore={() => handleTabChange('discover', 'apps')}
                    />
                  </section>
                </div>
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
