import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  Server,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import {
  MetricCard,
  Panel,
  QueryState,
  RefreshButton,
  StatusPill,
  ViewHeader,
  ViewShell,
  formatBytes,
  formatDuration,
} from '@org/analytics-ui';
import { useHealthStatus } from './use-admin-analytics.js';

/** Live dependency status, probed on demand rather than reported from memory. */
export function HealthDashboardView() {
  const [live, setLive] = useState(true);
  const query = useHealthStatus(live);
  const data = query.data;

  const healthy = data?.services.filter((s) => s.status === 'HEALTHY').length ?? 0;
  const degraded =
    data?.services.filter((s) => s.status === 'DEGRADED').length ?? 0;
  const down = data?.services.filter((s) => s.status === 'DOWN').length ?? 0;

  return (
    <ViewShell>
      <ViewHeader
        icon={<Activity className="w-6 h-6 text-emerald-400" />}
        title="Platform Health Dashboard"
        description="Live dependency probes, latency and process vitals"
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
            <div
              className={`rounded-xl p-4 mb-6 flex items-center gap-3 border ${
                data.status === 'HEALTHY'
                  ? 'bg-emerald-950/40 border-emerald-500/30'
                  : 'bg-amber-950/40 border-amber-500/30'
              }`}
            >
              {data.status === 'HEALTHY' ? (
                <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              )}
              <div>
                <p
                  className={`text-sm font-semibold ${
                    data.status === 'HEALTHY'
                      ? 'text-emerald-300'
                      : 'text-amber-300'
                  }`}
                >
                  {data.status === 'HEALTHY'
                    ? 'All systems operational'
                    : 'Some services need attention'}
                </p>
                <p
                  className={`text-xs ${
                    data.status === 'HEALTHY'
                      ? 'text-emerald-400/70'
                      : 'text-amber-400/70'
                  }`}
                >
                  {healthy} healthy · {degraded} degraded · {down} down · checked{' '}
                  {new Date(data.checkedAt).toLocaleTimeString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <MetricCard
                label="API uptime"
                value={formatDuration(data.uptimeSeconds)}
                icon={Clock}
                color="bg-blue-600/20 text-blue-400"
                hint={`pid ${data.process.pid}`}
              />
              <MetricCard
                label="Heap in use"
                value={formatBytes(data.process.heapUsedBytes)}
                icon={Cpu}
                color="bg-purple-600/20 text-purple-400"
                hint={`of ${formatBytes(data.process.heapTotalBytes)}`}
              />
              <MetricCard
                label="Resident memory"
                value={formatBytes(data.process.rssBytes)}
                icon={Server}
                color="bg-cyan-600/20 text-cyan-400"
              />
              <MetricCard
                label="Runtime"
                value={data.process.nodeVersion}
                icon={Activity}
                color="bg-emerald-600/20 text-emerald-400"
                hint={data.process.platform}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {data.services.map((service) => (
                <Panel key={service.name}>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {service.status === 'DOWN' ? (
                        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                      ) : service.status === 'DEGRADED' ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      ) : (
                        <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                      )}
                      <h3 className="font-bold text-sm text-slate-100 truncate">
                        {service.name}
                      </h3>
                    </div>
                    <StatusPill status={service.status} />
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1.5">
                    <Clock className="w-3 h-3" />
                    {service.latencyMs === null
                      ? 'no response'
                      : `${service.latencyMs}ms`}
                  </div>
                  <p className="text-[11px] text-slate-500">{service.detail}</p>
                </Panel>
              ))}
            </div>
          </>
        ) : null}
      </QueryState>
    </ViewShell>
  );
}
