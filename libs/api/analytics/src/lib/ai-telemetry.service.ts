import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import type {
  AIErrorCategory,
  AIExecutionTrace,
  AnalyticsAlertEvent,
  AnalyticsAlertRule,
  ExecutionTraceSpan,
  ModelPricingConfig,
  ModelPricingItem,
  VersionComparisonResult,
} from '@org/types';

export const DEFAULT_MODEL_PRICING: ModelPricingItem[] = [
  { model: 'gpt-4o', provider: 'openai', inputPer1MTokens: 2.5, outputPer1MTokens: 10.0, cacheReadPer1MTokens: 1.25, effectiveDate: '2024-08-01' },
  { model: 'gpt-4o-mini', provider: 'openai', inputPer1MTokens: 0.15, outputPer1MTokens: 0.6, cacheReadPer1MTokens: 0.075, effectiveDate: '2024-07-18' },
  { model: 'o1', provider: 'openai', inputPer1MTokens: 15.0, outputPer1MTokens: 60.0, effectiveDate: '2024-12-05' },
  { model: 'o3-mini', provider: 'openai', inputPer1MTokens: 1.1, outputPer1MTokens: 4.4, effectiveDate: '2025-01-31' },
  { model: 'gpt-4-turbo', provider: 'openai', inputPer1MTokens: 10.0, outputPer1MTokens: 30.0, effectiveDate: '2024-04-09' },
  { model: 'claude-3-5-sonnet', provider: 'anthropic', inputPer1MTokens: 3.0, outputPer1MTokens: 15.0, cacheReadPer1MTokens: 0.3, effectiveDate: '2024-10-22' },
  { model: 'claude-3-opus', provider: 'anthropic', inputPer1MTokens: 15.0, outputPer1MTokens: 75.0, effectiveDate: '2024-03-04' },
  { model: 'claude-3-haiku', provider: 'anthropic', inputPer1MTokens: 0.25, outputPer1MTokens: 1.25, effectiveDate: '2024-03-07' },
  { model: 'gemini-1.5-pro', provider: 'google', inputPer1MTokens: 1.25, outputPer1MTokens: 5.0, effectiveDate: '2024-05-14' },
  { model: 'gemini-1.5-flash', provider: 'google', inputPer1MTokens: 0.075, outputPer1MTokens: 0.3, effectiveDate: '2024-05-14' },
  { model: 'gemini-2.0-flash', provider: 'google', inputPer1MTokens: 0.1, outputPer1MTokens: 0.4, effectiveDate: '2025-02-01' },
  { model: 'llama3', provider: 'ollama', inputPer1MTokens: 0.0, outputPer1MTokens: 0.0, effectiveDate: '2024-04-18' },
  { model: 'llama3.1', provider: 'ollama', inputPer1MTokens: 0.0, outputPer1MTokens: 0.0, effectiveDate: '2024-07-23' },
  { model: 'mistral', provider: 'ollama', inputPer1MTokens: 0.0, outputPer1MTokens: 0.0, effectiveDate: '2024-03-01' },
  { model: 'deepseek-r1', provider: 'ollama', inputPer1MTokens: 0.0, outputPer1MTokens: 0.0, effectiveDate: '2025-01-20' },
];

const DEFAULT_REDACT_KEYS = [
  'authorization',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'client_secret',
  'api_key',
  'apikey',
  'password',
  'cookie',
  'bearer',
  'credential',
  'private_key',
  'key',
];

@Injectable()
export class AITelemetryService {
  private pricingCatalog: ModelPricingItem[] = [...DEFAULT_MODEL_PRICING];
  private alertRules: Map<string, AnalyticsAlertRule[]> = new Map();
  private alertEvents: Map<string, AnalyticsAlertEvent[]> = new Map();

  // -------------------------------------------------------------------------
  // Model Pricing
  // -------------------------------------------------------------------------

  getModelPricingCatalog(): ModelPricingConfig {
    return {
      version: '2026.10',
      updatedAt: new Date().toISOString(),
      pricing: [...this.pricingCatalog],
    };
  }

  updateModelPricing(pricing: ModelPricingItem[]): ModelPricingConfig {
    this.pricingCatalog = [...pricing];
    return this.getModelPricingCatalog();
  }

