import type { AdminAnalyticsFilter } from '@org/types';
import { Card } from '@org/ui';
import {
  Clock,
  Filter,
  Layers,
  Sparkles,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import {
  AnalyticsDonutChart,
  AnalyticsFilterBar,
  AnalyticsFunnelChart,
  AnalyticsHeader,
  ChartContainer,
} from '../components/index.js';
import { useAdminSubscriptionAnalytics } from '../use-admin-analytics.js';

export function SubscriptionAnalyticsView() {
  const [filter, setFilter] = useState<AdminAnalyticsFilter>({ range: '30d' });
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } =
    useAdminSubscriptionAnalytics(filter);

  const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'];

  const tierDonut =
    data?.planDistribution.map((t, idx) => ({
      name: t.label,
      value: t.value,
      color: colors[idx % colors.length],
    })) || [];

  const funnelStages =
    data?.funnel.map((f) => ({
      name: f.stage,
      count: f.count,
      percentage: f.conversionPct,
    })) || [];

  return (
    <div className="space-y-6 pb-12">
      <AnalyticsHeader
        title="Subscriptions & Upgrade Funnels"
        description="Conversion funnel tracking from visitor to trial to paid tiers, subscription status distribution, and churn trends."
        lastUpdated={dataUpdatedAt}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        exportType="subscriptions"
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
            <span className="text-xs text-muted-foreground font-medium">Paid Subscriptions</span>
            <Users className="size-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.paidCount?.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Free accounts: {data?.freeCount?.toLocaleString() ?? 0}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Trial Conversion</span>
            <Sparkles className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.trialConversionRatePct !== undefined ? `${data.trialConversionRatePct}%` : '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Trials active: {data?.trialCount?.toLocaleString() ?? 0}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Cancellations</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.cancellations?.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Churn rate: {data?.churnRatePct ?? 0}%
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Plan Upgrades</span>
            <Layers className="size-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.upgrades?.toLocaleString() ?? '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Downgrades: {data?.downgrades?.toLocaleString() ?? 0}
          </div>
        </Card>
      </div>

      {/* Conversion Funnel */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b">
          <Filter className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">Tier Upgrade Conversion Funnel</h2>
        </div>
        {funnelStages.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            No funnel data available for selected period.
          </p>
        ) : (
          <AnalyticsFunnelChart stages={funnelStages} />
        )}
      </Card>

      {/* Plan Distribution Donut */}
      <div>
        <ChartContainer
          title="Subscription Tiers Distribution"
          description="Active accounts by plan level"
          isLoading={isLoading}
          isError={isError}
          isEmpty={tierDonut.length === 0}
          height={320}
        >
          <AnalyticsDonutChart
            data={tierDonut}
            centerLabel="Accounts"
            centerValue={(data?.paidCount || 0) + (data?.freeCount || 0)}
            height={320}
          />
        </ChartContainer>
      </div>
    </div>
  );
}
