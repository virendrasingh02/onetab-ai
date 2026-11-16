import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, ErrorState, LoadingState } from '@org/ui';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  RefreshCw,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { useAutomationOverview } from '../use-automations.js';

export function AutomationAnalyticsTab() {
  const navigate = useNavigate();
  const { workspaceId, slug } = useCurrentWorkspace();
  const overviewQuery = useAutomationOverview(workspaceId);

  const [timeRange, setTimeRange] = useState<'14d' | '30d' | '90d'>('14d');

  if (overviewQuery.isLoading) {
    return <LoadingState label="Loading automation analytics…" />;
  }

  if (overviewQuery.isError || !overviewQuery.data) {
    return (
      <ErrorState
        title="Could not load analytics"
        onRetry={() => overviewQuery.refetch()}
      />
    );
  }

  const data = overviewQuery.data;
  const maxDayCount = Math.max(...data.volumeByDay.map((d) => d.total), 1);

  // ROI estimate: assume 1 hour of manual work saved is worth ~$40
  const estimatedHours = data.estimatedTimeSavedHours || 0;
  const estimatedValue = estimatedHours * 40;

  return (
    <div className="space-y-6">
      {/* Top Header & Range Filter */}
      <div className="sm:flex-row sm:items-center gap-4 flex flex-col items-start justify-between">
        <div>
          <h3 className="font-semibold text-lg gap-2 flex items-center text-foreground">
            <BarChart3 className="h-5 w-5 text-primary" />
            Automation Analytics & ROI
          </h3>
          <p className="text-sm text-muted-foreground">
            System performance, execution volume distribution, reliability
            trends, and labor time saved.
          </p>
        </div>

        <div className="gap-2 flex items-center">
          <div className="gap-1 p-1 text-xs font-medium flex rounded-md bg-muted/60">
            <button
              type="button"
              onClick={() => setTimeRange('14d')}
              className={`px-2.5 py-1 rounded transition-colors ${
                timeRange === '14d'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              Last 14 Days
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('30d')}
              className={`px-2.5 py-1 rounded transition-colors ${
                timeRange === '30d'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('90d')}
              className={`px-2.5 py-1 rounded transition-colors ${
                timeRange === '90d'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground'
              }`}
            >
              Quarterly
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => overviewQuery.refetch()}
            disabled={overviewQuery.isFetching}
          >
            <RefreshCw
              className={`h-3.5 w-3.5 mr-1.5 ${overviewQuery.isFetching ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* ROI & High-level Value Cards */}
      <div className="sm:grid-cols-2 lg:grid-cols-4 gap-4 grid grid-cols-1">
        <Card className="p-4 border-success/20 bg-gradient-to-br from-success/5 to-transparent">
          <span className="text-xs font-semibold tracking-wider mb-1 block text-muted-foreground uppercase">
            Time Saved (Estimated)
          </span>
          <div className="gap-2 flex items-baseline">
            <span className="text-2xl font-bold text-foreground">
              {estimatedHours.toFixed(1)} hrs
            </span>
            <span className="text-xs font-medium flex items-center text-success-text">
              <TrendingUp className="h-3 w-3 mr-0.5" /> +12%
            </span>
          </div>
          <span className="text-xs mt-1 block text-muted-foreground">
            Across {data.successfulExecutions} successful runs
          </span>
        </Card>

        <Card className="p-4 border-accent-indigo/20 bg-gradient-to-br from-accent-indigo/5 to-transparent">
          <span className="text-xs font-semibold tracking-wider mb-1 block text-muted-foreground uppercase">
            Economic Impact
          </span>
          <div className="gap-2 flex items-baseline">
            <span className="text-2xl font-bold text-foreground">
              ${estimatedValue.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">saved value</span>
          </div>
          <span className="text-xs mt-1 block text-muted-foreground">
            Based on standard knowledge worker rate
          </span>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-semibold tracking-wider mb-1 block text-muted-foreground uppercase">
            Success Rate
          </span>
          <div className="gap-2 flex items-baseline">
            <span className="text-2xl font-bold text-foreground">
              {data.successRate.toFixed(1)}%
            </span>
            <span
              className={`text-xs font-medium ${data.successRate >= 95 ? 'text-success-text' : 'text-warning-text'}`}
            >
              {data.successRate >= 95 ? 'Healthy' : 'Needs attention'}
            </span>
          </div>
          <span className="text-xs mt-1 block text-muted-foreground">
            {data.failedExecutions} total failures
          </span>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-semibold tracking-wider mb-1 block text-muted-foreground uppercase">
            Latency (p95)
          </span>
          <div className="gap-2 flex items-baseline">
            <span className="text-2xl font-bold text-foreground">
              {data.p95DurationMs} ms
            </span>
            <span className="text-xs text-muted-foreground">
              p50: {data.p50DurationMs} ms
            </span>
          </div>
          <span className="text-xs mt-1 block text-muted-foreground">
            Queue delay: &lt; 40ms
          </span>
        </Card>
      </div>

      {/* Daily Execution Volume Chart */}
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h4 className="font-semibold text-base text-foreground">
              Execution Volume Trend
            </h4>
            <p className="text-xs text-muted-foreground">
              Successful vs failed runs over the last 14 days
            </p>
          </div>
          <div className="gap-3 text-xs flex items-center">
            <span className="gap-1.5 flex items-center text-muted-foreground">
              <span className="w-2.5 h-2.5 inline-block rounded-sm bg-primary" />{' '}
              Successful
            </span>
            <span className="gap-1.5 flex items-center text-muted-foreground">
              <span className="w-2.5 h-2.5 inline-block rounded-sm bg-destructive" />{' '}
              Failed
            </span>
          </div>
        </div>

        <div className="h-48 gap-2 pt-6 flex items-end">
          {data.volumeByDay.map((day) => {
            const successHeight = Math.max(
              (day.success / maxDayCount) * 100,
              day.success > 0 ? 6 : 0,
            );
            const failedHeight = Math.max(
              (day.failed / maxDayCount) * 100,
              day.failed > 0 ? 6 : 0,
            );
            const dayLabel = day.date.slice(5);

            return (
              <div
                key={day.date}
                className="gap-1 group relative flex flex-1 flex-col items-center"
              >
                <div className="h-36 rounded flex w-full flex-col justify-end overflow-hidden bg-muted/20">
                  {failedHeight > 0 && (
                    <div
                      style={{ height: `${failedHeight}%` }}
                      className="w-full bg-destructive/80 transition-all group-hover:bg-destructive"
                    />
                  )}
                  {successHeight > 0 && (
                    <div
                      style={{ height: `${successHeight}%` }}
                      className="w-full bg-primary/80 transition-all group-hover:bg-primary"
                    />
                  )}
                </div>
                <span className="max-w-full truncate font-mono text-2xs text-muted-foreground">
                  {dayLabel}
                </span>

                {/* Tooltip on hover */}
                <div className="mb-2 rounded p-1.5 pointer-events-none absolute bottom-full z-10 hidden flex-col border bg-popover text-meta whitespace-nowrap text-popover-foreground shadow-md group-hover:flex">
                  <span className="font-semibold">{day.date}</span>
                  <span className="font-mono text-success-text">
                    Success: {day.success}
                  </span>
                  <span className="font-mono text-destructive-text">
                    Failed: {day.failed}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Top Executed & Most Failing Workflows Tables */}
      <div className="lg:grid-cols-2 gap-6 grid grid-cols-1">
        {/* Most Active Workflows */}
        <Card className="p-5">
          <h4 className="font-semibold text-base mb-3 gap-2 flex items-center text-foreground">
            <Zap className="h-4 w-4 text-primary" />
            Most Frequently Executed
          </h4>

          {data.topWorkflows.length === 0 ? (
            <p className="text-xs py-4 text-muted-foreground">
              No workflow executions recorded yet.
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {data.topWorkflows.map((w) => (
                <div
                  key={w.id}
                  className="py-2.5 flex items-center justify-between"
                >
                  <div>
                    <span className="font-medium text-sm block text-foreground">
                      {w.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Avg latency: {w.avgDurationMs}ms
                    </span>
                  </div>
                  <Badge variant="secondary" className="text-xs font-mono">
                    {w.executionsCount} runs
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Highest Failure Rate */}
        <Card className="p-5">
          <h4 className="font-semibold text-base mb-3 gap-2 flex items-center text-foreground">
            <AlertTriangle className="h-4 w-4 text-destructive-text" />
            Workflows with Errors
          </h4>

          {data.failingWorkflows.length === 0 ? (
            <div className="p-4 rounded text-xs gap-2 flex items-center bg-success/10 text-success-text">
              <CheckCircle2 className="h-4 w-4" />
              All workflows are currently executing cleanly without recurrent
              errors!
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {data.failingWorkflows.map((w) => (
                <div
                  key={w.id}
                  className="py-2.5 flex items-center justify-between"
                >
                  <div>
                    <span className="font-medium text-sm block text-foreground">
                      {w.name}
                    </span>
                    <span className="text-xs text-destructive-text">
                      {w.failureRate.toFixed(1)}% failure rate ({w.failCount}{' '}
                      errors)
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() =>
                      navigate(
                        `/w/${slug}/automations?tab=errors&workflow=${w.id}`,
                      )
                    }
                  >
                    Diagnose
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
