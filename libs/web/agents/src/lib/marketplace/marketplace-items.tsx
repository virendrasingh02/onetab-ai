import React, { useCallback, useId, useState, type ReactNode } from 'react';
import { Card, ToggleGroup, ToggleGroupItem } from '@org/ui';
import { cn } from '@org/utils';
import { LayoutGrid, List as ListIcon } from 'lucide-react';

/*
 * The layout pieces both marketplace tabs share: the grid/list switch, and the
 * one card + one row every item renders as. A listing from the catalog and an
 * agent this workspace already has fill the same slots, so the two tabs and
 * the two layouts always put the same things in the same places.
 */

/* ---------------------------------------------------------- grid / list ---- */

export type MarketplaceLayout = 'grid' | 'list';

const LAYOUT_STORAGE_KEY = 'marketplace.layout';

function readLayout(): MarketplaceLayout {
  try {
    return window.localStorage.getItem(LAYOUT_STORAGE_KEY) === 'list'
      ? 'list'
      : 'grid';
  } catch {
    return 'grid';
  }
}

/**
 * Grid or list, remembered per browser. Both tabs read the same key, so
 * switching to list on "Yours" keeps Discover in list too.
 */
export function useMarketplaceLayout(): [
  MarketplaceLayout,
  (next: MarketplaceLayout) => void,
] {
  const [layout, setLayoutState] = useState<MarketplaceLayout>(readLayout);
  const setLayout = useCallback((next: MarketplaceLayout) => {
    setLayoutState(next);
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, next);
    } catch {
      /* storage blocked: the choice lasts for this visit only */
    }
  }, []);
  return [layout, setLayout];
}

/** The grid / list switch every marketplace toolbar ends with. */
export function LayoutToggle({
  value,
  onValueChange,
}: {
  value: MarketplaceLayout;
  onValueChange: (next: MarketplaceLayout) => void;
}) {
  return (
    <ToggleGroup
      type="single"
      size="sm"
      aria-label="Layout"
      value={value}
      onValueChange={(next) => {
        if (next) onValueChange(next as MarketplaceLayout);
      }}
    >
      <ToggleGroupItem value="grid" aria-label="Grid view" title="Grid view">
        <LayoutGrid aria-hidden />
      </ToggleGroupItem>
      <ToggleGroupItem value="list" aria-label="List view" title="List view">
        <ListIcon aria-hidden />
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

/** Running / paused as a quiet dot + word, for card corners and list rows. */
export function StatusDot({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        'gap-1.5 text-xs font-medium inline-flex shrink-0 items-center',
        active ? 'text-success-text' : 'text-muted-foreground',
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          active ? 'bg-success' : 'bg-muted-foreground/60',
        )}
        aria-hidden
      />
      {active ? 'Active' : 'Paused'}
    </span>
  );
}

/* ------------------------------------------------------- item card / row ---- */

export interface ItemSlots {
  icon: ReactNode;
  name: string;
  /** Sits right after the name (verified mark). */
  nameAdornment?: ReactNode;
  /** One muted line under the name: type, category, pricing… */
  subtitle: ReactNode;
  /** Top-right on cards, before the actions on rows (kind badge, status). */
  corner?: ReactNode;
  description: string;
  /** One line of chips under the description (cards only). */
  chips?: ReactNode;
  /** Bottom-left of the card footer; a column of its own on wide list rows. */
  meta?: ReactNode;
  actions?: ReactNode;
  onOpen: () => void;
  className?: string;
}

const STRETCHED_BUTTON =
  'after:inset-0 block max-w-full truncate text-left outline-none after:absolute after:rounded-[inherit] focus-visible:after:ring-2 focus-visible:after:ring-ring/50';

export function ItemCard({
  icon,
  name,
  nameAdornment,
  subtitle,
  corner,
  description,
  chips,
  meta,
  actions,
  onOpen,
  className,
}: ItemSlots) {
  const descId = useId();
  return (
    // The name is a real button stretched over the card, so the whole card
    // opens the item without nesting the footer actions inside a control.
    <Card
      className={cn(
        'group gap-0 p-4 relative h-full transition-colors hover:border-border-strong hover:bg-surface-raised/40',
        className,
      )}
    >
      <div className="gap-3 flex items-start">
        {icon}
        <div className="min-w-0 flex-1">
          <div className="min-w-0 gap-1.5 flex items-center">
            <h3 className="min-w-0 text-sm font-semibold text-foreground">
              <button
                type="button"
                onClick={onOpen}
                aria-describedby={descId}
                title={name}
                className={STRETCHED_BUTTON}
              >
                {name}
              </button>
            </h3>
            {nameAdornment}
          </div>
          <div className="mt-0.5 text-xs truncate text-muted-foreground">
            {subtitle}
          </div>
        </div>
        {corner ? <div className="relative z-10 shrink-0">{corner}</div> : null}
      </div>

      <p
        id={descId}
        className="mt-3 min-h-10 text-xs leading-relaxed line-clamp-2 text-muted-foreground"
      >
        {description}
      </p>

      {chips ? (
        <div className="mt-3 gap-1.5 min-w-0 flex flex-nowrap items-center overflow-hidden">
          {chips}
        </div>
      ) : null}

      {/* Pushes the footer down so footers line up across a row. */}
      <div className="min-h-4 flex-1" aria-hidden />
      <div className="gap-3 pt-3 min-h-10 flex items-center justify-between border-t border-border/60">
        <div className="min-w-0 text-xs flex items-center text-muted-foreground">
          {meta}
        </div>
        {actions ? (
          <div className="gap-1 relative z-10 flex shrink-0 items-center">
            {actions}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function ItemRow({
  icon,
  name,
  nameAdornment,
  subtitle,
  corner,
  description,
  meta,
  actions,
  onOpen,
  className,
}: ItemSlots) {
  const descId = useId();
  return (
    <li
      className={cn(
        'gap-3 px-4 py-3 relative flex items-center transition-colors hover:bg-surface-raised/50',
        className,
      )}
    >
      {icon}
      <div className="min-w-0 flex-1">
        <div className="min-w-0 gap-1.5 flex items-center">
          <h3 className="min-w-0 text-sm font-semibold text-foreground">
            <button
              type="button"
              onClick={onOpen}
              aria-describedby={descId}
              title={name}
              className={STRETCHED_BUTTON}
            >
              {name}
            </button>
          </h3>
          {nameAdornment}
          <span className="min-w-0 text-xs sm:inline hidden truncate text-muted-foreground">
            <span aria-hidden className="mr-1.5">
              ·
            </span>
            {subtitle}
          </span>
        </div>
        <p
          id={descId}
          className="mt-0.5 text-xs truncate text-muted-foreground"
        >
          {description}
        </p>
      </div>
      {meta ? (
        <div className="w-44 min-w-0 text-xs lg:flex hidden shrink-0 items-center text-muted-foreground">
          {meta}
        </div>
      ) : null}
      {corner ? (
        <div className="md:flex w-24 relative z-10 hidden shrink-0 justify-end">
          {corner}
        </div>
      ) : null}
      {/* Always present, so rows without actions keep their columns aligned. */}
      <div className="min-w-20 gap-1 relative z-10 flex shrink-0 items-center justify-end">
        {actions}
      </div>
    </li>
  );
}

/** The bordered, divided container `ItemRow`s sit in. */
export function ItemList({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLUListElement>) {
  return (
    <ul
      className={cn(
        'shadow-2xs divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card',
        className,
      )}
      {...props}
    >
      {children}
    </ul>
  );
}
