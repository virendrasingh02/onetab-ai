import { workToolsApi } from '@org/api-client';
import { MarkdownMessage } from '@org/chat-ui';
import { PLATFORM_TOOLS, type AIExecution, type StudioAgentDetail } from '@org/types';
import { AIRunStatusBadge, Button, copyToClipboard, EmptyState, LoadingState, Switch, Textarea, toast } from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import {
  ApprovalReview,
  buildTimelineRows,
  errorText,
  runArtifacts,
  runResult,
  studioAgentPath,
  useAIRun,
  useAIRunActions,
  useAIRuns,
  useApprovals,
} from '@org/web-ai';
import { useWorkspacePermission } from '@org/web-workspace';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, ClipboardCopy, ExternalLink, FilePlus2, Loader2, MessageSquare, RotateCcw, Send, XCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useStudioMutations } from './use-studio.js';

const ACTIVE = new Set(['RUNNING', 'WAITING_APPROVAL', 'PAUSED']);

/**
 * The agent's conversation. Every message is a run: what you asked becomes
 * `{{input.text}}` for its steps, and the reply is the run itself — live
 * status while it works, then the result with what it created.
 */
export function AgentChat({ workspaceId, slug, agent }: { workspaceId: string | undefined; slug: string | undefined; agent: StudioAgentDetail }) {
  const { can } = useWorkspacePermission();
  const runs = useAIRuns(workspaceId, { entityType: 'WORKFLOW', entityId: agent.id, limit: 12 });
  const { run } = useStudioMutations(workspaceId);
  const [text, setText] = useState('');
  const [test, setTest] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const history = useMemo(() => [...(runs.data ?? [])].reverse(), [runs.data]);
  const graph = useMemo(() => ({ nodes: agent.nodes, edges: agent.edges }), [agent.nodes, agent.edges]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end', behavior: 'smooth' });
  }, [history.length]);

  const send = () => {
    const message = text.trim();
    run.mutate(
      { id: agent.id, text: message, mode: test ? 'test' : 'live' },
      { onSuccess: () => setText('') },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-6" aria-live="polite">
        {runs.isLoading ? (
          <LoadingState label="Loading the conversation…" />
        ) : history.length === 0 ? (
          <EmptyState
            size="sm"
            icon={<MessageSquare />}
            title={`Ask ${agent.name} to do its job`}
            description={
              agent.trigger.kind === 'manual'
                ? 'Type a request, or just press Run — it works from its plan.'
                : 'It also runs on its own; those runs appear here too.'
            }
          />
        ) : (
          history.map((r) => <ChatTurn key={r.id} workspaceId={workspaceId} slug={slug} agent={agent} summary={r} graph={graph} />)
        )}
        <div ref={bottom} />
      </div>

      {can('create') && agent.state !== 'archived' ? (
        <form
          className="sticky bottom-0 space-y-2 rounded-xl border border-border bg-surface p-3 shadow-sm"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label htmlFor="agent-chat-input" className="sr-only">
            Message {agent.name}
          </label>
          <Textarea
            id="agent-chat-input"
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={`Ask ${agent.name}… (e.g. “Prepare my report”, or leave empty to just run it)`}
            className="resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
          <div className="flex items-center justify-between gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Switch checked={test} onCheckedChange={setTest} aria-label="Test mode" />
              Test mode — changes nothing
            </label>
            <Button type="submit" size="sm" leadingIcon={<Send />} loading={run.isPending}>
              {text.trim() ? 'Send' : 'Run'}
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function ChatTurn({
  workspaceId,
  slug,
  agent,
  summary,
  graph,
}: {
  workspaceId: string | undefined;
  slug: string | undefined;
  agent: StudioAgentDetail;
  summary: AIExecution;
  graph: { nodes: StudioAgentDetail['nodes']; edges: StudioAgentDetail['edges'] };
}) {
  const detail = useAIRun(workspaceId, summary.id);
  const run = detail.data ?? summary;
  const state = (run.stateJson ?? {}) as Record<string, unknown>;
  const asked = (state['input'] as { text?: string } | undefined)?.text;
  const startedBy = String(state['__startedBy'] ?? 'person');
  const isTest = state['__mode'] === 'test';
  const prompt =
    asked ||
    (startedBy === 'schedule'
      ? 'Ran on its schedule'
      : startedBy === 'event'
        ? `Ran because ${String(state['trigger'] ?? 'an event happened').replace(/\./g, ' ')}`
        : startedBy === 'retry'
          ? 'Ran again'
          : 'Run');

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary/10 px-3 py-2 text-sm text-foreground">
          {isTest ? <span className="mr-1 text-xs font-medium text-info-text">Test ·</span> : null}
          {prompt}
          <span className="ml-2 text-[10px] text-muted-foreground">{formatRelative(run.startedAt)}</span>
        </div>
      </div>
      <div className="max-w-[95%] space-y-3 rounded-2xl rounded-bl-sm border border-border bg-surface p-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{agent.name}</span>
          <AIRunStatusBadge status={run.status} />
        </div>
        <RunReply workspaceId={workspaceId} slug={slug} agent={agent} run={run} graph={graph} isTest={isTest} />
      </div>
    </div>
  );
}

function RunReply({
  workspaceId,
  slug,
  agent,
  run,
  graph,
  isTest,
}: {
  workspaceId: string | undefined;
  slug: string | undefined;
  agent: StudioAgentDetail;
  run: AIExecution;
  graph: { nodes: StudioAgentDetail['nodes']; edges: StudioAgentDetail['edges'] };
  isTest: boolean;
}) {
  const approvals = useApprovals(workspaceId, 'PENDING');
  const { retry } = useAIRunActions(workspaceId);
  const approval = (approvals.data ?? []).find((a) => a.executionId === run.id);
  const rows = useMemo(() => (run.steps ? buildTimelineRows(run, graph) : []), [run, graph]);
  const result = runResult(run);
  const artifacts = useMemo(() => runArtifacts(run), [run]);
  const createdDoc = artifacts.created.find((c) => c.link?.startsWith('docs/'));
  const saveDoc = useMutation({
    mutationFn: () =>
      workToolsApi.createDocument(workspaceId as string, {
        title: `${agent.name} — ${new Date(run.startedAt).toLocaleDateString()}`,
        content: result ?? '',
      } as never),
    onSuccess: () => toast.success('Saved as a doc'),
    onError: (err) => toast.error('Could not save the doc', { description: errorText(err) }),
  });
  const active = ACTIVE.has(run.status);
  const runHref = `${studioAgentPath(slug, agent.id, 'runs')}&run=${run.id}`;
  const failure = (run.errorsJson as { message?: string } | null)?.message;

  return (
    <div className="space-y-3">
      {active || !result ? (
        <ol className="space-y-1 text-xs">
          {rows
            .filter((r) => r.nodeType !== 'TRIGGER' && r.nodeType !== 'OUTPUT')
            .map((r) => {
              const tool = typeof r.node?.data?.['toolName'] === 'string' ? (r.node.data['toolName'] as string) : undefined;
              const activity = (r.node?.data?.['activity'] as string | undefined) ?? (tool ? PLATFORM_TOOLS[tool]?.activity : undefined);
              return (
                <li key={r.key} className={cn('flex items-center gap-2', r.status === 'PENDING' ? 'text-muted-foreground/70' : 'text-foreground')}>
                  {r.status === 'RUNNING' ? (
                    <Loader2 className="size-3.5 shrink-0 text-primary motion-safe:animate-spin" aria-hidden />
                  ) : r.status === 'FAILED' ? (
                    <XCircle className="size-3.5 shrink-0 text-destructive" aria-hidden />
                  ) : r.status === 'PENDING' ? (
                    <span className="size-3.5 shrink-0 rounded-full border border-border" aria-hidden />
                  ) : (
                    <CheckCircle2 className={cn('size-3.5 shrink-0', r.status === 'SKIPPED' ? 'text-muted-foreground' : 'text-success')} aria-hidden />
                  )}
                  <span>{r.status === 'RUNNING' && activity ? `${activity}…` : r.label}</span>
                  {r.status === 'SKIPPED' ? <span className="text-muted-foreground">(simulated)</span> : null}
                </li>
              );
            })}
        </ol>
      ) : null}

      {approval ? <ApprovalReview workspaceId={workspaceId} approval={approval} /> : null}

      {run.status === 'FAILED' ? (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive-text">
          {failure ?? 'The run failed.'}
        </div>
      ) : null}

      {result ? (
        <div className="text-sm">
          <MarkdownMessage text={result} />
        </div>
      ) : null}

      {!active ? (
        <div className="flex flex-wrap gap-1.5">
          {result ? (
            <Button variant="ghost" size="xs" leadingIcon={<ClipboardCopy />} onClick={() => void copyToClipboard(result).then(() => toast.success('Copied'))}>
              Copy
            </Button>
          ) : null}
          {createdDoc ? (
            <Button variant="ghost" size="xs" leadingIcon={<ExternalLink />} asChild>
              <Link to={`/w/${slug ?? ''}/${createdDoc.link}`}>Open doc</Link>
            </Button>
          ) : result && !isTest ? (
            <Button variant="ghost" size="xs" leadingIcon={<FilePlus2 />} loading={saveDoc.isPending} disabled={saveDoc.isSuccess} onClick={() => saveDoc.mutate()}>
              {saveDoc.isSuccess ? 'Saved' : 'Save as doc'}
            </Button>
          ) : null}
          <Button variant="ghost" size="xs" leadingIcon={<ExternalLink />} asChild>
            <Link to={runHref}>Steps &amp; details</Link>
          </Button>
          {run.status === 'FAILED' ? (
            <Button variant="ghost" size="xs" leadingIcon={<RotateCcw />} loading={retry.isPending} onClick={() => retry.mutate(run.id)}>
              Try again
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
