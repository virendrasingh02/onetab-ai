import { cn } from '@org/utils';
import * as LabelPrimitive from '@radix-ui/react-label';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import type { ComponentProps } from 'react';

/* -------------------------------------------------------------- Label ---- */

export function Label({
  className,
  ...props
}: ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(
        'gap-2 text-sm font-medium flex items-center leading-none select-none',
        'peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        'group-data-[disabled=true]:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

/* ---------------------------------------------------------- Separator ---- */

export function Separator({
  className,
  orientation = 'horizontal',
  decorative = true,
  ...props
}: ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      data-slot="separator"
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
        className,
      )}
      {...props}
    />
  );
}

/*
 * ScrollArea used to live here as a Radix wrapper. It is now SimpleBar-backed
 * and lives in ./scroll-area.tsx — one scrollbar for every browser, and both
 * axes handled by the same component, so the old `<ScrollBar orientation>`
 * child is gone with it.
 */

/* ------------------------------------------------------------- Switch ---- */

export function Switch({
  className,
  ...props
}: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'peer h-5 w-9 shadow-xs inline-flex shrink-0 items-center rounded-full border-2 border-transparent transition-colors',
        'focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-primary data-[state=unchecked]:bg-input',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'size-4 shadow-sm pointer-events-none block rounded-full bg-background ring-0 transition-transform',
          'data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0',
        )}
      />
    </SwitchPrimitive.Root>
  );
}

/* --------------------------------------------------------------- Tabs ---- */

export const Tabs = TabsPrimitive.Root;

/**
 * Two shapes, because the app genuinely uses two.
 *
 * `pill` is the filled tray — for switching a view *within* a panel or card.
 * `underline` is the page-level strip that sits under a `PageHeader` and reads
 * as primary navigation for the screen. Several screens hand-rolled the
 * underline look out of raw `<button>`s, which gave them no `tablist` role and
 * no arrow-key movement between tabs; routing it through Radix restores both.
 */
export type TabsVariant = 'pill' | 'underline';

export function TabsList({
  className,
  variant = 'pill',
  ...props
}: ComponentProps<typeof TabsPrimitive.List> & { variant?: TabsVariant }) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(
        'max-w-full scrollbar-none flex-nowrap overflow-x-auto text-muted-foreground',
        variant === 'pill'
          ? 'h-9 sm:justify-center p-1 inline-flex w-fit items-center justify-start rounded-lg bg-muted'
          : 'gap-6 flex w-full items-center border-b border-border/60',
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  variant = 'pill',
  ...props
}: ComponentProps<typeof TabsPrimitive.Trigger> & { variant?: TabsVariant }) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        'gap-1.5 font-medium inline-flex items-center justify-center whitespace-nowrap',
        'transition-[color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-50',
        "[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
        variant === 'pill'
          ? [
              'px-3 py-1 text-sm flex-1 rounded-md',
              'data-[state=active]:shadow-xs data-[state=active]:bg-background data-[state=active]:text-foreground',
            ]
          : [
              // The inactive border keeps the row from shifting 2px on select.
              'pb-3 text-sm shrink-0 rounded-t-sm border-b-2 border-transparent',
              'hover:text-foreground',
              'data-[state=active]:font-semibold data-[state=active]:border-primary data-[state=active]:text-foreground',
            ],
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn('flex-1 outline-none', className)}
      {...props}
    />
  );
}
