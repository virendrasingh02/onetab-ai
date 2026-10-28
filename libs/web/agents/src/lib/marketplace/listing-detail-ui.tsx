/**
 * Building blocks for the marketplace detail pages. The app and agent pages
 * render the same header, section rhythm and facts rail from here, so the two
 * cannot drift apart in spacing, type sizes or wording.
 */
import type { ReactNode } from 'react';
import type {
  IntegrationCommand,
  MarketplaceListing,
} from '@org/types';
import { Button, Card, Skeleton, SkeletonList } from '@org/ui';
import { cn, formatDate } from '@org/utils';
import { ArrowLeft, Check, Download, Star, Terminal } from 'lucide-react';
import { EntityIcon } from './marketplace-ui';

/* ---------------------------------------------------------------- helpers ---- */

export function listingPublisher(
  listing: Pick<MarketplaceListing, 'publisher' | 'publisherName'>,
): string {
  return listing.publisher?.name || listing.publisherName || 'Onetab AI';
}

export function listingPricing(
  listing: Pick<MarketplaceListing, 'pricingModel' | 'priceCents'>,
): string {
  if (listing.pricingModel === 'FREEMIUM') return 'Free plan available';
  if (listing.pricingModel === 'PAID') {
    return listing.priceCents
      ? `$${(listing.priceCents / 100).toFixed(2)} / month`
      : 'Paid';
  }
  return 'Free';
}

function safeDate(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : formatDate(date);
}

/* ----------------------------------------------------------------- layout ---- */

export function ListingDetailSkeleton() {
  return (
    <div className="max-w-6xl mx-auto py-4 space-y-6">
      <Skeleton className="h-8 w-40 rounded-lg" />
      <div className="flex items-start gap-4">
        <Skeleton className="size-14 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-72 rounded-lg" />
          <Skeleton className="h-4 w-96 max-w-full rounded-lg" />
        </div>
      </div>
      <SkeletonList rows={4} />
    </div>
  );
}

export interface ListingDetailLayoutProps {
  backLabel: string;
  onBack: () => void;
  header: ReactNode;
  tabs: ReactNode;
  children: ReactNode;
  rail: ReactNode;
}

