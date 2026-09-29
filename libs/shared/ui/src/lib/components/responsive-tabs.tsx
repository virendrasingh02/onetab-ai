import { cn } from '@org/utils';
import type * as TabsPrimitive from '@radix-ui/react-tabs';
import { Check, ChevronDown } from 'lucide-react';
import {
  Children,
  forwardRef,
  isValidElement,
  useCallback,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactElement,
  type ReactNode,
} from 'react';
import { DropdownMenuItem } from './dropdown-menu.js';
import { ResponsiveOverflow } from './responsive-overflow.js';
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsTriggerContent,
  tabsTriggerClassName,
  useTabsContext,
  type TabsSize,
  type TabsVariant,
} from './tabs.js';

export interface TabItem {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  count?: number | string;
  disabled?: boolean;
  /** Extra classes for this tab's trigger. */
  className?: string;
}

/** The spacing each variant's plain `TabsList` uses, so swapping is seamless. */
const VARIANT_GAP: Record<TabsVariant, number> = {
  pill: 4,
  'c-tabs-7': 4,
  segmented: 2,
  underline: 16,
};

/* -------------------------------------------------------------------------- */
/* Responsive Tabs List                                                       */
/* -------------------------------------------------------------------------- */

export interface ResponsiveTabsListProps
  extends ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  variant?: TabsVariant;
  size?: TabsSize;
  layoutId?: string;
  /** Tabs as data. Omit to pass `<TabsTrigger>` children instead. */
  items?: TabItem[];
  overflowLabel?: ReactNode;
  overflowIcon?: ReactNode;
  /**
   * Keep the selected tab in the row, swapping out the last visible one, rather
   * than hiding it in "More". On by default.
   */
  keepActiveVisible?: boolean;
  minVisibleItems?: number;
  maxVisibleItems?: number;
  onOverflowChange?: (overflowCount: number, visibleCount: number) => void;
  /** Px between tabs. Defaults to the variant's usual spacing. */
  gap?: number;
  /** Stretch the list to its container and share the width between tabs. */
  fullWidth?: boolean;
}

/**
 * A `TabsList` that never scrolls or wraps: tabs that don't fit fold into a
 * "More" menu, and come back as soon as there is room. Drop-in for `TabsList`
 * inside a `<Tabs>` — accepts `<TabsTrigger>` children or an `items` array.
 */