  calculateCost(
    modelName: string | null | undefined,
    inputTokens: number,
    outputTokens: number,
    cachedTokens = 0,
  ): number {
    if (!modelName) {
      // Conservative default: $2 / 1M input, $8 / 1M output
      const cost = (inputTokens * 2.0 + outputTokens * 8.0) / 1_000_000;
      return Number(cost.toFixed(6));
    }

    const normalized = modelName.toLowerCase().trim();
    const item =
      this.pricingCatalog.find(
        (p) =>
          normalized.includes(p.model.toLowerCase()) ||
          p.model.toLowerCase().includes(normalized),
      ) ?? null;

    if (!item) {
      const cost = (inputTokens * 2.0 + outputTokens * 8.0) / 1_000_000;
      return Number(cost.toFixed(6));
    }

    const nonCachedInput = Math.max(0, inputTokens - cachedTokens);
    const inputCost = (nonCachedInput * item.inputPer1MTokens) / 1_000_000;
    const outputCost = (outputTokens * item.outputPer1MTokens) / 1_000_000;
    const cacheCost =
      (cachedTokens * (item.cacheReadPer1MTokens ?? item.inputPer1MTokens * 0.5)) /
      1_000_000;

    return Number((inputCost + outputCost + cacheCost).toFixed(6));
  }

  // -------------------------------------------------------------------------
  // Error Classification & Fingerprinting
  // -------------------------------------------------------------------------

