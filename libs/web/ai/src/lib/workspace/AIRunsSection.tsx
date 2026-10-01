import { aiFeedbackApi } from '@org/api-client';
import type { AIExecution, AIExecutionFilter, AIExecutionStatus } from '@org/types';
import {
  AIRunStatusBadge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Hint,
  LoadingState,
  SegmentedControl,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  toast,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import { useMutation } from '@tanstack/react-query';
import { Activity, ExternalLink, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { aiWorkspacePath } from './ai-workspace-routes.js';
import { RunDetailPanel } from './runs/RunDetailPanel.js';
import {
  errorText,
  useAIRun,
  useAIRuns,
  useRunSubjects,
  useWorkspaceIds,
  type RunSubject,
} from './use-ai-workspace.js';

type TypeFilter = 'ALL' | 'AGENT' | 'COWORKER' | 'WORKFLOW';
type StatusFilter = 'ALL' | AIExecutionStatus;

const TYPE_OPTIONS = [
  { value: 'ALL', label: 'All' },
  { value: 'AGENT', label: 'Agents' },
  { value: 'COWORKER', label: 'Coworkers' },
  { value: 'WORKFLOW', label: 'Workflows' },
] as const;

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Any status' },
  { value: 'RUNNING', label: 'Running' },
  { value: 'WAITING_APPROVAL', label: 'Waiting' },
  { value: 'PAUSED', label: 'Paused' },
  { value: 'FAILED', label: 'Failed' },
  { value: 'COMPLETED', label: 'Completed' },
] as const;

/**
 * Every agent, coworker and workflow run in one list — the single run history
 * that replaced the agent monitor, the workflow logs and both studios' execution
 * pages. Filters and the open run live in the URL, so a link to a failed run
 * lands on it.
 */
export function AIRunsSection() {
  const { workspaceId, slug } = useWorkspaceIds();
  const [params, setParams] = useSearchParams();
  const type = (params.get('type') as TypeFilter) || 'ALL';
  const status = (params.get('status') as StatusFilter) || 'ALL';
  const openRunId = params.get('run');

  const filters: AIExecutionFilter = {
    ...(type !== 'ALL' ? { entityType: type } : {}),
    ...(status !== 'ALL' ? { status } : {}),
    ...(params.get('entity') ? { entityId: params.get('entity') as string } : {}),
    limit: 100,
  };
  const runs = useAIRuns(workspaceId, filters);
  const subjects = useRunSubjects(workspaceId);

  const setParam = (key: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value && value !== 'ALL') next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: key !== 'run' },
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SegmentedControl
          aria-label="Filter runs by type"
          size="sm"
          options={TYPE_OPTIONS}
          value={type}
          onChange={(v) => setParam('type', v)}
        />
        <SegmentedControl
          aria-label="Filter runs by status"
          size="sm"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(v) => setParam('status', v)}
        />
        {params.get('entity') ? (
          <Button variant="ghost" size="sm" onClick={() => setParam('entity', null)}>
            Showing one {subjects.get(params.get('entity') as string)?.kind ?? 'item'} · Clear
          </Button>
        ) : null}
      </div>

      {runs.isLoading ? (
        <LoadingState label="Loading runs…" />
      ) : runs.isError ? (
        <ErrorState title="Couldn't load runs" onRetry={() => void runs.refetch()} />
      ) : (runs.data ?? []).length === 0 ? (
        <EmptyState
          icon={<Activity />}
          title={type === 'ALL' && status === 'ALL' ? 'No runs yet' : 'No runs match these filters'}
          description="Runs appear here when an agent answers, is tested or runs on a schedule, and when a workflow is triggered."
        />
      ) : (
        <Card className="divide-y divide-border overflow-hidden p-0">
          {(runs.data ?? []).map((run) => (
            <RunRow
              key={run.id}
              run={run}
              subject={subjects.get(run.entityId)}
              onOpen={() => setParam('run', run.id)}
            />
          ))}
        </Card>
      )}

      <RunDetailSheet
        workspaceId={workspaceId}
        slug={slug}
        runId={openRunId}
        subject={openRunId ? subjects.get(runs.data?.find((r) => r.id === openRunId)?.entityId ?? '') : undefined}
        onClose={() => setParam('run', null)}
      />
    </div>
  );
}

function RunRow({ run, subject, onOpen }: { run: AIExecution; subject?: RunSubject; onOpen: () => void }) {
  const prompt = typeof run.stateJson?.['prompt'] === 'string' ? (run.stateJson['prompt'] as string) : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
    >
      <div className="flex min-w-0 items-center gap-3">
        <AIRunStatusBadge status={run.status} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-foreground">{subject?.name ?? 'Deleted item'}</span>
            <span className="shrink-0 text-xs capitalize text-muted-foreground">
              {subject?.kind ?? run.entityType.toLowerCase()}
            </span>
          </div>
          {prompt ? <p className="truncate text-xs text-muted-foreground">{prompt}</p> : null}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-4 text-xs tabular-nums text-muted-foreground">
        <span className="hidden sm:inline">{run.tokensUsed.toLocaleString()} tokens</span>
        <span className="hidden md:inline">{(run.latencyMs / 1000).toFixed(1)}s</span>
        <span>{formatRelative(run.startedAt)}</span>
      </div>
    </button>
  );
}

function RunDetailSheet({
  workspaceId,
  slug,
  runId,
  subject,
  onClose,
}: {
  workspaceId: string | undefined;
  slug: string | undefined;
  runId: string | null;
  subject?: RunSubject;
  onClose: () => void;
}) {
  const run = useAIRun(workspaceId, runId);
  const feedback = useMutation({
    mutationFn: (rating: 1 | -1) =>
      aiFeedbackApi.submit(workspaceId as string, { executionId: runId as string, rating }),
    onSuccess: () => toast.success('Thanks — feedback recorded'),
    onError: (err) => toast.error('Could not save feedback', { description: errorText(err) }),
  });

  const data = run.data;
  const kind = subject?.kind;
  const openLink =
    data && kind
      ? kind === 'workflow'
        ? aiWorkspacePath(slug, 'studio', data.entityId)
        : aiWorkspacePath(slug, 'agents', data.entityId)
      : null;

  return (
    <Sheet open={Boolean(runId)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{subject?.name ?? 'Run'}</SheetTitle>
          <SheetDescription>{data ? `Run ${data.id.slice(0, 8)}` : 'Loading…'}</SheetDescription>
        </SheetHeader>
        {runId ? (
          <div className="space-y-4 px-4 pb-6">
            <div className="flex flex-wrap items-center gap-2">
              {openLink ? (
                <Button variant="outline" size="sm" asChild leadingIcon={<ExternalLink />}>
                  <Link to={openLink}>Open {kind === 'workflow' ? 'agent' : kind}</Link>
                </Button>
              ) : null}
              <div className="ml-auto flex items-center gap-1">
                <Hint label="Good result">
                  <Button variant="ghost" size="icon-sm" aria-label="Good result" onClick={() => feedback.mutate(1)}>
                    <ThumbsUp className="size-4" />
                  </Button>
                </Hint>
                <Hint label="Bad result">
                  <Button variant="ghost" size="icon-sm" aria-label="Bad result" onClick={() => feedback.mutate(-1)}>
                    <ThumbsDown className="size-4" />
                  </Button>
                </Hint>
              </div>
            </div>
            <RunDetailPanel
              workspaceId={workspaceId}
              slug={slug}
              runId={runId}
              permissionsHref={kind === 'workflow' && data ? `${aiWorkspacePath(slug, 'studio', data.entityId)}?tab=plan` : undefined}
            />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
