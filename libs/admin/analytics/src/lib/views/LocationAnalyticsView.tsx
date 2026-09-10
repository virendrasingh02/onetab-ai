import type { AdminAnalyticsFilter, AdminLocationAnalytics } from '@org/types';
import { Badge, Card, Progress } from '@org/ui';
import { Globe, MapPin, ShieldCheck, Users } from 'lucide-react';
import { useState } from 'react';
import {
  AnalyticsBarChart,
  AnalyticsDataTable,
  AnalyticsDonutChart,
  AnalyticsFilterBar,
  AnalyticsHeader,
  ChartContainer,
  type ColumnDef,
} from '../components/index.js';
import { useAdminLocationAnalytics } from '../use-admin-analytics.js';

type CountryRow = AdminLocationAnalytics['countries'][number];

export function LocationAnalyticsView() {
  const [filter, setFilter] = useState<AdminAnalyticsFilter>({ range: '30d' });
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } =
    useAdminLocationAnalytics(filter);

  const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#64748b'];

  const countryDonut =
    data?.countries.slice(0, 6).map((c, idx) => ({
      name: c.name,
      value: c.usersCount,
      color: colors[idx % colors.length],
    })) || [];

  const columns: ColumnDef<CountryRow>[] = [
    {
      id: 'country',
      header: 'Country',
      accessorKey: 'name',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
            {row.code}
          </Badge>
          <span className="font-semibold text-foreground">{row.name}</span>
        </div>
      ),
    },
    {
      id: 'users',
      header: 'Active Users',
      accessorKey: 'usersCount',
      sortable: true,
      align: 'right',
      cell: (row) => row.usersCount.toLocaleString(),
    },
    {
      id: 'workspaces',
      header: 'Workspaces',
      accessorKey: 'workspacesCount',
      sortable: true,
      align: 'right',
      cell: (row) => row.workspacesCount.toLocaleString(),
    },
    {
      id: 'share',
      header: 'Traffic Share',
      accessorKey: 'percentage',
      sortable: true,
      align: 'right',
      cell: (row) => (
        <div className="flex items-center justify-end gap-2">
          <Progress value={row.percentage} className="w-16 h-1.5" />
          <span className="text-xs text-muted-foreground w-10 text-right">
            {row.percentage}%
          </span>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 pb-12">
      <AnalyticsHeader
        title="Geographic & Regional Distribution"
        description="Privacy-compliant geographic aggregation by jurisdiction and region (no granular GPS/IP addresses stored)."
        lastUpdated={dataUpdatedAt}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        exportType="locations"
        filter={filter}
      />

      <AnalyticsFilterBar
        filter={filter}
        onFilterChange={(newFilter) => setFilter(newFilter)}
      />

      {/* Privacy Notice Banner */}
      <div className="flex items-center gap-2.5 p-3 rounded-lg border bg-blue-500/10 border-blue-500/20 text-xs text-blue-600 dark:text-blue-400">
        <ShieldCheck className="size-4 shrink-0" />
        <span>
          <strong>Privacy Guaranteed:</strong> Geo-analytics are strictly aggregated at country and regional level to ensure GDPR, CCPA, and enterprise confidentiality compliance.
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Countries Reached</span>
            <Globe className="size-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.totalCountries ?? '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Global geographic footprint
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Top Country</span>
            <MapPin className="size-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold mt-2 truncate">
            {data?.countries?.[0]?.name ?? '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {data?.countries?.[0]?.percentage ?? 0}% of platform traffic
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Total Regional Users</span>
            <Users className="size-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.countries?.reduce((acc, c) => acc + c.usersCount, 0)?.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Active in selected period
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Privacy Status</span>
            <ShieldCheck className="size-4 text-success" />
          </div>
          <div className="text-xl font-bold mt-2 text-success">
            Compliant
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Zero raw coordinates stored
          </div>
        </Card>
      </div>

      {/* Country Distribution Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartContainer
            title="Top Countries by Traffic"
            description="Active users by country"
            isLoading={isLoading}
            isError={isError}
            isEmpty={!data?.countries?.length}
            height={320}
          >
            <AnalyticsBarChart
              data={data?.countries?.slice(0, 10) || []}
              xAxisKey="name"
              series={[
                { dataKey: 'usersCount', name: 'Active Users', color: '#3b82f6' },
              ]}
              height={320}
            />
          </ChartContainer>
        </div>

        <div>
          <ChartContainer
            title="Geographic Share"
            description="Top 6 national jurisdictions"
            isLoading={isLoading}
            isError={isError}
            isEmpty={countryDonut.length === 0}
            height={320}
          >
            <AnalyticsDonutChart
              data={countryDonut}
              centerLabel="Jurisdictions"
              centerValue={data?.totalCountries}
              height={320}
            />
          </ChartContainer>
        </div>
      </div>

      {/* Countries Table */}
      <div>
        <AnalyticsDataTable
          title="All Regional Jurisdictions"
          data={(data?.countries || []) as CountryRow[]}
          columns={columns as ColumnDef<CountryRow>[]}
          isLoading={isLoading}
          searchKey="name"
          searchPlaceholder="Search country..."
          emptyMessage="No country traffic recorded."
        />
      </div>
    </div>
  );
}
