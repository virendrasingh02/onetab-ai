import { agentGraphsApi, aiExecutionsApi, approvalsApi } from '@org/api-client';
import type { CanvasAgentRunDetail } from '@org/types';
import { Button, toast } from '@org/ui';
import { cn } from '@org/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Maximize2, RotateCcw, Square, UserCheck, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  POLL_MS,
  SETTLED,
  StatusIcon,
  finalRunStep,
  formatDuration,
  readableOutput,
  runToCanvas,
  type CanvasNodeStatus,
} from '../workflow-canvas/run-console-drawer.js';
import type { NodeRunResult } from '../workflow-canvas/node-chrome.js';

/** Steps shown before "+N more" — the run console has the full list. */
const VISIBLE_STEPS = 6;

const STATUS_TEXT: Record<string, string> = {
  RUNNING: 'Running',
  PENDING: 'Starting',
  QUEUED: 'Starting',
  WAITING: 'Waiting for approval',
  APPROVAL_REQUIRED: 'Waiting for approval',
  PAUSED: 'Paused',
  COMPLETED: 'Finished',
  SUCCESS: 'Finished',
  FAILED: 'Failed',
  CANCELLED: 'Stopped',
};

export interface CopilotRunCardProps {
  workspaceId: string;
  agentId: string;
  runId: string;
  mode: 'test' | 'live';
  /** Step id → its label on the canvas. */
  labels: Map<string, string>;
  /** Only the newest run drives the canvas highlights. */
  drivesCanvas: boolean;
  onNodeStatuses?: (statuses: Record<string, CanvasNodeStatus> | null) => void;
  onNodeResults?: (results: Record<string, NodeRunResult>) => void;
  onOpenConsole: () => void;
  /** Called once the run settles, with how it ended. */
  onSettled?: (run: CanvasAgentRunDetail) => void;
}

/**
 * A run, live inside the Copilot chat: each step as it happens, approvals to
 * decide right here, and the answer it gave. Same API as the run console.
 */
