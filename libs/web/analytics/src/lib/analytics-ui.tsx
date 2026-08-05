import type { BreakdownSlice, TimeSeriesPoint, TrendDelta } from '@org/types';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { RANGE_OPTIONS } from './use-analytics.js';

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1_000_000)
    return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 10_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString();
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
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

export function ViewHeader({
  title,
  description,
  icon,
  actions,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          {icon} {title}
        </h1>
        <p className="text-sm text-slate-400 mt-0.5">{description}</p>
      </div>
      {actions ? (
        <div className="flex items-center gap-2 flex-wrap">{actions}</div>
      ) : null}
    </div>
  );
}

export function ViewShell({ children }: { children: ReactNode }) {
  return (
    <div className="p-6 text-white min-h-screen bg-slate-950 flex flex-col">
      {children}
    </div>
  );
}

export function Panel({
  title,
  subtitle,
  actions,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-slate-900/60 border border-slate-800 rounded-xl p-5 ${className}`}
    >
      {(title || actions) && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            {title ? (
              <h3 className="font-bold text-sm text-slate-100">{title}</h3>
            ) : null}
            {subtitle ? (
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            ) : null}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function RangePicker({
  days,
  onChange,
}: {
  days: number;
  onChange: (days: number) => void;
}) {
  return (
    <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/60 p-0.5">
      {RANGE_OPTIONS.map((option) => (
        <button
          key={option.days}
          type="button"
          onClick={() => onChange(option.days)}
          className={`px-2.5 py-1 text-xs rounded-md transition ${
            days === option.days
              ? 'bg-slate-700 text-white font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

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
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-60 rounded-lg text-xs text-slate-300 flex items-center gap-1.5 transition"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${busy ? 'animate-spin' : ''}`} />
      {label}
    </button>
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
  emptyMessage = 'No data has been recorded for this range yet.',
  children,
}: {
  isLoading: boolean;
  error: unknown;
  isEmpty?: boolean;
  emptyMessage?: string;
  children: ReactNode;
}) {
  if (isLoading) {
    return (
      <div className="flex-1 grid place-items-center py-16 text-slate-400">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading analytics…
        </div>
      </div>
    );
  }

  if (error) {
    const message =
      error instanceof Error ? error.message : 'The request failed.';
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-950/30 p-5 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-red-300">
            Could not load analytics
          </p>
          <p className="text-xs text-red-400/80 mt-0.5">{message}</p>
        </div>
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-8 text-center">
        <p className="text-sm text-slate-400">{emptyMessage}</p>
      </div>
    );
  }

  return <>{children}</>;
}

// ---------------------------------------------------------------------------
// Data display
// ---------------------------------------------------------------------------

export function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  trend,
  hint,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  trend?: TrendDelta;
  hint?: string;
}) {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition shadow-lg">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-lg ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
        {trend ? <TrendBadge trend={trend} /> : null}
      </div>
      <p className="text-2xl font-bold text-white">
        {typeof value === 'number' ? formatNumber(value) : value}
      </p>
      <p className="text-xs text-slate-400 mt-1">{label}</p>
      {hint ? <p className="text-[11px] text-slate-500 mt-1">{hint}</p> : null}
    </div>
  );
}

export function TrendBadge({ trend }: { trend: TrendDelta }) {
  const { direction, changePct } = trend;
  const Icon =
    direction === 'up'
      ? ArrowUpRight
      : direction === 'down'
        ? ArrowDownRight
        : ArrowRight;
  const tone =
    direction === 'up'
      ? 'text-emerald-400'
      : direction === 'down'
        ? 'text-red-400'
        : 'text-slate-400';

  return (
    <span
      className={`flex items-center gap-0.5 text-[11px] font-semibold ${tone}`}
      title={`${trend.current} this period vs. ${trend.previous} previous`}
    >
      <Icon className="w-3.5 h-3.5" />
      {changePct === null ? 'new' : `${Math.abs(changePct)}%`}
    </span>
  );
}

/**
 * Bars are scaled against the series maximum rather than a fixed ceiling, so a
 * quiet workspace still gets a readable chart instead of a flat line.
 */
export function BarChart({
  series,
  color = 'from-blue-600 to-cyan-500',
  height = 160,
  valueLabel = 'events',
}: {
  series: TimeSeriesPoint[];
  color?: string;
  height?: number;
  valueLabel?: string;
}) {
  const max = Math.max(1, ...series.map((point) => point.value));
  const step = Math.max(1, Math.ceil(series.length / 8));

  return (
    <div>
      <div
        className="flex items-end gap-[3px] w-full"
        style={{ height }}
        role="img"
        aria-label={`${valueLabel} over ${series.length} periods`}
      >
        {series.map((point) => (
          <div
            key={point.date}
            className="flex-1 min-w-[3px] flex flex-col justify-end group relative"
            title={`${point.date}: ${point.value} ${valueLabel}`}
          >
            <div
              className={`w-full rounded-t bg-gradient-to-t ${color} transition-all group-hover:brightness-125`}
              style={{
                height: `${Math.max(2, (point.value / max) * 100)}%`,
              }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-slate-500">
        {series
          .filter((_, index) => index % step === 0)
          .map((point) => (
            <span key={point.date}>{point.date.slice(5)}</span>
          ))}
      </div>
    </div>
  );
}

const SLICE_COLORS = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-pink-500',
  'bg-cyan-500',
  'bg-orange-500',
  'bg-lime-500',
  'bg-rose-500',
  'bg-indigo-500',
];

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
    return <p className="text-xs text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-3">
      {slices.map((slice, index) => (
        <div key={slice.label}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  SLICE_COLORS[index % SLICE_COLORS.length]
                }`}
              />
              <span className="text-xs text-slate-300 truncate">
                {slice.label}
              </span>
            </div>
            <span className="text-xs font-semibold text-white shrink-0 ml-2">
              {formatValue(slice.value)}
              <span className="text-slate-500 font-normal ml-1.5">
                {slice.percentage}%
              </span>
            </span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                SLICE_COLORS[index % SLICE_COLORS.length]
              }`}
              style={{ width: `${Math.max(1, slice.percentage)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProgressBar({
  pct,
  color = 'from-emerald-600 to-cyan-500',
}: {
  pct: number;
  color?: string;
}) {
  return (
    <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
      <div
        className={`h-full bg-gradient-to-r ${color} rounded-full transition-all`}
        style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
      />
    </div>
  );
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
    return <p className="text-xs text-slate-500 py-4">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-slate-500 border-b border-slate-800">
            {columns.map((column) => (
              <th key={column} className="font-medium py-2 px-2 whitespace-nowrap">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/70">
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-slate-800/40 transition">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="py-2 px-2 text-slate-300 align-top"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatusPill({
  status,
}: {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
}) {
  const styles = {
    HEALTHY: 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400',
    DEGRADED: 'bg-amber-950/60 border-amber-500/40 text-amber-400',
    DOWN: 'bg-red-950/60 border-red-500/40 text-red-400',
  } as const;

  return (
    <span
      className={`px-2 py-0.5 border text-[10px] font-semibold rounded-full whitespace-nowrap ${styles[status]}`}
    >
      {status}
    </span>
  );
}
