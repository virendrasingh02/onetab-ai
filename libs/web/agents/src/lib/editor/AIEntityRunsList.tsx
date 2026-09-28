import { AIRunStatusBadge, Button, Card, EmptyState, LoadingState } from '@org/ui';
import { formatRelative } from '@org/utils';
import { Activity, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAgentRuns } from './use-agent-editor.js';

function aiPath(slug: string | undefined, ...rest: string[]) {
  return [`/w/${slug ?? ''}/ai`, ...rest].join('/');
}

/**
 * One agent's or coworker's runs, newest first, each opening in the AI
 * Workspace's Runs view — shared by the agent and coworker editors.
 */
export function AIEntityRunsList({
  workspaceId,
  slug,
  entityId,
  onTest,
}: {
  workspaceId: string | undefined;
  slug: string | undefined;
  entityId: string;
  /** Offered in the empty state when the entity can be tested from here. */
  onTest?: () => void;
}) {
  const runs = useAgentRuns(workspaceId, entityId);
  if (runs.isLoading) return <LoadingState label="Loading runs…" />;
  if ((runs.data ?? []).length === 0) {
    return (
      <EmptyState
        icon={<Activity />}
        title="No runs yet"
        description="Test it, message it, or let a schedule run it — every run is recorded here."
        action={
          onTest ? (
            <Button leadingIcon={<Play />} onClick={onTest}>
              Test it now
            </Button>
          ) : undefined
        }
      />
    );
  }
  return (
    <div className="mx-auto max-w-4xl space-y-3">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" asChild>
          <Link to={`${aiPath(slug, 'runs')}?entity=${entityId}`}>Open in Runs</Link>
        </Button>
      </div>
      <Card className="divide-y divide-border overflow-hidden p-0">
        {(runs.data ?? []).map((run) => {
          const prompt = typeof run.stateJson?.['prompt'] === 'string' ? (run.stateJson['prompt'] as string) : '';
          return (
            <Link
              key={run.id}
              to={`${aiPath(slug, 'runs')}?run=${run.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
            >
              <div className="flex min-w-0 items-center gap-3">
                <AIRunStatusBadge status={run.status} />
                <span className="truncate text-foreground">{prompt || 'Run'}</span>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {run.tokensUsed.toLocaleString()} tokens · {formatRelative(run.startedAt)}
              </span>
            </Link>
          );
        })}
      </Card>
    </div>
  );
}

