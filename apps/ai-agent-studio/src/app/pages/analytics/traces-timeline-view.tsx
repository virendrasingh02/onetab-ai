import { useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Input,
  LoadingState,
} from '@org/ui';
import { cn } from '@org/utils';
import type { AIExecutionTrace, ExecutionTraceSpan } from '@org/types';
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock,
  Coins,
  Cpu,
  Layers,
  Search,
  Sparkles,
  Wrench,
  XCircle,
  Zap,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../../services/analyticsService.js';
import { useStudioSession } from '../../session-guard.js';

interface TracesTimelineViewProps {
  initialExecutionId?: string;
  executions?: any[];
}

export function TracesTimelineView({
  initialExecutionId,
  executions = [],
}: TracesTimelineViewProps) {
  const { activeWorkspace } = useStudioSession();
  const [executionId, setExecutionId] = useState(
    initialExecutionId || executions[0]?.id || '',
  );
  const [selectedSpan, setSelectedSpan] = useState<ExecutionTraceSpan | null>(null);

  const {
    data: trace,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['ai-trace-timeline', activeWorkspace.id, executionId],
    queryFn: () => analyticsService.getExecutionTrace(activeWorkspace.id, executionId),
    enabled: Boolean(activeWorkspace.id && executionId),
  });

  const getSpanColor = (kind: string) => {
    switch (kind) {
      case 'MODEL_CALL':
        return 'bg-violet-500 border-violet-600 text-violet-100';
      case 'TOOL_EXECUTION':
        return 'bg-amber-500 border-amber-600 text-amber-100';
      case 'CONNECTOR_REQUEST':
        return 'bg-cyan-500 border-cyan-600 text-cyan-100';
      case 'WORKFLOW_NODE':
        return 'bg-emerald-500 border-emerald-600 text-emerald-100';
      case 'HUMAN_APPROVAL':
        return 'bg-blue-500 border-blue-600 text-blue-100';
      default:
        return 'bg-primary border-primary text-primary-foreground';
    }
  };

  const totalDuration = trace?.totalDurationMs || 1;
  const spans = trace ? trace.spans ?? flattenSpans(trace.rootSpan) : [];
  const traceStart = trace ? new Date(trace.rootSpan.startTime).getTime() : 0;

  return (
    <div className="space-y-6">
      {/* TRACE SELECTOR / SEARCH */}
      <Card className="p-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex-1 flex items-center gap-2">
            <Sparkles className="size-4 text-primary shrink-0" />
            <div className="relative flex-1 max-w-md">
              <Input
                value={executionId}
                onChange={(e) => setExecutionId(e.target.value)}
                placeholder="Enter or paste Execution ID..."
                className="h-8 text-xs font-mono"
              />
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void refetch()}
              loading={isRefetching}
              className="h-8 text-xs"
            >
              Load Trace
            </Button>
          </div>

          {executions.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
              <span className="text-muted-foreground shrink-0">Recent:</span>
              {executions.slice(0, 3).map((ex) => (
                <Button
                  key={ex.id}
                  variant={executionId === ex.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setExecutionId(ex.id)}
                  className="h-7 px-2 font-mono text-[10px]"
                >
                  {ex.id.slice(0, 8)}...
                </Button>
              ))}
            </div>
          )}
        </div>
      </Card>

      {isLoading ? (
        <LoadingState label="Constructing distributed trace waterfall..." />
      ) : !trace ? (
        <Card className="p-12 text-center text-xs text-muted-foreground">
          Enter an Execution ID to inspect the hierarchical span tree and execution timeline.
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* WATERFALL TIMELINE COLUMN (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            <Card className="p-5 shadow-2xs">
              {/* Trace Summary */}
              <div className="flex items-center justify-between border-b border-border pb-4 mb-4">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    Trace Waterfall: <span className="font-mono text-xs">{trace.traceId}</span>
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {trace.spanCount} spans • {trace.totalDurationMs}ms total latency • {trace.totalTokens} tokens
                  </p>
                </div>
                <Badge
                  variant={
                    trace.status === 'SUCCESS' || trace.status === 'COMPLETED'
                      ? 'success'
                      : trace.status === 'FAILED'
                      ? 'destructive'
                      : 'secondary'
                  }
                  className="text-xs"
                >
                  {trace.status}
                </Badge>
              </div>

              {/* Spans List & Waterfall Bars */}
              <div className="space-y-2">
                {spans.map((span) => {
                  const isBottleneck = trace.bottleneckSpanId === span.spanId;
                  const isSelected = selectedSpan?.spanId === span.spanId;

                  // Waterfall relative positioning
                  const startOffset = Math.max(
                    0,
                    new Date(span.startTime).getTime() - traceStart,
                  );
                  const leftPct = Math.min(95, Math.max(0, (startOffset / totalDuration) * 100));
                  const widthPct = Math.min(
                    100 - leftPct,
                    Math.max(5, (span.durationMs / totalDuration) * 100),
                  );

                  return (
                    <div
                      key={span.spanId}
                      onClick={() => setSelectedSpan(span)}
                      className={cn(
                        'p-2.5 rounded-lg border text-xs cursor-pointer transition-all space-y-2',
                        isSelected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                          : isBottleneck
                          ? 'border-amber-500/50 bg-amber-500/5'
                          : 'border-border bg-surface hover:bg-surface-raised',
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 truncate max-w-[70%]">
                          <span
                            className={cn(
                              'size-2 rounded-full shrink-0',
                              span.operationType === 'MODEL_REQUEST'
                                ? 'bg-violet-500'
                                : span.operationType === 'TOOL_INVOCATION'
                                ? 'bg-amber-500'
                                : 'bg-primary',
                            )}
                          />
                          <span className="font-semibold text-foreground truncate">
                            {span.name}
                          </span>
                          <Badge variant="outline" className="text-[9px] font-mono shrink-0">
                            {span.operationType}
                          </Badge>
                          {isBottleneck && (
                            <Badge variant="warning" className="text-[9px] shrink-0">
                              Bottleneck
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-muted-foreground font-mono text-[11px] shrink-0">
                          {span.totalTokens ? <span>{span.totalTokens} tok</span> : null}
                          <span className="font-semibold text-foreground">{span.durationMs}ms</span>
                        </div>
                      </div>

                      {/* Waterfall visual bar */}
                      <div className="relative h-2 w-full bg-surface-raised rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'absolute top-0 bottom-0 rounded-full transition-all',
                            isBottleneck ? 'bg-amber-500' : 'bg-primary',
                          )}
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* SPAN INSPECTOR PANEL (1 col) */}
          <div>
            <Card className="p-5 shadow-2xs space-y-4 sticky top-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h4 className="font-bold text-foreground text-xs flex items-center gap-2">
                  <Cpu className="size-4 text-primary" />
                  Span Telemetry Inspector
                </h4>
                {selectedSpan && (
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {selectedSpan.operationType}
                  </Badge>
                )}
              </div>

              {!selectedSpan ? (
                <div className="text-xs text-muted-foreground py-8 text-center">
                  Click any span from the waterfall timeline to inspect inputs, parameters, outputs, and tokens.
                </div>
              ) : (
                <div className="space-y-3 text-xs">
                  <div>
                    <span className="text-[10px] text-muted-foreground font-semibold">Span Name:</span>
                    <div className="font-semibold text-foreground mt-0.5">{selectedSpan.name}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded bg-surface-raised border border-border">
                      <span className="text-[10px] text-muted-foreground">Duration</span>
                      <div className="font-bold text-foreground">{selectedSpan.durationMs}ms</div>
                    </div>
                    <div className="p-2 rounded bg-surface-raised border border-border">
                      <span className="text-[10px] text-muted-foreground">Tokens</span>
                      <div className="font-bold text-foreground">{selectedSpan.totalTokens ?? 0}</div>
                    </div>
                  </div>

                  {selectedSpan.model && (
                    <div>
                      <span className="text-[10px] text-muted-foreground font-semibold">Model:</span>
                      <div className="font-mono text-foreground mt-0.5">{selectedSpan.model}</div>
                    </div>
                  )}

                  {selectedSpan.inputRedacted && (
                    <div>
                      <span className="text-[10px] text-muted-foreground font-semibold">
                        Inputs (Credentials Redacted):
                      </span>
                      <pre className="mt-1 p-2 rounded bg-surface-raised border border-border text-[10px] font-mono max-h-36 overflow-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(selectedSpan.inputRedacted, null, 2)}
                      </pre>
                    </div>
                  )}

                  {selectedSpan.outputRedacted && (
                    <div>
                      <span className="text-[10px] text-muted-foreground font-semibold">Outputs:</span>
                      <pre className="mt-1 p-2 rounded bg-surface-raised border border-border text-[10px] font-mono max-h-36 overflow-auto whitespace-pre-wrap break-all">
                        {JSON.stringify(selectedSpan.outputRedacted, null, 2)}
                      </pre>
                    </div>
                  )}

                  {selectedSpan.errorMessage && (
                    <div className="p-2.5 rounded bg-destructive/10 border border-destructive/30 text-destructive text-[11px] font-mono">
                      {selectedSpan.errorMessage}
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

/** Depth-first span list for traces that only ship the nested tree. */
function flattenSpans(root: ExecutionTraceSpan): ExecutionTraceSpan[] {
  return [root, ...root.children.flatMap(flattenSpans)];
}
