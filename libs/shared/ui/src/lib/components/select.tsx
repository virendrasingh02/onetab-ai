import { cn } from '@org/utils';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import type { ComponentProps } from 'react';

/**
 * Radix Select. Replaces the native `<select>` elements that could not be
 * styled consistently across themes and platforms — Radix owns the listbox
 * semantics, typeahead and keyboard handling.
 */
export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export function SelectTrigger({
  className,
  size = 'md',
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Trigger> & { size?: 'sm' | 'md' }) {
  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      /*
       * A select is a field, so it is built to the same spec as `Input`:
       * same height, radius, fill and focus ring. It used to be a step taller
       * with `text-sm` and a 3px ring, which made every form row that paired a
       * text field with a select sit crooked.
       */
      className={cn(
        'gap-2 flex w-fit items-center justify-between rounded-input border border-input bg-surface',
        'text-xs whitespace-nowrap text-foreground',
        'transition-[color,border-color,box-shadow] duration-(--duration-fast) ease-standard',
        'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:outline-none',
        'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-disabled disabled:opacity-100',
        'data-[placeholder]:text-subtle',
        "[&_svg:not([class*='size-'])]:size-3.5 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        size === 'sm' ? 'h-7 px-2.5' : 'h-8 px-3',
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="size-3.5 text-subtle" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = 'popper',
  ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        data-slot="select-content"
        position={position}
        /* Same surface recipe as `DropdownMenuContent` — a listbox and a menu
           are the same object to the eye, so they share radius and lift. */
        className={cn(
          'relative z-50 max-h-(--radix-select-content-available-height) bg-popover text-popover-foreground',
          'min-w-36 p-1 overflow-hidden rounded-popup border border-border shadow-overlay',
          'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          'duration-(--duration-fast) ease-standard',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1.5 data-[side=top]:-translate-y-1.5',
          className,
        )}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            'space-y-0.5',
            position === 'popper' &&
              'scroll-my-1 h-(--radix-select-trigger-height) w-full min-w-(--radix-select-trigger-width)',
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export function SelectLabel({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Label>) {
  return (
    <SelectPrimitive.Label
      data-slot="select-label"
      className={cn(
        'px-2 py-1 font-semibold tracking-wider text-[10px] text-subtle uppercase',
        className,
      )}
      {...props}
    />
  );
}

export function SelectItem({
  className,
  children,
  ...props
}: ComponentProps<typeof SelectPrimitive.Item>) {
  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      className={cn(
        'gap-2 py-1.5 pr-7 pl-2 relative flex w-full cursor-pointer items-center rounded-btn',
        'text-xs font-medium outline-none select-none',
        'transition-colors duration-(--duration-fast) ease-standard',
        'focus:bg-accent focus:text-accent-foreground',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
        "[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg]:text-muted-foreground focus:[&_svg]:text-accent-foreground",
        className,
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <span className="right-2 size-3.5 absolute flex items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="size-3.5 text-foreground" />
        </SelectPrimitive.ItemIndicator>
      </span>
    </SelectPrimitive.Item>
  );
}

export function SelectSeparator({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.Separator>) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn('-mx-1 my-1 h-px shrink-0 bg-border', className)}
      {...props}
    />
  );
}

function SelectScrollUpButton({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.ScrollUpButton>) {
  return (
    <SelectPrimitive.ScrollUpButton
      className={cn(
        'py-1 [&_svg]:size-3.5 flex cursor-default items-center justify-center text-subtle',
        className,
      )}
      {...props}
    >
      <ChevronUp className="size-4" />
    </SelectPrimitive.ScrollUpButton>
  );
}

function SelectScrollDownButton({
  className,
  ...props
}: ComponentProps<typeof SelectPrimitive.ScrollDownButton>) {
  return (
    <SelectPrimitive.ScrollDownButton
      className={cn(
        'py-1 [&_svg]:size-3.5 flex cursor-default items-center justify-center text-subtle',
        className,
      )}
      {...props}
    >
      <ChevronDown className="size-4" />
    </SelectPrimitive.ScrollDownButton>
  );
}

export { SelectScrollUpButton, SelectScrollDownButton };
