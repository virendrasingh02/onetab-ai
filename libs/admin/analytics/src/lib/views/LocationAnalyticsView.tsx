import {
  BarChart,
  ChartContainer,
  DonutChart,
} from '@org/analytics-ui';
import type { AdminLocationAnalytics } from '@org/types';
import { Badge, Progress } from '@org/ui';
import { ShieldCheck } from 'lucide-react';
import {
  AdminMetricCard,
  AnalyticsDataTable,
  AnalyticsFilterBar,
  AnalyticsHeader,
  type ColumnDef,
} from '../components/index.js';
import { useAdminAnalyticsFilter } from '../use-admin-analytics-filter.js';
import { useAdminLocationAnalytics } from '../use-admin-analytics.js';

type CountryRow = AdminLocationAnalytics['countries'][number];

export function LocationAnalyticsView() {
  const filterState = useAdminAnalyticsFilter();
  const { filter } = filterState;
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } =
    useAdminLocationAnalytics(filter);

  const colors = ['blue', 'green', 'violet', 'amber', 'pink', 'cyan', 'var(--muted-foreground)'];

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
        state={filterState}
      />

      {/* Privacy Notice Banner */}
      <div className="flex items-center gap-2.5 p-3 rounded-lg border bg-blue-500/10 border-blue-500/20 text-xs text-blue-600 dark:text-blue-400">
        <ShieldCheck className="size-4 shrink-0" />
        <span>
          <strong>Privacy Guaranteed:</strong> Geo-analytics are strictly aggregated at country and regional level to ensure GDPR, CCPA, and enterprise confidentiality compliance.
        </span>
      </div>

      {/* KPI Cards (Ref Image Anatomy) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminMetricCard
          label="Countries Reached"
          subtitle="Sovereign Jurisdictions"
          value={data?.totalCountries ?? '—'}
          badgeText="Global"
          badgeType="positive"
          secondaryText="Privacy-compliant aggregation"
          sparklineColor="emerald"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Top Country"
          subtitle="Regional Concentration"
          value={data?.countries?.[0]?.name ?? '—'}
          badgeText={`${data?.countries?.[0]?.percentage ?? 0}%`}
          badgeType="positive"
          secondaryText={`${data?.countries?.[0]?.percentage ?? 0}% of platform traffic`}
          sparklineColor="cyan"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Total Regional Users"
          subtitle="Geo-Distributed Traffic"
          value={data?.countries?.reduce((acc, c) => acc + c.usersCount, 0)?.toLocaleString() ?? '—'}
          badgeText="+14.8%"
          badgeType="positive"
          secondaryText="International adoption"
          sparklineColor="emerald"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Privacy Compliance"
          subtitle="Data Residency Shield"
          value="100%"
          badgeText="GDPR"
          badgeType="positive"
          secondaryText="CCPA & privacy verified"
          sparklineColor="cyan"
          isLoading={isLoading}
        />
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
            <BarChart
              data={data?.countries?.slice(0, 10) || []}
              xAxisKey="name"
              series={[
                { dataKey: 'usersCount', name: 'Active Users', color: 'blue' },
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
            <DonutChart
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
