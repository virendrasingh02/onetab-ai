import type { DeepAIAnalyticsOverview } from '@org/types';

/** What the runtime measured for one run (`AIExecution.stateJson.metrics`). */
interface StoredMetrics {
  inputTokens?: number;
  outputTokens?: number;
  modelMs?: number;
  toolMs?: number;
}

export interface RunRow {
  startedAt: Date;
  status: string;
  latencyMs: number;
  tokensUsed: number;
  stateJson?: unknown;
  toolCalls?: unknown;
  steps?: Array<{
    stepId: string;
    nodeType: string;
    latencyMs: number;
    startedAt?: Date;
  }>;
}

export interface RunMeasures {
  inputTokens: number;
  outputTokens: number;
  /** True when the input/output split was measured rather than assumed. */
  splitMeasured: boolean;
  modelMs: number | null;
  toolMs: number | null;
  queueMs: number | null;
}

/** Workflow node types that call a model / reach out to a tool or connector. */
const MODEL_NODE = /(LLM|AI_|MODEL|PROMPT|CHAT|GENERATE|CLASSIFY|SUMMAR|EXTRACT)/i;
const TOOL_NODE = /(TOOL|CONNECTOR|HTTP|WEBHOOK|ACTION|API|INTEGRATION|SEARCH)/i;

/** Used only for runs recorded before the runtime measured the split. */
const FALLBACK_INPUT_SHARE = 0.4;

export interface ToolCallRead {
  name: string;
  failed: boolean;
  durationMs: number | null;
}

/** Agent runs store `AgentToolExecution` rows: lowercase status, `durationMs`. */
export function readToolCall(raw: unknown): ToolCallRead {
  const tc = (raw ?? {}) as Record<string, unknown>;
  const status = String(tc['status'] ?? '').toLowerCase();
  const duration = Number(tc['durationMs'] ?? tc['latencyMs']);
  return {
    name: typeof tc['name'] === 'string' && tc['name'] ? (tc['name'] as string) : 'tool',
    failed: status === 'failed' || status === 'error',
    durationMs: Number.isFinite(duration) && duration >= 0 ? duration : null,
  };
}

export function deriveRunMeasures(run: RunRow): RunMeasures {
  const state = (run.stateJson ?? {}) as Record<string, unknown>;
  const stored = (state['metrics'] ?? null) as StoredMetrics | null;

  const measuredIn = Number(stored?.inputTokens ?? 0);
  const measuredOut = Number(stored?.outputTokens ?? 0);
  const splitMeasured = measuredIn + measuredOut > 0;
  const inputTokens = splitMeasured ? measuredIn : Math.round(run.tokensUsed * FALLBACK_INPUT_SHARE);
  const outputTokens = splitMeasured ? measuredOut : run.tokensUsed - inputTokens;

  // The agent runtime appends one whole-run `turn` step on completion; it is
  // not a node, so it neither counts as model time nor marks the queue wait.
  const nodes = (run.steps ?? []).filter((s) => s.stepId !== 'turn');

  const stepMs = (pattern: RegExp) => {
    const matched = nodes.filter((s) => pattern.test(s.nodeType));
    return matched.length > 0 ? matched.reduce((sum, s) => sum + (s.latencyMs || 0), 0) : null;
  };

  const calls = Array.isArray(run.toolCalls) ? run.toolCalls.map(readToolCall) : [];
  const timedCalls = calls.filter((c) => c.durationMs !== null);
  const toolMs =
    stored && typeof stored.toolMs === 'number'
      ? stored.toolMs
      : timedCalls.length > 0
        ? timedCalls.reduce((sum, c) => sum + (c.durationMs ?? 0), 0)
        : stepMs(TOOL_NODE);

  const modelMs = stored && typeof stored.modelMs === 'number' ? stored.modelMs : stepMs(MODEL_NODE);

  let queueMs: number | null = null;
  const firstStart = nodes
    .map((s) => s.startedAt?.getTime())
    .filter((t): t is number => typeof t === 'number')
    .sort((a, b) => a - b)[0];
  if (firstStart !== undefined) queueMs = Math.max(0, firstStart - run.startedAt.getTime());

  return { inputTokens, outputTokens, splitMeasured, modelMs, toolMs, queueMs };
}

/** Mean over the runs that actually have the measure; 0 when none do. */
export function meanOf(values: Array<number | null>): number {
  const present = values.filter((v): v is number => v !== null);
  return present.length > 0 ? Math.round(present.reduce((a, b) => a + b, 0) / present.length) : 0;
}

export function pctChange(current: number, previous: number): number | null {
  return previous > 0 ? Number((((current - previous) / previous) * 100).toFixed(1)) : null;
}

const LATENCY_BANDS: Array<{ label: string; max: number }> = [
  { label: '< 1s', max: 1_000 },
  { label: '1–5s', max: 5_000 },
  { label: '5–15s', max: 15_000 },
  { label: '15–30s', max: 30_000 },
  { label: '30–60s', max: 60_000 },
  { label: '> 60s', max: Number.POSITIVE_INFINITY },
];

