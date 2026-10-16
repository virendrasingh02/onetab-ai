import { useState, useEffect, useMemo, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { integrationsApi, queryKeys } from '@org/api-client';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Accent } from '@org/design-system';
import type {
  MarketplaceListing,
  MarketplaceListingDetail,
  MarketplaceInstallation,
} from '@org/types';
import { accentClasses, confirm, toast } from '@org/ui';
import { cn } from '@org/utils';
import { studioWorkspacePath } from '@org/platform';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  useMarketplaceBrowse,
  useMarketplaceInstallations,
  useMarketplaceApprovals,
  useMarketplaceMutations,
} from './marketplace/use-marketplace';
import {
  MarketplaceHeader,
  MarketplaceTabs,
  type MarketplaceActiveTab,
  MarketplaceDiscoverView,
  MarketplaceCatalogView,
  MarketplaceInstalledView,
  MarketplaceWorkspaceView,
  isWorkspaceFilter,
  type WorkspaceFilter,
  openStudioTab,
  useWorkspaceCatalog,
  MarketplaceDeveloperView,
  UniversalInstallModal,
  RequestAccessModal,
  IntegrationConfigModal,
  AppDetailPage,
  AgentDetailPage,
} from './marketplace';
import {
  Bot,
  Brain,
  Code2,
  Globe,
  Layers,
  MessageSquare,
  Rocket,
  Search,
  Shield,
  Sparkles,
} from 'lucide-react';

/* ------------------------------------------------------------- icon presets ---- */

export const PRESET_ICONS: {
  id: string;
  label: string;
  icon: typeof Bot;
  accent: Accent;
}[] = [
  { id: 'icon:bot', label: 'Bot', icon: Bot, accent: 'violet' },
  { id: 'icon:brain', label: 'Brain', icon: Brain, accent: 'pink' },
  { id: 'icon:code', label: 'Code', icon: Code2, accent: 'blue' },
  { id: 'icon:spark', label: 'Spark', icon: Sparkles, accent: 'amber' },
  { id: 'icon:shield', label: 'Shield', icon: Shield, accent: 'green' },
  { id: 'icon:search', label: 'Search', icon: Search, accent: 'cyan' },
  { id: 'icon:chat', label: 'Chat', icon: MessageSquare, accent: 'indigo' },
  { id: 'icon:rocket', label: 'Rocket', icon: Rocket, accent: 'rose' },
  { id: 'icon:globe', label: 'Globe', icon: Globe, accent: 'teal' },
  { id: 'icon:layers', label: 'Layers', icon: Layers, accent: 'orange' },
];

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
  const sizeClasses = {
    sm: 'size-7 text-xs',
    md: 'size-9 text-sm',
    lg: 'size-12 text-base',
  };

  const iconSizes = {
    sm: 'size-3.5',
    md: 'size-4.5',
    lg: 'size-6',
  };

  if (
    avatarUrl &&
    (avatarUrl.startsWith('data:image/') ||
      avatarUrl.startsWith('http://') ||
      avatarUrl.startsWith('https://'))
  ) {
    return (
      <div
        className={cn(
          'relative shrink-0 overflow-hidden rounded-lg border border-border/80 bg-surface shadow-xs',
          sizeClasses[size],
          className,
        )}
      >
        <img src={avatarUrl} alt={name} className="size-full object-cover" />
      </div>
    );
  }

  const preset =
    PRESET_ICONS.find((p) => p.id === avatarUrl) || PRESET_ICONS[0];
  const IconComponent = preset.icon;

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center rounded-lg border shadow-xs transition-transform',
        accentClasses[preset.accent].soft,
        accentClasses[preset.accent].border,
        sizeClasses[size],
        className,
      )}
    >
      <IconComponent className={iconSizes[size]} aria-hidden />
    </div>
  );
}

/* ------------------------------------------------------------- main view ---- */

export interface AgentMarketplaceViewProps {
  /**
   * Renders the coworker creation dialog. Coworkers live in a library above
   * this one, so the app supplies it; without it the "New coworker" button is hidden.
   */
  renderCoworkerCreate?: (props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    workspaceId: string;
  }) => ReactNode;
  /**
   * Renders the live connectors (Gmail, GitHub, Jira, Stripe…: connect,
   * sync, disconnect) at the top of "Apps & Integrations". They live in
   * `@org/web-integrations`, so the app supplies them; without it the tab
   * lists marketplace apps only.
   */
  renderIntegrations?: (props: { searchQuery: string }) => ReactNode;
}

