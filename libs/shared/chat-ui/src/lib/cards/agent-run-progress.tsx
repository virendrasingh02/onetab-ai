import type { AgentToolExecution, AIAgentMessageContent } from '@org/types';
import { Button, CodeBlock } from '@org/ui';
import { cn } from '@org/utils';
import { Check, ChevronDown, Loader2, X } from 'lucide-react';
import { useEffect, useId, useState, type ReactNode } from 'react';

type StepState = 'done' | 'active' | 'pending' | 'failed';

interface RunStep {
  key: string;
  label: ReactNode;
  /** Plain-text label, for the screen-reader status line. */
  text: string;
  state: StepState;
  meta?: string;
  /** Tool steps carry the call itself so it can be inspected in place. */
  tool?: AgentToolExecution;
}

const PENDING_STATUSES = new Set(['queued', 'starting', 'running']);

/** `gmail.search_messages` → `Gmail search messages`; names that already read
 *  like words ("Collect Sources") pass through untouched. */
function toolLabel(name: string): string {
  if (/\s/.test(name) || !/[._-]/.test(name)) return name;
  const words = name
    .split(/[._-]+/)
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  if (total < 60) return `${total}s`;
  return `${Math.floor(total / 60)}m ${String(total % 60).padStart(2, '0')}s`;
}

