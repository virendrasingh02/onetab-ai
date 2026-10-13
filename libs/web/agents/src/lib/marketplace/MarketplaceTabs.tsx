import React from 'react';
import { ResponsiveTabsList, Tabs, TabsTrigger } from '@org/ui';
import {
  Boxes,
  Bot,
  CheckCircle2,
  Code2,
  Compass,
  UserCheck,
} from 'lucide-react';

export type MarketplaceActiveTab =
  'discover' | 'apps' | 'agents' | 'installed' | 'workspace' | 'developer';

interface MarketplaceTabsProps {
  activeTab: MarketplaceActiveTab;
  onTabChange: (tab: MarketplaceActiveTab) => void;
  installedCount?: number;
  workspaceCount?: number;
}

/** The edge-to-edge underline tab strip under the header, as on the other top-level views. */
export const MarketplaceTabs: React.FC<MarketplaceTabsProps> = ({
  activeTab,
  onTabChange,
  installedCount,
  workspaceCount,
}) => {
  const tabs: {
    id: MarketplaceActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }[] = [
    { id: 'discover', label: 'Discover', icon: Compass },
    { id: 'apps', label: 'Apps & Integrations', icon: Boxes },
    { id: 'agents', label: 'AI Agents', icon: Bot },
    {
      id: 'installed',
      label: 'Installed',
      icon: CheckCircle2,
      count: installedCount,
    },
    {
      id: 'workspace',
      label: 'Your workspace',
      icon: UserCheck,
      count: workspaceCount,
    },
    { id: 'developer', label: 'Developer', icon: Code2 },
  ];

  return (
    <div className="px-3 sm:px-6 border-t border-border/40 bg-surface-muted/30">
      <Tabs
        value={activeTab}
        onValueChange={(next) => onTabChange(next as MarketplaceActiveTab)}
      >
        <ResponsiveTabsList
          variant="underline"
          size="sm"
          className="min-w-0 w-full border-b-0"
          aria-label="Marketplace sections"
        >
          {tabs.map(({ id, label, icon: Icon, count }) => (
            <TabsTrigger
              key={id}
              value={id}
              icon={<Icon className="size-3.5" aria-hidden />}
              count={count && count > 0 ? count : undefined}
            >
              {label}
            </TabsTrigger>
          ))}
        </ResponsiveTabsList>
      </Tabs>
    </div>
  );
};
