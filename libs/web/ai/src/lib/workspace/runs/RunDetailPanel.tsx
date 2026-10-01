import { MarkdownMessage } from '@org/chat-ui';
import type { AIExecution } from '@org/types';
import {
  AIRunStatusBadge,
  Badge,
  Button,
  CodeBlock,
  copyToClipboard,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  ErrorState,
  LoadingState,
  toast,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import { useWorkspacePermission } from '@org/web-workspace';
import { ClipboardCopy, Pause, Play, RotateCcw, ScrollText, Square } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAIRun, useAIRunActions, useApprovals } from '../use-ai-workspace.js';
import { AgentRunTimeline, formatMs, summarizeToolResult, type ResultItem } from './AgentRunTimeline.js';
import { ApprovalReview } from './ApprovalReview.js';
import { useRunGraph, type RunGraph } from './use-run-updates.js';

/** The final answer: the last Result step that produced text. */
export function runResult(run: AIExecution | undefined): string | null {
  const outputs = [...(run?.steps ?? [])]
    .filter((s) => s.nodeType === 'OUTPUT' && s.status === 'SUCCESS')
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  for (const step of outputs) {
    const value = (step.outputJson as Record<string, unknown>)['output'];
    if (typeof value === 'string' && value.trim()) return value;
  }
  if (run?.entityType !== 'WORKFLOW') {
    const turn = run?.steps?.find((s) => s.stepId === 'turn');
    const value = (turn?.outputJson as Record<string, unknown> | undefined)?.['result'];
    if (typeof value === 'string') return value;
  }
  return null;
}

const WRITE_TOOLS = new Set(['create_doc', 'create_task', 'create_tasks', 'update_task', 'send_channel_message', 'notify_user']);

/** What the run created or changed, and what it read — each linking to where it lives. */
export function runArtifacts(run: AIExecution | undefined) {
  const created: ResultItem[] = [];
  const sources: ResultItem[] = [];
  const seen = new Set<string>();
  for (const step of run?.steps ?? []) {
    if (step.status !== 'SUCCESS') continue;
    const output = step.outputJson as Record<string, unknown>;
    const summary = output['toolResult'] !== undefined ? summarizeToolResult(output['toolResult']) : null;
    if (!summary) continue;
    const tool = String((step.inputJson as Record<string, unknown>)['toolName'] ?? '');
    const bucket = WRITE_TOOLS.has(tool) ? created : sources;
    if (WRITE_TOOLS.has(tool) && summary.items.length === 0) {
      created.push({ text: summary.headline });
      continue;
    }
    for (const item of summary.items) {
      const key = item.link ?? item.text;
      if (seen.has(key)) continue;
      seen.add(key);
      bucket.push(item);
    }
  }
  return { created, sources };
}

const ACTIVE = new Set(['RUNNING', 'WAITING_APPROVAL', 'PAUSED']);

export interface RunDetailPanelProps {
  workspaceId: string | undefined;
  slug: string | undefined;
  runId: string;
  /** The workflow graph when the caller already has it (the agent page). */
  graph?: RunGraph;
  /** Where "review permissions" goes for a step refused for a missing permission. */
  permissionsHref?: string;
  /** Hide the result block (the chat shows it in the conversation). */
  hideResult?: boolean;
}

/**
 * One run in full: its status and controls (pause, resume, cancel, run again),
 * the result, what it created and what it read, and the live step timeline —
 * with the approval inline where it paused.
 */