/** Back link, header, then a tabbed main column beside a sticky facts rail. */
export function ListingDetailLayout({
  backLabel,
  onBack,
  header,
  tabs,
  children,
  rail,
}: ListingDetailLayoutProps) {
  return (
    <div className="max-w-6xl mx-auto py-4 space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 text-muted-foreground">
        <ArrowLeft aria-hidden />
        {backLabel}
      </Button>

      {header}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-6">
          {tabs}
          {children}
        </div>
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">{rail}</aside>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- header ---- */

export interface ListingDetailHeaderProps {
  listing: MarketplaceListing;
  /** Kind / verification / origin chips beside the name. */
  badges?: ReactNode;
  /** Primary actions, right-aligned on wide screens. */
  actions?: ReactNode;
}

export function ListingDetailHeader({ listing, badges, actions }: ListingDetailHeaderProps) {
  const installs = listing.installCount ?? listing.installationCount ?? 0;
  const rating = listing.rating || listing.ratingAverage || 0;

  return (
    <header className="flex flex-col gap-5 border-b border-border/70 pb-6 md:flex-row md:items-start md:justify-between">
      <div className="flex min-w-0 items-start gap-4">
        <EntityIcon iconUrl={listing.iconUrl} kind={listing.kind} className="size-14" />
        <div className="min-w-0 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground break-words">
            {listing.name}
          </h1>
          {badges ? <div className="flex flex-wrap items-center gap-1.5">{badges}</div> : null}
          {(listing.tagline || listing.description) && (
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {listing.tagline || listing.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>
              By <span className="font-medium text-foreground">{listingPublisher(listing)}</span>
            </span>
            <MetaDot />
            <span>{listing.category}</span>
            <MetaDot />
            <span className="font-mono">v{listing.version || '1.0.0'}</span>
            {installs > 0 && (
              <>
                <MetaDot />
                <span className="inline-flex items-center gap-1">
                  <Download className="size-3" aria-hidden />
                  {installs.toLocaleString()} installs
                </span>
              </>
            )}
            {listing.ratingCount ? (
              <>
                <MetaDot />
                <span className="inline-flex items-center gap-1" title={`${listing.ratingCount} reviews`}>
                  <Star className="size-3 fill-current text-accent-amber" aria-hidden />
                  {rating.toFixed(1)} ({listing.ratingCount})
                </span>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">{actions}</div>
      ) : null}
    </header>
  );
}

function MetaDot() {
  return (
    <span aria-hidden className="text-border">
      •
    </span>
  );
}

/* --------------------------------------------------------------- sections ---- */

export function DetailSection({
  title,
  description,
  icon,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('space-y-3', className)}>
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {icon}
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** Long-form description. Skipped when it only repeats the header tagline. */
export function DetailDescription({ listing }: { listing: MarketplaceListing }) {
  const body = listing.description?.trim();
  if (!body || body === listing.tagline?.trim()) return null;
  return (
    <p className="max-w-3xl whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
      {body}
    </p>
  );
}

export function CheckGrid({ items }: { items: string[] }) {
  return (
    <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      {items.map((item) => (
        <li
          key={item}
          className="flex items-start gap-2.5 rounded-xl border border-border/70 bg-surface p-3.5 text-sm text-foreground"
        >
          <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Check className="size-3 text-primary-text" aria-hidden />
          </span>
          <span className="leading-snug">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function CommandList({
  commands,
  emptyText,
}: {
  commands?: IntegrationCommand[];
  emptyText: string;
}) {
  if (!commands || commands.length === 0) {
    return <EmptyNote>{emptyText}</EmptyNote>;
  }
  return (
    <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-surface">
      {commands.map((cmd) => (
        <div key={cmd.command} className="flex items-start gap-3 p-4">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-raised">
            <Terminal className="size-3.5 text-primary-text" aria-hidden />
          </span>
          <div className="min-w-0 space-y-0.5">
            <code className="font-mono text-sm font-semibold text-foreground">
              {cmd.command}
              {cmd.args ? <span className="font-normal text-muted-foreground"> {cmd.args}</span> : null}
            </code>
            <p className="text-sm text-muted-foreground">{cmd.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export interface InfoRow {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
}

/** Labelled rows in one bordered panel, e.g. the security & data breakdown. */
export function InfoPanel({ rows }: { rows: InfoRow[] }) {
  return (
    <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-surface">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start gap-3 p-4">
          {row.icon ? (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-muted-foreground [&_svg]:size-3.5">
              {row.icon}
            </span>
          ) : null}
          <div className="min-w-0 space-y-0.5">
            <h3 className="text-sm font-medium text-foreground">{row.label}</h3>
            <div className="text-sm text-muted-foreground">{row.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border/80 px-4 py-3 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

/* ------------------------------------------------------------- facts rail ---- */

export interface FactRow {
  label: string;
  value: ReactNode;
  mono?: boolean;
  tone?: 'success';
}

/** Rail card of label/value facts. Rows without a value are dropped. */
export function FactsCard({
  title,
  rows,
  footer,
}: {
  title: string;
  rows: FactRow[];
  footer?: ReactNode;
}) {
  return (
    <Card className="gap-0 p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <dl className="mt-2 divide-y divide-border/60 text-sm">
        {rows
          .filter((row) => row.value !== null && row.value !== undefined && row.value !== '')
          .map((row) => (
            <div key={row.label} className="flex items-start justify-between gap-4 py-2.5">
              <dt className="shrink-0 text-muted-foreground">{row.label}</dt>
              <dd
                className={cn(
                  'min-w-0 text-right font-medium text-foreground',
                  row.mono && 'font-mono',
                  row.tone === 'success' && 'text-success-text',
                )}
              >
                {row.value}
              </dd>
            </div>
          ))}
      </dl>
      {footer ? <div className="mt-2 border-t border-border/60 pt-4">{footer}</div> : null}
    </Card>
  );
}

/** The facts every listing shares; pages prepend/append their own. */
export function commonFacts(
  listing: MarketplaceListing & { updatedAt?: string },
): Record<'publisher' | 'category' | 'version' | 'pricing' | 'updated', FactRow> {
  const pricing = listingPricing(listing);
  return {
    publisher: { label: 'Publisher', value: listingPublisher(listing) },
    category: { label: 'Category', value: listing.category },
    version: { label: 'Version', value: listing.version || '1.0.0', mono: true },
    pricing: { label: 'Pricing', value: pricing, tone: pricing === 'Free' ? 'success' : undefined },
    updated: { label: 'Last updated', value: safeDate(listing.updatedAt) },
  };
}