export function AgentMarketplaceView({
  renderCoworkerCreate,
  renderIntegrations,
}: AgentMarketplaceViewProps = {}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { workspace, workspaceId, slug } = useCurrentWorkspace();

  const activeWorkspaceId = workspaceId || '';
  const activeWorkspaceSlug = slug || 'default';
  const activeWorkspaceName = workspace?.name || 'My Workspace';

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

  const rawType = searchParams.get('type');
  const workspaceFilter: WorkspaceFilter = isWorkspaceFilter(rawType)
    ? rawType
    : 'all';
  const [coworkerCreateOpen, setCoworkerCreateOpen] = useState(
    searchParams.get('create') === 'coworker',
  );

  // The sidebar's "Add coworker" can arrive while the marketplace is already open.
  const createParam = searchParams.get('create');
  useEffect(() => {
    if (createParam === 'coworker') setCoworkerCreateOpen(true);
  }, [createParam]);

  const handleWorkspaceFilterChange = (next: WorkspaceFilter) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next === 'all') params.delete('type');
      else params.set('type', next);
      params.delete('create');
      return params;
    });
  };

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
      new Set(
        (providersQuery.data ?? []).map((p) => p.provider.toLowerCase()),
      ),
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
  const catalog = useWorkspaceCatalog(activeWorkspaceId, installations);

  // Active detail page selection
  const selectedAppListing = useMemo(() => {
    if (!urlApp) return null;
    return listings.find((l) => l.slug === urlApp) || null;
  }, [urlApp, listings]);

  const selectedAgentListing = useMemo(() => {
    if (!urlAgent) return null;
    return listings.find((l) => l.slug === urlAgent) || null;
  }, [urlAgent, listings]);

  const pendingApprovalsCount = approvals.filter(
    (a) => a.approvalStatus === 'PENDING',
  ).length;

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

  const handleStartChatForInstalledAgent = (
    agentSlug: string,
    prompt?: string,
  ) => {
    const inst = installations.find((i) => i.listingSlug === agentSlug);
    if (inst) {
      handleOpenChat(inst.id, prompt);
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
            workspaceCount={catalog.items.length}
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
              onRequestAccess={() =>
                setRequestAccessListing(selectedAgentListing)
              }
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
                  onRequestAccess={(l) => setRequestAccessListing(l)}
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
                <section aria-labelledby="mkt-connect-heading" className="space-y-1">
                  <h2
                    id="mkt-connect-heading"
                    className="text-sm font-semibold text-foreground"
                  >
                    Connect your tools
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Sign in once and agents, search and chat can work with
                    them.
                  </p>
                  <div className="pt-3">{renderIntegrations({ searchQuery })}</div>
                </section>
              )}

              {activeTab === 'apps' && renderIntegrations && showMarketplaceApps && (
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
                  onRequestAccess={(l) => setRequestAccessListing(l)}
                  onConfigure={(l) => {
                    const inst = installations.find(
                      (i) => i.listingSlug === l.slug,
                    );
                    if (inst) setConfigModalItem(inst);
                  }}
                />
              )}

              {activeTab === 'agents' && (
                <MarketplaceCatalogView
                  listings={listings}
                  kind="AGENT"
                  searchQuery={searchQuery}
                  onSelectListing={handleSelectListing}
                  onInstall={(l) => setInstallModalListing(l)}
                  onRequestAccess={(l) => setRequestAccessListing(l)}
                  onConfigure={(l) => {
                    const inst = installations.find(
                      (i) => i.listingSlug === l.slug,
                    );
                    if (inst) setConfigModalItem(inst);
                  }}
                />
              )}

              {activeTab === 'installed' && (
                <MarketplaceInstalledView
                  installations={installations}
                  approvals={approvals}
                  isAdmin={true}
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
              )}

              {activeTab === 'workspace' && (
                <MarketplaceWorkspaceView
                  filter={workspaceFilter}
                  onFilterChange={handleWorkspaceFilterChange}
                  onCreateCoworker={
                    renderCoworkerCreate
                      ? () => setCoworkerCreateOpen(true)
                      : undefined
                  }
                  items={catalog.items}
                  isLoading={catalog.isLoading}
                  workspaceSlug={activeWorkspaceSlug}
                  searchQuery={searchQuery}
                  onOpenStudio={handleOpenStudio}
                  onConfigure={(inst) => setConfigModalItem(inst)}
                  onOpenListing={(slug, kind) =>
                    setSearchParams((prev) => {
                      const next = new URLSearchParams(prev);
                      next.set(kind === 'AGENT' ? 'agent' : 'app', slug);
                      return next;
                    })
                  }
                  onBrowse={() => handleTabChange('apps')}
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

      {renderCoworkerCreate?.({
        open: coworkerCreateOpen,
        onOpenChange: (open) => {
          setCoworkerCreateOpen(open);
          if (!open && searchParams.get('create')) {
            setSearchParams((prev) => {
              const params = new URLSearchParams(prev);
              params.delete('create');
              return params;
            });
          }
        },
        workspaceId: activeWorkspaceId,
      })}

      {/* Universal 5-step Install Modal */}
      {installModalListing && (
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
