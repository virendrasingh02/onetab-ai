import { agentGraphsApi, ApiError } from '@org/api-client';
import type {
  AgentMessageRecord,
  AgentTaskRecord,
  CanvasAgentRunDetail,
  CanvasRunStep,
  StudioGraphIssue,
} from '@org/types';
import {
  AIRunStatusBadge,
  Badge,
  Button,
  CodeBlock,
  EmptyState,
  SegmentedControl,
  Textarea,
  toast,
  Label,
} from '@org/ui';
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
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStudioSession } from '../../session-guard.js';
import { formatSeconds, type NodeRunResult } from './node-chrome.js';
import { stepOwner, type CanvasNodeStatus } from './run-flow.js';
import { useCanvasRunControls } from './use-canvas-run-controls.js';
import type { RunPlaybackMeta } from './use-run-playback.js';

/** Run statuses after which nothing more will happen without someone acting. */
export const SETTLED = new Set(['COMPLETED', 'FAILED', 'CANCELLED', 'SUCCESS']);
/** How often an open run is re-read while it is still going. */
export const POLL_MS = 1_000;
/** A run that ended longer ago than this is shown as it ended, not played. */
const REPLAY_WINDOW_MS = 15_000;

export type { CanvasNodeStatus };

interface RunConsoleDrawerProps {
  agentId: string;
  agentName: string;
  nodes: Node[];
  isOpen: boolean;
  onClose: () => void;
  /** Saves unsaved canvas changes first: a run uses the saved graph. */
  onBeforeRun: () => Promise<void>;
  /** Live step states for the canvas (null clears them). */
  onNodeStatuses: (
    statuses: Record<string, CanvasNodeStatus> | null,
    meta?: RunPlaybackMeta,
  ) => void;
  /** A run has started, so the canvas is about to play it. */
  onRunStart?: () => void;
  /** Goes up each time someone asks for the console, to bring it back from the run bar. */
  openRequest?: number;
  /** The step the canvas is on, if any is at work or being reached. */
  canvasStep?: string;
  /** The canvas has played the run to its end, which can be after the server finished. */
  canvasSettled?: boolean;
  /** What each step produced in the latest run, for the cards' "View Results". */
  onNodeResults?: (results: Record<string, NodeRunResult>) => void;
}

type Selection =
  { kind: 'step'; id: string } | { kind: 'task'; id: string } | null;

export const STEP_STATUS: Record<string, CanvasNodeStatus> = {
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILED: 'failed',
  WAITING: 'waiting',
  SKIPPED: 'skipped',
  CANCELLED: 'cancelled',
};

const TASK_STATUS: Record<string, CanvasNodeStatus> = {
  RUNNING: 'running',
  COMPLETED: 'success',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  WAITING: 'waiting',
  APPROVAL_REQUIRED: 'waiting',
  PAUSED: 'waiting',
};

/** The text a step or run produced, for reading rather than as raw JSON. */
export function readableOutput(
  output: Record<string, unknown> | null | undefined,
): string {
  if (!output) return '';
  for (const key of [
    'output',
    'entityResponse',
    'aiOutput',
    'result',
    'toolResult',
    'extracted',
    'loopResults',
    'merged',
    'reason',
    'error',
  ]) {
    const value = output[key];
    if (value === undefined || value === null || value === '') continue;
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  }
  // An empty result ({}) has nothing to read.
  return Object.keys(output).length ? JSON.stringify(output, null, 2) : '';
}

/** A trigger's "output" is the whole run context; the card only wants what started the run. */
export const isTriggerStep = (step: CanvasRunStep) =>
  /^(TRIGGER|START)/i.test(step.nodeType);
export function triggerInput(
  output: Record<string, unknown> | null | undefined,
): string {
  if (!output) return '';
  const input =
    output['input'] && typeof output['input'] === 'object'
      ? (output['input'] as Record<string, unknown>)
      : undefined;
  for (const value of [
    output['message'],
    input?.['message'],
    output['__last'],
    output['payload'],
    input,
  ]) {
    if (value === undefined || value === null || value === '') continue;
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  }
  return '';
}

