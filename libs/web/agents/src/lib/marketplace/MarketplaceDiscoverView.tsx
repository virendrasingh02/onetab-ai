import React from 'react';
import type { MarketplaceListing } from '@org/types';
import { Button, SkeletonList } from '@org/ui';
import { MarketplaceCard, renderEntityIcon } from './MarketplaceCard';
import { ArrowRight, Bot, Boxes, Code2, Sparkles } from 'lucide-react';

interface MarketplaceDiscoverViewProps {
  listings: MarketplaceListing[];
  isLoading: boolean;
  onSelectListing: (listing: MarketplaceListing) => void;
  onInstall: (listing: MarketplaceListing) => void;
  onRequestAccess: (listing: MarketplaceListing) => void;
  onConfigure: (listing: MarketplaceListing) => void;
  onViewAllApps: () => void;
  onViewAllAgents: () => void;
}

export const MarketplaceDiscoverView: React.FC<MarketplaceDiscoverViewProps> = ({
  listings,
  isLoading,
  onSelectListing,
  onInstall,
  onRequestAccess,
  onConfigure,
  onViewAllApps,
  onViewAllAgents,
}) => {
  if (isLoading) {
    return (
      <div className="py-6 space-y-6">
        <div className="h-44 rounded-2xl bg-surface-raised/40 animate-pulse border border-border/60" />
        <SkeletonList rows={6} />
      </div>
    );
  }

  const agents = listings.filter((item) => item.kind === 'AGENT');
  const apps = listings.filter((item) => item.kind === 'INTEGRATION');

  // Featured spotlight items (e.g. GitHub or Code Reviewer)
  const spotlightAgent =
    agents.find((a) => a.slug === 'code-reviewer') || agents[0];
  const spotlightApp = apps.find((a) => a.slug === 'github') || apps[0];

  return (
    <div className="space-y-10 py-4">
      {/* Hero Spotlight Banner */}
      {spotlightAgent && spotlightApp && (
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-r from-surface-raised via-surface to-surface-raised p-6 md:p-8 shadow-xs">
          <div className="absolute right-0 top-0 -mt-10 -mr-10 size-64 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="max-w-xl space-y-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                <Sparkles className="size-3" />
                Featured Workflow
              </div>
              <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                Autonomous Dev Team: Code Reviewer & GitHub
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Connect your repositories with GitHub alerts and have the AI Code Reviewer automatically inspect every pull request for performance, type safety, and test coverage before you merge.
              </p>
              <div className="flex items-center gap-3 pt-2">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onSelectListing(spotlightAgent)}
                  className="text-xs font-semibold shadow-xs"
                >
                  Explore Code Reviewer
                  <ArrowRight className="size-3.5 ml-1.5" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSelectListing(spotlightApp)}
                  className="text-xs font-medium"
                >
                  View GitHub App
                </Button>
              </div>
            </div>

            {/* Visual paired cards */}
            <div className="flex items-center gap-3 self-center md:self-auto">
              <div className="flex -space-x-4 items-center">
                {renderEntityIcon(spotlightApp.iconUrl ?? undefined, spotlightApp.kind, 'size-14 shadow-md')}
                {renderEntityIcon(spotlightAgent.iconUrl ?? undefined, spotlightAgent.kind, 'size-14 shadow-lg ring-4 ring-surface')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Autonomous AI Agents Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-purple-500" />
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Autonomous AI Agents
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewAllAgents}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            View all agents ({agents.length})
            <ArrowRight className="size-3.5 ml-1" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.slice(0, 6).map((agent) => (
            <MarketplaceCard
              key={agent.id || agent.slug}
              listing={agent}
              onSelect={onSelectListing}
              onInstall={onInstall}
              onRequestAccess={onRequestAccess}
              onConfigure={onConfigure}
            />
          ))}
        </div>
      </div>

      {/* Apps & Integrations Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Boxes className="size-5 text-blue-500" />
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Essential Apps & Integrations
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onViewAllApps}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            View all apps ({apps.length})
            <ArrowRight className="size-3.5 ml-1" />
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {apps.slice(0, 6).map((app) => (
            <MarketplaceCard
              key={app.id || app.slug}
              listing={app}
              onSelect={onSelectListing}
              onInstall={onInstall}
              onRequestAccess={onRequestAccess}
              onConfigure={onConfigure}
            />
          ))}
        </div>
      </div>

      {/* Build or Publish Custom Tile */}
      <div className="rounded-2xl border border-dashed border-border bg-surface-raised/30 p-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
            <Code2 className="size-6 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm text-foreground">
              Build your own Agent or Custom Integration
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Connect private enterprise tools, prompt internal models, or configure custom webhooks for your team.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onViewAllAgents}
          className="text-xs font-semibold whitespace-nowrap"
        >
          Open Builder
        </Button>
      </div>
    </div>
  );
};
