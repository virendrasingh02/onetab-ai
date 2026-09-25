import {
  AreaChart,
  ChartContainer,
  DonutChart,
} from '@org/analytics-ui';
import { Card } from '@org/ui';
import { Globe, Laptop, Monitor, Sparkles } from 'lucide-react';
import {
  AnalyticsDataTable,
  AnalyticsFilterBar,
  AnalyticsHeader,
  type ColumnDef,
} from '../components/index.js';
import { useAdminAnalyticsFilter } from '../use-admin-analytics-filter.js';
import { useAdminPlatformUsageAnalytics } from '../use-admin-analytics.js';

type PlatformTableRow = {
  platform: 'Web' | 'Desktop';
  totalUsers: number;
  activeUsers: number;
  sessions: number;
  messages: number;
  files: number;
  storageBytes: number;
  avgDuration: string;
};

export function PlatformUsageView() {
  const filterState = useAdminAnalyticsFilter();
  const { filter } = filterState;
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } =
    useAdminPlatformUsageAnalytics(filter);

  const totalSessions =
    (data?.sessionsByPlatform?.web || 0) + (data?.sessionsByPlatform?.desktop || 0);

  const webPct =
    totalSessions > 0
      ? Math.round(((data?.sessionsByPlatform?.web || 0) / totalSessions) * 100)
      : 50;
  const desktopPct = 100 - webPct;

  const sessionDonut = [
    {
      name: 'Web Browser',
      value: data?.sessionsByPlatform?.web || 0,
      color: 'blue',
    },
    {
      name: 'Desktop App (Electron)',
      value: data?.sessionsByPlatform?.desktop || 0,
      color: 'violet',
    },
  ];

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  const columns: ColumnDef<PlatformTableRow>[] = [
    {
      id: 'platform',
      header: 'Platform',
      accessorKey: 'platform',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2 font-semibold">
          {row.platform === 'Desktop' ? (
            <Laptop className="size-4 text-purple-500" />
          ) : (
            <Globe className="size-4 text-blue-500" />
          )}
          <span>{row.platform} Client</span>
        </div>
      ),
    },
    {
      id: 'totalUsers',
      header: 'Total Users',
      accessorKey: 'totalUsers',
      sortable: true,
      align: 'right',
      cell: (row) => row.totalUsers.toLocaleString(),
    },
    {
      id: 'activeUsers',
      header: 'Active Users',
      accessorKey: 'activeUsers',
      sortable: true,
      align: 'right',
      cell: (row) => (
        <span className="font-semibold text-foreground">
          {row.activeUsers.toLocaleString()}
        </span>
      ),
    },
    {
      id: 'sessions',
      header: 'Sessions',
      accessorKey: 'sessions',
      sortable: true,
      align: 'right',
      cell: (row) => row.sessions.toLocaleString(),
    },
    {
      id: 'messages',
      header: 'Messages Sent',
      accessorKey: 'messages',
      sortable: true,
      align: 'right',
      cell: (row) => row.messages.toLocaleString(),
    },
    {
      id: 'storage',
      header: 'Storage Used',
      accessorKey: 'storageBytes',
      sortable: true,
      align: 'right',
      cell: (row) => formatBytes(row.storageBytes),
    },
    {
      id: 'avgDuration',
      header: 'Avg Session',
      accessorKey: 'avgDuration',
      sortable: true,
      align: 'right',
      cell: (row) => row.avgDuration,
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <AnalyticsHeader
        title="Web vs Desktop Usage"
        description="Compare user activity, sessions, messaging volume, and storage footprint across Web and Desktop (Electron)."
        lastUpdated={dataUpdatedAt}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        exportType="platform-usage"
        filter={filter}
      />

      <AnalyticsFilterBar
        state={filterState}
        showPlatformFilter={false}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Active Web Users</span>
            <Globe className="size-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.activeWebUsers?.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Total: {data?.totalWebUsers?.toLocaleString() ?? 0}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Active Desktop Users</span>
            <Laptop className="size-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.activeDesktopUsers?.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Total: {data?.totalDesktopUsers?.toLocaleString() ?? 0}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Total Sessions</span>
            <Monitor className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {totalSessions.toLocaleString()}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Web: {data?.sessionsByPlatform?.web ?? 0} | Desktop: {data?.sessionsByPlatform?.desktop ?? 0}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Desktop Share</span>
            <Sparkles className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {desktopPct}%
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Electron adoption
          </div>
        </Card>
      </div>

      {/* Visual Split */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2 text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
            <Globe className="size-3.5" />
            Web ({webPct}%)
          </span>
          <span className="flex items-center gap-1.5 text-purple-600 dark:text-purple-400">
            <Laptop className="size-3.5" />
            Desktop ({desktopPct}%)
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-purple-500/20 overflow-hidden flex">
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${webPct}%` }}
          />
          <div
            className="h-full bg-purple-500 transition-all duration-500"
            style={{ width: `${desktopPct}%` }}
          />
        </div>
      </Card>

      {/* Usage Over Time & Sessions Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartContainer
            title="Platform Sessions Over Time"
            description="Daily sessions split by Web and Desktop client"
            isLoading={isLoading}
            isError={isError}
            isEmpty={!data?.usageOverTime?.length}
            height={320}
          >
            <AreaChart
              data={data?.usageOverTime || []}
              xAxisKey="date"
              series={[
                { dataKey: 'webSessions', name: 'Web Sessions', color: 'blue' },
                { dataKey: 'desktopSessions', name: 'Desktop Sessions', color: 'violet' },
              ]}
              height={320}
              showLegend
            />
          </ChartContainer>
        </div>

        <div>
          <ChartContainer
            title="Session Ratio"
            description="Proportion of sessions by environment"
            isLoading={isLoading}
            isError={isError}
            isEmpty={totalSessions === 0}
            height={320}
          >
            <DonutChart
              data={sessionDonut}
              centerLabel="Sessions"
              centerValue={totalSessions}
              height={320}
            />
          </ChartContainer>
        </div>
      </div>

      {/* Platforms Comparison Table */}
      <div>
        <AnalyticsDataTable
          title="Platform Breakdown"
          data={(data?.platformsTable || []) as PlatformTableRow[]}
          columns={columns as ColumnDef<PlatformTableRow>[]}
          isLoading={isLoading}
          searchable={false}
          emptyMessage="No platform telemetry found."
        />
      </div>
    </div>
  );
}
