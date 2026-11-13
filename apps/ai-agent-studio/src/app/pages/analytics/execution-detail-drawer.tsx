import { useState } from 'react';
import {
  Badge,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@org/ui';
import { cn } from '@org/utils';
import { Activity, AlertTriangle, Clock, Sparkles, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../../services/analyticsService.js';
import { useStudioSession } from '../../session-guard.js';

interface ExecutionDetailDrawerProps {
  execution: any | null;
  isOpen: boolean;
  onClose: () => void;
  onViewTrace?: (executionId: string) => void;
}

export function ExecutionDetailDrawer({
  execution,
  isOpen,
  onClose,
  onViewTrace,
}: ExecutionDetailDrawerProps) {
  const { activeWorkspace } = useStudioSession();
  const [selectedStep, setSelectedStep] = useState<any | null>(null);

  // Fetch full trace and execution steps if execution ID exists
  const { data: trace, isLoading: isLoadingTrace } = useQuery({
    queryKey: ['execution-trace-drawer', activeWorkspace.id, execution?.id],
    queryFn: () =>
      analyticsService.getExecutionTrace(activeWorkspace.id, execution.id),
    enabled: Boolean(isOpen && execution?.id),
  });

  if (!execution) return null;

  const raw = execution.rawRun || execution;
  const steps = trace?.spans || raw.steps || [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl p-0 flex max-h-[90vh] flex-col overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 border-b border-border bg-surface-raised/40">
          <div className="flex items-center justify-between">
            <div className="gap-3 flex items-center">
              <div
                className={cn(
                  'size-10 font-bold flex items-center justify-center rounded-xl',
                  raw.status === 'SUCCESS' || raw.status === 'succeeded'
                    ? 'bg-success/10 text-success-text'
                    : raw.status === 'FAILED' || raw.status === 'failed'
                      ? 'bg-destructive/10 text-destructive-text'
                      : 'bg-brand/10 text-brand-text',
                )}
              >
                <Activity className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold gap-2 flex items-center text-foreground">
                  Run: <span className="text-sm font-mono">{execution.id}</span>
                  <Badge
                    variant={
                      raw.status === 'SUCCESS' || raw.status === 'succeeded'
                        ? 'success'
                        : raw.status === 'FAILED' || raw.status === 'failed'
                          ? 'destructive'
                          : 'secondary'
                    }
                    className="text-2xs"
                  >
                    {raw.status}
                  </Badge>
                </DialogTitle>
                <p className="text-xs mt-0.5 text-muted-foreground">
                  Started:{' '}
                  {new Date(
                    raw.startedAt || execution.executedAt || 0,
                  ).toLocaleString()}{' '}
                  • Duration: {raw.durationMs || execution.durationMs || 0}ms
                </p>
              </div>
            </div>
            <div className="gap-2 flex items-center">
              {onViewTrace && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewTrace(execution.id)}
                  className="text-xs gap-1.5"
                >
                  <Sparkles className="size-3.5" />
                  Waterfall Trace
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="size-8 p-0"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="gap-3 mt-4 text-xs grid grid-cols-4">
            <div className="p-2.5 rounded-lg border border-border bg-surface">
              <span className="text-2xs text-muted-foreground">
                Tokens In / Out
              </span>
              <div className="mt-0.5 font-bold text-foreground">
                {(raw.tokensUsed || execution.tokensUsed || 0).toLocaleString()}
              </div>
            </div>
            <div className="p-2.5 rounded-lg border border-border bg-surface">
              <span className="text-2xs text-muted-foreground">
                Estimated Cost
              </span>
              <div className="mt-0.5 font-bold text-foreground">
                ${(raw.cost || (raw.tokensUsed || 0) * 0.000005).toFixed(4)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg border border-border bg-surface">
              <span className="text-2xs text-muted-foreground">
                Entity Type
              </span>
              <div className="mt-0.5 font-semibold text-foreground">
                {raw.entityType || 'AGENT'}
              </div>
            </div>
            <div className="p-2.5 rounded-lg border border-border bg-surface">
              <span className="text-2xs text-muted-foreground">Trigger</span>
              <div className="mt-0.5 font-semibold text-foreground">
                {raw.metadata?.triggerType || 'MANUAL'}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <DialogBody className="p-5 space-y-5 overflow-y-auto">
          {/* Error Banner if run failed */}
          {(raw.error || raw.metadata?.error) && (
            <div className="p-4 space-y-1 rounded-xl border border-destructive/40 bg-destructive/5 text-destructive">
              <div className="gap-2 font-bold text-xs flex items-center">
                <AlertTriangle className="size-4" />
                Execution Fault Detected
              </div>
              <p className="text-xs font-mono break-all">
                {raw.error?.message || raw.error || raw.metadata?.error}
              </p>
            </div>
          )}

          {/* Steps & Spans Waterfall List */}
          <div className="space-y-3">
            <div className="text-xs font-semibold flex items-center justify-between text-foreground">
              <span>
                Execution Timeline Steps ({steps.length})
                {isLoadingTrace ? (
                  <span className="ml-2 font-normal text-muted-foreground">
                    loading full trace…
                  </span>
                ) : null}
              </span>
              {trace?.bottleneckSpanId && (
                <Badge variant="warning" className="gap-1 text-2xs">
                  <Clock className="size-3" />
                  Bottleneck Detected
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              {steps.length === 0 ? (
                <div className="text-xs py-6 rounded-lg border border-dashed text-center text-muted-foreground">
                  No discrete execution steps recorded for this invocation.
                </div>
              ) : (
                steps.map((step: any, idx: number) => {
                  const isBottleneck =
                    trace?.bottleneckSpanId === step.spanId ||
                    trace?.bottleneckSpanId === step.id;
                  const isSelected =
                    selectedStep?.spanId === step.spanId ||
                    selectedStep?.id === step.id;

                  return (
                    <div
                      key={step.spanId || step.id || idx}
                      onClick={() => setSelectedStep(step)}
                      className={cn(
                        'p-3 text-xs cursor-pointer rounded-lg border transition-all',
                        isSelected
                          ? 'border-foreground/30 bg-selected ring-1 ring-foreground/10'
                          : isBottleneck
                            ? 'border-warning/50 bg-warning/5'
                            : 'border-border bg-surface-raised hover:border-border/80',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="gap-2 flex items-center">
                          <Badge
                            variant="outline"
                            className="font-mono text-2xs"
                          >
                            {step.kind || step.stepType || 'STEP'}
                          </Badge>
                          <span className="font-semibold text-foreground">
                            {step.name || step.nodeName || `Step ${idx + 1}`}
                          </span>
                          {isBottleneck && (
                            <Badge variant="warning" className="text-2xs">
                              Latency Bottleneck
                            </Badge>
                          )}
                        </div>
                        <div className="gap-3 flex items-center text-muted-foreground">
                          {step.tokens && <span>{step.tokens} tokens</span>}
                          <span>{step.durationMs || 0}ms</span>
                          <Badge
                            variant={
                              step.status === 'SUCCESS' ||
                              step.status === 'succeeded'
                                ? 'success'
                                : step.status === 'FAILED' ||
                                    step.status === 'failed'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                            className="text-2xs"
                          >
                            {step.status}
                          </Badge>
                        </div>
                      </div>

                      {/* Expanded step details when selected */}
                      {isSelected && (
                        <div className="mt-3 pt-3 space-y-2 border-t border-border">
                          {step.inputs && (
                            <div>
                              <span className="font-semibold text-2xs text-muted-foreground">
                                Sanitized Inputs:
                              </span>
                              <pre className="mt-1 p-2 text-xs max-h-32 overflow-auto rounded-md border border-border bg-surface font-mono break-all whitespace-pre-wrap">
                                {typeof step.inputs === 'string'
                                  ? step.inputs
                                  : JSON.stringify(step.inputs, null, 2)}
                              </pre>
                            </div>
                          )}
                          {step.outputs && (
                            <div>
                              <span className="font-semibold text-2xs text-muted-foreground">
                                Output Result:
                              </span>
                              <pre className="mt-1 p-2 text-xs max-h-32 overflow-auto rounded-md border border-border bg-surface font-mono break-all whitespace-pre-wrap">
                                {typeof step.outputs === 'string'
                                  ? step.outputs
                                  : JSON.stringify(step.outputs, null, 2)}
                              </pre>
                            </div>
                          )}
                          {step.error && (
                            <div className="p-2 rounded-md bg-destructive/10 font-mono text-2xs text-destructive">
                              {step.error.message || JSON.stringify(step.error)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
