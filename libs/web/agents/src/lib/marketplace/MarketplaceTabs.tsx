import React from 'react';
import { PageTabBar, Tabs, TabsTrigger } from '@org/ui';
import { Compass, LayoutDashboard } from 'lucide-react';

/**
 * Two tabs: what this workspace already has ("Yours") and what it can add
 * ("Discover"). `developer` is the publish portal, reached from Discover's
 * "Build your own" card rather than the tab strip.
 */
export type MarketplaceActiveTab = 'yours' | 'discover' | 'developer';

interface MarketplaceTabsProps {
  activeTab: MarketplaceActiveTab;
  onTabChange: (tab: MarketplaceActiveTab) => void;
  /** Agents, coworkers and automations in this workspace. */
  yoursCount?: number;
  /** Marketplace listings available to add. */
  discoverCount?: number;
}

/** The edge-to-edge underline tab strip under the header, as on the other top-level views. */
export const MarketplaceTabs: React.FC<MarketplaceTabsProps> = ({
  activeTab,
  onTabChange,
  yoursCount,
  discoverCount,
}) => {
  const tabs: {
    id: MarketplaceActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }[] = [
    { id: 'yours', label: 'Yours', icon: LayoutDashboard, count: yoursCount },
    {
      id: 'discover',
      label: 'Discover',
      icon: Compass,
      count: discoverCount,
    },
  ];

  return (
    <Tabs
      value={activeTab === 'developer' ? 'discover' : activeTab}
      onValueChange={(next) => onTabChange(next as MarketplaceActiveTab)}
    >
      <PageTabBar>
        {tabs.map(({ id, label, icon: Icon, count }) => (
          <TabsTrigger
            key={id}
            value={id}
            icon={<Icon className="size-4" aria-hidden />}
            count={count && count > 0 ? count : undefined}
          >
            {label}
          </TabsTrigger>
        ))}
      </PageTabBar>
    </Tabs>
  );
};
