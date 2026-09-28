import { cn } from '@org/utils';
import { MoreHorizontal } from 'lucide-react';
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
import { Button, type ButtonProps } from './button.js';
import { DropdownMenuItem } from './dropdown-menu.js';
import { ResponsiveOverflow } from './responsive-overflow.js';

export interface ToolbarItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: ButtonProps['variant'];
}

export interface ResponsiveToolbarProps extends ComponentPropsWithoutRef<'div'> {
  items?: ToolbarItem[];
  gap?: number;
  overflowLabel?: string;
  overflowIcon?: ReactNode;
  minVisibleItems?: number;
  maxVisibleItems?: number;
  menuAlign?: 'start' | 'center' | 'end';
}

export const ResponsiveToolbar = forwardRef<
  ElementRef<'div'>,
  ResponsiveToolbarProps
>(
  (
    {
      items,
      gap = 6,
      overflowLabel = 'More actions',
      overflowIcon,
      minVisibleItems = 1,
      maxVisibleItems,
      menuAlign = 'end',
      className,
      children,
      ...props
    },
    ref,
  ) => {
    const normalizedItems: ToolbarItem[] =
      items && items.length > 0
        ? items
        : Children.toArray(children)
            .filter(isValidElement)
            .map((child, index) => {
              const el = child as ReactElement<{
                id?: string;
                onClick?: () => void;
                children?: ReactNode;
                icon?: ReactNode;
                disabled?: boolean;
                variant?: ButtonProps['variant'];
              }>;
              return {
                id: el.props.id || `toolbar-item-${index}`,
                label: el.props.children,
                icon: el.props.icon,
                onClick: el.props.onClick,
                disabled: el.props.disabled,
                variant: el.props.variant || 'ghost',
              };
            });

    const renderItem = useCallback((item: ToolbarItem) => {
      return (
        <Button
          variant={item.variant || 'ghost'}
          size="sm"
          disabled={item.disabled}
          onClick={item.onClick}
          className="h-8 gap-1.5 px-2.5 text-xs font-medium shrink-0"
        >
          {item.icon && <span className="size-3.5 shrink-0">{item.icon}</span>}
          {item.label && <span>{item.label}</span>}
        </Button>
      );
    }, []);

    const renderOverflowItem = useCallback(
      (item: ToolbarItem, _idx: number, close: () => void) => {
        return (
          <DropdownMenuItem
            key={item.id}
            disabled={item.disabled}
            onSelect={() => {
              item.onClick?.();
              close();
            }}
            className="gap-2 px-3 py-2 text-xs font-medium flex cursor-pointer items-center"
          >
            {item.icon && (
              <span className="size-4 shrink-0 text-muted-foreground">
                {item.icon}
              </span>
            )}
            <span className="truncate">{item.label}</span>
          </DropdownMenuItem>
        );
      },
      [],
    );

    const renderOverflowTrigger = useCallback(
      (
        overflowItems: ToolbarItem[],
        _isChildActive: boolean,
        isOpen: boolean,
      ) => {
        return (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-expanded={isOpen}
            aria-label={`${overflowLabel} (${overflowItems.length} more)`}
            className="size-8 shrink-0 text-muted-foreground hover:text-foreground"
          >
            {overflowIcon || <MoreHorizontal className="size-4" />}
          </Button>
        );
      },
      [overflowLabel, overflowIcon],
    );

    return (
      <div
        ref={ref}
        role="toolbar"
        aria-label="Actions toolbar"
        className={cn('min-w-0 flex max-w-full items-center', className)}
        {...props}
      >
        <ResponsiveOverflow
          items={normalizedItems}
          getItemId={(item) => item.id}
          renderItem={renderItem}
          renderOverflowItem={renderOverflowItem}
          renderOverflowTrigger={renderOverflowTrigger}
          gap={gap}
          overflowMenuAlign={menuAlign}
          minVisibleItems={minVisibleItems}
          maxVisibleItems={maxVisibleItems}
          className="flex-1"
        />
      </div>
    );
  },
);

ResponsiveToolbar.displayName = 'ResponsiveToolbar';
