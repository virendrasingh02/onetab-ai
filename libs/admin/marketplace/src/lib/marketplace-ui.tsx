import type { Accent } from '@org/design-system';
import type {
  MarketplaceKind,
  MarketplaceListing,
  MarketplacePricingModel,
  MarketplaceSort,
} from '@org/types';
import {
  accentClasses,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Page,
  PageHeader,
  Panel,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  BadgeCheck,
  Check,
  Download,
  Package,
  RefreshCw,
  Search,
  Star,
} from 'lucide-react';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatCount(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString();
}

export function formatPrice(
  pricingModel: MarketplacePricingModel,
  priceCents: number,
): string {
  if (pricingModel === 'FREE') return 'Free';
  if (pricingModel === 'FREEMIUM') return 'Free plan';
  return `$${(priceCents / 100).toFixed(2)}/mo`;
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

export function ViewShell({ children }: { children: ReactNode }) {
  return <Page width="full">{children}</Page>;
}

/** Thin adapter over the shared `PageHeader`, keeping the storefront prop names. */
export function ViewHeader({
  title,
  description,
  icon,
  accent = 'blue',
  actions,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  accent?: Accent;
  actions?: ReactNode;
}) {
  return (
    <PageHeader
      title={title}
      description={description}
      icon={icon}
      accent={accent}
      actions={actions}
    />
  );
}

export { Panel };

export function RefreshButton({
  onClick,
  busy,
  label = 'Refresh',
}: {
  onClick: () => void;
  busy?: boolean;
  label?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={busy}
      leadingIcon={<RefreshCw className={cn(busy && 'animate-spin')} />}
    >
      {label}
    </Button>
  );
}

/**
 * One place that decides what a storefront shows while loading and after a
 * failure, so no screen renders an empty grid that looks like "nothing here"
 * when the request actually failed.
 */
export function QueryState({
  isLoading,
  error,
  isEmpty,
  emptyMessage = 'Nothing matches these filters yet.',
  onRetry,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  isEmpty?: boolean;
  emptyMessage?: string;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (isLoading) {
    return (
      <LoadingState className="py-16 flex-1" label="Loading the marketplace…" />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load the marketplace"
        description={
          error instanceof Error
            ? error.message
            : 'The request failed. Please try again.'
        }
        detail={error instanceof Error ? error.stack : undefined}
        onRetry={onRetry}
      />
    );
  }

  if (isEmpty) {
    return (
      <EmptyState
        className="py-16 flex-1"
        icon={<Package />}
        title="No results"
        description={emptyMessage}
      />
    );
  }

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Storefront controls
// ---------------------------------------------------------------------------

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search the marketplace…',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <Search
        aria-hidden
        className="left-2.5 size-3.5 pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-8 w-56 pl-8 text-xs"
      />
    </div>
  );
}

/**
 * Exclusive category filter.
 *
 * Exposed as a radio group rather than a row of buttons, so assistive
 * technology reports which filter is active and how many options exist.
 */
export function FilterChips({
  options,
  value,
  onChange,
  allLabel = 'All',
  label = 'Filter by category',
}: {
  options: readonly string[];
  value: string | null;
  onChange: (value: string | null) => void;
  allLabel?: string;
  label?: string;
}) {
  const chip = (active: boolean) =>
    cn(
      'px-2.5 py-1 text-xs font-medium rounded-full border',
      'transition-colors duration-(--duration-fast)',
      'focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none',
      active
        ? 'border-primary bg-primary text-primary-foreground'
        : 'bg-surface text-muted-foreground hover:border-border-strong',
    );

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="gap-1.5 flex flex-wrap"
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === null}
        onClick={() => onChange(null)}
        className={chip(value === null)}
      >
        {allLabel}
      </button>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={value === option}
          onClick={() => onChange(option)}
          className={chip(value === option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

const SORT_OPTIONS: { value: MarketplaceSort; label: string }[] = [
  { value: 'popular', label: 'Most installed' },
  { value: 'rating', label: 'Top rated' },
  { value: 'newest', label: 'Newest' },
  { value: 'name', label: 'A–Z' },
];

export function SortSelect({
  value,
  onChange,
}: {
  value: MarketplaceSort;
  onChange: (value: MarketplaceSort) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(next) => onChange(next as MarketplaceSort)}
    >
      <SelectTrigger size="sm" aria-label="Sort listings">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function Rating({ rating, count }: { rating: number; count: number }) {
  if (count === 0) {
    return <span className="text-xs text-muted-foreground">Not yet rated</span>;
  }
  return (
    <span className="gap-1 text-xs flex items-center text-warning">
      <Star className="size-3 fill-current" aria-hidden />
      {rating.toFixed(1)}
      <span className="text-muted-foreground">({count})</span>
      <span className="sr-only">out of 5, from {count} ratings</span>
    </span>
  );
}

export function PriceTag({ listing }: { listing: MarketplaceListing }) {
  const isPaid = listing.pricingModel === 'PAID';
  return (
    <Badge variant={isPaid ? 'warning' : 'neutral'} className="rounded-full">
      {formatPrice(listing.pricingModel, listing.priceCents)}
    </Badge>
  );
}

/** Accent per storefront, so the seven grids stay visually distinct. */
export const KIND_ACCENT: Record<MarketplaceKind, Accent> = {
  PLUGIN: 'blue',
  THEME: 'pink',
  AGENT: 'green',
  WORKFLOW: 'amber',
  COMPONENT: 'violet',
  INTEGRATION: 'cyan',
  TEMPLATE: 'rose',
};

/** Ready-made icon-chip classes for a listing kind. */
export const KIND_TONE: Record<MarketplaceKind, string> = Object.fromEntries(
  (Object.keys(KIND_ACCENT) as MarketplaceKind[]).map((kind) => [
    kind,
    accentClasses[KIND_ACCENT[kind]].soft,
  ]),
) as Record<MarketplaceKind, string>;

export const KIND_LABEL: Record<MarketplaceKind, string> = {
  PLUGIN: 'Plugin',
  THEME: 'Theme',
  AGENT: 'Agent',
  WORKFLOW: 'Workflow',
  COMPONENT: 'Component',
  INTEGRATION: 'Integration',
  TEMPLATE: 'Template',
};

/**
 * The card every storefront renders. `footer` lets a storefront add its own
 * preview (theme swatches, a component prop list) without forking the card.
 *
 * The install handlers are optional: installing is a workspace act, and the
 * admin console browses the catalogue without one. Omit them and the card
 * renders as a read-only catalogue entry rather than showing a button that
 * could not do anything.
 */
export function ListingCard({
  listing,
  icon,
  footer,
  busy,
  onInstall,
  onUninstall,
  onSelect,
}: {
  listing: MarketplaceListing;
  icon?: ReactNode;
  footer?: ReactNode;
  busy?: boolean;
  onInstall?: (listing: MarketplaceListing) => void;
  onUninstall?: (listing: MarketplaceListing) => void;
  onSelect?: (listing: MarketplaceListing) => void;
}) {
  const installed = listing.installed === true;
  const canInstall = !!onInstall && !!onUninstall;

  return (
    <Card className="p-5 h-full justify-between transition-colors duration-(--duration-fast) hover:border-border-strong">
      <div>
        <div className="mb-3 gap-2 flex items-start justify-between">
          <div className="min-w-0 gap-2 flex items-center">
            <span
              aria-hidden
              className={cn(
                'size-9 [&_svg]:size-4.5 flex shrink-0 items-center justify-center rounded-lg',
                KIND_TONE[listing.kind],
              )}
            >
              {icon ?? <Package />}
            </span>
            <div className="min-w-0">
              <h3 className="gap-1 text-sm font-semibold flex items-center truncate text-foreground">
                {onSelect ? (
                  <button
                    type="button"
                    onClick={() => onSelect(listing)}
                    className="truncate rounded-sm text-left hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                  >
                    {listing.name}
                  </button>
                ) : (
                  <span className="truncate">{listing.name}</span>
                )}
                {listing.isOfficial ? (
                  <BadgeCheck
                    className="size-3.5 shrink-0 text-accent-blue"
                    aria-label="Official listing"
                  />
                ) : null}
              </h3>
              <span className="text-xs text-muted-foreground">
                {listing.publisher?.name ?? 'Unknown publisher'} · v
                {listing.version}
              </span>
            </div>
          </div>
          <PriceTag listing={listing} />
        </div>

        <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
          {listing.tagline}
        </p>

        {footer}

        <div className="mt-3 mb-4 gap-2 flex items-center justify-between">
          <Rating rating={listing.rating} count={listing.ratingCount} />
          <span className="gap-1 text-xs flex items-center text-muted-foreground">
            <Download className="size-3" aria-hidden />
            {formatCount(listing.installCount)}
          </span>
        </div>
      </div>

      {canInstall ? (
        <Button
          type="button"
          variant={installed ? 'outline' : 'primary'}
          size="sm"
          className={cn(
            'w-full',
            installed &&
              'border-success/40 text-success hover:border-destructive/40 hover:text-destructive',
          )}
          loading={busy}
          leadingIcon={installed ? <Check /> : <Download />}
          onClick={() =>
            installed ? onUninstall?.(listing) : onInstall?.(listing)
          }
        >
          {installed ? 'Installed' : 'Install'}
          <span className="sr-only"> — {listing.name}</span>
        </Button>
      ) : (
        <p className="gap-2 py-2 text-xs font-medium flex w-full items-center justify-center rounded-md border bg-muted text-muted-foreground">
          <Download className="size-4" aria-hidden />
          {formatCount(listing.installCount)} install
          {listing.installCount === 1 ? '' : 's'}
        </p>
      )}
    </Card>
  );
}

export function Pagination({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  if (pageCount <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className="mt-6 gap-2 flex items-center justify-center"
    >
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </Button>
      <span aria-current="page" className="text-xs text-muted-foreground">
        Page {page} of {pageCount}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
      >
        Next
      </Button>
    </nav>
  );
}
