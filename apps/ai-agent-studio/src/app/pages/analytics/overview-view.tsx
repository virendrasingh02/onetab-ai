import { Badge, Card } from '@org/ui';
import { cn } from '@org/utils';
import type { DeepAIAnalyticsOverview } from '@org/types';
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Clock,
  Coins,
  GitBranch,
  Layers,
  type LucideIcon,
  Users,
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
import {
  DistributionRow,
  InsightsPanel,
  QualityCard,
  RankingsRow,
  TrendCharts,
  formatCompact,
  formatDuration,
  formatUsd,
} from './overview-sections.js';

const PIE_COLORS = ['var(--primary)', 'var(--accent-violet)', 'var(--accent-cyan)', 'var(--success)', 'var(--warning)', 'var(--accent-pink)'];

interface OverviewViewProps {
  data: DeepAIAnalyticsOverview;
  onNavigateToTab: (tabId: string) => void;
  onSelectAgent?: (agentId: string) => void;
  onSelectWorkflow?: (workflowId: string) => void;
}

function SlowestCard({
  icon: Icon,
  title,
  subtitle,
  emptyText,
  items,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  emptyText: string;
  items: { name: string; durationMs: number }[];
}) {
  return (
    <Card className="p-4 shadow-2xs">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
          <Icon className="size-3.5 text-primary" />
          {title}
        </span>
        <span className="text-2xs text-muted-foreground">{subtitle}</span>
      </div>
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="text-xs text-muted-foreground py-2 text-center">
            {emptyText}
          </div>
        ) : (
          items.map((item, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 rounded-md bg-surface-raised border border-border text-xs"
            >
              <span className="font-medium text-foreground truncate max-w-[150px]">
                {item.name}
              </span>
              <Badge variant="outline" className="text-2xs">
                {formatDuration(item.durationMs)}
              </Badge>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

export function OverviewView({ data, onNavigateToTab }: OverviewViewProps) {
  const { execution, tokens, cost: costRaw, performance: perf, reliability: rel, deltas } = data;

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
    timeToFirstTokenMs: perf.timeToFirstTokenMs,
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

  const formatTokens = formatCompact;
  const formatCurrency = formatUsd;

  /** "—" when the runtime never measured the value, so 0ms is never shown as a fact. */
  const measured = (ms: number | null) => (ms === null || ms <= 0 ? '—' : formatDuration(ms));

  const renderDelta = (pct: number | null, inverse = false, unit = '%') => {
    if (pct === null) {
      return <span className="text-xs text-muted-foreground">No previous data</span>;
    }
    const isGood = inverse ? pct <= 0 : pct >= 0;
    const Icon = pct >= 0 ? ArrowUpRight : ArrowDownRight;
    return (
      <div
        className={cn(
          'flex items-center gap-1 text-xs font-medium',
          isGood ? 'text-success-text' : 'text-destructive-text',
        )}
      >
        <Icon className="size-3" />
        <span>
          {pct > 0 ? `+${pct.toFixed(1)}${unit}` : `${pct.toFixed(1)}${unit}`} vs previous
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* SECTION 0: WHAT NEEDS ATTENTION */}
      <InsightsPanel insights={data.insights ?? []} onNavigateToTab={onNavigateToTab} />

      {/* SECTION 1: EXECUTIVE KPIS */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Total Runs */}
        <Card
          onClick={() => onNavigateToTab('executions')}
          className="p-4 sm:p-5 flex flex-col justify-between hover:border-border-strong transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Runs</span>
            <div className="size-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Activity className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {executions.total.toLocaleString()}
          </div>
          <div className="mt-1 flex items-center justify-between">
            {renderDelta(deltas.totalRunsPct)}
            <span className="text-2xs text-muted-foreground">
              {executions.running + executions.queued} active
            </span>
          </div>
        </Card>

        {/* Success Rate */}
        <Card
          onClick={() => onNavigateToTab('errors')}
          className="p-4 sm:p-5 flex flex-col justify-between hover:border-success/50 transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Success Rate</span>
            <div className="size-8 rounded-lg bg-success/10 text-success-text flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {executions.successRate.toFixed(1)}%
          </div>
          <div className="mt-1 flex items-center justify-between">
            {renderDelta(deltas.successRatePts, false, ' pts')}
            <span className="text-2xs text-muted-foreground">
              {executions.failed} failed
            </span>
          </div>
        </Card>

        {/* Total AI Tokens */}
        <Card
          onClick={() => onNavigateToTab('models')}
          className="p-4 sm:p-5 flex flex-col justify-between hover:border-warning/50 transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Token Consumption</span>
            <div className="size-8 rounded-lg bg-warning/10 text-warning-text flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Zap className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {formatTokens(aiUsage.totalTokens)}
          </div>
          <div className="mt-1 flex items-center justify-between">
            {renderDelta(deltas.tokensPct, true)}
            <span className="text-2xs text-muted-foreground">
              {aiUsage.avgTokensPerExecution.toLocaleString()} / run
            </span>
          </div>
        </Card>

        {/* Estimated Cost */}
        <Card
          onClick={() => onNavigateToTab('cost')}
          className="p-4 sm:p-5 flex flex-col justify-between hover:border-accent-violet/50 transition-all cursor-pointer group shadow-2xs"
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Estimated AI Cost</span>
            <div className="size-8 rounded-lg bg-accent-violet/10 text-accent-violet flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Coins className="size-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {formatCurrency(cost.totalEstimatedCost)}
          </div>
          <div className="mt-1 flex items-center justify-between">
            {renderDelta(deltas.costPct, true)}
            <span className="text-2xs text-muted-foreground">
              Budget: {cost.budgetUtilization.toFixed(0)}%
            </span>
          </div>
        </Card>
      </div>

      {/* SECTION 1b: SECONDARY KPIS */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4 shadow-2xs">
          <div className="text-xs font-medium text-muted-foreground">Avg Run Time</div>
          <div className="mt-1 text-xl font-bold text-foreground">{measured(performance.avgDurationMs)}</div>
          <div className="mt-1">{renderDelta(deltas.avgLatencyPct, true)}</div>
        </Card>
        <Card className="p-4 shadow-2xs">
          <div className="text-xs font-medium text-muted-foreground">p95 Run Time</div>
          <div className="mt-1 text-xl font-bold text-foreground">{measured(performance.latencyPercentiles.p95)}</div>
          <div className="mt-1">{renderDelta(deltas.p95LatencyPct, true)}</div>
        </Card>
        <Card className="p-4 shadow-2xs">
          <div className="text-xs font-medium text-muted-foreground">Cost per Run</div>
          <div className="mt-1 text-xl font-bold text-foreground">{formatCurrency(costRaw.costPerRunUsd)}</div>
          <div className="mt-1 text-2xs text-muted-foreground">
            {formatCurrency(costRaw.costPerSuccessfulRunUsd)} per successful run
          </div>
        </Card>
        <Card className="p-4 shadow-2xs">
          <div className="text-xs font-medium text-muted-foreground">Tool Calls</div>
          <div className="mt-1 text-xl font-bold text-foreground">{tokens.toolInvocationCount.toLocaleString()}</div>
          <div className="mt-1 text-2xs text-muted-foreground">
            {formatTokens(tokens.totalInputTokens)} in · {formatTokens(tokens.totalOutputTokens)} out tokens
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
                <span className="size-2.5 rounded-full bg-success" />
                Successful
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2.5 rounded-full bg-destructive" />
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
                    <stop offset="5%" stopColor='var(--success)' stopOpacity={0.4} />
                    <stop offset="95%" stopColor='var(--success)' stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="execFailedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor='var(--destructive)' stopOpacity={0.4} />
                    <stop offset="95%" stopColor='var(--destructive)' stopOpacity={0.0} />
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
                    backgroundColor: 'var(--card)', color: 'var(--card-foreground)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="successful"
                  name="Successful"
                  stroke='var(--success)'
                  fillOpacity={1}
                  fill="url(#execSuccessGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="failed"
                  name="Failed"
                  stroke='var(--destructive)'
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

          {aiUsage.modelUsageDistribution.length === 0 && (
            <div className="my-6 text-center text-xs text-muted-foreground">No model calls in this window.</div>
          )}
          <div className={cn('h-44 w-full my-2', aiUsage.modelUsageDistribution.length === 0 && 'hidden')}>
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
                    backgroundColor: 'var(--card)', color: 'var(--card-foreground)',
                    border: '1px solid var(--border)',
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

      {/* SECTION 2b: TOKENS, SPEND, LATENCY OVER TIME */}
      <TrendCharts data={data} />

      {/* SECTION 2c: DISTRIBUTIONS */}
      <DistributionRow data={data} />

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
              Avg: {measured(performance.avgDurationMs)}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-3 text-center mb-4">
            <div className="rounded-lg border border-border bg-surface-raised p-2.5">
              <div className="text-2xs text-muted-foreground uppercase tracking-wider font-semibold">
                p50 (Median)
              </div>
              <div className="mt-1 text-base font-bold text-foreground">
                {measured(performance.latencyPercentiles.p50)}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface-raised p-2.5">
              <div className="text-2xs text-muted-foreground uppercase tracking-wider font-semibold">
                p90
              </div>
              <div className="mt-1 text-base font-bold text-foreground">
                {measured(performance.latencyPercentiles.p90)}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface-raised p-2.5">
              <div className="text-2xs text-muted-foreground uppercase tracking-wider font-semibold">
                p95
              </div>
              <div className="mt-1 text-base font-bold text-warning-text">
                {measured(performance.latencyPercentiles.p95)}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface-raised p-2.5">
              <div className="text-2xs text-muted-foreground uppercase tracking-wider font-semibold">
                p99
              </div>
              <div className="mt-1 text-base font-bold text-destructive-text">
                {measured(performance.latencyPercentiles.p99)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs border-t border-border pt-3 text-muted-foreground">
            <div>
              <span>Model Time: </span>
              <strong className="text-foreground">
                {measured(performance.avgModelResponseMs)}
              </strong>
            </div>
            <div>
              <span>Tool Time: </span>
              <strong className="text-foreground">
                {measured(performance.totalToolDurationMs)}
              </strong>
            </div>
            <div>
              <span>Time to 1st Token: </span>
              <strong className="text-foreground" title="Model calls are not streamed yet, so this is not measured">
                {measured(performance.timeToFirstTokenMs)}
              </strong>
            </div>
            <div>
              <span>Queue Delay: </span>
              <strong className="text-foreground">
                {measured(performance.queueWaitTimeMs)}
              </strong>
            </div>
          </div>
        </Card>

        {/* Reliability & Failure Breakdown */}
        <Card className="p-5 shadow-2xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-warning-text" />
              <h3 className="text-sm font-semibold text-foreground">
                System Reliability & Faults
              </h3>
            </div>
            <Badge
              variant={reliability.errorRate > 5 ? 'destructive' : 'success'}
              className="text-2xs"
            >
              {reliability.errorRate.toFixed(1)}% Error Rate
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-3 text-center mb-4">
            <div className="rounded-lg border border-border bg-surface-raised p-2.5">
              <div className="text-2xs text-muted-foreground font-semibold">
                Rate Limits
              </div>
              <div className="mt-1 text-base font-bold text-foreground">
                {reliability.rateLimitFailures}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface-raised p-2.5">
              <div className="text-2xs text-muted-foreground font-semibold">
                Auth / Connectors
              </div>
              <div className="mt-1 text-base font-bold text-foreground">
                {reliability.authConnectorFailures}
              </div>
            </div>
            <div className="rounded-lg border border-border bg-surface-raised p-2.5">
              <div className="text-2xs text-muted-foreground font-semibold">
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
              <span className="font-semibold text-success-text">
                {reliability.recoveryRate === null ? 'No retries' : `${reliability.recoveryRate.toFixed(1)}%`}
              </span>
            </div>
          </div>
        </Card>
      </div>

      {/* SECTION 4: BOTTLENECKS & RANKINGS */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SlowestCard
          icon={GitBranch}
          title="Slowest Workflows"
          subtitle="by avg latency"
          emptyText="No latency bottlenecks detected"
          items={performance.slowestWorkflows}
        />
        <SlowestCard
          icon={Bot}
          title="Slowest Agents"
          subtitle="by task duration"
          emptyText="All agents operating normally"
          items={performance.slowestAgents}
        />
        <SlowestCard
          icon={Layers}
          title="Slowest Nodes"
          subtitle="by node type"
          emptyText="Node runtimes optimal"
          items={performance.slowestNodes}
        />
      </div>

      {/* SECTION 4b: RANKINGS + QUALITY */}
      <RankingsRow data={data} onNavigateToTab={onNavigateToTab} />
      <QualityCard data={data} onNavigateToTab={onNavigateToTab} />

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
          <Badge variant="secondary" className="text-xs font-mono">
            {performance.concurrentExecutions} runs
          </Badge>
        </div>
      </div>
    </div>
  );
}
