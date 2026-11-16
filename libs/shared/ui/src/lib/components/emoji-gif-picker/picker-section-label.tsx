import { cn } from '@org/utils';
import type { ReactNode } from 'react';

/**
 * Section header inside a picker's scroll area ("Recent", "Trending", a
 * sticker pack name). Sticks to the top while its section scrolls, the same
 * way the emoji tab's category headers do, so every tab reads alike.
 *
 * Bleeds across the scroll area's `px-3` gutter so the sticky background
 * covers the full width; the scroll area must therefore have no top padding.
 */
export function PickerSectionLabel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'top-0 -mx-3 gap-1.5 px-3.5 pb-1.5 pt-2.5 font-bold tracking-wider backdrop-blur sticky z-10 flex items-center bg-popover/95 text-meta text-muted-foreground uppercase',
        className,
      )}
    >
      {children}
    </p>
  );
}
