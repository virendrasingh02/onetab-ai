import type { AdminAnalyticsFilter } from '@org/types';
import { Card, Progress } from '@org/ui';
import {
  Activity,
  Building2,
  Clock,
  Users,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import {
  AnalyticsBarChart,
  AnalyticsFilterBar,
  AnalyticsHeader,
  ChartContainer,
} from '../components/index.js';
import { useAdminEngagementAnalytics } from '../use-admin-analytics.js';

export function EngagementAnalyticsView() {
  const [filter, setFilter] = useState<AdminAnalyticsFilter>({ range: '30d' });
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } =
    useAdminEngagementAnalytics(filter);

  const adoptionData =
    data?.featureUsage.map((f) => ({
      feature: f.feature,
      percentage: f.adoptionRate,
      usageCount: f.usageCount,
    })) || [];

  return (
    <div className="space-y-6 pb-12">
      <AnalyticsHeader
        title="Feature Engagement & Stickiness"
        description="Platform feature adoption, user stickiness (DAU/MAU), session durations, and most engaged workspaces."
        lastUpdated={dataUpdatedAt}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        exportType="engagement"
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
            <span className="text-xs text-muted-foreground font-medium">DAU / MAU Stickiness</span>
            <Zap className="size-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.stickiness !== undefined ? `${data.stickiness}%` : '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Daily engagement ratio
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Total Sessions</span>
            <Activity className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.totalSessions?.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Active app sessions
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Avg Session Time</span>
            <Clock className="size-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.avgSessionDurationSeconds
              ? `${Math.round(data.avgSessionDurationSeconds / 60)} min`
              : '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Session length
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Monthly Active (MAU)</span>
            <Users className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.mau?.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            DAU: {data?.dau?.toLocaleString() ?? 0} | WAU: {data?.wau?.toLocaleString() ?? 0}
          </div>
        </Card>
      </div>

      {/* Feature Adoption Bar Chart */}
      <ChartContainer
        title="Core Feature Adoption"
        description="Percentage of active users leveraging key platform features"
        isLoading={isLoading}
        isError={isError}
        isEmpty={adoptionData.length === 0}
        height={300}
      >
        <AnalyticsBarChart
          data={adoptionData}
          xAxisKey="feature"
          series={[
            { dataKey: 'percentage', name: 'Adoption %', color: '#3b82f6' },
          ]}
          valueFormatter={(val) => `${val}%`}
          height={300}
        />
      </ChartContainer>

      {/* Most Active Workspaces & Users */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <div className="flex items-center justify-between pb-3 border-b mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="size-4 text-purple-500" />
              Most Active Workspaces
            </h3>
            <span className="text-xs text-muted-foreground">Activity Score</span>
          </div>
          <div className="space-y-3">
            {(!data?.mostActiveWorkspaces || data.mostActiveWorkspaces.length === 0) ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No active workspace records.
              </p>
            ) : (
              data.mostActiveWorkspaces.map((item) => (
                <div key={item.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold">{item.name}</span>
                    <span className="text-muted-foreground">
                      Score: {item.activityScore}
                    </span>
                  </div>
                  <Progress value={Math.min(item.activityScore, 100)} className="h-1.5" />
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between pb-3 border-b mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Users className="size-4 text-blue-500" />
              Most Active Users
            </h3>
            <span className="text-xs text-muted-foreground">Activity Score</span>
          </div>
          <div className="space-y-3">
            {(!data?.mostActiveUsers || data.mostActiveUsers.length === 0) ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No active user records.
              </p>
            ) : (
              data.mostActiveUsers.map((user) => (
                <div key={user.id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold">{user.name || user.email}</span>
                    <span className="text-muted-foreground">
                      Score: {user.activityScore}
                    </span>
                  </div>
                  <Progress value={Math.min(user.activityScore, 100)} className="h-1.5" />
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
