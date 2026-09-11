import React from 'react';
import { cn } from '@org/utils';
import {
  Compass,
  Boxes,
  Bot,
  CheckCircle2,
  FolderGit2,
  Code2,
  UserCheck,
} from 'lucide-react';

export type MarketplaceActiveTab =
  | 'discover'
  | 'apps'
  | 'agents'
  | 'installed'
  | 'my-apps'
  | 'my-agents'
  | 'developer';

interface MarketplaceTabsProps {
  activeTab: MarketplaceActiveTab;
  onTabChange: (tab: MarketplaceActiveTab) => void;
  installedCount?: number;
  myAgentsCount?: number;
  className?: string;
}

export const MarketplaceTabs: React.FC<MarketplaceTabsProps> = ({
  activeTab,
  onTabChange,
  installedCount,
  myAgentsCount,
  className,
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
    { id: 'installed', label: 'Installed', icon: CheckCircle2, count: installedCount },
    { id: 'my-agents', label: 'My Agents', icon: UserCheck, count: myAgentsCount },
    { id: 'my-apps', label: 'My Apps', icon: FolderGit2 },
    { id: 'developer', label: 'Developer', icon: Code2 },
  ];

  return (
    <div
      className={cn(
        'flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-border/70 py-1.5',
        className,
      )}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={cn(
              'inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
              isActive
                ? 'bg-surface-raised text-foreground font-semibold shadow-xs border border-border/80'
                : 'text-muted-foreground hover:text-foreground hover:bg-surface-raised/50',
            )}
          >
            <Icon
              className={cn(
                'size-4',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
            />
            <span>{tab.label}</span>
            {tab.count !== undefined && tab.count > 0 && (
              <span
                className={cn(
                  'px-1.5 py-0.2 rounded-full text-[10px] font-semibold',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted text-muted-foreground',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
