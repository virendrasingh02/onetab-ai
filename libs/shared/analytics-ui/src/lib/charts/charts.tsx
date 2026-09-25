import type { Accent } from '@org/design-system';
import type { TimeSeriesPoint } from '@org/types';
import { useId, type ReactElement } from 'react';
import {
  Area,
  AreaChart as RechartsAreaChart,
  Bar,
  BarChart as RechartsBarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartLegendContent,
  ChartTooltipContent,
  type ChartPayloadEntry,
} from './chart-chrome.js';
import {
  CHART_AXIS_PROPS,
  CHART_GRID_PROPS,
  formatAxisDate,
  formatCompactNumber,
  formatTooltipDate,
  seriesColor,
} from './chart-theme.js';

/** One plotted series of a cartesian chart. */
export interface ChartSeries {
  dataKey: string;
  name?: string;
  /** An `Accent` name or any CSS colour; defaults to the next palette slot. */
  color?: Accent | string;
  /** Bars/areas sharing a `stackId` stack on top of each other. */
  stackId?: string;
  strokeDasharray?: string;
  fillOpacity?: number;
}

interface CartesianChartProps {
  data: ReadonlyArray<Record<string, unknown>>;
  xAxisKey: string;
  series: ChartSeries[];
  height?: number;
  valueFormatter?: (value: number) => string;
  xAxisFormatter?: (value: string) => string;
  tooltipLabelFormatter?: (label: unknown) => string;
  showLegend?: boolean;
  /** Screen-reader summary of what the chart shows. */
  ariaLabel?: string;
}

const MARGIN = { top: 8, right: 8, left: -12, bottom: 0 };

function tooltip(
  valueFormatter: (value: number) => string,
  labelFormatter: (label: unknown) => string,
) {
  return (
    <Tooltip
      cursor={{ fill: 'var(--accent)', opacity: 0.4 }}
      content={({ active, payload, label }) => (
        <ChartTooltipContent
          active={active}
          payload={payload as ReadonlyArray<ChartPayloadEntry> | undefined}
          label={label}
          valueFormatter={valueFormatter}
          labelFormatter={labelFormatter}
        />
      )}
    />
  );
}

function legend() {
  return (
    <Legend
      content={({ payload }) => (
        <ChartLegendContent
          payload={payload as ReadonlyArray<{ value?: unknown; color?: string }>}
        />
      )}
    />
  );
}

