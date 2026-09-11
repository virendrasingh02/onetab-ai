import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { Accent } from '@org/design-system';
import type { MarketplaceListing, MarketplaceListingDetail, MarketplaceInstallation } from '@org/types';
import { accentClasses, toast } from '@org/ui';
import { cn } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import { useAgents, useAgentMutations } from './use-agents';
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
  MarketplaceMyItemsView,
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
        'flex shrink-0 items-center justify-center rounded-lg border transition-transform shadow-xs',
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

export function AgentMarketplaceView() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { workspace, workspaceId, slug } = useCurrentWorkspace();

  const activeWorkspaceId = workspaceId || '';
  const activeWorkspaceSlug = slug || 'default';
  const activeWorkspaceName = workspace?.name || 'My Workspace';

  // Read URL query params
  const urlTab = (searchParams.get('tab') as MarketplaceActiveTab) || 'discover';
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
  const customAgentsQuery = useAgents(activeWorkspaceId);

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

  const { remove: removeCustomAgent } = useAgentMutations(activeWorkspaceId);

  // Modals state
  const [installModalListing, setInstallModalListing] =
    useState<MarketplaceListing | null>(null);
  const [requestAccessListing, setRequestAccessListing] =
    useState<MarketplaceListing | null>(null);
  const [configModalItem, setConfigModalItem] =
    useState<MarketplaceInstallation | null>(null);

  const listings = browseQuery.data?.items || [];
  const installations = installationsQuery.data || [];
  const approvals = approvalsQuery.data || [];
  const customAgents = customAgentsQuery.data || [];

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

  const handleOpenBuilder = (agentId?: string, name?: string) => {
    if (agentId) {
      navigate(
        `/w/${activeWorkspaceSlug}/agents/builder?agentId=${agentId}&name=${encodeURIComponent(
          name || '',
        )}`,
      );
    } else {
      navigate(`/w/${activeWorkspaceSlug}/agents/builder`);
    }
  };

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

  const handleStartChatForInstalledAgent = (agentSlug: string, prompt?: string) => {
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

  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-6 max-w-7xl mx-auto w-full">
      {/* If viewing App Detail */}
      {selectedAppListing ? (
        <AppDetailPage
          app={selectedAppListing as MarketplaceListingDetail}
          onBack={handleBackToDirectory}
          onInstall={() => setInstallModalListing(selectedAppListing)}
          onRequestAccess={() => setRequestAccessListing(selectedAppListing)}
          onConfigure={() => {
            const inst = installations.find(
              (i) => i.listingSlug === selectedAppListing.slug,
            );
            if (inst) setConfigModalItem(inst);
          }}
          onUninstall={() => uninstall.mutate(selectedAppListing.slug)}
        />
      ) : selectedAgentListing ? (
        /* If viewing Agent Detail */
        <AgentDetailPage
          agent={selectedAgentListing as MarketplaceListingDetail}
          onBack={handleBackToDirectory}
          onInstall={() => setInstallModalListing(selectedAgentListing)}
          onRequestAccess={() => setRequestAccessListing(selectedAgentListing)}
          onConfigure={() => {
            const inst = installations.find(
              (i) => i.listingSlug === selectedAgentListing.slug,
            );
            if (inst) setConfigModalItem(inst);
          }}
          onUninstall={() => uninstall.mutate(selectedAgentListing.slug)}
          onStartChat={(prompt) =>
            handleStartChatForInstalledAgent(selectedAgentListing.slug, prompt)
          }
        />
      ) : (
        /* Standard Unified Directory View */
        <div className="space-y-6">
          <MarketplaceHeader
            searchQuery={searchQuery}
            onSearchChange={handleSearchChange}
            pendingApprovalsCount={pendingApprovalsCount}
            onOpenApprovals={() => handleTabChange('installed')}
            onOpenAgentBuilder={() => handleOpenBuilder()}
            onOpenDeveloper={() => handleTabChange('developer')}
          />

          <MarketplaceTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
            installedCount={installations.length}
            myAgentsCount={customAgents.length}
          />

          {/* Sub-tab Views */}
          {activeTab === 'discover' && (
            <MarketplaceDiscoverView
              listings={listings}
              isLoading={browseQuery.isLoading}
              onSelectListing={handleSelectListing}
              onInstall={(l) => setInstallModalListing(l)}
              onRequestAccess={(l) => setRequestAccessListing(l)}
              onConfigure={(l) => {
                const inst = installations.find((i) => i.listingSlug === l.slug);
                if (inst) setConfigModalItem(inst);
              }}
              onViewAllApps={() => handleTabChange('apps')}
              onViewAllAgents={() => handleTabChange('agents')}
            />
          )}

          {activeTab === 'apps' && (
            <MarketplaceCatalogView
              listings={listings}
              kind="INTEGRATION"
              searchQuery={searchQuery}
              onSelectListing={handleSelectListing}
              onInstall={(l) => setInstallModalListing(l)}
              onRequestAccess={(l) => setRequestAccessListing(l)}
              onConfigure={(l) => {
                const inst = installations.find((i) => i.listingSlug === l.slug);
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
                const inst = installations.find((i) => i.listingSlug === l.slug);
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
              onUninstall={(slug) => uninstall.mutate(slug)}
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

          {activeTab === 'my-agents' && (
            <MarketplaceMyItemsView
              type="agents"
              agents={customAgents}
              onOpenBuilder={handleOpenBuilder}
              onOpenChat={handleOpenChat}
              onDeleteAgent={(id) => removeCustomAgent.mutate(id)}
              onOpenDeveloper={() => handleTabChange('developer')}
            />
          )}

          {activeTab === 'my-apps' && (
            <MarketplaceMyItemsView
              type="apps"
              agents={[]}
              onOpenBuilder={handleOpenBuilder}
              onOpenChat={handleOpenChat}
              onOpenDeveloper={() => handleTabChange('developer')}
            />
          )}

          {activeTab === 'developer' && (
            <MarketplaceDeveloperView
              onPublishCustom={handlePublishCustomListing}
              isLoading={publishCustom.isPending}
            />
          )}
        </div>
      )}

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
