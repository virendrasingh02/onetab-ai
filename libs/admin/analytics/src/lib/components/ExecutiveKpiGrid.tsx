import type { ExecutiveKpi } from '@org/types';
import { Card, Skeleton } from '@org/ui';
import { cn } from '@org/utils';
import { Link } from 'react-router-dom';
import { MetricSparkline } from './AdminMetricCard.js';

export interface ExecutiveKpiGridProps {
  kpis?: ExecutiveKpi[] | Record<string, ExecutiveKpi>;
  isLoading?: boolean;
  className?: string;
}

export function formatKpiValue(
  value: number | string,
  format?: ExecutiveKpi['format'],
): string {
  if (typeof value === 'string') return value;
  switch (format) {
    case 'currency':
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(value);
    case 'percent':
      return `${value >= 0 ? '' : '-'}${Math.abs(value).toFixed(1)}%`;
    case 'duration':
      return `${Math.round(value)} ms`;
    case 'bytes': {
      if (value === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(value) / Math.log(k));
      return `${parseFloat((value / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
    }
    case 'number':
    default:
      return value.toLocaleString();
  }
}

const BADGE_STYLES = {
  positive:
    'border-emerald-500/25 bg-emerald-500/15 text-emerald-400 dark:text-emerald-400',
  negative:
    'border-rose-500/25 bg-rose-500/15 text-rose-400 dark:text-rose-400',
  neutral: 'border-border/80 bg-muted/60 text-muted-foreground',
};

export function ExecutiveKpiGrid({
  kpis,
  isLoading = false,
  className,
}: ExecutiveKpiGridProps) {
  const kpiList = kpis
    ? Array.isArray(kpis)
      ? kpis
      : Object.values(kpis)
    : [];

  if (isLoading || kpiList.length === 0) {
    return (
      <div
        className={cn(
          'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',
          className,
        )}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Card
            key={i}
            className="p-5 sm:p-6 space-y-4 rounded-2xl border border-border/60 bg-card shadow-2xs"
          >
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
            <div className="flex items-end justify-between pt-2">
              <div className="space-y-2">
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-4 w-32 rounded-full" />
              </div>
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4',
        className,
      )}
    >
      {kpiList.map((kpi, idx) => {
        const change = kpi.changePct ?? 0;
        const isPositiveChange = change > 0;

        const isTrendGood =
          kpi.direction === 'up'
            ? true
            : kpi.direction === 'down'
            ? false
            : true;

        const badgeType =
          change === 0
            ? 'neutral'
            : isTrendGood
            ? 'positive'
            : 'negative';

        const sparklineColor =
          badgeType === 'positive'
            ? 'emerald'
            : badgeType === 'negative'
            ? 'rose'
            : 'cyan';

        const cardBody = (
          <Card
            className={cn(
              'p-5 sm:p-6 rounded-2xl border border-border/60 bg-card text-card-foreground shadow-2xs flex flex-col justify-between',
              'transition-all duration-(--duration-fast) hover:border-border/90 group',
              kpi.drillDownPath ? 'cursor-pointer hover:shadow-xs' : '',
            )}
          >
            {/* Top row: Label stacked with subtitle */}
            <div>
              <div className="text-sm font-semibold text-foreground tracking-tight truncate">
                {kpi.label}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground/80 tracking-tight truncate">
                {kpi.tooltip || 'Platform benchmark'}
              </div>
            </div>

            {/* Bottom row: Value + Badge/Detail on left, Sparkline on right */}
            <div className="mt-5 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <div className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground tabular-nums">
                  {formatKpiValue(kpi.value, kpi.format)}
                </div>

                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-tight shrink-0',
                      BADGE_STYLES[badgeType],
                    )}
                  >
                    {change !== 0
                      ? `${isPositiveChange ? '+' : ''}${change}%`
                      : '0%'}
                  </span>

                  <span className="text-xs text-muted-foreground/80 truncate">
                    {change !== 0
                      ? isTrendGood
                        ? 'Trending up'
                        : 'Down this period'
                      : 'Stable pace'}
                  </span>
                </div>
              </div>

              {/* Sparkline wave */}
              <div className="shrink-0 pb-1">
                <MetricSparkline color={sparklineColor} />
              </div>
            </div>
          </Card>
        );

        return kpi.drillDownPath ? (
          <Link
            key={kpi.label + idx}
            to={kpi.drillDownPath}
            className="block no-underline"
          >
            {cardBody}
          </Link>
        ) : (
          <div key={kpi.label + idx}>{cardBody}</div>
        );
      })}
    </div>
  );
}
