import React from 'react';
import { Button, SearchInput } from '@org/ui';
import { Code2, Plus, Sparkles, ShieldAlert } from 'lucide-react';

interface MarketplaceHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  pendingApprovalsCount?: number;
  onOpenApprovals?: () => void;
  onOpenAgentBuilder?: () => void;
  onOpenDeveloper?: () => void;
}

export const MarketplaceHeader: React.FC<MarketplaceHeaderProps> = ({
  searchQuery,
  onSearchChange,
  pendingApprovalsCount = 0,
  onOpenApprovals,
  onOpenAgentBuilder,
  onOpenDeveloper,
}) => {
  return (
    <div className="border-b border-border/80 bg-surface/40 backdrop-blur-sm pb-6 pt-2">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Title & Tagline */}
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Agents & Apps
            </h1>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="size-3" />
              Ecosystem
            </span>

            {pendingApprovalsCount > 0 && onOpenApprovals && (
              <button
                type="button"
                onClick={onOpenApprovals}
                className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
              >
                <ShieldAlert className="size-3" />
                <span>{pendingApprovalsCount} pending request{pendingApprovalsCount > 1 ? 's' : ''}</span>
              </button>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Discover, integrate, and orchestrate verified integrations and autonomous AI agents for your workspace.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {onOpenDeveloper && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenDeveloper}
              className="text-xs font-medium"
            >
              <Code2 className="size-3.5 mr-1.5 text-muted-foreground" />
              Developer Portal
            </Button>
          )}

          {onOpenAgentBuilder && (
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenAgentBuilder}
              className="text-xs font-semibold shadow-xs"
            >
              <Plus className="size-3.5 mr-1" />
              Build Agent
            </Button>
          )}
        </div>
      </div>

      {/* Search Bar */}
      <div className="mt-5 max-w-xl">
        <SearchInput
          value={searchQuery}
          onValueChange={onSearchChange}
          placeholder="Search apps, agents, capabilities, or slash commands..."
          className="w-full text-sm rounded-xl bg-surface shadow-xs"
        />
      </div>
    </div>
  );
};
