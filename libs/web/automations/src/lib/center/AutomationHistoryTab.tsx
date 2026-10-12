import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Button,
  EmptyState,
  ErrorState,
  LoadingState,
  toast,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Clock,
  ExternalLink,
  History,
  RotateCcw,
} from 'lucide-react';
import {
  useWorkflowMutations,
  useWorkspaceExecutions,
} from '../use-automations.js';

export function AutomationHistoryTab() {
  const navigate = useNavigate();
  const { workspaceId, slug } = useCurrentWorkspace();
  const runsQuery = useWorkspaceExecutions(workspaceId);
  const { trigger } = useWorkflowMutations(workspaceId);

  const runs = runsQuery.data ?? [];

  const handleRetry = (workflowId: string) => {
    trigger.mutate(
      { workflowId },
      {
        onSuccess: () => {
          runsQuery.refetch();
          toast.success('Retried workflow successfully');
        },
        onError: (err: unknown) => {
          toast.error(`Could not retry run: ${err instanceof Error ? err.message : 'Unknown error'}`);
        },
      },
    );
  };

  if (runsQuery.isLoading) {
    return <LoadingState label="Loading execution history…" />;
  }

  if (runsQuery.isError) {
    return (
      <ErrorState
        title="Could not load execution history"
        onRetry={() => runsQuery.refetch()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-semibold text-lg text-foreground flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Execution History & Audit Trail ({runs.length})
          </h3>
          <p className="text-sm text-muted-foreground">
            Complete record of all automated workflow executions, trigger sources, duration, and terminal statuses.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => runsQuery.refetch()}
          disabled={runsQuery.isFetching}
        >
          Refresh History
        </Button>
      </div>

      {runs.length === 0 ? (
        <EmptyState
          icon={<History className="size-8" />}
          title="No execution history yet"
          description="Runs from manual tests, scheduled jobs, webhooks, or platform events will appear here once executed."
        />
      ) : (
        <div className="border rounded-lg overflow-hidden bg-card divide-y divide-border/60">
          {runs.map((r) => {
            const isSuccess = r.status === 'COMPLETED' || r.status === 'SUCCESS';
            const isFailed = r.status === 'FAILED';
            const durationMs =
              r.finishedAt && r.startedAt
                ? Math.max(0, new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime())
                : null;

            return (
              <div
                key={r.id}
                className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <span className="font-semibold text-sm text-foreground">
                      {r.workflow?.name ?? 'Workflow Execution'}
                    </span>
                    <Badge
                      variant={isSuccess ? 'success' : isFailed ? 'destructive' : 'secondary'}
                      className="text-[10px]"
                    >
                      {r.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      #{r.id.slice(0, 8)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {r.startedAt ? formatRelative(r.startedAt) : 'Recently'}
                    </span>
                    {r.workflow?.triggerType && (
                      <span className="capitalize">
                        Trigger: <span className="font-medium text-foreground">{r.workflow.triggerType}</span>
                      </span>
                    )}
                    {durationMs !== null && (
                      <span>Duration: {durationMs}ms</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isFailed && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs gap-1"
                      onClick={() => handleRetry(r.workflowId)}
                      disabled={trigger.isPending}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Retry
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs gap-1"
                    onClick={() => navigate(`/w/${slug}/automations?tab=runs&run=${r.id}`)}
                  >
                    View Details
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
