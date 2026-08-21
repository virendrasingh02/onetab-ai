import { cn } from '@org/utils';
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  Database,
  Globe,
  Loader2,
  Sparkles,
  Terminal,
} from 'lucide-react';
import {
  useState,
} from 'react';
import { Badge } from './badge.js';


export type AIExecutionStepType =
  | 'queued'
  | 'planning'
  | 'tool_call'
  | 'database'
  | 'search'
  | 'code'
  | 'generating'
  | 'approval'
  | 'completed'
  | 'failed';

export type AIExecutionStepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface AIExecutionStep {
  id: string;
  name: string;
  type: AIExecutionStepType;
  status: AIExecutionStepStatus;
  description?: string;
  toolName?: string;
  durationMs?: number;
  tokensUsed?: number;
  inputPayload?: any;
  outputPayload?: any;
  error?: string;
}

export interface AIExecutionTimelineProps {
  steps: AIExecutionStep[];
  className?: string;
  totalDurationMs?: number;
  totalTokens?: number;
}

export function AIExecutionTimeline({
  steps,
  className,
  totalDurationMs,
  totalTokens,
}: AIExecutionTimelineProps) {
  const [expandedStepIds, setExpandedStepIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    const next = new Set(expandedStepIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedStepIds(next);
  };

  const getStepIcon = (type: AIExecutionStepType, status: AIExecutionStepStatus) => {
    if (status === 'running') {
      return <Loader2 className="size-3.5 text-primary animate-spin" />;
    }
    if (status === 'failed') {
      return <AlertTriangle className="size-3.5 text-destructive" />;
    }
    if (status === 'completed') {
      return <CheckCircle2 className="size-3.5 text-success" />;
    }

    switch (type) {
      case 'planning':
        return <Brain className="size-3.5 text-info" />;
      case 'search':
        return <Globe className="size-3.5 text-accent-blue" />;
      case 'database':
        return <Database className="size-3.5 text-accent-amber" />;
      case 'code':
        return <Code2 className="size-3.5 text-accent-violet" />;
      case 'generating':
        return <Sparkles className="size-3.5 text-primary" />;
      case 'queued':
      default:
        return <Clock className="size-3.5 text-muted-foreground" />;
    }
  };

  const formatDuration = (ms?: number) => {
    if (!ms) return undefined;
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className={cn('flex flex-col rounded-card border border-border bg-surface p-3.5 shadow-xs text-xs', className)}>
      {/* Header bar with summary */}
      <div className="flex items-center justify-between border-b border-border pb-2.5 mb-3">
        <div className="flex items-center gap-2">
          <Terminal className="size-4 text-primary" />
          <span className="font-semibold text-foreground">Agent Execution Trace</span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-subtle font-mono">
          {totalDurationMs !== undefined && (
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {formatDuration(totalDurationMs)}
            </span>
          )}
          {totalTokens !== undefined && (
            <Badge variant="secondary" className="font-mono text-[10px] h-4.5 px-1.5">
              {totalTokens.toLocaleString()} tokens
            </Badge>
          )}
        </div>
      </div>

      {/* Steps List */}
      <div className="relative flex flex-col space-y-3 pl-5">
        {/* Spine line */}
        <div className="absolute bottom-2 left-[9px] top-2 w-px bg-border" />

        {steps.map((step) => {
          const isExpanded = expandedStepIds.has(step.id);
          const hasPayload = Boolean(step.inputPayload || step.outputPayload || step.error);

          return (
            <div key={step.id} className="relative flex items-start gap-2.5">
              {/* Step indicator node */}
              <div className="absolute -left-5 flex size-5 items-center justify-center rounded-full bg-surface border border-border shadow-xs">
                {getStepIcon(step.type, step.status)}
              </div>

              {/* Step Content */}
              <div
                className={cn(
                  'flex-1 rounded-md border border-border bg-surface-raised/50 p-2.5 transition-all',
                  step.status === 'running' && 'border-primary/40 bg-primary/5',
                  step.status === 'failed' && 'border-destructive/30 bg-destructive/5',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">{step.name}</span>
                    {step.toolName && (
                      <span className="rounded-xs bg-surface px-1.5 py-0.2 font-mono text-[10px] text-muted-foreground border border-border">
                        {step.toolName}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 font-mono text-[10px] text-subtle">
                    {step.durationMs !== undefined && <span>{formatDuration(step.durationMs)}</span>}
                    {step.tokensUsed !== undefined && <span>({step.tokensUsed}t)</span>}
                  </div>
                </div>

                {step.description && (
                  <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                )}

                {step.error && (
                  <div className="mt-1.5 rounded-sm bg-destructive/10 p-2 text-[11px] text-destructive-text font-mono">
                    {step.error}
                  </div>
                )}

                {hasPayload && (
                  <div className="mt-2 pt-1.5 border-t border-border/60">
                    <button
                      type="button"
                      onClick={() => toggleExpand(step.id)}
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground font-medium outline-none"
                    >
                      {isExpanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                      <span>{isExpanded ? 'Hide Payload' : 'View Payload & Result'}</span>
                    </button>

                    {isExpanded && (
                      <div className="mt-2 space-y-2">
                        {step.inputPayload && (
                          <div>
                            <div className="text-[10px] font-bold uppercase text-subtle mb-0.5">Input:</div>
                            <pre className="rounded-sm bg-surface p-2 font-mono text-[10px] text-foreground/90 overflow-x-auto border border-border">
                              {typeof step.inputPayload === 'string'
                                ? step.inputPayload
                                : JSON.stringify(step.inputPayload, null, 2)}
                            </pre>
                          </div>
                        )}
                        {step.outputPayload && (
                          <div>
                            <div className="text-[10px] font-bold uppercase text-subtle mb-0.5">Output:</div>
                            <pre className="rounded-sm bg-surface p-2 font-mono text-[10px] text-foreground/90 overflow-x-auto border border-border">
                              {typeof step.outputPayload === 'string'
                                ? step.outputPayload
                                : JSON.stringify(step.outputPayload, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
