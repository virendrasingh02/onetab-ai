import { cn } from '@org/utils';
import { Check, ChevronDown, MoreHorizontal } from 'lucide-react';
import {
  forwardRef,
  useCallback,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode,
} from 'react';
import {
  DropdownMenuItem,
} from './dropdown-menu.js';
import { ResponsiveOverflow } from './responsive-overflow.js';

export interface NavItem {
  id: string;
  label: ReactNode;
  href?: string;
  to?: string;
  icon?: ReactNode;
  badge?: ReactNode;
  count?: number | string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}

export interface ResponsiveNavigationProps
  extends Omit<ComponentPropsWithoutRef<'nav'>, 'onSelect'> {
  items: NavItem[];
  gap?: number;
  overflowLabel?: ReactNode;
  overflowIcon?: ReactNode;
  minVisibleItems?: number;
  maxVisibleItems?: number;
  renderLink?: (item: NavItem, isVisible: boolean) => ReactNode;
  onSelect?: (item: NavItem) => void;
}

export const ResponsiveNavigation = forwardRef<
  ElementRef<'nav'>,
  ResponsiveNavigationProps
>(
  (
    {
      items,
      gap = 4,
      overflowLabel = 'More',
      overflowIcon,
      minVisibleItems = 1,
      maxVisibleItems,
      renderLink,
      onSelect,
      className,
      ...props
    },
    ref,
  ) => {
    const isItemActive = useCallback((item: NavItem) => !!item.active, []);

    const defaultRenderItem = useCallback(
      (item: NavItem) => {
        if (renderLink) return renderLink(item, true);

        return (
          <button
            type="button"
            disabled={item.disabled}
            onClick={() => {
              item.onClick?.();
              onSelect?.(item);
            }}
            aria-current={item.active ? 'page' : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer select-none shrink-0',
              'text-muted-foreground hover:text-foreground hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/40 outline-none',
              item.active &&
                'bg-accent/70 text-foreground font-semibold shadow-2xs',
            )}
          >
            {item.icon && <span className="size-4 shrink-0">{item.icon}</span>}
            <span className="truncate">{item.label}</span>
            {item.count !== undefined && (
              <span className="text-[10px] text-muted-foreground rounded-full px-1.5 py-0.5 bg-muted/40 font-semibold">
                {item.count}
              </span>
            )}
            {item.badge && <span className="shrink-0">{item.badge}</span>}
          </button>
        );
      },
      [renderLink, onSelect],
    );

    const renderOverflowItem = useCallback(
      (item: NavItem, _idx: number, close: () => void) => {
        return (
          <DropdownMenuItem
            key={item.id}
            disabled={item.disabled}
            onSelect={() => {
              item.onClick?.();
              onSelect?.(item);
              close();
            }}
            className={cn(
              'flex items-center justify-between gap-2.5 px-3 py-2 text-xs font-medium cursor-pointer',
              item.active && 'bg-accent/70 text-foreground font-semibold',
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              {item.icon && (
                <span className="size-4 shrink-0 text-muted-foreground">
                  {item.icon}
                </span>
              )}
              <span className="truncate">{item.label}</span>
              {item.count !== undefined && (
                <span className="text-[10px] text-muted-foreground rounded-full px-1.5 py-0.5 bg-muted/40 font-semibold">
                  {item.count}
                </span>
              )}
            </div>
            {item.active && <Check className="size-3.5 shrink-0 text-primary" />}
          </DropdownMenuItem>
        );
      },
      [onSelect],
    );

    const renderOverflowTrigger = useCallback(
      (overflowItems: NavItem[], isChildActive: boolean, isOpen: boolean) => {
        return (
          <button
            type="button"
            data-state={isChildActive ? 'active' : 'inactive'}
            aria-expanded={isOpen}
            aria-label={`${overflowLabel} navigation (${overflowItems.length} more)`}
            className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer select-none shrink-0 outline-none',
              'text-muted-foreground hover:text-foreground hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring/40',
              isChildActive &&
                'bg-accent/70 text-foreground font-semibold shadow-2xs',
            )}
          >
            {overflowIcon || <MoreHorizontal className="size-4 shrink-0" />}
            <span>{overflowLabel}</span>
            <span className="text-[10px] text-muted-foreground rounded-full px-1.5 py-0.5 bg-muted/40 font-semibold">
              {overflowItems.length}
            </span>
            <ChevronDown
              className={cn(
                'size-3 opacity-60 transition-transform duration-150',
                isOpen && 'rotate-180',
              )}
            />
          </button>
        );
      },
      [overflowLabel, overflowIcon],
    );

    return (
      <nav
        ref={ref}
        aria-label="Responsive navigation"
        className={cn('flex items-center min-w-0 max-w-full', className)}
        {...props}
      >
        <ResponsiveOverflow
          items={items}
          isItemActive={isItemActive}
          getItemId={(item) => item.id}
          renderItem={defaultRenderItem}
          renderOverflowItem={renderOverflowItem}
          renderOverflowTrigger={renderOverflowTrigger}
          gap={gap}
          minVisibleItems={minVisibleItems}
          maxVisibleItems={maxVisibleItems}
          className="flex-1"
        />
      </nav>
    );
  },
);

ResponsiveNavigation.displayName = 'ResponsiveNavigation';
