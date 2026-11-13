import type { Accent } from '@org/design-system';
import { cn } from '@org/utils';
import type { ComponentProps, ElementType, ReactNode } from 'react';

/**
 * Period-over-period movement.
 */
export interface Trend {
  current: number;
  previous: number;
  changePct: number | null;
  direction: 'up' | 'down' | 'flat';
}

export interface TrendBadgeProps extends ComponentProps<'span'> {
  trend: Trend;
  positiveDirection?: 'up' | 'down';
}

export type StatSparklineColor =
  'rose' | 'emerald' | 'amber' | 'cyan' | 'blue' | 'purple' | 'auto';

const DEFAULT_CURVES: Record<string, number[]> = {
  rose: [18, 26, 20, 36, 22, 14, 28, 12, 24, 16],
  emerald: [14, 20, 16, 28, 22, 36, 28, 44, 38, 48],
  amber: [22, 30, 24, 38, 28, 42, 32, 40, 34, 38],
  cyan: [16, 24, 18, 30, 26, 38, 32, 46, 40, 50],
  blue: [16, 22, 18, 32, 28, 40, 34, 44, 38, 46],
  purple: [20, 26, 22, 36, 30, 42, 36, 48, 40, 48],
};

const COLOR_CLASSES: Record<string, string> = {
  rose: 'stroke-destructive',
  emerald: 'stroke-success',
  amber: 'stroke-warning',
  cyan: 'stroke-accent-cyan',
  blue: 'stroke-accent-blue',
  purple: 'stroke-accent-violet',
};

const BADGE_STYLES = {
  positive: 'border-success/25 bg-success/15 text-success-text',
  negative: 'border-destructive/25 bg-destructive/15 text-destructive-text',
  warning: 'border-warning/25 bg-warning/15 text-warning-text',
  neutral: 'border-border/80 bg-muted/60 text-muted-foreground',
};

