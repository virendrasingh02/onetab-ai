import { cn } from '@org/utils';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ComponentProps, ReactNode } from 'react';

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          'bg-foreground text-background z-50 w-fit rounded-md px-2 py-1 text-xs font-medium text-balance',
          'data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="fill-foreground z-50 size-2.5 translate-y-[calc(-50%_-_1px)] rotate-45 rounded-[2px]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export interface HintProps
  extends Omit<ComponentProps<typeof TooltipPrimitive.Content>, 'content'> {
  label: ReactNode;
  children: ReactNode;
  /** Keyboard shortcut rendered alongside the label. */
  shortcut?: string;
  delayDuration?: number;
}

/**
 * One-liner tooltip for icon buttons — the dominant case in the app chrome.
 * Wrap the tree in a single <TooltipProvider> at the app root.
 */
export function Hint({
  label,
  children,
  shortcut,
  side = 'top',
  delayDuration = 300,
  ...props
}: HintProps) {
  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} {...props}>
        <span className="flex items-center gap-2">
          {label}
          {shortcut ? (
            <kbd className="bg-background/20 rounded px-1 py-px font-mono text-[10px]">
              {shortcut}
            </kbd>
          ) : null}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
