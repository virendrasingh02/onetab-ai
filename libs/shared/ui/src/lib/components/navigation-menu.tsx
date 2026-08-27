import { cn } from '@org/utils';
import * as NavigationMenuPrimitive from '@radix-ui/react-navigation-menu';
import { cva } from 'class-variance-authority';
import { ChevronDown } from 'lucide-react';
import type { ComponentProps } from 'react';

export const NavigationMenuItem = NavigationMenuPrimitive.Item;
export const NavigationMenuLink = NavigationMenuPrimitive.Link;

export function NavigationMenu({
  className,
  children,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Root>) {
  return (
    <NavigationMenuPrimitive.Root
      data-slot="navigation-menu"
      className={cn(
        'relative z-10 flex max-w-max flex-1 items-center justify-center',
        className,
      )}
      {...props}
    >
      {children}
      <NavigationMenuViewport />
    </NavigationMenuPrimitive.Root>
  );
}

export function NavigationMenuList({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.List>) {
  return (
    <NavigationMenuPrimitive.List
      data-slot="navigation-menu-list"
      className={cn(
        'group flex flex-1 list-none items-center justify-center space-x-1',
        className,
      )}
      {...props}
    />
  );
}

export const navigationMenuTriggerStyle = cva(
  'group inline-flex h-8 w-max items-center justify-center rounded-btn bg-transparent px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent hover:text-foreground focus:bg-accent focus:text-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50',
);

export function NavigationMenuTrigger({
  className,
  children,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Trigger>) {
  return (
    <NavigationMenuPrimitive.Trigger
      data-slot="navigation-menu-trigger"
      className={cn(navigationMenuTriggerStyle(), 'group', className)}
      {...props}
    >
      {children}{' '}
      <ChevronDown
        className="relative top-[1px] ml-1 size-3 transition duration-200 group-data-[state=open]:rotate-180"
        aria-hidden="true"
      />
    </NavigationMenuPrimitive.Trigger>
  );
}

export function NavigationMenuContent({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Content>) {
  return (
    <NavigationMenuPrimitive.Content
      data-slot="navigation-menu-content"
      className={cn(
        'left-0 top-0 w-full data-[motion^=from-]:animate-in data-[motion^=to-]:animate-out data-[motion^=from-]:fade-in data-[motion^=to-]:fade-out data-[motion=from-end]:slide-in-from-right-52 data-[motion=from-start]:slide-in-from-left-52 data-[motion=to-end]:slide-out-to-right-52 data-[motion=to-start]:slide-out-to-left-52 md:absolute md:w-auto',
        className,
      )}
      {...props}
    />
  );
}

export function NavigationMenuViewport({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Viewport>) {
  return (
    <div className={cn('absolute left-0 top-full flex justify-center')}>
      <NavigationMenuPrimitive.Viewport
        data-slot="navigation-menu-viewport"
        className={cn(
          'origin-top-center relative mt-1.5 h-[var(--radix-navigation-menu-viewport-height)] w-full overflow-hidden rounded-popup border border-border bg-popover text-popover-foreground shadow-elevated data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-90 md:w-[var(--radix-navigation-menu-viewport-width)]',
          className,
        )}
        {...props}
      />
    </div>
  );
}

export function NavigationMenuIndicator({
  className,
  ...props
}: ComponentProps<typeof NavigationMenuPrimitive.Indicator>) {
  return (
    <NavigationMenuPrimitive.Indicator
      data-slot="navigation-menu-indicator"
      className={cn(
        'top-full z-[1] flex h-1.5 items-end justify-center overflow-hidden data-[state=visible]:animate-in data-[state=hidden]:animate-out data-[state=hidden]:fade-out data-[state=visible]:fade-in',
        className,
      )}
      {...props}
    >
      <div className="relative top-[60%] size-2 rotate-45 rounded-tl-sm bg-border shadow-md" />
    </NavigationMenuPrimitive.Indicator>
  );
}
