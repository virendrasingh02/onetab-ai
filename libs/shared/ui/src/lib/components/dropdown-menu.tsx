import { cn } from '@org/utils';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight, Circle } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

/*
 * Menus are built from the same tokens as everything else on the page:
 * `rounded-popup` for the surface, `rounded-btn` for the rows, `shadow-overlay`
 * for the lift. They used to carry a hand-picked `rounded-2xl` / `shadow-2xl`
 * of their own, so a menu opened from an 8px-cornered button dropped a 16px
 * pill under it and read as a different design system.
 */
const menuSurface = [
  'z-50 min-w-44 overflow-hidden bg-popover text-popover-foreground',
  'rounded-popup border border-border p-1 shadow-overlay',
  'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
  'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
  'duration-(--duration-fast) ease-standard',
  'data-[side=bottom]:slide-in-from-top-1.5 data-[side=top]:slide-in-from-bottom-1.5',
  'data-[side=left]:slide-in-from-right-1.5 data-[side=right]:slide-in-from-left-1.5',
];

/*
 * One row is 28px — the same box a `size="sm"` Button occupies, and the same
 * `text-xs` the command palette, composer and every toolbar already use. The
 * previous 13px/`py-2` row was a size that appears nowhere else in the app.
 */
const menuItem = [
  'group relative flex cursor-pointer select-none items-center gap-2 rounded-btn px-2 py-1.5 text-xs font-medium outline-none',
  'transition-colors duration-(--duration-fast) ease-standard',
  'focus:bg-accent focus:text-accent-foreground',
  'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
  // Leading icons stay 16px: that is what call sites pass explicitly almost
  // everywhere, so a smaller default would only mismatch its own neighbours.
  "[&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground focus:[&_svg]:text-accent-foreground",
];

/** Left gutter reserved for a check/dot indicator, and the indicator itself. */
const menuIndicatorInset = 'pl-7';
const menuIndicator =
  'absolute left-2 flex size-3.5 items-center justify-center';

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        className={cn(menuSurface, className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export interface DropdownMenuItemProps
  extends ComponentProps<typeof DropdownMenuPrimitive.Item> {
  inset?: boolean;
  variant?: 'default' | 'destructive';
  description?: ReactNode;
}

export function DropdownMenuItem({
  className,
  inset,
  variant = 'default',
  children,
  description,
  ...props
}: DropdownMenuItemProps) {
  const isArray = Array.isArray(children) && children.length > 1;
  const icon = isArray ? children[0] : null;
  const restChildren = isArray ? children.slice(1) : children;

  return (
    <DropdownMenuPrimitive.Item
      data-slot="dropdown-menu-item"
      data-variant={variant}
      className={cn(
        menuItem,
        inset && menuIndicatorInset,
        description && 'items-start py-1.5',
        variant === 'destructive' &&
          'text-destructive focus:bg-destructive/10 focus:text-destructive [&_svg]:text-destructive focus:[&_svg]:text-destructive',
        className,
      )}
      {...props}
    >
      {description ? (
        <>
          {icon}
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center justify-between font-medium leading-snug text-xs">
              {restChildren}
            </div>
            <p className="text-[11px] text-muted-foreground font-normal leading-normal mt-0.5 whitespace-normal pr-1">
              {description}
            </p>
          </div>
        </>
      ) : (
        children
      )}
    </DropdownMenuPrimitive.Item>
  );
}

export function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.CheckboxItem>) {
  return (
    <DropdownMenuPrimitive.CheckboxItem
      className={cn(menuItem, menuIndicatorInset, className)}
      checked={checked}
      {...props}
    >
      <span className={menuIndicator}>
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className="size-3.5 text-foreground" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

export function DropdownMenuRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.RadioItem>) {
  return (
    <DropdownMenuPrimitive.RadioItem
      className={cn(menuItem, menuIndicatorInset, className)}
      {...props}
    >
      <span className={menuIndicator}>
        <DropdownMenuPrimitive.ItemIndicator>
          <Circle className="size-1.5 fill-current text-foreground" />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.RadioItem>
  );
}

export function DropdownMenuLabel({
  className,
  inset,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Label> & { inset?: boolean }) {
  return (
    <DropdownMenuPrimitive.Label
      className={cn(
        'text-subtle px-2 py-1 text-[10px] font-semibold tracking-wider uppercase',
        inset && menuIndicatorInset,
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSeparator({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Separator>) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn('bg-border -mx-1 my-1 h-px', className)}
      {...props}
    />
  );
}

export function DropdownMenuShortcut({
  className,
  ...props
}: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'text-subtle ml-auto pl-3 font-mono text-[10px] font-normal tracking-wide',
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.SubTrigger> & {
  inset?: boolean;
}) {
  return (
    <DropdownMenuPrimitive.SubTrigger
      className={cn(
        menuItem,
        'data-[state=open]:bg-accent',
        inset && menuIndicatorInset,
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto size-3.5 text-subtle shrink-0" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

export function DropdownMenuSubContent({
  className,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      className={cn(menuSurface, className)}
      {...props}
    />
  );
}
