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
  MetricCard,
  Panel,
  QueryState,
  RangePicker,
  RefreshButton,
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
        icon={<BarChart3 />}
        accent="blue"
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
            <div className="md:grid-cols-4 xl:grid-cols-8 gap-4 mb-6 grid grid-cols-2">
              <MetricCard
                label="Team members"
                value={data.totals.members}
                icon={Users}
                accent="blue"
                trend={data.headline.members}
              />
              <MetricCard
                label="Channels"
                value={data.totals.channels}
                icon={Hash}
                accent="violet"
              />
              <MetricCard
                label="Messages"
                value={data.totals.messages}
                icon={MessageSquare}
                accent="green"
                trend={data.headline.messages}
              />
              <MetricCard
                label="Tasks"
                value={data.totals.tasks}
                icon={CheckSquare}
                accent="amber"
                trend={data.headline.tasks}
              />
              <MetricCard
                label="Documents"
                value={data.totals.docs}
                icon={FileText}
                accent="cyan"
              />
              <MetricCard
                label="Projects"
                value={data.totals.projects}
                icon={FolderKanban}
                accent="indigo"
              />
              <MetricCard
                label="AI sessions"
                value={data.headline.aiSessions.current}
                icon={Bot}
                accent="pink"
                trend={data.headline.aiSessions}
                hint={`in the last ${days}d`}
              />
              <MetricCard
                label="Storage used"
                value={formatBytes(data.totals.storageBytes)}
                icon={HardDrive}
                accent="orange"
                hint={`${formatNumber(data.totals.uploads)} files`}
              />
            </div>

            <div className="lg:grid-cols-3 gap-6 mb-6 grid grid-cols-1">
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
          </>
        ) : null}
      </QueryState>
    </ViewShell>
  );
}
