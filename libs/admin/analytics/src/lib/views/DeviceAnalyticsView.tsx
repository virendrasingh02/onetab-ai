import {
  ChartContainer,
  DonutChart,
} from '@org/analytics-ui';
import { Card, Progress } from '@org/ui';
import {
  AdminMetricCard,
  AnalyticsFilterBar,
  AnalyticsHeader,
} from '../components/index.js';
import { useAdminAnalyticsFilter } from '../use-admin-analytics-filter.js';
import { useAdminDeviceAnalytics } from '../use-admin-analytics.js';

export function DeviceAnalyticsView() {
  const filterState = useAdminAnalyticsFilter();
  const { filter } = filterState;
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } =
    useAdminDeviceAnalytics(filter);

  const colors = ['blue', 'green', 'violet', 'amber', 'pink', 'cyan', 'var(--muted-foreground)'];

  const osDonut =
    data?.usersByOs.map((o, idx) => ({
      name: o.label,
      value: o.value,
      color: colors[idx % colors.length],
    })) || [];

  const browserDonut =
    data?.browsers.map((b, idx) => ({
      name: b.label,
      value: b.value,
      color: colors[(idx + 2) % colors.length],
    })) || [];

  return (
    <div className="space-y-6 pb-12">
      <AnalyticsHeader
        title="Device & Operating System Intelligence"
        description="Comprehensive audit of client form factors, operating systems, web browsers, and client application builds."
        lastUpdated={dataUpdatedAt}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        exportType="devices"
        filter={filter}
      />

      <AnalyticsFilterBar
        state={filterState}
      />

      {/* KPI Cards (Ref Image Anatomy) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminMetricCard
          label="Distinct Devices"
          subtitle="Hardware Fingerprints"
          value={data?.totalDevices?.toLocaleString() ?? '—'}
          badgeText="+13.4%"
          badgeType="positive"
          secondaryText={`Active: ${data?.activeDevices?.toLocaleString() ?? 0} devices`}
          sparklineColor="emerald"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Primary Platform"
          subtitle="Operating System Leader"
          value={data?.usersByOs?.[0]?.label ?? '—'}
          badgeText={`${data?.usersByOs?.[0]?.percentage ?? 0}%`}
          badgeType="positive"
          secondaryText={`${data?.usersByOs?.[0]?.percentage ?? 0}% of client devices`}
          sparklineColor="cyan"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Top Browser"
          subtitle="Web Engine Distribution"
          value={data?.browsers?.[0]?.label ?? '—'}
          badgeText={`${data?.browsers?.[0]?.percentage ?? 0}%`}
          badgeType="positive"
          secondaryText={`${data?.browsers?.[0]?.percentage ?? 0}% browser share`}
          sparklineColor="amber"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Outdated Builds"
          subtitle="Client Patch Status"
          value={data?.outdatedCount ?? 0}
          badgeText={data?.outdatedCount && data.outdatedCount > 0 ? 'Update' : 'Current'}
          badgeType={data?.outdatedCount && data.outdatedCount > 0 ? 'negative' : 'positive'}
          secondaryText={
            data?.outdatedCount && data.outdatedCount > 0
              ? 'Requires auto-updater sync'
              : 'All devices on latest version'
          }
          sparklineColor={data?.outdatedCount && data.outdatedCount > 0 ? 'rose' : 'emerald'}
          isLoading={isLoading}
        />
      </div>

      {/* Distribution Donut Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ChartContainer
          title="Operating System Distribution"
          description="Users by operating system platform"
          isLoading={isLoading}
          isError={isError}
          isEmpty={osDonut.length === 0}
          height={300}
        >
          <DonutChart
            data={osDonut}
            centerLabel="Users"
            centerValue={data?.totalDevices}
            height={300}
          />
        </ChartContainer>

        <ChartContainer
          title="Browser Distribution"
          description="Client web browser breakdown"
          isLoading={isLoading}
          isError={isError}
          isEmpty={browserDonut.length === 0}
          height={300}
        >
          <DonutChart
            data={browserDonut}
            centerLabel="Browsers"
            centerValue={data?.totalDevices}
            height={300}
          />
        </ChartContainer>
      </div>

      {/* Desktop App Versions */}
      <Card className="p-4">
        <h3 className="text-sm font-semibold mb-3 pb-2 border-b">
          Client App Releases in Use
        </h3>
        <div className="space-y-3">
          {(!data?.appVersions || data.appVersions.length === 0) ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No client version telemetry recorded.
            </p>
          ) : (
            data.appVersions.map((v) => (
              <div key={v.version} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold flex items-center gap-1.5">
                    {v.version}
                    {v.isLatest && (
                      <span className="text-[10px] text-success font-medium">(Latest)</span>
                    )}
                    {v.isOutdated && (
                      <span className="text-[10px] text-destructive font-medium">(Outdated)</span>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {v.count} devices
                  </span>
                </div>
                <Progress
                  value={Math.min((v.count / (data.totalDevices || 1)) * 100, 100)}
                  className="h-1.5"
                />
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
