import * as PopoverPrimitive from '@radix-ui/react-popover';
import type { ComponentProps } from 'react';
import { cn } from '@org/utils';

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export function PopoverContent({
  className,
  align = 'center',
  sideOffset = 4,
  collisionPadding = 8,
  ...props
}: ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        /* Popovers, menus and selects are one family: same radius token, same
           border, same lift, same 120ms curve. */
        className={cn(
          'w-72 p-3 z-50 rounded-popup border border-border bg-popover text-popover-foreground shadow-overlay outline-none',
          // Stay within the viewport the same way menus do — clamp to the room
          // Radix reports and scroll the overflow rather than rendering a
          // popover partly off-screen.
          'max-h-(--radix-popover-content-available-height) max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain scrollbar-subtle',
          'data-[state=open]:animate-in data-[state=closed]:animate-out',
          'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
          'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          'duration-(--duration-fast) ease-standard',
          'data-[side=bottom]:slide-in-from-top-1.5 data-[side=left]:slide-in-from-right-1.5 data-[side=right]:slide-in-from-left-1.5 data-[side=top]:slide-in-from-bottom-1.5',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