export const ResponsiveTabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ResponsiveTabsListProps
>(
  (
    {
      className,
      variant: propVariant,
      size: propSize,
      layoutId,
      items,
      overflowLabel = 'More',
      overflowIcon,
      keepActiveVisible = true,
      minVisibleItems = 1,
      maxVisibleItems,
      onOverflowChange,
      gap: propGap,
      fullWidth = false,
      children,
      ...props
    },
    ref,
  ) => {
    const context = useTabsContext();
    const variant = propVariant || context.variant || 'pill';
    const size = propSize || context.size || 'md';
    const gap = propGap ?? VARIANT_GAP[variant];
    const activeTab = context.value;
    const onValueChange = context.onValueChange;

    const normalizedItems: TabItem[] =
      items && items.length > 0
        ? items
        : Children.toArray(children)
            .filter(isValidElement)
            .map((child, index) => {
              const el = child as ReactElement<{
                value?: string;
                children?: ReactNode;
                icon?: ReactNode;
                badge?: ReactNode;
                count?: number | string;
                disabled?: boolean;
                className?: string;
              }>;
              return {
                value: el.props.value || `tab-${index}`,
                label: el.props.children,
                icon: el.props.icon,
                badge: el.props.badge,
                count: el.props.count,
                disabled: el.props.disabled,
                className: el.props.className,
              };
            });

    const isItemActive = useCallback(
      (item: TabItem) => item.value === activeTab,
      [activeTab],
    );

    const renderItem = useCallback(
      (item: TabItem) => (
        <TabsTrigger
          value={item.value}
          variant={variant}
          size={size}
          icon={item.icon}
          badge={item.badge}
          count={item.count}
          disabled={item.disabled}
          className={cn(fullWidth && 'flex-1', item.className)}
        >
          {item.label}
        </TabsTrigger>
      ),
      [variant, size, fullWidth],
    );

    // A look-alike, not a `TabsTrigger`: a second Radix trigger per tab would
    // join the tablist's roving-focus group and could steal keyboard focus.
    const renderMeasureItem = useCallback(
      (item: TabItem) => (
        <span
          data-state={item.value === activeTab ? 'active' : 'inactive'}
          className={cn(tabsTriggerClassName(variant, size), item.className)}
        >
          <TabsTriggerContent icon={item.icon} badge={item.badge} count={item.count}>
            {item.label}
          </TabsTriggerContent>
        </span>
      ),
      [variant, size, activeTab],
    );

    const renderOverflowItem = useCallback(
      (item: TabItem, _index: number, close: () => void) => {
        const isActive = item.value === activeTab;
        return (
          <DropdownMenuItem
            disabled={item.disabled}
            onSelect={() => {
              onValueChange?.(item.value);
              close();
            }}
            className={cn(
              'flex items-center justify-between gap-2.5 px-3 py-2 text-xs font-medium cursor-pointer',
              isActive && 'text-foreground font-semibold',
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              {item.icon && (
                <span className="flex shrink-0 items-center text-muted-foreground [&_svg]:size-4">
                  {item.icon}
                </span>
              )}
              <span className="truncate">{item.label}</span>
              {item.count !== undefined && (
                <span className="rounded-full bg-muted-foreground/15 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-muted-foreground">
                  {item.count}
                </span>
              )}
              {item.badge && (
                <span className="inline-flex shrink-0 items-center">{item.badge}</span>
              )}
            </div>
            {isActive && <Check className="size-3.5 shrink-0 text-primary" />}
          </DropdownMenuItem>
        );
      },
      [activeTab, onValueChange],
    );

    const renderOverflowTrigger = useCallback(
      (overflowItems: TabItem[], isChildActive: boolean, isOpen: boolean) => (
        <button
          type="button"
          data-slot="tabs-trigger-more"
          data-variant={variant}
          data-size={size}
          data-state={isChildActive ? 'active' : 'inactive'}
          aria-expanded={isOpen}
          aria-label={`${typeof overflowLabel === 'string' ? overflowLabel : 'More'} tabs (${overflowItems.length} more)`}
          className={cn(tabsTriggerClassName(variant, size), 'shrink-0')}
        >
          {/* Label + count + chevron already say "more": no ⋯ icon unless
              asked for, so a narrow row keeps room for one more real tab. */}
          <TabsTriggerContent
            icon={overflowIcon}
            count={overflowItems.length}
            badge={
              <ChevronDown
                className={cn(
                  'size-3 opacity-60 transition-transform duration-150',
                  isOpen && 'rotate-180',
                )}
                aria-hidden
              />
            }
          >
            {overflowLabel}
          </TabsTriggerContent>
        </button>
      ),
      [variant, size, overflowLabel, overflowIcon],
    );

    return (
      <TabsList
        ref={ref}
        variant={variant}
        size={size}
        layoutId={layoutId}
        scrollable={false}
        className={cn(
          'min-w-0 max-w-full',
          // `segmented` is a visible tray, so it hugs its tabs unless asked to
          // stretch; the other variants have no tray and can simply fill.
          fullWidth ? 'w-full' : variant === 'segmented' && 'w-fit',
          className,
        )}
        {...props}
      >
        <ResponsiveOverflow
          items={normalizedItems}
          isItemActive={isItemActive}
          getItemId={(item) => item.value}
          renderItem={renderItem}
          renderMeasureItem={renderMeasureItem}
          renderOverflowItem={renderOverflowItem}
          renderOverflowTrigger={renderOverflowTrigger}
          gap={gap}
          overflowLabel={overflowLabel}
          prioritizeActiveTab={keepActiveVisible}
          minVisibleItems={minVisibleItems}
          maxVisibleItems={maxVisibleItems}
          onOverflowChange={onOverflowChange}
          measureKey={activeTab}
          // Shrinks with the list but never grows past its tabs — unless the
          // list is full-width, where the tabs share the whole row.
          className={fullWidth ? 'flex-1' : 'flex-initial'}
        />
      </TabsList>
    );
  },
);

ResponsiveTabsList.displayName = 'ResponsiveTabsList';

/* -------------------------------------------------------------------------- */
/* Responsive Tabs (Full Root + ResponsiveTabsList Wrapper)                  */
/* -------------------------------------------------------------------------- */

export interface ResponsiveTabsProps
  extends ComponentPropsWithoutRef<typeof TabsPrimitive.Root> {
  items: TabItem[];
  variant?: TabsVariant;
  size?: TabsSize;
  layoutId?: string;
  overflowLabel?: ReactNode;
  overflowIcon?: ReactNode;
  keepActiveVisible?: boolean;
  minVisibleItems?: number;
  maxVisibleItems?: number;
  onOverflowChange?: (overflowCount: number, visibleCount: number) => void;
  gap?: number;
  fullWidth?: boolean;
  listClassName?: string;
}

/** `<Tabs>` + `<ResponsiveTabsList>` in one, for the common data-driven case. */
export const ResponsiveTabs = forwardRef<
  ElementRef<typeof TabsPrimitive.Root>,
  ResponsiveTabsProps
>(
  (
    {
      items,
      value,
      defaultValue,
      onValueChange,
      variant = 'pill',
      size = 'md',
      layoutId,
      overflowLabel = 'More',
      overflowIcon,
      keepActiveVisible = true,
      minVisibleItems = 1,
      maxVisibleItems,
      onOverflowChange,
      gap,
      fullWidth,
      className,
      listClassName,
      children,
      ...props
    },
    ref,
  ) => (
    <Tabs
      ref={ref}
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      className={cn('flex min-w-0 flex-col gap-2', className)}
      {...props}
    >
      <ResponsiveTabsList
        variant={variant}
        size={size}
        layoutId={layoutId}
        items={items}
        overflowLabel={overflowLabel}
        overflowIcon={overflowIcon}
        keepActiveVisible={keepActiveVisible}
        minVisibleItems={minVisibleItems}
        maxVisibleItems={maxVisibleItems}
        onOverflowChange={onOverflowChange}
        gap={gap}
        fullWidth={fullWidth}
        className={listClassName}
      />
      {children}
    </Tabs>
  ),
);

ResponsiveTabs.displayName = 'ResponsiveTabs';
