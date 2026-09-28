import { cn } from '@org/utils';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode,
} from 'react';

/* -------------------------------------------------------------------------- */
/* Tabs Context & Types                                                       */
/* -------------------------------------------------------------------------- */

export type TabsVariant = 'pill' | 'underline' | 'c-tabs-7' | 'segmented';
export type TabsSize = 'sm' | 'md' | 'lg';

export interface TabsContextValue {
  variant: TabsVariant;
  size: TabsSize;
  layoutId?: string;
  /** The selected tab — live for controlled *and* uncontrolled `<Tabs>`. */
  value?: string;
  /** Selects a tab; set by `<Tabs>`, so overflow menus can switch tabs too. */
  onValueChange?: (val: string) => void;
}

export const TabsContext = createContext<TabsContextValue>({
  variant: 'pill',
  size: 'md',
});

export const useTabsContext = () => useContext(TabsContext);

/* -------------------------------------------------------------------------- */
/* Tabs Root                                                                  */
/* -------------------------------------------------------------------------- */

export type TabsProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Root>;

export const Tabs = forwardRef<ElementRef<typeof TabsPrimitive.Root>, TabsProps>(
  (
    { className, value: valueProp, defaultValue, onValueChange, children, ...props },
    ref,
  ) => {
    /*
     * The selection is owned here (not left to Radix) so the context always
     * carries the live value: a `ResponsiveTabsList` needs it to mark the active
     * tab and to switch tabs from its "More" menu, and an uncontrolled
     * `defaultValue` would otherwise freeze at the initial tab.
     */
    const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
    const isControlled = valueProp !== undefined;
    const value = isControlled ? valueProp : uncontrolledValue;

    const handleValueChange = useCallback(
      (next: string) => {
        if (!isControlled) setUncontrolledValue(next);
        onValueChange?.(next);
      },
      [isControlled, onValueChange],
    );

    const context = useMemo<TabsContextValue>(
      () => ({
        variant: 'pill',
        size: 'md',
        value,
        onValueChange: handleValueChange,
      }),
      [value, handleValueChange],
    );

    return (
      <TabsContext.Provider value={context}>
        <TabsPrimitive.Root
          ref={ref}
          value={value ?? ''}
          onValueChange={handleValueChange}
          data-slot="tabs"
          className={cn('flex flex-col gap-2', className)}
          {...props}
        >
          {children}
        </TabsPrimitive.Root>
      </TabsContext.Provider>
    );
  },
);

Tabs.displayName = 'Tabs';

/* -------------------------------------------------------------------------- */
/* Tabs List                                                                  */
/* -------------------------------------------------------------------------- */

export interface TabsListProps extends ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  variant?: TabsVariant;
  size?: TabsSize;
  layoutId?: string;
  scrollable?: boolean;
}

export const TabsList = forwardRef<ElementRef<typeof TabsPrimitive.List>, TabsListProps>(
  (
    {
      className,
      variant = 'pill',
      size = 'md',
      layoutId = 'tabs-active-indicator',
      scrollable = true,
      children,
      ...props
    },
    ref,
  ) => {
    const parentContext = useContext(TabsContext);

    return (
      <TabsContext.Provider
        value={{
          ...parentContext,
          variant,
          size,
          layoutId,
        }}
      >
        <TabsPrimitive.List
          ref={ref}
          data-slot="tabs-list"
          data-variant={variant}
          data-size={size}
          className={cn(
            'flex items-center text-muted-foreground select-none',
            scrollable &&
              'max-w-full overflow-x-auto scrollbar-none overscroll-x-contain flex-nowrap',
            // Variant container styling. `pill` / `c-tabs-7` are a plain
            // transparent row of chips — the page section that hosts the tabs
            // owns the `border-b` rule beneath them (channel-page,
            // AnalyticsLayout, channel-details-panel, …), so a filled tray here
            // would only fight it.
            (variant === 'pill' || variant === 'c-tabs-7') && 'gap-1',
            variant === 'segmented' &&
              'inline-flex w-fit rounded-lg bg-surface-inset p-1 border border-border',
            variant === 'underline' &&
              'gap-6 flex w-full border-b border-border/60 pb-px bg-transparent',
            // Sizing container adjustments
            size === 'sm' && (variant === 'pill' || variant === 'c-tabs-7') && 'h-8',
            size === 'md' && (variant === 'pill' || variant === 'c-tabs-7') && 'h-9',
            size === 'lg' && (variant === 'pill' || variant === 'c-tabs-7') && 'h-10',
            className,
          )}
          {...props}
        >
          {children}
        </TabsPrimitive.List>
      </TabsContext.Provider>
    );
  },
);

TabsList.displayName = 'TabsList';

/* -------------------------------------------------------------------------- */
/* Tabs Trigger                                                               */
/* -------------------------------------------------------------------------- */

