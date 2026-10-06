import { MarkdownMessage } from '@org/chat-ui';
import type { AIExecution, AIExecutionStep, StudioGraphNode } from '@org/types';
import { PLATFORM_TOOLS } from '@org/types';
import { Badge, Button, CodeBlock, AIModelIcon, AIProviderIcon, AIModelBadge } from '@org/ui';
import { cn } from '@org/utils';
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  CornerDownRight,
  FileText,
  GitBranch,
  Loader2,
  PauseCircle,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Wrench,
  XCircle,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { mainPath, nodeLabel, nodeType, type RunGraph } from './use-run-updates.js';

export type TimelineStatus = 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'WAITING' | 'RUNNING' | 'PENDING';

export interface TimelineRow {
  key: string;
  stepId: string;
  label: string;
  nodeType: string;
  status: TimelineStatus;
  node?: StudioGraphNode;
  step?: AIExecutionStep;
}

const ACTIVE = new Set(['RUNNING', 'WAITING_APPROVAL', 'PAUSED']);

/**
 * The run as a list of steps: what ran (in order), what is running, and —
 * while the run is still going — the steps it has not reached yet.
 */
export function buildTimelineRows(run: AIExecution, graph?: RunGraph): TimelineRow[] {
  const byId = new Map((graph?.nodes ?? []).map((n) => [n.id, n]));
  const steps = [...(run.steps ?? [])].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const rows: TimelineRow[] = steps.map((step) => {
    const node = byId.get(step.stepId);
    return {
      key: step.id,
      stepId: step.stepId,
      label: nodeLabel(node, step.stepId === 'turn' ? 'Agent turn' : humanize(step.stepId)),
      nodeType: step.nodeType,
      status: (step.status as TimelineStatus) ?? 'SUCCESS',
      node,
      step,
    };
  });
  if (ACTIVE.has(run.status) && graph) {
    const done = new Set(rows.map((r) => r.stepId));
    const path = mainPath(graph);
    const lastIndex = Math.max(-1, ...path.map((n, i) => (done.has(n.id) ? i : -1)));
    for (const node of path.slice(lastIndex + 1)) {
      if (done.has(node.id)) continue;
      rows.push({ key: `pending-${node.id}`, stepId: node.id, label: nodeLabel(node, humanize(node.id)), nodeType: nodeType(node), status: 'PENDING', node });
    }
  }
  return rows;
}

function humanize(id: string): string {
  return id.replace(/__.*$/, '').replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

const STATUS_ICON: Record<TimelineStatus, { icon: LucideIcon; className: string; label: string }> = {
  SUCCESS: { icon: CheckCircle2, className: 'text-success', label: 'Done' },
  FAILED: { icon: XCircle, className: 'text-destructive', label: 'Failed' },
  SKIPPED: { icon: CornerDownRight, className: 'text-muted-foreground', label: 'Skipped' },
  WAITING: { icon: PauseCircle, className: 'text-warning', label: 'Waiting for approval' },
  RUNNING: { icon: Loader2, className: 'text-primary motion-safe:animate-spin', label: 'Running' },
  PENDING: { icon: Circle, className: 'text-muted-foreground/50', label: 'Not started' },
};

const TYPE_ICON: Record<string, LucideIcon> = {
  TRIGGER: Zap,
  START: Zap,
  TOOL: Wrench,
  APP: Wrench,
  MCP: Wrench,
  LLM: Sparkles,
  AI_ACTION: Sparkles,
  CLASSIFIER: Sparkles,
  EXTRACT_DATA: Sparkles,
  AGENT: Bot,
  AI_COWORKER: Bot,
  HUMAN_APPROVAL: ShieldCheck,
  HUMAN_INPUT: ShieldCheck,
  CONDITION: GitBranch,
  OUTPUT: FileText,
};

export interface AgentRunTimelineProps {
  run: AIExecution;
  graph?: RunGraph;
  slug: string | undefined;
  /** Rendered under the step that is waiting for approval. */
  approvalSlot?: ReactNode;
  /** Restart the run from this step (a new run). */
  onRestartFrom?: (stepId: string) => void;
  restarting?: boolean;
  /** Where "review permissions" goes for a step refused for missing permission. */
  permissionsHref?: string;
  className?: string;
}

/**
 * The execution timeline: every step with its status, what it read or wrote,
 * how long it took, and — when it failed — why, and what to do about it.
 */
export function AgentRunTimeline({
  run,
  graph,
  slug,
  approvalSlot,
  onRestartFrom,
  restarting,
  permissionsHref,
  className,
}: AgentRunTimelineProps) {
  const rows = useMemo(() => buildTimelineRows(run, graph), [run, graph]);
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {run.status === 'RUNNING' ? 'Starting…' : 'No steps were recorded for this run.'}
      </p>
    );
  }
  const finished = !ACTIVE.has(run.status);
  return (
    <ol className={cn('relative', className)} aria-label="Run steps">
      {rows.map((row, index) => (
        <TimelineItem
          key={row.key}
          row={row}
          last={index === rows.length - 1}
          slug={slug}
          approvalSlot={row.status === 'WAITING' ? approvalSlot : undefined}
          onRestartFrom={finished && onRestartFrom && row.status !== 'PENDING' && row.nodeType !== 'TRIGGER' ? () => onRestartFrom(row.stepId) : undefined}
          restarting={restarting}
          permissionsHref={permissionsHref}
        />
      ))}
    </ol>
  );
}