function Frame({
  height,
  ariaLabel,
  children,
}: {
  height: number;
  ariaLabel?: string;
  children: ReactElement;
}) {
  return (
    <div role="img" aria-label={ariaLabel} className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Line
// ---------------------------------------------------------------------------

export function LineChart({
  data,
  xAxisKey,
  series,
  height = 300,
  valueFormatter = formatCompactNumber,
  xAxisFormatter = formatAxisDate,
  tooltipLabelFormatter = formatTooltipDate,
  showLegend = series.length > 1,
  ariaLabel,
}: CartesianChartProps) {
  return (
    <Frame height={height} ariaLabel={ariaLabel}>
      <RechartsLineChart data={data as Record<string, unknown>[]} margin={MARGIN}>
        <CartesianGrid {...CHART_GRID_PROPS} />
        <XAxis dataKey={xAxisKey} {...CHART_AXIS_PROPS} tickFormatter={xAxisFormatter} minTickGap={16} />
        <YAxis {...CHART_AXIS_PROPS} tickFormatter={valueFormatter} />
        {tooltip(valueFormatter, tooltipLabelFormatter)}
        {showLegend ? legend() : null}
        {series.map((s, i) => {
          const color = seriesColor(i, s.color);
          return (
            <Line
              key={s.dataKey}
              type="monotone"
              dataKey={s.dataKey}
              name={s.name ?? s.dataKey}
              stroke={color}
              strokeWidth={2}
              strokeDasharray={s.strokeDasharray}
              dot={data.length <= 31 ? { r: 2.5, fill: color, strokeWidth: 0 } : false}
              activeDot={{ r: 4.5 }}
            />
          );
        })}
      </RechartsLineChart>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Area
// ---------------------------------------------------------------------------

export function AreaChart({
  data,
  xAxisKey,
  series,
  height = 300,
  valueFormatter = formatCompactNumber,
  xAxisFormatter = formatAxisDate,
  tooltipLabelFormatter = formatTooltipDate,
  showLegend = series.length > 1,
  ariaLabel,
}: CartesianChartProps) {
  // Gradient ids are document-global, so two charts on one page must not
  // share them — a plain `area-gradient-${dataKey}` made the second chart
  // reuse the first chart's colours.
  const gradientPrefix = useId().replace(/:/g, '');

  return (
    <Frame height={height} ariaLabel={ariaLabel}>
      <RechartsAreaChart data={data as Record<string, unknown>[]} margin={MARGIN}>
        <defs>
          {series.map((s, i) => {
            const color = seriesColor(i, s.color);
            return (
              <linearGradient
                key={s.dataKey}
                id={`${gradientPrefix}-${s.dataKey}`}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="5%" stopColor={color} stopOpacity={s.fillOpacity ?? 0.35} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid {...CHART_GRID_PROPS} />
        <XAxis dataKey={xAxisKey} {...CHART_AXIS_PROPS} tickFormatter={xAxisFormatter} minTickGap={16} />
        <YAxis {...CHART_AXIS_PROPS} tickFormatter={valueFormatter} />
        {tooltip(valueFormatter, tooltipLabelFormatter)}
        {showLegend ? legend() : null}
        {series.map((s, i) => (
          <Area
            key={s.dataKey}
            type="monotone"
            dataKey={s.dataKey}
            name={s.name ?? s.dataKey}
            stackId={s.stackId}
            stroke={seriesColor(i, s.color)}
            strokeWidth={2}
            fillOpacity={1}
            fill={`url(#${gradientPrefix}-${s.dataKey})`}
          />
        ))}
      </RechartsAreaChart>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Bar (grouped, stacked, horizontal)
// ---------------------------------------------------------------------------

export interface BarChartProps extends CartesianChartProps {
  /** `vertical` lays bars out horizontally with categories on the Y axis. */
  layout?: 'horizontal' | 'vertical';
  /** Stack every series (shorthand for giving each the same `stackId`). */
  stacked?: boolean;
}

export function BarChart({
  data,
  xAxisKey,
  series,
  height = 300,
  layout = 'horizontal',
  stacked = false,
  valueFormatter = formatCompactNumber,
  xAxisFormatter = formatAxisDate,
  tooltipLabelFormatter = formatTooltipDate,
  showLegend = series.length > 1,
  ariaLabel,
}: BarChartProps) {
  const isVertical = layout === 'vertical';
  const lastIndex = series.length - 1;

  return (
    <Frame height={height} ariaLabel={ariaLabel}>
      <RechartsBarChart
        data={data as Record<string, unknown>[]}
        layout={layout}
        margin={{ ...MARGIN, left: isVertical ? 8 : MARGIN.left }}
      >
        <CartesianGrid {...CHART_GRID_PROPS} vertical={isVertical} horizontal={!isVertical} />
        {isVertical ? (
          <>
            <XAxis type="number" {...CHART_AXIS_PROPS} tickFormatter={valueFormatter} />
            <YAxis
              type="category"
              dataKey={xAxisKey}
              {...CHART_AXIS_PROPS}
              tickFormatter={xAxisFormatter}
              width={96}
            />
          </>
        ) : (
          <>
            <XAxis dataKey={xAxisKey} {...CHART_AXIS_PROPS} tickFormatter={xAxisFormatter} minTickGap={8} />
            <YAxis {...CHART_AXIS_PROPS} tickFormatter={valueFormatter} />
          </>
        )}
        {tooltip(valueFormatter, tooltipLabelFormatter)}
        {showLegend ? legend() : null}
        {series.map((s, i) => {
          const stackId = s.stackId ?? (stacked ? 'stack' : undefined);
          // Only the outermost bar of a stack gets rounded corners.
          const rounded = !stackId || i === lastIndex;
          const radius: [number, number, number, number] = rounded
            ? isVertical
              ? [0, 4, 4, 0]
              : [4, 4, 0, 0]
            : [0, 0, 0, 0];
          return (
            <Bar
              key={s.dataKey}
              dataKey={s.dataKey}
              name={s.name ?? s.dataKey}
              fill={seriesColor(i, s.color)}
              stackId={stackId}
              radius={radius}
              maxBarSize={48}
            />
          );
        })}
      </RechartsBarChart>
    </Frame>
  );
}

export function StackedBarChart(props: Omit<BarChartProps, 'stacked'>) {
  return <BarChart {...props} stacked />;
}

// ---------------------------------------------------------------------------
// Pie / donut
// ---------------------------------------------------------------------------

export interface DonutSegment {
  name: string;
  value: number;
  color?: Accent | string;
}

export interface DonutChartProps {
  data: DonutSegment[];
  height?: number;
  valueFormatter?: (value: number) => string;
  innerRadius?: number | string;
  outerRadius?: number | string;
  centerLabel?: string;
  centerValue?: string | number;
  showLegend?: boolean;
  ariaLabel?: string;
}

export function DonutChart({
  data,
  height = 300,
  valueFormatter = formatCompactNumber,
  innerRadius = '58%',
  outerRadius = '80%',
  centerLabel,
  centerValue,
  showLegend = true,
  ariaLabel,
}: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <div
      role="img"
      aria-label={
        ariaLabel ??
        data.map((d) => `${d.name}: ${valueFormatter(d.value)}`).join(', ')
      }
      className="relative w-full"
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RechartsPieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy={showLegend ? '45%' : '50%'}
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={innerRadius ? 2 : 0}
            stroke="var(--card)"
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={seriesColor(index, entry.color)} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => (
              <ChartTooltipContent
                active={active}
                payload={payload as ReadonlyArray<ChartPayloadEntry> | undefined}
                valueFormatter={valueFormatter}
                total={total}
              />
            )}
          />
          {showLegend ? legend() : null}
        </RechartsPieChart>
      </ResponsiveContainer>
      {centerLabel || centerValue !== undefined ? (
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center justify-center ${
            showLegend ? 'bottom-[10%]' : 'bottom-0'
          }`}
        >
          {centerValue !== undefined ? (
            <span className="text-xl font-bold tracking-tight tabular-nums">{centerValue}</span>
          ) : null}
          {centerLabel ? (
            <span className="text-xs text-muted-foreground">{centerLabel}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PieChart(props: Omit<DonutChartProps, 'innerRadius' | 'centerLabel' | 'centerValue'>) {
  return <DonutChart {...props} innerRadius={0} />;
}

// ---------------------------------------------------------------------------
// Single daily series
// ---------------------------------------------------------------------------

export interface TimeSeriesChartProps {
  points: TimeSeriesPoint[];
  variant?: 'bar' | 'area' | 'line';
  accent?: Accent;
  height?: number;
  /** Unit used in the tooltip and screen-reader summary, e.g. `events`. */
  valueLabel?: string;
  valueFormatter?: (value: number) => string;
}

/**
 * The daily-bucket chart every analytics endpoint's `…Series` field feeds
 * (`{ date: 'YYYY-MM-DD', value }[]`). Replaces the hand-rolled div bar chart
 * the analytics screens used before, which had no axes, no tooltip and no
 * keyboard access.
 */
export function TimeSeriesChart({
  points,
  variant = 'bar',
  accent = 'violet',
  height = 180,
  valueLabel = 'events',
  valueFormatter = formatCompactNumber,
}: TimeSeriesChartProps) {
  const total = points.reduce((sum, p) => sum + p.value, 0);
  const ariaLabel = `${formatCompactNumber(total)} ${valueLabel} across ${points.length} periods, from ${formatTooltipDate(points.at(0)?.date)} to ${formatTooltipDate(points.at(-1)?.date)}`;
  const series: ChartSeries[] = [{ dataKey: 'value', name: valueLabel, color: accent }];
  const shared = {
    data: points as unknown as ReadonlyArray<Record<string, unknown>>,
    xAxisKey: 'date',
    series,
    height,
    valueFormatter,
    showLegend: false,
    ariaLabel,
  };

  if (variant === 'area') return <AreaChart {...shared} />;
  if (variant === 'line') return <LineChart {...shared} />;
  return <BarChart {...shared} />;
}
