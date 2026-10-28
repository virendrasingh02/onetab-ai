import type { ReactNode } from 'react';
import { Card } from '@org/ui';
import { cn } from '@org/utils';
import type { DeepAIAnalyticsOverview } from '@org/types';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Info,
  Lightbulb,
  ShieldCheck,
  Star,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type Overview = DeepAIAnalyticsOverview;

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--card)',
  color: 'var(--card-foreground)',
  border: '1px solid var(--border)',
  borderRadius: '8px',
  fontSize: '12px',
};

const STATUS_TONE: Record<string, string> = {
  SUCCESS: 'bg-success',
  COMPLETED: 'bg-success',
  FAILED: 'bg-destructive',
  CANCELLED: 'bg-muted-foreground',
  RUNNING: 'bg-primary',
  PENDING: 'bg-warning',
  QUEUED: 'bg-warning',
  WAITING: 'bg-warning',
  WAITING_APPROVAL: 'bg-warning',
};

export function formatDuration(ms: number): string {
  if (ms >= 60_000) return `${(ms / 60_000).toFixed(1)}m`;
  if (ms >= 1_000) return `${(ms / 1_000).toFixed(1)}s`;
  return `${Math.round(ms)}ms`;
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function SectionCard({
  title,
  description,
  right,
  className,
  children,
}: {
  title: string;
  description?: string;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card className={cn('p-5 shadow-2xs', className)}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {right}
      </div>
      {children}
    </Card>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="py-6 text-center text-xs text-muted-foreground">{children}</div>;
}

/* -------------------------------------------------------------------------- */
/* Insights                                                                    */
/* -------------------------------------------------------------------------- */

const SEVERITY = {
  critical: { icon: AlertTriangle, tone: 'border-destructive/40 bg-destructive/5 text-destructive-text' },
  warning: { icon: AlertTriangle, tone: 'border-warning/40 bg-warning/5 text-warning-text' },
  info: { icon: Info, tone: 'border-border bg-surface-raised text-muted-foreground' },
} as const;

export function InsightsPanel({
  insights,
  onNavigateToTab,
}: {
  insights: Overview['insights'];
  onNavigateToTab: (tabId: string) => void;
}) {
  if (insights.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/5 p-3 text-xs text-success-text">
        <CheckCircle2 className="size-4 shrink-0" />
        Nothing needs attention in this window.
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {insights.map((insight) => {
        const { icon: Icon, tone } = SEVERITY[insight.severity];
        const target = insight.tab;
        return (
          <button
            key={insight.id}
            type="button"
            disabled={!target}
            onClick={() => target && onNavigateToTab(target)}
            className={cn(
              'flex items-start gap-3 rounded-xl border p-3 text-left transition-colors',
              tone,
              target ? 'cursor-pointer hover:border-border-strong' : 'cursor-default',
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold text-foreground">{insight.title}</span>
              <span className="block text-xs text-muted-foreground">{insight.detail}</span>
            </span>
            {target && <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />}
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Trend charts                                                                */
/* -------------------------------------------------------------------------- */

const axisDate = (val: unknown) => (typeof val === 'string' ? val : String(val ?? ''));

export function TrendCharts({ data }: { data: Overview }) {
  const { tokens, performance, cost } = data;
  const hasTokens = tokens.tokenTrends.some((t) => t.inputTokens + t.outputTokens > 0);
  const hasLatency = performance.latencyTrends.some((t) => t.runs > 0);
  const hasCost = cost.costTrends.some((t) => t.costUsd > 0);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <SectionCard
        title="Token Usage"
        description={
          tokens.splitCoveragePct >= 100
            ? 'Input vs output tokens per day'
            : `Input vs output per day · split measured on ${tokens.splitCoveragePct.toFixed(0)}% of runs, rest estimated`
        }
      >
        {hasTokens ? (
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tokens.tokenTrends} margin={{ top: 6, right: 6, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={axisDate} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={formatCompact} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatCompact(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="inputTokens" name="Input" stackId="t" fill="var(--accent-cyan)" />
                <Bar dataKey="outputTokens" name="Output" stackId="t" fill="var(--accent-violet)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty>No tokens recorded in this window.</Empty>
        )}
      </SectionCard>

      <SectionCard
        title="Spend"
        description={`Daily cost · projected ${formatUsd(cost.projectedSpendUsd)} / 30 days`}
      >
        {hasCost ? (
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cost.costTrends} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="ovCostGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-violet)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="var(--accent-violet)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={axisDate} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatUsd(Number(v))} />
                <Area type="monotone" dataKey="costUsd" name="Cost" stroke="var(--accent-violet)" fill="url(#ovCostGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty>No spend recorded in this window.</Empty>
        )}
      </SectionCard>

      <SectionCard title="Latency" description="Average and p95 run time per day">
        {hasLatency ? (
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={performance.latencyTrends} margin={{ top: 6, right: 6, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={axisDate} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={formatDuration} />
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => formatDuration(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Area type="monotone" dataKey="p95Ms" name="p95" stroke="var(--warning)" fill="var(--warning)" fillOpacity={0.08} />
                <Area type="monotone" dataKey="avgMs" name="Average" stroke="var(--primary)" fill="var(--primary)" fillOpacity={0.12} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty>No runs in this window.</Empty>
        )}
      </SectionCard>
    </div>
  );
}

export const formatUsd = (n: number) => (n > 0 && n < 0.01 ? '<$0.01' : `$${n.toFixed(2)}`);

/* -------------------------------------------------------------------------- */
/* Distributions                                                               */
/* -------------------------------------------------------------------------- */

export function DistributionRow({ data }: { data: Overview }) {
  const { performance, breakdown, execution } = data;
  const maxBucket = Math.max(1, ...performance.latencyBuckets.map((b) => b.count));
  const maxHour = Math.max(1, ...breakdown.hourOfDay);
  const totalStatus = Math.max(1, breakdown.byStatus.reduce((s, x) => s + x.count, 0));

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <SectionCard title="Run Duration" description="How long runs take">
        {execution.totalRuns === 0 ? (
          <Empty>No runs in this window.</Empty>
        ) : (
          <div className="space-y-2">
            {performance.latencyBuckets.map((b) => (
              <div key={b.label} className="flex items-center gap-3 text-xs">
                <span className="w-14 shrink-0 text-muted-foreground">{b.label}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-raised">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${(b.count / maxBucket) * 100}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right font-medium text-foreground">{b.count}</span>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Run Outcomes" description="Every run by final status">
        {breakdown.byStatus.length === 0 ? (
          <Empty>No runs in this window.</Empty>
        ) : (
          <>
            <div className="mb-3 flex h-2.5 w-full overflow-hidden rounded-full bg-surface-raised">
              {breakdown.byStatus.map((s) => (
                <div
                  key={s.status}
                  className={cn('h-full', STATUS_TONE[s.status] ?? 'bg-muted-foreground')}
                  style={{ width: `${(s.count / totalStatus) * 100}%` }}
                  title={`${s.status}: ${s.count}`}
                />
              ))}
            </div>
            <div className="space-y-1.5">
              {breakdown.byStatus.map((s) => (
                <div key={s.status} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className={cn('size-2 rounded-full', STATUS_TONE[s.status] ?? 'bg-muted-foreground')} />
                    {s.status.replace(/_/g, ' ').toLowerCase()}
                  </span>
                  <span className="font-medium text-foreground">
                    {s.count} <span className="text-muted-foreground">({((s.count / totalStatus) * 100).toFixed(0)}%)</span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard title="Busiest Hours" description="Runs by hour of day (UTC)">
        {execution.totalRuns === 0 ? (
          <Empty>No runs in this window.</Empty>
        ) : (
          <>
            <div className="grid grid-cols-12 gap-1">
              {breakdown.hourOfDay.map((count, hour) => (
                <div
                  key={hour}
                  title={`${String(hour).padStart(2, '0')}:00 — ${count} run${count === 1 ? '' : 's'}`}
                  className="aspect-square rounded-sm bg-primary"
                  style={{ opacity: count === 0 ? 0.08 : 0.25 + 0.75 * (count / maxHour) }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-2xs text-muted-foreground">
              <span>00:00</span>
              <span>12:00</span>
              <span>23:00</span>
            </div>
          </>
        )}
      </SectionCard>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Rankings                                                                    */
/* -------------------------------------------------------------------------- */

function RankRow({ left, right, sub }: { left: ReactNode; right: ReactNode; sub?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-raised p-2 text-xs">
      <div className="min-w-0">
        <div className="truncate font-medium text-foreground">{left}</div>
        {sub && <div className="text-2xs text-muted-foreground">{sub}</div>}
      </div>
      <div className="shrink-0 text-right">{right}</div>
    </div>
  );
}

export function RankingsRow({
  data,
  onNavigateToTab,
}: {
  data: Overview;
  onNavigateToTab: (tabId: string) => void;
}) {
  const { breakdown } = data;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
      <SectionCard
        title="Top Tools"
        description="By number of calls"
        right={
          <button type="button" className="text-2xs text-primary hover:underline" onClick={() => onNavigateToTab('tools')}>
            All tools
          </button>
        }
      >
        <div className="space-y-2">
          {breakdown.topTools.length === 0 ? (
            <Empty>No tool calls recorded.</Empty>
          ) : (
            breakdown.topTools.slice(0, 5).map((t) => (
              <RankRow
                key={t.name}
                left={t.name}
                sub={t.avgDurationMs > 0 ? `avg ${formatDuration(t.avgDurationMs)}` : 'duration not recorded'}
                right={
                  <>
                    <div className="font-semibold text-foreground">{t.calls}</div>
                    {t.failed > 0 && <div className="text-2xs text-destructive-text">{t.failed} failed</div>}
                  </>
                }
              />
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard title="By Run Type" description="Agents, coworkers and workflows">
        <div className="space-y-2">
          {breakdown.byEntityType.length === 0 ? (
            <Empty>No runs in this window.</Empty>
          ) : (
            breakdown.byEntityType.map((t) => (
              <RankRow
                key={t.entityType}
                left={t.entityType.charAt(0) + t.entityType.slice(1).toLowerCase()}
                sub={`${formatUsd(t.costUsd)} spent`}
                right={
                  <>
                    <div className="font-semibold text-foreground">{t.runs} runs</div>
                    {t.failed > 0 && <div className="text-2xs text-destructive-text">{t.failed} failed</div>}
                  </>
                }
              />
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard title="Top Initiators" description="Who starts the most runs">
        <div className="space-y-2">
          {breakdown.topInitiators.length === 0 ? (
            <Empty>No user-started runs.</Empty>
          ) : (
            breakdown.topInitiators.map((u) => (
              <RankRow
                key={u.userId}
                left={u.name}
                sub={`${formatUsd(u.costUsd)} spent`}
                right={<div className="font-semibold text-foreground">{u.runs} runs</div>}
              />
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard title="Spend by Model" description="Estimated at catalog rates">
        <div className="space-y-2">
          {breakdown.topModelsByCost.length === 0 ? (
            <Empty>No model spend recorded.</Empty>
          ) : (
            breakdown.topModelsByCost.map((m) => (
              <RankRow
                key={m.model}
                left={m.model}
                right={<div className="font-semibold text-foreground">{formatUsd(m.costUsd)}</div>}
              />
            ))
          )}
        </div>
      </SectionCard>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Quality & oversight                                                         */
/* -------------------------------------------------------------------------- */

export function QualityCard({ data, onNavigateToTab }: { data: Overview; onNavigateToTab: (tabId: string) => void }) {
  const { quality } = data;
  const approvalRate =
    quality.approvalsDecided > 0 ? Math.round((quality.approvalsApproved / quality.approvalsDecided) * 100) : null;
  return (
    <SectionCard
      title="Quality & Oversight"
      description="User ratings and human approvals"
      right={
        <button type="button" className="text-2xs text-primary hover:underline" onClick={() => onNavigateToTab('evaluations')}>
          Evaluations
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          icon={<Star className="size-3.5" />}
          label="Avg rating"
          value={quality.avgRating !== null ? `${quality.avgRating.toFixed(1)} / 5` : '—'}
          hint={`${quality.feedbackCount} rating${quality.feedbackCount === 1 ? '' : 's'}`}
        />
        <Stat
          icon={<AlertTriangle className="size-3.5" />}
          label="Low ratings"
          value={String(quality.lowRatedCount)}
          hint="1–2 stars"
        />
        <Stat
          icon={<ShieldCheck className="size-3.5" />}
          label="Approvals"
          value={`${quality.approvalsPending} pending`}
          hint={approvalRate !== null ? `${approvalRate}% of ${quality.approvalsDecided} approved` : 'none decided yet'}
        />
        <Stat
          icon={<Lightbulb className="size-3.5" />}
          label="Avg approval wait"
          value={quality.avgApprovalWaitMs !== null ? formatDuration(quality.avgApprovalWaitMs) : '—'}
          hint="request to decision"
        />
      </div>
    </SectionCard>
  );
}

function Stat({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-raised p-3">
      <div className="flex items-center gap-1.5 text-2xs font-semibold text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-base font-bold text-foreground">{value}</div>
      <div className="text-2xs text-muted-foreground">{hint}</div>
    </div>
  );
}

