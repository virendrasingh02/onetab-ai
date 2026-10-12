import type { AutomationOverviewData } from '@org/types';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ErrorState,
  LoadingState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  AlertCircle,
  ArrowRight,
  Clock,
  ShieldCheck,
  TrendingUp,
  Workflow,
  Zap,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAutomationOverview } from '../use-automations.js';
import { automationPath, type AutomationCenterTab } from './types.js';

export function AutomationOverviewTab({
  onNavigateTab,
}: {
  onNavigateTab?: (tab: AutomationCenterTab) => void;
}) {
  const { workspaceId, slug } = useCurrentWorkspace();
  const navigate = useNavigate();
  const overviewQuery = useAutomationOverview(workspaceId);
  const [timeRange, setTimeRange] = useState<'14d' | '7d' | '30d'>('14d');

  if (overviewQuery.isLoading) {
    return <LoadingState label="Calculating automation telemetry and metrics…" />;
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <ErrorState
        title="Failed to load automation metrics"
        description="Could not query execution data from the engine."
        onRetry={() => void overviewQuery.refetch()}
      />
    );
  }

  const data: AutomationOverviewData = overviewQuery.data;
  const goTo = (tab: AutomationCenterTab) => {
    if (onNavigateTab) onNavigateTab(tab);
    else navigate(automationPath(slug, tab));
  };

  const maxVolume = Math.max(1, ...data.volumeByDay.map((d) => d.total));

  return (
    <div className="space-y-6">
      {/* Pending approvals alert banner if any */}
      {data.pendingApprovalsCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-5 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {data.pendingApprovalsCount} automation {data.pendingApprovalsCount === 1 ? 'action requires' : 'actions require'} your approval
              </p>
              <p className="text-xs text-muted-foreground">
                Workflows paused at human-in-the-loop checkpoints are waiting for sign-off.
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => goTo('approvals')}>
            Review approvals <ArrowRight className="ml-1 size-3.5" />
          </Button>
        </div>
      )}

      {/* Top 4 KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Automations */}
        <Card className="rounded-xl border border-border/80 bg-surface shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Total Automations
            </CardTitle>
            <Workflow className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{data.totalWorkflows}</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1 font-medium text-success">
                <span className="size-1.5 rounded-full bg-success" />
                {data.activeWorkflows} active
              </span>
              <span>·</span>
              <span className="text-muted-foreground">{data.pausedWorkflows} paused</span>
            </div>
          </CardContent>
        </Card>

        {/* Total Executions & Success Rate */}
        <Card className="rounded-xl border border-border/80 bg-surface shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Executions & Reliability
            </CardTitle>
            <TrendingUp className="size-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-bold text-foreground">
                {data.successfulExecutions + data.failedExecutions}
              </div>
              <Badge variant={data.successRate >= 95 ? 'success' : data.successRate >= 80 ? 'warning' : 'destructive'}>
                {data.successRate}% success
              </Badge>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{data.successfulExecutions} succeeded</span>
              <span>·</span>
              <span className="text-destructive">{data.failedExecutions} failed</span>
              {data.runningExecutions > 0 && (
                <>
                  <span>·</span>
                  <span className="font-semibold text-primary">{data.runningExecutions} running</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Average & p95 Latency */}
        <Card className="rounded-xl border border-border/80 bg-surface shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Execution Speed
            </CardTitle>
            <Clock className="size-4 text-accent-cyan" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {data.avgDurationMs > 1000 ? `${(data.avgDurationMs / 1000).toFixed(1)}s` : `${data.avgDurationMs}ms`}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>p50: {data.p50DurationMs > 1000 ? `${(data.p50DurationMs / 1000).toFixed(1)}s` : `${data.p50DurationMs}ms`}</span>
              <span>·</span>
              <span>p95: {data.p95DurationMs > 1000 ? `${(data.p95DurationMs / 1000).toFixed(1)}s` : `${data.p95DurationMs}ms`}</span>
            </div>
          </CardContent>
        </Card>

        {/* Estimated Time Saved */}
        <Card className="rounded-xl border border-border/80 bg-surface shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Time Saved (Est.)
            </CardTitle>
            <Zap className="size-4 text-accent-amber" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              ~{data.estimatedTimeSavedHours} hrs
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Automated workflows vs manual effort
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Volume Bar Chart */}
      <Card className="rounded-xl border border-border/80 bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Execution Volume Trends</h3>
            <p className="text-xs text-muted-foreground">
              Daily workflow runs categorized by success and failure outcomes
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-success" />
              <span>Success</span>
              <span className="ml-2 size-2 rounded-full bg-destructive" />
              <span>Failed</span>
            </div>
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as typeof timeRange)}>
              <SelectTrigger className="h-8 w-28 text-xs">
                <SelectValue placeholder="Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="14d">Last 14 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {data.volumeByDay.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted-foreground">No execution history recorded yet.</div>
        ) : (
          <div className="grid grid-flow-col auto-cols-fr items-end gap-2 pt-4 pb-2" style={{ height: '140px' }}>
            {data.volumeByDay.map((day) => {
              const successHeight = Math.round((day.success / maxVolume) * 100);
              const failedHeight = Math.round((day.failed / maxVolume) * 100);
              const label = day.date.slice(5); // MM-DD
              return (
                <div key={day.date} className="group relative flex h-full flex-col justify-end items-center">
                  {/* Tooltip on hover */}
                  <div className="pointer-events-none absolute -top-8 z-10 hidden whitespace-nowrap rounded-md bg-popover px-2 py-1 text-[10px] text-popover-foreground shadow-md group-hover:block">
                    {day.date}: {day.success} ok, {day.failed} fail
                  </div>
                  <div className="w-full max-w-[28px] overflow-hidden rounded-t bg-muted/40 flex flex-col justify-end">
                    {day.failed > 0 && (
                      <div
                        className="w-full bg-destructive transition-all"
                        style={{ height: `${Math.max(4, failedHeight)}%` }}
                      />
                    )}
                    {day.success > 0 && (
                      <div
                        className="w-full bg-success transition-all"
                        style={{ height: `${Math.max(4, successHeight)}%` }}
                      />
                    )}
                  </div>
                  <span className="mt-2 text-[10px] text-muted-foreground truncate w-full text-center">
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Two Column Layout: Top & Failing Workflows vs Upcoming Schedules & Connectors */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Most Frequent & Failing Workflows */}
        <div className="space-y-6">
          <Card className="rounded-xl border border-border/80 bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between pb-3">
              <h3 className="text-sm font-semibold text-foreground">Most Frequently Executed</h3>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => goTo('workflows')}>
                View all
              </Button>
            </div>
            {data.topWorkflows.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No workflows executed yet.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {data.topWorkflows.map((wf) => (
                  <div key={wf.id} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0 pr-2">
                      <p className="truncate text-xs font-medium text-foreground">{wf.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {wf.executionsCount} runs · {wf.avgDurationMs}ms avg
                      </p>
                    </div>
                    <Badge variant={wf.failureRate === 0 ? 'success' : wf.failureRate > 20 ? 'destructive' : 'warning'}>
                      {100 - wf.failureRate}% ok
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {data.failingWorkflows.length > 0 && (
            <Card className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 shadow-sm">
              <div className="flex items-center gap-2 pb-2 text-destructive">
                <AlertCircle className="size-4" />
                <h3 className="text-sm font-semibold">Workflows Requiring Attention</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Workflows with the highest failure rate in recent runs:
              </p>
              <div className="space-y-2">
                {data.failingWorkflows.map((wf) => (
                  <div
                    key={wf.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/20 bg-background/80 p-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{wf.name}</p>
                      <p className="text-[11px] text-destructive truncate">
                        {wf.lastError || `${wf.failCount} runs failed (${wf.failureRate}%)`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-destructive border-destructive/30"
                      onClick={() => goTo('errors')}
                    >
                      Inspect error
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Upcoming Schedules & Connector Health */}
        <div className="space-y-6">
          <Card className="rounded-xl border border-border/80 bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between pb-3">
              <h3 className="text-sm font-semibold text-foreground">Upcoming Scheduled Runs</h3>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => goTo('schedules')}>
                Timetable
              </Button>
            </div>
            {data.upcomingScheduled.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No active scheduled workflows.</p>
            ) : (
              <div className="divide-y divide-border/60">
                {data.upcomingScheduled.map((s) => (
                  <div key={s.workflowId} className="flex items-center justify-between py-2.5">
                    <div className="min-w-0 pr-2">
                      <p className="truncate text-xs font-medium text-foreground">{s.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {s.humanSchedule} {s.timezone ? `(${s.timezone})` : ''}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-mono text-primary font-medium">
                        {s.nextRunAt ? formatRelative(s.nextRunAt) : 'Pending'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="rounded-xl border border-border/80 bg-surface p-4 shadow-sm">
            <div className="flex items-center justify-between pb-3">
              <h3 className="text-sm font-semibold text-foreground">App Connector Health</h3>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => goTo('connections')}>
                Manage apps
              </Button>
            </div>
            {data.connectorHealth.length === 0 ? (
              <div className="py-3 text-center text-xs text-muted-foreground">
                No external connectors configured yet. Connect Slack, Gmail, GitHub or others in App Connections.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {data.connectorHealth.map((conn) => (
                  <div
                    key={conn.provider}
                    className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 p-2 text-xs"
                  >
                    <span
                      className={cn(
                        'size-2 shrink-0 rounded-full',
                        conn.status === 'CONNECTED' ? 'bg-success' : 'bg-muted-foreground',
                      )}
                    />
                    <span className="truncate font-medium text-foreground">{conn.name}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Recent Execution Activity Feed */}
      <Card className="rounded-xl border border-border/80 bg-surface p-4 shadow-sm">
        <div className="flex items-center justify-between pb-3">
          <h3 className="text-sm font-semibold text-foreground">Recent Automation Activity</h3>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => goTo('history')}>
            View full log
          </Button>
        </div>
        {data.recentExecutions.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">No recent execution activity.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {data.recentExecutions.map((run) => (
              <div key={run.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <Badge variant={run.status === 'SUCCESS' ? 'success' : run.status === 'FAILED' ? 'destructive' : 'warning'}>
                    {run.status}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{run.workflow.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Trigger: {run.workflow.triggerType} · {formatRelative(run.startedAt)}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => goTo('history')}
                >
                  View details
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
