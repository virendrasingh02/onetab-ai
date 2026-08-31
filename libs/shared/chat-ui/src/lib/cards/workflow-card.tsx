import type { Message, WorkflowMessageContent } from '@org/types';
import {
  Badge,
  Button,
} from '@org/ui';
import { cn } from '@org/utils';
import {
  ArrowDown,
  CheckCircle2,
  Loader2,
  RotateCcw,
  Terminal,
  Workflow,
  XCircle,
} from 'lucide-react';
import { useState } from 'react';
import { formatDuration } from './agent-message-card.js';

export interface WorkflowCardProps {
  message: Message;
  event: WorkflowMessageContent;
  isHighlighted?: boolean;
  onRetryStep?: (stepId: string) => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
}

export function WorkflowCard({
  message,
  event,
  isHighlighted = false,
  onRetryStep,
  onCancel,
}: WorkflowCardProps) {
  const [selectedStepId, setSelectedStepId] = useState<string | null>(
    event.steps[event.currentStepIndex]?.id || event.steps[0]?.id || null,
  );

  const selectedStep = event.steps.find((s) => s.id === selectedStepId);
  const isRunning = event.status === 'running';

  return (
    <article
      data-message-id={message.id}
      className={cn(
        'group/workflow relative my-2 rounded-2xl border border-border/80 bg-surface/95 backdrop-blur-sm p-4 transition-all duration-200 shadow-xs hover:shadow-md max-w-2xl',
        isRunning && 'ring-1 ring-primary/40',
        isHighlighted && 'ring-2 ring-primary/60',
      )}
    >
      {/* Header */}
      <header className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 ring-2 ring-primary/20">
            <Workflow className="size-5" />
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-foreground tracking-tight">
                {event.title}
              </h3>
              <Badge
                variant={
                  event.status === 'completed'
                    ? 'success'
                    : event.status === 'failed'
                      ? 'destructive'
                      : 'primary'
                }
                className="text-[10px] py-0 h-4 uppercase font-bold"
              >
                {event.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Step {event.currentStepIndex + 1} of {event.steps.length}
              {event.durationMs && ` · Total: ${formatDuration(event.durationMs)}`}
            </p>
          </div>
        </div>

        {isRunning && onCancel && (
          <Button
            size="sm"
            variant="outline"
            onClick={onCancel}
            className="h-7 text-xs text-muted-foreground hover:text-destructive"
          >
            Cancel
          </Button>
        )}
      </header>

      {/* Visual Step Progression Flow */}
      <div className="mt-4 space-y-2">
        <span className="text-[11px] font-bold text-foreground block uppercase tracking-wider">
          Multi-Agent Pipeline Steps
        </span>
        <div className="space-y-1.5">
          {event.steps.map((step, idx) => {
            const isSelected = selectedStepId === step.id;

            return (
              <div key={step.id}>
                <button
                  type="button"
                  onClick={() => setSelectedStepId(step.id)}
                  className={cn(
                    'w-full p-2.5 rounded-xl border text-xs text-left transition-all flex items-center justify-between gap-3 cursor-pointer',
                    isSelected
                      ? 'border-primary bg-primary/10 text-foreground font-semibold shadow-xs'
                      : 'border-border/70 bg-surface-raised hover:bg-accent text-muted-foreground',
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="shrink-0">
                      {step.status === 'completed' ? (
                        <CheckCircle2 className="size-4 text-success" />
                      ) : step.status === 'running' ? (
                        <Loader2 className="size-4 animate-spin text-primary" />
                      ) : step.status === 'failed' ? (
                        <XCircle className="size-4 text-destructive" />
                      ) : (
                        <span className="size-4 rounded-full border border-border text-center text-[10px] leading-tight block">
                          {idx + 1}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-foreground truncate block">
                        {step.name}
                      </span>
                      {step.agentName && (
                        <span className="text-[10px] text-muted-foreground block truncate">
                          Agent: {step.agentName}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {step.durationMs !== undefined && (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {formatDuration(step.durationMs)}
                      </span>
                    )}
                    <span className="text-[10px] uppercase font-mono tracking-wider opacity-80">
                      {step.status}
                    </span>
                  </div>
                </button>

                {/* Vertical arrow connector between steps */}
                {idx < event.steps.length - 1 && (
                  <div className="flex justify-center my-0.5">
                    <ArrowDown className="size-3 text-muted-foreground/50" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Details & Output Inspection */}
      {selectedStep && (
        <div className="mt-4 rounded-xl border border-border bg-surface-inset p-3 text-xs font-mono">
          <div className="flex items-center justify-between border-b border-border/60 pb-2 mb-2">
            <span className="font-bold text-foreground flex items-center gap-1.5">
              <Terminal className="size-3.5 text-primary" />
              <span>Step Details: {selectedStep.name}</span>
            </span>

            {selectedStep.status === 'failed' && onRetryStep && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onRetryStep(selectedStep.id)}
                className="h-6 text-[10px] gap-1"
              >
                <RotateCcw className="size-3" />
                <span>Retry Step</span>
              </Button>
            )}
          </div>

          {Boolean(selectedStep.input) && (
            <div className="mb-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                Input
              </span>
              <pre className="p-2 rounded bg-surface text-foreground/90 overflow-x-auto mt-0.5">
                {typeof selectedStep.input === 'string'
                  ? selectedStep.input
                  : JSON.stringify(selectedStep.input, null, 2)}
              </pre>
            </div>
          )}

          {Boolean(selectedStep.output) && (
            <div className="mb-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase block">
                Output
              </span>
              <pre className="p-2 rounded bg-surface text-success-text overflow-x-auto mt-0.5">
                {typeof selectedStep.output === 'string'
                  ? selectedStep.output
                  : JSON.stringify(selectedStep.output, null, 2)}
              </pre>
            </div>
          )}

          {Boolean(selectedStep.error) && (
            <div className="text-destructive font-sans">
              <span className="text-[10px] font-bold uppercase block">Error</span>
              <p className="mt-0.5">{selectedStep.error}</p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
