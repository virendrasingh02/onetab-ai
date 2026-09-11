import React from 'react';
import type { MarketplaceListing } from '@org/types';
import { Button, Card } from '@org/ui';
import { cn } from '@org/utils';
import {
  Bot,
  Brain,
  Check,
  Code2,
  Clock,
  Globe,
  Layers,
  Lock,
  MessageSquare,
  Rocket,
  Search,
  Shield,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';

interface MarketplaceCardProps {
  listing: MarketplaceListing;
  onSelect: (listing: MarketplaceListing) => void;
  onInstall?: (listing: MarketplaceListing) => void;
  onRequestAccess?: (listing: MarketplaceListing) => void;
  onConfigure?: (listing: MarketplaceListing) => void;
  className?: string;
}

export function renderEntityIcon(
  iconUrl?: string,
  kind?: string,
  className = 'size-10',
) {
  if (iconUrl?.startsWith('icon:')) {
    const iconId = iconUrl.replace('icon:', '');
    const iconMap: Record<string, React.ReactNode> = {
      bot: <Bot className="size-5 text-indigo-500" />,
      brain: <Brain className="size-5 text-pink-500" />,
      code: <Code2 className="size-5 text-blue-500" />,
      spark: <Sparkles className="size-5 text-amber-500" />,
      shield: <Shield className="size-5 text-emerald-500" />,
      search: <Search className="size-5 text-cyan-500" />,
      chat: <MessageSquare className="size-5 text-purple-500" />,
      rocket: <Rocket className="size-5 text-rose-500" />,
      globe: <Globe className="size-5 text-teal-500" />,
      layers: <Layers className="size-5 text-orange-500" />,
    };

    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-xl bg-surface-raised border border-border/80 shadow-xs flex-shrink-0',
          className,
        )}
      >
        {iconMap[iconId] || <Bot className="size-5 text-primary" />}
      </div>
    );
  }

  if (iconUrl && (iconUrl.startsWith('http') || iconUrl.startsWith('/'))) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-xl bg-surface-raised border border-border/80 shadow-xs p-1.5 flex-shrink-0 overflow-hidden',
          className,
        )}
      >
        <img
          src={iconUrl}
          alt=""
          className="size-full object-contain rounded-lg"
          onError={(e) => {
            // fallback if remote icon fails to load
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-xl bg-surface-raised border border-border/80 shadow-xs flex-shrink-0',
        className,
      )}
    >
      {kind === 'AGENT' ? (
        <Bot className="size-5 text-primary" />
      ) : (
        <Zap className="size-5 text-accent-amber" />
      )}
    </div>
  );
}

export const MarketplaceCard: React.FC<MarketplaceCardProps> = ({
  listing,
  onSelect,
  onInstall,
  onRequestAccess,
  onConfigure,
  className,
}) => {
  const isAgent = listing.kind === 'AGENT';
  const isInstalled = Boolean(listing.installed);
  const isPending = listing.approvalStatus === 'PENDING';
  const requiresAdmin = Boolean(listing.requiresAdmin);

  return (
    <Card
      onClick={() => onSelect(listing)}
      className={cn(
        'group relative flex flex-col justify-between p-5 transition-all duration-200 cursor-pointer',
        'border border-border/80 bg-surface/50 hover:bg-surface hover:border-border hover:shadow-md dark:hover:border-border-subtle',
        'rounded-2xl text-left overflow-hidden',
        className,
      )}
    >
      {/* Top row: Icon + Titles + Badges */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-3.5">
          <div className="flex items-center gap-3 min-w-0">
            {renderEntityIcon(listing.iconUrl ?? undefined, listing.kind)}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                  {listing.name}
                </h3>
                {listing.badge === 'OFFICIAL' && (
                  <span
                    title="Official verified integration"
                    className="inline-flex items-center gap-0.5 text-primary"
                  >
                    <ShieldCheck className="size-3.5 fill-primary/10 text-primary" />
                  </span>
                )}
                {listing.badge === 'VERIFIED' && (
                  <span
                    title="Verified Publisher"
                    className="inline-flex items-center gap-0.5 text-emerald-500"
                  >
                    <ShieldCheck className="size-3.5 fill-emerald-500/10 text-emerald-500" />
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                <span className="truncate max-w-[130px] font-normal">
                  {listing.publisherName || 'OneTab AI'}
                </span>
                <span>•</span>
                <span className="font-medium text-muted-foreground/80">
                  {listing.category}
                </span>
              </div>
            </div>
          </div>

          {/* Kind Chip */}
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <span
              className={cn(
                'px-2 py-0.5 rounded-full text-[11px] font-semibold tracking-wide border',
                isAgent
                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
              )}
            >
              {isAgent ? 'AI Agent' : 'App'}
            </span>
          </div>
        </div>

        {/* Tagline / Description */}
        <p className="text-xs text-muted-foreground/90 line-clamp-2 leading-relaxed mb-3.5 min-h-[2.5rem]">
          {listing.tagline || listing.description}
        </p>

        {/* Capability / Feature pills */}
        {listing.capabilities && listing.capabilities.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {listing.capabilities.slice(0, 2).map((cap, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-surface-raised border border-border/70 text-muted-foreground"
              >
                <span className="size-1 rounded-full bg-primary/60" />
                <span className="truncate max-w-[140px]">{cap}</span>
              </span>
            ))}
            {listing.capabilities.length > 2 && (
              <span className="text-[10px] text-muted-foreground/70 self-center px-1">
                +{listing.capabilities.length - 2} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer row: Pricing & Action Button */}
      <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-2 mt-auto">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {listing.pricingModel === 'FREE' ? 'Free' : 'Subscription'}
          </span>
          {listing.ratingCount ? (
            <span className="text-muted-foreground/70">
              ★ {listing.ratingAverage?.toFixed(1)} ({listing.ratingCount})
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          {isInstalled ? (
            <Button
              variant="outline"
              size="xs"
              className="text-xs font-medium border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
              onClick={() => onConfigure?.(listing)}
            >
              <Check className="size-3 mr-1" />
              Installed
            </Button>
          ) : isPending ? (
            <Button
              variant="outline"
              size="xs"
              disabled
              className="text-xs font-medium text-amber-600 dark:text-amber-400 border-amber-500/30"
            >
              <Clock className="size-3 mr-1 animate-pulse" />
              Pending Admin
            </Button>
          ) : requiresAdmin ? (
            <Button
              variant="outline"
              size="xs"
              className="text-xs font-medium group/btn"
              onClick={() =>
                onRequestAccess ? onRequestAccess(listing) : onInstall?.(listing)
              }
            >
              <Lock className="size-3 mr-1 text-muted-foreground group-hover/btn:text-foreground transition-colors" />
              Request
            </Button>
          ) : (
            <Button
              variant="primary"
              size="xs"
              className="text-xs font-medium shadow-xs"
              onClick={() => onInstall?.(listing)}
            >
              Install
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};
