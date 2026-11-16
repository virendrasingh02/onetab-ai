import { cn } from '@org/utils';
import * as MenubarPrimitive from '@radix-ui/react-menubar';
import { Check, ChevronRight } from 'lucide-react';
import type { ComponentProps } from 'react';
import { KbdShortcut } from './kbd.js';
import {
  menuCheckClasses,
  menuIndicator,
  menuIndicatorInset,
  menuItemClasses,
  menuLabelClasses,
  menuSurfaceBase,
  menuTrailingIndicator,
  menuTrailingInset,
} from './menu-styles.js';

export const MenubarMenu = MenubarPrimitive.Menu;
export const MenubarGroup = MenubarPrimitive.Group;
export const MenubarPortal = MenubarPrimitive.Portal;
export const MenubarSub = MenubarPrimitive.Sub;
export const MenubarRadioGroup = MenubarPrimitive.RadioGroup;

export function Menubar({
  className,
  ...props
}: ComponentProps<typeof MenubarPrimitive.Root>) {
  return (
    <MenubarPrimitive.Root
      data-slot="menubar"
      className={cn(
        'h-9 space-x-1 p-1 flex items-center rounded-card border border-border bg-surface shadow-xs',
        className,
      )}
      {...props}
    />
  );
}

export function MenubarTrigger({
  className,
  ...props
}: ComponentProps<typeof MenubarPrimitive.Trigger>) {
  return (
    <MenubarPrimitive.Trigger
      data-slot="menubar-trigger"
      className={cn(
        'px-3 py-1 text-xs font-medium flex cursor-pointer items-center rounded-btn outline-none select-none',
        'focus:bg-accent focus:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground',
        className,
      )}
      {...props}
    />
  );
}

export function MenubarSubTrigger({
  className,
  inset,
  children,
  ...props
}: ComponentProps<typeof MenubarPrimitive.SubTrigger> & {
  inset?: boolean;
}) {
  return (
    <MenubarPrimitive.SubTrigger
      data-slot="menubar-sub-trigger"
      className={cn(
        menuItemClasses,
        'data-[state=open]:bg-accent',
        inset && menuIndicatorInset,
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight className="size-4 ml-auto text-subtle" />
    </MenubarPrimitive.SubTrigger>
  );
}

export function MenubarSubContent({
  className,
  collisionPadding = 8,
  ...props
}: ComponentProps<typeof MenubarPrimitive.SubContent>) {
  return (
    <MenubarPrimitive.SubContent
      data-slot="menubar-sub-content"
      collisionPadding={collisionPadding}
      className={cn(
        menuSurfaceBase,
          'max-h-(--radix-menubar-content-available-height)',
        className,
      )}
      {...props}
    />
  );
}

export function MenubarContent({
  className,
  align = 'start',
  alignOffset = -4,
  sideOffset = 8,
  collisionPadding = 8,
  ...props
}: ComponentProps<typeof MenubarPrimitive.Content>) {
  return (
    <MenubarPortal>
      <MenubarPrimitive.Content
        data-slot="menubar-content"
        align={align}
        alignOffset={alignOffset}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          menuSurfaceBase,
          'max-h-(--radix-menubar-content-available-height)',
          className,
        )}
        {...props}
      />
    </MenubarPortal>
  );
}

export function MenubarItem({
  className,
  inset,
  ...props
}: ComponentProps<typeof MenubarPrimitive.Item> & {
  inset?: boolean;
}) {
  return (
    <MenubarPrimitive.Item
      data-slot="menubar-item"
      className={cn(
        menuItemClasses,
        inset && 'pl-8',
        className,
      )}
      {...props}
    />
  );
}

export function MenubarCheckboxItem({
  className,
  children,
  checked,
  ...props
}: ComponentProps<typeof MenubarPrimitive.CheckboxItem>) {
  return (
    <MenubarPrimitive.CheckboxItem
      data-slot="menubar-checkbox-item"
      className={cn(
        menuItemClasses,
        menuIndicatorInset,
        className,
      )}
      checked={checked}
      {...props}
    >
      <span className={menuIndicator}>
        <MenubarPrimitive.ItemIndicator>
          <Check className={menuCheckClasses} />
        </MenubarPrimitive.ItemIndicator>
      </span>
      {children}
    </MenubarPrimitive.CheckboxItem>
  );
}

export function MenubarRadioItem({
  className,
  children,
  ...props
}: ComponentProps<typeof MenubarPrimitive.RadioItem>) {
  return (
    <MenubarPrimitive.RadioItem
      data-slot="menubar-radio-item"
      className={cn(
        menuItemClasses,
        menuTrailingInset,
        className,
      )}
      {...props}
    >
      {children}
      <span className={menuTrailingIndicator}>
        <MenubarPrimitive.ItemIndicator>
          <Check className={menuCheckClasses} />
        </MenubarPrimitive.ItemIndicator>
      </span>
    </MenubarPrimitive.RadioItem>
  );
}

export function MenubarLabel({
  className,
  inset,
  ...props
}: ComponentProps<typeof MenubarPrimitive.Label> & {
  inset?: boolean;
}) {
  return (
    <MenubarPrimitive.Label
      data-slot="menubar-label"
      className={cn(
        menuLabelClasses,
        inset && menuIndicatorInset,
        className,
      )}
      {...props}
    />
  );
}

export function MenubarSeparator({
  className,
  ...props
}: ComponentProps<typeof MenubarPrimitive.Separator>) {
  return (
    <MenubarPrimitive.Separator
      data-slot="menubar-separator"
      className={cn('-mx-1 my-1 h-px bg-border', className)}
      {...props}
    />
  );
}

export interface MenubarShortcutProps extends ComponentProps<'span'> {
  keys?: string[] | string;
}

export function MenubarShortcut({
  className,
  keys,
  children,
  ...props
}: MenubarShortcutProps) {
  if (keys) {
    return (
      <span
        data-slot="menubar-shortcut"
        className={cn('ml-auto inline-flex items-center', className)}
        {...props}
      >
        <KbdShortcut keys={keys} size="xs" variant="muted" />
      </span>
    );
  }

  return (
    <span
      data-slot="menubar-shortcut"
      className={cn(
        'tracking-widest gap-1 ml-auto inline-flex items-center font-mono text-2xs text-muted-foreground',
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
