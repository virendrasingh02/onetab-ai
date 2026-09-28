import type { AgentTestRunResult } from '@org/types';
import {
  AIExecutionTimeline,
  AIRunStatusBadge,
  Button,
  Field,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Textarea,
  type AIExecutionStep,
} from '@org/ui';
import { ExternalLink, Play } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

export interface AgentTestPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentName: string;
  /** Saves pending edits first — a test always runs the saved agent. */
  onRun: (message: string) => Promise<AgentTestRunResult | undefined>;
  running: boolean;
  /** Where the Runs view is, to open the recorded run. */
  runsPath: string;
  dirty: boolean;
}

const STATUS_FOR_BADGE: Record<AgentTestRunResult['status'], string> = {
  SUCCESS: 'COMPLETED',
  WAITING_APPROVAL: 'WAITING_APPROVAL',
  FAILED: 'FAILED',
};

function toSteps(result: AgentTestRunResult): AIExecutionStep[] {
  return result.steps.map((step) => ({
    id: step.stepId,
    name: step.label,
    type: step.status === 'FAILED' ? 'failed' : step.nodeType === 'TOOL' ? 'tool_call' : 'generating',
    status: step.status === 'SUCCESS' ? 'completed' : step.status === 'FAILED' ? 'failed' : 'pending',
    durationMs: step.latencyMs,
    tokensUsed: step.tokensUsed,
    outputPayload: step.output,
  }));
}

/**
 * Test an agent the way it will really run: the same runtime, tools, knowledge
 * and approval rules as chat, recorded in Runs. Tools that need approval are
 * queued, not run — the trace shows them as waiting.
 */
export function AgentTestPanel({
  open,
  onOpenChange,
  agentName,
  onRun,
  running,
  runsPath,
  dirty,
}: AgentTestPanelProps) {
  const [message, setMessage] = useState('');
  const [result, setResult] = useState<AgentTestRunResult | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!message.trim() || running) return;
    const next = await onRun(message.trim());
    if (next) setResult(next);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Test {agentName}</SheetTitle>
          <SheetDescription>
            Runs for real with its tools and knowledge. Actions that need approval wait in Approvals instead of running.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} className="space-y-3 px-4">
          <Field
            label="Message"
            hint={dirty ? 'Your unsaved changes are saved before the test runs.' : undefined}
          >
            <Textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask it what a teammate would ask…"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit(e);
              }}
            />
          </Field>
          <Button type="submit" leadingIcon={<Play />} loading={running} disabled={!message.trim()}>
            Run test
          </Button>
        </form>

        {result ? (
          <div className="mt-6 space-y-4 px-4 pb-6" aria-live="polite">
            <div className="flex flex-wrap items-center gap-2">
              <AIRunStatusBadge status={STATUS_FOR_BADGE[result.status]} />
              <span className="text-xs text-muted-foreground">
                {(result.duration / 1000).toFixed(1)}s · {result.tokensUsed.toLocaleString()} tokens
              </span>
              {result.executionId ? (
                <Button variant="ghost" size="sm" asChild className="ml-auto">
                  <Link to={`${runsPath}?run=${result.executionId}`}>
                    Open run <ExternalLink className="size-3.5" />
                  </Link>
                </Button>
              ) : null}
            </div>

            {result.notices.length > 0 ? (
              <ul className="space-y-1">
                {result.notices.map((notice) => (
                  <li key={notice} className="rounded-md bg-warning/10 px-2 py-1 text-xs text-warning">
                    {notice}
                  </li>
                ))}
              </ul>
            ) : null}

            <section aria-labelledby="test-answer">
              <h3 id="test-answer" className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {result.status === 'FAILED' ? 'Error' : 'Answer'}
              </h3>
              <p
                className={
                  result.status === 'FAILED'
                    ? 'whitespace-pre-wrap rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive'
                    : 'whitespace-pre-wrap rounded-lg border border-border bg-surface-inset p-3 text-sm text-foreground'
                }
              >
                {typeof result.output === 'string' ? result.output : JSON.stringify(result.output, null, 2)}
              </p>
            </section>

            {result.steps.length > 1 ? (
              <section aria-labelledby="test-steps">
                <h3 id="test-steps" className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  What it did
                </h3>
                <AIExecutionTimeline steps={toSteps(result)} totalDurationMs={result.duration} totalTokens={result.tokensUsed} />
              </section>
            ) : null}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
