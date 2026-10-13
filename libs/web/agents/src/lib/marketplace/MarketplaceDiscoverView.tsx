import React from 'react';
import type { MarketplaceListing } from '@org/types';
import { Badge, Button, Card, PageSection, Skeleton, SkeletonList } from '@org/ui';
import { MarketplaceCard } from './MarketplaceCard';
import { EntityIcon } from './marketplace-ui';
import { ArrowRight, Code2, Sparkles } from 'lucide-react';

interface MarketplaceDiscoverViewProps {
  listings: MarketplaceListing[];
  isLoading: boolean;
  onSelectListing: (listing: MarketplaceListing) => void;
  onInstall: (listing: MarketplaceListing) => void;
  onRequestAccess: (listing: MarketplaceListing) => void;
  onConfigure: (listing: MarketplaceListing) => void;
  onViewAllApps: () => void;
  onViewAllAgents: () => void;
  /** Where "Open builder" goes — the developer portal. Defaults to the agents list. */
  onOpenBuilder?: () => void;
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
  onOpenBuilder = onViewAllAgents,
}) => {
  if (isLoading) {
    return (
      <div className="py-6 space-y-6">
        <Skeleton className="h-44 rounded-2xl" />
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
        <Card className="relative overflow-hidden p-6 md:p-8">
          <div className="absolute right-0 top-0 -mt-10 -mr-10 size-64 rounded-full bg-primary/5 blur-3xl pointer-events-none" />
          <div className="relative z-10 gap-6 md:flex-row md:items-center flex flex-col justify-between">
            <div className="max-w-xl space-y-3">
              <Badge variant="primary">
                <Sparkles aria-hidden />
                Featured workflow
              </Badge>
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-foreground">
                Autonomous Dev Team: Code Reviewer & GitHub
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Connect your repositories with GitHub alerts and have the AI Code Reviewer automatically inspect every pull request for performance, type safety, and test coverage before you merge.
              </p>
              <div className="gap-2 pt-2 flex items-center">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => onSelectListing(spotlightAgent)}
                >
                  Explore Code Reviewer
                  <ArrowRight aria-hidden />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSelectListing(spotlightApp)}
                >
                  View GitHub app
                </Button>
              </div>
            </div>

            {/* Visual paired icons */}
            <div className="flex -space-x-4 items-center self-center md:self-auto">
              <EntityIcon
                iconUrl={spotlightApp.iconUrl}
                kind={spotlightApp.kind}
                className="size-14 shadow-md"
              />
              <EntityIcon
                iconUrl={spotlightAgent.iconUrl}
                kind={spotlightAgent.kind}
                className="size-14 shadow-lg ring-4 ring-card"
              />
            </div>
          </div>
        </Card>
      )}

      {/* Agents */}
      <PageSection
        variant="plain"
        title="Autonomous AI agents"
        actions={
          <Button variant="ghost" size="sm" onClick={onViewAllAgents}>
            View all agents ({agents.length})
            <ArrowRight aria-hidden />
          </Button>
        }
      >
        <div className="md:grid-cols-2 lg:grid-cols-3 gap-4 grid grid-cols-1">
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
      </PageSection>

      {/* Apps */}
      <PageSection
        variant="plain"
        title="Essential apps & integrations"
        actions={
          <Button variant="ghost" size="sm" onClick={onViewAllApps}>
            View all apps ({apps.length})
            <ArrowRight aria-hidden />
          </Button>
        }
      >
        <div className="md:grid-cols-2 lg:grid-cols-3 gap-4 grid grid-cols-1">
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
      </PageSection>

      {/* Build or publish */}
      <Card className="gap-4 p-5 md:flex-row md:items-center flex flex-col justify-between border-dashed bg-surface-raised/30">
        <div className="gap-4 flex items-center">
          <div className="size-11 flex shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary-text">
            <Code2 className="size-5" aria-hidden />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Build your own agent or custom integration
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Connect private enterprise tools, prompt internal models, or configure custom webhooks for your team.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={onOpenBuilder}>
          Open builder
        </Button>
      </Card>
    </div>
  );
};
