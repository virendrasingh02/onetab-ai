import type { Accent } from '@org/design-system';
import { cn } from '@org/utils';
import type { ComponentProps } from 'react';
import { accentClasses } from './accent.js';

export interface ProgressProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** 0–100. Values outside the range are clamped. */
  value: number;
  /** Categorical tint. Defaults to the primary brand colour. */
  accent?: Accent;
  size?: 'sm' | 'md' | 'lg';
  /** Announced to screen readers in place of the raw percentage. */
  label?: string;
  /** Renders indeterminate when the total is not yet known. */
  indeterminate?: boolean;
}

const sizeClasses = {
  sm: 'h-1',
  md: 'h-1.5',
  lg: 'h-2.5',
} as const;

/**
 * A determinate progress/meter bar.
 *
 * Exposed as `role="progressbar"` with the real numeric value so assistive
 * technology reports completion — the hand-rolled bars this replaces were
 * purely visual divs.
 */
export function Progress({
  value,
  accent,
  size = 'md',
  label,
  indeterminate = false,
  className,
  ...props
}: ProgressProps) {
  const clamped = Math.min(
    100,
    Math.max(0, Number.isFinite(value) ? value : 0),
  );

  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={indeterminate ? undefined : Math.round(clamped)}
      aria-label={label}
      className={cn(
        'w-full overflow-hidden rounded-full bg-surface-inset',
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width] duration-(--duration-slow) ease-standard',
          accent ? accentClasses[accent].bg : 'bg-primary',
          indeterminate && 'animate-pulse',
        )}
        style={{ width: indeterminate ? '100%' : `${clamped}%` }}
      />
    </div>
  );
}