  classifyError(
    errorMessage?: string | Error | any,
    statusCode?: number,
  ): {
    category: AIErrorCategory;
    severity: 'WARNING' | 'ERROR' | 'CRITICAL';
    possibleCause: string;
    recommendedAction: string;
    fingerprint: string;
  } {
    const msg =
      typeof errorMessage === 'string'
        ? errorMessage
        : errorMessage instanceof Error
        ? errorMessage.message
        : errorMessage?.message != null
        ? String(errorMessage.message)
        : String(errorMessage ?? 'Unknown error');
    const raw = (msg ?? 'Unknown error').trim();
    const lower = raw.toLowerCase();

    let category: AIErrorCategory = 'UNKNOWN';
    let severity: 'WARNING' | 'ERROR' | 'CRITICAL' = 'ERROR';
    let possibleCause = 'Unspecified runtime exception';
    let recommendedAction = 'Check workflow execution logs and step output';

    if (
      lower.includes('rate limit') ||
      lower.includes('429') ||
      lower.includes('quota exceeded') ||
      lower.includes('too many requests')
    ) {
      category = 'RATE_LIMIT';
      severity = 'WARNING';
      possibleCause = 'API provider request rate limit or token quota exceeded';
      recommendedAction = 'Configure backoff retry or upgrade provider tier limit';
    } else if (
      lower.includes('unauthorized') ||
      lower.includes('401') ||
      lower.includes('forbidden') ||
      lower.includes('403') ||
      lower.includes('invalid api key') ||
      lower.includes('auth') ||
      lower.includes('credential')
    ) {
      category = 'AUTHENTICATION_PERMISSION';
      severity = 'CRITICAL';
      possibleCause = 'Expired credentials, invalid API token, or missing workspace permissions';
      recommendedAction = 'Verify secret vault credentials and connector auth configurations';
    } else if (
      lower.includes('model') ||
      lower.includes('openai') ||
      lower.includes('anthropic') ||
      lower.includes('context length') ||
      lower.includes('maximum context') ||
      lower.includes('provider error') ||
      lower.includes('502') ||
      lower.includes('503')
    ) {
      category = 'MODEL_PROVIDER';
      severity = 'CRITICAL';
      possibleCause = 'Upstream foundation model outage, bad model name, or prompt exceeded context window';
      recommendedAction = 'Enable model failover router or truncate conversational history in system prompt';
    } else if (
      lower.includes('timeout') ||
      lower.includes('timed out') ||
      lower.includes('deadline exceeded') ||
      lower.includes('etimedout')
    ) {
      category = 'TIMEOUT';
      severity = 'ERROR';
      possibleCause = 'Node execution or HTTP connector call exceeded max execution duration limit';
      recommendedAction = 'Increase node timeout setting or optimize upstream query response latency';
    } else if (
      lower.includes('slack') ||
      lower.includes('github') ||
      lower.includes('jira') ||
      lower.includes('notion') ||
      lower.includes('connector') ||
      lower.includes('webhook')
    ) {
      category = 'CONNECTOR';
      severity = 'ERROR';
      possibleCause = 'Third-party integration connector returned an error code or invalid response body';
      recommendedAction = 'Check third-party service status page and verify connector payload schema';
    } else if (
      lower.includes('tool') ||
      lower.includes('sandbox') ||
      lower.includes('script failed') ||
      lower.includes('code execution')
    ) {
      category = 'TOOL_EXECUTION';
      severity = 'ERROR';
      possibleCause = 'Tool invocation handler threw an unhandled runtime error inside sandboxed runner';
      recommendedAction = 'Review tool arguments passed by LLM and test tool function locally';
    } else if (
      lower.includes('schema') ||
      lower.includes('invalid json') ||
      lower.includes('validation') ||
      lower.includes('zod') ||
      lower.includes('required property')
    ) {
      category = 'VALIDATION';
      severity = 'WARNING';
      possibleCause = 'Model generated output that does not match the configured JSON Schema';
      recommendedAction = 'Add explicit structured output schema or few-shot examples to prompt';
    } else if (
      lower.includes('cycle') ||
      lower.includes('disconnected') ||
      lower.includes('invalid configuration') ||
      lower.includes('orphan')
    ) {
      category = 'INVALID_WORKFLOW_CONFIG';
      severity = 'WARNING';
      possibleCause = 'Workflow graph validation detected missing edge or unmapped required variable';
      recommendedAction = 'Open workflow builder and inspect node connection warnings in Canvas';
    } else if (
      lower.includes('vector') ||
      lower.includes('qdrant') ||
      lower.includes('embedding') ||
      lower.includes('retrieval') ||
      lower.includes('rag')
    ) {
      category = 'MEMORY_RETRIEVAL';
      severity = 'ERROR';
      possibleCause = 'Vector database connection timeout or document embedding collection unavailable';
      recommendedAction = 'Check knowledge base synchronization status and vector database health';
    } else if (
      lower.includes('parse') ||
      lower.includes('unexpected token') ||
      lower.includes('malformed')
    ) {
      category = 'OUTPUT_PARSING';
      severity = 'WARNING';
      possibleCause = 'Failed to extract JSON object or code block from model text response';
      recommendedAction = 'Instruct model to output raw JSON without markdown markdown fences';
    } else if (
      lower.includes('budget') ||
      lower.includes('credit') ||
      lower.includes('balance')
    ) {
      category = 'BUDGET_QUOTA';
      severity = 'CRITICAL';
      possibleCause = 'Workspace AI credit allocation has reached zero or monthly budget cap exceeded';
      recommendedAction = 'Top up workspace credits or increase budget cap threshold in Settings';
    } else if (lower.includes('cancel') || lower.includes('abort')) {
      category = 'CANCELLATION';
      severity = 'WARNING';
      possibleCause = 'Execution cancelled or aborted by user';
      recommendedAction = 'None required';
    }

    if (statusCode && statusCode >= 500) {
      severity = 'CRITICAL';
    }

    // Normalised fingerprint hashing
    const normalized = raw
      .replace(/[0-9a-f]{8,}/gi, '<id>')
      .replace(/\d+/g, '<n>')
      .replace(/"[^"]*"/g, '<str>')
      .slice(0, 160);

    const fingerprint = createHash('sha1')
      .update(`${category}|${normalized}`)
      .digest('hex')
      .slice(0, 16);

    return {
      category,
      severity,
      possibleCause,
      recommendedAction,
      fingerprint,
    };
  }

  // -------------------------------------------------------------------------
  // Redaction
  // -------------------------------------------------------------------------

  redactPayload<T>(
    data: T,
    customKeys: string[] = [],
    depth = 0,
  ): T {
    if (depth > 6 || data == null) return data;
    if (typeof data !== 'object') return data;

    const keysToScrub = new Set([
      ...DEFAULT_REDACT_KEYS,
      ...customKeys.map((k) => k.toLowerCase()),
    ]);

    if (Array.isArray(data)) {
      return data.map((item) =>
        this.redactPayload(item, customKeys, depth + 1),
      ) as unknown as T;
    }

    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(data as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      let matched = false;
      for (const pattern of keysToScrub) {
        if (lowerKey === pattern || lowerKey.includes(pattern)) {
          matched = true;
          break;
        }
      }

      if (matched && typeof val === 'string') {
        out[key] = '[REDACTED]';
      } else if (matched && typeof val === 'object' && val !== null) {
        out[key] = '[REDACTED_OBJECT]';
      } else if (typeof val === 'object' && val !== null) {
        out[key] = this.redactPayload(val, customKeys, depth + 1);
      } else {
        out[key] = val;
      }
    }
    return out as T;
  }

