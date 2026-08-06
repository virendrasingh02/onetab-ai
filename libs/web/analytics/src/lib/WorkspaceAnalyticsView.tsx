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
} from '@org/analytics-ui';
import { useWorkspaceAnalytics } from './use-analytics.js';

/** Workspace-level composition: what exists, where it lives, who is active. */
export function WorkspaceAnalyticsView() {
  const [days, setDays] = useState(30);
  const query = useWorkspaceAnalytics(days);
  const data = query.data;

  return (
    <ViewShell>
      <ViewHeader
        icon={<Building2 />}
        accent="blue"
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
            <div className="md:grid-cols-4 xl:grid-cols-8 gap-4 mb-6 grid grid-cols-2">
              <MetricCard
                label="Members"
                value={data.totalMembers}
                icon={Users}
                accent="blue"
              />
              <MetricCard
                label={`Active · ${days}d`}
                value={data.activeMembers}
                icon={UserCheck}
                accent="green"
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
                accent="violet"
              />
              <MetricCard
                label="Messages"
                value={data.totalMessages}
                icon={MessageSquare}
                accent="cyan"
                trend={data.messageTrend}
              />
              <MetricCard
                label="Tasks"
                value={data.totalTasks}
                icon={CheckSquare}
                accent="amber"
              />
              <MetricCard
                label="Projects"
                value={data.totalProjects}
                icon={FolderKanban}
                accent="indigo"
              />
              <MetricCard
                label="Documents"
                value={data.totalDocs}
                icon={FileText}
                accent="pink"
              />
              <MetricCard
                label="Files"
                value={data.totalUploads}
                icon={FileText}
                accent="orange"
              />
            </div>

            <div className="lg:grid-cols-3 gap-6 mb-6 grid grid-cols-1">
              <Panel
                title={`New members · last ${days} days`}
                subtitle="Joins per day"
                className="lg:col-span-2"
              >
                <BarChart
                  series={data.memberGrowth}
                  accent="green"
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
                <span className="gap-1.5 text-xs flex items-center text-muted-foreground">
                  Messages this period
                  <TrendBadge trend={data.messageTrend} />
                </span>
              }
            >
              <DataTable
                columns={['Channel', 'Activity', 'Members']}
                rows={data.channelActivity.map((channel) => [
                  <span className="font-medium text-foreground">
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