function generateSmoothPath(
  points: number[],
  width = 100,
  height = 36,
): string {
  if (!points || points.length === 0) return '';
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const paddingY = 4;
  const usableHeight = height - paddingY * 2;
  const dx = width / (points.length - 1);

  const coords = points.map((p, i) => ({
    x: i * dx,
    y: height - paddingY - ((p - min) / range) * usableHeight,
  }));

  if (coords.length === 1) {
    return `M 0,${coords[0].y.toFixed(1)} L ${width},${coords[0].y.toFixed(1)}`;
  }

  let d = `M ${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const curr = coords[i];
    const next = coords[i + 1];
    const mx = (curr.x + next.x) / 2;
    d += ` C ${mx.toFixed(1)},${curr.y.toFixed(1)} ${mx.toFixed(1)},${next.y.toFixed(1)} ${next.x.toFixed(1)},${next.y.toFixed(1)}`;
  }
  return d;
}

export function StatSparkline({
  data,
  color = 'emerald',
  className,
}: {
  data?: number[];
  color?: StatSparklineColor;
  className?: string;
}) {
  const resolvedColor = color === 'auto' || !color ? 'emerald' : color;
  const points =
    data && data.length > 1
      ? data
      : (DEFAULT_CURVES[resolvedColor] ?? DEFAULT_CURVES.emerald);
  const path = generateSmoothPath(points, 100, 36);
  const strokeClass = COLOR_CLASSES[resolvedColor] ?? COLOR_CLASSES.emerald;

  return (
    <svg
      viewBox="0 0 100 36"
      className={cn('w-24 sm:w-28 h-9 shrink-0 overflow-visible', className)}
      fill="none"
      aria-hidden="true"
    >
      <path
        d={path}
        fill="none"
        className={strokeClass}
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TrendBadge({
  trend,
  positiveDirection = 'up',
  className,
  ...props
}: TrendBadgeProps) {
  const { direction, changePct } = trend;
  const isGood = direction === positiveDirection;
  const isBad = direction !== 'flat' && !isGood;

  const magnitude =
    changePct === null
      ? 'new'
      : `${direction === 'up' ? '+' : direction === 'down' ? '-' : ''}${Math.abs(changePct)}%`;

  return (
    <span
      className={cn(
        'px-2 py-0.5 font-semibold tracking-tight inline-flex shrink-0 items-center rounded-full border text-meta',
        isGood
          ? BADGE_STYLES.positive
          : isBad
            ? BADGE_STYLES.negative
            : BADGE_STYLES.neutral,
        className,
      )}
      {...props}
    >
      <span>{magnitude}</span>
    </span>
  );
}

export interface StatCardProps extends Omit<ComponentProps<'div'>, 'title'> {
  label: string;
  subtitle?: ReactNode;
  value: number | string;
  icon?: ElementType;
  accent?: Accent;
  trend?: Trend;
  badgeText?: string;
  badgeType?: 'positive' | 'negative' | 'warning' | 'neutral';
  secondaryText?: ReactNode;
  trendText?: ReactNode;
  positiveDirection?: 'up' | 'down';
  hint?: ReactNode;
  sparklineData?: number[];
  sparklineColor?: StatSparklineColor;
  /** Set false to hide the wave when there is no real series to draw. */
  showSparkline?: boolean;
  format?: (value: number) => string;
}

/**
 * Headline metric card strictly matching the reference design layout:
 * - Top Left: Label (semi-bold) stacked with Subtitle (muted small)
 * - Bottom Left: Large bold Value with Pill Badge & Contextual detail
 * - Bottom Right: Glowing SVG Sparkline wave curve
 */
export function StatCard({
  label,
  subtitle,
  value,
  icon: Icon,
  accent,
  trend,
  badgeText,
  badgeType = 'positive',
  secondaryText,
  trendText,
  positiveDirection = 'up',
  hint,
  sparklineData,
  sparklineColor,
  showSparkline = true,
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

  // Determine trend status if trend object provided
  const isGood = trend
    ? trend.direction === positiveDirection
    : badgeType === 'positive';
  const isBad = trend
    ? trend.direction !== 'flat' && !isGood
    : badgeType === 'negative';

  const computedBadgeType =
    badgeType ?? (isBad ? 'negative' : isGood ? 'positive' : 'neutral');

  // Determine sparkline color
  let resolvedColor: StatSparklineColor = sparklineColor ?? 'auto';
  if (resolvedColor === 'auto') {
    if (accent === 'rose') resolvedColor = 'rose';
    else if (accent === 'amber') resolvedColor = 'amber';
    else if (accent === 'cyan' || accent === 'teal') resolvedColor = 'cyan';
    else if (accent === 'blue' || accent === 'indigo') resolvedColor = 'blue';
    else if (accent === 'violet') resolvedColor = 'purple';
    else if (isBad) resolvedColor = 'rose';
    else if (computedBadgeType === 'warning') resolvedColor = 'amber';
    else resolvedColor = 'emerald';
  }

  // Resolve detail text
  const displaySubtitle = subtitle;
  const displayDetail =
    secondaryText ??
    hint ??
    trendText ??
    (trend
      ? trend.direction === 'up'
        ? 'Trending up'
        : trend.direction === 'down'
          ? 'Down'
          : 'Stable'
      : undefined);

  return (
    <div
      data-slot="stat-card"
      className={cn(
        'p-5 sm:p-6 shadow-2xs flex flex-col justify-between rounded-2xl border border-border/60 bg-card text-card-foreground',
        'transition-all duration-(--duration-fast) hover:border-border/90',
        className,
      )}
      {...props}
    >
      {/* Top Header: Label + Subtitle on left, optional icon on right */}
      <div className="gap-2 flex items-start justify-between">
        <div className="min-w-0">
          <span className="text-sm font-semibold tracking-tight leading-snug block text-foreground">
            {label}
          </span>
          {displaySubtitle ? (
            <span className="mt-0.5 text-xs tracking-tight block text-muted-foreground/80">
              {displaySubtitle}
            </span>
          ) : null}
        </div>
        {Icon ? (
          <span className="size-7 flex shrink-0 items-center justify-center rounded-lg border border-border/60 bg-background/50 text-muted-foreground">
            <Icon className="size-3.5" />
          </span>
        ) : null}
      </div>

      {/* Bottom Row: Metric value + Badge/Detail on left, Sparkline on right */}
      <div className="mt-5 gap-3 flex items-end justify-between">
        <div className="min-w-0">
          <div className="text-2xl sm:text-stat font-bold tracking-tight text-foreground tabular-nums">
            {display}
          </div>

          <div className="mt-2 gap-2 flex flex-wrap items-center">
            {trend ? (
              <TrendBadge trend={trend} positiveDirection={positiveDirection} />
            ) : badgeText ? (
              <span
                className={cn(
                  'px-2 py-0.5 font-semibold tracking-tight inline-flex shrink-0 items-center rounded-full border text-meta',
                  BADGE_STYLES[computedBadgeType],
                )}
              >
                {badgeText}
              </span>
            ) : null}

            {displayDetail ? (
              <span className="text-xs truncate text-muted-foreground/80">
                {displayDetail}
              </span>
            ) : null}
          </div>
        </div>

        {/* Sparkline Wave */}
        {showSparkline ? (
          <div className="pb-1 shrink-0">
            <StatSparkline data={sparklineData} color={resolvedColor} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