function TimelineItem({
  row,
  last,
  slug,
  approvalSlot,
  onRestartFrom,
  restarting,
  permissionsHref,
}: {
  row: TimelineRow;
  last: boolean;
  slug: string | undefined;
  approvalSlot?: ReactNode;
  onRestartFrom?: () => void;
  restarting?: boolean;
  permissionsHref?: string;
}) {
  const [open, setOpen] = useState(row.status === 'FAILED');
  const status = STATUS_ICON[row.status];
  const StatusIcon = status.icon;
  const TypeIcon = TYPE_ICON[row.nodeType] ?? Wrench;
  const output = (row.step?.outputJson ?? {}) as Record<string, unknown>;
  const toolName = typeof row.node?.data?.['toolName'] === 'string' ? (row.node.data['toolName'] as string) : undefined;
  const isFirecrawl = toolName?.toLowerCase().includes('firecrawl') || row.label.toLowerCase().includes('firecrawl');
  const isMcp = row.nodeType === 'MCP' || toolName?.toLowerCase().includes('mcp') || row.label.toLowerCase().includes('mcp');
  const isLlm = row.nodeType === 'LLM' || row.nodeType === 'AI_ACTION';
  const llmModel = (row.node?.data?.['model'] as string) || (row.step?.outputJson as any)?.model;
  const activity =
    (typeof row.node?.data?.['activity'] === 'string' ? (row.node.data['activity'] as string) : undefined) ??
    (toolName ? PLATFORM_TOOLS[toolName]?.activity : undefined);
  const expandable = !!row.step && row.status !== 'RUNNING';
  const detailsId = `step-${row.key}`;

  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!last ? <span aria-hidden className="absolute left-[11px] top-6 h-[calc(100%-1rem)] w-px bg-border" /> : null}
      <span className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-background">
        <StatusIcon className={cn('size-5', status.className)} aria-hidden />
        <span className="sr-only">{status.label}</span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <button
            type="button"
            className={cn(
              'flex min-w-0 items-center gap-1.5 rounded text-left text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              row.status === 'PENDING' ? 'text-muted-foreground' : 'text-foreground',
              expandable ? 'cursor-pointer hover:underline' : 'cursor-default',
            )}
            onClick={() => expandable && setOpen((v) => !v)}
            aria-expanded={expandable ? open : undefined}
            aria-controls={expandable ? detailsId : undefined}
            disabled={!expandable}
          >
            {isFirecrawl ? (
              <AIProviderIcon provider="firecrawl" size={14} className="shrink-0" />
            ) : isMcp ? (
              <AIProviderIcon provider="mcp" size={14} className="shrink-0" />
            ) : isLlm ? (
              <AIModelIcon modelId={llmModel || 'gpt-4o'} size={14} className="shrink-0" />
            ) : (
              <TypeIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className="truncate">{row.label}</span>
            {isLlm && llmModel ? (
              <AIModelBadge modelId={llmModel} size="xs" variant="subtle" />
            ) : null}
            {expandable ? (
              open ? <ChevronDown className="size-3.5 shrink-0" aria-hidden /> : <ChevronRight className="size-3.5 shrink-0" aria-hidden />
            ) : null}
          </button>
          {toolName ? (
            <Badge variant="outline" className="font-mono text-[10px]">
              {toolName}
            </Badge>
          ) : null}
          {row.status === 'SKIPPED' && output['dryRun'] ? <Badge variant="info" className="text-[10px]">Simulated</Badge> : null}
          {output['simulated'] ? <Badge variant="info" className="text-[10px]">Approval simulated</Badge> : null}
          {row.step?.status === 'FAILED' && output['errorCode'] ? (
            <Badge variant="destructive" className="text-[10px]">{String(output['errorCode']).replace(/_/g, ' ').toLowerCase()}</Badge>
          ) : null}
          <span className="ml-auto flex shrink-0 items-center gap-3 text-[11px] tabular-nums text-muted-foreground">
            {typeof output['attempts'] === 'number' && (output['attempts'] as number) > 1 ? <span>{output['attempts'] as number} tries</span> : null}
            {row.step?.tokensUsed ? <span>{row.step.tokensUsed.toLocaleString()} tokens</span> : null}
            {row.step && row.status !== 'RUNNING' && row.status !== 'WAITING' ? <span>{formatMs(row.step.latencyMs)}</span> : null}
          </span>
        </div>

        {row.status === 'RUNNING' ? (
          <p className="mt-0.5 text-xs text-primary" aria-live="polite">
            {activity ? `${activity}…` : 'Working…'}
          </p>
        ) : null}
        {row.status === 'FAILED' && row.step ? (
          <StepFailure output={output} message={row.step.errorMessage} slug={slug} permissionsHref={permissionsHref} />
        ) : null}
        {row.status === 'SKIPPED' && (output['note'] || output['reason']) ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{String(output['note'] ?? output['reason'])}</p>
        ) : null}
        {approvalSlot ? <div className="mt-2">{approvalSlot}</div> : null}

        {open && row.step ? (
          <div id={detailsId} className="mt-2 space-y-2 rounded-lg border border-border bg-surface-inset p-3">
            <StepDetails row={row} output={output} slug={slug} />
          </div>
        ) : null}
        {onRestartFrom && (row.status === 'FAILED' || open) ? (
          <Button variant="ghost" size="xs" className="mt-1" leadingIcon={<RotateCcw />} onClick={onRestartFrom} loading={restarting}>
            Restart from this step
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function StepFailure({
  output,
  message,
  slug,
  permissionsHref,
}: {
  output: Record<string, unknown>;
  message?: string | null;
  slug: string | undefined;
  permissionsHref?: string;
}) {
  const code = String(output['errorCode'] ?? '');
  const hint = typeof output['hint'] === 'string' ? (output['hint'] as string) : null;
  return (
    <div role="alert" className="mt-1.5 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs">
      <p className="text-destructive-text">{message ?? String(output['error'] ?? 'This step failed.')}</p>
      {hint ? <p className="mt-1 text-muted-foreground">{hint}</p> : null}
      {code === 'MISSING_CONNECTION' || code === 'CONNECTION_EXPIRED' ? (
        <Button asChild variant="outline" size="xs" className="mt-2">
          <Link to={`/w/${slug ?? ''}/integrations`}>{code === 'CONNECTION_EXPIRED' ? 'Reconnect in Integrations' : 'Connect in Integrations'}</Link>
        </Button>
      ) : null}
      {code === 'MISSING_PERMISSION' && permissionsHref ? (
        <Button asChild variant="outline" size="xs" className="mt-2">
          <Link to={permissionsHref}>Review permissions</Link>
        </Button>
      ) : null}
    </div>
  );
}

/** What a step read or produced, in words where we can, JSON where we can't. */
function StepDetails({ row, output, slug }: { row: TimelineRow; output: Record<string, unknown>; slug: string | undefined }) {
  const aiOutput = typeof output['aiOutput'] === 'string' ? (output['aiOutput'] as string) : null;
  const finalOutput = row.nodeType === 'OUTPUT' && typeof output['output'] === 'string' ? (output['output'] as string) : null;
  const toolResult = output['toolResult'];
  const input = row.step?.inputJson?.['input'];
  const summary = toolResult !== undefined ? summarizeToolResult(toolResult) : null;
  return (
    <>
      {output['model'] ? <p className="text-[11px] text-muted-foreground">Model: {String(output['model'])}{output['failedOver'] ? ' (after another provider was unavailable)' : ''}</p> : null}
      {aiOutput || finalOutput ? (
        <div className="max-h-80 overflow-y-auto text-sm">
          <MarkdownMessage text={(aiOutput ?? finalOutput)!} />
        </div>
      ) : null}
      {summary ? (
        <div className="space-y-1.5 text-xs">
          <p className="font-medium text-foreground">{summary.headline}</p>
          {summary.items.length ? (
            <ul className="space-y-1">
              {summary.items.slice(0, 8).map((item, i) => (
                <li key={i} className="flex items-baseline gap-2">
                  <span aria-hidden className="text-muted-foreground">•</span>
                  {item.link ? (
                    <Link to={`/w/${slug ?? ''}/${item.link}`} className="text-foreground underline-offset-2 hover:underline">
                      {item.text}
                    </Link>
                  ) : (
                    <span className="text-foreground">{item.text}</span>
                  )}
                  {item.meta ? <span className="text-muted-foreground">{item.meta}</span> : null}
                </li>
              ))}
              {summary.items.length > 8 ? <li className="text-muted-foreground">and {summary.items.length - 8} more</li> : null}
            </ul>
          ) : null}
        </div>
      ) : null}
      {input !== undefined && typeof input === 'string' && input.trim() && input.trim() !== '{}' ? (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">Input</summary>
          <CodeBlock variant="compact" language="json" code={input} />
        </details>
      ) : null}
      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground">Raw output</summary>
        <CodeBlock variant="compact" language="json" code={JSON.stringify(output, null, 2).slice(0, 20_000)} />
      </details>
    </>
  );
}

export interface ResultItem {
  text: string;
  meta?: string;
  link?: string;
}

/** A system value as words: `IN_PROGRESS` → "in progress", `STATUS_CHANGED` → "status changed". */
const words = (value: unknown) => String(value ?? '').replace(/_/g, ' ').toLowerCase();

/** A tool's result as a headline and a list — tasks, meetings, docs, emails, created items. */
export function summarizeToolResult(result: unknown): { headline: string; items: ResultItem[] } | null {
  if (!result || typeof result !== 'object') return null;
  const r = result as Record<string, unknown>;
  const list = (key: string) => (Array.isArray(r[key]) ? (r[key] as Array<Record<string, unknown>>) : null);
  const tasks = list('tasks');
  if (tasks && typeof r['created'] === 'number') {
    return {
      headline: `Created ${r['created']} task${r['created'] === 1 ? '' : 's'}${r['skipped'] ? `, skipped ${r['skipped']} that already existed` : ''}`,
      items: tasks.map((t) => ({ text: taskText(t), ...(t['link'] ? { link: String(t['link']) } : {}) })),
    };
  }
  if (tasks) {
    return {
      headline: `${tasks.length} task${tasks.length === 1 ? '' : 's'}${r['truncated'] ? ' (first page)' : ''}`,
      items: tasks.map((t) => ({
        text: taskText(t),
        meta: [t['status'] ? words(t['status']) : null, t['overdue'] ? 'overdue' : null, t['blocked'] ? 'blocked' : null].filter(Boolean).join(' · '),
        ...(t['link'] ? { link: String(t['link']) } : {}),
      })),
    };
  }
  const meetings = list('meetings');
  if (meetings) {
    return {
      headline: `${meetings.length} meeting${meetings.length === 1 ? '' : 's'} ${r['range'] ? String(r['range']) : ''}`.trim(),
      items: meetings.map((m) => ({ text: String(m['title']), meta: m['startAt'] ? new Date(String(m['startAt'])).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : undefined, ...(m['link'] ? { link: String(m['link']) } : {}) })),
    };
  }
  const docs = list('docs');
  if (docs) {
    return { headline: `${docs.length} doc${docs.length === 1 ? '' : 's'}`, items: docs.map((d) => ({ text: String(d['title']), ...(d['link'] ? { link: String(d['link']) } : {}) })) };
  }
  const messages = list('messages');
  if (messages) {
    return { headline: `${messages.length} email${messages.length === 1 ? '' : 's'}`, items: messages.map((m) => ({ text: String(m['subject'] ?? '(no subject)'), meta: m['from'] ? String(m['from']) : undefined })) };
  }
  const projects = list('projects');
  if (projects) {
    return {
      headline: `${projects.length} active project${projects.length === 1 ? '' : 's'}`,
      items: projects.map((p) => ({ text: String(p['name']), meta: `${p['openTasks'] ?? 0} open · ${p['overdueTasks'] ?? 0} overdue`, ...(p['link'] ? { link: String(p['link']) } : {}) })),
    };
  }
  if (r['project'] && typeof r['project'] === 'object') {
    const p = r['project'] as Record<string, unknown>;
    const blocked = Array.isArray(r['blocked']) ? (r['blocked'] as Array<Record<string, unknown>>) : [];
    return {
      headline: `${String(p['name'])} — ${words(p['status'])}, ${r['percentDone'] ?? 0}% done`,
      items: blocked.map((t) => ({ text: taskText(t), meta: 'blocked', ...(t['link'] ? { link: String(t['link']) } : {}) })),
    };
  }
  if (Array.isArray(r['changes']) || Array.isArray(r['events'])) {
    const changes = (r['changes'] as Array<Record<string, unknown>> | undefined) ?? [];
    const events = (r['events'] as Array<Record<string, unknown>> | undefined) ?? [];
    return {
      headline: `${changes.length + events.length} change${changes.length + events.length === 1 ? '' : 's'} ${r['range'] ? String(r['range']) : ''}`.trim(),
      items: [
        ...changes.map((c) => ({ text: String(c['task']), meta: c['field'] ? `${words(c['field'])} → ${words(c['to'])}` : words(c['action']), ...(c['link'] ? { link: String(c['link']) } : {}) })),
        ...events.map((e) => ({ text: String(e['summary'] ?? e['kind']), ...(e['link'] ? { link: String(e['link']) } : {}) })),
      ],
    };
  }
  // `create_doc` answers `{ created, id, title, link }`; older runs stored the raw row (`kind: 'DOC'`).
  if (r['id'] && (r['kind'] === 'DOC' || (r['created'] === true && typeof r['link'] === 'string' && String(r['link']).startsWith('docs/')))) {
    return { headline: 'Created a doc', items: [{ text: String(r['title'] ?? 'Untitled'), link: typeof r['link'] === 'string' ? r['link'] : `docs/${String(r['id'])}` }] };
  }
  if (r['created'] === true && r['task'] && typeof r['task'] === 'object') {
    const t = r['task'] as Record<string, unknown>;
    return { headline: 'Created a task', items: [{ text: taskText(t), ...(t['link'] ? { link: String(t['link']) } : {}) }] };
  }
  if (r['updated'] === true && r['task'] && typeof r['task'] === 'object') {
    const t = r['task'] as Record<string, unknown>;
    return { headline: 'Updated a task', items: [{ text: taskText(t), ...(t['link'] ? { link: String(t['link']) } : {}) }] };
  }
  if (r['delivered'] === true) {
    return { headline: r['channel'] ? `Posted in #${String(r['channel'])}` : `Sent: ${String(r['title'] ?? 'notification')}`, items: [] };
  }
  if (typeof r['count'] === 'number') return { headline: `${r['count']} result${r['count'] === 1 ? '' : 's'}`, items: [] };
  return null;
}

function taskText(t: Record<string, unknown>): string {
  return t['identifier'] ? `${String(t['identifier'])} ${String(t['title'])}` : String(t['title']);
}

export function formatMs(ms: number | undefined): string {
  if (!ms) return '0s';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}
