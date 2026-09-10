import type { AdminAnalyticsFilter } from '@org/types';
import { Card } from '@org/ui';
import {
  Building2,
  HardDrive,
  Laptop,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AnalyticsAreaChart,
  AnalyticsDonutChart,
  AnalyticsFilterBar,
  AnalyticsHeader,
  ChartContainer,
  ExecutiveKpiGrid,
  LiveActivityFeed,
} from '../components/index.js';
import { useAdminLiveActivity, useAdminOverviewAnalytics } from '../use-admin-analytics.js';

export function OverviewDashboardView() {
  const [filter, setFilter] = useState<AdminAnalyticsFilter>({ range: '30d' });
  const [isLive, setIsLive] = useState(false);

  const {
    data: overview,
    isLoading,
    isError,
    refetch,
    isFetching,
    dataUpdatedAt,
  } = useAdminOverviewAnalytics(filter, isLive);

  const { data: liveFeed, isLoading: liveLoading } = useAdminLiveActivity(true);

  const platformDonutData = overview?.platformSplit
    ? [
        {
          name: 'Web Browser',
          value: overview.platformSplit.web,
          color: '#3b82f6',
        },
        {
          name: 'Desktop App',
          value: overview.platformSplit.desktop,
          color: '#8b5cf6',
        },
      ]
    : [];

  // Combine top platform KPIs
  const combinedKpis = overview
    ? {
        ...(overview.platformKpis || {}),
        ...(overview.revenueKpis || {}),
      }
    : undefined;

  return (
    <div className="space-y-6 pb-12">
      <AnalyticsHeader
        title="Platform Intelligence & Analytics"
        description="Comprehensive real-time overview of platform usage, accounts, workspaces, revenue, and system health."
        lastUpdated={dataUpdatedAt}
        isLive={isLive}
        onToggleLive={() => setIsLive((prev) => !prev)}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        exportType="overview"
        filter={filter}
      />

      <AnalyticsFilterBar
        filter={filter}
        onFilterChange={(newFilter) => setFilter(newFilter)}
      />

      {/* Executive KPI Grid */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold tracking-tight text-muted-foreground uppercase">
          Platform KPIs
        </h2>
        <ExecutiveKpiGrid kpis={combinedKpis} isLoading={isLoading} />
      </section>

      {/* Quick Access Domain Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link to="/analytics/users" className="block no-underline">
          <Card className="hover:border-primary/50 transition-colors p-3.5 flex items-center gap-3">
            <div className="size-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <Users className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold">Users</div>
              <div className="text-[11px] text-muted-foreground truncate">
                Growth, DAU/WAU/MAU
              </div>
            </div>
          </Card>
        </Link>
        <Link to="/analytics/workspaces" className="block no-underline">
          <Card className="hover:border-primary/50 transition-colors p-3.5 flex items-center gap-3">
            <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <Building2 className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold">Workspaces</div>
              <div className="text-[11px] text-muted-foreground truncate">
                Tiers, health, storage
              </div>
            </div>
          </Card>
        </Link>
        <Link to="/analytics/platform-usage" className="block no-underline">
          <Card className="hover:border-primary/50 transition-colors p-3.5 flex items-center gap-3">
            <div className="size-8 rounded-lg bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
              <Laptop className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold">Platform Usage</div>
              <div className="text-[11px] text-muted-foreground truncate">
                Web vs Desktop
              </div>
            </div>
          </Card>
        </Link>
        <Link to="/analytics/revenue" className="block no-underline">
          <Card className="hover:border-primary/50 transition-colors p-3.5 flex items-center gap-3">
            <div className="size-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <HardDrive className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold">Revenue & Billing</div>
              <div className="text-[11px] text-muted-foreground truncate">
                MRR, ARR, plans
              </div>
            </div>
          </Card>
        </Link>
      </div>

      {/* Primary Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartContainer
            title="User Registrations Over Time"
            description="New account signups across selected date range"
            isLoading={isLoading}
            isError={isError}
            isEmpty={!overview?.userGrowthSeries?.length}
            height={320}
          >
            <AnalyticsAreaChart
              data={overview?.userGrowthSeries || []}
              xAxisKey="date"
              series={[
                {
                  dataKey: 'value',
                  name: 'New Users',
                  color: '#3b82f6',
                },
              ]}
              height={320}
              showLegend
            />
          </ChartContainer>
        </div>

        <div>
          <ChartContainer
            title="Platform Distribution"
            description="Active sessions by client environment"
            isLoading={isLoading}
            isError={isError}
            isEmpty={platformDonutData.length === 0}
            height={320}
          >
            <AnalyticsDonutChart
              data={platformDonutData}
              centerLabel="Clients"
              centerValue={
                (overview?.platformSplit?.web || 0) +
                (overview?.platformSplit?.desktop || 0)
              }
              height={320}
            />
          </ChartContainer>
        </div>
      </div>

      {/* Secondary Row: Platform Activity & Live Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartContainer
            title="Platform Activity Volume"
            description="Total active sessions and actions over time"
            isLoading={isLoading}
            isError={isError}
            isEmpty={!overview?.activitySeries?.length}
            height={300}
          >
            <AnalyticsAreaChart
              data={overview?.activitySeries || []}
              xAxisKey="date"
              series={[
                {
                  dataKey: 'value',
                  name: 'Events / Actions',
                  color: '#8b5cf6',
                },
              ]}
              height={300}
              showLegend
            />
          </ChartContainer>
        </div>

        <div>
          <LiveActivityFeed
            items={liveFeed || overview?.recentEvents}
            isLoading={liveLoading && isLoading}
            maxItems={8}
            showViewAll
          />
        </div>
      </div>
    </div>
  );
}
