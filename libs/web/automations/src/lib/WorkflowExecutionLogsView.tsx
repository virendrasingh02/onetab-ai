import {
  Badge,
  EmptyState,
  ErrorState,
  Page,
  PageHeader,
  Panel,
  SkeletonList,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@org/ui';
import { useCurrentWorkspace } from '@org/web-workspace';
import { formatDistanceToNow } from 'date-fns';
import { Activity, AlertCircle, CheckCircle } from 'lucide-react';
import { useWorkspaceExecutions } from './use-automations.js';

/** `stepResults` is a JSON array of per-node results; its length is the count. */
function stepCount(stepResults: string): number | null {
  try {
    const parsed: unknown = JSON.parse(stepResults);
    return Array.isArray(parsed) ? parsed.length : null;
  } catch {
    return null;
  }
}

/** Sub-second runs read better as milliseconds than as "0.1s". */
function formatDuration(startedAt: string, finishedAt: string): string {
  const ms = new Date(finishedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

export function WorkflowExecutionLogsView() {
  const { workspaceId } = useCurrentWorkspace();
  const executions = useWorkspaceExecutions(workspaceId);

  return (
    <Page>
      <PageHeader
        title="Execution logs"
        description="Audit trail, step payloads and run timings for every workflow."
        icon={<Activity />}
        accent="green"
      />

      <Panel flush>
        {executions.isLoading ? (
          <div className="p-4">
            <SkeletonList rows={5} />
          </div>
        ) : executions.isError ? (
          <ErrorState
            title="Could not load execution logs"
            description="Something went wrong reaching the server."
            onRetry={() => executions.refetch()}
          />
        ) : (executions.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<Activity />}
            title="No workflow runs yet"
            description="Trigger a workflow and its run history will appear here."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Workflow</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Steps</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {executions.data?.map((execution) => {
                const steps = stepCount(execution.stepResults);
                const succeeded = execution.status === 'SUCCESS';
                return (
                  <TableRow key={execution.id}>
                    <TableCell className="font-medium">
                      {execution.workflow.name}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-warning">
                      {execution.workflow.triggerType}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {steps === null ? '—' : `${steps} nodes`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={succeeded ? 'success' : 'destructive'}>
                        {succeeded ? (
                          <CheckCircle aria-hidden />
                        ) : (
                          <AlertCircle aria-hidden />
                        )}
                        {execution.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {formatDuration(
                        execution.startedAt,
                        execution.finishedAt,
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(execution.startedAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>
    </Page>
  );
}
