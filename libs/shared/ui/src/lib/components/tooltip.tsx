import { cn } from '@org/utils';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import type { ComponentProps, ReactNode } from 'react';

export const TooltipProvider = TooltipPrimitive.Provider;
export const Tooltip = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export interface TooltipContentProps
  extends ComponentProps<typeof TooltipPrimitive.Content> {
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
          'w-fit max-w-72 rounded-lg border border-border/80 bg-popover px-2.5 py-1 text-xs font-normal text-popover-foreground shadow-md',
          'animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          className,
        )}
        {...props}
      >
        {children}
        {showArrow && (
          <TooltipPrimitive.Arrow className="fill-popover stroke-border stroke-1 size-2.5" />
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
        'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] border border-border bg-surface-raised px-1.5 text-[10px] font-medium leading-none text-subtle select-none shadow-[0_1px_0_0_rgba(0,0,0,0.04)] dark:text-muted-foreground',
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
      <span className="inline-flex items-center gap-1">
        {parts.map((part, i) => (
          <span key={i} className="inline-flex items-center gap-1">
            {i > 0 && (
              <span className="text-[10px] text-muted-foreground/70 font-normal">
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
    <span className="inline-flex items-center gap-1.5">
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
              className="text-[11px] font-normal text-muted-foreground"
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

export interface HintProps
  extends Omit<ComponentProps<typeof TooltipPrimitive.Content>, 'content'> {
  label: ReactNode;
  children: ReactNode;
  /** Keyboard shortcut rendered alongside the label (e.g. "G then U", "Ctrl+K"). */
  shortcut?: ReactNode;
  delayDuration?: number;
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
  delayDuration = 300,
  showArrow = false,
  ...props
}: HintProps) {
  return (
    <Tooltip delayDuration={delayDuration}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} showArrow={showArrow} {...props}>
        {shortcut ? (
          <span className="inline-flex items-center gap-2">
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

