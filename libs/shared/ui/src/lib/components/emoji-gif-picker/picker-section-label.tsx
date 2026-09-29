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
        'sticky top-0 z-10 -mx-3 flex items-center gap-1.5 bg-popover/95 px-3.5 pb-1.5 pt-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground backdrop-blur',
        className,
      )}
    >
      {children}
    </p>
  );
}
