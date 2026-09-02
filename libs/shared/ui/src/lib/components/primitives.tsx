import { cn } from '@org/utils';
import * as LabelPrimitive from '@radix-ui/react-label';
import * as SeparatorPrimitive from '@radix-ui/react-separator';
import * as SwitchPrimitive from '@radix-ui/react-switch';
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

export {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  type TabsProps,
  type TabsListProps,
  type TabsTriggerProps,
  type TabsContentProps,
  type TabsVariant,
  type TabsSize,
} from './tabs.js';
