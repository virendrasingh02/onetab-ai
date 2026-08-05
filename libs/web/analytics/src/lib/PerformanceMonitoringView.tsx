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
} from './analytics-ui.js';
import { usePerformanceMetrics } from './use-analytics.js';

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
        icon={<Gauge className="w-6 h-6 text-amber-400" />}
        title="Performance Monitoring"
        description="Request latency, throughput and process resource usage, sampled live"
        actions={
          <>
            <button
              type="button"
              onClick={() => setLive((value) => !value)}
              className={`px-3 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition border ${
                live
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-900/60 border-slate-800 text-slate-400'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  live ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                }`}
              />
              {live ? 'Live · 15s' : 'Paused'}
            </button>
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
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
              <MetricCard
                label="Requests observed"
                value={data.totalRequests}
                icon={Activity}
                color="bg-blue-600/20 text-blue-400"
                hint={`over ${formatDuration(data.collectedSinceMs / 1000)}`}
              />
              <MetricCard
                label="Requests / min"
                value={data.requestsPerMinute}
                icon={Timer}
                color="bg-cyan-600/20 text-cyan-400"
              />
              <MetricCard
                label="p95 latency"
                value={`${data.latency.p95Ms}ms`}
                icon={Gauge}
                color="bg-amber-600/20 text-amber-400"
                hint={`p50 ${data.latency.p50Ms}ms · p99 ${data.latency.p99Ms}ms`}
              />
              <MetricCard
                label="Error rate"
                value={`${data.errorRate}%`}
                icon={AlertCircle}
                color={
                  data.errorRate > 5
                    ? 'bg-red-600/20 text-red-400'
                    : 'bg-emerald-600/20 text-emerald-400'
                }
                hint={`${formatNumber(data.totalErrors)} failed responses`}
              />
              <MetricCard
                label="Event loop lag"
                value={`${data.eventLoopLagMs}ms`}
                icon={Cpu}
                color={
                  data.eventLoopLagMs > 100
                    ? 'bg-amber-600/20 text-amber-400'
                    : 'bg-purple-600/20 text-purple-400'
                }
                hint="blocked time between ticks"
              />
              <MetricCard
                label="DB latency"
                value={
                  data.dbLatencyMs < 0 ? 'unreachable' : `${data.dbLatencyMs}ms`
                }
                icon={Database}
                color={
                  data.dbLatencyMs < 0
                    ? 'bg-red-600/20 text-red-400'
                    : 'bg-emerald-600/20 text-emerald-400'
                }
                hint="SELECT 1 round-trip"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <Panel
                title="Throughput · last 30 minutes"
                subtitle="Requests handled per minute"
                className="lg:col-span-2"
              >
                <BarChart
                  series={data.throughputSeries}
                  color="from-amber-600 to-orange-500"
                  valueLabel="requests"
                />
              </Panel>

              <Panel title="Process resources" subtitle="Node.js runtime">
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-300 flex items-center gap-1.5">
                        <MemoryStick className="w-3.5 h-3.5" /> Heap
                      </span>
                      <span className="font-semibold text-white">
                        {formatBytes(data.memory.heapUsedBytes)} /{' '}
                        {formatBytes(data.memory.heapTotalBytes)}
                      </span>
                    </div>
                    <ProgressBar
                      pct={heapPct}
                      color={
                        heapPct > 85
                          ? 'from-amber-600 to-red-500'
                          : 'from-blue-600 to-cyan-500'
                      }
                    />
                  </div>

                  <dl className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <dt className="text-slate-400">Resident set size</dt>
                      <dd className="text-slate-200 font-medium">
                        {formatBytes(data.memory.rssBytes)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-400">CPU · user</dt>
                      <dd className="text-slate-200 font-medium">
                        {formatNumber(data.cpu.userMs)}ms
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-400">CPU · system</dt>
                      <dd className="text-slate-200 font-medium">
                        {formatNumber(data.cpu.systemMs)}ms
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-slate-400">Avg latency</dt>
                      <dd className="text-slate-200 font-medium">
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
                columns={[
                  'Route',
                  'Requests',
                  'Errors',
                  'Avg',
                  'p95',
                  'Max',
                ]}
                rows={data.slowestRoutes.map((route) => [
                  <span className="text-slate-100 font-mono text-[11px]">
                    {route.route}
                  </span>,
                  formatNumber(route.requests),
                  <span
                    className={
                      route.errors > 0 ? 'text-red-400' : 'text-slate-500'
                    }
                  >
                    {route.errors} ({route.errorRate}%)
                  </span>,
                  `${route.avgMs}ms`,
                  <span
                    className={
                      route.p95Ms > 1000
                        ? 'text-red-400'
                        : route.p95Ms > 300
                          ? 'text-amber-400'
                          : 'text-emerald-400'
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
