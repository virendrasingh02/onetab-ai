import type { AgentDeploymentRecentRun, AgentDeploymentRunChannel, AgentDeploymentView } from '@org/types';
import { Badge, Button, Card, ErrorState, LoadingState, SegmentedControl } from '@org/ui';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Coins,
  Flame,
  Globe,
  KeyRound,
  Palette,
  PauseCircle,
  Play,
  RefreshCw,
  Server,
  Shield,
  Zap,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useSearchParams } from '../../../router.js';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CopyButton } from './parts.js';
import { ANALYTICS_PERIODS, errorMessage, publishableVersions, type AnalyticsPeriod, type DeploymentApi } from './use-deployment.js';

export type DeploymentSection = 'overview' | 'targets' | 'widget' | 'webhooks' | 'api-keys' | 'versions' | 'settings';

const PERIOD_LABELS: Record<AnalyticsPeriod, string> = { '24h': '24h', '7d': '7 days', '30d': '30 days', '90d': '90 days' };

const CHANNEL_LABELS: Record<AgentDeploymentRunChannel, string> = {
  session: 'Embed / widget',
  public_key: 'REST (public key)',
  api_key: 'REST (API key)',
};

const STATUS_TONE: Record<string, string> = {
  COMPLETED: 'bg-success',
  FAILED: 'bg-destructive',
  WAITING_APPROVAL: 'bg-warning',
  RUNNING: 'bg-primary',
};

const formatDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : 'Never');

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

const formatLatency = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);

function Stat({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: ReactNode; hint?: ReactNode; tone?: string }) {
  return (
    <Card className="p-3.5 shadow-2xs">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </span>
      <div className={`mt-1.5 font-mono text-xl font-bold tabular-nums ${tone ?? 'text-foreground'}`}>{value}</div>
      {hint && <div className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</div>}
    </Card>
  );
}

function SectionTitle({ icon, title, action }: { icon?: ReactNode; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {icon}
        {title}
      </h3>
      {action}
    </div>
  );
}

