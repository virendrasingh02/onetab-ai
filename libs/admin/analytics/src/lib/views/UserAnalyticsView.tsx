import {
  AreaChart,
  BarChart,
  ChartContainer,
  DonutChart,
} from '@org/analytics-ui';
import type { AdminUserAnalytics } from '@org/types';
import {
  AdminMetricCard,
  AnalyticsDataTable,
  AnalyticsFilterBar,
  AnalyticsHeader,
  type ColumnDef,
} from '../components/index.js';
import { useAdminAnalyticsFilter } from '../use-admin-analytics-filter.js';
import { useAdminUserAnalytics } from '../use-admin-analytics.js';

type TopUserItem = AdminUserAnalytics['topUsers'][number];

export function UserAnalyticsView() {
  const filterState = useAdminAnalyticsFilter();
  const { filter } = filterState;
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } =
    useAdminUserAnalytics(filter);

  const colors = ['green', 'var(--destructive)', 'amber', 'var(--muted-foreground)', 'blue'];

  const statusDonutData =
    data?.statusBreakdown.map((s, idx) => ({
      name: s.label,
      value: s.value,
      color: colors[idx % colors.length],
    })) || [];

  const columns: ColumnDef<TopUserItem>[] = [
    {
      id: 'user',
      header: 'User',
      accessorKey: 'email',
      sortable: true,
      cell: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-foreground truncate max-w-[200px]">
            {row.name || row.email}
          </span>
          {row.name && (
            <span className="text-[11px] text-muted-foreground truncate max-w-[200px]">
              {row.email}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'role',
      header: 'System Role',
      accessorKey: 'systemRole',
      sortable: true,
      cell: (row) => (
        <span className="inline-flex items-center rounded-full border border-border/80 bg-muted/60 px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase text-foreground">
          {row.systemRole}
        </span>
      ),
    },
    {
      id: 'workspaces',
      header: 'Workspaces',
      accessorKey: 'workspacesCount',
      sortable: true,
      align: 'right',
      cell: (row) => (
        <span className="font-medium text-foreground tabular-nums">
          {row.workspacesCount}
        </span>
      ),
    },
    {
      id: 'messages',
      header: 'Messages',
      accessorKey: 'messagesCount',
      sortable: true,
      align: 'right',
      cell: (row) => (
        <span className="font-semibold text-foreground tabular-nums">
          {row.messagesCount.toLocaleString()}
        </span>
      ),
    },
    {
      id: 'lastSeen',
      header: 'Last Seen',
      accessorKey: 'lastSeenAt',
      sortable: true,
      align: 'right',
      cell: (row) => (
        <span className="text-muted-foreground text-[11px]">
          {row.lastSeenAt
            ? new Date(row.lastSeenAt).toLocaleDateString()
            : 'Never'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <AnalyticsHeader
        title="User Analytics & Growth"
        description="Monitor user acquisition, active user ratios (DAU/MAU stickiness), account status, and top contributors."
        lastUpdated={dataUpdatedAt}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        exportType="users"
        filter={filter}
      />

      <AnalyticsFilterBar
        state={filterState}
      />

      {/* Summary KPI Cards (Ref Image Anatomy) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminMetricCard
          label="Total Accounts"
          subtitle="Directory Registry"
          value={data?.totalAccounts?.toLocaleString() ?? '—'}
          badgeText={`+${data?.growthRate ?? 0}%`}
          badgeType="positive"
          secondaryText="Strong user acquisition"
          sparklineColor="emerald"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Active Accounts"
          subtitle="Platform Concurrency"
          value={data?.activeAccounts?.toLocaleString() ?? '—'}
          badgeText="+12.5%"
          badgeType="positive"
          secondaryText={`DAU: ${data?.dau?.toLocaleString() ?? 0} | WAU: ${data?.wau?.toLocaleString() ?? 0}`}
          sparklineColor="cyan"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="DAU / MAU Stickiness"
          subtitle="Cohort Stickiness Index"
          value={data?.dauMauRatio ? `${data.dauMauRatio}%` : '—'}
          badgeText={`+${data?.retentionRate ?? 0}%`}
          badgeType="positive"
          secondaryText={`Retention rate: ${data?.retentionRate ?? 0}%`}
          sparklineColor="emerald"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Pending / Suspended"
          subtitle="Compliance & Risk Holds"
          value={(data?.suspendedAccounts ?? 0) + (data?.pendingAccounts ?? 0)}
          badgeText={`${(data?.suspendedAccounts ?? 0) + (data?.pendingAccounts ?? 0)} req`}
          badgeType={
            (data?.suspendedAccounts ?? 0) + (data?.pendingAccounts ?? 0) > 0
              ? 'negative'
              : 'neutral'
          }
          secondaryText={
            (data?.suspendedAccounts ?? 0) + (data?.pendingAccounts ?? 0) > 0
              ? 'Down 20% this period'
              : 'All accounts in compliance'
          }
          sparklineColor={
            (data?.suspendedAccounts ?? 0) + (data?.pendingAccounts ?? 0) > 0
              ? 'rose'
              : 'blue'
          }
          isLoading={isLoading}
        />
      </div>

      {/* User Activity Trends (DAU / WAU / MAU) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartContainer
            title="Active Users Over Time (DAU / WAU / MAU)"
            description="Daily, weekly, and monthly active user trends"
            isLoading={isLoading}
            isError={isError}
            isEmpty={!data?.userActivitySeries?.length}
            height={320}
          >
            <AreaChart
              data={data?.userActivitySeries || []}
              xAxisKey="date"
              series={[
                { dataKey: 'dau', name: 'DAU (Daily)', color: 'blue' },
                { dataKey: 'wau', name: 'WAU (Weekly)', color: 'green' },
                { dataKey: 'mau', name: 'MAU (Monthly)', color: 'violet' },
              ]}
              height={320}
              showLegend
            />
          </ChartContainer>
        </div>

        <div>
          <ChartContainer
            title="Account Status Distribution"
            description="Active, pending, and suspended users"
            isLoading={isLoading}
            isError={isError}
            isEmpty={statusDonutData.length === 0}
            height={320}
          >
            <DonutChart
              data={statusDonutData}
              centerLabel="Accounts"
              centerValue={data?.totalAccounts}
              height={320}
            />
          </ChartContainer>
        </div>
      </div>

      {/* New Signups Bar Chart */}
      <ChartContainer
        title="New vs Returning User Growth"
        description="Daily acquisition and returning users"
        isLoading={isLoading}
        isError={isError}
        isEmpty={!data?.userGrowthSeries?.length}
        height={260}
      >
        <BarChart
          data={data?.userGrowthSeries || []}
          xAxisKey="date"
          series={[
            { dataKey: 'newUsers', name: 'New Signups', color: 'cyan' },
            { dataKey: 'returningUsers', name: 'Returning Users', color: 'blue' },
          ]}
          height={260}
          showLegend
        />
      </ChartContainer>

      {/* Top Active Users Table */}
      <div>
        <AnalyticsDataTable
          title="Most Active Users"
          data={(data?.topUsers || []) as TopUserItem[]}
          columns={columns as ColumnDef<TopUserItem>[]}
          isLoading={isLoading}
          searchKey="email"
          searchPlaceholder="Search users by email..."
          emptyMessage="No user activity found."
        />
      </div>
    </div>
  );
}
