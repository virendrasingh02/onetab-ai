import { cn } from '@org/utils';
import type { ComponentProps, ReactNode } from 'react';

export interface PageBarProps extends Omit<ComponentProps<'div'>, 'title'> {
  /** Leading glyph — usually a Lucide icon, rendered muted at 16px. */
  icon?: ReactNode;
  title: ReactNode;
  /** Badges, counts or status chips shown right after the title. */
  meta?: ReactNode;
  /** Right-aligned controls: search, primary action, overflow menu. */
  actions?: ReactNode;
  /**
   * A `PageTabBar` follows directly below. The bar then drops its own bottom
   * rule (the tab bar closes the block) and sits a little lower so title and
   * tabs read as one header.
   */
  hasTabs?: boolean;
  /** Heading element for the title. One `h1` per route is the default. */
  headingAs?: 'h1' | 'h2';
}

/**
 * The compact title row every sidebar destination opens with — the same bar
 * channels and DMs use: 44px, muted icon, 16px semibold title, inline meta,
 * actions on the right. Pair it with `PageTabBar` when the page has sections.
 */
export function PageBar({
  icon,
  title,
  meta,
  actions,
  hasTabs = false,
  headingAs: Heading = 'h1',
  className,
  children,
  ...props
}: PageBarProps) {
  return (
    <div
      data-slot="page-bar"
      className={cn(
        'top-0 backdrop-blur-md sticky z-20 shrink-0 bg-background/95',
        !hasTabs && 'border-b border-border',
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          'gap-2.5 px-3 sm:px-6 min-h-11 flex flex-wrap items-center justify-between',
          hasTabs ? 'pt-2 pb-1' : 'py-1.5',
        )}
      >
        <div className="min-w-0 gap-1.5 flex items-center">
          {icon ? (
            <span
              aria-hidden
              className="[&>svg]:size-4 flex shrink-0 items-center text-muted-foreground"
            >
              {icon}
            </span>
          ) : null}
          <Heading className="text-base font-semibold tracking-tight truncate text-foreground">
            {title}
          </Heading>
          {meta ? (
            <div className="ml-1 gap-1.5 min-w-0 flex items-center">{meta}</div>
          ) : null}
        </div>

        {actions ? (
          <div className="gap-2 flex flex-wrap items-center">{actions}</div>
        ) : null}
      </div>
      {children}
    </div>
  );
}
