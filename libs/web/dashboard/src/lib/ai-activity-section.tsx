import { aiExecutionsApi, approvalsApi, queryKeys } from '@org/api-client';
import type { AIExecutionFilter } from '@org/types';
import { Badge, Card, CardContent, SkeletonList } from '@org/ui';
import { formatRelative } from '@org/utils';
import { useWorkspaceCoworkerLogs } from '@org/web-coworkers';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronRight, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';

const DAY_MS = 86_400_000;

/** Runs from the last day — same query key as the Runs screen, so one cache. */
function useRecentRuns(workspaceId: string | undefined) {
  // Rounded to the hour so the key (and the cache) is stable between renders.
  const startDate = useMemo(
    () => new Date(Math.floor((Date.now() - DAY_MS) / 3_600_000) * 3_600_000).toISOString(),
    [],
  );
  const filters: AIExecutionFilter = { startDate, limit: 100 };
  return useQuery({
    queryKey: queryKeys.aiExecutions.list(workspaceId ?? '', filters as Record<string, unknown>),
    queryFn: () => aiExecutionsApi.list(workspaceId as string, filters),
    enabled: Boolean(workspaceId),
    refetchInterval: (query) =>
      query.state.data?.some((r) => r.status === 'RUNNING') ? 5_000 : 60_000,
  });
}

function usePendingApprovals(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.approvals.list(workspaceId ?? '', 'PENDING'),
    queryFn: () => approvalsApi.list(workspaceId as string, 'PENDING'),
    enabled: Boolean(workspaceId),
    refetchInterval: 30_000,
  });
}

function humanize(action: string): string {
  return action.replace(/^builtin:/, '').replace(/[_.:]+/g, ' ').trim();
}

/**
 * AI Home's "AI activity" block: what coworkers, agents and workflows did, what
 * they are doing now, what failed, and what is waiting on a person — so no AI
 * action is hidden from the people it works for.
 */
export function AIActivitySection({ workspaceId, slug }: { workspaceId: string | undefined; slug: string }) {
  const runs = useRecentRuns(workspaceId);
  const approvals = usePendingApprovals(workspaceId);
  const coworkerLogs = useWorkspaceCoworkerLogs(workspaceId);

  const runList = (runs.data ?? []).filter((r) => r.stateJson?.['__mode'] !== 'test');
  const running = runList.filter((r) => r.status === 'RUNNING').length;
  const waiting = runList.filter((r) => r.status === 'WAITING_APPROVAL').length;
  const failed = runList.filter((r) => r.status === 'FAILED').length;
  const completed = runList.filter((r) => r.status === 'COMPLETED').length;
  const pending = (approvals.data ?? []).filter((a) => a.canDecide !== false);
  const recentCoworker = (coworkerLogs.data ?? []).slice(0, 5);

  const stats = [
    { label: 'Running', value: running, tone: 'text-primary', href: 'ai/runs' },
    { label: 'Waiting', value: waiting, tone: 'text-amber-500', href: 'ai/approvals' },
    { label: 'Failed', value: failed, tone: failed ? 'text-destructive' : 'text-foreground', href: 'ai/runs' },
    { label: 'Done', value: completed, tone: 'text-foreground', href: 'ai/runs' },
  ];

  return (
    <section className="space-y-3" aria-labelledby="ai-activity-heading">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" aria-hidden />
          <h2 id="ai-activity-heading" className="text-sm font-semibold tracking-tight text-foreground">
            AI Activity
          </h2>
          {running > 0 ? (
            <Badge variant="primary" className="h-4 gap-1 px-1.5 py-0 text-[10px]">
              <Loader2 className="size-2.5 animate-spin" aria-hidden />
              {running} running
            </Badge>
          ) : null}
        </div>
        <Link to={`/w/${slug}/ai/runs`} className="text-[11px] text-muted-foreground hover:text-foreground">
          All runs
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {/* Last 24 hours at a glance */}
        <Card>
          <CardContent className="space-y-3 p-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Last 24 hours</p>
            {runs.isLoading ? (
              <SkeletonList rows={1} />
            ) : runs.isError ? (
              <p className="text-xs text-muted-foreground">Runs couldn’t be loaded.</p>
            ) : (
              <div className="grid grid-cols-4 gap-1.5">
                {stats.map((s) => (
                  <Link
                    key={s.label}
                    to={`/w/${slug}/${s.href}`}
                    className="rounded-md border border-border bg-accent/30 p-2 text-center transition-colors hover:bg-accent/60"
                  >
                    <div className={`text-base font-bold ${s.tone}`}>{s.value}</div>
                    <div className="truncate text-[10px] text-muted-foreground">{s.label}</div>
                  </Link>
                ))}
              </div>
            )}
            {pending.length > 0 ? (
              <div className="space-y-1.5 border-t border-border/60 pt-2">
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-foreground">
                  <ShieldCheck className="size-3.5 text-amber-500" aria-hidden />
                  {pending.length} waiting for your approval
                </p>
                {pending.slice(0, 3).map((a) => (
                  <Link
                    key={a.id}
                    to={`/w/${slug}/ai/approvals`}
                    className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1 text-[11px] hover:bg-accent/40"
                  >
                    <span className="truncate capitalize text-foreground">{humanize(a.actionType)}</span>
                    <span className="shrink-0 text-muted-foreground">{formatRelative(a.createdAt)}</span>
                  </Link>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* What coworkers did */}
        <Card className="lg:col-span-2">
          <CardContent className="space-y-1 p-3">
            <p className="pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Coworkers</p>
            {coworkerLogs.isLoading ? (
              <SkeletonList rows={3} />
            ) : recentCoworker.length === 0 ? (
              <div className="flex items-center justify-between gap-3 py-2">
                <p className="text-xs text-muted-foreground">
                  No coworker activity yet. Ask Scheduler for a reminder or Tracker to watch a project.
                </p>
                <Link
                  to={`/w/${slug}/directory`}
                  className="shrink-0 text-[11px] font-medium text-primary hover:underline"
                >
                  Meet your coworkers
                </Link>
              </div>
            ) : (
              recentCoworker.map((log) => (
                <Link
                  key={log.id}
                  to={`/w/${slug}/coworkers/${log.agent.id}`}
                  className="flex items-center justify-between gap-3 rounded-md px-1.5 py-1.5 transition-colors hover:bg-accent/40"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {log.status === 'FAILED' ? (
                      <AlertTriangle className="size-3.5 shrink-0 text-destructive" aria-label="Failed" />
                    ) : (
                      <Sparkles className="size-3.5 shrink-0 text-primary" aria-hidden />
                    )}
                    <span className="shrink-0 text-xs font-medium text-foreground">{log.agent.name}</span>
                    <span className="truncate text-[11px] text-muted-foreground">
                      {(log.outputResult || log.promptText).split('\n')[0]}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">{formatRelative(log.executedAt)}</span>
                    <ChevronRight className="size-3 text-muted-foreground" aria-hidden />
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
