import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge, Button, Card, LoadingState, Page, PageHeader, AIModelIcon } from '@org/ui';
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock,
  Coins,
  RefreshCw,
  Zap,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { analyticsService } from '../services/analyticsService.js';
import { useStudioSession } from '../session-guard.js';

const PIE_COLORS = ['#6366f1', '#a855f7', '#06b6d4', '#10b981', '#f59e0b'];

export function AnalyticsPage() {
  const { activeWorkspace } = useStudioSession();
  const [dateRange, setDateRange] = useState('7D');

  const { data: analytics, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['workspace-analytics', activeWorkspace.id, dateRange],
    queryFn: () => analyticsService.getAnalytics(dateRange, activeWorkspace.id),
  });

  if (isLoading || !analytics) {
    return <LoadingState label="Loading analytics and telemetry..." />;
  }

  const { summary, timeSeries, modelsBreakdown, latencyPercentiles } = analytics;

  return (
    <Page width="wide" padding="none" className="space-y-6">
      {/* Header matching Admin */}
      <PageHeader
        title="Telemetry & Observability"
        description={`Monitor workflow execution success rates, token usage, latency distribution, and cost telemetry for ${activeWorkspace.name}.`}
        icon={<BarChart3 className="size-5" />}
        accent="violet"
        actions={
          <div className="flex items-center gap-2">
            {/* Date Range Selector */}
            <div className="flex items-center gap-1 border-b sm:border-b-0 pb-1 sm:pb-0">
              {['24H', '7D', '30D', '90D'].map((range) => (
                <Button
                  key={range}
                  variant={dateRange === range ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setDateRange(range)}
                  className="text-xs h-7 px-2.5"
                >
                  {range}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              loading={isRefetching}
              className="gap-1.5 text-xs h-8"
            >
              <RefreshCw className="size-3.5" />
              Refresh
            </Button>
          </div>
        }
      />

      {/* KPI Cards Row matching Admin ExecutiveKpiGrid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card className="p-4 sm:p-5 flex flex-col justify-between hover:border-primary/40 transition-colors shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Invocations</span>
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Activity className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {summary.totalExecutions.toLocaleString()}
          </div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-success font-medium">
            <ArrowUpRight className="size-3" />
            <span>+14.2% vs previous period</span>
          </div>
        </Card>

        <Card className="p-4 sm:p-5 flex flex-col justify-between hover:border-primary/40 transition-colors shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Success Rate</span>
            <div className="size-8 rounded-lg bg-success/10 text-success flex items-center justify-center shrink-0">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {summary.successRate}%
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {summary.failedExecutions} failed runs
          </div>
        </Card>

        <Card className="p-4 sm:p-5 flex flex-col justify-between hover:border-primary/40 transition-colors shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Token Consumption</span>
            <div className="size-8 rounded-lg bg-warning/10 text-warning flex items-center justify-center shrink-0">
              <Zap className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {summary.totalTokens}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Across 5 foundation models
          </div>
        </Card>

        <Card className="p-4 sm:p-5 flex flex-col justify-between hover:border-primary/40 transition-colors shadow-2xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Estimated Cost</span>
            <div className="size-8 rounded-lg bg-success/10 text-success flex items-center justify-center shrink-0">
              <Coins className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {summary.totalCost}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Budget cap: $250.00/mo
          </div>
        </Card>
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Execution Volume Trend Area Chart */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Execution Volume & Success</h3>
              <p className="text-xs text-muted-foreground">Daily workflow runs and error occurrences</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2.5 rounded-full bg-primary" />
                Successful Runs
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2.5 rounded-full bg-destructive" />
                Failed Runs
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="failedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area type="monotone" dataKey="success" stroke="#6366f1" fillOpacity={1} fill="url(#successGrad)" />
                <Area type="monotone" dataKey="failed" stroke="#f43f5e" fillOpacity={1} fill="url(#failedGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Model Distribution Breakdown */}
        <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Model Call Distribution</h3>
            <p className="text-xs text-muted-foreground">Share of tokens by provider</p>
          </div>

          <div className="h-48 w-full my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={modelsBreakdown}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={4}
                  dataKey="share"
                >
                  {modelsBreakdown.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 border-t border-border pt-3">
            {modelsBreakdown.map((m, idx) => (
              <div key={m.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[idx] }} />
                  <AIModelIcon modelId={m.name} size={15} className="shrink-0" />
                  <span className="text-foreground font-medium">{m.name}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>{m.calls} calls</span>
                  <span className="font-semibold text-foreground">{m.share}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Latency Percentiles & Active Alerts */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Execution Latency Percentiles</h3>
            <Clock className="size-4 text-muted-foreground" />
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border border-border bg-surface-raised p-3">
              <div className="text-[11px] text-muted-foreground">Median (p50)</div>
              <div className="mt-1 text-lg font-bold text-foreground">{latencyPercentiles.p50}</div>
            </div>
            <div className="rounded-lg border border-border bg-surface-raised p-3">
              <div className="text-[11px] text-muted-foreground">90th Percentile</div>
              <div className="mt-1 text-lg font-bold text-foreground">{latencyPercentiles.p90}</div>
            </div>
            <div className="rounded-lg border border-border bg-surface-raised p-3">
              <div className="text-[11px] text-muted-foreground">99th Percentile</div>
              <div className="mt-1 text-lg font-bold text-warning">{latencyPercentiles.p99}</div>
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Measured from trigger dispatch to final output delivery, including external tool calls and model streaming.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Active Health & Alert Rules</h3>
            <AlertTriangle className="size-4 text-success" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-border/80 bg-surface-raised px-3 py-2 text-xs">
              <div>
                <div className="font-medium text-foreground">Error Spike Guard</div>
                <div className="text-[10px] text-muted-foreground">Notify Slack if failure rate &gt; 5% in 10 mins</div>
              </div>
              <Badge variant="success" className="text-[10px]">Healthy</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/80 bg-surface-raised px-3 py-2 text-xs">
              <div>
                <div className="font-medium text-foreground">Monthly Budget Cap</div>
                <div className="text-[10px] text-muted-foreground">Warning at 80% ($200.00) usage threshold</div>
              </div>
              <Badge variant="outline" className="text-[10px] text-success">23.5% Used</Badge>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/80 bg-surface-raised px-3 py-2 text-xs">
              <div>
                <div className="font-medium text-foreground">Approval SLA Timeout</div>
                <div className="text-[10px] text-muted-foreground">Auto-escalate pending approvals after 24 hours</div>
              </div>
              <Badge variant="success" className="text-[10px]">Active</Badge>
            </div>
          </div>
        </div>
      </div>
    </Page>
  );
}
