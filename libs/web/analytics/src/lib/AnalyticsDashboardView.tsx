import {
  BarChart3,
  Bot,
  CheckSquare,
  FileText,
  FolderKanban,
  HardDrive,
  Hash,
  MessageSquare,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import {
  BarChart,
  Breakdown,
  DataTable,
  MetricCard,
  Panel,
  QueryState,
  RangePicker,
  RefreshButton,
  StatusPill,
  ViewHeader,
  ViewShell,
  formatBytes,
  formatNumber,
} from '@org/analytics-ui';
import { useDashboardAnalytics } from './use-analytics.js';

/** Phase 11 landing screen: one glance at the whole workspace plus health. */
export function AnalyticsDashboardView() {
  const [days, setDays] = useState(30);
  const query = useDashboardAnalytics(days);
  const data = query.data;

  return (
    <ViewShell>
      <ViewHeader
        icon={<BarChart3 className="w-6 h-6 text-blue-400" />}
        title="Analytics & Observability"
        description="Workspace metrics, engagement trends and live platform health"
        actions={
          <>
            <RangePicker days={days} onChange={setDays} />
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
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4 mb-6">
              <MetricCard
                label="Team members"
                value={data.totals.members}
                icon={Users}
                color="bg-blue-600/20 text-blue-400"
                trend={data.headline.members}
              />
              <MetricCard
                label="Channels"
                value={data.totals.channels}
                icon={Hash}
                color="bg-purple-600/20 text-purple-400"
              />
              <MetricCard
                label="Messages"
                value={data.totals.messages}
                icon={MessageSquare}
                color="bg-emerald-600/20 text-emerald-400"
                trend={data.headline.messages}
              />
              <MetricCard
                label="Tasks"
                value={data.totals.tasks}
                icon={CheckSquare}
                color="bg-amber-600/20 text-amber-400"
                trend={data.headline.tasks}
              />
              <MetricCard
                label="Documents"
                value={data.totals.docs}
                icon={FileText}
                color="bg-cyan-600/20 text-cyan-400"
              />
              <MetricCard
                label="Projects"
                value={data.totals.projects}
                icon={FolderKanban}
                color="bg-indigo-600/20 text-indigo-400"
              />
              <MetricCard
                label="AI sessions"
                value={data.headline.aiSessions.current}
                icon={Bot}
                color="bg-pink-600/20 text-pink-400"
                trend={data.headline.aiSessions}
                hint={`in the last ${days}d`}
              />
              <MetricCard
                label="Storage used"
                value={formatBytes(data.totals.storageBytes)}
                icon={HardDrive}
                color="bg-orange-600/20 text-orange-400"
                hint={`${formatNumber(data.totals.uploads)} files`}
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <Panel
                title={`Tracked activity · last ${days} days`}
                subtitle={`${formatNumber(
                  data.headline.events.current,
                )} events recorded`}
                className="lg:col-span-2"
              >
                <BarChart series={data.activitySeries} />
              </Panel>

              <Panel
                title="Event breakdown"
                subtitle="Which product surfaces are being used"
              >
                <Breakdown
                  slices={data.eventBreakdown}
                  emptyMessage="No events recorded in this range. Events appear here as the workspace is used."
                />
              </Panel>
            </div>

            <Panel
              title="Platform health"
              subtitle={`Checked ${new Date(
                data.health.checkedAt,
              ).toLocaleTimeString()}`}
              actions={<StatusPill status={data.health.status} />}
            >
              <DataTable
                columns={['Service', 'Status', 'Latency', 'Detail']}
                rows={data.health.services.map((service) => [
                  <span className="text-slate-100 font-medium">
                    {service.name}
                  </span>,
                  <StatusPill status={service.status} />,
                  service.latencyMs === null ? '—' : `${service.latencyMs}ms`,
                  <span className="text-slate-500">{service.detail}</span>,
                ])}
              />
            </Panel>
          </>
        ) : null}
      </QueryState>
    </ViewShell>
  );
}