export interface TabsTriggerProps
  extends ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> {
  variant?: TabsVariant;
  size?: TabsSize;
  icon?: ReactNode;
  badge?: ReactNode;
  count?: number | string;
}

export const TabsTrigger = forwardRef<
  ElementRef<typeof TabsPrimitive.Trigger>,
  TabsTriggerProps
>(
  (
    {
      className,
      variant: propVariant,
      size: propSize,
      icon,
      badge,
      count,
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const context = useContext(TabsContext);
    const variant = propVariant || context.variant;
    const size = propSize || context.size;

    return (
      <TabsPrimitive.Trigger
        ref={ref}
        disabled={disabled}
        data-slot="tabs-trigger"
        data-variant={variant}
        data-size={size}
        className={cn(tabsTriggerClassName(variant, size), className)}
        {...props}
      >
        <TabsTriggerContent icon={icon} badge={badge} count={count}>
          {children}
        </TabsTriggerContent>
      </TabsPrimitive.Trigger>
    );
  },
);

TabsTrigger.displayName = 'TabsTrigger';

/**
 * A trigger's look for a variant + size. Shared by `TabsTrigger` and the
 * look-alike elements a `ResponsiveTabsList` renders (its "More" button and the
 * off-screen copies it measures), so all three stay pixel-identical. Active
 * styling keys off `data-state="active"`.
 */
export function tabsTriggerClassName(variant: TabsVariant, size: TabsSize) {
  return cn(
    'group relative inline-flex items-center justify-center whitespace-nowrap font-medium outline-none cursor-pointer',
    'transition-colors duration-(--duration-fast) ease-standard',
    'focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
    'disabled:pointer-events-none disabled:opacity-40 disabled:cursor-not-allowed',
    "[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",

    // Size padding
    size === 'sm' && 'gap-1.5 px-2.5 py-1 text-xs',
    size === 'md' && 'gap-2 px-3 py-1.5 text-xs',
    size === 'lg' && 'gap-2.5 px-4 py-2 text-sm',

    // Variant: pill / c-tabs-7 — a transparent trigger that lifts into a
    // rounded raised chip when active. The always-present transparent
    // border keeps the row from shifting 1px when the active outline
    // appears.
    (variant === 'pill' || variant === 'c-tabs-7') && [
      'rounded-md border border-transparent text-muted-foreground',
      'hover:text-foreground',
      'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:font-semibold',
      'data-[state=active]:border-border/60 data-[state=active]:shadow-xs',
      'dark:data-[state=active]:bg-surface-raised',
    ],

    // Variant: segmented (matches the SegmentedControl sibling — a lifted
    // active chip, no border, so selection doesn't nudge the row 1px)
    variant === 'segmented' && [
      'rounded-md text-muted-foreground',
      'hover:text-foreground',
      'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs',
    ],

    // Variant: underline (page level header strip)
    variant === 'underline' && [
      'rounded-t-sm border-b-2 border-transparent text-muted-foreground',
      'hover:text-foreground',
      'data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:font-semibold',
      size === 'sm' && 'pb-2',
      size === 'md' && 'pb-2.5',
      size === 'lg' && 'pb-3',
    ],
  );
}

/** A trigger's inner layout: leading icon, label, count pill, trailing badge. */
export function TabsTriggerContent({
  icon,
  badge,
  count,
  children,
}: {
  icon?: ReactNode;
  badge?: ReactNode;
  count?: number | string;
  children?: ReactNode;
}) {
  return (
    <>
      {icon && (
        <span className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground group-data-[state=active]:text-foreground flex items-center justify-center">
          {icon}
        </span>
      )}

      <span className="truncate">{children}</span>

      {count !== undefined && (
        <span
          data-slot="tabs-count"
          className={cn(
            'inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-tight transition-colors',
            'bg-muted-foreground/15 text-muted-foreground',
            'group-hover:bg-muted-foreground/25 group-hover:text-foreground',
            'group-data-[state=active]:bg-primary/15 group-data-[state=active]:text-primary',
          )}
        >
          {count}
        </span>
      )}

      {badge && <span className="inline-flex items-center shrink-0">{badge}</span>}
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Tabs Content                                                               */
/* -------------------------------------------------------------------------- */

export type TabsContentProps =
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>;

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  TabsContentProps
>(({ className, ...props }, ref) => {
  return (
    <TabsPrimitive.Content
      ref={ref}
      data-slot="tabs-content"
      className={cn(
        'flex-1 outline-none mt-2 focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none rounded-md',
        'data-[state=inactive]:hidden',
        'data-[state=active]:animate-in data-[state=active]:fade-in-50 duration-150',
        className,
      )}
      {...props}
    />
  );
});

TabsContent.displayName = 'TabsContent';
