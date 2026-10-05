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
 * Styled consistently across the platform with rounded-xl border and card tokens.
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
        'shadow-2xs flex flex-col rounded-2xl border border-border/60 bg-card text-card-foreground',
        'transition-all duration-(--duration-fast) hover:border-border/90',
        className,
      )}
      {...props}
    >
      {title || actions ? (
        <div className="gap-3 px-5 pt-4 pb-3 flex items-start justify-between border-b border-border/40">
          <div className="min-w-0">
            {title ? (
              <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
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
        <div className="px-5 py-3 text-xs border-t border-border/40 text-muted-foreground bg-muted/20 rounded-b-2xl">
          {footer}
        </div>
      ) : null}
    </section>
  );
}