  redactSensitiveData<T>(payload: T, customKeys?: string[]): T {
    return this.redactPayload(payload, customKeys);
  }

  // -------------------------------------------------------------------------
  // Distributed Traces & Timeline
  // -------------------------------------------------------------------------

  buildTraceHierarchy(
    execution: any,
    steps?: Array<any>,
  ): AIExecutionTrace {
    const traceId = `tr_${execution.id}`;
    const stepList: Array<any> = steps ?? execution.steps ?? [];
    const execLatency = execution.durationMs || execution.latencyMs || 0;
    const startTimeStr = new Date(execution.startedAt).toISOString();
    const endTimeStr = execution.finishedAt || execution.completedAt
      ? new Date(execution.finishedAt || execution.completedAt).toISOString()
      : new Date(new Date(execution.startedAt).getTime() + (execLatency || 1000)).toISOString();

    const rootSpan: ExecutionTraceSpan = {
      spanId: `sp_root_${execution.id}`,
      parentSpanId: null,
      traceId,
      executionId: execution.id,
      name: `${execution.entityType || 'AGENT'} Execution · ${(execution.entityId || execution.id || '').slice(0, 8)}`,
      operationType: 'TRIGGER',
      startTime: startTimeStr,
      endTime: endTimeStr,
      durationMs: execLatency,
      status: (execution.status === 'SUCCESS' || execution.status === 'COMPLETED'
        ? 'SUCCESS'
        : execution.status === 'FAILED'
        ? 'FAILED'
        : execution.status === 'RUNNING'
        ? 'RUNNING'
        : 'WAITING') as any,
      model: execution.model ?? undefined,
      totalTokens: execution.tokensUsed,
      costUsd: execution.totalCost || execution.cost,
      errorMessage: execution.errorsJson?.message ?? null,
      children: [],
    };

    let cumulativeOffsetMs = 0;
    const childSpans: ExecutionTraceSpan[] = [];

    // Map each step to a trace span
    for (const step of stepList) {
      const stepLatency = Math.max(step.durationMs || step.latencyMs || 0, 10);
      const stepStart = new Date(step.startedAt || new Date(execution.startedAt).getTime() + cumulativeOffsetMs);
      const stepEnd = step.finishedAt || step.completedAt
        ? new Date(step.finishedAt || step.completedAt)
        : new Date(stepStart.getTime() + stepLatency);
      cumulativeOffsetMs += stepLatency;

      let opType: ExecutionTraceSpan['operationType'] = 'NODE_TRANSITION';
      const upperType = (step.nodeType || step.stepType || '').toUpperCase();
      if (upperType.includes('AGENT') || upperType.includes('MODEL') || upperType.includes('LLM')) {
        opType = 'MODEL_REQUEST';
      } else if (upperType.includes('TOOL')) {
        opType = 'TOOL_INVOCATION';
      } else if (upperType.includes('CONNECTOR')) {
        opType = 'CONNECTOR_REQUEST';
      } else if (upperType.includes('CONDITION') || upperType.includes('ROUTER')) {
        opType = 'CONDITION_BRANCH';
      } else if (upperType.includes('MEMORY') || upperType.includes('KNOWLEDGE')) {
        opType = 'MEMORY_SEARCH';
      } else if (upperType.includes('APPROVAL')) {
        opType = 'HUMAN_APPROVAL';
      } else if (upperType.includes('OUTPUT')) {
        opType = 'OUTPUT_DELIVERY';
      }

      const classified = step.errorMessage
        ? this.classifyError(step.errorMessage)
        : null;

      const stepSpanId = step.spanId || (step.id ? (String(step.id).startsWith('sp_') ? step.id : `sp_${step.id}`) : `sp_${Math.random()}`);

      const stepSpan: ExecutionTraceSpan = {
        spanId: stepSpanId,
        parentSpanId: rootSpan.spanId,
        traceId,
        executionId: execution.id,
        name: step.name || `${step.nodeType || step.stepType || 'STEP'} · [${step.stepId || step.id}]`,
        operationType: opType,
        startTime: stepStart.toISOString(),
        endTime: stepEnd.toISOString(),
        durationMs: stepLatency,
        status: (step.status === 'SUCCESS' || step.status === 'COMPLETED'
          ? 'SUCCESS'
          : step.status === 'FAILED'
          ? 'FAILED'
          : 'RUNNING') as any,
        nodeId: step.stepId || step.id,
        nodeType: step.nodeType || step.stepType,
        totalTokens: step.tokensUsed || step.tokens || 0,
        costUsd: step.cost || step.costUsd || this.calculateCost(execution.model, Math.round((step.tokensUsed || 0) * 0.4), Math.round((step.tokensUsed || 0) * 0.6)),
        errorMessage: step.errorMessage ?? null,
        errorCategory: classified?.category ?? null,
        inputRedacted: this.redactPayload(step.inputJson ?? step.input ?? {}),
        outputRedacted: this.redactPayload(step.outputJson ?? step.output ?? {}),
        children: [],
      };

      // Check tool calls recorded inside step or execution
      if (Array.isArray(execution.toolCalls) && execution.toolCalls.length > 0) {
        const matchingTools = execution.toolCalls.filter(
          (tc: any) => tc.stepId === step.stepId || !tc.stepId,
        );
        for (let i = 0; i < matchingTools.length; i++) {
          const tc = matchingTools[i];
          const toolLatency = Number(tc.latencyMs || 40);
          stepSpan.children.push({
            spanId: `sp_tool_${step.id}_${i}`,
            parentSpanId: stepSpan.spanId,
            traceId,
            executionId: execution.id,
            name: `Tool Call: ${tc.name || 'unknown_tool'}`,
            operationType: 'TOOL_INVOCATION',
            startTime: stepStart.toISOString(),
            endTime: new Date(stepStart.getTime() + toolLatency).toISOString(),
            durationMs: toolLatency,
            status: tc.status === 'FAILED' ? 'FAILED' : 'SUCCESS',
            toolName: tc.name,
            totalTokens: Number(tc.tokens || 0),
            errorMessage: tc.error ?? null,
            children: [],
          });
        }
      }

      childSpans.push(stepSpan);
    }

    rootSpan.children = childSpans;

    // Detect execution bottlenecks
    const allSpans: ExecutionTraceSpan[] = [rootSpan, ...childSpans];
    const totalDuration = Math.max(execLatency, 1);
    const bottlenecks = allSpans
      .filter((s) => s.spanId !== rootSpan.spanId && s.durationMs > 0)
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 5)
      .map((s) => ({
        spanId: s.spanId,
        name: s.name,
        durationMs: s.durationMs,
        percentageOfTotal: Math.min(100, Math.round((s.durationMs / totalDuration) * 100)),
      }));

