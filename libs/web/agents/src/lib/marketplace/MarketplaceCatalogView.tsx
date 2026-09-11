import React, { useState, useMemo } from 'react';
import type { MarketplaceListing, MarketplaceKind } from '@org/types';
import { Button, EmptyState } from '@org/ui';
import { MarketplaceCard, renderEntityIcon } from './MarketplaceCard';
import {
  Grid,
  List as ListIcon,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@org/utils';

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
  const [pricingFilter, setPricingFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'recommended' | 'popular' | 'rating' | 'alphabetical'>('recommended');
  const [isCompactList, setIsCompactList] = useState<boolean>(false);

  // Extract all distinct categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    listings.forEach((item) => {
      if (item.category) set.add(item.category);
    });
    return Array.from(set).sort();
  }, [listings]);

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
    <div className="space-y-6 py-3">
      {/* Filter Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-4">
        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
              selectedCategory === 'all'
                ? 'bg-foreground text-background font-semibold'
                : 'bg-surface-raised border border-border/80 text-muted-foreground hover:text-foreground',
            )}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                selectedCategory === cat
                  ? 'bg-foreground text-background font-semibold'
                  : 'bg-surface-raised border border-border/80 text-muted-foreground hover:text-foreground',
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Secondary controls: Verified toggle, Pricing, Sort, Layout */}
        <div className="flex items-center gap-2.5 self-end md:self-auto flex-wrap">
          {/* Verified toggle button */}
          <button
            type="button"
            onClick={() => setVerifiedOnly(!verifiedOnly)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              verifiedOnly
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold'
                : 'bg-surface border-border/80 text-muted-foreground hover:text-foreground',
            )}
          >
            <ShieldCheck className="size-3.5" />
            Verified only
          </button>

          {/* Pricing dropdown */}
          <select
            value={pricingFilter}
            onChange={(e) => setPricingFilter(e.target.value as any)}
            className="text-xs bg-surface border border-border/80 text-muted-foreground rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Pricing</option>
            <option value="free">Free Only</option>
            <option value="paid">Paid Only</option>
          </select>

          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="text-xs bg-surface border border-border/80 text-muted-foreground rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="recommended">Recommended</option>
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="alphabetical">Alphabetical</option>
          </select>

          {/* Grid / List toggle */}
          <div className="flex items-center rounded-lg border border-border/80 p-0.5 bg-surface-raised">
            <button
              type="button"
              onClick={() => setIsCompactList(false)}
              className={cn(
                'p-1 rounded-md text-muted-foreground hover:text-foreground',
                !isCompactList && 'bg-surface text-foreground shadow-xs',
              )}
              title="Grid view"
            >
              <Grid className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsCompactList(true)}
              className={cn(
                'p-1 rounded-md text-muted-foreground hover:text-foreground',
                isCompactList && 'bg-surface text-foreground shadow-xs',
              )}
              title="List view"
            >
              <ListIcon className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Results Count & Active Filter Indicator */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Showing <span className="font-semibold text-foreground">{sorted.length}</span>{' '}
          {kind === 'AGENT' ? 'agents' : kind === 'INTEGRATION' ? 'apps' : 'items'}
        </span>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
          >
            <RotateCcw className="size-3" />
            Reset all filters
          </button>
        )}
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
        /* Compact List View */
        <div className="divide-y divide-border/60 rounded-xl border border-border/80 bg-surface overflow-hidden">
          {sorted.map((item) => {
            const isInstalled = Boolean(item.installed);
            return (
              <div
                key={item.id || item.slug}
                onClick={() => onSelectListing(item)}
                className="flex items-center justify-between p-3.5 hover:bg-surface-raised/60 transition-colors cursor-pointer gap-4"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {renderEntityIcon(item.iconUrl ?? undefined, item.kind, 'size-9')}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {item.name}
                      </span>
                      {item.badge === 'OFFICIAL' && (
                        <ShieldCheck className="size-3.5 text-primary" />
                      )}
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-surface-raised border border-border/70 text-muted-foreground">
                        {item.category}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate max-w-md">
                      {item.tagline || item.description}
                    </p>
                  </div>
                </div>

                <div
                  className="flex items-center gap-3 flex-shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="text-xs text-muted-foreground">
                    {item.pricingModel === 'FREE' ? 'Free' : 'Subscription'}
                  </span>
                  {isInstalled ? (
                    <Button
                      variant="outline"
                      size="xs"
                      className="text-xs border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                      onClick={() => onConfigure(item)}
                    >
                      Configure
                    </Button>
                  ) : item.requiresAdmin ? (
                    <Button
                      variant="outline"
                      size="xs"
                      className="text-xs"
                      onClick={() => onRequestAccess(item)}
                    >
                      Request
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="xs"
                      className="text-xs"
                      onClick={() => onInstall(item)}
                    >
                      Install
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
