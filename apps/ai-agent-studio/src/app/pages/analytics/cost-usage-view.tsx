import {
  Badge,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@org/ui';
import {
  ArrowUpRight,
  Coins,
  Lightbulb,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import type { AICostAnalytics } from '@org/types';

interface CostUsageViewProps {
  costData: AICostAnalytics;
}

export function CostUsageView({ costData }: CostUsageViewProps) {
  const monthlyBudget = costData.budgetCapUsd;
  const currentMonthSpend = costData.totalCostUsd;
  const projectedMonthSpend = costData.projectedSpendUsd;
  const budgetUtilization = costData.budgetUtilizationPct;
  const spendByDay = costData.costTrends.map((d) => ({ date: d.date, amount: d.costUsd }));
  const spendByModel = costData.costByModel.map((m) => ({
    model: m.model,
    amount: m.costUsd,
    percentage: m.sharePct,
  }));
  const optimizationRecommendations = costData.optimizationOpportunities;

  return (
    <div className="space-y-6">
      {/* BUDGET & SPEND GAUGES */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-surface-raised/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Spend in Range</span>
            <Coins className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            ${currentMonthSpend.toFixed(2)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Budget Cap: ${monthlyBudget.toFixed(2)}
          </div>
        </Card>

        <Card className="p-4 bg-surface-raised/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Projected Month-End Spend</span>
            <TrendingUp className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            ${projectedMonthSpend.toFixed(2)}
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">
            Estimated based on current run velocity
          </div>
        </Card>

        <Card className="p-4 bg-surface-raised/40">
          <div className="text-xs text-muted-foreground flex items-center justify-between">
            <span>Budget Utilization</span>
            <Zap className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {budgetUtilization.toFixed(1)}%
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-2 w-full bg-surface rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                budgetUtilization > 90
                  ? 'bg-rose-500'
                  : budgetUtilization > 75
                  ? 'bg-amber-500'
                  : 'bg-emerald-500'
              }`}
              style={{ width: `${Math.min(100, budgetUtilization)}%` }}
            />
          </div>
        </Card>
      </div>

      {/* DAILY SPEND CHART */}
      <Card className="p-5 shadow-2xs">
        <div className="text-sm font-semibold text-foreground mb-1">
          Daily AI Expenditure Trend
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Dollar spend accrued each day across all agent invocations
        </p>

        <div className="h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={spendByDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                tickFormatter={(val) => (typeof val === 'string' ? val.slice(5) : val)}
              />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `$${val}`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(15, 23, 42, 0.95)',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(val: any) => [`$${Number(val).toFixed(3)}`, 'Spend']}
              />
              <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* RECOMMENDATIONS & MODEL SPEND */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Optimization Recommendations */}
        <Card className="p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="size-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-foreground">
              AI Cost Optimization Opportunities
            </h3>
          </div>

          <div className="space-y-3">
            {optimizationRecommendations.length === 0 ? (
              <div className="text-xs text-muted-foreground py-6 text-center">
                Your AI agent workflows are running efficiently. No immediate cost reductions identified.
              </div>
            ) : (
              optimizationRecommendations.map((rec, i) => (
                <div
                  key={i}
                  className="p-3 rounded-lg border border-border bg-surface-raised space-y-1.5 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{rec.title}</span>
                    <Badge variant="outline" className="text-[10px] text-emerald-500">
                      Save ~{rec.estimatedSavingsPct}%
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    {rec.description}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Spend by Model */}
        <Card className="p-5 shadow-2xs space-y-4">
          <div className="flex items-center gap-2">
            <Coins className="size-4 text-violet-500" />
            <h3 className="text-sm font-semibold text-foreground">
              Expenditure Breakdown by Model
            </h3>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-raised/50 text-[11px]">
                  <TableHead>Model</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spendByModel.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6 text-xs text-muted-foreground">
                      No model spend accrued.
                    </TableCell>
                  </TableRow>
                ) : (
                  spendByModel.map((item) => (
                    <TableRow key={item.model} className="hover:bg-surface-raised/50 text-xs">
                      <TableCell className="font-mono font-medium text-foreground">
                        {item.model}
                      </TableCell>
                      <TableCell className="tabular-nums font-semibold">
                        ${item.amount.toFixed(3)}
                      </TableCell>
                      <TableCell className="tabular-nums text-right font-medium">
                        {item.percentage.toFixed(1)}%
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
