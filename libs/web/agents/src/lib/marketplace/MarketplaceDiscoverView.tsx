import React, { useMemo } from 'react';
import type { MarketplaceListing } from '@org/types';
import { Button, Card, Skeleton } from '@org/ui';
import { Bot, Code2, LayoutGrid, Plug } from 'lucide-react';
import {
  MarketplaceCatalogView,
  matchesListingSearch,
} from './MarketplaceCatalogView';
import { MARKETPLACE_GRID_CLASS, SectionTabs } from './marketplace-ui';
import type { MarketplaceLayout } from './marketplace-items';

/** The Discover tab's type filter, mirrored in the URL as `?kind=`. */
export type DiscoverKind = 'all' | 'agents' | 'apps';

const KIND_TO_LISTING = {
  all: 'ALL',
  agents: 'AGENT',
  apps: 'INTEGRATION',
} as const;

interface MarketplaceDiscoverViewProps {
  listings: MarketplaceListing[];
  isLoading: boolean;
  kind: DiscoverKind;
  onKindChange: (kind: DiscoverKind) => void;
  searchQuery: string;
  layout: MarketplaceLayout;
  onLayoutChange: (next: MarketplaceLayout) => void;
  /**
   * The live connectors (Gmail, GitHub, Jira…), shown first under "Apps".
   * Supplied by the app because they live in `@org/web-integrations`.
   */
  renderIntegrations?: (props: { searchQuery: string }) => React.ReactNode;
  onSelectListing: (listing: MarketplaceListing) => void;
  onInstall: (listing: MarketplaceListing) => void;
  onRequestAccess: (listing: MarketplaceListing) => void;
  onConfigure: (listing: MarketplaceListing) => void;
  /** "Build your own" — the developer portal. */
  onOpenBuilder?: () => void;
}

/**
 * Everything you can add from the Marketplace, in one filterable list: a type
 * filter (all / agents / apps), the catalog filters, and grid or list layout.
 */
export const MarketplaceDiscoverView: React.FC<
  MarketplaceDiscoverViewProps
> = ({
  listings,
  isLoading,
  kind,
  onKindChange,
  searchQuery,
  layout,
  onLayoutChange,
  renderIntegrations,
  onSelectListing,
  onInstall,
  onRequestAccess,
  onConfigure,
  onOpenBuilder,
}) => {
  const counts = useMemo(() => {
    const matching = listings.filter((l) =>
      matchesListingSearch(l, searchQuery),
    );
    return {
      all: matching.length,
      agents: matching.filter((l) => l.kind === 'AGENT').length,
      apps: matching.filter((l) => l.kind === 'INTEGRATION').length,
    };
  }, [listings, searchQuery]);

  const kindTabs = (
    <SectionTabs
      aria-label="Filter the Marketplace by type"
      value={kind}
      onValueChange={onKindChange}
      items={[
        {
          value: 'all' as const,
          label: 'All',
          icon: <LayoutGrid className="size-3.5" aria-hidden />,
          count: counts.all,
        },
        {
          value: 'agents' as const,
          label: 'AI agents',
          icon: <Bot className="size-3.5" aria-hidden />,
          count: counts.agents,
        },
        {
          value: 'apps' as const,
          label: 'Apps',
          icon: <Plug className="size-3.5" aria-hidden />,
          // With live connectors the listing count would undersell the tab.
          count: renderIntegrations ? undefined : counts.apps,
        },
      ]}
    />
  );

  const catalogProps = {
    listings,
    searchQuery,
    layout,
    onLayoutChange,
    onSelectListing,
    onInstall,
    onRequestAccess,
    onConfigure,
  };

  if (isLoading) {
    return (
      <div
        className="space-y-4"
        aria-busy="true"
        aria-label="Loading the Marketplace"
      >
        {kindTabs}
        <div className={MARKETPLACE_GRID_CLASS}>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-44 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // Apps: live connectors first, then any extra apps from the Marketplace.
  if (kind === 'apps' && renderIntegrations) {
    return (
      <div className="space-y-6">
        {kindTabs}
        <section aria-labelledby="mkt-connect-heading" className="space-y-3">
          <div>
            <h2
              id="mkt-connect-heading"
              className="text-sm font-semibold text-foreground"
            >
              Connect your tools
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Sign in once and agents, search and chat can work with them.
            </p>
          </div>
          {renderIntegrations({ searchQuery })}
        </section>
        {listings.some((l) => l.kind === 'INTEGRATION') && (
          <section
            aria-labelledby="mkt-more-apps-heading"
            className="space-y-3 pt-6 border-t border-border/60"
          >
            <MarketplaceCatalogView
              {...catalogProps}
              kind="INTEGRATION"
              toolbarStart={
                <h2
                  id="mkt-more-apps-heading"
                  className="text-sm font-semibold text-foreground"
                >
                  More apps from the Marketplace
                </h2>
              }
            />
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <MarketplaceCatalogView
        {...catalogProps}
        kind={KIND_TO_LISTING[kind]}
        toolbarStart={kindTabs}
      />

      {onOpenBuilder && kind !== 'apps' && (
        <Card className="gap-4 p-5 md:flex-row md:items-center flex flex-col justify-between border-dashed bg-surface-raised/30">
          <div className="gap-4 flex items-center">
            <div className="size-10 flex shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary-text">
              <Code2 className="size-5" aria-hidden />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Build your own agent or integration
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Connect private tools, prompt internal models, or publish a
                custom listing for your team.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onOpenBuilder}>
            Open builder
          </Button>
        </Card>
      )}
    </div>
  );
};
