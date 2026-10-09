import { cn } from '@org/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment, useState, type ReactNode } from 'react';

/**
 * What the latest run produced at one step, as the run console reports it
 * (`RunConsoleDrawer` → page → node data `run`). View state only: never saved
 * with the graph.
 */
export interface NodeRunResult {
  status: 'running' | 'success' | 'failed' | 'waiting' | 'idle';
  /** Readable output (or input, for a trigger). */
  output: string;
  tokens: number;
  latencyMs: number;
  error?: string | null;
  /** Cleared by the person (the Output card's Clear). */
  cleared?: boolean;
}

export interface NodeAnalyticsOverlayData {
  executionCount: number;
  successCount: number;
  errorCount: number;
  successRate: number;
  avgDurationMs: number;
  totalTokens: number;
  estimatedCost: number;
  errorRate: number;
  retryCount: number;
  relativeIntensity: number; // 0 to 1
  metricLabel: string;
  metricValue: string;
}

export function NodeAnalyticsBadge({
  analytics,
  onClick,
}: {
  analytics?: NodeAnalyticsOverlayData;
  onClick?: () => void;
}) {
  if (!analytics) return null;
  const intensityStyle =
    analytics.relativeIntensity > 0.7
      ? 'border-rose-500/60 bg-rose-500/15 text-rose-500 ring-2 ring-rose-500/20'
      : analytics.relativeIntensity > 0.35
      ? 'border-amber-500/60 bg-amber-500/15 text-amber-500 ring-1 ring-amber-500/20'
      : 'border-emerald-500/60 bg-emerald-500/15 text-emerald-500';

  return (
    <div
      onClick={(e) => {
        if (onClick) {
          e.stopPropagation();
          onClick();
        }
      }}
      className={cn(
        'nodrag nopan absolute -top-3.5 right-3 z-20 flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold border backdrop-blur-md shadow-xs transition-all hover:scale-105 cursor-pointer',
        intensityStyle,
      )}
      title={`Runs: ${analytics.executionCount} | Success: ${analytics.successRate.toFixed(1)}% | Avg Duration: ${Math.round(analytics.avgDurationMs)}ms | Cost: $${analytics.estimatedCost.toFixed(4)}`}
    >
      <span className="opacity-80 font-normal">{analytics.metricLabel}:</span>
      <span className="font-mono font-bold">{analytics.metricValue}</span>
      <span className="opacity-60 text-[9px] font-mono">({analytics.executionCount})</span>
    </div>
  );
}

export const formatSeconds = (ms: number) => `${(Math.max(0, ms) / 1000).toFixed(2)} sec`;

/**
 * The bar along a card's bottom: "View Results" with the step's tokens and
 * time. Expands to the step's output from the latest run. Hidden until the
 * step has used tokens (or while it runs). Cards are `p-3.5`,
 * so the bar bleeds to the card's edges with matching negative margins.
 */
export function NodeRunFooter({ run, showTokens = true, extra }: { run?: NodeRunResult; showTokens?: boolean; extra?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const hasOutput = Boolean(run && (run.output || run.error));
  const running = run?.status === 'running';
  // Only steps that actually spent tokens (or are mid-run) get the bar
  if (!running && !((run?.tokens ?? 0) > 0)) return null;
  return (
    <div className="nodrag nopan -mx-3.5 -mb-3.5 mt-3 rounded-b-xl border-t border-border/70 bg-surface-raised/30">
      <div className="flex items-center gap-2 px-3.5 py-1.5 text-[10px] text-muted-foreground">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (hasOutput) setOpen((o) => !o);
          }}
          disabled={!hasOutput}
          aria-expanded={hasOutput ? open : undefined}
          title={hasOutput ? undefined : running ? 'Running…' : 'Run the agent to see this step’s results'}
          className="inline-flex items-center gap-1 rounded font-medium hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-default disabled:hover:text-muted-foreground"
        >
          {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          {running ? 'Running…' : 'View Results'}
        </button>
        <span className="ml-auto flex items-center gap-2 tabular-nums">
          {extra}
          {showTokens && <span>{(run?.tokens ?? 0).toLocaleString()} tokens</span>}
          <span>{formatSeconds(run?.latencyMs ?? 0)}</span>
        </span>
      </div>
      {open && hasOutput && (
        <pre
          tabIndex={0}
          className={cn(
            'nowheel mx-3.5 mb-3 max-h-48 overflow-auto whitespace-pre-wrap [overflow-wrap:anywhere] rounded-lg border px-2.5 py-2 font-mono text-[10px] leading-relaxed',
            run?.error ? 'border-destructive/30 bg-destructive/5 text-destructive' : 'border-border bg-surface text-foreground',
          )}
        >
          {run?.error || run?.output}
        </pre>
      )}
    </div>
  );
}

/** Inline `**bold**` and `` `code` `` in a line of Markdown, as React elements (no HTML injection). */
function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const token = m[0];
    out.push(
      token.startsWith('**') ? (
        <strong key={k++} className="font-semibold">{token.slice(2, -2)}</strong>
      ) : (
        <code key={k++} className="rounded bg-surface-raised px-1 font-mono text-[0.95em]">{token.slice(1, -1)}</code>
      ),
    );
    last = m.index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

/**
 * A light Markdown view for agent output: headings, bullet / numbered lists,
 * code blocks, bold and inline code. Anything else is plain paragraphs.
 */
export function FormattedText({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let list: { ordered: boolean; items: string[] } | null = null;
  const flushList = () => {
    if (!list) return;
    const Tag = list.ordered ? 'ol' : 'ul';
    blocks.push(
      <Tag key={blocks.length} className={cn('space-y-0.5 pl-4', list.ordered ? 'list-decimal' : 'list-disc')}>
        {list.items.map((item, i) => (
          <li key={i}>{inline(item)}</li>
        ))}
      </Tag>,
    );
    list = null;
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('```')) {
      flushList();
      const code: string[] = [];
      while (++i < lines.length && !lines[i].startsWith('```')) code.push(lines[i]);
      blocks.push(
        <pre key={blocks.length} className="overflow-auto rounded-md bg-surface-raised p-2 font-mono text-[10px]">
          {code.join('\n')}
        </pre>,
      );
      continue;
    }
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flushList();
      list = list ?? { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]);
      continue;
    }
    flushList();
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push(
        <p key={blocks.length} className={cn('font-semibold text-foreground', heading[1].length <= 2 && 'text-[13px]')}>
          {inline(heading[2])}
        </p>,
      );
    } else if (line.trim()) {
      blocks.push(<p key={blocks.length}>{inline(line)}</p>);
    }
  }
  flushList();
  return <div className={cn('space-y-1.5 text-xs leading-relaxed text-foreground', className)}>{blocks.map((b, i) => <Fragment key={i}>{b}</Fragment>)}</div>;
}
