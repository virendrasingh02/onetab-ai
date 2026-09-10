import type { ExecutiveKpi } from '@org/types';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Hint,
  Skeleton,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  ArrowDownRight,
  ArrowUpRight,
  HelpCircle,
  Minus,
} from 'lucide-react';
import { Link } from 'react-router-dom';

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
          'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4',
          className,
        )}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="p-4 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-3 w-16" />
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4',
        className,
      )}
    >
      {kpiList.map((kpi, idx) => {
        const change = kpi.changePct ?? 0;
        const isPositiveChange = change > 0;

        // Interpret direction
        const isTrendGood =
          kpi.direction === 'up'
            ? true
            : kpi.direction === 'down'
            ? false
            : true;

        const cardBody = (
          <Card
            className={cn(
              'transition-all hover:border-primary/40 relative overflow-hidden',
              kpi.drillDownPath ? 'cursor-pointer hover:shadow-xs' : '',
            )}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-3 px-3.5">
              <CardTitle className="text-xs font-medium text-muted-foreground truncate">
                {kpi.label}
              </CardTitle>
              {kpi.tooltip && (
                <Hint label={kpi.tooltip}>
                  <HelpCircle className="size-3 text-muted-foreground/60 hover:text-muted-foreground cursor-help" />
                </Hint>
              )}
            </CardHeader>
            <CardContent className="px-3.5 pb-3 pt-0">
              <div className="text-lg sm:text-xl font-bold tracking-tight">
                {formatKpiValue(kpi.value, kpi.format)}
              </div>
              <div className="flex items-center gap-1 mt-1 text-[11px]">
                {change !== 0 ? (
                  <span
                    className={cn(
                      'flex items-center font-semibold',
                      isTrendGood ? 'text-success' : 'text-destructive',
                    )}
                  >
                    {isPositiveChange ? (
                      <ArrowUpRight className="size-3.5 shrink-0" />
                    ) : (
                      <ArrowDownRight className="size-3.5 shrink-0" />
                    )}
                    {Math.abs(change)}%
                  </span>
                ) : (
                  <span className="flex items-center text-muted-foreground">
                    <Minus className="size-3 shrink-0" />
                    0%
                  </span>
                )}
                <span className="text-muted-foreground truncate">
                  vs prev period
                </span>
              </div>
            </CardContent>
          </Card>
        );

        return kpi.drillDownPath ? (
          <Link key={kpi.label + idx} to={kpi.drillDownPath} className="block no-underline">
            {cardBody}
          </Link>
        ) : (
          <div key={kpi.label + idx}>{cardBody}</div>
        );
      })}
    </div>
  );
}
