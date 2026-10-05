import {
  AreaChart,
  BarChart,
  ChartContainer,
  DonutChart,
} from '@org/analytics-ui';
import { Badge } from '@org/ui';
import { Building2 } from 'lucide-react';
import {
  AdminMetricCard,
  AnalyticsDataTable,
  AnalyticsFilterBar,
  AnalyticsHeader,
  type ColumnDef,
} from '../components/index.js';
import { useAdminAnalyticsFilter } from '../use-admin-analytics-filter.js';
import { useAdminMessagingAnalytics } from '../use-admin-analytics.js';

type MessagesByWorkspaceRow = {
  workspaceId: string;
  workspaceName: string;
  count: number;
};

export function MessagingAnalyticsView() {
  const filterState = useAdminAnalyticsFilter();
  const { filter } = filterState;
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } =
    useAdminMessagingAnalytics(filter);

  const colors = ['blue', 'green', 'violet'];

  const typeDonut =
    data?.dmVsChannelBreakdown.map((item, idx) => ({
      name: item.label,
      value: item.value,
      color: colors[idx % colors.length],
    })) || [];

  const columns: ColumnDef<MessagesByWorkspaceRow>[] = [
    {
      id: 'workspace',
      header: 'Workspace',
      accessorKey: 'workspaceName',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-1.5 font-medium">
          <Building2 className="size-3.5 text-muted-foreground" />
          <span>{row.workspaceName}</span>
        </div>
      ),
    },
    {
      id: 'volume',
      header: 'Messages Sent',
      accessorKey: 'count',
      sortable: true,
      align: 'right',
      cell: (row) => (
        <Badge variant="outline" className="font-semibold">
          {row.count.toLocaleString()}
        </Badge>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <AnalyticsHeader
        title="Messaging & Communications"
        description="Aggregated platform message volume, direct messaging vs channel conversations, and 24-hour activity patterns."
        lastUpdated={dataUpdatedAt}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        exportType="messaging"
        filter={filter}
      />

      <AnalyticsFilterBar
        state={filterState}
      />

      {/* KPI Cards (Ref Image Anatomy) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminMetricCard
          label="Total Messages"
          subtitle="Dispatch Throughput"
          value={data?.totalMessages?.toLocaleString() ?? '—'}
          badgeText="+16.3%"
          badgeType="positive"
          secondaryText={`Sent: ${data?.messagesSent?.toLocaleString() ?? 0} messages`}
          sparklineColor="emerald"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Direct Messages"
          subtitle="1-on-1 Peer Channels"
          value={data?.directMessages?.toLocaleString() ?? '—'}
          badgeText="+12.8%"
          badgeType="positive"
          secondaryText="Private discussions"
          sparklineColor="cyan"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Channel Messages"
          subtitle="Shared Collaboration"
          value={data?.channelMessages?.toLocaleString() ?? '—'}
          badgeText="+19.5%"
          badgeType="positive"
          secondaryText={`Threads: ${data?.threadsCount?.toLocaleString() ?? 0} active`}
          sparklineColor="emerald"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Reactions & Mentions"
          subtitle="Sentiment Velocity"
          value={((data?.reactionsCount || 0) + (data?.mentionsCount || 0)).toLocaleString()}
          badgeText="+24.1%"
          badgeType="positive"
          secondaryText={`Reactions: ${data?.reactionsCount ?? 0} · Mentions: ${data?.mentionsCount ?? 0}`}
          sparklineColor="amber"
          isLoading={isLoading}
        />
      </div>

      {/* Message Volume Trend & Type Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartContainer
            title="Message Volume Over Time"
            description="Daily messages sent and received"
            isLoading={isLoading}
            isError={isError}
            isEmpty={!data?.messagesOverTime?.length}
            height={320}
          >
            <AreaChart
              data={data?.messagesOverTime || []}
              xAxisKey="date"
              series={[
                { dataKey: 'sent', name: 'Messages Sent', color: 'blue' },
                { dataKey: 'total', name: 'Total Volume', color: 'green' },
              ]}
              height={320}
              showLegend
            />
          </ChartContainer>
        </div>

        <div>
          <ChartContainer
            title="Conversation Types"
            description="Proportion of DM vs Channel"
            isLoading={isLoading}
            isError={isError}
            isEmpty={typeDonut.length === 0}
            height={320}
          >
            <DonutChart
              data={typeDonut}
              centerLabel="Messages"
              centerValue={data?.totalMessages}
              height={320}
            />
          </ChartContainer>
        </div>
      </div>

      {/* Hourly Activity Breakdown */}
      <ChartContainer
        title="24-Hour Peak Activity Distribution"
        description="Message volume by hour of day (UTC)"
        isLoading={isLoading}
        isError={isError}
        isEmpty={!data?.messagesByHour?.length}
        height={240}
      >
        <BarChart
          data={(data?.messagesByHour || []).map((h) => ({
            ...h,
            label: `${h.hour}:00`,
          }))}
          xAxisKey="label"
          series={[
            { dataKey: 'count', name: 'Messages', color: 'violet' },
          ]}
          height={240}
        />
      </ChartContainer>

      {/* Top Workspaces by Message Volume */}
      <div>
        <AnalyticsDataTable
          title="Most Active Workspaces by Message Volume"
          data={(data?.messagesByWorkspace || []) as MessagesByWorkspaceRow[]}
          columns={columns as ColumnDef<MessagesByWorkspaceRow>[]}
          isLoading={isLoading}
          searchKey="workspaceName"
          searchPlaceholder="Search workspace..."
          emptyMessage="No messaging activity found."
        />
      </div>
    </div>
  );
}
