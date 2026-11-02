import React, { useId } from 'react';
import type { MarketplaceListing } from '@org/types';
import { Badge, Card } from '@org/ui';
import { cn } from '@org/utils';
import { Download, Star } from 'lucide-react';
import {
  EntityIcon,
  KindBadge,
  ListingActionButton,
  ListingOwnerLine,
  OriginBadge,
  VerifiedBadge,
  listingActionState,
} from './marketplace-ui';

const MAX_CAPABILITIES = 2;

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
  const installs = listing.installCount ?? listing.installationCount ?? 0;
  const rating = listing.rating || listing.ratingAverage || 0;
  const descriptionId = useId();

  return (
    // The name is a real button stretched over the card, so the whole card
    // opens the listing without nesting the footer's action inside a control.
    <Card
      className={cn(
        'group gap-0 p-4 relative h-full cursor-pointer text-left transition-colors',
        'hover:border-border-strong hover:bg-surface-raised/40',
        className,
      )}
    >
      <div className="gap-3 flex items-start">
        <EntityIcon
          iconUrl={listing.iconUrl}
          kind={listing.kind}
          className="size-11"
        />
        <div className="min-w-0 flex-1">
          <div className="min-w-0 gap-1.5 flex items-center">
            <h3 className="min-w-0 text-sm font-semibold text-foreground">
              <button
                type="button"
                onClick={() => onSelect(listing)}
                aria-describedby={descriptionId}
                title={listing.name}
                className="after:inset-0 block max-w-full truncate text-left outline-none after:absolute after:rounded-[inherit] focus-visible:after:ring-2 focus-visible:after:ring-ring/50"
              >
                {listing.name}
              </button>
            </h3>
            <VerifiedBadge badge={listing.badge} />
          </div>
          <p className="mt-0.5 text-xs truncate text-muted-foreground">
            {listing.category}
            {listing.version ? ` · v${listing.version}` : ''}
          </p>
        </div>
      </div>

      <p
        id={descriptionId}
        className="mt-3 min-h-10 text-xs leading-relaxed line-clamp-2 text-muted-foreground"
      >
        {listing.tagline || listing.description}
      </p>

      {/* One line of chips, so every card in a row keeps the same rhythm. */}
      <div className="mt-3 gap-1.5 min-w-0 flex flex-nowrap items-center overflow-hidden">
        <KindBadge kind={listing.kind} />
        <OriginBadge listing={listing} />
        {capabilities.slice(0, MAX_CAPABILITIES).map((cap) => (
          <Badge
            key={cap}
            variant="neutral"
            className="min-w-0 shrink"
            title={cap}
          >
            <span className="truncate">{cap}</span>
          </Badge>
        ))}
        {capabilities.length > MAX_CAPABILITIES && (
          <Badge
            variant="neutral"
            className="shrink-0"
            title={capabilities.slice(MAX_CAPABILITIES).join(', ')}
          >
            +{capabilities.length - MAX_CAPABILITIES}
          </Badge>
        )}
      </div>

      <div className="mt-3 gap-3 text-xs flex items-center text-muted-foreground">
        <span className="font-medium text-foreground">
          {listing.pricingModel === 'FREE' ? 'Free' : 'Subscription'}
        </span>
        <span
          className="gap-1 flex items-center"
          title={`${installs} installs`}
        >
          <Download className="size-3" aria-hidden />
          {installs.toLocaleString()}
        </span>
        {listing.ratingCount ? (
          <span
            className="gap-1 flex items-center"
            title={`${listing.ratingCount} reviews`}
          >
            <Star
              className="size-3 fill-current text-accent-amber"
              aria-hidden
            />
            {rating.toFixed(1)}
            <span>({listing.ratingCount})</span>
          </span>
        ) : null}
      </div>

      {/* Pushes the footer to the bottom so footers line up across a row. */}
      <div className="min-h-4 flex-1" aria-hidden />
      <div className="gap-3 pt-3 flex items-center justify-between border-t border-border/60">
        <ListingOwnerLine listing={listing} />
        <div className="relative z-10 shrink-0">
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
