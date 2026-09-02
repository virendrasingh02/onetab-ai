import { cn } from '@org/utils';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import {
  createContext,
  forwardRef,
  useContext,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode,
} from 'react';

/* -------------------------------------------------------------------------- */
/* Tabs Context & Types                                                       */
/* -------------------------------------------------------------------------- */

export type TabsVariant = 'pill' | 'underline' | 'c-tabs-7' | 'segmented';
export type TabsSize = 'sm' | 'md' | 'lg';

interface TabsContextValue {
  variant: TabsVariant;
  size: TabsSize;
  layoutId?: string;
  activeTab?: string;
}

const TabsContext = createContext<TabsContextValue>({
  variant: 'pill',
  size: 'md',
});

/* -------------------------------------------------------------------------- */
/* Tabs Root                                                                  */
/* -------------------------------------------------------------------------- */

export type TabsProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Root>;

export const Tabs = forwardRef<ElementRef<typeof TabsPrimitive.Root>, TabsProps>(
  ({ className, ...props }, ref) => {
    return (
      <TabsPrimitive.Root
        ref={ref}
        data-slot="tabs"
        className={cn('flex flex-col gap-2', className)}
        {...props}
      />
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
    return (
      <TabsContext.Provider value={{ variant, size, layoutId }}>
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
        className={cn(
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

          className,
        )}
        {...props}
      >
        {/* Leading Icon */}
        {icon && (
          <span className="shrink-0 text-muted-foreground transition-colors group-hover:text-foreground group-data-[state=active]:text-foreground flex items-center justify-center">
            {icon}
          </span>
        )}

        {/* Tab Label */}
        <span className="truncate">{children}</span>

        {/* Optional Count / Badge */}
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
      </TabsPrimitive.Trigger>
    );
  },
);

TabsTrigger.displayName = 'TabsTrigger';

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
        'flex-1 outline-none mt-2',
        'data-[state=inactive]:hidden',
        'data-[state=active]:animate-in data-[state=active]:fade-in-50 duration-150',
        className,
      )}
      {...props}
    />
  );
});

TabsContent.displayName = 'TabsContent';