export function formatDuration(ms: number): string {
  if (ms < 1_000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1_000).toFixed(1)} s`;
  return `${Math.floor(ms / 60_000)} min ${Math.round((ms % 60_000) / 1_000)} s`;
}

export function StatusIcon({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const s = status.toUpperCase();
  const cls = cn('size-3.5 shrink-0', className);
  if (s === 'RUNNING')
    return (
      <Loader2
        className={cn(cls, 'animate-spin text-primary')}
        aria-label="Running"
      />
    );
  if (s === 'SUCCESS' || s === 'COMPLETED')
    return (
      <CheckCircle2 className={cn(cls, 'text-success')} aria-label="Done" />
    );
  if (s === 'FAILED')
    return (
      <XCircle className={cn(cls, 'text-destructive')} aria-label="Failed" />
    );
  if (s === 'WAITING' || s === 'APPROVAL_REQUIRED')
    return (
      <UserCheck
        className={cn(cls, 'text-warning')}
        aria-label="Waiting for a person"
      />
    );
  if (s === 'SKIPPED')
    return (
      <SkipForward
        className={cn(cls, 'text-muted-foreground')}
        aria-label="Skipped"
      />
    );
  if (s === 'CANCELLED')
    return (
      <Ban
        className={cn(cls, 'text-muted-foreground')}
        aria-label="Cancelled"
      />
    );
  return (
    <Circle className={cn(cls, 'text-muted-foreground')} aria-label={status} />
  );
}

/** A run as the canvas shows it: each node's state, and what it produced, from its latest step. */
export function runToCanvas(run: CanvasAgentRunDetail): {
  statuses: Record<string, CanvasNodeStatus>;
  results: Record<string, NodeRunResult>;
} {
  const statuses: Record<string, CanvasNodeStatus> = {};
  for (const step of run.steps) {
    const status = STEP_STATUS[step.status] ?? 'idle';
    const owner = stepOwner(step.stepId);
    // A helper step finishing means its card's own work is next
    statuses[owner] =
      owner !== step.stepId && (status === 'success' || status === 'skipped')
        ? 'running'
        : status;
  }
  for (const task of run.agentTasks) {
    if (statuses[task.agentKey] === undefined || task.status === 'RUNNING') {
      statuses[task.agentKey] = TASK_STATUS[task.status] ?? 'idle';
    }
  }
  const results: Record<string, NodeRunResult> = {};
  // Steps come in order; a later attempt of the same step replaces the earlier one.
  for (const step of run.steps) {
    const finished = step.finishedAt
      ? new Date(step.finishedAt).getTime()
      : Date.now();
    const owner = stepOwner(step.stepId);
    results[owner] = {
      status: statuses[owner] ?? 'idle',
      output:
        owner !== step.stepId
          ? ''
          : isTriggerStep(step)
            ? triggerInput(step.outputJson)
            : readableOutput(step.outputJson),
      tokens: step.tokensUsed ?? 0,
      latencyMs:
        step.latencyMs ||
        Math.max(0, finished - new Date(step.startedAt).getTime()),
      error: step.errorMessage,
    };
  }
  // Agents drawn on the canvas (and their sub-agents) report as team tasks keyed by node id.
  for (const task of run.agentTasks) {
    const started = task.startedAt
      ? new Date(task.startedAt).getTime()
      : new Date(task.createdAt).getTime();
    const ended = task.completedAt
      ? new Date(task.completedAt).getTime()
      : Date.now();
    const prev = results[task.agentKey];
    results[task.agentKey] = {
      status: statuses[task.agentKey] ?? 'idle',
      output: task.output?.result ?? prev?.output ?? '',
      tokens: Math.max(task.tokensUsed ?? 0, prev?.tokens ?? 0),
      latencyMs: Math.max(ended - started, prev?.latencyMs ?? 0),
      error: task.error ?? prev?.error,
    };
  }
  // A run that ended can leave rows open (cancelled mid-step): nothing is still working
  if (SETTLED.has(run.status)) {
    const ended: CanvasNodeStatus =
      run.status === 'FAILED'
        ? 'failed'
        : run.status === 'CANCELLED'
          ? 'cancelled'
          : 'success';
    for (const [id, status] of Object.entries(statuses)) {
      if (status !== 'running' && status !== 'waiting') continue;
      statuses[id] = ended;
      if (results[id]) results[id] = { ...results[id], status: ended };
    }
  }
  return { statuses, results };
}

/** How the canvas should treat this read of a run. */
export function runPlaybackMeta(run: CanvasAgentRunDetail): RunPlaybackMeta {
  return {
    runId: run.id,
    settled: SETTLED.has(run.status),
    instant:
      !!run.finishedAt &&
      Date.now() - new Date(run.finishedAt).getTime() > REPLAY_WINDOW_MS,
  };
}

/** The answer a finished run gave: its Output step, or else the last step that succeeded. */
export function finalRunStep(
  run: CanvasAgentRunDetail,
): CanvasRunStep | undefined {
  return (
    [...run.steps]
      .reverse()
      .find((s) => s.status === 'SUCCESS' && s.nodeType === 'OUTPUT') ??
    [...run.steps].reverse().find((s) => s.status === 'SUCCESS')
  );
}

/** Tasks as a tree: each delegation under the agent that handed it over. */
function taskTree(
  tasks: AgentTaskRecord[],
): Array<{ task: AgentTaskRecord; depth: number }> {
  const children = new Map<string | null, AgentTaskRecord[]>();
  for (const t of tasks) {
    const parent =
      t.parentTaskId && tasks.some((p) => p.id === t.parentTaskId)
        ? t.parentTaskId
        : null;
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

/** What to tell the person when a run can't start, by what actually went wrong. */
function describeStartError(error: unknown): { title: string; detail: string } {
  if (error instanceof ApiError) {
    if (error.status === 403) {
      return {
        title: 'You can’t run this agent',
        detail:
          'Only its creator or a workspace admin can run or change it. Ask one of them, or build your own agent.',
      };
    }
    if (error.status === 402 || error.status === 429) {
      return { title: 'Run limit reached', detail: error.message };
    }
    return { title: 'Couldn’t start the run', detail: error.message };
  }
  return {
    title: 'Couldn’t start the run',
    detail:
      error instanceof Error
        ? error.message
        : 'Something went wrong. Try again.',
  };
}

/** The step a run is on, in the words of the canvas. */
function currentStepLabel(
  run: CanvasAgentRunDetail,
  labels: Map<string, string>,
  status: string,
): string | undefined {
  const step = [...run.steps].reverse().find((s) => s.status === status);
  return step ? (labels.get(step.stepId) ?? step.stepId) : undefined;
}

/** A run at a glance, under the graph it is moving through. */
function RunBar({
  run,
  labels,
  step,
  played,
  needsApproval,
  busy,
  onControl,
  onRunAgain,
  onExpand,
  onClose,
}: {
  run?: CanvasAgentRunDetail;
  labels: Map<string, string>;
  step?: string;
  played: boolean;
  needsApproval: boolean;
  busy: boolean;
  onControl: (action: 'pause' | 'resume' | 'cancel' | 'retry') => void;
  onRunAgain: () => void;
  onExpand: () => void;
  onClose: () => void;
}) {
  // Holds the step's name through the moment between two steps
  const lastStep = useRef(step);
  if (step) lastStep.current = step;
  // Tells the story at the canvas's pace, so it never gets ahead of the graph
  const status = !run
    ? 'STARTING'
    : SETTLED.has(run.status) && !played
      ? 'RUNNING'
      : run.status;
  const settled = SETTLED.has(status);
  const failed = status === 'FAILED';
  const cancelled = status === 'CANCELLED';
  const done = settled && !failed && !cancelled;
  const paused = status === 'PAUSED';

  const title = !run
    ? 'Starting…'
    : needsApproval
      ? 'Waiting for your approval'
      : paused
        ? 'Paused'
        : done
          ? 'Run finished'
          : cancelled
            ? 'Run cancelled'
            : failed
              ? `Failed at ${currentStepLabel(run, labels, 'FAILED') ?? 'a step'}`
              : lastStep.current
                ? `Running ${labels.get(lastStep.current) ?? lastStep.current}`
                : 'Running…';
  const detail =
    run && settled
      ? [
          `${run.steps.length} steps`,
          run.latencyMs ? formatSeconds(run.latencyMs) : null,
          run.tokensUsed ? `${run.tokensUsed.toLocaleString()} tokens` : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bottom-20 left-1/2 max-w-[calc(100vw-2rem)] gap-3 py-2 pl-3.5 pr-2 shadow-lg fixed z-40 flex -translate-x-1/2 items-center rounded-xl border border-border bg-surface"
    >
      {needsApproval || paused ? (
        <Clock className="size-4 shrink-0 text-warning" aria-hidden="true" />
      ) : done ? (
        <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden="true" />
      ) : failed ? (
        <XCircle className="size-4 shrink-0 text-destructive" aria-hidden="true" />
      ) : cancelled ? (
        <Ban className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      ) : (
        <Loader2 className="size-4 shrink-0 animate-spin text-primary" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <div className="max-w-64 text-xs font-semibold truncate text-foreground">
          {title}
        </div>
        {detail && (
          <div className="text-2xs tabular-nums text-muted-foreground">{detail}</div>
        )}
      </div>
      <div className="gap-1 flex shrink-0 items-center">
        {run?.status === 'RUNNING' && (
          <Button variant="ghost" size="xs" disabled={busy} onClick={() => onControl('pause')} className="gap-1">
            <Pause className="size-3.5" /> Pause
          </Button>
        )}
        {paused && (
          <Button variant="ghost" size="xs" disabled={busy} onClick={() => onControl('resume')} className="gap-1">
            <Play className="size-3.5" /> Resume
          </Button>
        )}
        {run && !SETTLED.has(run.status) && (
          <Button variant="ghost" size="xs" disabled={busy} onClick={() => onControl('cancel')} className="gap-1 text-destructive">
            <Ban className="size-3.5" /> Cancel
          </Button>
        )}
        {(failed || cancelled) && (
          <Button variant="ghost" size="xs" disabled={busy} onClick={() => onControl('retry')} className="gap-1">
            <RotateCcw className="size-3.5" /> Retry
          </Button>
        )}
        {done && (
          <Button variant="ghost" size="xs" disabled={busy} onClick={onRunAgain} className="gap-1">
            <Play className="size-3.5" /> Run again
          </Button>
        )}
        <Button variant={needsApproval ? 'default' : 'outline'} size="xs" onClick={onExpand}>
          {needsApproval ? 'Review' : 'Details'}
        </Button>
        {settled && (
          <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Close run">
            <X className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function RunConsoleDrawer({
  agentId,
  agentName,
  nodes,
  isOpen,
  onClose,
  onBeforeRun,
  onNodeStatuses,
  onNodeResults,
  onRunStart,
  openRequest,
  canvasStep,
  canvasSettled = true,
}: RunConsoleDrawerProps) {
  const { activeWorkspace } = useStudioSession();
  const workspaceId = activeWorkspace.id;
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [mode, setMode] = useState<'test' | 'live'>('test');
  const [runId, setRunId] = useState<string | null>(null);
  const [issues, setIssues] = useState<StudioGraphIssue[]>([]);
  const [selection, setSelection] = useState<Selection>(null);
  // While a run plays the console folds into a bar, so the whole graph stays in view
  const [minimized, setMinimized] = useState(false);

  useEffect(() => setMinimized(false), [openRequest]);

  const labels = useMemo(() => {
    const map = new Map(
      nodes.map((n) => [
        n.id,
        String(
          (n.data as { label?: string } | undefined)?.label || n.type || n.id,
        ),
      ]),
    );
    // Steps the compiler puts in front of an app card (`compileStudioGraph`).
    for (const [id, label] of [...map]) {
      map.set(`${id}__input`, `${label}: fill in`);
      map.set(`${id}__approval`, `Approve: ${label}`);
    }
    return map;
  }, [nodes]);

  const runQuery = useQuery({
    queryKey: ['canvas-run', workspaceId, runId],
    queryFn: () => agentGraphsApi.getRun(workspaceId, runId as string),
    enabled: !!runId && isOpen,
    refetchInterval: (query) => {
      const status = (query.state.data as CanvasAgentRunDetail | undefined)
        ?.status;
      return status && SETTLED.has(status) ? false : POLL_MS;
    },
  });
  const run = runQuery.data;

  // Light up the canvas: each node takes the state of its latest step.
  useEffect(() => {
    if (!run) return;
    const { statuses, results } = runToCanvas(run);
    onNodeStatuses(statuses, runPlaybackMeta(run));
    onNodeResults?.(results);
  }, [run, onNodeStatuses, onNodeResults]);

  useEffect(() => {
    if (!isOpen) onNodeStatuses(null);
  }, [isOpen, onNodeStatuses]);

  const start = useMutation({
    mutationFn: async () => {
      await onBeforeRun();
      // Check first, so every problem shows here with the step it's on.
      const check = await agentGraphsApi.validate(workspaceId, agentId);
      setIssues(check.issues);
      if (!check.valid)
        throw new Error('Fix the problems listed above, then run again.');
      return agentGraphsApi.run(workspaceId, agentId, {
        mode,
        ...(message.trim() ? { message: message.trim() } : {}),
      });
    },
    onSuccess: (started) => {
      setRunId(started.runId);
      setSelection(null);
      setMinimized(true);
      onNodeStatuses({}, { runId: started.runId });
      onRunStart?.();
      queryClient.invalidateQueries({
        queryKey: ['canvas-runs', workspaceId, agentId],
      });
    },
    onError: (err) => {
      toast.error('Couldn’t start the run', {
        description:
          err instanceof ApiError || err instanceof Error
            ? err.message
            : undefined,
      });
    },
    meta: { disableToast: true },
  });

  // Problems with the graph are listed under "Fix before running"; anything else
  // that stops a run from starting is shown here, where the person is looking.
  const startError =
    start.isError && !issues.some((i) => i.level === 'error')
      ? describeStartError(start.error)
      : null;

  const { control, decide } = useCanvasRunControls({
    workspaceId,
    runId,
    setRunId,
    surface: 'Studio',
  });

  if (!isOpen) return null;

  const tasks = run ? taskTree(run.agentTasks) : [];
  const pendingApproval = run?.approvals.find((a) => a.state === 'PENDING');
  const finalStep = run ? finalRunStep(run) : undefined;
  const selectedStep =
    selection?.kind === 'step'
      ? run?.steps.find((s) => s.id === selection.id)
      : undefined;
  const selectedTask =
    selection?.kind === 'task'
      ? run?.agentTasks.find((t) => t.id === selection.id)
      : undefined;
  const taskMessages = selectedTask
    ? (run?.agentMessages.filter((m) => m.taskId === selectedTask.id) ?? [])
    : [];
  const settled = !!run && SETTLED.has(run.status);

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
    toast.success('Copied');
  };

  if (minimized && runId) {
    return (
      <RunBar
        run={run}
        labels={labels}
        step={canvasStep}
        played={canvasSettled}
        needsApproval={!!pendingApproval && !canvasStep}
        busy={control.isPending || start.isPending}
        onControl={(action) => control.mutate(action)}
        onRunAgain={() => start.mutate()}
        onExpand={() => setMinimized(false)}
        onClose={() => {
          setMinimized(false);
          onClose();
        }}
      />
    );
  }

  return (
    <aside
      aria-label={`Run ${agentName}`}
      className="inset-y-0 right-0 max-w-2xl shadow-2xl fixed z-50 flex w-full flex-col border-l border-border bg-surface"
    >
      {/* Header */}
      <div className="h-14 gap-3 px-5 flex shrink-0 items-center justify-between border-b border-border">
        <div className="min-w-0 gap-2.5 flex items-center">
          <div className="size-8 flex shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Play className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold truncate text-foreground">
              Run {agentName}
            </div>
            <div className="text-xs text-muted-foreground">
              {mode === 'test'
                ? 'Test: reads real data, changes nothing'
                : 'Live: acts for real'}
            </div>
          </div>
          {run && <AIRunStatusBadge status={run.status} />}
        </div>
        <div className="gap-1 flex items-center">
          {run?.status === 'RUNNING' && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => control.mutate('pause')}
              loading={control.isPending}
              className="gap-1"
            >
              <Pause className="size-3.5" /> Pause
            </Button>
          )}
          {run?.status === 'PAUSED' && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => control.mutate('resume')}
              loading={control.isPending}
              className="gap-1"
            >
              <Play className="size-3.5" /> Resume
            </Button>
          )}
          {run &&
            ['RUNNING', 'PAUSED', 'WAITING_APPROVAL'].includes(run.status) && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => control.mutate('cancel')}
                className="gap-1 text-destructive"
              >
                <Ban className="size-3.5" /> Cancel
              </Button>
            )}
          {run && (run.status === 'FAILED' || run.status === 'CANCELLED') && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => control.mutate('retry')}
              loading={control.isPending}
              className="gap-1"
            >
              <RotateCcw className="size-3.5" /> Retry
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => (runId ? setMinimized(true) : onClose())}
            aria-label={runId ? 'Back to the canvas' : 'Close run console'}
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-4 p-5 text-xs flex-1 overflow-y-auto">
        {/* Input */}
        <section
          className="space-y-2.5 p-4 rounded-xl border border-border bg-surface-raised"
          aria-label="Run input"
        >
          <Label
            htmlFor="run-console-message"
            className="font-semibold text-foreground"
          >
            What should the agent work on?
          </Label>
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
          <div className="gap-2 flex flex-wrap items-center justify-between">
            <SegmentedControl
              aria-label="Run mode"
              size="sm"
              value={mode}
              onChange={setMode}
              options={[
                {
                  value: 'test',
                  label: 'Test',
                  hint: 'Reads real data; writes and approvals are simulated',
                },
                {
                  value: 'live',
                  label: 'Live',
                  hint: 'Acts for real, as the agent’s owner',
                },
              ]}
            />
            <Button
              size="sm"
              onClick={() => start.mutate()}
              loading={start.isPending}
              className="gap-1.5 font-semibold"
            >
              <Play className="size-3.5" />
              {run && !settled ? 'Run again' : 'Run'}
            </Button>
          </div>
        </section>

        {issues.length > 0 && (
          <section
            className="space-y-1.5 p-3 rounded-xl border border-warning/40 bg-warning/5"
            aria-label="Setup notes"
          >
            <div className="gap-1.5 font-semibold flex items-center text-warning">
              <AlertTriangle className="size-3.5" />{' '}
              {issues.some((i) => i.level === 'error')
                ? 'Fix before running'
                : 'Heads up'}
            </div>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {issues.map((issue, i) => (
                <li key={i} className="gap-1.5 flex">
                  <span
                    className={cn(
                      'font-semibold',
                      issue.level === 'error'
                        ? 'text-destructive'
                        : 'text-warning',
                    )}
                  >
                    {issue.level === 'error' ? 'Error' : 'Note'}
                  </span>
                  <span>
                    {issue.nodeId && labels.get(issue.nodeId)
                      ? `${labels.get(issue.nodeId)}: `
                      : ''}
                    {issue.message}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {startError && (
          <section
            className="space-y-1.5 p-3 rounded-xl border border-destructive/40 bg-destructive/5"
            role="alert"
            aria-label="Run could not start"
          >
            <div className="gap-1.5 font-semibold flex items-center text-destructive">
              <AlertTriangle className="size-3.5" /> {startError.title}
            </div>
            <p className="text-xs text-muted-foreground">{startError.detail}</p>
          </section>
        )}

        {!runId && !startError && (
          <EmptyState
            size="sm"
            icon={<Bot className="size-5" />}
            title="Nothing has run yet"
            description="Run the agent to see each step, what its team did, and the result, live."
          />
        )}

        {runId && !run && (
          <div className="gap-2 flex items-center text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Starting…
          </div>
        )}

        {run && (
          <>
            {/* Summary */}
            <div className="gap-4 px-4 py-2.5 text-xs flex flex-wrap items-center rounded-xl border border-border bg-surface-raised font-mono text-muted-foreground">
              <span className="gap-1 flex items-center">
                <Clock className="size-3" />{' '}
                {formatDuration(
                  run.latencyMs ||
                    (settled
                      ? 0
                      : Date.now() - new Date(run.startedAt).getTime()),
                )}
              </span>
              <span className="gap-1 flex items-center">
                <Coins className="size-3" /> {run.tokensUsed.toLocaleString()}{' '}
                tokens · ${run.totalCost.toFixed(4)}
              </span>
              <span>{run.steps.length} steps</span>
              {run.agentTasks.length > 0 && (
                <span className="gap-1 flex items-center">
                  <Users className="size-3" /> {run.agentTasks.length} agent
                  tasks
                </span>
              )}
            </div>

            {run.status === 'FAILED' && run.errorsJson?.message && (
              <div
                role="alert"
                className="p-3 text-xs rounded-xl border border-destructive/40 bg-destructive/5 text-destructive"
              >
                {run.errorsJson.message}
              </div>
            )}

            {pendingApproval && (
              <section
                className="space-y-2 p-3 rounded-xl border border-warning/40 bg-warning/10"
                aria-label="Approval needed"
              >
                <div className="gap-2 font-bold flex items-center text-warning">
                  <ShieldCheck className="size-4" /> Waiting for approval:{' '}
                  {pendingApproval.actionType}
                </div>
                <p className="text-xs text-muted-foreground">
                  The run is paused here. Approving continues it; rejecting
                  stops it. You can also decide it in Approvals.
                </p>
                <div className="gap-2 flex">
                  <Button
                    size="xs"
                    onClick={() =>
                      decide.mutate({
                        id: pendingApproval.id,
                        decision: 'APPROVED',
                      })
                    }
                    loading={decide.isPending}
                  >
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() =>
                      decide.mutate({
                        id: pendingApproval.id,
                        decision: 'REJECTED',
                      })
                    }
                    disabled={decide.isPending}
                  >
                    Reject
                  </Button>
                </div>
              </section>
            )}

            {/* Steps */}
            <section className="space-y-1.5" aria-label="Steps">
              <h3 className="text-xs font-bold text-foreground">Steps</h3>
              <ol className="space-y-1">
                {run.steps.map((step: CanvasRunStep) => (
                  <li key={step.id}>
                    <button
                      type="button"
                      onClick={() =>
                        setSelection({ kind: 'step', id: step.id })
                      }
                      aria-pressed={selectedStep?.id === step.id}
                      className={cn(
                        'gap-2 px-2.5 py-1.5 flex w-full items-center justify-between rounded-lg border text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                        selectedStep?.id === step.id
                          ? 'border-foreground/30 bg-selected'
                          : 'border-border bg-surface-raised/40 hover:bg-surface-raised',
                      )}
                    >
                      <span className="min-w-0 gap-2 flex items-center">
                        <StatusIcon status={step.status} />
                        <span className="font-semibold truncate text-foreground">
                          {labels.get(step.stepId) ?? step.stepId}
                        </span>
                        <span className="shrink-0 font-mono text-2xs text-muted-foreground uppercase">
                          {step.nodeType}
                        </span>
                      </span>
                      <span className="shrink-0 font-mono text-2xs text-muted-foreground">
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
                <h3 className="gap-1.5 text-xs font-bold flex items-center text-foreground">
                  <Users className="size-3.5" /> What the team did
                </h3>
                <ul className="space-y-1">
                  {tasks.map(({ task, depth }) => (
                    <li key={task.id} style={{ paddingLeft: depth * 16 }}>
                      <button
                        type="button"
                        onClick={() =>
                          setSelection({ kind: 'task', id: task.id })
                        }
                        aria-pressed={selectedTask?.id === task.id}
                        className={cn(
                          'gap-2 px-2.5 py-1.5 flex w-full items-center justify-between rounded-lg border text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
                          selectedTask?.id === task.id
                            ? 'border-foreground/30 bg-selected'
                            : 'border-border bg-surface-raised/40 hover:bg-surface-raised',
                        )}
                      >
                        <span className="min-w-0 gap-2 flex items-center">
                          <StatusIcon status={task.status} />
                          <span className="font-semibold shrink-0 text-foreground">
                            {task.agentName}
                          </span>
                          <span className="truncate text-muted-foreground">
                            {task.title}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                          {task.tokensUsed ? `${task.tokensUsed} tok` : ''}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Detail */}
            <section
              className="space-y-2 p-3 rounded-xl border border-border bg-surface-raised/40"
              aria-label="Details"
            >
              {selectedTask ? (
                <TaskDetail
                  task={selectedTask}
                  messages={taskMessages}
                  onCopy={copy}
                />
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-foreground">
                      {selectedStep
                        ? (labels.get(selectedStep.stepId) ??
                          selectedStep.stepId)
                        : settled
                          ? 'Result'
                          : 'Latest output'}
                    </h3>
                    {(selectedStep ?? finalStep) && (
                      <Button
                        variant="ghost"
                        size="xs"
                        className="gap-1"
                        onClick={() =>
                          copy(
                            readableOutput(
                              (selectedStep ?? finalStep)!.outputJson,
                            ),
                          )
                        }
                      >
                        <Copy className="size-3" /> Copy
                      </Button>
                    )}
                  </div>
                  {selectedStep?.errorMessage && (
                    <p className="text-xs text-destructive">
                      {selectedStep.errorMessage}
                    </p>
                  )}
                  {(selectedStep ?? finalStep) ? (
                    <div className="max-h-80 p-3 text-xs leading-relaxed overflow-auto rounded-lg bg-surface whitespace-pre-wrap text-foreground">
                      {readableOutput(
                        (selectedStep ?? finalStep)!.outputJson,
                      ) || 'No output.'}
                    </div>
                  ) : (
                    <p className="text-muted-foreground">
                      {settled ? 'The run produced no output.' : 'Working…'}
                    </p>
                  )}
                  {selectedStep && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-muted-foreground">
                        Raw step data
                      </summary>
                      <CodeBlock
                        variant="compact"
                        language="json"
                        code={JSON.stringify(
                          {
                            input: selectedStep.inputJson,
                            output: selectedStep.outputJson,
                          },
                          null,
                          2,
                        )}
                      />
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

function TaskDetail({
  task,
  messages,
  onCopy,
}: {
  task: AgentTaskRecord;
  messages: AgentMessageRecord[];
  onCopy: (text: string) => void;
}) {
  const result = task.output?.result ?? '';
  return (
    <div className="space-y-3">
      <div className="gap-2 flex items-center justify-between">
        <h3 className="text-xs font-bold text-foreground">
          {task.agentName}
          <Badge variant="neutral" className="ml-2 text-2xs">
            {task.status.toLowerCase().replace('_', ' ')}
          </Badge>
        </h3>
        {result && (
          <Button
            variant="ghost"
            size="xs"
            className="gap-1"
            onClick={() => onCopy(result)}
          >
            <Copy className="size-3" /> Copy result
          </Button>
        )}
      </div>
      {task.error && <p className="text-xs text-destructive">{task.error}</p>}
      {task.output?.notices?.map((n, i) => (
        <p key={i} className="text-xs text-warning">
          {n}
        </p>
      ))}
      {task.output?.tools && task.output.tools.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Tools used: {task.output.tools.join(', ')}
        </p>
      )}
      {messages.length > 0 ? (
        <ol className="space-y-2" aria-label="Conversation">
          {messages.map((m) => (
            <li
              key={m.id}
              className="p-2.5 rounded-lg border border-border bg-surface"
            >
              <div className="mb-1 gap-1.5 font-semibold flex items-center text-2xs text-muted-foreground">
                <MessageSquare className="size-3" /> {m.fromName} → {m.toName}
                <span
                  className={cn(
                    'uppercase',
                    m.kind === 'error' && 'text-destructive',
                  )}
                >
                  · {m.kind}
                </span>
              </div>
              <div className="max-h-56 text-xs leading-relaxed overflow-auto whitespace-pre-wrap text-foreground">
                {m.content}
              </div>
            </li>
          ))}
        </ol>
      ) : (
        result && (
          <div className="max-h-80 p-3 text-xs leading-relaxed overflow-auto rounded-lg bg-surface whitespace-pre-wrap">
            {result}
          </div>
        )
      )}
    </div>
  );
}
