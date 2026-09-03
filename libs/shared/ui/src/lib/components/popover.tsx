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
           border, same lift. */
        className={cn(
          'w-72 p-3 z-50 rounded-popup border border-border bg-popover text-popover-foreground shadow-overlay outline-none',
          // Stay within the viewport the same way menus do — clamp to the room
          // Radix reports and scroll the overflow rather than rendering a
          // popover partly off-screen.
          'max-h-(--radix-popover-content-available-height) max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain scrollbar-subtle',
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
