/**
 * @org/analytics-ui — presentational building blocks for analytics screens.
 *
 * Same contract as @org/ui: props in, callbacks out, no data fetching. These
 * live in their own library because both the workspace-scoped screens in the
 * web app (`@org/web-analytics`) and the platform-operations screens in the
 * admin console (`@org/admin-analytics`) render them, and `scope:web` and
 * `scope:admin` may not depend on each other.
 *
 * It is also the only library that imports Recharts: every chart on the
 * platform is one of the components below, themed from design tokens.
 */

export {
  Breakdown,
  DataTable,
  LiveToggle,
  MetricCard,
  Panel,
  ProgressBar,
  QueryState,
  RefreshButton,
  StatusPill,
  TrendBadge,
  ViewHeader,
  ViewShell,
  formatBytes,
  formatDuration,
  formatNumber,
  formatRelative,
} from './lib/analytics-ui.js';

export {
  AreaChart,
  BarChart,
  DonutChart,
  LineChart,
  PieChart,
  StackedBarChart,
  TimeSeriesChart,
  type BarChartProps,
  type ChartSeries,
  type DonutChartProps,
  type DonutSegment,
  type TimeSeriesChartProps,
} from './lib/charts/charts.js';

export {
  ChartContainer,
  ChartEmptyState,
  ChartLegendContent,
  ChartTooltipContent,
  type ChartContainerProps,
  type ChartEmptyStateProps,
  type ChartLegendContentProps,
  type ChartTooltipContentProps,
} from './lib/charts/chart-chrome.js';

export {
  CHART_SERIES_ACCENTS,
  formatAxisDate,
  formatCompactNumber,
  formatCurrency,
  formatPercent,
  formatTooltipDate,
  seriesColor,
} from './lib/charts/chart-theme.js';
