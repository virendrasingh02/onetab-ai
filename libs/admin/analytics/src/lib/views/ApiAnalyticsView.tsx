import type { AdminAnalyticsFilter, AdminApiAnalytics } from '@org/types';
import { Badge, Card } from '@org/ui';
import { Activity, AlertCircle, Clock, Server } from 'lucide-react';
import { useState } from 'react';
import {
  AnalyticsAreaChart,
  AnalyticsDataTable,
  AnalyticsDonutChart,
  AnalyticsFilterBar,
  AnalyticsHeader,
  AnalyticsLineChart,
  ChartContainer,
  type ColumnDef,
} from '../components/index.js';
import { useAdminApiAnalytics } from '../use-admin-analytics.js';

type ApiTableRow = AdminApiAnalytics['apiTable'][number];

export function ApiAnalyticsView() {
  const [filter, setFilter] = useState<AdminAnalyticsFilter>({ range: '30d' });
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } =
    useAdminApiAnalytics(filter);

  const statusDonut = [
    {
      name: 'Successful Requests',
      value: data?.successfulRequests || 0,
      color: '#10b981',
    },
    {
      name: 'Failed Requests (4xx/5xx)',
      value: data?.failedRequests || 0,
      color: '#ef4444',
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
          <span className="font-semibold text-foreground">{row.name}</span>
          <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[280px]">
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
        <Badge
          variant={
            row.status === 'ACTIVE'
              ? 'success'
              : row.status === 'DEPRECATED'
              ? 'warning'
              : 'outline'
          }
          className="text-[10px] px-1.5 py-0"
        >
          {row.status}
        </Badge>
      ),
    },
    {
      id: 'requests',
      header: 'Calls',
      accessorKey: 'requests',
      sortable: true,
      align: 'right',
      cell: (row) => row.requests.toLocaleString(),
    },
    {
      id: 'errorRate',
      header: 'Error Rate',
      accessorKey: 'errorRate',
      sortable: true,
      align: 'right',
      cell: (row) => (
        <span
          className={`font-medium ${
            row.errorRate > 5
              ? 'text-destructive'
              : row.errorRate > 1
              ? 'text-warning'
              : 'text-success'
          }`}
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
        <span
          className={
            row.avgLatencyMs > 500
              ? 'text-destructive font-semibold'
              : row.avgLatencyMs > 200
              ? 'text-warning'
              : 'text-foreground'
          }
        >
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
        filter={filter}
        onFilterChange={(newFilter) => setFilter(newFilter)}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Total Requests</span>
            <Server className="size-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.totalRequests?.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Across {data?.totalApis ?? 0} registered APIs
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Error Rate</span>
            <AlertCircle className="size-4 text-destructive" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.errorRate !== undefined ? `${data.errorRate}%` : '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Failed requests: {data?.failedRequests?.toLocaleString() ?? 0}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">p95 Latency</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.p95ResponseTimeMs !== undefined ? `${data.p95ResponseTimeMs} ms` : '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Average: {data?.avgResponseTimeMs ?? 0} ms
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Peak Rate</span>
            <Activity className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.peakRequestsPerMinute?.toLocaleString() ?? '—'} /min
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Peak requests per minute
          </div>
        </Card>
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
            <AnalyticsAreaChart
              data={data?.requestsOverTime || []}
              xAxisKey="date"
              series={[
                { dataKey: 'requests', name: 'Total Requests', color: '#3b82f6' },
                { dataKey: 'errors', name: 'Errors (4xx/5xx)', color: '#ef4444' },
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
            <AnalyticsDonutChart
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
        <AnalyticsLineChart
          data={data?.requestsOverTime || []}
          xAxisKey="date"
          series={[
            { dataKey: 'avgLatency', name: 'Average Latency', color: '#10b981' },
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
