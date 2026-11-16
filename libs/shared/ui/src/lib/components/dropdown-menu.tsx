import { cn } from '@org/utils';
import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight, Circle } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';
import {
  menuDestructiveClasses,
  menuIndicator,
  menuIndicatorInset,
  menuItemClasses,
  menuCheckClasses,
  menuLabelClasses,
  menuSeparatorClasses,
  menuSurfaceBase,
  menuTrailingIndicator,
  menuTrailingInset,
} from './menu-styles.js';

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuGroup = DropdownMenuPrimitive.Group;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
export const DropdownMenuSub = DropdownMenuPrimitive.Sub;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  collisionPadding = 8,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        data-slot="dropdown-menu-content"
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          menuSurfaceBase,
          'max-h-(--radix-dropdown-menu-content-available-height)',
          className,
        )}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export interface DropdownMenuItemProps extends ComponentProps<
  typeof DropdownMenuPrimitive.Item
> {
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
        menuItemClasses,
        inset && menuIndicatorInset,
        description && 'items-start',
        variant === 'destructive' && menuDestructiveClasses,
        className,
      )}
      {...props}
    >
      {description ? (
        <>
          {icon}
          <div className="min-w-0 flex flex-1 flex-col">
            <div className="flex items-center justify-between">
              {restChildren}
            </div>
            <p className="font-normal leading-normal mt-0.5 pr-1 text-meta whitespace-normal text-muted-foreground">
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
      className={cn(menuItemClasses, menuIndicatorInset, className)}
      checked={checked}
      {...props}
    >
      <span className={menuIndicator}>
        <DropdownMenuPrimitive.ItemIndicator>
          <Check className={menuCheckClasses} />
        </DropdownMenuPrimitive.ItemIndicator>
      </span>
      {children}
    </DropdownMenuPrimitive.CheckboxItem>
  );
}

export function DropdownMenuRadioItem({
  className,
  children,
  indicator = 'check',
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.RadioItem> & {
  /**
   * `check` (default) trails the label — the house style for every
   * single-select menu (size, sort order, fiscal month…), where the row reads
   * as "this one is active". `dot` sits in the left gutter like a radio.
   */
  indicator?: 'dot' | 'check';
}) {
  if (indicator === 'check') {
    return (
      <DropdownMenuPrimitive.RadioItem
        className={cn(menuItemClasses, menuTrailingInset, className)}
        {...props}
      >
        {children}
        <span className={menuTrailingIndicator}>
          <DropdownMenuPrimitive.ItemIndicator>
            <Check className={menuCheckClasses} />
          </DropdownMenuPrimitive.ItemIndicator>
        </span>
      </DropdownMenuPrimitive.RadioItem>
    );
  }

  return (
    <DropdownMenuPrimitive.RadioItem
      className={cn(menuItemClasses, menuIndicatorInset, className)}
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
      className={cn(menuLabelClasses, inset && menuIndicatorInset, className)}
      {...props}
    />
  );
}

/**
 * A menu row for content rendered *into* an open menu from a different React
 * tree — a slot filled with `createPortal`, like the conversation's own
 * entries in a channel header's "⋯" menu. A portal keeps the context of where
 * it was rendered, not where it lands, so a `DropdownMenuItem` there has no
 * Radix Menu around it and throws. This looks identical; selecting it runs
 * `onSelect` and then closes the menu the way Escape would. It sits outside
 * the menu's arrow-key roving but is reachable with Tab.
 */
export function DetachedMenuItem({
  className,
  onSelect,
  onClick,
  ...props
}: ComponentProps<'button'> & { onSelect?: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      data-slot="dropdown-menu-item"
      className={cn(menuItemClasses, 'w-full text-left', className)}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        onSelect?.();
        // Radix dismisses the open menu on an Escape keydown seen by the
        // document, which is where this bubbles to.
        event.currentTarget.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        );
      }}
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
      className={cn(menuSeparatorClasses, className)}
      {...props}
    />
  );
}

import { KbdShortcut } from './kbd.js';

export interface DropdownMenuShortcutProps extends ComponentProps<'span'> {
  keys?: string[] | string;
}

export function DropdownMenuShortcut({
  className,
  keys,
  children,
  ...props
}: DropdownMenuShortcutProps) {
  if (keys) {
    return (
      <span
        className={cn('pl-3 ml-auto inline-flex items-center', className)}
        {...props}
      >
        <KbdShortcut keys={keys} size="xs" variant="muted" />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'pl-3 font-normal gap-1 ml-auto inline-flex items-center text-xs text-subtle tabular-nums',
        className,
      )}
      {...props}
    >
      {typeof children === 'string' ? (
        <KbdShortcut shortcut={children} size="xs" variant="muted" />
      ) : (
        children
      )}
    </span>
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
        menuItemClasses,
        'data-[state=open]:bg-accent',
        inset && menuIndicatorInset,
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight className="size-4 ml-auto shrink-0 text-subtle" />
    </DropdownMenuPrimitive.SubTrigger>
  );
}

export function DropdownMenuSubContent({
  className,
  collisionPadding = 8,
  ...props
}: ComponentProps<typeof DropdownMenuPrimitive.SubContent>) {
  return (
    <DropdownMenuPrimitive.SubContent
      collisionPadding={collisionPadding}
      className={cn(
        menuSurfaceBase,
        'max-h-(--radix-dropdown-menu-content-available-height)',
        className,
      )}
      {...props}
    />
  );
}
