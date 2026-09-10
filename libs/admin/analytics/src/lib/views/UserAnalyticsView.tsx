import type { AdminAnalyticsFilter, AdminUserAnalytics } from '@org/types';
import { Badge, Card } from '@org/ui';
import { UserCheck, Users, UserX, Zap } from 'lucide-react';
import { useState } from 'react';
import {
  AnalyticsAreaChart,
  AnalyticsBarChart,
  AnalyticsDataTable,
  AnalyticsDonutChart,
  AnalyticsFilterBar,
  AnalyticsHeader,
  ChartContainer,
  type ColumnDef,
} from '../components/index.js';
import { useAdminUserAnalytics } from '../use-admin-analytics.js';

type TopUserItem = AdminUserAnalytics['topUsers'][number];

export function UserAnalyticsView() {
  const [filter, setFilter] = useState<AdminAnalyticsFilter>({ range: '30d' });
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } =
    useAdminUserAnalytics(filter);

  const colors = ['#10b981', '#ef4444', '#f59e0b', '#6b7280', '#3b82f6'];

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
        <Badge variant="outline" className="text-[10px]">
          {row.systemRole}
        </Badge>
      ),
    },
    {
      id: 'workspaces',
      header: 'Workspaces',
      accessorKey: 'workspacesCount',
      sortable: true,
      align: 'right',
      cell: (row) => (
        <Badge variant="secondary" className="text-xs">
          {row.workspacesCount}
        </Badge>
      ),
    },
    {
      id: 'messages',
      header: 'Messages',
      accessorKey: 'messagesCount',
      sortable: true,
      align: 'right',
      cell: (row) => (
        <span className="font-semibold">{row.messagesCount.toLocaleString()}</span>
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
        filter={filter}
        onFilterChange={(newFilter) => setFilter(newFilter)}
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Total Accounts</span>
            <Users className="size-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.totalAccounts?.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Growth: <span className="text-success font-semibold">+{data?.growthRate ?? 0}%</span>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Active Accounts</span>
            <UserCheck className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.activeAccounts?.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            DAU: {data?.dau?.toLocaleString() ?? 0} | WAU: {data?.wau?.toLocaleString() ?? 0}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">DAU / MAU Stickiness</span>
            <Zap className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.dauMauRatio ? `${data.dauMauRatio}%` : '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Retention rate: {data?.retentionRate ?? 0}%
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Pending / Suspended</span>
            <UserX className="size-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {(data?.suspendedAccounts ?? 0) + (data?.pendingAccounts ?? 0)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Needs review / moderation
          </div>
        </Card>
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
            <AnalyticsAreaChart
              data={data?.userActivitySeries || []}
              xAxisKey="date"
              series={[
                { dataKey: 'dau', name: 'DAU (Daily)', color: '#3b82f6' },
                { dataKey: 'wau', name: 'WAU (Weekly)', color: '#10b981' },
                { dataKey: 'mau', name: 'MAU (Monthly)', color: '#8b5cf6' },
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
            <AnalyticsDonutChart
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
        <AnalyticsBarChart
          data={data?.userGrowthSeries || []}
          xAxisKey="date"
          series={[
            { dataKey: 'newUsers', name: 'New Signups', color: '#06b6d4' },
            { dataKey: 'returningUsers', name: 'Returning Users', color: '#3b82f6' },
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
