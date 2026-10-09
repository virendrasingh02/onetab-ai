import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  CodeBlock,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@org/ui';
import { cn } from '@org/utils';
import type { AIExecution, AIExecutionTrace } from '@org/types';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  GitBranch,
  Layers,
  RotateCcw,
  Sparkles,
  Wrench,
  X,
  XCircle,
  Zap,
} from 'lucide-react';
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
    queryFn: () => analyticsService.getExecutionTrace(activeWorkspace.id, execution.id),
    enabled: Boolean(isOpen && execution?.id),
  });

  if (!execution) return null;

  const raw = execution.rawRun || execution;
  const steps = trace?.spans || raw.steps || [];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 border-b border-border bg-surface-raised/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'size-10 rounded-xl flex items-center justify-center font-bold',
                  raw.status === 'SUCCESS' || raw.status === 'succeeded'
                    ? 'bg-emerald-500/10 text-emerald-500'
                    : raw.status === 'FAILED' || raw.status === 'failed'
                    ? 'bg-rose-500/10 text-rose-500'
                    : 'bg-primary/10 text-primary',
                )}
              >
                <Activity className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  Run: <span className="font-mono text-sm">{execution.id}</span>
                  <Badge
                    variant={
                      raw.status === 'SUCCESS' || raw.status === 'succeeded'
                        ? 'success'
                        : raw.status === 'FAILED' || raw.status === 'failed'
                        ? 'destructive'
                        : 'secondary'
                    }
                    className="text-[10px]"
                  >
                    {raw.status}
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Started: {new Date(raw.startedAt || execution.executedAt || 0).toLocaleString()} •
                  Duration: {raw.durationMs || execution.durationMs || 0}ms
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onViewTrace && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onViewTrace(execution.id)}
                  className="text-xs gap-1.5"
                >
                  <Sparkles className="size-3.5 text-primary" />
                  Waterfall Trace
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onClose} className="size-8 p-0">
                <X className="size-4" />
              </Button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-4 gap-3 mt-4 text-xs">
            <div className="p-2.5 rounded-lg bg-surface border border-border">
              <span className="text-[10px] text-muted-foreground">Tokens In / Out</span>
              <div className="mt-0.5 font-bold text-foreground">
                {(raw.tokensUsed || execution.tokensUsed || 0).toLocaleString()}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-surface border border-border">
              <span className="text-[10px] text-muted-foreground">Estimated Cost</span>
              <div className="mt-0.5 font-bold text-foreground">
                ${(raw.cost || (raw.tokensUsed || 0) * 0.000005).toFixed(4)}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-surface border border-border">
              <span className="text-[10px] text-muted-foreground">Entity Type</span>
              <div className="mt-0.5 font-semibold text-foreground">
                {raw.entityType || 'AGENT'}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-surface border border-border">
              <span className="text-[10px] text-muted-foreground">Trigger</span>
              <div className="mt-0.5 font-semibold text-foreground">
                {raw.metadata?.triggerType || 'MANUAL'}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <DialogBody className="p-5 overflow-y-auto space-y-5">
          {/* Error Banner if run failed */}
          {(raw.error || raw.metadata?.error) && (
            <div className="p-4 rounded-xl border border-destructive/40 bg-destructive/5 text-destructive space-y-1">
              <div className="flex items-center gap-2 font-bold text-xs">
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
            <div className="flex items-center justify-between text-xs font-semibold text-foreground">
              <span>Execution Timeline Steps ({steps.length})</span>
              {trace?.bottleneckSpanId && (
                <Badge variant="warning" className="text-[10px] gap-1">
                  <Clock className="size-3" />
                  Bottleneck Detected
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              {steps.length === 0 ? (
                <div className="text-xs text-muted-foreground py-6 text-center border border-dashed rounded-lg">
                  No discrete execution steps recorded for this invocation.
                </div>
              ) : (
                steps.map((step: any, idx: number) => {
                  const isBottleneck =
                    trace?.bottleneckSpanId === step.spanId ||
                    trace?.bottleneckSpanId === step.id;
                  const isSelected =
                    selectedStep?.spanId === step.spanId || selectedStep?.id === step.id;

                  return (
                    <div
                      key={step.spanId || step.id || idx}
                      onClick={() => setSelectedStep(step)}
                      className={cn(
                        'p-3 rounded-lg border text-xs cursor-pointer transition-all',
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                          : isBottleneck
                          ? 'border-amber-500/50 bg-amber-500/5'
                          : 'border-border bg-surface-raised hover:border-border/80',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {step.kind || step.stepType || 'STEP'}
                          </Badge>
                          <span className="font-semibold text-foreground">
                            {step.name || step.nodeName || `Step ${idx + 1}`}
                          </span>
                          {isBottleneck && (
                            <Badge variant="warning" className="text-[9px]">
                              Latency Bottleneck
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-muted-foreground">
                          {step.tokens && <span>{step.tokens} tokens</span>}
                          <span>{step.durationMs || 0}ms</span>
                          <Badge
                            variant={
                              step.status === 'SUCCESS' || step.status === 'succeeded'
                                ? 'success'
                                : step.status === 'FAILED' || step.status === 'failed'
                                ? 'destructive'
                                : 'secondary'
                            }
                            className="text-[9px]"
                          >
                            {step.status}
                          </Badge>
                        </div>
                      </div>

                      {/* Expanded step details when selected */}
                      {isSelected && (
                        <div className="mt-3 pt-3 border-t border-border space-y-2">
                          {step.inputs && (
                            <div>
                              <span className="text-[10px] text-muted-foreground font-semibold">
                                Sanitized Inputs:
                              </span>
                              <pre className="mt-1 p-2 rounded bg-surface border border-border text-[11px] font-mono max-h-32 overflow-auto whitespace-pre-wrap break-all">
                                {typeof step.inputs === 'string'
                                  ? step.inputs
                                  : JSON.stringify(step.inputs, null, 2)}
                              </pre>
                            </div>
                          )}
                          {step.outputs && (
                            <div>
                              <span className="text-[10px] text-muted-foreground font-semibold">
                                Output Result:
                              </span>
                              <pre className="mt-1 p-2 rounded bg-surface border border-border text-[11px] font-mono max-h-32 overflow-auto whitespace-pre-wrap break-all">
                                {typeof step.outputs === 'string'
                                  ? step.outputs
                                  : JSON.stringify(step.outputs, null, 2)}
                              </pre>
                            </div>
                          )}
                          {step.error && (
                            <div className="text-destructive font-mono text-[10px] p-2 bg-destructive/10 rounded">
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
