import { cn } from '@org/utils';
import * as CollapsiblePrimitive from '@radix-ui/react-collapsible';
import type { ComponentProps } from 'react';

/**
 * Radix Collapsible with the workspace's data-slot convention.
 *
 * Kept thin on purpose: the disclosure chrome (chevron, label, count) belongs
 * to whichever surface uses it, so only the animation of the panel lives here.
 */
export const Collapsible = CollapsiblePrimitive.Root;

export function CollapsibleTrigger({
  className,
  ...props
}: ComponentProps<typeof CollapsiblePrimitive.Trigger>) {
  return (
    <CollapsiblePrimitive.Trigger
      data-slot="collapsible-trigger"
      className={cn('outline-none', className)}
      {...props}
    />
  );
}

export function CollapsibleContent({
  className,
  ...props
}: ComponentProps<typeof CollapsiblePrimitive.Content>) {
  return (
    <CollapsiblePrimitive.Content
      data-slot="collapsible-content"
      className={cn('overflow-hidden', className)}
      {...props}
    />
  );
}
