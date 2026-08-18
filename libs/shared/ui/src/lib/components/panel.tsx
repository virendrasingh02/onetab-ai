import { cn } from '@org/utils';
import type { ComponentProps, ReactNode } from 'react';

export interface PanelProps extends Omit<ComponentProps<'section'>, 'title'> {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Drop the body padding when the panel holds a flush table or list. */
  flush?: boolean;
  footer?: ReactNode;
}

/**
 * A titled surface for one unit of content — a chart, a table, a breakdown.
 *
 * Distinct from `Card`: `Card` is the bare surface primitive, `Panel` is the
 * titled composition of it that dashboard screens repeat. Its heading is an
 * `<h3>`, so it nests correctly under `PageSection`'s `<h2>`.
 */
export function Panel({
  title,
  subtitle,
  actions,
  footer,
  flush = false,
  className,
  children,
  ...props
}: PanelProps) {
  return (
    <section
      data-slot="panel"
      className={cn(
        // `rounded-card` like `Card`: a panel and a card are the same box at
        // different scales, and they sat a corner-step apart.
        'shadow-xs flex flex-col rounded-card border border-border bg-surface text-card-foreground',
        className,
      )}
      {...props}
    >
      {title || actions ? (
        <div className="gap-3 px-5 pt-4 pb-3 flex items-start justify-between">
          <div className="min-w-0">
            {title ? (
              <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            ) : null}
            {subtitle ? (
              <p className="mt-0.5 text-xs text-pretty text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
          </div>
          {actions ? (
            <div className="gap-2 flex shrink-0 items-center">{actions}</div>
          ) : null}
        </div>
      ) : null}

      <div
        className={cn(
          'min-w-0 flex-1',
          flush ? '' : 'px-5 pb-5',
          !title && 'pt-5',
        )}
      >
        {children}
      </div>

      {footer ? (
        <div className="px-5 py-3 text-xs border-t text-muted-foreground">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
