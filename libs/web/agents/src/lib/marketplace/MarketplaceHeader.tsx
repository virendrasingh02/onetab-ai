import React from 'react';
import { Button, SearchInput } from '@org/ui';
import {
  Code2,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Store,
} from 'lucide-react';

interface MarketplaceHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  pendingApprovalsCount?: number;
  onOpenApprovals?: () => void;
  /** Opens the standalone AI Agent Studio, where agents and automations are built and published. */
  onOpenStudio?: () => void;
  onOpenDeveloper?: () => void;
}

/**
 * The compact title row shared with Home, Inbox, Files and the AI Agent
 * Studio: a 48px bar with the heading on the left and search + actions on the
 * right. The tab strip sits directly beneath it (see `MarketplaceTabs`).
 */
export const MarketplaceHeader: React.FC<MarketplaceHeaderProps> = ({
  searchQuery,
  onSearchChange,
  pendingApprovalsCount = 0,
  onOpenApprovals,
  onOpenStudio,
  onOpenDeveloper,
}) => {
  return (
    <div className="gap-2.5 px-3 sm:px-6 py-1.5 min-h-12 flex flex-wrap items-center justify-between">
      <div className="min-w-0 gap-1.5 flex items-center">
        <Store className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <h1 className="text-sm font-semibold tracking-tight truncate text-foreground">
          Marketplace
        </h1>

        {pendingApprovalsCount > 0 && onOpenApprovals && (
          <button
            type="button"
            onClick={onOpenApprovals}
            className="ml-1 gap-1 px-2 py-0.5 font-medium inline-flex items-center rounded-sm border border-warning/30 bg-warning/12 text-[11px] text-warning-text transition-colors hover:bg-warning/20"
          >
            <ShieldAlert className="size-3" />
            <span>
              {pendingApprovalsCount} pending request
              {pendingApprovalsCount > 1 ? 's' : ''}
            </span>
          </button>
        )}
      </div>

      <div className="gap-2 min-w-0 flex flex-wrap items-center">
        <SearchInput
          value={searchQuery}
          onValueChange={onSearchChange}
          placeholder="Search apps, agents, capabilities…"
          wrapperClassName="w-full sm:w-64 lg:w-80"
          className="h-8 text-xs"
        />

        {onOpenDeveloper && (
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenDeveloper}
            className="h-8 text-xs font-medium"
          >
            <Code2 className="size-3.5 mr-1.5 text-muted-foreground" />
            Developer Portal
          </Button>
        )}

        {onOpenStudio && (
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenStudio}
            className="h-8 text-xs font-semibold"
          >
            <Sparkles className="size-3.5 mr-1.5" />
            AI Agent Studio
            <ExternalLink className="size-3 ml-1.5 opacity-70" />
          </Button>
        )}
      </div>
    </div>
  );
};
