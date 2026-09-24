import { agentsApi, aiExecutionsApi } from '@org/api-client';
import { Badge, Button, Dialog, DialogContent, DialogHeader, DialogTitle, LoadingState } from '@org/ui';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  Eye,
  RefreshCw,
  Search,
  UserCheck,
} from 'lucide-react';
import { useState } from 'react';
import { useStudioSession } from '../session-guard.js';

export function ExecutionsPage() {
  const { activeWorkspace } = useStudioSession();
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [inspectExecution, setInspectExecution] = useState<any | null>(null);

  // Load executions from workspace
  const {
    data: executions = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['workspace-executions', activeWorkspace.id],
    queryFn: () => agentsApi.workspaceLogs(activeWorkspace.id),
  });

  const filteredLogs = executions.filter((item) => {
    if (filterStatus !== 'ALL' && item.status !== filterStatus) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (item.agentName || '').toLowerCase().includes(q) ||
      (item.promptPreview || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex-1 space-y-6 overflow-y-auto p-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Execution Logs & Traces
          </h1>
          <p className="text-xs text-muted-foreground">
            Observe runtime traces, token latencies, model invocations and credit telemetry across {activeWorkspace.name}.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => void refetch()}
          loading={isRefetching}
          className="gap-1.5 text-xs"
        >
          <RefreshCw className="size-3.5" /> Refresh Runs
        </Button>
      </div>

      {/* Filter and Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center rounded-lg border border-border bg-surface p-1">
          {['ALL', 'SUCCESS', 'FAILED'].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                filterStatus === st
                  ? 'bg-primary/10 text-primary font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by agent or prompt…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-full rounded-md border border-border bg-surface pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Executions Table */}
      {isLoading ? (
        <LoadingState label="Loading execution telemetry…" />
      ) : filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface/50 p-12 text-center text-muted-foreground">
          <Activity className="size-10 text-muted-foreground/30 mb-2" />
          <div className="text-sm font-semibold text-foreground">
            No Executions Recorded
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Run a turn from the Agent Builder Test tab to generate execution logs.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-2xs">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-border bg-surface-raised/50 text-[11px] font-semibold text-muted-foreground uppercase">
              <tr>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Input / Prompt</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Timestamp</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredLogs.map((log) => (
                <tr
                  key={log.id}
                  className="transition-colors hover:bg-surface-raised/40"
                >
                  <td className="px-4 py-3">
                    <Badge
                      variant={log.status === 'SUCCESS' ? 'success' : 'destructive'}
                      className="text-[10px]"
                    >
                      {log.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 font-semibold text-foreground">
                    {log.agentName || 'Agent'}
                  </td>
                  <td className="max-w-[280px] px-4 py-3 text-muted-foreground truncate font-mono text-[11px]">
                    {log.promptPreview || 'Test execution turn'}
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">
                    {log.durationMs}ms
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-[11px]">
                    {new Date(log.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => setInspectExecution(log)}
                      className="gap-1 text-xs text-primary"
                    >
                      <Eye className="size-3" /> Inspect Trace
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Inspect Trace Modal */}
      <Dialog
        open={Boolean(inspectExecution)}
        onOpenChange={(open) => !open && setInspectExecution(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Activity className="size-4 text-primary" />
              <span>Execution Trace: {inspectExecution?.agentName}</span>
            </DialogTitle>
          </DialogHeader>

          {inspectExecution && (
            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-surface-raised p-3 text-center">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">
                    Status
                  </div>
                  <div className="mt-0.5 font-bold">{inspectExecution.status}</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">
                    Duration
                  </div>
                  <div className="mt-0.5 font-bold font-mono">
                    {inspectExecution.durationMs}ms
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase">
                    Tokens (Est)
                  </div>
                  <div className="mt-0.5 font-bold font-mono">
                    {inspectExecution.tokensUsed || 300}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-foreground mb-1">
                  Prompt Input
                </div>
                <div className="rounded-lg border border-border bg-surface-raised p-2.5 font-mono text-[11px]">
                  {inspectExecution.promptPreview || 'Standard test turn'}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-semibold text-foreground mb-1">
                  Raw Turn Response
                </div>
                <pre className="max-h-48 overflow-y-auto rounded-lg border border-border bg-surface p-2.5 font-mono text-[11px] whitespace-pre-wrap">
                  {inspectExecution.responsePreview || 'Execution completed.'}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
