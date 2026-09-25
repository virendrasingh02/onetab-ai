import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
} from '@org/ui';
import { cn } from '@org/utils';
import { AlertCircle, BarChart3, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

/** The fields of a Recharts tooltip/legend entry this module reads. */
export interface ChartPayloadEntry {
  name?: string | number;
  value?: unknown;
  color?: string;
  dataKey?: unknown;
}

export interface ChartTooltipContentProps {
  active?: boolean;
  payload?: ReadonlyArray<ChartPayloadEntry>;
  label?: unknown;
  valueFormatter?: (value: number) => string;
  labelFormatter?: (label: unknown) => string;
  /** When set, each row also shows its share of this total. */
  total?: number;
}

/**
 * Tooltip body drawn with the popover tokens, replacing Recharts' default
 * white box (which ignores dark mode). Passed to `<Tooltip content={…}>`.
 */
export function ChartTooltipContent({
  active,
  payload,
  label,
  valueFormatter = (v) => v.toLocaleString(),
  labelFormatter = (l) => String(l ?? ''),
  total,
}: ChartTooltipContentProps) {
  if (!active || !payload?.length) return null;
  const heading = labelFormatter(label);

  return (
    <div className="min-w-36 gap-1.5 px-2.5 py-2 text-xs flex flex-col rounded-popup border border-border bg-popover text-popover-foreground shadow-overlay">
      {heading ? (
        <div className="font-semibold text-foreground">{heading}</div>
      ) : null}
      {payload.map((entry, index) => {
        const numeric = typeof entry.value === 'number' ? entry.value : null;
        return (
          <div
            key={`${String(entry.dataKey ?? entry.name)}-${index}`}
            className="gap-3 flex items-center justify-between"
          >
            <span className="min-w-0 gap-1.5 flex items-center text-muted-foreground">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="truncate">{entry.name}</span>
            </span>
            <span className="font-medium tabular-nums text-foreground">
              {numeric === null ? String(entry.value ?? '—') : valueFormatter(numeric)}
              {numeric !== null && total ? (
                <span className="ml-1 font-normal text-muted-foreground">
                  {((numeric / total) * 100).toFixed(1)}%
                </span>
              ) : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

export interface ChartLegendContentProps {
  payload?: ReadonlyArray<{ value?: unknown; color?: string }>;
  className?: string;
}

export function ChartLegendContent({ payload, className }: ChartLegendContentProps) {
  if (!payload?.length) return null;
  return (
    <ul
      className={cn(
        'gap-x-4 gap-y-1 pt-2 text-[11px] flex flex-wrap items-center justify-center text-muted-foreground',
        className,
      )}
    >
      {payload.map((entry, index) => (
        <li key={`${String(entry.value)}-${index}`} className="gap-1.5 flex items-center">
          <span
            aria-hidden
            className="size-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          {String(entry.value ?? '')}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// States
// ---------------------------------------------------------------------------

export interface ChartEmptyStateProps {
  message?: string;
  /** e.g. a "Change date range" button. */
  action?: ReactNode;
  height?: number | string;
  className?: string;
}

export function ChartEmptyState({
  message = 'No analytics data for this period.',
  action,
  height = 240,
  className,
}: ChartEmptyStateProps) {
  return (
    <div
      role="status"
      style={{ height }}
      className={cn(
        'gap-2 p-6 flex w-full flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface-muted text-center',
        className,
      )}
    >
      <BarChart3 aria-hidden className="size-7 text-subtle" />
      <p className="text-xs text-muted-foreground">{message}</p>
      {action}
    </div>
  );
}

function ChartSkeleton({ height }: { height: number | string }) {
  return (
    <div
      role="status"
      aria-label="Loading chart"
      style={{ height }}
      className="gap-2 px-2 pt-6 flex w-full items-end"
    >
      {[40, 75, 55, 90, 65, 80, 50].map((pct, i) => (
        <Skeleton key={i} className="flex-1" style={{ height: `${pct}%` }} />
      ))}
    </div>
  );
}

function ChartError({
  height,
  message,
  onRetry,
}: {
  height: number | string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      style={{ height }}
      className="gap-3 p-6 flex w-full flex-col items-center justify-center rounded-lg border border-destructive/20 bg-destructive/5 text-center"
    >
      <AlertCircle aria-hidden className="size-7 text-destructive" />
      <p className="text-sm font-medium text-destructive">{message}</p>
      {onRetry ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRetry}
          leadingIcon={<RefreshCw />}
        >
          Retry
        </Button>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Container
// ---------------------------------------------------------------------------

export interface ChartContainerProps {
  title?: string;
  description?: string;
  action?: ReactNode;
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  /** Shown under the empty message, e.g. a "Change date range" button. */
  emptyAction?: ReactNode;
  errorMessage?: string;
  onRetry?: () => void;
  height?: number | string;
  /** Drop the card chrome when the chart already sits inside a `Panel`. */
  bare?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Loading / error / empty / content switch for one chart, with optional card
 * chrome. Every chart on every analytics screen goes through this, so none of
 * them renders a blank box or a flat line when its request never succeeded.
 */
export function ChartContainer({
  title,
  description,
  action,
  isLoading = false,
  isError = false,
  isEmpty = false,
  emptyMessage,
  emptyAction,
  errorMessage = 'Failed to load chart data.',
  onRetry,
  height = 300,
  bare = false,
  className,
  children,
}: ChartContainerProps) {
  const body = isLoading ? (
    <ChartSkeleton height={height} />
  ) : isError ? (
    <ChartError height={height} message={errorMessage} onRetry={onRetry} />
  ) : isEmpty ? (
    <ChartEmptyState message={emptyMessage} action={emptyAction} height={height} />
  ) : (
    <div style={{ height, minHeight: height }} className="w-full">
      {children}
    </div>
  );

  if (bare) return <div className={cn('w-full', className)}>{body}</div>;

  return (
    <Card className={cn('flex flex-col', className)}>
      {title || description || action ? (
        <CardHeader className="space-y-0 pb-3 flex flex-row items-start justify-between">
          <div className="space-y-1">
            {title ? <CardTitle className="text-sm font-semibold">{title}</CardTitle> : null}
            {description ? (
              <CardDescription className="text-xs">{description}</CardDescription>
            ) : null}
          </div>
          {action ? <div className="ml-2 shrink-0">{action}</div> : null}
        </CardHeader>
      ) : null}
      <CardContent className="pb-4 flex-1">{body}</CardContent>
    </Card>
  );
}
