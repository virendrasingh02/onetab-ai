import { Badge, Card } from '@org/ui';
import { cn } from '@org/utils';
import type { DeepAIAnalyticsOverview } from '@org/types';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  GitBranch,
  Layers,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const PIE_COLORS = ['#6366f1', '#a855f7', '#06b6d4', '#10b981', '#f59e0b', '#ec4899'];

interface OverviewViewProps {
  data: DeepAIAnalyticsOverview;
  onNavigateToTab: (tabId: string) => void;
  onSelectAgent?: (agentId: string) => void;
  onSelectWorkflow?: (workflowId: string) => void;
}

export function OverviewView({ data, onNavigateToTab }: OverviewViewProps) {
  const { execution, tokens, cost: costRaw, performance: perf, reliability: rel } = data;

  const executions = {
    total: execution.totalRuns,
    running: execution.runningRuns,
    queued: execution.queuedRuns,
    failed: execution.failedRuns,
    successRate: execution.successRate,
    dailyTrends: execution.trends.map((t) => ({
      date: t.date,
      successful: t.success,
      failed: t.failed,
      total: t.total,
    })),
    uniqueActiveAgents: execution.uniqueActiveAgents,
    uniqueActiveWorkflows: execution.uniqueActiveWorkflows,
    uniqueActiveUsers: execution.uniqueActiveUsers,
  };

  // The API only compares run volume and success rate against the previous
  // window; token/cost movement isn't computed, so those deltas stay hidden.
  const comparison = {
    executionVolumeGrowthPct: execution.previousComparison.totalRunsPct,
    successRateDiffPct: execution.previousComparison.successRateDelta,
  };

  const aiUsage = {
    totalTokens: tokens.totalTokens,
    avgTokensPerExecution: tokens.tokensPerExecution,
    modelUsageDistribution: tokens.modelDistribution.map((m) => ({
      model: m.model,
      calls: m.calls,
      percentage: m.sharePct,
    })),
  };

  const cost = {
    totalEstimatedCost: costRaw.totalCostUsd,
    budgetUtilization: costRaw.budgetUtilizationPct,
  };

  const performance = {
    avgDurationMs: perf.avgLatencyMs,
    latencyPercentiles: {
      p50: perf.medianLatencyMs,
      p90: perf.p90LatencyMs,
      p95: perf.p95LatencyMs,
      p99: perf.p99LatencyMs,
    },
    avgModelResponseMs: perf.avgModelResponseTimeMs,
    totalToolDurationMs: perf.toolExecutionDurationMs,
    timeToFirstTokenMs: perf.timeToFirstTokenMs ?? 0,
    queueWaitTimeMs: perf.queueWaitTimeMs,
    slowestWorkflows: perf.slowestWorkflows.map((w) => ({ name: w.name, durationMs: w.avgLatencyMs })),
    slowestAgents: perf.slowestAgents.map((a) => ({ name: a.name, durationMs: a.avgLatencyMs })),
    slowestNodes: perf.slowestNodes.map((n) => ({ name: n.nodeType || n.stepId, durationMs: n.avgLatencyMs })),
    concurrentExecutions: perf.concurrentExecutions,
  };

  const reliability = {
    errorRate: rel.errorRatePct,
    rateLimitFailures: rel.rateLimitFailures,
    authConnectorFailures: rel.authConnectorFailures,
    timeouts: rel.timeoutFailures,
    retries: rel.retryCount,
    recoveryRate: rel.recoveryRatePct,
  };

  const formatTokens = (t: number) => {
    if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(2)}M`;
    if (t >= 1_000) return `${(t / 1_000).toFixed(1)}k`;
    return t.toLocaleString();
  };

  const formatCurrency = (amt: number) => `$${amt.toFixed(2)}`;

  const renderDelta = (pct: number, inverse = false) => {
    const isGood = inverse ? pct <= 0 : pct >= 0;
    const Icon = pct >= 0 ? ArrowUpRight : ArrowDownRight;
    return (
      <div
        className={cn(
          'flex items-center gap-1 text-[11px] font-medium',
          isGood ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400',
        )}
      >
        <Icon className="size-3" />
        <span>
          {pct > 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`} vs previous
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* SECTION 1: EXECUTIVE KPIS */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Total Runs */}
        <Card
          onClick={() => onNavigateToTab('executions')}
          className="p-4 sm:p-5 flex flex-col justify-between hover:border-primary/50 transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Workflow Runs</span>
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Activity className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {executions.total.toLocaleString()}
          </div>
          <div className="mt-1 flex items-center justify-between">
            {renderDelta(comparison.executionVolumeGrowthPct)}
            <span className="text-[10px] text-muted-foreground">
              {executions.running + executions.queued} active
            </span>
          </div>
        </Card>

        {/* Success Rate */}
        <Card
          onClick={() => onNavigateToTab('errors')}
          className="p-4 sm:p-5 flex flex-col justify-between hover:border-emerald-500/50 transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Success Rate</span>
            <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {executions.successRate.toFixed(1)}%
          </div>
          <div className="mt-1 flex items-center justify-between">
            {renderDelta(comparison.successRateDiffPct)}
            <span className="text-[10px] text-muted-foreground">
              {executions.failed} failed
            </span>
          </div>
        </Card>

        {/* Total AI Tokens */}
        <Card
          onClick={() => onNavigateToTab('models')}
          className="p-4 sm:p-5 flex flex-col justify-between hover:border-amber-500/50 transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Token Consumption</span>
            <div className="size-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Zap className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {formatTokens(aiUsage.totalTokens)}
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              {aiUsage.avgTokensPerExecution.toLocaleString()} / run
            </span>
          </div>
        </Card>

        {/* Estimated Cost */}
        <Card
          onClick={() => onNavigateToTab('cost')}
          className="p-4 sm:p-5 flex flex-col justify-between hover:border-violet-500/50 transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Estimated AI Cost</span>
            <div className="size-8 rounded-lg bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Coins className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {formatCurrency(cost.totalEstimatedCost)}
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              Budget: {cost.budgetUtilization.toFixed(0)}%
            </span>
          </div>
        </Card>
      </div>

      {/* SECTION 2: CHARTS ROW (Trends + Model Distribution) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Execution Trends (Daily volume) */}
        <Card className="p-5 shadow-2xs lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Execution Volume & Outcomes
              </h3>
              <p className="text-xs text-muted-foreground">
                Daily execution status trends over selected timeframe
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2.5 rounded-full bg-emerald-500" />
                Successful
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2.5 rounded-full bg-rose-500" />
                Failed
              </span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={executions.dailyTrends}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="execSuccessGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="execFailedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(val) => (typeof val === 'string' ? val.slice(5) : val)}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="successful"
                  name="Successful"
                  stroke="#10b981"
                  fillOpacity={1}
                  fill="url(#execSuccessGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="failed"
                  name="Failed"
                  stroke="#f43f5e"
                  fillOpacity={1}
                  fill="url(#execFailedGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Model Distribution */}
        <Card className="p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Model Invocations Share
            </h3>
            <p className="text-xs text-muted-foreground">
              Token volume across foundation LLMs
            </p>
          </div>

          <div className="h-44 w-full my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={aiUsage.modelUsageDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="calls"
                  nameKey="model"
                >
                  {aiUsage.modelUsageDistribution.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PIE_COLORS[index % PIE_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 border-t border-border pt-3 max-h-36 overflow-y-auto">
            {aiUsage.modelUsageDistribution.map((m, idx) => (
              <div key={m.model} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className="size-2 rounded-full shrink-0"
                    style={{ backgroundColor: PIE_COLORS[idx % PIE_COLORS.length] }}
                  />
                  <span className="font-medium text-foreground truncate max-w-[120px]">
                    {m.model}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>{m.calls} calls</span>
                  <span className="font-semibold text-foreground">
                    {m.percentage.toFixed(0)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* SECTION 3: PERFORMANCE LATENCY & RELIABILITY GRID */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Latency Percentiles */}
        <Card className="p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                Execution Latency Profile
              </h3>
            </div>
            <span className="text-xs text-muted-foreground">
              Avg: {Math.round(performance.avgDurationMs)}ms
            </span>
          </div>

          <div className="grid grid-cols-4 gap-3 text-center mb-4">
            <div className="rounded-lg border border-border bg-surface-raised p-2.5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                p50 (Median)
              </div>
              <div className="mt-1 text-base font-bold text-foreground">
                {Math.round(performance.latencyPercentiles.p50)}ms
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface-raised p-2.5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                p90
              </div>
              <div className="mt-1 text-base font-bold text-foreground">
                {Math.round(performance.latencyPercentiles.p90)}ms
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface-raised p-2.5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                p95
              </div>
              <div className="mt-1 text-base font-bold text-amber-500">
                {Math.round(performance.latencyPercentiles.p95)}ms
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface-raised p-2.5">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                p99
              </div>
              <div className="mt-1 text-base font-bold text-rose-500">
                {Math.round(performance.latencyPercentiles.p99)}ms
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs border-t border-border pt-3 text-muted-foreground">
            <div>
              <span>Model Turnaround: </span>
              <strong className="text-foreground">
                {Math.round(performance.avgModelResponseMs)}ms
              </strong>
            </div>
            <div>
              <span>Tool Execution: </span>
              <strong className="text-foreground">
                {Math.round(performance.totalToolDurationMs)}ms
              </strong>
            </div>
            <div>
              <span>Time to 1st Token: </span>
              <strong className="text-foreground">
                {Math.round(performance.timeToFirstTokenMs)}ms
              </strong>
            </div>
            <div>
              <span>Queue Delay: </span>
              <strong className="text-foreground">
                {Math.round(performance.queueWaitTimeMs)}ms
              </strong>
            </div>
          </div>
        </Card>

        {/* Reliability & Failure Breakdown */}
        <Card className="p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-500" />
              <h3 className="text-sm font-semibold text-foreground">
                System Reliability & Faults
              </h3>
            </div>
            <Badge
              variant={reliability.errorRate > 5 ? 'destructive' : 'success'}
              className="text-[10px]"
            >
              {reliability.errorRate.toFixed(1)}% Error Rate
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center mb-4">
            <div className="rounded-lg border border-border bg-surface-raised p-2.5">
              <div className="text-[10px] text-muted-foreground font-semibold">
                Rate Limits
              </div>
              <div className="mt-1 text-base font-bold text-foreground">
                {reliability.rateLimitFailures}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface-raised p-2.5">
              <div className="text-[10px] text-muted-foreground font-semibold">
                Auth / Connectors
              </div>
              <div className="mt-1 text-base font-bold text-foreground">
                {reliability.authConnectorFailures}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface-raised p-2.5">
              <div className="text-[10px] text-muted-foreground font-semibold">
                Provider Timeouts
              </div>
              <div className="mt-1 text-base font-bold text-foreground">
                {reliability.timeouts}
              </div>
            </div>
          </div>

          <div className="space-y-1.5 border-t border-border pt-3 text-xs">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Automatic Retries Attempted</span>
              <span className="font-semibold text-foreground">
                {reliability.retries}
              </span>
            </div>
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Self-Healing Recovery Rate</span>
              <span className="font-semibold text-emerald-500">
                {reliability.recoveryRate.toFixed(1)}%
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* SECTION 4: BOTTLENECKS & RANKINGS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Slowest Workflows */}
        <Card className="p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <GitBranch className="size-3.5 text-primary" />
              Slowest Workflows
            </span>
            <span className="text-[10px] text-muted-foreground">by avg latency</span>
          </div>
          <div className="space-y-2">
            {performance.slowestWorkflows.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2 text-center">
                No latency bottlenecks detected
              </div>
            ) : (
              performance.slowestWorkflows.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-md bg-surface-raised border border-border text-xs"
                >
                  <span className="font-medium text-foreground truncate max-w-[150px]">
                    {item.name}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {Math.round(item.durationMs)}ms
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Slowest Agents */}
        <Card className="p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Bot className="size-3.5 text-primary" />
              Slowest Agents
            </span>
            <span className="text-[10px] text-muted-foreground">by task duration</span>
          </div>
          <div className="space-y-2">
            {performance.slowestAgents.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2 text-center">
                All agents operating normally
              </div>
            ) : (
              performance.slowestAgents.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-md bg-surface-raised border border-border text-xs"
                >
                  <span className="font-medium text-foreground truncate max-w-[150px]">
                    {item.name}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {Math.round(item.durationMs)}ms
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Slowest Nodes */}
        <Card className="p-4 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Layers className="size-3.5 text-primary" />
              Slowest Nodes
            </span>
            <span className="text-[10px] text-muted-foreground">by node type</span>
          </div>
          <div className="space-y-2">
            {performance.slowestNodes.length === 0 ? (
              <div className="text-xs text-muted-foreground py-2 text-center">
                Node runtimes optimal
              </div>
            ) : (
              performance.slowestNodes.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded-md bg-surface-raised border border-border text-xs"
                >
                  <span className="font-medium text-foreground truncate max-w-[150px]">
                    {item.name}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {Math.round(item.durationMs)}ms
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* SECTION 5: ACTIVE POPULATION FOOTER */}
      <div className="flex flex-wrap items-center justify-between p-4 rounded-xl border border-border bg-surface-raised text-xs text-muted-foreground">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-1.5">
            <Bot className="size-4 text-primary" />
            <strong className="text-foreground">{executions.uniqueActiveAgents}</strong> Active Agents
          </span>
          <span className="flex items-center gap-1.5">
            <GitBranch className="size-4 text-primary" />
            <strong className="text-foreground">{executions.uniqueActiveWorkflows}</strong> Active Workflows
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="size-4 text-primary" />
            <strong className="text-foreground">{executions.uniqueActiveUsers}</strong> Active Initiators
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>Concurrent execution peak: </span>
          <Badge variant="secondary" className="text-[11px] font-mono">
            {performance.concurrentExecutions} runs
          </Badge>
        </div>
      </div>
    </div>
  );
}
