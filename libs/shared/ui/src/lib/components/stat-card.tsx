import type { Accent } from '@org/design-system';
import { cn } from '@org/utils';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import type { ComponentProps, ElementType, ReactNode } from 'react';
import { accentClasses } from './accent.js';

/**
 * Period-over-period movement.
 *
 * Declared structurally rather than imported from `@org/types` so this
 * library stays free of domain types; the analytics `TrendDelta` satisfies it.
 */
export interface Trend {
  current: number;
  previous: number;
  changePct: number | null;
  direction: 'up' | 'down' | 'flat';
}

export interface TrendBadgeProps extends ComponentProps<'span'> {
  trend: Trend;
  /**
   * Whether a rise is good. Inverted for cost and error metrics, where "up"
   * should read as a regression rather than growth.
   */
  positiveDirection?: 'up' | 'down';
}

export function TrendBadge({
  trend,
  positiveDirection = 'up',
  className,
  ...props
}: TrendBadgeProps) {
  const { direction, changePct, current, previous } = trend;

  const Icon =
    direction === 'up'
      ? ArrowUpRight
      : direction === 'down'
        ? ArrowDownRight
        : ArrowRight;

  const isGood = direction === positiveDirection;
  const tone =
    direction === 'flat'
      ? 'text-muted-foreground'
      : isGood
        ? 'text-success'
        : 'text-destructive';

  const magnitude = changePct === null ? 'new' : `${Math.abs(changePct)}%`;
  const readable =
    direction === 'flat'
      ? `unchanged at ${current}`
      : `${direction} ${magnitude} — ${current} this period versus ${previous} previously`;

  return (
    <span
      className={cn(
        'gap-0.5 text-xs font-medium inline-flex items-center',
        tone,
        className,
      )}
      {...props}
    >
      <Icon className="size-3.5" aria-hidden />
      <span aria-hidden>{magnitude}</span>
      <span className="sr-only">{readable}</span>
    </span>
  );
}

export interface StatCardProps extends Omit<ComponentProps<'div'>, 'title'> {
  label: string;
  value: number | string;
  icon?: ElementType;
  accent?: Accent;
  trend?: Trend;
  /** Inverts trend colouring for metrics where a rise is bad. */
  positiveDirection?: 'up' | 'down';
  hint?: ReactNode;
  /** Formatter for numeric values. Strings pass through untouched. */
  format?: (value: number) => string;
}

/**
 * A single headline number.
 *
 * The value is the visual anchor; the icon is decorative and hidden from
 * assistive technology, with the label carrying the meaning.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  accent,
  trend,
  positiveDirection,
  hint,
  format,
  className,
  ...props
}: StatCardProps) {
  const display =
    typeof value === 'number'
      ? format
        ? format(value)
        : value.toLocaleString()
      : value;

  return (
    <div
      data-slot="stat-card"
      className={cn(
        'p-4 shadow-xs flex flex-col rounded-xl border bg-surface',
        'transition-colors duration-(--duration-fast) hover:border-border-strong',
        className,
      )}
      {...props}
    >
      <div className="mb-3 gap-2 flex items-center justify-between">
        {Icon ? (
          <span
            aria-hidden
            className={cn(
              'size-8 flex items-center justify-center rounded-lg',
              accent
                ? accentClasses[accent].soft
                : 'bg-muted text-muted-foreground',
            )}
          >
            <Icon className="size-4" />
          </span>
        ) : (
          <span />
        )}
        {trend ? (
          <TrendBadge trend={trend} positiveDirection={positiveDirection} />
        ) : null}
      </div>

      <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
        {display}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground/80">{hint}</p>
      ) : null}
    </div>
  );
}
