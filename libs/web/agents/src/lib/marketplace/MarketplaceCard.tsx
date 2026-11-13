import React from 'react';
import type { MarketplaceListing } from '@org/types';
import { Badge } from '@org/ui';
import { Star } from 'lucide-react';
import {
  EntityIcon,
  KindBadge,
  ListingActionButton,
  ListingOwnerLine,
  OriginBadge,
  VerifiedBadge,
  listingActionState,
} from './marketplace-ui';
import { ItemCard, ItemRow, type MarketplaceLayout } from './marketplace-items';

const MAX_CAPABILITIES = 2;

interface MarketplaceCardProps {
  listing: MarketplaceListing;
  onSelect: (listing: MarketplaceListing) => void;
  onInstall?: (listing: MarketplaceListing) => void;
  onRequestAccess?: (listing: MarketplaceListing) => void;
  onConfigure?: (listing: MarketplaceListing) => void;
  /** Grid card (default) or a list row — the row must sit in an `ItemList`. */
  layout?: MarketplaceLayout;
  className?: string;
}

/** "Customer Support · Free · ★ 4.6 · 1.2k installs" — the listing's one meta line. */
function ListingSubtitle({ listing }: { listing: MarketplaceListing }) {
  const installs = listing.installCount ?? listing.installationCount ?? 0;
  const rating = listing.rating || listing.ratingAverage || 0;
  const parts: React.ReactNode[] = [];
  if (listing.category) parts.push(listing.category);
  parts.push(listing.pricingModel === 'FREE' ? 'Free' : 'Paid');
  if (listing.ratingCount) {
    parts.push(
      <span
        key="rating"
        className="gap-0.5 inline-flex items-center"
        title={`${listing.ratingCount} reviews`}
      >
        <Star className="size-3 fill-current text-accent-amber" aria-hidden />
        {rating.toFixed(1)}
      </span>,
    );
  }
  if (installs > 0) {
    parts.push(
      `${installs.toLocaleString()} install${installs === 1 ? '' : 's'}`,
    );
  }
  return (
    <>
      {parts.map((part, i) => (
        <React.Fragment key={i}>
          {i > 0 ? <span aria-hidden> · </span> : null}
          {part}
        </React.Fragment>
      ))}
    </>
  );
}

export const MarketplaceCard: React.FC<MarketplaceCardProps> = ({
  listing,
  onSelect,
  onInstall,
  onRequestAccess,
  onConfigure,
  layout = 'grid',
  className,
}) => {
  const capabilities = listing.capabilities ?? [];
  const isList = layout === 'list';

  // Cards lead their chip row with the kind (keeping the title full width);
  // list rows give it a column of its own instead.
  const chips = (
    <>
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
    </>
  );

  const slots = {
    icon: (
      <EntityIcon
        iconUrl={listing.iconUrl}
        kind={listing.kind}
        className={isList ? 'size-9' : 'size-10'}
      />
    ),
    name: listing.name,
    nameAdornment: <VerifiedBadge badge={listing.badge} />,
    subtitle: <ListingSubtitle listing={listing} />,
    corner: isList ? <KindBadge kind={listing.kind} /> : undefined,
    description: listing.tagline || listing.description || '',
    chips,
    meta: <ListingOwnerLine listing={listing} />,
    actions: (
      <ListingActionButton
        {...listingActionState(listing)}
        installedLabel={isList ? 'Configure' : 'Installed'}
        onInstall={() => onInstall?.(listing)}
        onRequestAccess={
          onRequestAccess ? () => onRequestAccess(listing) : undefined
        }
        onConfigure={() => onConfigure?.(listing)}
      />
    ),
    onOpen: () => onSelect(listing),
    className,
  };

  return isList ? <ItemRow {...slots} /> : <ItemCard {...slots} />;
};
