import { agentGraphsApi, aiExecutionsApi, ApiError, approvalsApi } from '@org/api-client';
import type { AgentMessageRecord, AgentTaskRecord, CanvasAgentRunDetail, CanvasRunStep, StudioGraphIssue } from '@org/types';
import { AIRunStatusBadge, Badge, Button, CodeBlock, EmptyState, SegmentedControl, Textarea, toast } from '@org/ui';
import { cn } from '@org/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Node } from '@xyflow/react';
import {
  AlertTriangle,
  Ban,
  Bot,
  CheckCircle2,
  Circle,
  Clock,
  Coins,
  Copy,
  Loader2,
  MessageSquare,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  SkipForward,
  UserCheck,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useStudioSession } from '../../session-guard.js';

/** Run statuses after which nothing more will happen without someone acting. */
const SETTLED = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'SUCCESS']);
/** How often an open run is re-read while it is still going. */
const POLL_MS = 1_500;

export type CanvasNodeStatus = 'idle' | 'running' | 'success' | 'failed' | 'waiting';

interface RunConsoleDrawerProps {
  agentId: string;
  agentName: string;
  nodes: Node[];
  isOpen: boolean;
  onClose: () => void;
  /** Saves unsaved canvas changes first: a run uses the saved graph. */
  onBeforeRun: () => Promise<void>;
  /** Live step states for the canvas (null clears them). */
  onNodeStatuses: (statuses: Record<string, CanvasNodeStatus> | null) => void;
}

type Selection = { kind: 'step'; id: string } | { kind: 'task'; id: string } | null;

const STEP_STATUS: Record<string, CanvasNodeStatus> = {
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  WAITING: 'waiting',
  SKIPPED: 'idle',
};

/** The text a step or run produced, for reading rather than as raw JSON. */
function readableOutput(output: Record<string, unknown> | null | undefined): string {
  if (!output) return '';
  for (const key of ['output', 'entityResponse', 'aiOutput', 'result', 'toolResult', 'extracted', 'loopResults', 'merged', 'reason', 'error']) {
    const value = output[key];
    if (value === undefined || value === null || value === '') continue;
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  }
  return JSON.stringify(output, null, 2);
}

