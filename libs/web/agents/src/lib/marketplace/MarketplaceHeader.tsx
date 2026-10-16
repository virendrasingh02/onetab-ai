import React from 'react';
import { Button, SearchInput, PageBar } from '@org/ui';
import { ExternalLink, ShieldAlert, Sparkles, Store } from 'lucide-react';

interface MarketplaceHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  pendingApprovalsCount?: number;
  onOpenApprovals?: () => void;
  /** Opens the standalone AI Agent Studio, where agents and automations are built and published. */
  onOpenStudio?: () => void;
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
}) => {
  return (
    <PageBar
      icon={<Store />}
      title="Marketplace"
      hasTabs
      meta={
        pendingApprovalsCount > 0 && onOpenApprovals ? (
          <button
            type="button"
            onClick={onOpenApprovals}
            className="gap-1 px-2 py-0.5 font-medium inline-flex items-center rounded-sm border border-warning/30 bg-warning/12 text-[11px] text-warning-text transition-colors hover:bg-warning/20"
          >
            <ShieldAlert className="size-3" />
            <span>
              {pendingApprovalsCount} pending request
              {pendingApprovalsCount > 1 ? 's' : ''}
            </span>
          </button>
        ) : null
      }
      actions={
        <>
          <SearchInput
            value={searchQuery}
            onValueChange={onSearchChange}
            placeholder="Search apps, agents, capabilities…"
            wrapperClassName="w-full sm:w-64 lg:w-80"
            className="h-7 text-xs"
          />

          {onOpenStudio && (
            <Button
              variant="primary"
              size="sm"
              onClick={onOpenStudio}
              className="h-7 text-xs font-semibold"
            >
              <Sparkles className="size-3.5 mr-1.5" />
              AI Agent Studio
              <ExternalLink className="size-3 ml-1.5 opacity-70" />
            </Button>
          )}
        </>
      }
    />
  );
};
