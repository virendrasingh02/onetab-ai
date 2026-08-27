import { cn } from '@org/utils';
import * as MenubarPrimitive from '@radix-ui/react-menubar';
import { Check, ChevronRight, Circle } from 'lucide-react';
import type { ComponentProps } from 'react';

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
        'flex h-9 items-center space-x-1 rounded-card border border-border bg-surface p-1 shadow-xs',
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
        'flex cursor-pointer select-none items-center rounded-btn px-3 py-1 text-xs font-medium outline-none',
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
        'flex cursor-pointer select-none items-center rounded-btn px-2 py-1.5 text-xs outline-none focus:bg-accent focus:text-foreground data-[state=open]:bg-accent data-[state=open]:text-foreground',
        inset && 'pl-8',
        className,
      )}
      {...props}
    >
      {children}
      <ChevronRight className="ml-auto size-4" />
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
        'z-50 min-w-[8rem] max-h-(--radix-menubar-content-available-height) overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-subtle rounded-popup border border-border bg-popover p-1 text-popover-foreground shadow-elevated',
        'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
        'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
        'duration-(--duration-fast) ease-standard',
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
          'z-50 min-w-[12rem] max-h-(--radix-menubar-content-available-height) overflow-y-auto overflow-x-hidden overscroll-contain scrollbar-subtle rounded-popup border border-border bg-popover p-1 text-popover-foreground shadow-elevated',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          'duration-(--duration-fast) ease-standard',
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
        'relative flex cursor-pointer select-none items-center rounded-btn px-2 py-1.5 text-xs outline-none focus:bg-accent focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
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
        'relative flex cursor-pointer select-none items-center rounded-btn py-1.5 pl-8 pr-2 text-xs outline-none focus:bg-accent focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      checked={checked}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <MenubarPrimitive.ItemIndicator>
          <Check className="size-4" />
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
        'relative flex cursor-pointer select-none items-center rounded-btn py-1.5 pl-8 pr-2 text-xs outline-none focus:bg-accent focus:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex size-3.5 items-center justify-center">
        <MenubarPrimitive.ItemIndicator>
          <Circle className="size-2 fill-current" />
        </MenubarPrimitive.ItemIndicator>
      </span>
      {children}
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
        'px-2 py-1.5 text-xs font-semibold text-foreground',
        inset && 'pl-8',
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

export function MenubarShortcut({
  className,
  ...props
}: ComponentProps<'span'>) {
  return (
    <span
      data-slot="menubar-shortcut"
      className={cn(
        'ml-auto text-[10px] tracking-widest font-mono text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}
