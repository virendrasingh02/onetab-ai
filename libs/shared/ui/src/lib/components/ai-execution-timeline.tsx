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
import { useState } from 'react';
import { Badge } from './badge.js';
import { CodeBlock } from '../code-block/index.js';

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

export type AIExecutionStepStatus =
  'pending' | 'running' | 'completed' | 'failed' | 'skipped';

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
  const [expandedStepIds, setExpandedStepIds] = useState<Set<string>>(
    new Set(),
  );

  const toggleExpand = (id: string) => {
    const next = new Set(expandedStepIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedStepIds(next);
  };

  const getStepIcon = (
    type: AIExecutionStepType,
    status: AIExecutionStepStatus,
  ) => {
    if (status === 'running') {
      return <Loader2 className="size-3.5 animate-spin text-brand-text" />;
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
        return <Sparkles className="size-3.5 text-brand-text" />;
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
    <div
      className={cn(
        'p-3.5 text-xs flex flex-col rounded-card border border-border bg-surface shadow-xs',
        className,
      )}
    >
      {/* Header bar with summary */}
      <div className="pb-2.5 mb-3 flex items-center justify-between border-b border-border">
        <div className="gap-2 flex items-center">
          <Terminal className="size-4 text-brand-text" />
          <span className="font-semibold text-foreground">
            Agent Execution Trace
          </span>
        </div>

        <div className="gap-2 flex items-center font-mono text-meta text-subtle">
          {totalDurationMs !== undefined && (
            <span className="gap-1 flex items-center">
              <Clock className="size-3" />
              {formatDuration(totalDurationMs)}
            </span>
          )}
          {totalTokens !== undefined && (
            <Badge
              variant="secondary"
              className="h-4.5 px-1.5 font-mono text-2xs"
            >
              {totalTokens.toLocaleString()} tokens
            </Badge>
          )}
        </div>
      </div>

      {/* Steps List */}
      <div className="space-y-3 pl-5 relative flex flex-col">
        {/* Spine line */}
        <div className="bottom-2 top-2 absolute left-[9px] w-px bg-border" />

        {steps.map((step) => {
          const isExpanded = expandedStepIds.has(step.id);
          const hasPayload = Boolean(
            step.inputPayload || step.outputPayload || step.error,
          );

          return (
            <div key={step.id} className="gap-2.5 relative flex items-start">
              {/* Step indicator node */}
              <div className="-left-5 size-5 absolute flex items-center justify-center rounded-full border border-border bg-surface shadow-xs">
                {getStepIcon(step.type, step.status)}
              </div>

              {/* Step Content */}
              <div
                className={cn(
                  'p-2.5 flex-1 rounded-md border border-border bg-surface-raised/50 transition-all',
                  step.status === 'running' && 'border-brand/40 bg-brand/5',
                  step.status === 'failed' &&
                    'border-destructive/30 bg-destructive/5',
                )}
              >
                <div className="gap-2 flex items-center justify-between">
                  <div className="gap-2 flex items-center">
                    <span className="font-semibold text-foreground">
                      {step.name}
                    </span>
                    {step.toolName && (
                      <span className="px-1.5 py-0.2 rounded-xs border border-border bg-surface font-mono text-2xs text-muted-foreground">
                        {step.toolName}
                      </span>
                    )}
                  </div>

                  <div className="gap-1.5 flex items-center font-mono text-2xs text-subtle">
                    {step.durationMs !== undefined && (
                      <span>{formatDuration(step.durationMs)}</span>
                    )}
                    {step.tokensUsed !== undefined && (
                      <span>({step.tokensUsed}t)</span>
                    )}
                  </div>
                </div>

                {step.description && (
                  <p className="mt-1 leading-relaxed text-meta text-muted-foreground">
                    {step.description}
                  </p>
                )}

                {step.error && (
                  <div className="mt-1.5 p-2 rounded-sm bg-destructive/10 font-mono text-meta text-destructive-text">
                    {step.error}
                  </div>
                )}

                {hasPayload && (
                  <div className="mt-2 pt-1.5 border-t border-border/60">
                    <button
                      type="button"
                      onClick={() => toggleExpand(step.id)}
                      className="gap-1 font-medium flex items-center text-2xs text-muted-foreground outline-none hover:text-foreground"
                    >
                      {isExpanded ? (
                        <ChevronDown className="size-3" />
                      ) : (
                        <ChevronRight className="size-3" />
                      )}
                      <span>
                        {isExpanded ? 'Hide Payload' : 'View Payload & Result'}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="mt-2 space-y-2">
                        {step.inputPayload && (
                          <div>
                            <div className="font-bold mb-0.5 text-2xs text-subtle uppercase">
                              Input:
                            </div>
                            <CodeBlock
                              variant="compact"
                              language="json"
                              code={
                                typeof step.inputPayload === 'string'
                                  ? step.inputPayload
                                  : JSON.stringify(step.inputPayload, null, 2)
                              }
                            />
                          </div>
                        )}
                        {step.outputPayload && (
                          <div>
                            <div className="font-bold mb-0.5 text-2xs text-subtle uppercase">
                              Output:
                            </div>
                            <CodeBlock
                              variant="compact"
                              language="json"
                              code={
                                typeof step.outputPayload === 'string'
                                  ? step.outputPayload
                                  : JSON.stringify(step.outputPayload, null, 2)
                              }
                            />
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
