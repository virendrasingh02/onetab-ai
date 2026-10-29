import React from 'react';
import { PageTabBar, Tabs, TabsTrigger } from '@org/ui';
import { Boxes, Bot, CheckCircle2, Compass, UserCheck } from 'lucide-react';

export type MarketplaceActiveTab =
  'discover' | 'apps' | 'agents' | 'installed' | 'workspace' | 'developer';

interface MarketplaceTabsProps {
  activeTab: MarketplaceActiveTab;
  onTabChange: (tab: MarketplaceActiveTab) => void;
  installedCount?: number;
  workspaceCount?: number;
  agentsCount?: number;
}

/** The edge-to-edge underline tab strip under the header, as on the other top-level views. */
export const MarketplaceTabs: React.FC<MarketplaceTabsProps> = ({
  activeTab,
  onTabChange,
  installedCount,
  workspaceCount,
  agentsCount,
}) => {
  const tabs: {
    id: MarketplaceActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }[] = [
    { id: 'discover', label: 'Discover', icon: Compass },
    { id: 'apps', label: 'Apps & Integrations', icon: Boxes },
    { id: 'agents', label: 'AI Agents', icon: Bot, count: agentsCount },
    {
      id: 'installed',
      label: 'Installed',
      icon: CheckCircle2,
      count: installedCount,
    },
    {
      id: 'workspace',
      label: 'Coworkers',
      icon: UserCheck,
      count: workspaceCount,
    },
  ];

  return (
    <Tabs
      value={activeTab}
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
