import { accentTokens, type Accent } from '@org/design-system';
import { parseIsoDay } from '@org/utils';
import { format } from 'date-fns';

/**
 * Series colours, in the order a multi-series chart consumes them.
 *
 * Every value is a `var(--accent-*)` reference from the design system, so a
 * chart follows light/dark mode and the workspace accent without a single hex
 * literal living in a chart component. Adjacent entries are far apart in hue.
 */
export const CHART_SERIES_ACCENTS: readonly Accent[] = [
  'blue',
  'green',
  'violet',
  'amber',
  'pink',
  'cyan',
  'indigo',
  'orange',
  'teal',
  'rose',
];

/**
 * Resolves a series colour. An explicit override may be an `Accent` name or
 * any CSS colour (`var(--destructive)`); otherwise the series takes the next
 * palette slot.
 */
export function seriesColor(index: number, override?: Accent | string): string {
  if (override) {
    return override in accentTokens
      ? accentTokens[override as Accent]
      : override;
  }
  return accentTokens[CHART_SERIES_ACCENTS[index % CHART_SERIES_ACCENTS.length]];
}

/** Axis styling shared by every cartesian chart. */
export const CHART_AXIS_PROPS = {
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
  tick: { fontSize: 11, fill: 'var(--muted-foreground)' },
} as const;

export const CHART_GRID_PROPS = {
  strokeDasharray: '3 3',
  vertical: false,
  stroke: 'var(--border)',
} as const;

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Compact counts for axes and KPI cards: `1.2k`, `3.4M`. */
export function formatCompactNumber(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString();
}

/** `value` is already a percentage (`42.5` → `42.5%`). */
export function formatPercent(value: number, fractionDigits = 1): string {
  if (!Number.isFinite(value)) return '—';
  return `${Number(value.toFixed(fractionDigits))}%`;
}

export function formatCurrency(
  value: number,
  currency = 'USD',
  { compact = false }: { compact?: boolean } = {},
): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    notation: compact ? 'compact' : 'standard',
    maximumFractionDigits: compact ? 1 : 2,
  }).format(value);
}

/**
 * X-axis label for a daily bucket. `YYYY-MM-DD` keys (what every analytics
 * endpoint emits) become `Sep 1`; anything else passes through untouched.
 */
export function formatAxisDate(value: unknown): string {
  const text = String(value ?? '');
  const day = parseIsoDay(text);
  return day ? format(day, 'MMM d') : text;
}

/** Tooltip heading for a daily bucket: `Tue, Sep 1, 2026`. */
export function formatTooltipDate(value: unknown): string {
  const text = String(value ?? '');
  const day = parseIsoDay(text);
  return day ? format(day, 'EEE, MMM d, yyyy') : text;
}
