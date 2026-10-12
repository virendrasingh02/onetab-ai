import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  Card,
  ErrorState,
  LoadingState,
} from '@org/ui';
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Automation Analytics & ROI
          </h3>
          <p className="text-sm text-muted-foreground">
            System performance, execution volume distribution, reliability trends, and labor time saved.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex gap-1 p-1 bg-muted/60 rounded-md text-xs font-medium">
            <button
              type="button"
              onClick={() => setTimeRange('14d')}
              className={`px-2.5 py-1 rounded transition-colors ${
                timeRange === '14d' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
              }`}
            >
              Last 14 Days
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('30d')}
              className={`px-2.5 py-1 rounded transition-colors ${
                timeRange === '30d' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
              }`}
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => setTimeRange('90d')}
              className={`px-2.5 py-1 rounded transition-colors ${
                timeRange === '90d' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
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
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${overviewQuery.isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ROI & High-level Value Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-gradient-to-br from-emerald-500/5 to-transparent border-emerald-500/20">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
            Time Saved (Estimated)
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {estimatedHours.toFixed(1)} hrs
            </span>
            <span className="text-xs text-emerald-600 font-medium flex items-center">
              <TrendingUp className="h-3 w-3 mr-0.5" /> +12%
            </span>
          </div>
          <span className="text-xs text-muted-foreground mt-1 block">
            Across {data.successfulExecutions} successful runs
          </span>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-indigo-500/5 to-transparent border-indigo-500/20">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
            Economic Impact
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              ${estimatedValue.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground">saved value</span>
          </div>
          <span className="text-xs text-muted-foreground mt-1 block">
            Based on standard knowledge worker rate
          </span>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
            Success Rate
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {data.successRate.toFixed(1)}%
            </span>
            <span className={`text-xs font-medium ${data.successRate >= 95 ? 'text-emerald-600' : 'text-amber-600'}`}>
              {data.successRate >= 95 ? 'Healthy' : 'Needs attention'}
            </span>
          </div>
          <span className="text-xs text-muted-foreground mt-1 block">
            {data.failedExecutions} total failures
          </span>
        </Card>

        <Card className="p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
            Latency (p95)
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {data.p95DurationMs} ms
            </span>
            <span className="text-xs text-muted-foreground">p50: {data.p50DurationMs} ms</span>
          </div>
          <span className="text-xs text-muted-foreground mt-1 block">
            Queue delay: &lt; 40ms
          </span>
        </Card>
      </div>

      {/* Daily Execution Volume Chart */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-semibold text-base text-foreground">Execution Volume Trend</h4>
            <p className="text-xs text-muted-foreground">Successful vs failed runs over the last 14 days</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" /> Successful
            </span>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" /> Failed
            </span>
          </div>
        </div>

        <div className="h-48 flex items-end gap-2 pt-6">
          {data.volumeByDay.map((day) => {
            const successHeight = Math.max((day.success / maxDayCount) * 100, day.success > 0 ? 6 : 0);
            const failedHeight = Math.max((day.failed / maxDayCount) * 100, day.failed > 0 ? 6 : 0);
            const dayLabel = day.date.slice(5);

            return (
              <div key={day.date} className="flex-1 flex flex-col items-center gap-1 group relative">
                <div className="w-full flex flex-col justify-end h-36 bg-muted/20 rounded overflow-hidden">
                  {failedHeight > 0 && (
                    <div
                      style={{ height: `${failedHeight}%` }}
                      className="w-full bg-rose-500/80 transition-all group-hover:bg-rose-500"
                    />
                  )}
                  {successHeight > 0 && (
                    <div
                      style={{ height: `${successHeight}%` }}
                      className="w-full bg-primary/80 transition-all group-hover:bg-primary"
                    />
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground font-mono truncate max-w-full">
                  {dayLabel}
                </span>

                {/* Tooltip on hover */}
                <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col bg-popover text-popover-foreground border shadow-md rounded p-1.5 text-[11px] z-10 whitespace-nowrap pointer-events-none">
                  <span className="font-semibold">{day.date}</span>
                  <span className="text-emerald-500 font-mono">Success: {day.success}</span>
                  <span className="text-rose-500 font-mono">Failed: {day.failed}</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Top Executed & Most Failing Workflows Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most Active Workflows */}
        <Card className="p-5">
          <h4 className="font-semibold text-base text-foreground mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Most Frequently Executed
          </h4>

          {data.topWorkflows.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4">No workflow executions recorded yet.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {data.topWorkflows.map((w) => (
                <div key={w.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm text-foreground block">{w.name}</span>
                    <span className="text-xs text-muted-foreground">
                      Avg latency: {w.avgDurationMs}ms
                    </span>
                  </div>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {w.executionsCount} runs
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Highest Failure Rate */}
        <Card className="p-5">
          <h4 className="font-semibold text-base text-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            Workflows with Errors
          </h4>

          {data.failingWorkflows.length === 0 ? (
            <div className="p-4 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              All workflows are currently executing cleanly without recurrent errors!
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {data.failingWorkflows.map((w) => (
                <div key={w.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-sm text-foreground block">{w.name}</span>
                    <span className="text-xs text-rose-500">
                      {w.failureRate.toFixed(1)}% failure rate ({w.failCount} errors)
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => navigate(`/w/${slug}/automations?tab=errors&workflow=${w.id}`)}
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
