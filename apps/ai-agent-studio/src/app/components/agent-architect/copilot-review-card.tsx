import { Button } from '@org/ui';
import { cn } from '@org/utils';
import { AlertTriangle, CheckCircle2, ChevronDown, Crosshair, Plus, Wand2, XCircle } from 'lucide-react';
import { useState } from 'react';
import type { CheckLevel, CheckProblem, WorkflowReview } from './workflow-review.js';

function LevelIcon({ level, className }: { level: CheckLevel; className?: string }) {
  const cls = cn('size-3.5 shrink-0', className);
  if (level === 'error') return <XCircle className={cn(cls, 'text-destructive')} aria-label="Problem" />;
  if (level === 'warning') return <AlertTriangle className={cn(cls, 'text-warning')} aria-label="Worth a look" />;
  return <CheckCircle2 className={cn(cls, 'text-success')} aria-label="OK" />;
}

/** The score as a small ring — green when clean, amber with warnings, red with problems. */
function ScoreRing({ score, level }: { score: number; level: CheckLevel }) {
  const r = 15;
  const c = 2 * Math.PI * r;
  const color = level === 'error' ? 'var(--color-destructive)' : level === 'warning' ? 'var(--color-warning)' : 'var(--color-success)';
  return (
    <span className="relative flex size-10 shrink-0 items-center justify-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx="18" cy="18" r={r} fill="none" stroke="var(--color-border)" strokeWidth="3" />
        <circle cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${(score / 100) * c} ${c}`} />
      </svg>
      <span className="text-[11px] font-bold tabular-nums text-foreground">{score}</span>
    </span>
  );
}

export interface CopilotReviewCardProps {
  review: WorkflowReview;
  /** Sends a request to the Copilot (a fix, or an addition). */
  onAsk: (prompt: string) => void;
  /** Frames the step on the canvas. */
  onFocusStep?: (id: string) => void;
  disabled?: boolean;
}

/**
 * The Copilot's "Check": a score, every step with what's wrong with it (each
 * with a Fix that asks the Copilot), and what to add to make it better.
 */
export function CopilotReviewCard({ review, onAsk, onFocusStep, disabled }: CopilotReviewCardProps) {
  const [showOk, setShowOk] = useState(false);
  const flagged = review.steps.filter((s) => s.level !== 'ok');
  const ok = review.steps.filter((s) => s.level === 'ok');
  const overall: CheckLevel = review.counts.error ? 'error' : review.counts.warning ? 'warning' : 'ok';
  const problems: CheckProblem[] = [...review.general, ...flagged.flatMap((s) => s.problems)];

  const problemRow = (p: CheckProblem, key: string) => (
    <li key={key} className="flex items-start gap-2 py-1">
      <LevelIcon level={p.level} className="mt-0.5" />
      <span className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground">{p.message}</span>
      <Button
        variant="ghost"
        size="xs"
        type="button"
        disabled={disabled}
        onClick={() => onAsk(p.fix)}
        className="h-auto shrink-0 gap-1 px-1.5 py-0.5 text-[11px] text-primary hover:bg-primary/10 hover:text-primary"
      >
        <Wand2 className="size-3" aria-hidden /> Fix
      </Button>
    </li>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background">
      {/* Summary */}
      <div className="flex items-center gap-3 border-b border-border px-3 py-2.5">
        <ScoreRing score={review.score} level={overall} />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground">
            {overall === 'ok' ? 'Everything checks out' : overall === 'error' ? 'Needs fixing before it runs well' : 'Works, with things to tidy'}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {review.steps.length} steps · {review.counts.error} problem{review.counts.error === 1 ? '' : 's'} · {review.counts.warning} warning
            {review.counts.warning === 1 ? '' : 's'}
          </p>
        </div>
        {problems.length > 1 && (
          <Button
            size="xs"
            variant="outline"
            disabled={disabled}
            onClick={() => onAsk(`Fix these problems:\n${problems.map((p) => `- ${p.message}`).join('\n')}`)}
            className="shrink-0 gap-1"
          >
            <Wand2 className="size-3" /> Fix all
          </Button>
        )}
      </div>

      {/* Whole-workflow problems */}
      {review.general.length > 0 && <ul className="border-b border-border px-3 py-1.5">{review.general.map((p, i) => problemRow(p, `g${i}`))}</ul>}

      {/* Steps with problems */}
      {flagged.length > 0 && (
        <ul className="divide-y divide-border">
          {flagged.map((s) => (
            <li key={s.id} className="px-3 py-2">
              <button
                type="button"
                onClick={() => onFocusStep?.(s.id)}
                className="group/step flex w-full items-center gap-2 text-left cursor-pointer"
                title="Show it on the canvas"
              >
                <LevelIcon level={s.level} />
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{s.label}</span>
                {onFocusStep && <Crosshair className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover/step:opacity-100" aria-hidden />}
              </button>
              <ul className="mt-0.5 pl-5.5">{s.problems.map((p, i) => problemRow(p, `${s.id}${i}`))}</ul>
            </li>
          ))}
        </ul>
      )}

      {/* Steps that are fine */}
      {ok.length > 0 && (
        <div className={cn('px-3 py-2', (flagged.length > 0 || review.general.length > 0) && 'border-t border-border')}>
          <button
            type="button"
            onClick={() => setShowOk((v) => !v)}
            aria-expanded={showOk}
            className="flex w-full items-center gap-2 text-left text-xs text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <CheckCircle2 className="size-3.5 text-success" aria-hidden />
            <span className="flex-1">
              {ok.length} step{ok.length === 1 ? '' : 's'} set up and connected correctly
            </span>
            <ChevronDown className={cn('size-3.5 transition-transform', showOk && 'rotate-180')} aria-hidden />
          </button>
          {showOk && (
            <ul className="mt-1.5 flex flex-wrap gap-1 pl-5.5">
              {ok.map((s) => (
                <li key={s.id}>
                  <Button
                    variant="outline"
                    size="xs"
                    type="button"
                    onClick={() => onFocusStep?.(s.id)}
                    className="h-auto px-1.5 py-0.5 text-[11px] font-normal"
                  >
                    {s.label}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* What to add */}
      {review.suggestions.length > 0 && (
        <div className="border-t border-border bg-surface/50 px-3 py-2.5">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Make it better</p>
          <ul className="space-y-1.5">
            {review.suggestions.map((s) => (
              <li key={s.title} className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-foreground">{s.title}</p>
                  <p className="text-[11px] leading-snug text-muted-foreground">{s.detail}</p>
                </div>
                <Button
                  variant="outline"
                  size="xs"
                  type="button"
                  disabled={disabled}
                  onClick={() => onAsk(s.prompt)}
                  className="h-auto shrink-0 gap-1 px-1.5 py-0.5 text-[11px]"
                >
                  <Plus className="size-3" aria-hidden /> Add
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
