import type { MarketplaceKind, MarketplaceListing } from '@org/types';
import { useState, type ReactNode } from 'react';
import {
  FilterChips,
  ListingCard,
  Pagination,
  QueryState,
  RefreshButton,
  SearchInput,
  SortSelect,
  ViewHeader,
  ViewShell,
} from './marketplace-ui.js';
import {
  useCategories,
  useInstallListing,
  useListings,
  useUninstallListing,
} from './use-marketplace.js';

export interface StorefrontProps {
  kind: MarketplaceKind;
  title: string;
  description: string;
  icon: ReactNode;
  /** Per-listing icon, so each storefront can speak its own visual language. */
  listingIcon?: (listing: MarketplaceListing) => ReactNode;
  /** Kind-specific preview rendered inside the card (swatches, props, steps). */
  renderPreview?: (listing: MarketplaceListing) => ReactNode;
  /**
   * Ask the browse call for each listing's payload. Only storefronts whose
   * cards preview the payload pay for the extra bytes.
   */
  includePayload?: boolean;
  /** Scopes requested when installing from this storefront. */
  grantedScopes?: (listing: MarketplaceListing) => string[];
  emptyMessage?: string;
  /** Extra content above the grid — used by the plugin developer console. */
  children?: ReactNode;
}

/**
 * The shared body of all seven storefronts.
 *
 * Every storefront is the same browse-filter-install loop over a different
 * `kind`, so the differences are injected (icons, previews, install scopes)
 * rather than reimplemented seven times.
 */
export function Storefront({
  kind,
  title,
  description,
  icon,
  listingIcon,
  renderPreview,
  includePayload,
  grantedScopes,
  emptyMessage,
  children,
}: StorefrontProps) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<'popular' | 'rating' | 'newest' | 'name'>(
    'popular',
  );
  const [page, setPage] = useState(1);
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);

  const categories = useCategories(kind);
  const listings = useListings({
    kind,
    category: category ?? undefined,
    search: search.trim() || undefined,
    sort,
    page,
    includePayload,
  });

  const install = useInstallListing();
  const uninstall = useUninstallListing();

  const onInstall = (listing: MarketplaceListing) => {
    setPendingSlug(listing.slug);
    install.mutate(
      {
        listingSlug: listing.slug,
        grantedScopes: grantedScopes?.(listing) ?? [],
      },
      { onSettled: () => setPendingSlug(null) },
    );
  };

  const onUninstall = (listing: MarketplaceListing) => {
    setPendingSlug(listing.slug);
    uninstall.mutate(listing.slug, { onSettled: () => setPendingSlug(null) });
  };

  // Any filter change restarts paging — page 4 of the old filter is meaningless.
  const withReset =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  const data = listings.data;

  return (
    <ViewShell>
      <ViewHeader
        icon={icon}
        title={title}
        description={description}
        actions={
          <>
            <SearchInput
              value={search}
              onChange={withReset(setSearch)}
              placeholder={`Search ${title.toLowerCase()}…`}
            />
            <SortSelect value={sort} onChange={withReset(setSort)} />
            <RefreshButton
              onClick={() => listings.refetch()}
              busy={listings.isFetching}
            />
          </>
        }
      />

      {children}

      {categories.data && categories.data.length > 0 ? (
        <div className="mb-5">
          <FilterChips
            options={categories.data.map((row) => row.category)}
            value={category}
            onChange={withReset(setCategory)}
            allLabel={`All (${data?.total ?? 0})`}
          />
        </div>
      ) : null}

      <QueryState
        isLoading={listings.isLoading}
        error={listings.error}
        isEmpty={data?.items.length === 0}
        emptyMessage={emptyMessage}
      >
        {data ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {data.items.map((listing) => (
                <ListingCard
                  key={listing.id}
                  listing={listing}
                  icon={listingIcon?.(listing)}
                  footer={renderPreview?.(listing)}
                  busy={pendingSlug === listing.slug}
                  onInstall={onInstall}
                  onUninstall={onUninstall}
                />
              ))}
            </div>
            <Pagination
              page={data.page}
              pageCount={data.pageCount}
              onChange={setPage}
            />
          </>
        ) : null}
      </QueryState>
    </ViewShell>
  );
}
