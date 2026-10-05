import { Card, Skeleton } from '@org/ui';
import { cn } from '@org/utils';
import type { ReactNode } from 'react';

export type SparklineColor =
  | 'rose'
  | 'emerald'
  | 'amber'
  | 'cyan'
  | 'blue'
  | 'purple'
  | 'auto';

export interface AdminMetricCardProps {
  label: string;
  subtitle?: string | ReactNode;
  value: string | number;
  badgeText?: string;
  badgeType?: 'positive' | 'negative' | 'warning' | 'neutral';
  secondaryText?: string | ReactNode;
  /** Fallbacks for backwards compatibility */
  trendText?: string | ReactNode;
  trendType?: 'up' | 'down';
  subtext?: string | ReactNode;
  sparklineData?: number[];
  sparklineColor?: SparklineColor;
  isLoading?: boolean;
  className?: string;
}

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

/**
 * Generate a smooth cubic bezier SVG path from numeric values.
 */
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

export function MetricSparkline({
  data,
  color = 'emerald',
  className,
}: {
  data?: number[];
  color?: SparklineColor;
  className?: string;
}) {
  const resolvedColor =
    color === 'auto' || !color ? 'emerald' : color;
  const points =
    data && data.length > 1
      ? data
      : DEFAULT_CURVES[resolvedColor] ?? DEFAULT_CURVES.emerald;
  const path = generateSmoothPath(points, 100, 36);
  const strokeClass =
    COLOR_CLASSES[resolvedColor] ?? COLOR_CLASSES.emerald;

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

/**
 * High-fidelity Metric KPI Card strictly matching the reference dashboard design.
 *
 * Anatomy:
 * - Top Left: Label (semi-bold) stacked with Subtitle (muted small)
 * - Bottom Left: Large bold Value with Pill Badge & Contextual detail underneath
 * - Bottom Right: Glowing SVG Sparkline wave curve
 */
export function AdminMetricCard({
  label,
  subtitle,
  value,
  badgeText,
  badgeType = 'positive',
  secondaryText,
  trendText,
  trendType,
  subtext,
  sparklineData,
  sparklineColor,
  isLoading = false,
  className,
}: AdminMetricCardProps) {
  if (isLoading) {
    return (
      <Card
        className={cn(
          'rounded-2xl border border-border/60 bg-card p-5 sm:p-6 space-y-4 shadow-2xs',
          className,
        )}
      >
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
        <div className="flex items-end justify-between pt-2">
          <div className="space-y-2">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-4 w-36 rounded-full" />
          </div>
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </Card>
    );
  }

  // Resolve badge variant
  const computedBadgeType = badgeType ?? (trendType === 'down' ? 'negative' : 'positive');

  // Resolve sparkline color
  let resolvedColor: SparklineColor = sparklineColor ?? 'auto';
  if (resolvedColor === 'auto') {
    if (computedBadgeType === 'negative') resolvedColor = 'rose';
    else if (computedBadgeType === 'warning') resolvedColor = 'amber';
    else resolvedColor = 'emerald';
  }

  // Backwards compatibility mappings
  const displaySubtitle = subtitle ?? (secondaryText ? subtext : undefined);
  const displayDetail = secondaryText ?? (subtitle ? (subtext || trendText) : (trendText || subtext));

  return (
    <Card
      className={cn(
        'rounded-2xl border border-border/60 bg-card p-5 sm:p-6 shadow-2xs hover:border-border/90 transition-all flex flex-col justify-between group',
        className,
      )}
    >
      {/* Top Header: Title and Subtitle stacked */}
      <div>
        <div className="text-sm font-semibold text-foreground tracking-tight">
          {label}
        </div>
        {displaySubtitle ? (
          <div className="mt-0.5 text-xs text-muted-foreground/80 tracking-tight">
            {displaySubtitle}
          </div>
        ) : null}
      </div>

      {/* Bottom Row: Metric value + Badge/Detail on left, Sparkline on right */}
      <div className="mt-5 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground tabular-nums">
            {value}
          </div>

          <div className="mt-2 flex items-center gap-2 flex-wrap">
            {badgeText ? (
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
          <MetricSparkline
            data={sparklineData}
            color={resolvedColor}
          />
        </div>
      </div>
    </Card>
  );
}
