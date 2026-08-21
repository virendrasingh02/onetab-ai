import { cn } from '@org/utils';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ComponentProps, ReactNode } from 'react';

export interface TooltipProviderProps
  extends ComponentProps<typeof TooltipPrimitive.Provider> {}

export function TooltipProvider({
  delayDuration = 150,
  skipDelayDuration = 100,
  disableHoverableContent = true,
  children,
  ...props
}: TooltipProviderProps) {
  return (
    <TooltipPrimitive.Provider
      delayDuration={delayDuration}
      skipDelayDuration={skipDelayDuration}
      disableHoverableContent={disableHoverableContent}
      {...props}
    >
      {children}
    </TooltipPrimitive.Provider>
  );
}

export interface TooltipProps
  extends ComponentProps<typeof TooltipPrimitive.Root> {}

export function Tooltip({
  disableHoverableContent = true,
  ...props
}: TooltipProps) {
  return (
    <TooltipPrimitive.Root
      disableHoverableContent={disableHoverableContent}
      {...props}
    />
  );
}

export const TooltipTrigger = TooltipPrimitive.Trigger;

export interface TooltipContentProps extends ComponentProps<
  typeof TooltipPrimitive.Content
> {
  /** Optional arrow pointer. Disabled by default for modern floating pill style. */
  showArrow?: boolean;
}

export function TooltipContent({
  className,
  sideOffset = 6,
  collisionPadding = 8,
  showArrow = false,
  children,
  ...props
}: TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          'z-(--z-tooltip) origin-(--radix-tooltip-content-transform-origin)',
          'max-w-72 px-2 py-1 font-normal w-fit rounded-popup border border-border bg-popover text-[11px] text-popover-foreground shadow-elevated',
          'animate-in fade-in-0 zoom-in-95 duration-100 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-75',
          className,
        )}
        {...props}
      >
        {children}
        {showArrow && (
          <TooltipPrimitive.Arrow className="size-2.5 fill-popover stroke-border stroke-1" />
        )}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

export interface KbdProps extends ComponentProps<'kbd'> {
  children: ReactNode;
}

/**
 * Keyboard key badge styled for tooltips, menus, and inline hints.
 */
export function Kbd({ className, children, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        'px-1.5 font-medium inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-border bg-surface-raised text-[10px] leading-none text-subtle shadow-[0_1px_0_0_rgba(0,0,0,0.04)] select-none dark:text-muted-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  );
}

/**
 * Parses shortcut strings into formatted key badges and connector words
 * e.g., "G then U", "Ctrl+K", "G T", "⌘K".
 */
export function renderShortcut(shortcut: ReactNode): ReactNode {
  if (typeof shortcut !== 'string') {
    return shortcut;
  }

  const trimmed = shortcut.trim();
  if (!trimmed) return null;

  // Handle + separated shortcuts without spaces (e.g. "Ctrl+Shift+N" or "Ctrl+K")
  if (trimmed.includes('+') && !trimmed.includes(' ')) {
    const parts = trimmed.split('+');
    return (
      <span className="gap-1 inline-flex items-center">
        {parts.map((part, i) => (
          <span key={i} className="gap-1 inline-flex items-center">
            {i > 0 && (
              <span className="font-normal text-[10px] text-muted-foreground/70">
                +
              </span>
            )}
            <Kbd>{part.trim()}</Kbd>
          </span>
        ))}
      </span>
    );
  }

  const tokens = trimmed.split(/\s+/);
  if (tokens.length === 1) {
    return <Kbd>{trimmed}</Kbd>;
  }

  return (
    <span className="gap-1.5 inline-flex items-center">
      {tokens.map((token, i) => {
        const lower = token.toLowerCase();
        if (
          lower === 'then' ||
          lower === 'or' ||
          lower === 'to' ||
          token === '+' ||
          token === '/'
        ) {
          return (
            <span
              key={i}
              className="font-normal text-[11px] text-muted-foreground"
            >
              {token}
            </span>
          );
        }
        return <Kbd key={i}>{token}</Kbd>;
      })}
    </span>
  );
}

export interface HintProps extends Omit<
  ComponentProps<typeof TooltipPrimitive.Content>,
  'content'
> {
  label: ReactNode;
  children: ReactNode;
  /** Keyboard shortcut rendered alongside the label (e.g. "G then U", "Ctrl+K"). */
  shortcut?: ReactNode;
  delayDuration?: number;
  disableHoverableContent?: boolean;
  showArrow?: boolean;
}

/**
 * One-liner tooltip for buttons, icon buttons, and navigation elements.
 * Wrap the tree in a single <TooltipProvider> at the app root.
 */
export function Hint({
  label,
  children,
  shortcut,
  side = 'top',
  delayDuration = 150,
  disableHoverableContent = true,
  showArrow = false,
  ...props
}: HintProps) {
  return (
    <Tooltip
      delayDuration={delayDuration}
      disableHoverableContent={disableHoverableContent}
    >
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} showArrow={showArrow} {...props}>
        {shortcut ? (
          <span className="gap-2 inline-flex items-center">
            <span>{label}</span>
            {renderShortcut(shortcut)}
          </span>
        ) : (
          label
        )}
      </TooltipContent>
    </Tooltip>
  );
}
