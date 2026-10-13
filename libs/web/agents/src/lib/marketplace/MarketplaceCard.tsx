import React from 'react';
import type { MarketplaceListing } from '@org/types';
import { Badge, Card } from '@org/ui';
import { cn } from '@org/utils';
import {
  EntityIcon,
  KindBadge,
  ListingActionButton,
  OriginBadge,
  VerifiedBadge,
  listingActionState,
} from './marketplace-ui';

interface MarketplaceCardProps {
  listing: MarketplaceListing;
  onSelect: (listing: MarketplaceListing) => void;
  onInstall?: (listing: MarketplaceListing) => void;
  onRequestAccess?: (listing: MarketplaceListing) => void;
  onConfigure?: (listing: MarketplaceListing) => void;
  className?: string;
}

export const MarketplaceCard: React.FC<MarketplaceCardProps> = ({
  listing,
  onSelect,
  onInstall,
  onRequestAccess,
  onConfigure,
  className,
}) => {
  const capabilities = listing.capabilities ?? [];

  return (
    <Card
      role="group"
      tabIndex={0}
      onClick={() => onSelect(listing)}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && e.key === 'Enter') onSelect(listing);
      }}
      className={cn(
        'group p-4 cursor-pointer justify-between text-left outline-none',
        'hover:bg-surface-raised/40 focus-visible:ring-2 focus-visible:ring-ring/50',
        className,
      )}
    >
      <div>
        <div className="mb-3 gap-3 flex items-start justify-between">
          <div className="min-w-0 gap-3 flex items-center">
            <EntityIcon iconUrl={listing.iconUrl} kind={listing.kind} />

            <div className="min-w-0">
              <div className="gap-1.5 flex items-center">
                <h3 className="text-sm font-semibold truncate text-foreground">
                  {listing.name}
                </h3>
                <VerifiedBadge badge={listing.badge} />
              </div>
              <p className="mt-0.5 text-xs truncate text-muted-foreground">
                {listing.publisher?.name || listing.publisherName || 'OneTab AI'} · {listing.category}
              </p>
            </div>
          </div>

          <div className="gap-1 flex shrink-0 flex-col items-end">
            <KindBadge kind={listing.kind} />
            <OriginBadge listing={listing} />
          </div>
        </div>

        <p className="mb-3 min-h-10 text-xs leading-relaxed line-clamp-2 text-muted-foreground">
          {listing.tagline || listing.description}
        </p>

        {capabilities.length > 0 && (
          <div className="mb-3 gap-1.5 flex flex-wrap items-center">
            {capabilities.slice(0, 2).map((cap) => (
              <Badge key={cap} variant="neutral" className="max-w-40">
                <span className="truncate">{cap}</span>
              </Badge>
            ))}
            {capabilities.length > 2 && (
              <span className="text-[11px] text-muted-foreground">
                +{capabilities.length - 2} more
              </span>
            )}
          </div>
        )}
      </div>

      <div className="mt-auto gap-2 pt-3 flex items-center justify-between border-t border-border/60">
        <div className="gap-1.5 text-xs flex items-center text-muted-foreground">
          <span className="font-medium text-foreground">
            {listing.pricingModel === 'FREE' ? 'Free' : 'Subscription'}
          </span>
          {listing.ratingCount ? (
            <span>
              ★ {listing.ratingAverage?.toFixed(1)} ({listing.ratingCount})
            </span>
          ) : null}
        </div>

        <div onClick={(e) => e.stopPropagation()}>
          <ListingActionButton
            {...listingActionState(listing)}
            onInstall={() => onInstall?.(listing)}
            onRequestAccess={
              onRequestAccess ? () => onRequestAccess(listing) : undefined
            }
            onConfigure={() => onConfigure?.(listing)}
          />
        </div>
      </div>
    </Card>
  );
};
