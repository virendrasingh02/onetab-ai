import { cn } from '@org/utils';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ComponentProps, ReactNode } from 'react';

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export function TooltipContent({
  className,
  sideOffset = 6,
  collisionPadding = 8,
  children,
  ...props
}: ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        // Without it the bubble hugs the viewport edge once collision detection
        // kicks in, so a tooltip on the header's last icon read as clipped.
        collisionPadding={collisionPadding}
        className={cn(
          'bg-foreground text-background w-fit rounded-md px-2 py-1 text-xs font-medium shadow-md',
          /*
           * `w-fit` alone lets a long label — a full timestamp, a channel name —
           * run out as one unbroken line. The cap is what gives `text-balance`
           * something to balance.
           */
          'max-w-64 text-balance',
          /*
           * The design scale puts tooltips above every other layer (modal 50,
           * toast 60) because they are triggered *from* those layers. The old
           * `z-50` tied them with dialogs and sheets, so a tooltip inside one
           * won or lost on portal insertion order alone.
           */
          'z-(--z-tooltip)',
          // Radix reports the corner nearest the trigger, so the zoom grows out
          // of the control rather than out of the bubble's own centre.
          'origin-(--radix-tooltip-content-transform-origin)',
          /*
           * Unconditional on enter: Content only mounts while open, and gating
           * on `delayed-open` skipped the animation entirely for keyboard focus
           * and for the `skipDelayDuration` hop between adjacent icon buttons,
           * both of which open `instant`.
           */
          'animate-in fade-in-0 zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          className,
        )}
        {...props}
      >
        {children}
        {/*
         * A rotated square, not Radix's own triangle: the box needs `bg-` for
         * the diamond, and `fill-` only ever coloured the polygon inside it. So
         * with `fill-*` alone this rendered as a triangle turned 45° — a
         * lopsided sliver beside the bubble. The half that overlaps the bubble
         * is invisible because the fill matches, leaving ~5px of rounded point
         * inside the 6px `sideOffset` gap.
         */}
        <TooltipPrimitive.Arrow className="bg-foreground fill-foreground size-2.5 translate-y-[calc(-50%-2px)] rotate-45 rounded-[2px]" />
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
        {/*
         * The flex row is only for the shortcut pairing. Applying it to every
         * label made a stacked label — `LocalTime`'s date over its zone — a
         * single centred flex item, which fought the bubble's own wrapping.
         */}
        {shortcut ? (
          <span className="flex items-center gap-2">
            {label}
            <kbd className="bg-background/20 rounded px-1 py-px font-mono text-[10px]">
              {shortcut}
            </kbd>
          </span>
        ) : (
          label
        )}
      </TooltipContent>
    </Tooltip>
  );
}
