import React, { useState, useMemo } from 'react';
import type { MarketplaceListing, MarketplaceKind } from '@org/types';
import {
  AppSelect,
  Badge,
  Button,
  EmptyState,
  Toggle,
  ToggleGroup,
  ToggleGroupItem,
} from '@org/ui';
import { MarketplaceCard } from './MarketplaceCard';
import {
  EntityIcon,
  ListingActionButton,
  SectionTabs,
  VerifiedBadge,
  listingActionState,
} from './marketplace-ui';
import { LayoutGrid, List as ListIcon, RotateCcw, ShieldCheck } from 'lucide-react';

type PricingFilter = 'all' | 'free' | 'paid';
type SortBy = 'recommended' | 'popular' | 'rating' | 'alphabetical';

const PRICING_OPTIONS = [
  { value: 'all', label: 'All pricing' },
  { value: 'free', label: 'Free only' },
  { value: 'paid', label: 'Paid only' },
];

const SORT_OPTIONS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'popular', label: 'Most popular' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'alphabetical', label: 'Alphabetical' },
];

interface MarketplaceCatalogViewProps {
  listings: MarketplaceListing[];
  kind: MarketplaceKind; // 'APP' | 'AGENT' | 'ALL'
  searchQuery: string;
  onSelectListing: (listing: MarketplaceListing) => void;
  onInstall: (listing: MarketplaceListing) => void;
  onRequestAccess: (listing: MarketplaceListing) => void;
  onConfigure: (listing: MarketplaceListing) => void;
}

