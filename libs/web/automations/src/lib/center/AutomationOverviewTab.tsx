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
    return (
      <LoadingState label="Calculating automation telemetry and metrics…" />
    );
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
        <div className="gap-3 p-4 flex flex-wrap items-center justify-between rounded-xl border border-warning/40 bg-warning/10">
          <div className="gap-3 flex items-center">
            <ShieldCheck className="size-5 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {data.pendingApprovalsCount} automation{' '}
                {data.pendingApprovalsCount === 1
                  ? 'action requires'
                  : 'actions require'}{' '}
                your approval
              </p>
              <p className="text-xs text-muted-foreground">
                Workflows paused at human-in-the-loop checkpoints are waiting
                for sign-off.
              </p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => goTo('approvals')}>
            Review approvals <ArrowRight className="ml-1 size-3.5" />
          </Button>
        </div>
      )}

      {/* Top 4 KPI Cards */}
      <div className="gap-4 sm:grid-cols-2 lg:grid-cols-4 grid">
        {/* Total Automations */}
        <Card className="rounded-xl border border-border/80 bg-surface shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Total Automations
            </CardTitle>
            <Workflow className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {data.totalWorkflows}
            </div>
            <div className="mt-1 gap-2 text-xs flex items-center text-muted-foreground">
              <span className="gap-1 font-medium inline-flex items-center text-success">
                <span className="size-1.5 rounded-full bg-success" />
                {data.activeWorkflows} active
              </span>
              <span>·</span>
              <span className="text-muted-foreground">
                {data.pausedWorkflows} paused
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Total Executions & Success Rate */}
        <Card className="rounded-xl border border-border/80 bg-surface shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Executions & Reliability
            </CardTitle>
            <TrendingUp className="size-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="gap-2 flex items-baseline">
              <div className="text-2xl font-bold text-foreground">
                {data.successfulExecutions + data.failedExecutions}
              </div>
              <Badge
                variant={
                  data.successRate >= 95
                    ? 'success'
                    : data.successRate >= 80
                      ? 'warning'
                      : 'destructive'
                }
              >
                {data.successRate}% success
              </Badge>
            </div>
            <div className="mt-1 gap-2 text-xs flex items-center text-muted-foreground">
              <span>{data.successfulExecutions} succeeded</span>
              <span>·</span>
              <span className="text-destructive">
                {data.failedExecutions} failed
              </span>
              {data.runningExecutions > 0 && (
                <>
                  <span>·</span>
                  <span className="font-semibold text-primary">
                    {data.runningExecutions} running
                  </span>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Average & p95 Latency */}
        <Card className="rounded-xl border border-border/80 bg-surface shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Execution Speed
            </CardTitle>
            <Clock className="size-4 text-accent-cyan" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {data.avgDurationMs > 1000
                ? `${(data.avgDurationMs / 1000).toFixed(1)}s`
                : `${data.avgDurationMs}ms`}
            </div>
            <div className="mt-1 gap-2 text-xs flex items-center text-muted-foreground">
              <span>
                p50:{' '}
                {data.p50DurationMs > 1000
                  ? `${(data.p50DurationMs / 1000).toFixed(1)}s`
                  : `${data.p50DurationMs}ms`}
              </span>
              <span>·</span>
              <span>
                p95:{' '}
                {data.p95DurationMs > 1000
                  ? `${(data.p95DurationMs / 1000).toFixed(1)}s`
                  : `${data.p95DurationMs}ms`}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Estimated Time Saved */}
        <Card className="rounded-xl border border-border/80 bg-surface shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
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
      <Card className="p-5 rounded-xl border border-border/80 bg-surface shadow-sm">
        <div className="gap-3 pb-4 flex flex-wrap items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              Execution Volume Trends
            </h3>
            <p className="text-xs text-muted-foreground">
              Daily workflow runs categorized by success and failure outcomes
            </p>
          </div>
          <div className="gap-2 flex items-center">
            <div className="gap-1.5 text-xs flex items-center text-muted-foreground">
              <span className="size-2 rounded-full bg-success" />
              <span>Success</span>
              <span className="ml-2 size-2 rounded-full bg-destructive" />
              <span>Failed</span>
            </div>
            <Select
              value={timeRange}
              onValueChange={(v) => setTimeRange(v as typeof timeRange)}
            >
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
          <div className="py-8 text-xs text-center text-muted-foreground">
            No execution history recorded yet.
          </div>
        ) : (
          <div
            className="gap-2 pt-4 pb-2 grid auto-cols-fr grid-flow-col items-end"
            style={{ height: '140px' }}
          >
            {data.volumeByDay.map((day) => {
              const successHeight = Math.round((day.success / maxVolume) * 100);
              const failedHeight = Math.round((day.failed / maxVolume) * 100);
              const label = day.date.slice(5); // MM-DD
              return (
                <div
                  key={day.date}
                  className="group relative flex h-full flex-col items-center justify-end"
                >
                  {/* Tooltip on hover */}
                  <div className="-top-8 px-2 py-1 pointer-events-none absolute z-10 hidden rounded-md bg-popover text-2xs whitespace-nowrap text-popover-foreground shadow-md group-hover:block">
                    {day.date}: {day.success} ok, {day.failed} fail
                  </div>
                  <div className="rounded-t flex w-full max-w-[28px] flex-col justify-end overflow-hidden bg-muted/40">
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
                  <span className="mt-2 w-full truncate text-center text-2xs text-muted-foreground">
                    {label}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Two Column Layout: Top & Failing Workflows vs Upcoming Schedules & Connectors */}
      <div className="gap-6 lg:grid-cols-2 grid">
        {/* Most Frequent & Failing Workflows */}
        <div className="space-y-6">
          <Card className="p-4 rounded-xl border border-border/80 bg-surface shadow-sm">
            <div className="pb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Most Frequently Executed
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => goTo('workflows')}
              >
                View all
              </Button>
            </div>
            {data.topWorkflows.length === 0 ? (
              <p className="py-4 text-xs text-center text-muted-foreground">
                No workflows executed yet.
              </p>
            ) : (
              <div className="divide-y divide-border/60">
                {data.topWorkflows.map((wf) => (
                  <div
                    key={wf.id}
                    className="py-2.5 flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-medium truncate text-foreground">
                        {wf.name}
                      </p>
                      <p className="text-meta text-muted-foreground">
                        {wf.executionsCount} runs · {wf.avgDurationMs}ms avg
                      </p>
                    </div>
                    <Badge
                      variant={
                        wf.failureRate === 0
                          ? 'success'
                          : wf.failureRate > 20
                            ? 'destructive'
                            : 'warning'
                      }
                    >
                      {100 - wf.failureRate}% ok
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {data.failingWorkflows.length > 0 && (
            <Card className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 shadow-sm">
              <div className="gap-2 pb-2 flex items-center text-destructive">
                <AlertCircle className="size-4" />
                <h3 className="text-sm font-semibold">
                  Workflows Requiring Attention
                </h3>
              </div>
              <p className="text-xs mb-3 text-muted-foreground">
                Workflows with the highest failure rate in recent runs:
              </p>
              <div className="space-y-2">
                {data.failingWorkflows.map((wf) => (
                  <div
                    key={wf.id}
                    className="gap-2 p-2.5 flex flex-wrap items-center justify-between rounded-lg border border-destructive/20 bg-background/80"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium truncate text-foreground">
                        {wf.name}
                      </p>
                      <p className="truncate text-meta text-destructive">
                        {wf.lastError ||
                          `${wf.failCount} runs failed (${wf.failureRate}%)`}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-destructive/30 text-destructive"
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
          <Card className="p-4 rounded-xl border border-border/80 bg-surface shadow-sm">
            <div className="pb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Upcoming Scheduled Runs
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => goTo('schedules')}
              >
                Timetable
              </Button>
            </div>
            {data.upcomingScheduled.length === 0 ? (
              <p className="py-4 text-xs text-center text-muted-foreground">
                No active scheduled workflows.
              </p>
            ) : (
              <div className="divide-y divide-border/60">
                {data.upcomingScheduled.map((s) => (
                  <div
                    key={s.workflowId}
                    className="py-2.5 flex items-center justify-between"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-medium truncate text-foreground">
                        {s.name}
                      </p>
                      <p className="text-meta text-muted-foreground">
                        {s.humanSchedule} {s.timezone ? `(${s.timezone})` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="text-xs font-medium font-mono text-primary">
                        {s.nextRunAt ? formatRelative(s.nextRunAt) : 'Pending'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-4 rounded-xl border border-border/80 bg-surface shadow-sm">
            <div className="pb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                App Connector Health
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => goTo('connections')}
              >
                Manage apps
              </Button>
            </div>
            {data.connectorHealth.length === 0 ? (
              <div className="py-3 text-xs text-center text-muted-foreground">
                No external connectors configured yet. Connect Slack, Gmail,
                GitHub or others in App Connections.
              </div>
            ) : (
              <div className="gap-2 sm:grid-cols-3 grid grid-cols-2">
                {data.connectorHealth.map((conn) => (
                  <div
                    key={conn.provider}
                    className="gap-2 p-2 text-xs flex items-center rounded-lg border border-border/60 bg-muted/20"
                  >
                    <span
                      className={cn(
                        'size-2 shrink-0 rounded-full',
                        conn.status === 'CONNECTED'
                          ? 'bg-success'
                          : 'bg-muted-foreground',
                      )}
                    />
                    <span className="font-medium truncate text-foreground">
                      {conn.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Recent Execution Activity Feed */}
      <Card className="p-4 rounded-xl border border-border/80 bg-surface shadow-sm">
        <div className="pb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">
            Recent Automation Activity
          </h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => goTo('history')}
          >
            View full log
          </Button>
        </div>
        {data.recentExecutions.length === 0 ? (
          <p className="py-4 text-xs text-center text-muted-foreground">
            No recent execution activity.
          </p>
        ) : (
          <div className="divide-y divide-border/60">
            {data.recentExecutions.map((run) => (
              <div
                key={run.id}
                className="gap-2 py-2.5 flex flex-wrap items-center justify-between"
              >
                <div className="gap-3 min-w-0 flex items-center">
                  <Badge
                    variant={
                      run.status === 'SUCCESS'
                        ? 'success'
                        : run.status === 'FAILED'
                          ? 'destructive'
                          : 'warning'
                    }
                  >
                    {run.status}
                  </Badge>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate text-foreground">
                      {run.workflow.name}
                    </p>
                    <p className="text-meta text-muted-foreground">
                      Trigger: {run.workflow.triggerType} ·{' '}
                      {formatRelative(run.startedAt)}
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
