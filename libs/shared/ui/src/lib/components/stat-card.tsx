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
  | 'rose'
  | 'emerald'
  | 'amber'
  | 'cyan'
  | 'blue'
  | 'purple'
  | 'auto';

const DEFAULT_CURVES: Record<string, number[]> = {
  rose: [18, 26, 20, 36, 22, 14, 28, 12, 24, 16],
  emerald: [14, 20, 16, 28, 22, 36, 28, 44, 38, 48],
  amber: [22, 30, 24, 38, 28, 42, 32, 40, 34, 38],
  cyan: [16, 24, 18, 30, 26, 38, 32, 46, 40, 50],
  blue: [16, 22, 18, 32, 28, 40, 34, 44, 38, 46],
  purple: [20, 26, 22, 36, 30, 42, 36, 48, 40, 48],
};

const COLOR_CLASSES: Record<string, string> = {
  rose: 'stroke-rose-500',
  emerald: 'stroke-emerald-400',
  amber: 'stroke-amber-400',
  cyan: 'stroke-cyan-400',
  blue: 'stroke-blue-400',
  purple: 'stroke-purple-400',
};

const BADGE_STYLES = {
  positive:
    'border-emerald-500/25 bg-emerald-500/15 text-emerald-400 dark:text-emerald-400',
  negative:
    'border-rose-500/25 bg-rose-500/15 text-rose-400 dark:text-rose-400',
  warning:
    'border-amber-500/25 bg-amber-500/15 text-amber-400 dark:text-amber-400',
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
      : DEFAULT_CURVES[resolvedColor] ?? DEFAULT_CURVES.emerald;
  const path = generateSmoothPath(points, 100, 36);
  const strokeClass = COLOR_CLASSES[resolvedColor] ?? COLOR_CLASSES.emerald;

  return (
    <svg
      viewBox="0 0 100 36"
      className={cn('w-24 sm:w-28 h-9 overflow-visible shrink-0', className)}
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
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-tight shrink-0',
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
  const isGood = trend ? trend.direction === positiveDirection : badgeType === 'positive';
  const isBad = trend ? trend.direction !== 'flat' && !isGood : badgeType === 'negative';

  const computedBadgeType = badgeType ?? (isBad ? 'negative' : isGood ? 'positive' : 'neutral');

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
    (trend ? (trend.direction === 'up' ? 'Trending up' : trend.direction === 'down' ? 'Down' : 'Stable') : undefined);

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
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="text-sm font-semibold text-foreground tracking-tight truncate block">
            {label}
          </span>
          {displaySubtitle ? (
            <span className="mt-0.5 text-xs text-muted-foreground/80 tracking-tight block">
              {displaySubtitle}
            </span>
          ) : null}
        </div>
        {Icon ? (
          <span className="size-7 rounded-lg border border-border/60 bg-background/50 flex items-center justify-center text-muted-foreground shrink-0">
            <Icon className="size-3.5" />
          </span>
        ) : null}
      </div>

      {/* Bottom Row: Metric value + Badge/Detail on left, Sparkline on right */}
      <div className="mt-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground tabular-nums">
            {display}
          </div>

          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {trend ? (
              <TrendBadge trend={trend} positiveDirection={positiveDirection} />
            ) : badgeText ? (
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-tight shrink-0',
                  BADGE_STYLES[computedBadgeType],
                )}
              >
                {badgeText}
              </span>
            ) : null}

            {displayDetail ? (
              <span className="text-xs text-muted-foreground/80 truncate">
                {displayDetail}
              </span>
            ) : null}
          </div>
        </div>

        {/* Sparkline Wave */}
        <div className="shrink-0 pb-1">
          <StatSparkline
            data={sparklineData}
            color={resolvedColor}
          />
        </div>
      </div>
    </div>
  );
}
