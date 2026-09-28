import type { AIExecutionStatus, AIExecutionStep as RecordedStep } from '@org/types';
import { cn } from '@org/utils';
import type { AIExecutionStep, AIExecutionStepType } from './ai-execution-timeline.js';
import { Badge, type BadgeProps } from './badge.js';

const STATUS: Record<AIExecutionStatus, { label: string; variant: BadgeProps['variant'] }> = {
  RUNNING: { label: 'Running', variant: 'primary' },
  COMPLETED: { label: 'Completed', variant: 'success' },
  FAILED: { label: 'Failed', variant: 'destructive' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
  WAITING_APPROVAL: { label: 'Waiting for approval', variant: 'warning' },
};

/**
 * The one way a run's status is shown — the AI Workspace's Runs list, an
 * agent's or workflow's run history and the overview all use it, so "waiting
 * for approval" reads the same everywhere.
 */
export function AIRunStatusBadge({
  status,
  className,
}: {
  status: AIExecutionStatus | string;
  className?: string;
}) {
  const known = STATUS[status as AIExecutionStatus];
  return (
    <Badge variant={known?.variant ?? 'neutral'} className={cn('text-[10px]', className)}>
      {known?.label ?? status}
    </Badge>
  );
}

const STEP_TYPE: Record<string, AIExecutionStepType> = {
  AGENT: 'generating',
  AI_COWORKER: 'generating',
  LLM: 'generating',
  AI_ACTION: 'generating',
  CLASSIFIER: 'planning',
  EXTRACT_DATA: 'planning',
  STRUCTURED_OUTPUT: 'planning',
  KNOWLEDGE_RETRIEVAL: 'search',
  FIRECRAWL_SEARCH: 'search',
  FIRECRAWL_SCRAPE: 'search',
  FIRECRAWL_CRAWL: 'search',
  FIRECRAWL_EXTRACT: 'search',
  HTTP_REQUEST: 'tool_call',
  API_CALL: 'tool_call',
  WEBHOOK: 'tool_call',
  TOOL: 'tool_call',
  MCP: 'tool_call',
  APP: 'tool_call',
  CODE: 'code',
  DATABASE: 'database',
  HUMAN_APPROVAL: 'approval',
  HUMAN_INPUT: 'approval',
  START: 'queued',
  TRIGGER: 'queued',
  OUTPUT: 'completed',
  END: 'completed',
};

/** Recorded run steps (`AIExecutionStep` rows) as the timeline renders them. */
export function toTimelineSteps(steps: readonly RecordedStep[] | undefined): AIExecutionStep[] {
  return (steps ?? []).map((step) => ({
    id: step.id,
    name: step.stepId,
    type: step.status === 'FAILED' ? 'failed' : (STEP_TYPE[step.nodeType] ?? 'tool_call'),
    status:
      step.status === 'SUCCESS'
        ? 'completed'
        : step.status === 'FAILED'
          ? 'failed'
          : step.status === 'SKIPPED'
            ? 'skipped'
            : 'pending',
    description: step.nodeType,
    durationMs: step.latencyMs,
    tokensUsed: step.tokensUsed,
    inputPayload: step.inputJson,
    outputPayload: step.outputJson,
    error: step.errorMessage ?? undefined,
  }));
}
