import type {
  MarketplaceKind,
  MarketplaceListing,
  MarketplacePricingModel,
  MarketplaceSort,
} from '@org/types';
import {
  AlertTriangle,
  BadgeCheck,
  Check,
  Download,
  Loader2,
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
  return (
    <div className="p-6 text-white min-h-screen bg-slate-950 flex flex-col">
      {children}
    </div>
  );
}

export function ViewHeader({
  title,
  description,
  icon,
  actions,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          {icon} {title}
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">{description}</p>
      </div>
      {actions ? (
        <div className="flex items-center gap-2 flex-wrap">{actions}</div>
      ) : null}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-slate-900/60 border border-slate-800 rounded-xl p-5 ${className}`}
    >
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            {title ? (
              <h3 className="font-bold text-sm text-slate-100">{title}</h3>
            ) : null}
            {subtitle ? (
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            ) : null}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

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
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 rounded-lg text-xs text-slate-300 flex items-center gap-1.5 transition"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
      {label}
    </button>
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
  children,
}: {
  isLoading: boolean;
  error: unknown;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="flex-1 grid place-items-center py-16 text-slate-400">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading the marketplace…
        </div>
      </div>
    );
  }

  if (error) {
    const message =
      error instanceof Error ? error.message : 'The request failed.';
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-5 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-300">
            Could not load the marketplace
          </p>
          <p className="text-xs text-red-400/80 mt-0.5">{message}</p>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="flex-1 grid place-items-center py-16 text-slate-500">
        <div className="text-center">
          <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">{emptyMessage}</p>
        </div>
      </div>
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
      <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-56 pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 focus:border-slate-600 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 outline-none transition"
      />
    </div>
  );
}

export function FilterChips({
  options,
  value,
  onChange,
  allLabel = 'All',
}: {
  options: readonly string[];
  value: string | null;
  onChange: (value: string | null) => void;
  allLabel?: string;
}) {
  const chip = (active: boolean) =>
    `px-2.5 py-1 rounded-full text-[11px] font-medium border transition ${
      active
        ? 'bg-blue-600 border-blue-500 text-white'
        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
    }`;

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={chip(value === null)}
      >
        {allLabel}
      </button>
      {options.map((option) => (
        <button
          key={option}
          type="button"
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
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as MarketplaceSort)}
      aria-label="Sort listings"
      className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 outline-none focus:border-slate-600"
    >
      {SORT_OPTIONS.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function Rating({
  rating,
  count,
}: {
  rating: number;
  count: number;
}) {
  if (count === 0) {
    return <span className="text-[11px] text-slate-600">Not yet rated</span>;
  }
  return (
    <span className="flex items-center gap-1 text-[11px] text-amber-400">
      <Star className="w-3 h-3 fill-current" />
      {rating.toFixed(1)}
      <span className="text-slate-600">({count})</span>
    </span>
  );
}

export function PriceTag({ listing }: { listing: MarketplaceListing }) {
  const isPaid = listing.pricingModel === 'PAID';
  return (
    <span
      className={`px-2 py-0.5 border text-[10px] font-semibold rounded-full whitespace-nowrap ${
        isPaid
          ? 'bg-amber-950/60 border-amber-500/40 text-amber-400'
          : 'bg-slate-800 border-slate-700 text-slate-400'
      }`}
    >
      {formatPrice(listing.pricingModel, listing.priceCents)}
    </span>
  );
}

/** Accent colour per storefront, so the seven grids stay visually distinct. */
export const KIND_TONE: Record<MarketplaceKind, string> = {
  PLUGIN: 'text-blue-400',
  THEME: 'text-pink-400',
  AGENT: 'text-emerald-400',
  WORKFLOW: 'text-amber-400',
  COMPONENT: 'text-purple-400',
  INTEGRATION: 'text-cyan-400',
  TEMPLATE: 'text-rose-400',
};

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
    <div className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between transition shadow-lg">
      <div>
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`p-2 bg-slate-800 rounded-lg ${KIND_TONE[listing.kind]}`}>
              {icon ?? <Package className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-slate-100 text-sm flex items-center gap-1 truncate">
                {onSelect ? (
                  <button
                    type="button"
                    onClick={() => onSelect(listing)}
                    className="truncate hover:underline text-left"
                  >
                    {listing.name}
                  </button>
                ) : (
                  <span className="truncate">{listing.name}</span>
                )}
                {listing.isOfficial ? (
                  <BadgeCheck
                    className="w-3.5 h-3.5 text-blue-400 shrink-0"
                    aria-label="Official listing"
                  />
                ) : null}
              </h3>
              <span className="text-[11px] text-slate-500">
                {listing.publisher?.name ?? 'Unknown publisher'} · v
                {listing.version}
              </span>
            </div>
          </div>
          <PriceTag listing={listing} />
        </div>

        <p className="text-xs text-slate-300 mb-3 leading-relaxed">
          {listing.tagline}
        </p>

        {footer}

        <div className="flex items-center justify-between gap-2 mb-4 mt-3">
          <Rating rating={listing.rating} count={listing.ratingCount} />
          <span className="flex items-center gap-1 text-[11px] text-slate-500">
            <Download className="w-3 h-3" />
            {formatCount(listing.installCount)}
          </span>
        </div>
      </div>

      {canInstall ? (
        <button
          type="button"
          disabled={busy}
          title={installed ? `Remove ${listing.name}` : `Install ${listing.name}`}
          onClick={() =>
            installed ? onUninstall?.(listing) : onInstall?.(listing)
          }
          className={`w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition disabled:opacity-60 ${
            installed
              ? 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 hover:bg-red-950/60 hover:border-red-500/40 hover:text-red-400'
              : 'bg-blue-600 hover:bg-blue-500 text-white shadow'
          }`}
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : installed ? (
            <Check className="w-4 h-4" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {installed ? 'Installed' : 'Install'}
        </button>
      ) : (
        <div className="w-full py-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 bg-slate-800/60 border border-slate-700 text-slate-400">
          <Download className="w-4 h-4" />
          {formatCount(listing.installCount)} install
          {listing.installCount === 1 ? '' : 's'}
        </div>
      )}
    </div>
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

  const button =
    'px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 disabled:opacity-40 rounded-lg text-xs text-slate-300 transition';

  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button
        type="button"
        className={button}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        Previous
      </button>
      <span className="text-xs text-slate-500">
        Page {page} of {pageCount}
      </span>
      <button
        type="button"
        className={button}
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
      >
        Next
      </button>
    </div>
  );
}
