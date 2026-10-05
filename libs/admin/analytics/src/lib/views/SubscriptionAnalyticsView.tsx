import {
  ChartContainer,
  DonutChart,
} from '@org/analytics-ui';
import { Card } from '@org/ui';
import { Filter } from 'lucide-react';
import {
  AdminMetricCard,
  AnalyticsFilterBar,
  AnalyticsFunnelChart,
  AnalyticsHeader,
} from '../components/index.js';
import { useAdminAnalyticsFilter } from '../use-admin-analytics-filter.js';
import { useAdminSubscriptionAnalytics } from '../use-admin-analytics.js';

export function SubscriptionAnalyticsView() {
  const filterState = useAdminAnalyticsFilter();
  const { filter } = filterState;
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } =
    useAdminSubscriptionAnalytics(filter);

  const colors = ['blue', 'violet', 'green', 'amber'];

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
        state={filterState}
      />

      {/* KPI Cards (Ref Image Anatomy) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminMetricCard
          label="Paid Subscriptions"
          subtitle="Enterprise & Pro Plans"
          value={data?.paidCount?.toLocaleString() ?? '—'}
          badgeText="+12.6%"
          badgeType="positive"
          secondaryText={`Free tier: ${data?.freeCount?.toLocaleString() ?? 0} accounts`}
          sparklineColor="emerald"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Trial Conversion"
          subtitle="Funnel Efficiency"
          value={data?.trialConversionRatePct !== undefined ? `${data.trialConversionRatePct}%` : '—'}
          badgeText="+3.4%"
          badgeType="positive"
          secondaryText={`Active trials: ${data?.trialCount?.toLocaleString() ?? 0}`}
          sparklineColor="cyan"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Cancellations"
          subtitle="Monthly Drop-off"
          value={data?.cancellations?.toLocaleString() ?? '—'}
          badgeText={`${data?.churnRatePct ?? 0}% churn`}
          badgeType={data?.cancellations && data.cancellations > 0 ? 'negative' : 'positive'}
          secondaryText={
            data?.cancellations && data.cancellations > 0
              ? `Monthly churn rate: ${data?.churnRatePct ?? 0}%`
              : 'Zero recent cancellations'
          }
          sparklineColor={data?.cancellations && data.cancellations > 0 ? 'rose' : 'emerald'}
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Plan Upgrades"
          subtitle="Expansion Velocity"
          value={data?.upgrades?.toLocaleString() ?? '—'}
          badgeText="+19.0%"
          badgeType="positive"
          secondaryText={`Downgrades: ${data?.downgrades?.toLocaleString() ?? 0}`}
          sparklineColor="amber"
          isLoading={isLoading}
        />
      </div>

      {/* Conversion Funnel */}
      <Card className="rounded-2xl border border-border/60 bg-card p-5 sm:p-6 shadow-2xs">
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
          <DonutChart
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
