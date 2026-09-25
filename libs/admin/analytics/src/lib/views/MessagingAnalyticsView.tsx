import {
  AreaChart,
  BarChart,
  ChartContainer,
  DonutChart,
} from '@org/analytics-ui';
import { Badge, Card } from '@org/ui';
import { Building2, MessageSquare, MessagesSquare, Send, Smile } from 'lucide-react';
import {
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

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Total Messages</span>
            <MessageSquare className="size-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.totalMessages?.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Sent: {data?.messagesSent?.toLocaleString() ?? 0}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Direct Messages</span>
            <Send className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.directMessages?.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            1-on-1 conversations
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Channel Messages</span>
            <MessagesSquare className="size-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.channelMessages?.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Threads: {data?.threadsCount?.toLocaleString() ?? 0}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Reactions & Mentions</span>
            <Smile className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {((data?.reactionsCount || 0) + (data?.mentionsCount || 0)).toLocaleString()}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Reactions: {data?.reactionsCount ?? 0} | Mentions: {data?.mentionsCount ?? 0}
          </div>
        </Card>
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
