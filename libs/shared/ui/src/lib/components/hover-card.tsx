import { cn } from '@org/utils';
import * as HoverCardPrimitive from '@radix-ui/react-hover-card';
import type { ComponentProps } from 'react';

export const HoverCard = HoverCardPrimitive.Root;
export const HoverCardTrigger = HoverCardPrimitive.Trigger;
export const HoverCardPortal = HoverCardPrimitive.Portal;

export function HoverCardContent({
  className,
  align = 'center',
  sideOffset = 4,
  ...props
}: ComponentProps<typeof HoverCardPrimitive.Content>) {
  return (
    <HoverCardPortal>
      <HoverCardPrimitive.Content
        data-slot="hover-card-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-64 rounded-popup border border-border bg-popover p-4 text-popover-foreground shadow-elevated outline-none',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          'duration-(--duration-fast) ease-standard',
          className,
        )}
        {...props}
      />
    </HoverCardPortal>
  );
}