function formatToolDuration(ms: number): string {
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function toolStep(
  tool: AgentToolExecution,
  idx: number,
  finished: boolean,
): RunStep {
  const state: StepState =
    tool.status === 'failed'
      ? 'failed'
      : tool.status === 'success' || finished
        ? 'done'
        : tool.status === 'running'
          ? 'active'
          : 'pending';
  const verb =
    state === 'done' ? 'Used' : state === 'failed' ? 'Couldn’t use' : 'Using';
  const name = toolLabel(tool.name);
  return {
    key: tool.id || `tool-${idx}`,
    label: (
      <>
        {verb} <span className="font-medium">{name}</span>
      </>
    ),
    text: `${verb} ${name}`,
    state,
    meta:
      tool.durationMs === undefined
        ? undefined
        : formatToolDuration(tool.durationMs),
    tool,
  };
}

/**
 * Builds the visible steps from what the bot actually reports — queued →
 * running → running + tools[] → completed. Nothing is faked on a timer: a
 * step is only "done" once the event says the run has moved past it. Labels
 * switch to the past tense once a step is behind the agent. With tool calls
 * hidden (card settings), the tools collapse into one nameless step.
 */
function buildSteps(
  event: AIAgentMessageContent,
  hasContent: boolean,
  showTools: boolean,
): RunStep[] {
  const finished = event.status === 'completed';
  const queued = event.status === 'queued';
  const tools = event.tools ?? [];
  const toolsBusy =
    !finished &&
    tools.some((t) => t.status === 'running' || t.status === 'queued');
  const composing = !queued && (hasContent || (tools.length > 0 && !toolsBusy));
  const understood = finished || tools.length > 0 || composing;
  const understandText = understood
    ? 'Understood your request'
    : 'Understanding your request';
  const composeText = finished ? 'Wrote the reply' : 'Writing the reply';
  const toolsText = toolsBusy ? 'Using tools' : 'Used tools';

  return [
    queued
      ? {
          key: 'received',
          label: 'Waiting in queue',
          text: 'Waiting in queue',
          state: 'active',
        }
      : {
          key: 'received',
          label: 'Got your message',
          text: 'Got your message',
          state: 'done',
        },
    {
      key: 'understand',
      label: understandText,
      text: understandText,
      state: understood ? 'done' : queued ? 'pending' : 'active',
    },
    ...(showTools
      ? tools.map((t, idx) => toolStep(t, idx, finished))
      : tools.length > 0
        ? [
            {
              key: 'tools',
              label: toolsText,
              text: toolsText,
              state: toolsBusy ? ('active' as const) : ('done' as const),
            },
          ]
        : []),
    {
      key: 'compose',
      label: composeText,
      text: composeText,
      state: finished ? 'done' : composing ? 'active' : 'pending',
    },
  ];
}

const STEP_TEXT: Record<StepState, string> = {
  done: 'text-muted-foreground',
  active: 'font-medium text-foreground',
  pending: 'text-muted-foreground/60',
  failed: 'text-destructive',
};

const STEP_SR_STATE: Record<StepState, string> = {
  done: '',
  active: ' (in progress)',
  pending: ' (up next)',
  failed: '',
};

/** Done is a quiet grey check, now is a live primary dot, next is hollow — so
 *  the three read apart at a glance, not just by colour. */
function StepIcon({ state }: { state: StepState }) {
  return (
    <span
      className="size-4 relative flex shrink-0 items-center justify-center"
      aria-hidden
    >
      {state === 'done' ? (
        <Check className="size-3 text-muted-foreground" strokeWidth={2.5} />
      ) : state === 'failed' ? (
        <X className="size-3 text-destructive" strokeWidth={2.5} />
      ) : state === 'active' ? (
        <>
          <span className="size-2.5 animate-ping absolute rounded-full bg-primary/40 motion-reduce:hidden" />
          <span className="size-2 relative rounded-full bg-primary" />
        </>
      ) : (
        <span className="size-2 rounded-full border border-muted-foreground/40" />
      )}
    </span>
  );
}

const asCode = (value: unknown) =>
  typeof value === 'string' ? value : JSON.stringify(value, null, 2);

/** A tool call's input / output / error, opened from its step. */
function ToolDetails({ id, tool }: { id: string; tool: AgentToolExecution }) {
  return (
    <div id={id} className="mt-1 mb-2 ml-6 space-y-2 min-w-0">
      {Boolean(tool.input) && (
        <div>
          <span className="font-bold mb-1 block text-2xs text-muted-foreground uppercase">
            Input
          </span>
          <CodeBlock
            variant="compact"
            language="json"
            code={asCode(tool.input)}
          />
        </div>
      )}
      {Boolean(tool.output) && (
        <div>
          <span className="font-bold mb-1 block text-2xs text-muted-foreground uppercase">
            Output
          </span>
          <CodeBlock
            variant="compact"
            language="json"
            code={asCode(tool.output)}
          />
        </div>
      )}
      {tool.error && (
        <div className="text-destructive">
          <span className="font-bold block text-2xs uppercase">Error</span>
          <p className="mt-0.5">{tool.error}</p>
        </div>
      )}
    </div>
  );
}

const SHIMMER_CSS = `
  @keyframes agent-run-shimmer {
    from { background-position: 200% 0; }
    to { background-position: -200% 0; }
  }
  .agent-run-text {
    background-image: linear-gradient(90deg, currentColor 35%, var(--color-primary, #16a34a) 50%, currentColor 65%);
    background-size: 200% 100%;
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
    animation: agent-run-shimmer 2.2s linear infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .agent-run-text { animation: none; -webkit-text-fill-color: currentColor; }
  }
`;

export interface AgentRunProgressProps {
  event: AIAgentMessageContent;
  /** Fallback start time when the event predates `startedAt`. */
  fallbackStartedAt?: number;
  hasContent: boolean;
  /** Card setting "Show tool calls": name each tool as its own step, with its
   *  duration and an Inspect for its input/output. */
  showTools?: boolean;
  /** Start a finished run's steps open rather than folded. */
  openWhenDone?: boolean;
}

/**
 * The agent's process steps — the one place a run's progress and tool calls
 * live. While it works they're open under a live "Working on it · 12s"
 * header; once the reply lands they fold into a "Worked for 14s · 3 steps"
 * line above it that opens again on click.
 */
export function AgentRunProgress({
  event,
  fallbackStartedAt,
  hasContent,
  showTools = true,
  openWhenDone = false,
}: AgentRunProgressProps) {
  const pending = PENDING_STATUSES.has(event.status);
  const queued = event.status === 'queued';
  const startedAt = event.startedAt ?? fallbackStartedAt;
  const listId = useId();

  // A toggle only holds for the phase it was made in, so steps someone opened
  // mid-run still fold away when the reply arrives.
  const [toggle, setToggle] = useState<{
    pending: boolean;
    open: boolean;
  } | null>(null);
  const expanded =
    toggle && toggle.pending === pending
      ? toggle.open
      : pending || openWhenDone;

  const [inspecting, setInspecting] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const toggleInspect = (key: string) =>
    setInspecting((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!pending) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [pending]);

  const tools = event.tools ?? [];
  const steps = buildSteps(event, hasContent, showTools);
  const current = steps.find((s) => s.state === 'active');

  let headline: ReactNode;
  let timer: string | undefined;
  if (pending) {
    // Collapsed, the header carries the current step so progress stays visible.
    headline = expanded
      ? queued
        ? 'Waiting to start'
        : 'Working on it'
      : (current?.label ?? 'Working on it');
    timer = startedAt ? formatElapsed(now - startedAt) : undefined;
  } else {
    const durationMs =
      event.durationMs ??
      (event.completedAt && startedAt
        ? event.completedAt - startedAt
        : undefined);
    const failedTools = tools.filter((t) => t.status === 'failed').length;
    // A run that used tools leads with them — the old "Used N tools" line.
    const detail =
      showTools && tools.length > 0
        ? `used ${tools.length} ${tools.length === 1 ? 'tool' : 'tools'}`
        : `${steps.length} steps`;
    headline = (
      <>
        {durationMs === undefined
          ? 'Done'
          : `Worked for ${durationMs < 1000 ? '<1s' : formatElapsed(durationMs)}`}
        {` · ${detail}`}
        {showTools && failedTools > 0 && (
          <>
            {' · '}
            <span className="text-destructive">{failedTools} failed</span>
          </>
        )}
      </>
    );
  }

  return (
    <div className={cn('text-xs', pending ? 'mt-1.5' : 'mt-0.5 mb-1')}>
      {pending && <style>{SHIMMER_CSS}</style>}
      {/* Announces step changes only — never the ticking timer. */}
      {pending && (
        <span role="status" className="sr-only">
          {current?.text ?? (queued ? 'Waiting to start' : 'Working on it')}
        </span>
      )}
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={listId}
        title={
          !pending && showTools && tools.length > 0
            ? tools.map((t) => toolLabel(t.name)).join(', ')
            : undefined
        }
        onClick={() => setToggle({ pending, open: !expanded })}
        className="gap-1.5 px-1.5 py-0.5 -ml-1.5 inline-flex max-w-full cursor-pointer items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <span
          className="size-4 flex shrink-0 items-center justify-center"
          aria-hidden
        >
          {pending ? (
            <Loader2 className="size-3.5 animate-spin text-primary motion-reduce:animate-none" />
          ) : (
            <Check className="size-3.5" strokeWidth={2.5} />
          )}
        </span>
        <span
          className={cn('truncate', pending && 'agent-run-text font-medium')}
        >
          {headline}
        </span>
        {/* The bare space keeps "Working on it · 12s" one phrase to screen
        readers; flex drops it visually. */}
        {timer && (
          <>
            {' '}
            <span className="shrink-0 font-mono text-2xs tabular-nums">
              · {timer}
            </span>
          </>
        )}
        <ChevronDown
          className={cn(
            'size-3 shrink-0 transition-transform duration-200',
            expanded && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {expanded && (
        <ol
          id={listId}
          className="mt-1 ml-2 pl-3 space-y-0.5 animate-in fade-in-0 slide-in-from-top-1 border-l border-border duration-200"
        >
          {steps.map((step, idx) => {
            const tool = step.tool;
            const inspectable = Boolean(
              tool && (tool.input || tool.output || tool.error),
            );
            const open = inspectable && inspecting.has(step.key);
            const detailsId = `${listId}-tool-${idx}`;
            return (
              <li key={step.key}>
                <div className="gap-2 min-h-5 flex items-center">
                  <StepIcon state={step.state} />
                  <span
                    className={cn('min-w-0 truncate', STEP_TEXT[step.state])}
                  >
                    {step.label}
                    {STEP_SR_STATE[step.state] && (
                      <span className="sr-only">
                        {STEP_SR_STATE[step.state]}
                      </span>
                    )}
                  </span>
                  {step.meta && (
                    <span className="shrink-0 font-mono text-2xs text-muted-foreground">
                      {step.meta}
                    </span>
                  )}
                  {inspectable && tool && (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-expanded={open}
                      aria-controls={detailsId}
                      aria-label={`${open ? 'Hide' : 'Inspect'} ${toolLabel(tool.name)}`}
                      onClick={() => toggleInspect(step.key)}
                      className="h-5 px-1.5 shrink-0 text-2xs text-muted-foreground hover:text-foreground"
                    >
                      {open ? 'Hide' : 'Inspect'}
                    </Button>
                  )}
                </div>
                {open && tool && <ToolDetails id={detailsId} tool={tool} />}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
