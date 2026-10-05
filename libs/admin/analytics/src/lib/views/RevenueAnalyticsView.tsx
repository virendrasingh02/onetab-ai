import {
  AreaChart,
  ChartContainer,
  DonutChart,
} from '@org/analytics-ui';
import { Card, Progress } from '@org/ui';
import { ShieldCheck } from 'lucide-react';
import {
  AdminMetricCard,
  AnalyticsFilterBar,
  AnalyticsHeader,
} from '../components/index.js';
import { useAdminAnalyticsFilter } from '../use-admin-analytics-filter.js';
import { useAdminRevenueAnalytics } from '../use-admin-analytics.js';

export function RevenueAnalyticsView() {
  const filterState = useAdminAnalyticsFilter();
  const { filter } = filterState;
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } =
    useAdminRevenueAnalytics(filter);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);

  const colors = ['blue', 'violet', 'green', 'amber'];

  const planDonut =
    data?.revenueByPlan.map((p, idx) => ({
      name: p.label,
      value: p.value,
      color: colors[idx % colors.length],
    })) || [];

  return (
    <div className="space-y-6 pb-12">
      <AnalyticsHeader
        title="Revenue & Financial Health"
        description="Executive financial tracking: Monthly Recurring Revenue (MRR), Annual Recurring Revenue (ARR), plan distribution, and billing health."
        lastUpdated={dataUpdatedAt}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
        exportType="revenue"
        filter={filter}
      />

      <AnalyticsFilterBar
        state={filterState}
      />

      {/* Security notice */}
      <div className="flex items-center gap-2.5 p-3 rounded-lg border bg-muted/40 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 text-success shrink-0" />
        <span>
          <strong>Zero Payment Data Stored:</strong> Payment processing is delegated to Stripe. No credit card numbers, CVVs, or bank secrets are accessible or persisted within platform telemetry.
        </span>
      </div>

      {/* KPI Cards (Ref Image Anatomy) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <AdminMetricCard
          label="MRR (Monthly)"
          subtitle="Subscription Run-Rate"
          value={data?.mrr !== undefined ? formatCurrency(data.mrr) : '—'}
          badgeText="+14.2%"
          badgeType="positive"
          secondaryText={`New: +${data?.newRevenue ? formatCurrency(data.newRevenue) : '$0'}`}
          sparklineColor="emerald"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="ARR (Annualized)"
          subtitle="Projected Contract Value"
          value={data?.arr !== undefined ? formatCurrency(data.arr) : '—'}
          badgeText="+18.5%"
          badgeType="positive"
          secondaryText="Total contracted run-rate"
          sparklineColor="cyan"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Average Revenue Per User"
          subtitle="ARPU Benchmark"
          value={data?.arpu !== undefined ? formatCurrency(data.arpu) : '—'}
          badgeText="+5.8%"
          badgeType="positive"
          secondaryText="Across paying accounts"
          sparklineColor="emerald"
          isLoading={isLoading}
        />

        <AdminMetricCard
          label="Churned MRR"
          subtitle="Revenue Attrition"
          value={data?.churnedRevenue !== undefined ? formatCurrency(data.churnedRevenue) : '—'}
          badgeText={data?.churnedRevenue && data.churnedRevenue > 0 ? '-1.8%' : '0%'}
          badgeType={data?.churnedRevenue && data.churnedRevenue > 0 ? 'negative' : 'positive'}
          secondaryText={
            data?.churnedRevenue && data.churnedRevenue > 0
              ? 'Down 1.8% this period'
              : 'Zero revenue churn'
          }
          sparklineColor={data?.churnedRevenue && data.churnedRevenue > 0 ? 'rose' : 'emerald'}
          isLoading={isLoading}
        />
      </div>

      {/* Revenue Trend Chart & Plan MRR Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ChartContainer
            title="MRR & Revenue Trajectory"
            description="Recurring monthly subscription revenue growth"
            isLoading={isLoading}
            isError={isError}
            isEmpty={!data?.mrrTrend?.length}
            height={320}
          >
            <AreaChart
              data={data?.mrrTrend || []}
              xAxisKey="date"
              series={[
                { dataKey: 'value', name: 'MRR', color: 'green' },
              ]}
              valueFormatter={formatCurrency}
              height={320}
              showLegend
            />
          </ChartContainer>
        </div>

        <div>
          <ChartContainer
            title="Revenue by Tier"
            description="MRR contribution by subscription tier"
            isLoading={isLoading}
            isError={isError}
            isEmpty={planDonut.length === 0}
            height={320}
          >
            <DonutChart
              data={planDonut}
              valueFormatter={formatCurrency}
              centerLabel="MRR"
              centerValue={formatCurrency(data?.mrr || 0)}
              height={320}
            />
          </ChartContainer>
        </div>
      </div>

      {/* Plan Details & Payment Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 pb-2 border-b">
            Plan Revenue Breakdown
          </h3>
          <div className="space-y-3">
            {(!data?.revenueByPlan || data.revenueByPlan.length === 0) ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No subscription plan revenue recorded.
              </p>
            ) : (
              data.revenueByPlan.map((p) => (
                <div key={p.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold">{p.label} Tier</span>
                    <span className="text-muted-foreground">
                      {formatCurrency(p.value)} ({p.percentage}%)
                    </span>
                  </div>
                  <Progress value={p.percentage} className="h-1.5" />
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold mb-3 pb-2 border-b">
            Payment Processing Status
          </h3>
          <div className="space-y-3">
            {!data?.paymentAnalytics ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                No payment status entries found.
              </p>
            ) : (
              <>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-success">Successful Charges</span>
                    <span className="text-muted-foreground">
                      {data.paymentAnalytics.successful} charges
                    </span>
                  </div>
                  <Progress value={100} className="h-1.5 [&>div]:bg-success" />
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-destructive">Failed Charges</span>
                    <span className="text-muted-foreground">
                      {data.paymentAnalytics.failed} charges
                    </span>
                  </div>
                  <Progress
                    value={
                      data.paymentAnalytics.successful + data.paymentAnalytics.failed > 0
                        ? (data.paymentAnalytics.failed /
                            (data.paymentAnalytics.successful + data.paymentAnalytics.failed)) *
                          100
                        : 0
                    }
                    className="h-1.5 [&>div]:bg-destructive"
                  />
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