export const MarketplaceCatalogView: React.FC<MarketplaceCatalogViewProps> = ({
  listings,
  kind,
  searchQuery,
  onSelectListing,
  onInstall,
  onRequestAccess,
  onConfigure,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [pricingFilter, setPricingFilter] = useState<PricingFilter>('all');
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<SortBy>('recommended');
  const [isCompactList, setIsCompactList] = useState<boolean>(false);

  // Distinct categories among the listings this view actually shows
  const categories = useMemo(() => {
    const set = new Set<string>();
    listings.forEach((item) => {
      if ((kind === 'INTEGRATION' || kind === 'AGENT') && item.kind !== kind) return;
      if (item.category) set.add(item.category);
    });
    return Array.from(set).sort();
  }, [listings, kind]);

  // Filter items
  const filtered = useMemo(() => {
    return listings.filter((item) => {
      // Kind filter
      if (kind === 'INTEGRATION' && item.kind !== 'INTEGRATION') return false;
      if (kind === 'AGENT' && item.kind !== 'AGENT') return false;

      // Category filter
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }

      // Pricing filter
      if (pricingFilter === 'free' && item.pricingModel !== 'FREE') return false;
      if (pricingFilter === 'paid' && item.pricingModel === 'FREE') return false;

      // Verified filter
      if (verifiedOnly && item.badge !== 'OFFICIAL' && item.badge !== 'VERIFIED') {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = item.name.toLowerCase().includes(q);
        const matchesDesc = (item.description || '').toLowerCase().includes(q);
        const matchesTagline = (item.tagline || '').toLowerCase().includes(q);
        const matchesCategory = (item.category || '').toLowerCase().includes(q);
        const matchesTags = item.tags?.some((t) => t.toLowerCase().includes(q));
        const matchesCaps = item.capabilities?.some((c) => c.toLowerCase().includes(q));
        const matchesCmds = item.commands?.some((cmd) => cmd.command.toLowerCase().includes(q));

        if (
          !matchesName &&
          !matchesDesc &&
          !matchesTagline &&
          !matchesCategory &&
          !matchesTags &&
          !matchesCaps &&
          !matchesCmds
        ) {
          return false;
        }
      }

      return true;
    });
  }, [listings, kind, selectedCategory, pricingFilter, verifiedOnly, searchQuery]);

  // Sort items
  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sortBy === 'popular') {
      list.sort((a, b) => (b.installationCount || 0) - (a.installationCount || 0));
    } else if (sortBy === 'rating') {
      list.sort((a, b) => (b.ratingAverage || 0) - (a.ratingAverage || 0));
    } else if (sortBy === 'alphabetical') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [filtered, sortBy]);

  const hasActiveFilters =
    selectedCategory !== 'all' ||
    pricingFilter !== 'all' ||
    verifiedOnly ||
    Boolean(searchQuery);

  const resetFilters = () => {
    setSelectedCategory('all');
    setPricingFilter('all');
    setVerifiedOnly(false);
  };

  return (
    <div className="space-y-4 py-3">
      {/* Category chips: one scrollable row */}
      <div className="-mx-1 px-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <SectionTabs
          aria-label="Filter by category"
          value={selectedCategory}
          onValueChange={setSelectedCategory}
          items={[
            { value: 'all', label: 'All categories' },
            ...categories.map((cat) => ({ value: cat, label: cat })),
          ]}
          className="w-max flex-nowrap whitespace-nowrap"
        />
      </div>

      {/* Results + controls: count on the left, filters on the right */}
      <div className="gap-x-3 gap-y-2 pt-1 border-t border-border/50 flex flex-wrap items-center justify-between">
        <div className="gap-2 text-xs flex items-center text-muted-foreground">
          <span>
            Showing{' '}
            <span className="font-semibold text-foreground">{sorted.length}</span>{' '}
            {kind === 'AGENT' ? 'agents' : kind === 'INTEGRATION' ? 'apps' : 'items'}
          </span>
          {hasActiveFilters && (
            <Button variant="ghost" size="xs" onClick={resetFilters}>
              <RotateCcw aria-hidden />
              Reset
            </Button>
          )}
        </div>

        <div className="gap-2 flex flex-wrap items-center">
          <Toggle
            variant="outline"
            size="sm"
            pressed={verifiedOnly}
            onPressedChange={setVerifiedOnly}
          >
            <ShieldCheck className="mr-1.5" aria-hidden />
            Verified
          </Toggle>

          <AppSelect
            aria-label="Filter by pricing"
            size="sm"
            className="w-32"
            value={pricingFilter}
            onValueChange={(next) => setPricingFilter(next as PricingFilter)}
            options={PRICING_OPTIONS}
          />

          <AppSelect
            aria-label="Sort listings"
            size="sm"
            className="w-36"
            value={sortBy}
            onValueChange={(next) => setSortBy(next as SortBy)}
            options={SORT_OPTIONS}
          />

          <ToggleGroup
            type="single"
            size="sm"
            aria-label="Layout"
            value={isCompactList ? 'list' : 'grid'}
            onValueChange={(next) => {
              if (next) setIsCompactList(next === 'list');
            }}
          >
            <ToggleGroupItem value="grid" aria-label="Grid view" title="Grid view">
              <LayoutGrid aria-hidden />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view" title="List view">
              <ListIcon aria-hidden />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Items Rendering: Grid or Compact List */}
      {sorted.length === 0 ? (
        <EmptyState
          title="No integrations or agents found"
          description="Try adjusting your filters or search keywords to find what you need."
          action={
            hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : !isCompactList ? (
        <div className="md:grid-cols-2 lg:grid-cols-3 gap-4 grid grid-cols-1">
          {sorted.map((item) => (
            <MarketplaceCard
              key={item.id || item.slug}
              listing={item}
              onSelect={onSelectListing}
              onInstall={onInstall}
              onRequestAccess={onRequestAccess}
              onConfigure={onConfigure}
            />
          ))}
        </div>
      ) : (
        /* Compact list view */
        <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/60 bg-card">
          {sorted.map((item) => (
            <div
              key={item.id || item.slug}
              onClick={() => onSelectListing(item)}
              className="gap-4 p-3 flex cursor-pointer items-center justify-between transition-colors hover:bg-surface-raised/60"
            >
              <div className="min-w-0 gap-3 flex items-center">
                <EntityIcon
                  iconUrl={item.iconUrl}
                  kind={item.kind}
                  className="size-9"
                />
                <div className="min-w-0">
                  <div className="gap-2 flex items-center">
                    <span className="text-sm font-semibold truncate text-foreground">
                      {item.name}
                    </span>
                    <VerifiedBadge badge={item.badge} />
                    <Badge variant="neutral">{item.category}</Badge>
                  </div>
                  <p className="max-w-md text-xs truncate text-muted-foreground">
                    {item.tagline || item.description}
                  </p>
                </div>
              </div>

              <div
                className="gap-3 flex shrink-0 items-center"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-xs text-muted-foreground">
                  {item.pricingModel === 'FREE' ? 'Free' : 'Subscription'}
                </span>
                <ListingActionButton
                  {...listingActionState(item)}
                  installedLabel="Configure"
                  onInstall={() => onInstall(item)}
                  onRequestAccess={() => onRequestAccess(item)}
                  onConfigure={() => onConfigure(item)}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