export function CopilotRunCard({
  workspaceId,
  agentId,
  runId: initialRunId,
  mode,
  labels,
  drivesCanvas,
  onNodeStatuses,
  onNodeResults,
  onOpenConsole,
  onSettled,
}: CopilotRunCardProps) {
  const queryClient = useQueryClient();
  const [runId, setRunId] = useState(initialRunId);
  const [showAll, setShowAll] = useState(false);
  const [copied, setCopied] = useState(false);
  const [reported, setReported] = useState<string | null>(null);

  const { data: run } = useQuery({
    queryKey: ['canvas-run', workspaceId, runId],
    queryFn: () => agentGraphsApi.getRun(workspaceId, runId),
    refetchInterval: (query) => {
      const status = (query.state.data as CanvasAgentRunDetail | undefined)?.status;
      return status && SETTLED.has(status) ? false : POLL_MS;
    },
  });

  useEffect(() => {
    if (!run || !drivesCanvas) return;
    const { statuses, results } = runToCanvas(run);
    onNodeStatuses?.(statuses);
    onNodeResults?.(results);
  }, [run, drivesCanvas, onNodeStatuses, onNodeResults]);

  const settled = !!run && SETTLED.has(run.status);
  useEffect(() => {
    if (!run || !settled || reported === run.id) return;
    setReported(run.id);
    queryClient.invalidateQueries({ queryKey: ['canvas-agent-runs', workspaceId, agentId] });
    onSettled?.(run);
  }, [run, settled, reported, onSettled, queryClient, workspaceId, agentId]);

  const control = useMutation({
    mutationFn: async (action: 'cancel' | 'retry') => {
      if (action === 'retry') {
        const retried = (await aiExecutionsApi.retry(workspaceId, runId)) as { executionId?: string };
        if (retried.executionId) setRunId(retried.executionId);
        return;
      }
      await aiExecutionsApi.cancel(workspaceId, runId);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['canvas-run', workspaceId] }),
    meta: { errorMessage: 'That didn’t work on this run.' },
  });

  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVED' | 'REJECTED' }) =>
      approvalsApi.decide(workspaceId, id, {
        decision,
        comment: decision === 'APPROVED' ? 'Approved in the Copilot' : 'Rejected in the Copilot',
      }),
    onSuccess: (_d, v) => {
      toast.success(v.decision === 'APPROVED' ? 'Approved — the run continues.' : 'Rejected — the run stops here.');
      queryClient.invalidateQueries({ queryKey: ['canvas-run', workspaceId] });
    },
    meta: { errorMessage: 'Couldn’t record the decision.' },
  });

  const status = run?.status ?? 'PENDING';
  const steps = run?.steps ?? [];
  const shown = showAll ? steps : steps.slice(-VISIBLE_STEPS);
  const hidden = steps.length - shown.length;
  const pending = run?.approvals.find((a) => a.state === 'PENDING');
  const final = run && settled ? finalRunStep(run) : undefined;
  const answer = final ? readableOutput(final.outputJson) : '';
  const runError = run?.errorsJson?.message ?? [...steps].reverse().find((s) => s.status === 'FAILED')?.errorMessage ?? null;
  const elapsed = run ? run.latencyMs || (run.finishedAt ? new Date(run.finishedAt).getTime() : Date.now()) - new Date(run.startedAt).getTime() : 0;

  const copyAnswer = async () => {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Couldn’t copy — your browser blocked the clipboard.');
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground">
          <StatusIcon status={status} />
          <span className="truncate">
            {mode === 'test' ? 'Test run' : 'Live run'} · {STATUS_TEXT[status.toUpperCase()] ?? status.toLowerCase()}
          </span>
        </span>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
          {run ? formatDuration(Math.max(0, elapsed)) : '…'}
          {run?.tokensUsed ? ` · ${run.tokensUsed.toLocaleString()} tok` : ''}
        </span>
      </div>

      {/* Steps */}
      <ol className="space-y-0.5 px-2 py-2">
        {hidden > 0 && (
          <li>
            <Button
              variant="link"
              size="xs"
              type="button"
              onClick={() => setShowAll(true)}
              className="h-auto px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
            >
              + {hidden} earlier step{hidden === 1 ? '' : 's'}
            </Button>
          </li>
        )}
        {shown.length === 0 && (
          <li className="px-1.5 text-[11px] text-muted-foreground">Starting…</li>
        )}
        {shown.map((s) => (
          <li key={s.id} className="rounded-md px-1.5 py-1">
            <div className="flex items-center gap-2">
              <StatusIcon status={s.status} />
              <span className={cn('min-w-0 flex-1 truncate text-xs', s.status === 'FAILED' ? 'text-destructive-text' : 'text-foreground')}>
                {labels.get(s.stepId) ?? s.nodeType}
              </span>
              {s.finishedAt && <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{formatDuration(s.latencyMs)}</span>}
            </div>
            {s.status === 'FAILED' && s.errorMessage && (
              <p className="mt-0.5 pl-5.5 text-[11px] leading-snug text-muted-foreground">{s.errorMessage}</p>
            )}
          </li>
        ))}
      </ol>

      {/* Approval, decided right here */}
      {pending && (
        <div className="mx-2 mb-2 space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-2.5">
          <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <UserCheck className="size-3.5 text-warning" aria-hidden /> Needs your approval
          </p>
          <p className="text-[11px] text-muted-foreground">
            {pending.stepId ? `${labels.get(pending.stepId) ?? pending.stepId}: ` : ''}
            {pending.actionType.replace(/_/g, ' ').toLowerCase()}
            {mode === 'test' ? ' — a test run never really sends or changes anything.' : ''}
          </p>
          <div className="flex gap-1.5">
            <Button size="xs" onClick={() => decide.mutate({ id: pending.id, decision: 'APPROVED' })} loading={decide.isPending} className="gap-1">
              <Check className="size-3" /> Approve
            </Button>
            <Button size="xs" variant="ghost" onClick={() => decide.mutate({ id: pending.id, decision: 'REJECTED' })} disabled={decide.isPending} className="gap-1">
              <X className="size-3" /> Reject
            </Button>
          </div>
        </div>
      )}

      {/* The answer */}
      {answer && (
        <div className="mx-2 mb-2 overflow-hidden rounded-lg border border-border">
          <div className="flex items-center justify-between border-b border-border bg-surface px-2.5 py-1">
            <span className="font-mono text-[10px] text-muted-foreground">output</span>
            <Button variant="ghost" size="icon-xs" type="button" onClick={() => void copyAnswer()} aria-label="Copy output">
              {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
            </Button>
          </div>
          <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words p-2.5 font-mono text-[11px] leading-relaxed text-foreground">{answer}</pre>
        </div>
      )}
      {settled && status.toUpperCase() === 'FAILED' && runError && !steps.some((s) => s.status === 'FAILED') && (
        <p className="mx-3 mb-2 text-[11px] text-destructive-text">{runError}</p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 border-t border-border px-2 py-1.5">
        {!settled && (
          <Button size="xs" variant="ghost" onClick={() => control.mutate('cancel')} disabled={control.isPending} className="gap-1">
            <Square className="size-3 fill-current" /> Stop
          </Button>
        )}
        {settled && status.toUpperCase() === 'FAILED' && (
          <Button size="xs" variant="ghost" onClick={() => control.mutate('retry')} loading={control.isPending} className="gap-1">
            <RotateCcw className="size-3" /> Retry
          </Button>
        )}
        <Button size="xs" variant="ghost" onClick={onOpenConsole} className="ml-auto gap-1 text-muted-foreground">
          <Maximize2 className="size-3" /> Full details
        </Button>
      </div>
    </div>
  );
}