    return {
      executionId: execution.id,
      traceId,
      rootSpan,
      totalDurationMs: execLatency,
      totalTokens: execution.tokensUsed,
      totalCostUsd: execution.totalCost || execution.cost || 0,
      status: execution.status,
      spanCount: 1 + childSpans.length,
      bottlenecks,
      spans: allSpans,
      bottleneckSpanId: bottlenecks[0]?.spanId ?? null,
      durationMs: execLatency,
    };
  }

  // -------------------------------------------------------------------------
  // Math & Percentiles
  // -------------------------------------------------------------------------

  calculatePercentiles(durations: number[]): {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    avg: number;
    median: number;
  } {
    if (durations.length === 0) {
      return { p50: 0, p90: 0, p95: 0, p99: 0, avg: 0, median: 0 };
    }

    const sorted = [...durations].sort((a, b) => a - b);
    const avg = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);

    const pick = (pct: number) => {
      const idx = Math.min(
        sorted.length - 1,
        Math.max(0, Math.floor((pct / 100) * (sorted.length - 1))),
      );
      return sorted[idx];
    };

    return {
      p50: pick(50),
      p90: pick(90),
      p95: pick(95),
      p99: pick(99),
      avg,
      median: pick(50),
    };
  }

  // -------------------------------------------------------------------------
  // Alerts & Anomalies
  // -------------------------------------------------------------------------

  getAlertRules(workspaceId: string): AnalyticsAlertRule[] {
    if (!this.alertRules.has(workspaceId)) {
      // Default baseline rules
      this.alertRules.set(workspaceId, [
        {
          id: `rule_fail_${workspaceId}`,
          name: 'High Workflow Failure Rate',
          metric: 'FAILURE_RATE',
          condition: 'GREATER_THAN',
          threshold: 10,
          windowMinutes: 15,
          severity: 'CRITICAL',
          status: 'ACTIVE',
          cooldownMinutes: 60,
          lastTriggeredAt: null,
          notifyChannels: ['in_app'],
          createdAt: new Date().toISOString(),
        },
        {
          id: `rule_lat_${workspaceId}`,
          name: 'P95 Latency Spike (> 5s)',
          metric: 'LATENCY_SPIKE',
          condition: 'GREATER_THAN',
          threshold: 5000,
          windowMinutes: 30,
          severity: 'WARNING',
          status: 'ACTIVE',
          cooldownMinutes: 120,
          lastTriggeredAt: null,
          notifyChannels: ['in_app'],
          createdAt: new Date().toISOString(),
        },
        {
          id: `rule_budget_${workspaceId}`,
          name: 'Monthly Budget 80% Utilization',
          metric: 'BUDGET_THRESHOLD',
          condition: 'GREATER_THAN',
          threshold: 80,
          windowMinutes: 60,
          severity: 'WARNING',
          status: 'ACTIVE',
          cooldownMinutes: 1440,
          lastTriggeredAt: null,
          notifyChannels: ['in_app'],
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    return this.alertRules.get(workspaceId) ?? [];
  }

  createAlertRule(workspaceId: string, rule: Partial<AnalyticsAlertRule>): AnalyticsAlertRule {
    const rules = this.getAlertRules(workspaceId);
    const newRule: AnalyticsAlertRule = {
      id: `rule_${randomUUID().slice(0, 8)}`,
      name: rule.name || 'Custom Metric Alert',
      metric: rule.metric || 'FAILURE_RATE',
      condition: rule.condition || 'GREATER_THAN',
      threshold: rule.threshold ?? 5,
      windowMinutes: rule.windowMinutes ?? 15,
      severity: rule.severity || 'WARNING',
      status: 'ACTIVE',
      cooldownMinutes: rule.cooldownMinutes ?? 60,
      lastTriggeredAt: null,
      notifyChannels: rule.notifyChannels ?? ['in_app'],
      createdAt: new Date().toISOString(),
    };
    rules.push(newRule);
    this.alertRules.set(workspaceId, rules);
    return newRule;
  }

  evaluateAlerts(
    workspaceId: string,
    currentMetrics: {
      failureRate: number;
      p95LatencyMs: number;
      budgetUtilizationPct: number;
      timeoutCount: number;
    },
  ): AnalyticsAlertEvent[] {
    const rules = this.getAlertRules(workspaceId);
    const events: AnalyticsAlertEvent[] = this.alertEvents.get(workspaceId) ?? [];

    for (const rule of rules) {
      if (rule.status === 'DISABLED') continue;

      let value = 0;
      if (rule.metric === 'FAILURE_RATE') value = currentMetrics.failureRate;
      else if (rule.metric === 'LATENCY_SPIKE') value = currentMetrics.p95LatencyMs;
      else if (rule.metric === 'BUDGET_THRESHOLD') value = currentMetrics.budgetUtilizationPct;
      else if (rule.metric === 'NODE_TIMEOUT') value = currentMetrics.timeoutCount;

      const triggered =
        rule.condition === 'GREATER_THAN'
          ? value > rule.threshold
          : value < rule.threshold;

      if (triggered) {
        rule.status = 'FIRING';
        rule.lastTriggeredAt = new Date().toISOString();

        // Prevent duplicate spam
        const existingFiring = events.find(
          (e) => e.ruleId === rule.id && e.status === 'FIRING',
        );
        if (!existingFiring) {
          events.unshift({
            id: `ev_${randomUUID().slice(0, 8)}`,
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            triggeredValue: value,
            threshold: rule.threshold,
            message: `${rule.name}: Observed ${value.toFixed(1)} breached threshold of ${rule.threshold}`,
            status: 'FIRING',
            triggeredAt: new Date().toISOString(),
          });
        }
      } else if (rule.status === 'FIRING') {
        rule.status = 'RESOLVED';
        const firing = events.find((e) => e.ruleId === rule.id && e.status === 'FIRING');
        if (firing) {
          firing.status = 'RESOLVED';
          firing.resolvedAt = new Date().toISOString();
        }
      }
    }

    this.alertEvents.set(workspaceId, events.slice(0, 50));
    return events;
  }

  updateAlertStatus(
    workspaceId: string,
    eventId: string,
    status: 'RESOLVED' | 'ACKNOWLEDGED',
  ) {
    const events = this.alertEvents.get(workspaceId) ?? [];
    const ev = events.find((e) => e.id === eventId);
    if (ev) {
      ev.status = status;
      if (status === 'RESOLVED') ev.resolvedAt = new Date().toISOString();
    }
    return ev;
  }

  // -------------------------------------------------------------------------
  // Version Comparison
  // -------------------------------------------------------------------------

  compareVersions(
    entityType: 'AGENT' | 'WORKFLOW',
    entityId: string,
    entityName: string,
    runsA: Array<{ latencyMs: number; status: string; tokensUsed: number; totalCost: number }>,
    runsB: Array<{ latencyMs: number; status: string; tokensUsed: number; totalCost: number }>,
    versionA = 1,
    versionB = 2,
  ): VersionComparisonResult {
    const summarize = (runs: typeof runsA, ver: number) => {
      const count = runs.length;
      if (count === 0) {
        return {
          version: ver,
          runCount: 0,
          successRate: 0,
          avgLatencyMs: 0,
          p95LatencyMs: 0,
          avgTokens: 0,
          avgCostUsd: 0,
          errorRate: 0,
        };
      }
      const successes = runs.filter((r) => r.status === 'SUCCESS' || r.status === 'COMPLETED').length;
      const latencies = runs.map((r) => r.latencyMs);
      const p = this.calculatePercentiles(latencies);
      const totalTok = runs.reduce((s, r) => s + (r.tokensUsed || 0), 0);
      const totalCost = runs.reduce((s, r) => s + (r.totalCost || 0), 0);
      const successRate = Number(((successes / count) * 100).toFixed(1));
      return {
        version: ver,
        runCount: count,
        successRate,
        avgLatencyMs: p.avg,
        p95LatencyMs: p.p95,
        avgTokens: Math.round(totalTok / count),
        avgCostUsd: Number((totalCost / count).toFixed(5)),
        errorRate: Number((100 - successRate).toFixed(1)),
      };
    };

    const vA = summarize(runsA, versionA);
    const vB = summarize(runsB, versionB);

    const successRateDelta = Number((vB.successRate - vA.successRate).toFixed(1));
    const latencyDeltaPct = vA.p95LatencyMs > 0
      ? Number((((vB.p95LatencyMs - vA.p95LatencyMs) / vA.p95LatencyMs) * 100).toFixed(1))
      : 0;
    const costDeltaPct = vA.avgCostUsd > 0
      ? Number((((vB.avgCostUsd - vA.avgCostUsd) / vA.avgCostUsd) * 100).toFixed(1))
      : 0;
    const tokensDeltaPct = vA.avgTokens > 0
      ? Number((((vB.avgTokens - vA.avgTokens) / vA.avgTokens) * 100).toFixed(1))
      : 0;

    const regressions: VersionComparisonResult['regressions'] = [];
    if (successRateDelta < -5) {
      regressions.push({
        metric: 'Success Rate',
        severity: 'high',
        description: `Success rate dropped by ${Math.abs(successRateDelta)}% in version ${versionB}`,
      });
    }
    if (latencyDeltaPct > 20) {
      regressions.push({
        metric: 'P95 Latency',
        severity: latencyDeltaPct > 50 ? 'high' : 'medium',
        description: `P95 execution latency increased by ${latencyDeltaPct}% in version ${versionB}`,
      });
    }
    if (costDeltaPct > 25) {
      regressions.push({
        metric: 'Average Cost',
        severity: 'medium',
        description: `Average execution cost increased by ${costDeltaPct}% in version ${versionB}`,
      });
    }

    const sampleSizeWarning = vA.runCount < 5 || vB.runCount < 5 || Math.abs(vA.runCount - vB.runCount) > 20;

    return {
      entityType,
      entityId,
      entityName,
      versionA: vA,
      versionB: vB,
      diff: {
        successRateDelta,
        latencyDeltaPct,
        costDeltaPct,
        tokensDeltaPct,
      },
      regressions,
      sampleSizeWarning,
    };
  }
}
