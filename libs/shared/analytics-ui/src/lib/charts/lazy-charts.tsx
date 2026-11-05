import { lazy, Suspense, type ComponentProps, type ComponentType } from 'react';
import type * as Charts from './charts.js';

type ChartName =
  | 'AreaChart'
  | 'BarChart'
  | 'DonutChart'
  | 'LineChart'
  | 'PieChart'
  | 'StackedBarChart'
  | 'TimeSeriesChart';

/**
 * Recharts and its d3 dependencies load with the first chart on screen, not with
 * the app: this library's barrel reaches every app's entry through screens that
 * are not charts themselves. The placeholder holds the chart's height so the
 * page does not jump when it arrives.
 */
function lazyChart<Name extends ChartName>(name: Name) {
  type Props = ComponentProps<(typeof Charts)[Name]>;
  // Each chart has its own props, which a generic `Name` cannot narrow to; the
  // public signature below is what callers are checked against.
  const Chart = lazy(async () => {
    const charts = await import('./charts.js');
    return { default: charts[name] as ComponentType<object> };
  });
  function LazyChart(props: Props) {
    const { height = 300 } = props as { height?: number };
    return (
      <Suspense
        fallback={<div aria-hidden className="w-full" style={{ height }} />}
      >
        <Chart {...(props as object)} />
      </Suspense>
    );
  }
  LazyChart.displayName = name;
  return LazyChart;
}

export const AreaChart = lazyChart('AreaChart');
export const BarChart = lazyChart('BarChart');
export const DonutChart = lazyChart('DonutChart');
export const LineChart = lazyChart('LineChart');
export const PieChart = lazyChart('PieChart');
export const StackedBarChart = lazyChart('StackedBarChart');
export const TimeSeriesChart = lazyChart('TimeSeriesChart');
