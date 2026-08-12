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
import { Activity, AlertCircle, CheckCircle, Wrench } from 'lucide-react';
import { useWorkspaceAgentLogs } from './use-agents.js';

/**
 * `toolCalls` is stored as a JSON string of tool definitions. The table shows
 * the first tool's name, which is what the column is for; anything unparseable
 * degrades to a dash rather than breaking the row.
 */
function firstToolName(toolCalls: string): string | null {
  try {
    const parsed: unknown = JSON.parse(toolCalls);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    const [first] = parsed as Array<{ name?: string } | string>;
    if (typeof first === 'string') return first;
    return first?.name ?? null;
  } catch {
    return null;
  }
}

export function AgentMonitoringView() {
  const { workspaceId } = useCurrentWorkspace();
  const logs = useWorkspaceAgentLogs(workspaceId);

  return (
    <Page>
      <PageHeader
        title="Agent telemetry"
        description="Tool call traces, execution audit logs and token usage."
        icon={<Activity />}
        accent="green"
      />

      <Panel flush>
        {logs.isLoading ? (
          <div className="p-4">
            <SkeletonList rows={5} />
          </div>
        ) : logs.isError ? (
          <ErrorState
            title="Could not load telemetry"
            description="Something went wrong reaching the server."
            onRetry={() => logs.refetch()}
          />
        ) : (logs.data?.length ?? 0) === 0 ? (
          <EmptyState
            icon={<Activity />}
            title="No agent runs yet"
            description="Once an agent executes, its prompt, tool calls and token usage appear here."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Agent</TableHead>
                <TableHead>Prompt</TableHead>
                <TableHead>Tool call</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.data?.map((log) => {
                const tool = firstToolName(log.toolCalls);
                const succeeded = log.status === 'SUCCESS';
                return (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">
                      {log.agent.name}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">
                      {log.promptText}
                    </TableCell>
                    <TableCell>
                      {tool ? (
                        <span className="gap-1 text-xs flex items-center font-mono text-accent-violet">
                          <Wrench className="size-3.5" aria-hidden />
                          {tool}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={succeeded ? 'success' : 'destructive'}>
                        {succeeded ? (
                          <CheckCircle aria-hidden />
                        ) : (
                          <AlertCircle aria-hidden />
                        )}
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground tabular-nums">
                      {log.tokensUsed}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(log.executedAt), {
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