export function RunDetailPanel({ workspaceId, slug, runId, graph, permissionsHref, hideResult }: RunDetailPanelProps) {
  const { can } = useWorkspacePermission();
  const run = useAIRun(workspaceId, runId);
  const fetchedGraph = useRunGraph(workspaceId, run.data?.entityType, run.data?.entityId, graph);
  const approvals = useApprovals(workspaceId, 'PENDING');
  const { retry, cancel, pause, resume, restart } = useAIRunActions(workspaceId);
  const [logsOpen, setLogsOpen] = useState(false);
  const data = run.data;
  const artifacts = useMemo(() => runArtifacts(data), [data]);

  if (run.isLoading) return <LoadingState label="Loading run…" />;
  if (!data) return <ErrorState title="Couldn't load this run" onRetry={() => void run.refetch()} />;

  const approval = (approvals.data ?? []).find((a) => a.executionId === data.id);
  const result = runResult(data);
  const isTest = data.stateJson?.['__mode'] === 'test';
  const isWorkflow = data.entityType === 'WORKFLOW';
  const errors = data.errorsJson as { message?: string; recovered?: unknown[] } | null | undefined;
  const input = (data.stateJson?.['input'] as { text?: string } | undefined)?.text;
  // The run's own totals are written when it ends; until then, add up its steps.
  const active = ACTIVE.has(data.status);
  const tokens = active ? (data.steps ?? []).reduce((sum, s) => sum + (s.tokensUsed ?? 0), 0) : data.tokensUsed;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <AIRunStatusBadge status={data.status} />
        {isTest ? (
          <Badge variant="info" className="text-[10px]">
            {active ? 'Test run — changes are only simulated' : 'Test run — nothing was changed'}
          </Badge>
        ) : null}
        <span className="text-xs text-muted-foreground">
          Started {formatRelative(data.startedAt)}
          {active ? '' : ` · ${formatMs(data.latencyMs)}`} · {tokens.toLocaleString()} tokens
          {data.user?.name ? ` · by ${data.user.name}` : ''}
        </span>
      </div>

      {input ? (
        <p className="rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-foreground">
          <span className="text-xs text-muted-foreground">Asked: </span>
          {input}
        </p>
      ) : null}

      {data.status === 'FAILED' && errors?.message ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive-text">
          {errors.message}
        </div>
      ) : null}
      {errors?.recovered?.length ? (
        <p className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs text-foreground">
          {errors.recovered.length} step{errors.recovered.length === 1 ? '' : 's'} failed and the agent carried on without {errors.recovered.length === 1 ? 'it' : 'them'} — the result says what is missing.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {can('update') && isWorkflow && data.status === 'RUNNING' ? (
          <Button variant="outline" size="sm" leadingIcon={<Pause />} loading={pause.isPending} onClick={() => pause.mutate(data.id)}>
            Pause
          </Button>
        ) : null}
        {can('update') && data.status === 'PAUSED' ? (
          <Button size="sm" leadingIcon={<Play />} loading={resume.isPending} onClick={() => resume.mutate(data.id)}>
            Resume
          </Button>
        ) : null}
        {can('update') && ACTIVE.has(data.status) && (isWorkflow || data.status !== 'RUNNING') ? (
          <Button variant="outline" size="sm" leadingIcon={<Square />} loading={cancel.isPending} onClick={() => cancel.mutate(data.id)}>
            Cancel
          </Button>
        ) : null}
        {can('create') && !ACTIVE.has(data.status) && data.entityType !== 'APP' ? (
          <Button variant="outline" size="sm" leadingIcon={<RotateCcw />} loading={retry.isPending} onClick={() => retry.mutate(data.id)}>
            Run again
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" leadingIcon={<ScrollText />} onClick={() => setLogsOpen(true)}>
          View logs
        </Button>
      </div>

      {!hideResult && result ? (
        <section aria-labelledby={`result-${data.id}`} className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 id={`result-${data.id}`} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Result
            </h3>
            <Button
              variant="ghost"
              size="xs"
              leadingIcon={<ClipboardCopy />}
              onClick={() => void copyToClipboard(result).then(() => toast.success('Copied'))}
            >
              Copy
            </Button>
          </div>
          <div className="rounded-xl border border-border bg-surface p-4 text-sm">
            <MarkdownMessage text={result} />
          </div>
        </section>
      ) : null}

      {artifacts.created.length || artifacts.sources.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {artifacts.created.length ? <ItemList title={isTest ? 'Would have created' : 'Created'} items={artifacts.created} slug={slug} /> : null}
          {artifacts.sources.length ? <ItemList title="Sources it read" items={artifacts.sources.slice(0, 12)} slug={slug} /> : null}
        </div>
      ) : null}

      <section aria-labelledby={`steps-${data.id}`}>
        <h3 id={`steps-${data.id}`} className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Steps
        </h3>
        <AgentRunTimeline
          run={data}
          graph={graph ?? fetchedGraph.data}
          slug={slug}
          permissionsHref={permissionsHref}
          approvalSlot={approval ? <ApprovalReview workspaceId={workspaceId} approval={approval} /> : null}
          onRestartFrom={isWorkflow && can('create') ? (stepId) => restart.mutate({ runId: data.id, stepId }) : undefined}
          restarting={restart.isPending}
        />
      </section>

      <Dialog open={logsOpen} onOpenChange={setLogsOpen}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Run log</DialogTitle>
            <DialogDescription>Every step exactly as it was recorded, including inputs, outputs and errors.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <CodeBlock
              language="json"
              code={JSON.stringify(
                {
                  id: data.id,
                  status: data.status,
                  startedAt: data.startedAt,
                  finishedAt: data.finishedAt,
                  input: data.stateJson,
                  errors: data.errorsJson,
                  steps: (data.steps ?? []).map((s) => ({
                    step: s.stepId,
                    type: s.nodeType,
                    status: s.status,
                    ms: s.latencyMs,
                    tokens: s.tokensUsed,
                    input: s.inputJson,
                    output: s.outputJson,
                    error: s.errorMessage,
                  })),
                },
                null,
                2,
              ).slice(0, 200_000)}
            />
          </DialogBody>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ItemList({ title, items, slug }: { title: string; items: ResultItem[]; slug: string | undefined }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
      <ul className="space-y-1 text-sm">
        {items.map((item, i) => (
          <li key={i} className="truncate">
            {item.link ? (
              <Link to={`/w/${slug ?? ''}/${item.link}`} className="text-foreground underline-offset-2 hover:underline">
                {item.text}
              </Link>
            ) : (
              <span className="text-foreground">{item.text}</span>
            )}
            {item.meta ? <span className="ml-2 text-xs text-muted-foreground">{item.meta}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
