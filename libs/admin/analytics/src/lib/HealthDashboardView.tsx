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
  LiveToggle,
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

  const healthy =
    data?.services.filter((s) => s.status === 'HEALTHY').length ?? 0;
  const degraded =
    data?.services.filter((s) => s.status === 'DEGRADED').length ?? 0;
  const down = data?.services.filter((s) => s.status === 'DOWN').length ?? 0;

  return (
    <ViewShell>
      <ViewHeader
        icon={<Activity />}
        accent="green"
        title="Platform Health Dashboard"
        description="Live dependency probes, latency and process vitals"
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
            <div
              className={`p-4 mb-6 gap-3 flex items-center rounded-xl border ${
                data.status === 'HEALTHY'
                  ? 'border-success/40 bg-success/10'
                  : 'border-warning/40 bg-warning/15'
              }`}
            >
              {data.status === 'HEALTHY' ? (
                <CheckCircle className="w-5 h-5 shrink-0 text-success" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0 text-warning" />
              )}
              <div>
                <p
                  className={`text-sm font-semibold ${
                    data.status === 'HEALTHY' ? 'text-success' : 'text-warning'
                  }`}
                >
                  {data.status === 'HEALTHY'
                    ? 'All systems operational'
                    : 'Some services need attention'}
                </p>
                <p
                  className={`text-xs ${
                    data.status === 'HEALTHY'
                      ? 'text-success/70'
                      : 'text-warning/70'
                  }`}
                >
                  {healthy} healthy · {degraded} degraded · {down} down ·
                  checked {new Date(data.checkedAt).toLocaleTimeString()}
                </p>
              </div>
            </div>

            <div className="md:grid-cols-4 gap-4 mb-6 grid grid-cols-2">
              <MetricCard
                label="API uptime"
                value={formatDuration(data.uptimeSeconds)}
                icon={Clock}
                accent="blue"
                hint={`pid ${data.process.pid}`}
              />
              <MetricCard
                label="Heap in use"
                value={formatBytes(data.process.heapUsedBytes)}
                icon={Cpu}
                accent="violet"
                hint={`of ${formatBytes(data.process.heapTotalBytes)}`}
              />
              <MetricCard
                label="Resident memory"
                value={formatBytes(data.process.rssBytes)}
                icon={Server}
                accent="cyan"
              />
              <MetricCard
                label="Runtime"
                value={data.process.nodeVersion}
                icon={Activity}
                accent="green"
                hint={data.process.platform}
              />
            </div>

            <div className="md:grid-cols-2 xl:grid-cols-3 gap-4 grid grid-cols-1">
              {data.services.map((service) => (
                <Panel key={service.name}>
                  <div className="gap-2 mb-3 flex items-center justify-between">
                    <div className="gap-2 min-w-0 flex items-center">
                      {service.status === 'DOWN' ? (
                        <XCircle className="w-4 h-4 shrink-0 text-destructive" />
                      ) : service.status === 'DEGRADED' ? (
                        <AlertTriangle className="w-4 h-4 shrink-0 text-warning" />
                      ) : (
                        <CheckCircle className="w-4 h-4 shrink-0 text-success" />
                      )}
                      <h3 className="font-bold text-sm truncate text-foreground">
                        {service.name}
                      </h3>
                    </div>
                    <StatusPill status={service.status} />
                  </div>
                  <div className="gap-1.5 text-xs mb-1.5 flex items-center text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {service.latencyMs === null
                      ? 'no response'
                      : `${service.latencyMs}ms`}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {service.detail}
                  </p>
                </Panel>
              ))}
            </div>
          </>
        ) : null}
      </QueryState>
    </ViewShell>
  );
}