function formatDuration(ms: number): string {
  if (ms < 1_000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)} s`;
  return `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1_000)} s`;
}

function StatusIcon({ status, className }: { status: string; className?: string }) {
  const s = status.toUpperCase();
  const cls = cn('size-3.5 shrink-0', className);
  if (s === 'RUNNING') return <Loader2 className={cn(cls, 'animate-spin text-primary')} aria-label="Running" />;
  if (s === 'SUCCESS' || s === 'COMPLETED') return <CheckCircle2 className={cn(cls, 'text-success')} aria-label="Done" />;
  if (s === 'FAILED') return <XCircle className={cn(cls, 'text-destructive')} aria-label="Failed" />;
  if (s === 'WAITING' || s === 'APPROVAL_REQUIRED') return <UserCheck className={cn(cls, 'text-warning')} aria-label="Waiting for a person" />;
  if (s === 'SKIPPED') return <SkipForward className={cn(cls, 'text-muted-foreground')} aria-label="Skipped" />;
  if (s === 'CANCELLED') return <Ban className={cn(cls, 'text-muted-foreground')} aria-label="Cancelled" />;
  return <Circle className={cn(cls, 'text-muted-foreground')} aria-label={status} />;
}

/** Tasks as a tree: each delegation under the agent that handed it over. */
function taskTree(tasks: AgentTaskRecord[]): Array<{ task: AgentTaskRecord; depth: number }> {
  const children = new Map<string | null, AgentTaskRecord[]>();
  for (const t of tasks) {
    const parent = t.parentTaskId && tasks.some((p) => p.id === t.parentTaskId) ? t.parentTaskId : null;
    children.set(parent, [...(children.get(parent) ?? []), t]);
  }
  const out: Array<{ task: AgentTaskRecord; depth: number }> = [];
  const walk = (parent: string | null, depth: number) => {
    for (const t of children.get(parent) ?? []) {
      out.push({ task: t, depth });
      walk(t.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export function RunConsoleDrawer({ agentId, agentName, nodes, isOpen, onClose, onBeforeRun, onNodeStatuses }: RunConsoleDrawerProps) {
  const { activeWorkspace } = useStudioSession();
  const workspaceId = activeWorkspace.id;
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'test' | 'live'>('test');
  const [runId, setRunId] = useState<string | null>(null);
  const [issues, setIssues] = useState<StudioGraphIssue[]>([]);
  const [selection, setSelection] = useState<Selection>(null);

  const labels = useMemo(
    () => new Map(nodes.map((n) => [n.id, String((n.data as { label?: string } | undefined)?.label || n.type || n.id)])),
    [nodes],
  );

  const runQuery = useQuery({
    queryKey: ['canvas-run', workspaceId, runId],
    queryFn: () => agentGraphsApi.getRun(workspaceId, runId as string),
    enabled: !!runId && isOpen,
    refetchInterval: (query) => {
      const status = (query.state.data as CanvasAgentRunDetail | undefined)?.status;
      return status && SETTLED.has(status) ? false : POLL_MS;
    },
  });
  const run = runQuery.data;

  // Light up the canvas: each node takes the state of its latest step.
  useEffect(() => {
    if (!run) return;
    const statuses: Record<string, CanvasNodeStatus> = {};
    for (const step of run.steps) statuses[step.stepId] = STEP_STATUS[step.status] ?? 'idle';
    for (const task of run.agentTasks) {
      if (statuses[task.agentKey] === undefined || task.status === 'RUNNING') {
        statuses[task.agentKey] = task.status === 'RUNNING' ? 'running' : task.status === 'FAILED' ? 'failed' : task.status === 'COMPLETED' ? 'success' : 'waiting';
      }
    }
    onNodeStatuses(statuses);
  }, [run, onNodeStatuses]);

  useEffect(() => {
    if (!isOpen) onNodeStatuses(null);
  }, [isOpen, onNodeStatuses]);

  const start = useMutation({
    mutationFn: async () => {
      await onBeforeRun();
      // Check first, so every problem shows here with the step it's on.
      const check = await agentGraphsApi.validate(workspaceId, agentId);
      setIssues(check.issues);
      if (!check.valid) throw new Error('Fix the problems listed above, then run again.');
      return agentGraphsApi.run(workspaceId, agentId, { mode, ...(message.trim() ? { message: message.trim() } : {}) });
    },
    onSuccess: (started) => {
      setRunId(started.runId);
      setSelection(null);
      queryClient.invalidateQueries({ queryKey: ['canvas-runs', workspaceId, agentId] });
    },
    onError: (err) => {
      toast.error('Couldn’t start the run', {
        description: err instanceof ApiError || err instanceof Error ? err.message : undefined,
      });
    },
    meta: { disableToast: true },
  });

  const control = useMutation({
    mutationFn: async (action: 'pause' | 'resume' | 'cancel' | 'retry') => {
      if (!runId) return;
      if (action === 'retry') {
        const retried = await aiExecutionsApi.retry(workspaceId, runId);
        const next = (retried as { executionId?: string }).executionId;
        if (next) setRunId(next);
        return;
      }
      await aiExecutionsApi[action](workspaceId, runId);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['canvas-run', workspaceId] }),
    meta: { errorMessage: 'That didn’t work on this run.' },
  });

  const decide = useMutation({
    mutationFn: ({ id, decision }: { id: string; decision: 'APPROVED' | 'REJECTED' }) =>
      approvalsApi.decide(workspaceId, id, { decision, comment: decision === 'APPROVED' ? 'Approved in the Studio' : 'Rejected in the Studio' }),
    onSuccess: (_d, v) => {
      toast.success(v.decision === 'APPROVED' ? 'Approved — the run continues.' : 'Rejected — the run stops here.');
      queryClient.invalidateQueries({ queryKey: ['canvas-run', workspaceId] });
    },
    meta: { errorMessage: 'Couldn’t record the decision.' },
  });

  if (!isOpen) return null;

  const tasks = run ? taskTree(run.agentTasks) : [];
  const pendingApproval = run?.approvals.find((a) => a.state === 'PENDING');
  const finalStep = run ? [...run.steps].reverse().find((s) => s.status === 'SUCCESS' && s.nodeType === 'OUTPUT') ?? [...run.steps].reverse().find((s) => s.status === 'SUCCESS') : undefined;
  const selectedStep = selection?.kind === 'step' ? run?.steps.find((s) => s.id === selection.id) : undefined;
  const selectedTask = selection?.kind === 'task' ? run?.agentTasks.find((t) => t.id === selection.id) : undefined;
  const taskMessages = selectedTask ? run?.agentMessages.filter((m) => m.taskId === selectedTask.id) ?? [] : [];
  const settled = !!run && SETTLED.has(run.status);

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success('Copied');
  };

  return (
    <aside
      aria-label={`Run ${agentName}`}
      className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col border-l border-border bg-surface shadow-2xl"
    >
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Play className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-foreground">Run {agentName}</div>
            <div className="text-[11px] text-muted-foreground">
              {mode === 'test' ? 'Test: reads real data, changes nothing' : 'Live: acts for real'}
            </div>
          </div>
          {run && <AIRunStatusBadge status={run.status} />}
        </div>
        <div className="flex items-center gap-1">
          {run?.status === 'RUNNING' && (
            <Button variant="ghost" size="xs" onClick={() => control.mutate('pause')} loading={control.isPending} className="gap-1">
              <Pause className="size-3.5" /> Pause
            </Button>
          )}
          {run?.status === 'PAUSED' && (
            <Button variant="ghost" size="xs" onClick={() => control.mutate('resume')} loading={control.isPending} className="gap-1">
              <Play className="size-3.5" /> Resume
            </Button>
          )}
          {run && ['RUNNING', 'PAUSED', 'WAITING_APPROVAL'].includes(run.status) && (
            <Button variant="ghost" size="xs" onClick={() => control.mutate('cancel')} className="gap-1 text-destructive">
              <Ban className="size-3.5" /> Cancel
            </Button>
          )}
          {run && (run.status === 'FAILED' || run.status === 'CANCELLED') && (
            <Button variant="ghost" size="xs" onClick={() => control.mutate('retry')} loading={control.isPending} className="gap-1">
              <RotateCcw className="size-3.5" /> Retry
            </Button>
          )}
          <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Close run console">
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-5 text-xs">
        {/* Input */}
        <section className="space-y-2.5 rounded-xl border border-border bg-surface-raised p-4" aria-label="Run input">
          <label htmlFor="run-console-message" className="font-semibold text-foreground">
            What should the agent work on?
          </label>
          <Textarea
            id="run-console-message"
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g. Research our top three competitors’ pricing and summarise it"
            disabled={start.isPending}
            className="text-xs"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) start.mutate();
            }}
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SegmentedControl
              aria-label="Run mode"
              size="sm"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'test', label: 'Test', hint: 'Reads real data; writes and approvals are simulated' },
                { value: 'live', label: 'Live', hint: 'Acts for real, as the agent’s owner' },
              ]}
            />
            <Button size="sm" onClick={() => start.mutate()} loading={start.isPending} className="gap-1.5 font-semibold">
              <Play className="size-3.5" />
              {run && !settled ? 'Run again' : 'Run'}
            </Button>
          </div>
        </section>

        {issues.length > 0 && (
          <section className="space-y-1.5 rounded-xl border border-warning/40 bg-warning/5 p-3" aria-label="Setup notes">
            <div className="flex items-center gap-1.5 font-semibold text-warning">
              <AlertTriangle className="size-3.5" /> {issues.some((i) => i.level === 'error') ? 'Fix before running' : 'Heads up'}
            </div>
            <ul className="space-y-1 text-[11px] text-muted-foreground">
              {issues.map((issue, i) => (
                <li key={i} className="flex gap-1.5">
                  <span className={cn('font-semibold', issue.level === 'error' ? 'text-destructive' : 'text-warning')}>
                    {issue.level === 'error' ? 'Error' : 'Note'}
                  </span>
                  <span>
                    {issue.nodeId && labels.get(issue.nodeId) ? `${labels.get(issue.nodeId)}: ` : ''}
                    {issue.message}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!runId && (
          <EmptyState
            size="sm"
            icon={<Bot className="size-5" />}
            title="Nothing has run yet"
            description="Run the agent to see each step, what its team did, and the result, live."
          />
        )}

        {runId && !run && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Starting…
          </div>
        )}

        {run && (
          <>
            {/* Summary */}
            <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border bg-surface-raised px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Clock className="size-3" /> {formatDuration(run.latencyMs || (settled ? 0 : Date.now() - new Date(run.startedAt).getTime()))}
              </span>
              <span className="flex items-center gap-1">
                <Coins className="size-3" /> {run.tokensUsed.toLocaleString()} tokens · ${run.totalCost.toFixed(4)}
              </span>
              <span>{run.steps.length} steps</span>
              {run.agentTasks.length > 0 && (
                <span className="flex items-center gap-1">
                  <Users className="size-3" /> {run.agentTasks.length} agent tasks
                </span>
              )}
            </div>

            {run.status === 'FAILED' && run.errorsJson?.message && (
              <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-[11px] text-destructive">
                {run.errorsJson.message}
              </div>
            )}

            {pendingApproval && (
              <section className="space-y-2 rounded-xl border border-warning/40 bg-warning/10 p-3" aria-label="Approval needed">
                <div className="flex items-center gap-2 font-bold text-warning">
                  <ShieldCheck className="size-4" /> Waiting for approval: {pendingApproval.actionType}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  The run is paused here. Approving continues it; rejecting stops it. You can also decide it in Approvals.
                </p>
                <div className="flex gap-2">
                  <Button size="xs" onClick={() => decide.mutate({ id: pendingApproval.id, decision: 'APPROVED' })} loading={decide.isPending}>
                    Approve
                  </Button>
                  <Button variant="outline" size="xs" onClick={() => decide.mutate({ id: pendingApproval.id, decision: 'REJECTED' })} disabled={decide.isPending}>
                    Reject
                  </Button>
                </div>
              </section>
            )}

            {/* Steps */}
            <section className="space-y-1.5" aria-label="Steps">
              <h3 className="text-[11px] font-bold text-foreground">Steps</h3>
              <ol className="space-y-1">
                {run.steps.map((step: CanvasRunStep) => (
                  <li key={step.id}>
                    <button
                      type="button"
                      onClick={() => setSelection({ kind: 'step', id: step.id })}
                      aria-pressed={selectedStep?.id === step.id}
                      className={cn(
                        'flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        selectedStep?.id === step.id ? 'border-primary bg-primary/10' : 'border-border bg-surface-raised/40 hover:bg-surface-raised',
                      )}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <StatusIcon status={step.status} />
                        <span className="truncate font-semibold text-foreground">{labels.get(step.stepId) ?? step.stepId}</span>
                        <span className="shrink-0 font-mono text-[10px] uppercase text-muted-foreground">{step.nodeType}</span>
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {step.tokensUsed ? `${step.tokensUsed} tok · ` : ''}
                        {formatDuration(step.latencyMs)}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>

            {/* Team */}
            {tasks.length > 0 && (
              <section className="space-y-1.5" aria-label="Agent team">
                <h3 className="flex items-center gap-1.5 text-[11px] font-bold text-foreground">
                  <Users className="size-3.5" /> What the team did
                </h3>
                <ul className="space-y-1">
                  {tasks.map(({ task, depth }) => (
                    <li key={task.id} style={{ paddingLeft: depth * 16 }}>
                      <button
                        type="button"
                        onClick={() => setSelection({ kind: 'task', id: task.id })}
                        aria-pressed={selectedTask?.id === task.id}
                        className={cn(
                          'flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          selectedTask?.id === task.id ? 'border-primary bg-primary/10' : 'border-border bg-surface-raised/40 hover:bg-surface-raised',
                        )}
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <StatusIcon status={task.status} />
                          <span className="shrink-0 font-semibold text-foreground">{task.agentName}</span>
                          <span className="truncate text-muted-foreground">{task.title}</span>
                        </span>
                        <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{task.tokensUsed ? `${task.tokensUsed} tok` : ''}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Detail */}
            <section className="space-y-2 rounded-xl border border-border bg-surface-raised/40 p-3" aria-label="Details">
              {selectedTask ? (
                <TaskDetail task={selectedTask} messages={taskMessages} onCopy={copy} />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-bold text-foreground">
                      {selectedStep ? labels.get(selectedStep.stepId) ?? selectedStep.stepId : settled ? 'Result' : 'Latest output'}
                    </h3>
                    {(selectedStep ?? finalStep) && (
                      <Button variant="ghost" size="xs" className="gap-1" onClick={() => copy(readableOutput((selectedStep ?? finalStep)!.outputJson))}>
                        <Copy className="size-3" /> Copy
                      </Button>
                    )}
                  </div>
                  {selectedStep?.errorMessage && <p className="text-[11px] text-destructive">{selectedStep.errorMessage}</p>}
                  {selectedStep ?? finalStep ? (
                    <div className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-surface p-3 text-[12px] leading-relaxed text-foreground">
                      {readableOutput((selectedStep ?? finalStep)!.outputJson) || 'No output.'}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">{settled ? 'The run produced no output.' : 'Working…'}</p>
                  )}
                  {selectedStep && (
                    <details className="text-[11px]">
                      <summary className="cursor-pointer text-muted-foreground">Raw step data</summary>
                      <CodeBlock variant="compact" language="json" code={JSON.stringify({ input: selectedStep.inputJson, output: selectedStep.outputJson }, null, 2)} />
                    </details>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </div>
    </aside>
  );
}

function TaskDetail({ task, messages, onCopy }: { task: AgentTaskRecord; messages: AgentMessageRecord[]; onCopy: (text: string) => void }) {
  const result = task.output?.result ?? '';
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-bold text-foreground">
          {task.agentName}
          <Badge variant="neutral" className="ml-2 text-[10px]">
            {task.status.toLowerCase().replace('_', ' ')}
          </Badge>
        </h3>
        {result && (
          <Button variant="ghost" size="xs" className="gap-1" onClick={() => onCopy(result)}>
            <Copy className="size-3" /> Copy result
          </Button>
        )}
      </div>
      {task.error && <p className="text-[11px] text-destructive">{task.error}</p>}
      {task.output?.notices?.map((n, i) => (
        <p key={i} className="text-[11px] text-warning">
          {n}
        </p>
      ))}
      {task.output?.tools && task.output.tools.length > 0 && (
        <p className="text-[11px] text-muted-foreground">Tools used: {task.output.tools.join(', ')}</p>
      )}
      {messages.length > 0 ? (
        <ol className="space-y-2" aria-label="Conversation">
          {messages.map((m) => (
            <li key={m.id} className="rounded-lg border border-border bg-surface p-2.5">
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground">
                <MessageSquare className="size-3" /> {m.fromName} → {m.toName}
                <span className={cn('uppercase', m.kind === 'error' && 'text-destructive')}>· {m.kind}</span>
              </div>
              <div className="max-h-56 overflow-auto whitespace-pre-wrap text-[12px] leading-relaxed text-foreground">{m.content}</div>
            </li>
          ))}
        </ol>
      ) : (
        result && <div className="max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-surface p-3 text-[12px] leading-relaxed">{result}</div>
      )}
    </div>
  );
}