export function latencyBuckets(durations: number[]): Array<{ label: string; count: number }> {
  const counts = LATENCY_BANDS.map(() => 0);
  for (const d of durations) {
    const idx = LATENCY_BANDS.findIndex((band) => d < band.max);
    counts[idx] += 1;
  }
  return LATENCY_BANDS.map((band, i) => ({ label: band.label, count: counts[i] }));
}

type Insight = DeepAIAnalyticsOverview['insights'][number];

/** Turns the finished overview numbers into the findings worth a person's attention. */
export function buildInsights(
  o: Pick<
    DeepAIAnalyticsOverview,
    'execution' | 'performance' | 'cost' | 'reliability' | 'breakdown' | 'quality' | 'deltas' | 'tokens'
  >,
  unrecordedModelRuns: number,
): Insight[] {
  const out: Insight[] = [];
  const { execution: e, performance: p, cost: c, reliability: r, breakdown: b, quality: q, deltas: d } = o;

  if (e.totalRuns === 0) {
    out.push({
      id: 'no-runs',
      severity: 'info',
      title: 'No runs in this window',
      detail: 'Nothing executed in the selected range. Widen the range or run an agent or workflow.',
    });
    return out;
  }

  if (e.failureRate >= 20) {
    out.push({
      id: 'failure-rate',
      severity: 'critical',
      title: `${e.failureRate}% of runs failed`,
      detail: `${e.failedRuns} of ${e.totalRuns} runs ended in failure. Group them by cause to find the common one.`,
      tab: 'errors',
    });
  } else if (e.failureRate >= 5) {
    out.push({
      id: 'failure-rate',
      severity: 'warning',
      title: `Failure rate is ${e.failureRate}%`,
      detail: `${e.failedRuns} runs failed. Review the error groups for repeating signatures.`,
      tab: 'errors',
    });
  }

  const worstEntity = [...b.byEntityType]
    .filter((t) => t.failed > 0)
    .sort((x, y) => y.failed - x.failed)[0];
  if (worstEntity && e.failedRuns > 0 && worstEntity.failed / e.failedRuns >= 0.6 && e.failedRuns >= 3) {
    out.push({
      id: 'failure-concentration',
      severity: 'warning',
      title: `Most failures come from ${worstEntity.entityType.toLowerCase()} runs`,
      detail: `${worstEntity.failed} of ${e.failedRuns} failures are ${worstEntity.entityType.toLowerCase()} runs.`,
      tab: worstEntity.entityType === 'WORKFLOW' ? 'workflows' : 'agents',
    });
  }

  if (p.p95LatencyMs >= 10_000 && p.p95LatencyMs >= p.medianLatencyMs * 3) {
    out.push({
      id: 'latency-tail',
      severity: 'warning',
      title: 'A slow tail is dragging latency',
      detail: `p95 is ${Math.round(p.p95LatencyMs / 1000)}s against a ${(p.medianLatencyMs / 1000).toFixed(1)}s median. The slowest runs are listed below.`,
      tab: 'executions',
    });
  }

  if (d.costPct !== null && d.costPct >= 50 && c.totalCostUsd >= 0.5) {
    out.push({
      id: 'cost-growth',
      severity: 'warning',
      title: `Spend is up ${d.costPct}% on the previous window`,
      detail: `${c.totalCostUsd.toFixed(2)} USD now, projected ${c.projectedSpendUsd.toFixed(2)} USD over 30 days.`,
      tab: 'cost',
    });
  }

  if (c.budgetUtilizationPct >= 80) {
    out.push({
      id: 'budget',
      severity: c.budgetUtilizationPct >= 100 ? 'critical' : 'warning',
      title: `${c.budgetUtilizationPct.toFixed(0)}% of the monthly budget used`,
      detail: `Cap is ${c.budgetCapUsd.toFixed(0)} USD. Adjust it in Settings if that is wrong.`,
      tab: 'settings',
    });
  }

  if (unrecordedModelRuns > 0) {
    out.push({
      id: 'unrecorded-model',
      severity: 'info',
      title: `${unrecordedModelRuns} run${unrecordedModelRuns === 1 ? '' : 's'} have no model recorded`,
      detail: 'Their cost uses default rates, so spend for those runs is an estimate.',
      tab: 'models',
    });
  }

  if (r.timeoutFailures > 0) {
    out.push({
      id: 'timeouts',
      severity: 'warning',
      title: `${r.timeoutFailures} run${r.timeoutFailures === 1 ? '' : 's'} timed out`,
      detail: 'Look at the slowest nodes and tools, or raise the step timeout.',
      tab: 'nodes',
    });
  }

  if (q.approvalsPending > 0) {
    out.push({
      id: 'approvals',
      severity: 'info',
      title: `${q.approvalsPending} approval${q.approvalsPending === 1 ? '' : 's'} waiting`,
      detail: 'Runs that need a person to decide are paused until someone responds.',
    });
  }

  if (q.avgRating !== null && q.feedbackCount >= 3 && q.avgRating < 3) {
    out.push({
      id: 'quality',
      severity: 'warning',
      title: `Average rating is ${q.avgRating.toFixed(1)} / 5`,
      detail: `${q.lowRatedCount} of ${q.feedbackCount} ratings were low. Read the comments for what went wrong.`,
      tab: 'evaluations',
    });
  }

  return out;
}
