import {
  Building2,
  CheckSquare,
  FileText,
  FolderKanban,
  Hash,
  MessageSquare,
  UserCheck,
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
  TrendBadge,
  ViewHeader,
  ViewShell,
  formatNumber,
} from './analytics-ui.js';
import { useWorkspaceAnalytics } from './use-analytics.js';

/** Workspace-level composition: what exists, where it lives, who is active. */
export function WorkspaceAnalyticsView() {
  const [days, setDays] = useState(30);
  const query = useWorkspaceAnalytics(days);
  const data = query.data;

  return (
    <ViewShell>
      <ViewHeader
        icon={<Building2 className="w-6 h-6 text-blue-400" />}
        title="Workspace Analytics"
        description="Content inventory, channel activity and membership growth"
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
                label="Members"
                value={data.totalMembers}
                icon={Users}
                color="bg-blue-600/20 text-blue-400"
              />
              <MetricCard
                label={`Active · ${days}d`}
                value={data.activeMembers}
                icon={UserCheck}
                color="bg-emerald-600/20 text-emerald-400"
                hint={
                  data.totalMembers === 0
                    ? undefined
                    : `${Math.round(
                        (data.activeMembers / data.totalMembers) * 100,
                      )}% of members`
                }
              />
              <MetricCard
                label="Channels"
                value={data.totalChannels}
                icon={Hash}
                color="bg-purple-600/20 text-purple-400"
              />
              <MetricCard
                label="Messages"
                value={data.totalMessages}
                icon={MessageSquare}
                color="bg-cyan-600/20 text-cyan-400"
                trend={data.messageTrend}
              />
              <MetricCard
                label="Tasks"
                value={data.totalTasks}
                icon={CheckSquare}
                color="bg-amber-600/20 text-amber-400"
              />
              <MetricCard
                label="Projects"
                value={data.totalProjects}
                icon={FolderKanban}
                color="bg-indigo-600/20 text-indigo-400"
              />
              <MetricCard
                label="Documents"
                value={data.totalDocs}
                icon={FileText}
                color="bg-pink-600/20 text-pink-400"
              />
              <MetricCard
                label="Files"
                value={data.totalUploads}
                icon={FileText}
                color="bg-orange-600/20 text-orange-400"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              <Panel
                title={`New members · last ${days} days`}
                subtitle="Joins per day"
                className="lg:col-span-2"
              >
                <BarChart
                  series={data.memberGrowth}
                  color="from-emerald-600 to-teal-400"
                  valueLabel="joins"
                />
              </Panel>

              <Panel title="Tasks by status" subtitle="Current board state">
                <Breakdown
                  slices={data.tasksByStatus}
                  emptyMessage="No tasks created yet."
                />
              </Panel>
            </div>

            <Panel
              title="Busiest channels"
              subtitle="Ranked by recorded activity"
              actions={
                <span className="flex items-center gap-1.5 text-xs text-slate-400">
                  Messages this period
                  <TrendBadge trend={data.messageTrend} />
                </span>
              }
            >
              <DataTable
                columns={['Channel', 'Activity', 'Members']}
                rows={data.channelActivity.map((channel) => [
                  <span className="text-slate-100 font-medium">
                    #{channel.name}
                  </span>,
                  formatNumber(channel.messages),
                  formatNumber(channel.members),
                ])}
                emptyMessage="No channels in this workspace yet."
              />
            </Panel>
          </>
        ) : null}
      </QueryState>
    </ViewShell>
  );
}
