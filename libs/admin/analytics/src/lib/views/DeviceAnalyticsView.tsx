import type { AdminAnalyticsFilter } from '@org/types';
import { Card, Progress } from '@org/ui';
import { Globe, Laptop, Monitor, ShieldAlert } from 'lucide-react';
import { useState } from 'react';
import {
  AnalyticsDonutChart,
  AnalyticsFilterBar,
  AnalyticsHeader,
  ChartContainer,
} from '../components/index.js';
import { useAdminDeviceAnalytics } from '../use-admin-analytics.js';

export function DeviceAnalyticsView() {
  const [filter, setFilter] = useState<AdminAnalyticsFilter>({ range: '30d' });
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } =
    useAdminDeviceAnalytics(filter);

  const colors = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4', '#64748b'];

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
        filter={filter}
        onFilterChange={(newFilter) => setFilter(newFilter)}
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Distinct Devices</span>
            <Monitor className="size-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.totalDevices?.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Active: {data?.activeDevices?.toLocaleString() ?? 0}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Top OS</span>
            <Laptop className="size-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.usersByOs?.[0]?.label ?? '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {data?.usersByOs?.[0]?.percentage ?? 0}% of client devices
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Top Browser</span>
            <Globe className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.browsers?.[0]?.label ?? '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            {data?.browsers?.[0]?.percentage ?? 0}% browser share
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Outdated Builds</span>
            <ShieldAlert className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.outdatedCount ?? 0}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Devices on older versions
          </div>
        </Card>
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
          <AnalyticsDonutChart
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
          <AnalyticsDonutChart
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
