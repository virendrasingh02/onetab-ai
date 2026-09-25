import { ACCENTS, type Accent } from '@org/design-system';
import type { BreakdownSlice, TrendDelta } from '@org/types';
import {
  accentClasses,
  Badge,
  Button,
  ErrorState,
  LoadingState,
  Page,
  PageHeader,
  Panel,
  Progress,
  StatCard,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TrendBadge,
} from '@org/ui';
import { cn } from '@org/utils';
import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatCompactNumber } from './charts/chart-theme.js';

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Compact counts (`12.3k`, `4.5M`). Same function the charts use for their
 * axes, so a KPI card and the chart under it never disagree on a number.
 */
export const formatNumber = formatCompactNumber;

/** Re-exported from `@org/utils` — there is exactly one byte formatter. */
export { formatBytes } from '@org/utils';

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600)
    return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  if (seconds < 86400)
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
}

export function formatRelative(iso: string | null): string {
  if (!iso) return 'never';
  const delta = Date.now() - new Date(iso).getTime();
  if (delta < 60_000) return 'just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

// ---------------------------------------------------------------------------
// Layout primitives
// ---------------------------------------------------------------------------

/**
 * The analytics screens' header.
 *
 * A thin adapter over `PageHeader` — kept so the twelve call sites keep their
 * `icon`/`description` prop names, but the layout, typography and heading
 * level now come from the shared component rather than being redefined here.
 */
export function ViewHeader({
  title,
  description,
  icon,
  accent = 'blue',
  actions,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  accent?: Accent;
  actions?: ReactNode;
}) {
  return (
    <PageHeader
      title={title}
      description={description}
      icon={icon}
      accent={accent}
      actions={actions}
    />
  );
}

export function ViewShell({ children }: { children: ReactNode }) {
  return <Page width="full">{children}</Page>;
}

/** Re-exported so analytics screens keep importing `Panel` from one place. */
export { Panel };

export function RefreshButton({
  onClick,
  busy,
  label = 'Refresh',
}: {
  onClick: () => void;
  busy?: boolean;
  label?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={busy}
      leadingIcon={<RefreshCw className={cn(busy && 'animate-spin')} />}
    >
      {label}
    </Button>
  );
}

/**
 * Pause/resume switch for the auto-refreshing operations screens.
 *
 * A toggle button rather than two states of a plain button, so `aria-pressed`
 * tells assistive technology whether polling is currently on.
 */
export function LiveToggle({
  live,
  onToggle,
  intervalLabel = '15s',
}: {
  live: boolean;
  onToggle: () => void;
  intervalLabel?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={live}
      onClick={onToggle}
      className={cn(live && 'border-success/40 text-success')}
    >
      <span
        aria-hidden
        className={cn(
          'size-1.5 rounded-full',
          live ? 'animate-pulse bg-success' : 'bg-muted-foreground',
        )}
      />
      {live ? `Live · ${intervalLabel}` : 'Paused'}
    </Button>
  );
}

/**
 * One place that decides what a screen shows while loading and after a failure,
 * so no view silently renders zeros when the request never succeeded.
 */
export function QueryState({
  isLoading,
  error,
  isEmpty,
  emptyMessage = 'No analytics data for this period.',
  emptyAction,
  onRetry,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  isEmpty?: boolean;
  emptyMessage?: string;
  /** e.g. a "Change date range" button under the empty message. */
  emptyAction?: ReactNode;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (isLoading) {
    return <LoadingState className="py-16 flex-1" label="Loading analytics…" />;
  }

  if (error) {
    return (
      <ErrorState
        title="Could not load analytics"
        description={
          error instanceof Error
            ? error.message
            : 'The request failed. Please try again.'
        }
        detail={error instanceof Error ? error.stack : undefined}
        onRetry={onRetry}
      />
    );
  }

  if (isEmpty) {
    return (
      <div
        role="status"
        className="gap-3 p-8 flex flex-col items-center rounded-xl border bg-surface-muted text-center"
      >
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        {emptyAction}
      </div>
    );
  }

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Data display
// ---------------------------------------------------------------------------

/**
 * Adapter over the shared `StatCard`, keeping the `accent` prop the analytics
 * screens already pass and routing numeric values through `formatNumber`.
 */
export function MetricCard({
  label,
  value,
  icon: Icon,
  accent,
  trend,
  hint,
  positiveDirection,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  accent?: Accent;
  trend?: TrendDelta;
  hint?: string;
  positiveDirection?: 'up' | 'down';
}) {
  return (
    <StatCard
      label={label}
      value={value}
      icon={Icon}
      accent={accent}
      trend={trend}
      positiveDirection={positiveDirection}
      hint={hint}
      format={formatNumber}
    />
  );
}

export { TrendBadge };

export function Breakdown({
  slices,
  formatValue = formatNumber,
  emptyMessage = 'Nothing recorded yet.',
}: {
  slices: BreakdownSlice[];
  formatValue?: (value: number) => string;
  emptyMessage?: string;
}) {
  if (slices.length === 0) {
    return <p className="text-xs text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-3">
      {slices.map((slice, index) => {
        const accent = ACCENTS[index % ACCENTS.length];
        return (
          <li key={slice.label}>
            <div className="mb-1 gap-2 flex items-center justify-between">
              <div className="min-w-0 gap-2 flex items-center">
                <span
                  aria-hidden
                  className={cn(
                    'size-2.5 shrink-0 rounded-full',
                    accentClasses[accent].bg,
                  )}
                />
                <span className="text-xs truncate text-foreground">
                  {slice.label}
                </span>
              </div>
              <span className="text-xs font-medium shrink-0 tabular-nums">
                {formatValue(slice.value)}
                <span className="ml-1.5 font-normal text-muted-foreground">
                  {slice.percentage}%
                </span>
              </span>
            </div>
            <Progress
              value={slice.percentage}
              accent={accent}
              size="sm"
              label={`${slice.label}: ${slice.percentage}%`}
            />
          </li>
        );
      })}
    </ul>
  );
}

export function ProgressBar({
  pct,
  accent = 'green',
  label,
}: {
  pct: number;
  accent?: Accent;
  label?: string;
}) {
  return <Progress value={pct} accent={accent} size="lg" label={label} />;
}

export function DataTable({
  columns,
  rows,
  emptyMessage = 'No rows.',
}: {
  columns: string[];
  rows: ReactNode[][];
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <p className="py-4 text-xs text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <Table className="text-xs">
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {columns.map((column) => (
            <TableHead key={column}>{column}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row, rowIndex) => (
          <TableRow key={rowIndex}>
            {row.map((cell, cellIndex) => (
              <TableCell
                key={cellIndex}
                className="align-top text-muted-foreground"
              >
                {cell}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function StatusPill({
  status,
}: {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
}) {
  const variant = {
    HEALTHY: 'success',
    DEGRADED: 'warning',
    DOWN: 'destructive',
  } as const;

  return (
    <Badge variant={variant[status]} className="rounded-full">
      {status}
    </Badge>
  );
}
