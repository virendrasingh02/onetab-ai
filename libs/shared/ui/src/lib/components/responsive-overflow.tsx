import { cn } from '@org/utils';
import { ChevronDown, MoreHorizontal, Check } from 'lucide-react';
import {
  Children,
  Fragment,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './dropdown-menu.js';

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/** Sub-pixel slack so a row that fits exactly isn't bumped by float rounding. */
const FIT_EPSILON = 0.5;

export interface ResponsiveOverflowItem {
  id?: string;
  label?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  count?: number | string;
  disabled?: boolean;
  onClick?: () => void;
  [key: string]: unknown;
}

export interface ResponsiveOverflowProps<T = ResponsiveOverflowItem>
  extends Omit<ComponentPropsWithoutRef<'div'>, 'children'> {
  items?: T[];
  /** Renders an item in the visible row. */
  renderItem?: (item: T, index: number) => ReactNode;
  /**
   * Renders the hidden copy of an item that is measured to decide what fits.
   * Defaults to `renderItem`. Override it when `renderItem` returns something
   * that must not exist twice — e.g. a Radix tab trigger, whose copy would
   * join the tablist's roving-focus group — with a look-alike element.
   */
  renderMeasureItem?: (item: T, index: number) => ReactNode;
  renderOverflowItem?: (item: T, index: number, close: () => void) => ReactNode;
  renderOverflowTrigger?: (
    overflowItems: T[],
    isChildActive: boolean,
    isOpen: boolean,
  ) => ReactNode;
  isItemActive?: (item: T, index: number) => boolean;
  getItemId?: (item: T, index: number) => string;
  children?: ReactNode;
  gap?: number;
  overflowLabel?: ReactNode;
  overflowIcon?: ReactNode;
  overflowMenuSide?: 'top' | 'bottom' | 'left' | 'right';
  overflowMenuAlign?: 'start' | 'center' | 'end';
  /** Swap the active item into the visible row when it would overflow. */
  prioritizeActiveTab?: boolean;
  minVisibleItems?: number;
  maxVisibleItems?: number;
  onOverflowChange?: (overflowCount: number, visibleCount: number) => void;
  as?: ElementType;
  /** Classes for the flex row that holds the visible items + "More". */
  rowClassName?: string;
  triggerClassName?: string;
  menuContentClassName?: string;
  /**
   * Re-measure when this changes. Item widths are re-read whenever `items` /
   * `children` change and whenever a rendered copy resizes; pass the active
   * value here when being active changes an item's width (e.g. bold labels).
   */
  measureKey?: unknown;
}

export interface OverflowLayoutInput {
  /** Width the row may use, px. `<= 0` means "not measured yet". */
  containerWidth: number;
  /** Natural width of every item, px, in order. */
  itemWidths: number[];
  /** Natural width of the "More" trigger, px. */
  moreWidth: number;
  gap: number;
  minVisibleItems?: number;
  maxVisibleItems?: number;
  /** Index of the active item, or -1. */
  activeIndex?: number;
  keepActiveVisible?: boolean;
}

export interface OverflowLayout {
  visible: number[];
  overflow: number[];
}

function rowWidth(indices: number[], widths: number[], gap: number): number {
  let total = 0;
  indices.forEach((idx, i) => {
    total += (widths[idx] ?? 0) + (i > 0 ? gap : 0);
  });
  return total;
}

/**
 * Splits items into the ones that fit on the row and the ones that go in the
 * "More" menu. Pure, so it is unit-tested directly.
 */
export function computeOverflowLayout({
  containerWidth,
  itemWidths,
  moreWidth,
  gap,
  minVisibleItems = 0,
  maxVisibleItems,
  activeIndex = -1,
  keepActiveVisible = false,
}: OverflowLayoutInput): OverflowLayout {
  const total = itemWidths.length;
  const all = itemWidths.map((_, idx) => idx);
  const cap = maxVisibleItems === undefined ? total : Math.max(0, maxVisibleItems);

  let count: number;
  if (containerWidth <= 0) {
    // Not measured (first render, SSR, jsdom): honour only the explicit cap.
    count = Math.min(total, Math.max(cap, Math.min(minVisibleItems, total)));
  } else if (
    cap >= total &&
    rowWidth(all, itemWidths, gap) <= containerWidth + FIT_EPSILON
  ) {
    count = total;
  } else {
    const available = containerWidth - moreWidth - gap;
    let used = 0;
    count = 0;
    for (let i = 0; i < total; i++) {
      const next = used + itemWidths[i] + (count > 0 ? gap : 0);
      if (next > available + FIT_EPSILON) break;
      used = next;
      count++;
    }
    count = Math.min(Math.max(minVisibleItems, count), cap, total);
  }

  let visible = all.slice(0, count);

  if (
    keepActiveVisible &&
    activeIndex >= count &&
    activeIndex < total &&
    (count > 0 || minVisibleItems > 0)
  ) {
    // Make room for the active item by dropping trailing visible items.
    const available =
      containerWidth > 0 ? containerWidth - moreWidth - gap : Infinity;
    const activeWidth = itemWidths[activeIndex] ?? 0;
    const kept = [...visible];
    while (
      kept.length > 0 &&
      kept.length + 1 > Math.max(1, minVisibleItems) &&
      rowWidth(kept, itemWidths, gap) + gap + activeWidth >
        available + FIT_EPSILON
    ) {
      kept.pop();
    }
    // Never show more than the caller allows.
    while (kept.length + 1 > Math.max(1, cap) && kept.length > 0) kept.pop();
    visible = [...kept, activeIndex];
  }

  const shown = new Set(visible);
  return { visible, overflow: all.filter((idx) => !shown.has(idx)) };
}

function contentBoxWidth(el: HTMLElement): number {
  const style = window.getComputedStyle(el);
  const chrome =
    (parseFloat(style.paddingLeft) || 0) +
    (parseFloat(style.paddingRight) || 0) +
    (parseFloat(style.borderLeftWidth) || 0) +
    (parseFloat(style.borderRightWidth) || 0);
  return Math.max(0, el.getBoundingClientRect().width - chrome);
}

function sameWidths(a: number[], b: number[]): boolean {
  return (
    a.length === b.length && a.every((w, i) => Math.abs(w - b[i]) < 0.01)
  );
}

/**
 * A single row of items that shows as many as fit and folds the rest into a
 * "More" dropdown.
 *
 * Every item is also rendered into an invisible, zero-height row that stays in
 * layout flow. That copy is what gets measured, and it keeps the component's
 * natural width equal to *all* items — so in a shrink-to-fit parent (a flex
 * item, a `w-fit` tray) the row still gets its full width back when space
 * frees up, instead of staying collapsed at "visible items + More".
 */
export function ResponsiveOverflow<T = ResponsiveOverflowItem>({
  items,
  renderItem,
  renderMeasureItem,
  renderOverflowItem,
  renderOverflowTrigger,
  isItemActive,
  getItemId,
  children,
  gap = 4,
  overflowLabel = 'More',
  overflowIcon,
  overflowMenuSide = 'bottom',
  overflowMenuAlign = 'end',
  prioritizeActiveTab = false,
  minVisibleItems = 0,
  maxVisibleItems,
  onOverflowChange,
  as: Component = 'div',
  className,
  rowClassName,
  triggerClassName,
  menuContentClassName,
  measureKey,
  ...props
}: ResponsiveOverflowProps<T>) {
  const rootRef = useRef<HTMLElement | null>(null);
  const measureRowRef = useRef<HTMLDivElement>(null);
  const moreMeasureRef = useRef<HTMLDivElement>(null);

  const [containerWidth, setContainerWidth] = useState(0);
  const [itemWidths, setItemWidths] = useState<number[]>([]);
  const [moreWidth, setMoreWidth] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  const isChildrenMode = !items && !!children;
  const childArray = isChildrenMode
    ? Children.toArray(children).filter(isValidElement)
    : [];
  const totalItemCount = items ? items.length : childArray.length;

  const measure = useCallback(() => {
    const root = rootRef.current;
    const measureRow = measureRowRef.current;
    if (!root || !measureRow) return;

    const nextWidths = Array.from(measureRow.children).map(
      (node) => node.getBoundingClientRect().width,
    );
    setItemWidths((prev) => (sameWidths(prev, nextWidths) ? prev : nextWidths));

    const moreNode = moreMeasureRef.current?.firstElementChild;
    const nextMore = moreNode ? moreNode.getBoundingClientRect().width : 0;
    setMoreWidth((prev) => (Math.abs(prev - nextMore) < 0.01 ? prev : nextMore));

    const nextContainer = contentBoxWidth(root);
    setContainerWidth((prev) =>
      Math.abs(prev - nextContainer) < 0.01 ? prev : nextContainer,
    );
  }, []);

  // Measure synchronously before paint so the first frame is already folded.
  useIsomorphicLayoutEffect(() => {
    measure();
  }, [measure, totalItemCount, items, children, measureKey]);

  /*
   * Re-measure when the root resizes (space changed) or any measured copy
   * resizes (a web font loaded, a count went from 9 to 10…). The copies are
   * re-observed whenever the item set changes.
   *
   * Measured right in the callback — observer callbacks already run once per
   * frame, before paint, so deferring to `requestAnimationFrame` would only
   * show one frame of overflowing tabs. It can't loop: what gets observed
   * (the root's width, the copies' sizes) never depends on which items show.
   */
  useIsomorphicLayoutEffect(() => {
    const root = rootRef.current;
    const measureRow = measureRowRef.current;
    if (!root || !measureRow || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => measure());
    observer.observe(root);
    for (const node of Array.from(measureRow.children)) observer.observe(node);
    const moreNode = moreMeasureRef.current?.firstElementChild;
    if (moreNode) observer.observe(moreNode);

    return () => observer.disconnect();
  }, [measure, totalItemCount, items, children]);

  const isIndexActive = (idx: number): boolean => {
    if (items) {
      const item = items[idx];
      return item !== undefined && !!isItemActive?.(item, idx);
    }
    const child = childArray[idx] as
      | ReactElement<{
          'data-state'?: string;
          'aria-selected'?: boolean | 'true' | 'false';
          isActive?: boolean;
        }>
      | undefined;
    return (
      child?.props?.['data-state'] === 'active' ||
      child?.props?.['aria-selected'] === true ||
      child?.props?.['aria-selected'] === 'true' ||
      child?.props?.isActive === true
    );
  };

  let activeIndex = -1;
  for (let i = 0; i < totalItemCount; i++) {
    if (isIndexActive(i)) {
      activeIndex = i;
      break;
    }
  }

  const { visible: visibleIndices, overflow: overflowIndices } =
    computeOverflowLayout({
      containerWidth,
      // Until measured, pad with zeros so every index exists.
      itemWidths:
        itemWidths.length === totalItemCount
          ? itemWidths
          : Array.from({ length: totalItemCount }, (_, i) => itemWidths[i] ?? 0),
      moreWidth,
      gap,
      minVisibleItems,
      maxVisibleItems,
      activeIndex,
      keepActiveVisible: prioritizeActiveTab,
    });

  const isChildActiveInOverflow = overflowIndices.includes(activeIndex);
  const overflowCount = overflowIndices.length;
  const visibleCount = visibleIndices.length;

  useEffect(() => {
    onOverflowChange?.(overflowCount, visibleCount);
  }, [overflowCount, visibleCount, onOverflowChange]);

  const itemKey = (item: T, idx: number) =>
    getItemId?.(item, idx) ?? (item as ResponsiveOverflowItem)?.id ?? String(idx);

  const defaultRenderItem = (item: T, index: number) => {
    const row = item as ResponsiveOverflowItem;
    return (
      <button
        type="button"
        disabled={row.disabled}
        onClick={row.onClick}
        aria-current={isIndexActive(index) ? 'true' : undefined}
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer',
          'text-muted-foreground hover:text-foreground hover:bg-accent/60',
          'outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
          isIndexActive(index) &&
            'bg-background text-foreground font-semibold shadow-xs border border-border/60',
        )}
      >
        {row.icon && <span className="size-4 shrink-0">{row.icon}</span>}
        {row.label && <span>{row.label}</span>}
        {row.count !== undefined && (
          <span className="text-[10px] text-muted-foreground rounded-full px-1.5 py-0.5 bg-muted/40 font-semibold">
            {row.count}
          </span>
        )}
      </button>
    );
  };

  const defaultRenderOverflowItem = (
    item: T,
    index: number,
    close: () => void,
  ) => {
    const row = item as ResponsiveOverflowItem;
    const active = isIndexActive(index);
    return (
      <DropdownMenuItem
        disabled={row.disabled}
        onSelect={() => {
          row.onClick?.();
          close();
        }}
        className={cn(
          'flex items-center justify-between gap-2.5 px-3 py-2 text-xs font-medium cursor-pointer',
          active && 'bg-accent/60 text-foreground font-semibold',
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {row.icon && (
            <span className="size-4 shrink-0 text-muted-foreground">{row.icon}</span>
          )}
          <span className="truncate">{row.label}</span>
          {row.count !== undefined && (
            <span className="text-[10px] text-muted-foreground rounded-full px-1.5 py-0.5 bg-muted/40 font-semibold">
              {row.count}
            </span>
          )}
        </div>
        {active && <Check className="size-3.5 shrink-0 text-primary" />}
      </DropdownMenuItem>
    );
  };

  const defaultTrigger = (count: number, active: boolean, open: boolean) => (
    <button
      type="button"
      data-slot="overflow-more-trigger"
      data-state={active ? 'active' : 'inactive'}
      aria-expanded={open}
      aria-label={`${typeof overflowLabel === 'string' ? overflowLabel : 'More'} items (${count} more)`}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer select-none outline-none',
        'text-muted-foreground hover:text-foreground hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/40',
        active &&
          'bg-background text-foreground font-semibold shadow-xs border border-border/60 dark:bg-surface-raised',
        triggerClassName,
      )}
    >
      {overflowIcon || <MoreHorizontal className="size-4 shrink-0" />}
      <span>{overflowLabel}</span>
      <span className="text-[10px] text-muted-foreground rounded-full px-1.5 py-0.5 bg-muted/40 font-semibold">
        {count}
      </span>
      <ChevronDown
        className={cn(
          'size-3 opacity-60 transition-transform duration-150',
          open && 'rotate-180',
        )}
      />
    </button>
  );

  const renderVisible = (idx: number) => {
    if (!items) return childArray[idx];
    const item = items[idx];
    if (item === undefined) return null;
    return (
      <Fragment key={itemKey(item, idx)}>
        {renderItem ? renderItem(item, idx) : defaultRenderItem(item, idx)}
      </Fragment>
    );
  };

  const measureCopy = (idx: number) => {
    if (!items) return childArray[idx];
    const item = items[idx];
    if (item === undefined) return null;
    if (renderMeasureItem) return renderMeasureItem(item, idx);
    return renderItem ? renderItem(item, idx) : defaultRenderItem(item, idx);
  };

  const overflowEntries = items
    ? overflowIndices.map((i) => items[i])
    : (overflowIndices.map((i) => childArray[i]) as unknown as T[]);

  // Measured with every item "in the menu" so its count badge is as wide as it
  // can get — a slightly generous estimate, never a short one.
  const allEntries = items ?? (childArray as unknown as T[]);

  return (
    <Component
      ref={rootRef}
      data-slot="responsive-overflow"
      className={cn('relative min-w-0 max-w-full', className)}
      {...props}
    >
      <div
        data-slot="responsive-overflow-row"
        className={cn('flex min-w-0 flex-nowrap items-center', rowClassName)}
        style={{ gap: `${gap}px` }}
      >
        {visibleIndices.map(renderVisible)}

        {overflowCount > 0 && (
          <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
            <DropdownMenuTrigger asChild>
              {renderOverflowTrigger
                ? renderOverflowTrigger(overflowEntries, isChildActiveInOverflow, isOpen)
                : defaultTrigger(overflowCount, isChildActiveInOverflow, isOpen)}
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side={overflowMenuSide}
              align={overflowMenuAlign}
              sideOffset={4}
              className={cn('min-w-44 max-w-72 p-1 z-50', menuContentClassName)}
            >
              {items
                ? overflowIndices.map((idx) => {
                    const item = items[idx];
                    if (item === undefined) return null;
                    const close = () => setIsOpen(false);
                    return (
                      <Fragment key={itemKey(item, idx)}>
                        {renderOverflowItem
                          ? renderOverflowItem(item, idx, close)
                          : defaultRenderOverflowItem(item, idx, close)}
                      </Fragment>
                    );
                  })
                : overflowIndices.map((idx) => {
                    const child = childArray[idx] as ReactElement<{
                      onClick?: () => void;
                      children?: ReactNode;
                      icon?: ReactNode;
                    }>;
                    if (!child) return null;
                    const active = isIndexActive(idx);
                    return (
                      <DropdownMenuItem
                        key={idx}
                        onSelect={() => {
                          child.props.onClick?.();
                          setIsOpen(false);
                        }}
                        className={cn(
                          'flex items-center justify-between gap-2.5 px-3 py-2 text-xs font-medium cursor-pointer',
                          active && 'bg-accent/60 text-foreground font-semibold',
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {child.props.icon && (
                            <span className="size-4 shrink-0 text-muted-foreground">
                              {child.props.icon}
                            </span>
                          )}
                          <span className="truncate">{child.props.children}</span>
                        </div>
                        {active && <Check className="size-3.5 shrink-0 text-primary" />}
                      </DropdownMenuItem>
                    );
                  })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/*
        In-flow, zero-height copy of every item: it is what gets measured, and
        it keeps this element's natural width at "all items" (see above).
      */}
      <div
        ref={measureRowRef}
        aria-hidden
        inert
        data-slot="responsive-overflow-measure"
        style={{
          display: 'flex',
          gap: `${gap}px`,
          height: 0,
          overflow: 'hidden',
          visibility: 'hidden',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}
      >
        {Array.from({ length: totalItemCount }, (_, idx) => (
          <div key={idx} style={{ flexShrink: 0, display: 'flex' }}>
            {measureCopy(idx)}
          </div>
        ))}
      </div>

      {/* The "More" trigger, measured out of flow so it doesn't widen the row. */}
      <div
        ref={moreMeasureRef}
        aria-hidden
        inert
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: 0,
          overflow: 'visible',
          visibility: 'hidden',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
          display: 'flex',
        }}
      >
        {renderOverflowTrigger
          ? renderOverflowTrigger(allEntries, false, false)
          : defaultTrigger(totalItemCount, false, false)}
      </div>
    </Component>
  );
}
