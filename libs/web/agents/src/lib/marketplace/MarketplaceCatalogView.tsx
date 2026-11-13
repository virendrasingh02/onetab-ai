import React, { useState, useMemo } from 'react';
import type { MarketplaceListing, MarketplaceKind } from '@org/types';
import { AppSelect, Button, EmptyState, Toggle } from '@org/ui';
import { RotateCcw, ShieldCheck } from 'lucide-react';
import { MarketplaceCard } from './MarketplaceCard';
import { MarketplaceGrid } from './marketplace-ui';
import {
  ItemList,
  LayoutToggle,
  type MarketplaceLayout,
} from './marketplace-items';

type PricingFilter = 'all' | 'free' | 'paid';
type SortBy = 'recommended' | 'popular' | 'rating' | 'alphabetical';

const PRICING_OPTIONS = [
  { value: 'all', label: 'Any price' },
  { value: 'free', label: 'Free' },
  { value: 'paid', label: 'Paid' },
];

const SORT_OPTIONS = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'popular', label: 'Most popular' },
  { value: 'rating', label: 'Highest rated' },
  { value: 'alphabetical', label: 'A–Z' },
];

const NOUN: Record<string, string> = {
  AGENT: 'agents',
  INTEGRATION: 'apps',
  ALL: 'results',
};

interface MarketplaceCatalogViewProps {
  listings: MarketplaceListing[];
  /** Which listings to show; `ALL` keeps every kind. */
  kind: MarketplaceKind | 'ALL';
  searchQuery: string;
  layout: MarketplaceLayout;
  onLayoutChange: (next: MarketplaceLayout) => void;
  /** Left side of the toolbar (the Discover type filter). */
  toolbarStart?: React.ReactNode;
  onSelectListing: (listing: MarketplaceListing) => void;
  onInstall: (listing: MarketplaceListing) => void;
  onRequestAccess: (listing: MarketplaceListing) => void;
  onConfigure: (listing: MarketplaceListing) => void;
}

export function matchesListingSearch(
  item: MarketplaceListing,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    [item.name, item.description, item.tagline, item.category].some((t) =>
      (t || '').toLowerCase().includes(q),
    ) ||
    Boolean(item.tags?.some((t) => t.toLowerCase().includes(q))) ||
    Boolean(item.capabilities?.some((c) => c.toLowerCase().includes(q))) ||
    Boolean(item.commands?.some((c) => c.command.toLowerCase().includes(q)))
  );
}

export const MarketplaceCatalogView: React.FC<MarketplaceCatalogViewProps> = ({
  listings,
  kind,
  searchQuery,
  layout,
  onLayoutChange,
  toolbarStart,
  onSelectListing,
  onInstall,
  onRequestAccess,
  onConfigure,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [pricingFilter, setPricingFilter] = useState<PricingFilter>('all');
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<SortBy>('recommended');

  const ofKind = useMemo(
    () =>
      kind === 'ALL' ? listings : listings.filter((item) => item.kind === kind),
    [listings, kind],
  );

  // Distinct categories among the listings this view actually shows
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    ofKind.forEach((item) => item.category && set.add(item.category));
    return [
      { value: 'all', label: 'All categories' },
      ...Array.from(set)
        .sort()
        .map((cat) => ({ value: cat, label: cat })),
    ];
  }, [ofKind]);

  // A category that no longer exists under the new kind falls back to "all".
  const category = categoryOptions.some((o) => o.value === selectedCategory)
    ? selectedCategory
    : 'all';

  const sorted = useMemo(() => {
    const list = ofKind.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      if (pricingFilter === 'free' && item.pricingModel !== 'FREE')
        return false;
      if (pricingFilter === 'paid' && item.pricingModel === 'FREE')
        return false;
      if (
        verifiedOnly &&
        item.badge !== 'OFFICIAL' &&
        item.badge !== 'VERIFIED'
      )
        return false;
      return matchesListingSearch(item, searchQuery);
    });
    if (sortBy === 'popular') {
      list.sort(
        (a, b) =>
          (b.installCount ?? b.installationCount ?? 0) -
          (a.installCount ?? a.installationCount ?? 0),
      );
    } else if (sortBy === 'rating') {
      list.sort(
        (a, b) =>
          (b.rating || b.ratingAverage || 0) -
          (a.rating || a.ratingAverage || 0),
      );
    } else if (sortBy === 'alphabetical') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [ofKind, category, pricingFilter, verifiedOnly, searchQuery, sortBy]);

  const hasActiveFilters =
    category !== 'all' || pricingFilter !== 'all' || verifiedOnly;

  const resetFilters = () => {
    setSelectedCategory('all');
    setPricingFilter('all');
    setVerifiedOnly(false);
  };

  const renderItem = (item: MarketplaceListing) => (
    <MarketplaceCard
      key={item.id || item.slug}
      listing={item}
      layout={layout}
      onSelect={onSelectListing}
      onInstall={onInstall}
      onRequestAccess={onRequestAccess}
      onConfigure={onConfigure}
    />
  );

  return (
    <div className="space-y-4">
      {/* One toolbar: what to show on the left, how to show it on the right. */}
      <div className="gap-x-3 gap-y-2 flex flex-wrap items-center justify-between">
        <div className="min-w-0 gap-2 flex items-center">{toolbarStart}</div>
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
          {categoryOptions.length > 2 && (
            <AppSelect
              aria-label="Filter by category"
              size="sm"
              className="w-40"
              value={category}
              onValueChange={setSelectedCategory}
              options={categoryOptions}
            />
          )}
          <AppSelect
            aria-label="Filter by pricing"
            size="sm"
            className="w-28"
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
          <LayoutToggle value={layout} onValueChange={onLayoutChange} />
        </div>
      </div>

      {(hasActiveFilters || searchQuery.trim()) && sorted.length > 0 && (
        <div
          className="gap-2 text-xs flex items-center text-muted-foreground"
          role="status"
        >
          <span>
            <span className="font-semibold text-foreground">
              {sorted.length}
            </span>{' '}
            {NOUN[kind] ?? 'results'}
            {searchQuery.trim() ? ` matching “${searchQuery.trim()}”` : ''}
          </span>
          {hasActiveFilters && (
            <Button variant="ghost" size="xs" onClick={resetFilters}>
              <RotateCcw aria-hidden />
              Reset filters
            </Button>
          )}
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState
          title={`No ${NOUN[kind] ?? 'results'} found`}
          description={
            searchQuery.trim()
              ? `Nothing matches “${searchQuery.trim()}”. Try other keywords or clear the filters.`
              : 'Try adjusting the filters to see more.'
          }
          action={
            hasActiveFilters ? (
              <Button variant="outline" size="sm" onClick={resetFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      ) : layout === 'grid' ? (
        <MarketplaceGrid>{sorted.map(renderItem)}</MarketplaceGrid>
      ) : (
        <ItemList>{sorted.map(renderItem)}</ItemList>
      )}
    </div>
  );
};
