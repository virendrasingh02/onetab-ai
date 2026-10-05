import {
  AreaChart,
  ChartContainer,
  DonutChart,
  LineChart,
} from '@org/analytics-ui';
import type { AdminApiAnalytics } from '@org/types';
import { cn } from '@org/utils';
import {
  AdminMetricCard,
  AnalyticsDataTable,
  AnalyticsFilterBar,
  AnalyticsHeader,
  type ColumnDef,
} from '../components/index.js';
import { useAdminAnalyticsFilter } from '../use-admin-analytics-filter.js';
import { useAdminApiAnalytics } from '../use-admin-analytics.js';

type ApiTableRow = AdminApiAnalytics['apiTable'][number];

export function ApiAnalyticsView() {
  const filterState = useAdminAnalyticsFilter();
  const { filter } = filterState;
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } =
    useAdminApiAnalytics(filter);

  const statusDonut = [
    {
      name: 'Successful Requests',
      value: data?.successfulRequests || 0,
      color: 'green',
    },
    {
      name: 'Failed Requests (4xx/5xx)',
      value: data?.failedRequests || 0,
      color: 'var(--destructive)',
    },
  ];

  const columns: ColumnDef<ApiTableRow>[] = [
    {
      id: 'name',
      header: 'API Name & Endpoint',
      accessorKey: 'name',
      sortable: true,
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground text-xs tracking-tight">
            {row.name}
          </span>
          <span className="font-mono text-[11px] text-muted-foreground/75 truncate max-w-[320px] mt-0.5">
            {row.endpoint}
          </span>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'status',
      sortable: true,
      cell: (row) => (
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase',
            row.status === 'ACTIVE'
              ? 'border-emerald-500/25 bg-emerald-500/15 text-emerald-400 dark:text-emerald-400'
              : row.status === 'DEPRECATED'
              ? 'border-amber-500/25 bg-amber-500/15 text-amber-400 dark:text-amber-400'
              : 'border-border/80 bg-muted/60 text-muted-foreground',
          )}
        >
          {row.status}
        </span>
      ),
    },
    {
      id: 'requests',
      header: 'Calls',
      accessorKey: 'requests',
      sortable: true,
      align: 'right',
      cell: (row) => (
        <span className="font-medium text-foreground tabular-nums">
          {row.requests.toLocaleString()}
        </span>
      ),
    },
    {
      id: 'errorRate',
      header: 'Error Rate',
      accessorKey: 'errorRate',
      sortable: true,
      align: 'right',
      cell: (row) => (
        <span
          className={cn(
            'font-medium tabular-nums',
            row.errorRate > 5
              ? 'text-rose-400 font-semibold'
              : row.errorRate > 0
              ? 'text-amber-400'
              : 'text-emerald-400',
          )}
        >
          {row.errorRate}%
        </span>
      ),
    },
    {
      id: 'latency',
      header: 'Avg Latency',
      accessorKey: 'avgLatencyMs',
      sortable: true,
      align: 'right',
      cell: (row) => (
        <span className="font-medium text-foreground tabular-nums">
          {row.avgLatencyMs} ms
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <AnalyticsHeader
        title="API Traffic & Latency"
        description="Monitor request volume, error rates, p95 latency, and endpoint performance across the platform."
        lastUpdated={dataUpdatedAt}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        exportType="api"
        filter={filter}
      />

      <AnalyticsFilterBar
        state={filterState}
      />

      {/* KPI Cards (Ref Image Anatomy) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminMetricCard
          label="Total Requests"
          subtitle="API Gateway & Ingestion"
          value={data?.totalRequests?.toLocaleString() ?? '—'}
          badgeText="+22.4%"
          badgeType="positive"
          secondaryText={`Across ${data?.totalApis ?? 0} registered APIs`}
          sparklineColor="emerald"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Error Rate"
          subtitle="Failure Index (5xx/4xx)"
          value={data?.errorRate !== undefined ? `${data.errorRate}%` : '—'}
          badgeText={`${data?.errorRate ?? 0}%`}
          badgeType={data?.errorRate && data.errorRate > 2 ? 'negative' : 'positive'}
          secondaryText={
            data?.errorRate && data.errorRate > 2
              ? `${data?.failedRequests?.toLocaleString() ?? 0} failed requests`
              : 'Well within SLA budget'
          }
          sparklineColor={data?.errorRate && data.errorRate > 2 ? 'rose' : 'emerald'}
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="p95 Latency"
          subtitle="Tail Threshold Benchmark"
          value={data?.p95ResponseTimeMs !== undefined ? `${data.p95ResponseTimeMs} ms` : '—'}
          badgeText={data?.p95ResponseTimeMs && data.p95ResponseTimeMs > 250 ? '+15ms' : '-8ms'}
          badgeType={data?.p95ResponseTimeMs && data.p95ResponseTimeMs > 250 ? 'negative' : 'positive'}
          secondaryText={`Average: ${data?.avgResponseTimeMs ?? 0} ms`}
          sparklineColor={data?.p95ResponseTimeMs && data.p95ResponseTimeMs > 250 ? 'rose' : 'cyan'}
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Peak Rate"
          subtitle="Throughput Envelope"
          value={`${data?.peakRequestsPerMinute?.toLocaleString() ?? '—'} /min`}
          badgeText="+18.0%"
          badgeType="positive"
          secondaryText="Peak requests per minute"
          sparklineColor="amber"
          isLoading={isLoading}
        />
      </div>

      {/* Volume Chart & Success vs Error Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartContainer
            title="Request Throughput & Errors"
            description="API calls vs failing requests over time"
            isLoading={isLoading}
            isError={isError}
            isEmpty={!data?.requestsOverTime?.length}
            height={320}
          >
            <AreaChart
              data={data?.requestsOverTime || []}
              xAxisKey="date"
              series={[
                { dataKey: 'requests', name: 'Total Requests', color: 'blue' },
                { dataKey: 'errors', name: 'Errors (4xx/5xx)', color: 'var(--destructive)' },
              ]}
              height={320}
              showLegend
            />
          </ChartContainer>
        </div>

        <div>
          <ChartContainer
            title="Request Status Distribution"
            description="Successful vs failed calls"
            isLoading={isLoading}
            isError={isError}
            isEmpty={(data?.totalRequests || 0) === 0}
            height={320}
          >
            <DonutChart
              data={statusDonut}
              centerLabel="Calls"
              centerValue={data?.totalRequests}
              height={320}
            />
          </ChartContainer>
        </div>
      </div>

      {/* Latency Over Time Chart */}
      <ChartContainer
        title="Average Response Latency Over Time"
        description="Response times in milliseconds across all endpoints"
        isLoading={isLoading}
        isError={isError}
        isEmpty={!data?.requestsOverTime?.length}
        height={260}
      >
        <LineChart
          data={data?.requestsOverTime || []}
          xAxisKey="date"
          series={[
            { dataKey: 'avgLatency', name: 'Average Latency', color: 'green' },
          ]}
          height={260}
          valueFormatter={(val) => `${val}ms`}
        />
      </ChartContainer>

      {/* API Table */}
      <div>
        <AnalyticsDataTable
          title="API Registry & Endpoints"
          data={(data?.apiTable || []) as ApiTableRow[]}
          columns={columns as ColumnDef<ApiTableRow>[]}
          isLoading={isLoading}
          searchKey="endpoint"
          searchPlaceholder="Filter endpoints..."
          emptyMessage="No endpoint metrics found."
        />
      </div>
    </div>
  );
}