/** A row with a proportional bar behind its count. */
function ShareRow({ label, count, total, barClass }: { label: string; count: number; total: number; barClass: string }) {
  const pct = total > 0 ? Math.max(4, Math.round((count / total) * 100)) : 0;
  return (
    <li className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-mono text-foreground">{label}</span>
        <span className="shrink-0 text-muted-foreground tabular-nums">{count.toLocaleString()}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${pct}%` }} />
      </div>
    </li>
  );
}

function RecentRunRow({ run }: { run: AgentDeploymentRecentRun }) {
  return (
    <li className="flex items-center gap-3 py-2 text-xs">
      <span className={`size-2 shrink-0 rounded-full ${STATUS_TONE[run.status] ?? 'bg-muted-foreground'}`} title={run.status} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-foreground">{run.prompt || <span className="text-muted-foreground">No prompt recorded</span>}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {run.channel ? CHANNEL_LABELS[run.channel] : 'Deployment'} · {run.status.replace(/_/g, ' ').toLowerCase()}
        </p>
      </div>
      <div className="shrink-0 text-right font-mono text-xs text-muted-foreground tabular-nums">
        <div>{run.latencyMs > 0 ? formatLatency(run.latencyMs) : '—'}</div>
        <div>{timeAgo(run.startedAt)}</div>
      </div>
    </li>
  );
}

/**
 * How the deployment is doing, from the platform's own run records. Only
 * traffic that came in through the deployment (embeds, public-key and API-key
 * calls) is counted, so Studio test runs never inflate it; an agent that has
 * not been called shows zeros.
 */
export function OverviewPanel({
  api,
  deployment,
  toolCount,
  onNavigate,
}: {
  api: DeploymentApi;
  deployment: AgentDeploymentView;
  toolCount: number;
  onNavigate: (section: DeploymentSection) => void;
}) {
  const { analyticsQuery, analyticsPeriod, setAnalyticsPeriod, webhooksQuery } = api;
  const stats = analyticsQuery.data;
  const [, setSearchParams] = useSearchParams();
  const openRuns = () =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('tab', 'executions');
        return next;
      },
      { replace: false },
    );

  const hasRuns = (stats?.totalRuns ?? 0) > 0;
  const hourly = analyticsPeriod === '24h';
  const series = (stats?.series ?? []).map((b) => ({
    ...b,
    ok: b.runs - b.failed,
    label: hourly
      ? new Date(b.bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : new Date(b.bucket).toLocaleDateString([], { month: 'short', day: 'numeric' }),
  }));
  const pending = stats?.approvalsPending ?? 0;
  const failures = (stats?.recentErrorCategories ?? []).filter((c) => c.count > 0);
  const toolTotal = (stats?.topTools ?? []).reduce((n, t) => n + t.count, 0);
  const webhooks = webhooksQuery.data ?? [];
  const failingWebhooks = webhooks.filter((w) => w.lastDeliveryStatus && w.lastDeliveryStatus !== 'SUCCESS').length;
  const openOrigins = deployment.allowedOrigins.length === 0 || deployment.allowedOrigins.includes('*');
  const versionPublished = publishableVersions(api.versionsQuery.data).some((v) => v.version === deployment.versionNumber);
  // Each step is derived from what the API holds, so it ticks itself as the work is done.
  const checklist: Array<{ label: string; done: boolean; section: DeploymentSection; cta: string }> = [
    { label: 'A published version is live', done: versionPublished, section: 'versions', cta: 'Choose version' },
    { label: 'Allowed origins are restricted', done: !openOrigins, section: 'widget', cta: 'Restrict' },
    { label: 'Deployment is active', done: deployment.status === 'ACTIVE', section: 'settings', cta: 'Reactivate' },
    { label: 'Someone has called it', done: hasRuns, section: 'targets', cta: 'Install' },
    { label: 'A webhook reports run results', done: webhooks.length > 0, section: 'webhooks', cta: 'Add' },
  ];

  return (
    <div className="space-y-6">
      {deployment.status === 'SUSPENDED' && (
        <div className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
          <PauseCircle className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <p className="font-semibold text-foreground">This deployment is suspended</p>
            <p className="text-muted-foreground">Embeds and public-key API calls are refused until you resume it.</p>
          </div>
        </div>
      )}

      {checklist.some((c) => !c.done) && (
        <Card className="space-y-3 p-5 shadow-2xs">
          <SectionTitle
            icon={<CheckCircle2 className="size-4 text-primary" />}
            title="Before you go live"
            action={<span className="text-xs text-muted-foreground tabular-nums">{checklist.filter((c) => c.done).length} of {checklist.length} done</span>}
          />
          <ul className="grid gap-2 md:grid-cols-2">
            {checklist.map((item) => (
              <li key={item.label} className="flex items-center gap-2.5 rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs">
                <CheckCircle2 className={`size-4 shrink-0 ${item.done ? 'text-success' : 'text-muted-foreground/40'}`} />
                <span className={`min-w-0 flex-1 ${item.done ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{item.label}</span>
                {!item.done && (
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={() => onNavigate(item.section)}>
                    {item.cta} <ArrowRight className="size-3" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-foreground">Traffic</h2>
          <p className="text-xs text-muted-foreground">
            Runs through this deployment in the last {PERIOD_LABELS[analyticsPeriod]}. Studio test runs aren’t counted.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-muted-foreground"
            onClick={() => void analyticsQuery.refetch()}
            disabled={analyticsQuery.isFetching}
            aria-label="Refresh statistics"
          >
            <RefreshCw className={`size-3.5 ${analyticsQuery.isFetching ? 'animate-spin' : ''}`} />
            {analyticsQuery.dataUpdatedAt ? `Updated ${timeAgo(new Date(analyticsQuery.dataUpdatedAt).toISOString())}` : 'Refresh'}
          </Button>
          <SegmentedControl
            size="sm"
            aria-label="Statistics period"
            value={analyticsPeriod}
            onChange={setAnalyticsPeriod}
            options={ANALYTICS_PERIODS.map((p) => ({ value: p, label: p }))}
          />
        </div>
      </div>

      {analyticsQuery.isLoading ? (
        <LoadingState label="Loading run statistics…" />
      ) : analyticsQuery.isError && !stats ? (
        <ErrorState
          title="Couldn’t load run statistics"
          description={errorMessage(analyticsQuery.error)}
          onRetry={() => void analyticsQuery.refetch()}
        />
      ) : (
        <>
          <div className={`grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6 ${analyticsQuery.isPlaceholderData ? 'opacity-60' : ''}`}>
            <Stat
              icon={<Play className="size-3 text-primary" />}
              label="Total runs"
              value={(stats?.totalRuns ?? 0).toLocaleString()}
              hint={hasRuns ? `${stats?.successfulRuns ?? 0} ok · ${stats?.failedRuns ?? 0} failed` : 'No traffic yet'}
            />
            <Stat
              icon={<CheckCircle2 className="size-3 text-success" />}
              label="Success rate"
              value={hasRuns && (stats?.successfulRuns ?? 0) + (stats?.failedRuns ?? 0) > 0 ? `${stats?.successRate}%` : '—'}
              tone={!hasRuns ? undefined : (stats?.successRate ?? 0) >= 90 ? 'text-success' : 'text-warning'}
            />
            <Stat
              icon={<Shield className="size-3 text-warning" />}
              label="Awaiting approval"
              value={pending}
              tone={pending > 0 ? 'text-warning' : undefined}
              hint={stats?.approvalsRequested ? `${stats.approvalsRequested} requested in period` : undefined}
            />
            <Stat
              icon={<Zap className="size-3 text-primary" />}
              label="Avg latency"
              value={stats?.avgLatencyMs ? formatLatency(stats.avgLatencyMs) : '—'}
            />
            <Stat
              icon={<Flame className="size-3 text-accent-violet" />}
              label="Tokens used"
              value={(stats?.totalTokens ?? 0).toLocaleString()}
              hint={stats?.toolExecutionsCount ? `${stats.toolExecutionsCount} tool calls` : undefined}
            />
            <Stat
              icon={<Coins className="size-3 text-success" />}
              label="Est. cost"
              value={`$${(stats?.estimatedCost ?? 0).toFixed(stats && stats.estimatedCost >= 1 ? 2 : 4)}`}
            />
          </div>

          <Card className="space-y-3 p-5 shadow-2xs">
            <SectionTitle
              icon={<Activity className="size-4 text-primary" />}
              title={hourly ? 'Runs per hour' : 'Runs per day'}
              action={
                <span className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-sm bg-primary" /> Succeeded
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="size-2 rounded-sm bg-destructive" /> Failed
                  </span>
                </span>
              }
            />
            {hasRuns ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={series} margin={{ top: 6, right: 4, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.15} vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" minTickGap={16} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip
                      cursor={{ fill: 'var(--muted)', opacity: 0.4 }}
                      contentStyle={{
                        backgroundColor: 'var(--card)',
                        color: 'var(--card-foreground)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                      formatter={(val: unknown, name: unknown) => [String(val), name === 'ok' ? 'Succeeded' : 'Failed']}
                    />
                    <Bar dataKey="ok" stackId="runs" fill="var(--primary)" />
                    <Bar dataKey="failed" stackId="runs" fill="var(--destructive)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-48 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border text-center">
                <p className="text-xs text-muted-foreground">No calls in the last {PERIOD_LABELS[analyticsPeriod]}.</p>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => onNavigate('targets')}>
                  <Globe className="size-3.5" /> Install it somewhere
                </Button>
              </div>
            )}
          </Card>
        </>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="space-y-2 p-5 shadow-2xs">
            <SectionTitle
              title="Recent runs"
              action={
                <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={openRuns}>
                  All runs <ArrowRight className="size-3" />
                </Button>
              }
            />
            {stats?.recentRuns?.length ? (
              <ul className="divide-y divide-border/60">
                {stats.recentRuns.map((run) => (
                  <RecentRunRow key={run.id} run={run} />
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Nothing has called this deployment in this period.</p>
            )}
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card className="space-y-3 p-5 shadow-2xs">
              <SectionTitle title="Traffic sources" />
              {stats?.channels?.length ? (
                <ul className="space-y-2.5">
                  {stats.channels.map((c) => (
                    <ShareRow key={c.channel} label={CHANNEL_LABELS[c.channel]} count={c.count} total={stats.totalRuns} barClass="bg-primary" />
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No calls yet.</p>
              )}
            </Card>
            <Card className="space-y-3 p-5 shadow-2xs">
              <SectionTitle title="Most used tools" />
              {stats?.topTools?.length ? (
                <ul className="space-y-2.5">
                  {stats.topTools.map((t) => (
                    <ShareRow key={t.name} label={t.name} count={t.count} total={toolTotal} barClass="bg-accent-violet" />
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No tool calls recorded yet.</p>
              )}
            </Card>
            <Card className="space-y-3 p-5 shadow-2xs">
              <SectionTitle icon={failures.length ? <AlertTriangle className="size-4 text-destructive" /> : undefined} title="Failures" />
              {failures.length ? (
                <ul className="space-y-2.5">
                  {failures.map((c) => (
                    <ShareRow key={c.category} label={c.category} count={c.count} total={stats?.failedRuns ?? 0} barClass="bg-destructive" />
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No failed runs.</p>
              )}
            </Card>
          </div>

          <Card className="space-y-4 p-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Activity className="size-4 text-primary" /> Live configuration
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">What every embed and API call is answered with right now.</p>
              </div>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 font-mono text-xs" onClick={() => onNavigate('versions')}>
                {deployment.publishedVersionTag ?? `v${deployment.versionNumber}`}
                <ArrowRight className="size-3" />
              </Button>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
              {[
                ['Model', deployment.agentModel ?? '—'],
                ['Environment', deployment.environment],
                ['Status', deployment.status],
                ['Tools', `${toolCount} enabled`],
                ['Last published', formatDate(deployment.publishedAt)],
                ['Active sessions', String(stats?.activeSessions ?? deployment.activeSessionsCount ?? 0)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-border/50 bg-muted/40 p-2.5">
                  <dt className="text-2xs font-semibold uppercase text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 truncate font-mono font-bold text-foreground" title={value}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="space-y-3 p-5 shadow-2xs">
            <SectionTitle icon={<Zap className="size-4 text-warning" />} title="Quick actions" />
            <div className="flex flex-col gap-2">
              <Button variant="outline" className="h-9 justify-start gap-2 text-xs" onClick={() => onNavigate('targets')}>
                <Globe className="size-3.5 text-primary" /> Get an install snippet
              </Button>
              <Button variant="outline" className="h-9 justify-start gap-2 text-xs" onClick={() => onNavigate('widget')}>
                <Palette className="size-3.5 text-accent-violet" /> Customise the widget
              </Button>
              <Button variant="outline" className="h-9 justify-start gap-2 text-xs" onClick={() => onNavigate('api-keys')}>
                <KeyRound className="size-3.5 text-warning" /> Create an API key
              </Button>
              <Button variant="outline" className="h-9 justify-start gap-2 text-xs" onClick={() => onNavigate('webhooks')}>
                <Server className="size-3.5 text-success" /> {webhooks.length ? 'Manage webhooks' : 'Add a webhook'}
                {webhooks.length > 0 && (
                  <Badge variant="outline" className={`ml-auto text-2xs ${failingWebhooks ? 'text-destructive' : ''}`}>
                    {failingWebhooks ? `${failingWebhooks} failing` : webhooks.length}
                  </Badge>
                )}
              </Button>
            </div>
          </Card>

          <Card className="space-y-3 p-5 shadow-2xs">
            <SectionTitle icon={<Shield className="size-4 text-success" />} title="Access" />
            <div className="space-y-2 text-xs">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Public key</span>
                  <CopyButton text={deployment.publicKey} className="h-6 px-1.5 text-xs" />
                </div>
                <div className="truncate rounded-md bg-muted/40 px-2 py-1 font-mono text-xs text-foreground">{deployment.publicKey}</div>
              </div>
              <div className="space-y-1 border-t border-border/50 pt-2">
                <span className="text-muted-foreground">Allowed origins</span>
                {openOrigins ? (
                  <div className="space-y-1.5">
                    <p className="text-warning">Any website can embed this agent.</p>
                    <Button variant="outline" size="sm" className="h-7 w-full text-xs" onClick={() => onNavigate('widget')}>
                      Restrict origins
                    </Button>
                  </div>
                ) : (
                  <ul className="space-y-0.5 font-mono text-xs text-foreground">
                    {deployment.allowedOrigins.map((o) => (
                      <li key={o} className="truncate">
                        {o}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
