/**
 * @org/analytics-ui — presentational building blocks for analytics screens.
 *
 * Same contract as @org/ui: props in, callbacks out, no data fetching. These
 * live in their own library because both the workspace-scoped screens in the
 * web app (`@org/web-analytics`) and the platform-operations screens in the
 * admin console (`@org/admin-analytics`) render them, and `scope:web` and
 * `scope:admin` may not depend on each other.
 */

export {
  RANGE_OPTIONS,
  BarChart,
  Breakdown,
  DataTable,
  LiveToggle,
  MetricCard,
  Panel,
  ProgressBar,
  QueryState,
  RangePicker,
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
