import {
  Activity,
  AlertCircle,
  Cpu,
  Database,
  Gauge,
  MemoryStick,
  Timer,
} from 'lucide-react';
import { useState } from 'react';
import {
  BarChart,
  DataTable,
  LiveToggle,
  MetricCard,
  Panel,
  ProgressBar,
  QueryState,
  RefreshButton,
  ViewHeader,
  ViewShell,
  formatBytes,
  formatDuration,
  formatNumber,
} from '@org/analytics-ui';
import { usePerformanceMetrics } from './use-admin-analytics.js';

/** Live API telemetry: latency percentiles, throughput and resource pressure. */
export function PerformanceMonitoringView() {
  const [live, setLive] = useState(true);
  const query = usePerformanceMetrics(live);
  const data = query.data;

  const heapPct = data
    ? Math.round((data.memory.heapUsedBytes / data.memory.heapTotalBytes) * 100)
    : 0;

  return (
    <ViewShell>
      <ViewHeader
        icon={<Gauge />}
        accent="amber"
        title="Performance Monitoring"
        description="Request latency, throughput and process resource usage, sampled live"
        actions={
          <>
            <LiveToggle
              live={live}
              onToggle={() => setLive((value) => !value)}
              intervalLabel="15s"
            />
            <RefreshButton
              onClick={() => query.refetch()}
              busy={query.isFetching}
            />
          </>
        }
      />

      <QueryState isLoading={query.isLoading} error={query.error}>
        {data ? (
          <>
            <div className="md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6 grid grid-cols-2">
              <MetricCard
                label="Requests observed"
                value={data.totalRequests}
                icon={Activity}
                accent="blue"
                hint={`over ${formatDuration(data.collectedSinceMs / 1000)}`}
              />
              <MetricCard
                label="Requests / min"
                value={data.requestsPerMinute}
                icon={Timer}
                accent="cyan"
              />
              <MetricCard
                label="p95 latency"
                value={`${data.latency.p95Ms}ms`}
                icon={Gauge}
                accent="amber"
                hint={`p50 ${data.latency.p50Ms}ms · p99 ${data.latency.p99Ms}ms`}
              />
              <MetricCard
                label="Error rate"
                value={`${data.errorRate}%`}
                icon={AlertCircle}
                accent={data.errorRate > 5 ? 'rose' : 'green'}
                hint={`${formatNumber(data.totalErrors)} failed responses`}
              />
              <MetricCard
                label="Event loop lag"
                value={`${data.eventLoopLagMs}ms`}
                icon={Cpu}
                accent={data.eventLoopLagMs > 100 ? 'amber' : 'violet'}
                hint="blocked time between ticks"
              />
              <MetricCard
                label="DB latency"
                value={
                  data.dbLatencyMs < 0 ? 'unreachable' : `${data.dbLatencyMs}ms`
                }
                icon={Database}
                accent={data.dbLatencyMs < 0 ? 'rose' : 'green'}
                hint="SELECT 1 round-trip"
              />
            </div>

            <div className="lg:grid-cols-3 gap-6 mb-6 grid grid-cols-1">
              <Panel
                title="Throughput · last 30 minutes"
                subtitle="Requests handled per minute"
                className="lg:col-span-2"
              >
                <BarChart
                  series={data.throughputSeries}
                  accent="amber"
                  valueLabel="requests"
                />
              </Panel>

              <Panel title="Process resources" subtitle="Node.js runtime">
                <div className="space-y-4">
                  <div>
                    <div className="text-xs mb-1.5 flex justify-between">
                      <span className="gap-1.5 flex items-center text-foreground">
                        <MemoryStick className="w-3.5 h-3.5" /> Heap
                      </span>
                      <span className="font-semibold text-foreground">
                        {formatBytes(data.memory.heapUsedBytes)} /{' '}
                        {formatBytes(data.memory.heapTotalBytes)}
                      </span>
                    </div>
                    <ProgressBar
                      pct={heapPct}
                      accent={heapPct > 85 ? 'amber' : 'blue'}
                    />
                  </div>

                  <dl className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">
                        Resident set size
                      </dt>
                      <dd className="font-medium text-foreground">
                        {formatBytes(data.memory.rssBytes)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">CPU · user</dt>
                      <dd className="font-medium text-foreground">
                        {formatNumber(data.cpu.userMs)}ms
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">CPU · system</dt>
                      <dd className="font-medium text-foreground">
                        {formatNumber(data.cpu.systemMs)}ms
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Avg latency</dt>
                      <dd className="font-medium text-foreground">
                        {data.latency.avgMs}ms
                      </dd>
                    </div>
                  </dl>
                </div>
              </Panel>
            </div>

            <Panel
              title="Slowest routes"
              subtitle="Ranked by p95 latency across sampled traffic"
            >
              <DataTable
                columns={['Route', 'Requests', 'Errors', 'Avg', 'p95', 'Max']}
                rows={data.slowestRoutes.map((route) => [
                  <span className="font-mono text-[11px] text-foreground">
                    {route.route}
                  </span>,
                  formatNumber(route.requests),
                  <span
                    className={
                      route.errors > 0
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    }
                  >
                    {route.errors} ({route.errorRate}%)
                  </span>,
                  `${route.avgMs}ms`,
                  <span
                    className={
                      route.p95Ms > 1000
                        ? 'text-destructive'
                        : route.p95Ms > 300
                          ? 'text-warning'
                          : 'text-success'
                    }
                  >
                    {route.p95Ms}ms
                  </span>,
                  `${route.maxMs}ms`,
                ])}
                emptyMessage="No requests sampled yet — traffic appears here as the API is used."
              />
            </Panel>
          </>
        ) : null}
      </QueryState>
    </ViewShell>
  );
}
