import type { AdminAnalyticsFilter } from '@org/types';
import { Card, Progress } from '@org/ui';
import {
  DollarSign,
  PieChart,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import {
  AnalyticsAreaChart,
  AnalyticsDonutChart,
  AnalyticsFilterBar,
  AnalyticsHeader,
  ChartContainer,
} from '../components/index.js';
import { useAdminRevenueAnalytics } from '../use-admin-analytics.js';

export function RevenueAnalyticsView() {
  const [filter, setFilter] = useState<AdminAnalyticsFilter>({ range: '30d' });
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } =
    useAdminRevenueAnalytics(filter);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);

  const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b'];

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
        filter={filter}
        onFilterChange={(newFilter) => setFilter(newFilter)}
      />

      {/* Security notice */}
      <div className="flex items-center gap-2.5 p-3 rounded-lg border bg-muted/40 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 text-success shrink-0" />
        <span>
          <strong>Zero Payment Data Stored:</strong> Payment processing is delegated to Stripe. No credit card numbers, CVVs, or bank secrets are accessible or persisted within platform telemetry.
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">MRR (Monthly)</span>
            <DollarSign className="size-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.mrr !== undefined ? formatCurrency(data.mrr) : '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            New: +{data?.newRevenue ? formatCurrency(data.newRevenue) : '$0'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">ARR (Annualized)</span>
            <TrendingUp className="size-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.arr !== undefined ? formatCurrency(data.arr) : '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Total run-rate
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">ARPU</span>
            <PieChart className="size-4 text-purple-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.arpu !== undefined ? formatCurrency(data.arpu) : '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Avg revenue per user
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Churned MRR</span>
            <TrendingDown className="size-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold mt-2">
            {data?.churnedRevenue !== undefined ? formatCurrency(data.churnedRevenue) : '—'}
          </div>
          <div className="text-[11px] text-muted-foreground mt-1">
            Expansion: +{data?.expansionRevenue ? formatCurrency(data.expansionRevenue) : '$0'}
          </div>
        </Card>
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
            <AnalyticsAreaChart
              data={data?.mrrTrend || []}
              xAxisKey="date"
              series={[
                { dataKey: 'value', name: 'MRR', color: '#10b981' },
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
            <AnalyticsDonutChart
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
