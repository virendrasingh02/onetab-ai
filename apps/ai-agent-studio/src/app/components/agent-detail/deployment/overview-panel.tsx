import type { AgentDeploymentView } from '@org/types';
import { Badge, Button, Card, ErrorState, LoadingState } from '@org/ui';
import { Activity, CheckCircle2, Coins, Flame, Globe, KeyRound, Palette, Play, Server, Shield, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { CopyButton } from './parts.js';
import { errorMessage, type DeploymentApi } from './use-deployment.js';

export type DeploymentSection = 'overview' | 'targets' | 'widget' | 'webhooks' | 'api-keys' | 'versions';

function Stat({ icon, label, value, tone }: { icon: ReactNode; label: string; value: ReactNode; tone?: string }) {
  return (
    <Card className="p-3.5 shadow-2xs">
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        {icon}
        {label}
      </span>
      <div className={`mt-1.5 font-mono text-xl font-bold tabular-nums ${tone ?? 'text-foreground'}`}>{value}</div>
    </Card>
  );
}

const formatDate = (iso?: string | null) => (iso ? new Date(iso).toLocaleString() : 'Never');

/**
 * How the deployment is doing, from the platform's own run records: nothing
 * here is a placeholder, so an agent that has not been called shows zeros.
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
  const { analyticsQuery } = api;
  const stats = analyticsQuery.data;
  const pendingApprovals = stats ? Math.max(0, stats.approvalsRequested - stats.approvalsApproved - stats.approvalsRejected) : 0;

  return (
    <div className="space-y-6">
      {analyticsQuery.isLoading ? (
        <LoadingState label="Loading run statistics…" />
      ) : analyticsQuery.isError ? (
        <ErrorState
          title="Couldn’t load run statistics"
          description={errorMessage(analyticsQuery.error)}
          onRetry={() => void analyticsQuery.refetch()}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <Stat icon={<Play className="size-3 text-primary" />} label="Total runs" value={(stats?.totalRuns ?? 0).toLocaleString()} />
          <Stat
            icon={<CheckCircle2 className="size-3 text-success" />}
            label="Success rate"
            value={stats && stats.totalRuns > 0 ? `${Math.round(stats.successRate)}%` : '—'}
            tone="text-success"
          />
          <Stat
            icon={<Shield className="size-3 text-warning" />}
            label="Awaiting approval"
            value={pendingApprovals}
            tone={pendingApprovals > 0 ? 'text-warning' : undefined}
          />
          <Stat icon={<Zap className="size-3 text-primary" />} label="Avg latency" value={`${Math.round(stats?.avgLatencyMs ?? 0)} ms`} />
          <Stat icon={<Flame className="size-3 text-accent-violet" />} label="Tokens used" value={(stats?.totalTokens ?? 0).toLocaleString()} />
          <Stat icon={<Coins className="size-3 text-success" />} label="Est. cost" value={`$${(stats?.estimatedCost ?? 0).toFixed(4)}`} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="space-y-4 p-5 shadow-2xs">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
                  <Activity className="size-4 text-primary" /> Live configuration
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">What every embed and API call is answered with right now.</p>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                {deployment.publishedVersionTag ?? `v${deployment.versionNumber}`}
              </Badge>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
              {[
                ['Model', deployment.agentModel ?? '—'],
                ['Environment', deployment.environment],
                ['Status', deployment.status],
                ['Tools', `${toolCount} enabled`],
                ['Last published', formatDate(deployment.publishedAt)],
                ['Active sessions', String(deployment.activeSessionsCount ?? 0)],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-border/50 bg-muted/40 p-2.5">
                  <dt className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 truncate font-mono font-bold text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="space-y-2 p-5 shadow-2xs">
              <h3 className="text-sm font-bold text-foreground">Most used tools</h3>
              {stats?.topTools?.length ? (
                <ul className="space-y-1.5 text-xs">
                  {stats.topTools.map((t) => (
                    <li key={t.name} className="flex items-center justify-between">
                      <span className="font-mono text-foreground">{t.name}</span>
                      <span className="text-muted-foreground tabular-nums">{t.count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No tool calls recorded yet.</p>
              )}
            </Card>
            <Card className="space-y-2 p-5 shadow-2xs">
              <h3 className="text-sm font-bold text-foreground">Recent failures</h3>
              {stats?.recentErrorCategories?.some((c) => c.count > 0) ? (
                <ul className="space-y-1.5 text-xs">
                  {stats.recentErrorCategories
                    .filter((c) => c.count > 0)
                    .map((c) => (
                      <li key={c.category} className="flex items-center justify-between">
                        <span className="text-foreground">{c.category}</span>
                        <span className="text-destructive tabular-nums">{c.count}</span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground">No failed runs.</p>
              )}
            </Card>
          </div>
        </div>

        <div className="space-y-4">
          <Card className="space-y-3 p-5 shadow-2xs">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Zap className="size-4 text-warning" /> Quick actions
            </h3>
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
                <Server className="size-3.5 text-success" /> Add a webhook
              </Button>
            </div>
          </Card>

          <Card className="space-y-3 p-5 shadow-2xs">
            <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
              <Shield className="size-4 text-success" /> Access
            </h3>
            <div className="space-y-2 text-xs">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Public key</span>
                  <CopyButton text={deployment.publicKey} className="h-6 px-1.5 text-[11px]" />
                </div>
                <div className="truncate rounded-md bg-muted/40 px-2 py-1 font-mono text-[11px] text-foreground">{deployment.publicKey}</div>
              </div>
              <div className="space-y-1 border-t border-border/50 pt-2">
                <span className="text-muted-foreground">Allowed origins</span>
                {deployment.allowedOrigins.length === 0 || deployment.allowedOrigins.includes('*') ? (
                  <p className="text-warning">Any website can embed this agent. Restrict it in Widget Studio.</p>
                ) : (
                  <ul className="space-y-0.5 font-mono text-[11px] text-foreground">
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
