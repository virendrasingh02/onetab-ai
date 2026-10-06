import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@org/database';
import {
  AppEvent,
  runInAgentScope,
  safeFetch,
  type AiApprovalRequestedEvent,
  type AiRunFinishedEvent,
} from '@org/api-common';
import {
  AICredentialService,
  AIInfrastructureService,
  KnowledgeService,
  MCPService,
  ModelResolverService,
  ProviderRegistryService,
} from '@org/api-ai';
import { AIRuntimeService, MCPToolRegistryService, newAgentTeamRun, type AgentTeamRun } from '@org/api-agents';
import { IntegrationsService } from '@org/api-integrations';
import { RealtimeGatewayService } from '@org/api-realtime';
import {
  DEFAULT_AGENT_RUN_LIMITS,
  LAST_OUTPUT_KEY,
  LOOP_EACH_HANDLE,
  MAX_LOOP_ITERATIONS,
  PLANS_CONFIG,
  normalizePlanTier,
  type AgentProfile,
  type AgentRunLimits,
  type AgentScope,
  type AIChatMessage,
  type InlineAgentSpec,
} from '@org/types';
import {
  conditionSpecFrom,
  evaluateCondition,
  normalizeWorkflowNodes,
  readPath,
  type WorkflowNode,
} from './workflow-graph.js';
import { chatWithFailover, modelLabel } from './model-failover.js';
import {
  backoffMs,
  classifyStepError,
  isReadScope,
  missingPermissionMessage,
  nowContext,
  paramsContext,
  readAgentProfile,
  scopeForNode,
} from './run-support.js';

export interface WorkflowStepResult {
  stepId: string;
  type: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'WAITING';
  output: unknown;
  /** Which outgoing branch to follow — set by CONDITION, SWITCH, etc. */
  branch?: string;
  attempts?: number;
}

/** A node the builder switched off: it passes through without running. */
export function isNodeDisabled(node: WorkflowNode): boolean {
  return node.data?.['disabled'] === true || node.config?.['disabled'] === true;
}

interface WorkflowEdge {
  id?: string;
  source: string;
  target: string;
  /** `true` / `false` for CONDITION; branch key for SWITCH; `error` for a fallback; absent otherwise. */
  sourceHandle?: string | null;
}

const MAX_NODE_VISITS = 50;
/**
 * Runs execute inside the request that started them, so a Delay step can only
 * wait briefly. Longer waits fail visibly instead of being silently shortened
 * (a "wait 5 minutes" step used to wait 0.1 s).
 */
const MAX_INLINE_DELAY_MS = 15_000;
/** Context key carrying the legacy `WorkflowExecution` id across a pause. */
const RUN_ID_KEY = '__workflowRunId';
/** Context key marking a test run, where nothing is changed. */
const MODE_KEY = '__mode';
const DEFAULT_STEP_TIMEOUT_MS = 20_000;
/** Model calls get longer: a report over a day of data takes a while to write. */
const DEFAULT_MODEL_STEP_TIMEOUT_MS = 90_000;
const MAX_API_RESPONSE_CHARS = 10_000;
/** Keys the engine adds to a run's context — never part of the caller's input. */
export const ENGINE_CONTEXT_KEYS = [
  'workspaceId',
  'workflowId',
  'executionId',
  RUN_ID_KEY,
  MODE_KEY,
  'now',
  'params',
  'run',
  'agent',
  '__review',
  '__resume',
  '__startedBy',
  '__depth',
  LAST_OUTPUT_KEY,
  '__pending',
];
/** Independent steps that may run at the same moment in one run. */
const MAX_PARALLEL_STEPS = 4;
/** Steps that wait for a person run on their own, after everything else ready. */
const HUMAN_STEP_TYPES = new Set(['HUMAN_APPROVAL', 'HUMAN_INPUT']);
/** Steps whose output is routing or bookkeeping, not something the next step should work on. */
const CONTROL_STEP_TYPES = new Set([
  'START',
  'TRIGGER',
  'USER_INPUT',
  'CONDITION',
  'SWITCH',
  'PARALLEL',
  'DELAY',
  'VARIABLE',
  'HUMAN_APPROVAL',
  'HUMAN_INPUT',
  'UNSUPPORTED',
  'CODE',
  'DATABASE',
]);

/**
 * The text a step produced, for the next step to work on by default
 * (`{{__last}}`): the model's answer, the agent's reply, the tool's result…
 */
export function lastOutputText(output: unknown): string | undefined {
  if (output === null || output === undefined) return undefined;
  if (typeof output === 'string') return output;
  if (typeof output !== 'object') return String(output);
  const o = output as Record<string, unknown>;
  for (const key of ['aiOutput', 'entityResponse', 'output', 'result', 'merged', 'toolResult', 'extracted', 'searchResult', 'scrapeResult', 'crawlResult', 'extractedResult', 'retrievedDocuments', 'loopResults', 'body', 'classification']) {
    const value = o[key];
    if (value === undefined || value === null || value === '') continue;
    return typeof value === 'string' ? value : JSON.stringify(value, null, 2).slice(0, 20_000);
  }
  return undefined;
}

/** What a run's input says, as the first step's default input. */
function inputText(payload: Record<string, unknown>): string {
  for (const key of ['message', 'input', 'prompt', 'query', 'text']) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  const visible = Object.fromEntries(Object.entries(payload).filter(([k]) => !k.startsWith('__')));
  return Object.keys(visible).length ? JSON.stringify(visible, null, 2) : '';
}

/** Every step that can lead into `nodeId`. */
function ancestorsOf(nodeId: string, edges: WorkflowEdge[]): Set<string> {
  const seen = new Set<string>();
  const stack = [nodeId];
  while (stack.length) {
    const id = stack.pop() as string;
    for (const e of edges) {
      if (e.target === id && !seen.has(e.source)) {
        seen.add(e.source);
        stack.push(e.source);
      }
    }
  }
  return seen;
}

/** Runs `fn` over `items`, at most `limit` at a time, keeping order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await fn(items[index]!);
    }
  });
  await Promise.all(workers);
  return out;
}

/** What one run may still spend — shared by its loops and agent teams. */
interface RunBudget {
  limits: AgentRunLimits;
  steps: number;
  tokens: number;
  deadline: number;
}
const MODEL_NODE_TYPES = new Set(['LLM', 'AI_ACTION', 'AGENT', 'AI_COWORKER', 'CLASSIFIER', 'STRUCTURED_OUTPUT', 'EXTRACT_DATA']);

function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Interpolates `{{variable.path}}` strings from the context. */
function interpolateVariables(
  template: string,
  context: Record<string, unknown>,
): string {
  if (!template || typeof template !== 'string') return '';
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, path) => {
    const val = readPath(context, path);
    if (val === undefined || val === null) return '';
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  });
}

/** Sets `a.b.c` in an object, creating parents — for an approver's edit. */
function writePath(target: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.').filter(Boolean);
  let cursor: Record<string, unknown> = target;
  keys.forEach((key, index) => {
    if (index === keys.length - 1) {
      cursor[key] = value;
      return;
    }
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
    cursor = cursor[key] as Record<string, unknown>;
  });
}

export type RunMode = 'live' | 'test';
export type RunStartedBy = 'person' | 'schedule' | 'event' | 'retry';

export interface RunOptions {
  mode?: RunMode;
  startedBy?: RunStartedBy;
  /** The person who started it, recorded on the run. */
  userId?: string | null;
  /** How deep in an agent-triggers-agent chain this run is. */
  depth?: number;
  /** Begin at these nodes instead of the trigger (restart from a step). */
  startAt?: string[];
  /** Context carried over from an earlier run (restart from a step). */
  carriedContext?: Record<string, unknown>;
  /** Ceilings for this run; defaults to {@link DEFAULT_AGENT_RUN_LIMITS}. */
  limits?: Partial<AgentRunLimits>;
}

/** Everything about one run that its steps need to know. */
interface RunEnv {
  workflow: { id: string; workspaceId: string; creatorId: string | null; name: string };
  profile: AgentProfile | null;
  /** The granted scopes when the workflow carries a Studio profile; null = unrestricted (canvas workflows). */
  scopes: Set<AgentScope> | null;
  runId: string;
  legacyRunId: string | null;
  mode: RunMode;
  startedBy: RunStartedBy;
  depth: number;
  timezone: string;
  limits?: AgentRunLimits;
  /** Created on the first graph walk of this process's share of the run. */
  budget?: RunBudget;
  /** The budget and task record agent teams in this run share. */
  team?: AgentTeamRun;
}

type RunOutcome = 'SUCCESS' | 'FAILED' | 'WAITING_APPROVAL' | 'CANCELLED' | 'PAUSED';

/** The live-update event the Studio listens for (`ai.run.updated`). */
export interface AIRunUpdate {
  runId: string;
  workflowId: string;
  status: string;
  step?: { stepId: string; status: string; label?: string };
}

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIInfrastructureService,
    private readonly knowledgeService: KnowledgeService,
    private readonly aiRuntime: AIRuntimeService,
    private readonly mcpRegistry: MCPToolRegistryService,
    private readonly integrations: IntegrationsService,
    private readonly modelResolver: ModelResolverService,
    private readonly credentials: AICredentialService,
    private readonly mcpServers: MCPService,
    @Optional() private readonly realtime?: RealtimeGatewayService,
    @Optional() private readonly events?: EventEmitter2,
    @Optional() private readonly providers?: ProviderRegistryService,
  ) {}

  /**
   * One model call for a workflow step, billed to the workspace's own
   * provider credential — the same resolution `AIRuntimeService` uses for
   * agent turns. Calling the gateway without it silently fell back to the
   * platform's environment key, whatever provider the workspace configured.
   */
  private async workspaceChat(
    workspaceId: string,
    cfg: Record<string, unknown>,
    messages: AIChatMessage[],
  ) {
    const result = await chatWithFailover(
      { ai: this.aiService, modelResolver: this.modelResolver, credentials: this.credentials, providers: this.providers },
      workspaceId,
      cfg,
      messages,
      { temperature: Number(cfg['temperature']) },
    );
    if (result.failedOver) {
      this.logger.warn(`Model step moved to ${result.provider}/${result.model} after: ${result.failedOver.join('; ')}`);
    }
    return {
      ...result.response,
      /** Which model answered — recorded on the step so the trace is honest about it. */
      usedModel: modelLabel(result.provider, result.model),
      ...(result.failedOver ? { failedOver: result.failedOver } : {}),
    };
  }

  /**
   * Runs a workflow to completion (or to the first pause) and returns the
   * step results. Used by callers that want the outcome in hand — the
   * canvas's Run dialog, event triggers, retries.
   */
  async executeWorkflow(
    workflowId: string,
    initialPayload: Record<string, unknown> = {},
    options: RunOptions = {},
  ) {
    const prepared = await this.prepareRun(workflowId, initialPayload, options);
    const outcome = await this.driveRun(prepared);
    // `runId` is the unified run record the AI Workspace's Runs view shows.
    return { executionId: prepared.env.legacyRunId, runId: prepared.env.runId, status: outcome.status, results: outcome.results };
  }

  /**
   * Starts a workflow and returns as soon as the run exists, so the caller can
   * watch it live (`ai.run.updated`) instead of waiting for every step. The
   * limit checks still happen first: a run that may not start throws here.
   */
  async startWorkflow(
    workflowId: string,
    initialPayload: Record<string, unknown> = {},
    options: RunOptions = {},
  ): Promise<{ runId: string; executionId: string | null; status: 'RUNNING' }> {
    const prepared = await this.prepareRun(workflowId, initialPayload, options);
    void this.driveRun(prepared).catch((error) =>
      this.logger.error(`Run ${prepared.env.runId} of '${prepared.env.workflow.name}' crashed: ${String(error)}`),
    );
    return { runId: prepared.env.runId, executionId: prepared.env.legacyRunId, status: 'RUNNING' };
  }

  /** Checks limits, opens both run records and builds the starting context. */
  private async prepareRun(workflowId: string, initialPayload: Record<string, unknown>, options: RunOptions) {
    const workflow = await this.prisma.automationWorkflow.findUniqueOrThrow({
      where: { id: workflowId },
    });
    this.logger.log(
      `Executing automation workflow '${workflow.name}' (${workflow.id})${options.mode === 'test' ? ' in test mode' : ''}`,
    );
    await this.assertMayRun(workflow.workspaceId);

    const profile = readAgentProfile((workflow as { agentProfile?: unknown }).agentProfile);
    const nodes = normalizeWorkflowNodes(this.parse<unknown>(workflow.nodesJson, []));
    const edges = this.parse<WorkflowEdge[]>(workflow.edgesJson, []);
    const mode: RunMode = options.mode === 'test' ? 'test' : 'live';

    // 1. Legacy WorkflowExecution row, kept for backwards compatibility.
    const execution = await this.prisma.workflowExecution.create({
      data: {
        workflowId: workflow.id,
        status: 'RUNNING',
        triggerPayload: JSON.stringify(initialPayload).slice(0, 20_000),
        stepResults: '[]',
      },
    });

    // 2. The unified AIExecution row the Studio and Runs view read.
    const aiExecution = await this.prisma.aIExecution.create({
      data: {
        workspaceId: workflow.workspaceId,
        entityType: 'WORKFLOW',
        entityId: workflow.id,
        workflowId: workflow.id,
        status: 'RUNNING',
        ...(options.userId ? { userId: options.userId } : {}),
        stateJson: {
          ...initialPayload,
          ...(mode === 'test' ? { [MODE_KEY]: 'test' } : {}),
          __startedBy: options.startedBy ?? 'person',
        } as any,
      },
    });

    const timezone = await this.runTimezone(workflow, profile);
    const env: RunEnv = {
      workflow: { id: workflow.id, workspaceId: workflow.workspaceId, creatorId: workflow.creatorId, name: workflow.name },
      profile,
      scopes: profile ? new Set(profile.scopes) : null,
      runId: aiExecution.id,
      legacyRunId: execution.id,
      mode,
      startedBy: options.startedBy ?? 'person',
      depth: options.depth ?? 0,
      timezone,
      limits: { ...DEFAULT_AGENT_RUN_LIMITS, ...(options.limits ?? {}) },
    };

    const context: Record<string, unknown> = {
      ...(options.carriedContext ?? {}),
      ...initialPayload,
      ...this.engineContext(env, new Date()),
    };
    if (context[LAST_OUTPUT_KEY] === undefined) context[LAST_OUTPUT_KEY] = inputText(initialPayload);

    let starts = options.startAt?.length ? options.startAt : this.startNodes(nodes, edges);
    if (starts.length === 0 && nodes.length > 0) starts = [nodes[0]!.id];
    await this.emitRunUpdate(env, { status: 'RUNNING' });
    return { env, nodes, edges, context, starts, startedAt: Date.now(), previous: [] as WorkflowStepResult[], priorTokens: 0, priorLatency: 0 };
  }

  /** Runs the graph from the prepared starting point and closes the run. */
  private async driveRun(prepared: {
    env: RunEnv;
    nodes: WorkflowNode[];
    edges: WorkflowEdge[];
    context: Record<string, unknown>;
    starts: string[];
    startedAt: number;
    previous: WorkflowStepResult[];
    priorTokens: number;
    priorLatency: number;
  }) {
    const { env } = prepared;
    const outcome = await this.runGraph(env, prepared.nodes, prepared.edges, prepared.starts, prepared.context);
    const results = [...prepared.previous, ...outcome.results];
    await this.finishRun(
      env,
      outcome.status,
      results,
      prepared.priorTokens + outcome.tokens,
      prepared.priorLatency + (Date.now() - prepared.startedAt),
      outcome.error,
    );
    return { status: outcome.status, results };
  }

  /** Plan, trial, concurrency and credit limits — a run that may not start is refused before it exists. */
  private async assertMayRun(workspaceId: string): Promise<void> {
    const sub = await this.prisma.workspaceSubscription.findUnique({
      where: { workspaceId },
      select: { planTier: true, status: true, trialStatus: true, trialEnd: true },
    });

    if (sub?.trialStatus === 'ACTIVE' && sub.trialEnd && sub.trialEnd < new Date()) {
      throw new BadRequestException({
        code: 'TRIAL_EXPIRED',
        message:
          'Your 7-day free trial has expired. Please upgrade your plan to execute workflows.',
      });
    }

    const planTier = normalizePlanTier(sub?.planTier ?? 'starter');
    const planConfig = PLANS_CONFIG[planTier];

    const creditAccount = await this.prisma.creditAccount.findUnique({
      where: { workspaceId },
    });
    if (creditAccount && creditAccount.balance <= 0) {
      throw new BadRequestException({
        code: 'CREDIT_LIMIT_REACHED',
        message:
          'Your shared AI credit balance is depleted. Please top up your credits to continue running workflows.',
      });
    }

    const maxConcurrent = planConfig.machineLimits.concurrentExecutions;
    if (maxConcurrent !== -1) {
      const runningCount = await this.prisma.workflowExecution.count({
        where: {
          workflow: { workspaceId },
          status: 'RUNNING',
        },
      });
      if (runningCount >= maxConcurrent) {
        throw new BadRequestException({
          code: 'EXECUTION_LIMIT_REACHED',
          message: `Concurrent execution limit reached (${maxConcurrent}). Please wait for active runs to complete or upgrade your plan.`,
        });
      }
    }

    const maxMonthly = planConfig.machineLimits.requestsPerMonth;
    if (maxMonthly !== -1) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthlyCount = await this.prisma.workflowExecution.count({
        where: {
          workflow: { workspaceId },
          startedAt: { gte: monthStart },
        },
      });
      if (monthlyCount >= maxMonthly) {
        throw new BadRequestException({
          code: 'PLAN_LIMIT_REACHED',
          message: `Monthly execution quota reached (${maxMonthly} requests). Please upgrade your plan to continue.`,
        });
      }
    }
  }

  /** The zone a run reads "today" in: the agent's schedule zone, else its owner's. */
  private async runTimezone(
    workflow: { creatorId: string | null },
    profile: AgentProfile | null,
  ): Promise<string> {
    if (profile?.trigger.timezone) return profile.trigger.timezone;
    if (!workflow.creatorId) return 'UTC';
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: workflow.creatorId },
        select: { timezone: true },
      });
      return user?.timezone || 'UTC';
    } catch {
      return 'UTC';
    }
  }

  /** What every run's context starts with besides the caller's input. */
  private engineContext(env: RunEnv, at: Date): Record<string, unknown> {
    return {
      workspaceId: env.workflow.workspaceId,
      workflowId: env.workflow.id,
      executionId: env.runId,
      [RUN_ID_KEY]: env.legacyRunId,
      ...(env.mode === 'test' ? { [MODE_KEY]: 'test' } : {}),
      now: nowContext(at, env.timezone),
      params: paramsContext(env.profile),
      run: { id: env.runId, link: `ai/runs?run=${env.runId}`, test: env.mode === 'test' },
      agent: { name: env.workflow.name, objective: env.profile?.objective ?? '' },
    };
  }

  /**
   * Continues a run that paused at a HUMAN_APPROVAL / HUMAN_INPUT step once a
   * person decides it. Approved: execution continues from the step's
   * successors with the context as it was when it paused (plus the decision,
   * and any edit the approver made to the reviewed draft). Rejected: the run
   * is closed as failed.
   */
  async resumeAfterApproval(event: {
    workflowId: string;
    executionId: string | null;
    stepId: string | null;
    decision: 'APPROVED' | 'REJECTED';
    approverId: string | null;
    comment: string | null;
    proposedPayload: Record<string, unknown>;
  }) {
    if (!event.executionId || !event.stepId) return null;
    const aiExecution = await this.prisma.aIExecution.findUnique({ where: { id: event.executionId } });
    if (!aiExecution || aiExecution.status !== 'WAITING_APPROVAL') return null;
    const workflow = await this.prisma.automationWorkflow.findUnique({ where: { id: event.workflowId } });
    if (!workflow || workflow.id !== aiExecution.workflowId) return null;

    const context: Record<string, unknown> = { ...event.proposedPayload };
    // An approver who edited the draft: their text replaces it before anything uses it.
    const review = context['__review'] as { path?: string; value?: unknown } | undefined;
    if (review?.path && typeof review.value === 'string') writePath(context, review.path, review.value);
    delete context['__review'];

    const legacyRunId = typeof context[RUN_ID_KEY] === 'string' ? (context[RUN_ID_KEY] as string) : null;
    const legacy = legacyRunId
      ? await this.prisma.workflowExecution.findUnique({ where: { id: legacyRunId } })
      : null;
    const previous = this.parse<WorkflowStepResult[]>(legacy?.stepResults, []);
    const profile = readAgentProfile((workflow as { agentProfile?: unknown }).agentProfile);
    const state = (aiExecution.stateJson ?? {}) as Record<string, unknown>;
    const env: RunEnv = {
      workflow: { id: workflow.id, workspaceId: workflow.workspaceId, creatorId: workflow.creatorId, name: workflow.name },
      profile,
      scopes: profile ? new Set(profile.scopes) : null,
      runId: aiExecution.id,
      legacyRunId,
      mode: state[MODE_KEY] === 'test' ? 'test' : 'live',
      startedBy: (state['__startedBy'] as RunStartedBy) ?? 'person',
      depth: 0,
      timezone: await this.runTimezone(workflow, profile),
    };

    const decisionStep: WorkflowStepResult = {
      stepId: event.stepId,
      type: 'HUMAN_APPROVAL',
      status: event.decision === 'APPROVED' ? 'SUCCESS' : 'FAILED',
      output: {
        decision: event.decision,
        approverId: event.approverId,
        comment: event.comment,
        ...(review?.path ? { edited: typeof review.value === 'string' } : {}),
      },
    };
    // Settle the approval step that has been waiting, so the trace shows one
    // row per step with its outcome rather than a waiting row and a second one.
    const settled = await this.prisma.aIExecutionStep.updateMany({
      where: { executionId: aiExecution.id, stepId: event.stepId, status: 'WAITING' },
      data: { status: decisionStep.status, outputJson: decisionStep.output as any, finishedAt: new Date() },
    });
    if (settled.count === 0) {
      await this.prisma.aIExecutionStep.create({
        data: {
          executionId: aiExecution.id,
          stepId: event.stepId,
          nodeType: 'HUMAN_APPROVAL',
          status: decisionStep.status,
          outputJson: decisionStep.output as any,
          finishedAt: new Date(),
        },
      });
    }

    if (event.decision === 'REJECTED') {
      await this.finishRun(env, 'FAILED', [...previous, decisionStep], aiExecution.tokensUsed, aiExecution.latencyMs, 'Rejected by the approver — nothing after the approval ran.');
      return { status: 'FAILED' as const };
    }

    const nodes = normalizeWorkflowNodes(this.parse<unknown>(workflow.nodesJson, []));
    const edges = this.parse<WorkflowEdge[]>(workflow.edgesJson, []);
    context['approval'] = { approverId: event.approverId, comment: event.comment };
    // Steps that were ready beside the approval when it paused the run.
    const pending = Array.isArray(context['__pending']) ? (context['__pending'] as string[]) : [];
    delete context['__pending'];
    const next = [
      ...edges.filter((e) => e.source === event.stepId && e.sourceHandle !== 'error').map((e) => e.target),
      ...pending,
    ];

    await this.prisma.aIExecution.update({ where: { id: aiExecution.id }, data: { status: 'RUNNING' } });
    await this.emitRunUpdate(env, { status: 'RUNNING', step: { stepId: event.stepId, status: decisionStep.status } });
    const outcome = await this.driveRun({
      env,
      nodes,
      edges,
      context,
      starts: next,
      startedAt: Date.now(),
      previous: [...previous, decisionStep],
      priorTokens: aiExecution.tokensUsed,
      priorLatency: aiExecution.latencyMs,
    });
    return { status: outcome.status };
  }

  /* ------------------------------------------------------ run controls -- */

  /**
   * Pauses a running workflow run between steps: the step in progress
   * finishes, then the run stops and remembers where it was.
   */
  async pauseRun(workspaceId: string, runId: string) {
    const run = await this.findWorkflowRun(workspaceId, runId);
    if (run.status !== 'RUNNING') {
      throw new ConflictException(`Only a running run can be paused; this one is ${run.status.toLowerCase().replace('_', ' ')}.`);
    }
    await this.prisma.aIExecution.updateMany({ where: { id: runId, status: 'RUNNING' }, data: { status: 'PAUSED' } });
    return { runId, status: 'PAUSED' as const };
  }

  /** Continues a paused run from the step after the one it stopped on. */
  async resumeRun(workspaceId: string, runId: string) {
    const run = await this.findWorkflowRun(workspaceId, runId);
    if (run.status !== 'PAUSED') throw new ConflictException('Only a paused run can be resumed.');
    const state = (run.stateJson ?? {}) as Record<string, unknown>;
    const resume = state['__resume'] as { next?: string[]; context?: Record<string, unknown> } | undefined;
    const workflow = await this.prisma.automationWorkflow.findUniqueOrThrow({ where: { id: run.entityId } });

    if (!resume?.next || !resume.context) {
      // Paused as the last step finished: there is nothing left to run.
      await this.prisma.aIExecution.update({ where: { id: runId }, data: { status: 'COMPLETED', finishedAt: new Date() } });
      return { runId, status: 'COMPLETED' as const };
    }
    await this.assertMayRun(workspaceId);
    const profile = readAgentProfile((workflow as { agentProfile?: unknown }).agentProfile);
    const env: RunEnv = {
      workflow: { id: workflow.id, workspaceId: workflow.workspaceId, creatorId: workflow.creatorId, name: workflow.name },
      profile,
      scopes: profile ? new Set(profile.scopes) : null,
      runId,
      legacyRunId: typeof resume.context[RUN_ID_KEY] === 'string' ? (resume.context[RUN_ID_KEY] as string) : null,
      mode: state[MODE_KEY] === 'test' ? 'test' : 'live',
      startedBy: (state['__startedBy'] as RunStartedBy) ?? 'person',
      depth: 0,
      timezone: await this.runTimezone(workflow, profile),
    };
    const { __resume: _drop, ...rest } = state;
    await this.prisma.aIExecution.update({ where: { id: runId }, data: { status: 'RUNNING', stateJson: rest as any } });
    const nodes = normalizeWorkflowNodes(this.parse<unknown>(workflow.nodesJson, []));
    const edges = this.parse<WorkflowEdge[]>(workflow.edgesJson, []);
    await this.emitRunUpdate(env, { status: 'RUNNING' });
    void this.driveRun({
      env,
      nodes,
      edges,
      context: resume.context,
      starts: resume.next,
      startedAt: Date.now(),
      previous: [],
      priorTokens: run.tokensUsed,
      priorLatency: run.latencyMs,
    }).catch((error) => this.logger.error(`Resumed run ${runId} crashed: ${String(error)}`));
    return { runId, status: 'RUNNING' as const };
  }

  /**
   * Cancels a run. A run waiting on a person or paused closes immediately; a
   * running one stops at the next step boundary (the step in progress is not
   * interrupted mid-call). Pending approvals are withdrawn either way.
   */
  async cancelRun(workspaceId: string, runId: string) {
    const run = await this.findWorkflowRun(workspaceId, runId);
    if (!['RUNNING', 'WAITING_APPROVAL', 'PAUSED'].includes(run.status)) {
      throw new ConflictException(`This run already ${run.status === 'CANCELLED' ? 'was cancelled' : 'finished'}.`);
    }
    await this.prisma.$transaction([
      this.prisma.aIExecution.update({
        where: { id: runId },
        data: {
          status: 'CANCELLED',
          ...(run.status === 'RUNNING' ? {} : { finishedAt: new Date() }),
          errorsJson: { message: 'Cancelled by a person.' } as any,
        },
      }),
      this.prisma.approvalRequest.updateMany({
        where: { executionId: runId, state: 'PENDING' },
        data: { state: 'CANCELLED', respondedAt: new Date() },
      }),
    ]);
    if (run.status !== 'RUNNING') {
      const workflow = await this.prisma.automationWorkflow.findUnique({ where: { id: run.entityId } });
      if (workflow) {
        const env = this.lightEnv(workflow, runId);
        await this.emitRunUpdate(env, { status: 'CANCELLED' });
      }
    }
    return { runId, status: 'CANCELLED' as const };
  }

  /**
   * Starts a new run that begins at `stepId`, carrying over everything the
   * earlier run's steps before it produced — for "fix the cause, then continue
   * from where it failed" without redoing the work that succeeded.
   */
  async restartFromStep(workspaceId: string, runId: string, stepId: string, userId: string | null) {
    const run = await this.findWorkflowRun(workspaceId, runId);
    const workflow = await this.prisma.automationWorkflow.findUniqueOrThrow({ where: { id: run.entityId } });
    const nodes = normalizeWorkflowNodes(this.parse<unknown>(workflow.nodesJson, []));
    if (!nodes.some((n) => n.id === stepId)) {
      throw new NotFoundException('That step is no longer in this workflow.');
    }
    const steps = await this.prisma.aIExecutionStep.findMany({
      where: { executionId: runId },
      orderBy: { startedAt: 'asc' },
      select: { stepId: true, status: true, outputJson: true },
    });
    const carried: Record<string, unknown> = {};
    for (const step of steps) {
      if (step.stepId === stepId) break;
      if (step.status !== 'SUCCESS') continue;
      const output = step.outputJson as Record<string, unknown> | null;
      if (output && typeof output === 'object') {
        Object.assign(carried, output);
        carried[step.stepId] = output;
      }
    }
    const state = (run.stateJson ?? {}) as Record<string, unknown>;
    const input = Object.fromEntries(Object.entries(state).filter(([key]) => !ENGINE_CONTEXT_KEYS.includes(key)));
    return this.startWorkflow(workflow.id, { ...input, restartOf: run.id, restartFrom: stepId }, {
      mode: state[MODE_KEY] === 'test' ? 'test' : 'live',
      startedBy: 'retry',
      userId,
      startAt: [stepId],
      carriedContext: carried,
    });
  }

  private async findWorkflowRun(workspaceId: string, runId: string) {
    const run = await this.prisma.aIExecution.findFirst({ where: { id: runId, workspaceId } });
    if (!run) throw new NotFoundException('Run not found.');
    if (run.entityType !== 'WORKFLOW') {
      throw new BadRequestException('Only agent and workflow runs can be paused, resumed or restarted.');
    }
    return run;
  }

  private lightEnv(workflow: { id: string; workspaceId: string; creatorId: string | null; name: string }, runId: string): RunEnv {
    return {
      workflow: { id: workflow.id, workspaceId: workflow.workspaceId, creatorId: workflow.creatorId, name: workflow.name },
      profile: null,
      scopes: null,
      runId,
      legacyRunId: null,
      mode: 'live',
      startedBy: 'person',
      depth: 0,
      timezone: 'UTC',
    };
  }

  /* ------------------------------------------------------------- graph -- */

  /**
   * Walks the graph from `startIds`, running each reachable step once per
   * visit and following only the branch a CONDITION/SWITCH/CLASSIFIER chose.
   *
   * Steps that are ready together (a PARALLEL fork's lanes, or any branches
   * that split) run at the same time, a few at once; a MERGE waits for every
   * started branch and joins their results. A LOOP runs its `each` branch
   * once per item. Steps that wait for a person run alone, after the rest of
   * the ready work, so the run pauses at a clean point.
   *
   * A failed step with an `error` edge continues down it (a fallback);
   * otherwise the run stops at the first failure, at a step that waits for a
   * person, when someone pauses or cancels it between steps, or when it hits
   * one of its limits (steps, time, tokens).
   *
   * `scope` confines the walk to a loop's body, for one item.
   */
  private async runGraph(
    env: RunEnv,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    startIds: string[],
    executionContext: Record<string, unknown>,
    scope?: { only: Set<string>; iteration: number },
  ): Promise<{ status: RunOutcome; results: WorkflowStepResult[]; tokens: number; error?: string }> {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const results: WorkflowStepResult[] = [];
    const budget = this.budgetFor(env);
    let status: RunOutcome = 'SUCCESS';
    let tokens = 0;
    let error: string | undefined;

    try {
      const queue = [...startIds];
      // Each step runs once per run: a node two branches lead to (a MERGE, or
      // any shared downstream step) used to run once per incoming branch.
      const done = new Set<string>();
      const activated = new Set<string>(startIds);
      const deferrals = new Map<string, number>();

      while (queue.length > 0) {
        // Everything ready now, minus joins still waiting for a branch.
        const ready: WorkflowNode[] = [];
        const later: string[] = [];
        for (const nodeId of queue.splice(0)) {
          const node = nodeById.get(nodeId);
          if (!node || done.has(nodeId) || ready.includes(node) || (scope && !scope.only.has(nodeId))) continue;
          if (node.type === 'MERGE') {
            // A join waits while any started step can still lead into it —
            // not just its direct inputs, which may not have been reached yet.
            const upstream = ancestorsOf(nodeId, edges);
            const pending = [...activated].some((id) => id !== nodeId && !done.has(id) && upstream.has(id));
            const waited = (deferrals.get(nodeId) ?? 0) + 1;
            if (pending && waited <= MAX_NODE_VISITS * 10) {
              deferrals.set(nodeId, waited);
              later.push(nodeId);
              continue;
            }
          }
          ready.push(node);
        }
        const work = ready.filter((n) => !HUMAN_STEP_TYPES.has(n.type));
        const humans = ready.filter((n) => HUMAN_STEP_TYPES.has(n.type));
        const batch = work.length ? work : humans.slice(0, 1);
        queue.push(...(work.length ? humans : humans.slice(1)).map((n) => n.id), ...later);
        if (batch.length === 0) continue;

        // Someone paused or cancelled the run while the previous steps ran.
        const interrupted = await this.interruption(env.runId);
        if (interrupted) {
          status = interrupted;
          if (interrupted === 'PAUSED' && !scope) {
            await this.rememberResumePoint(env.runId, [...batch.map((n) => n.id), ...queue], executionContext);
          }
          break;
        }
        const overLimit = this.limitReached(budget, batch.length);
        if (overLimit) {
          status = 'FAILED';
          error = overLimit;
          break;
        }
        budget.steps += batch.length;
        batch.forEach((n) => done.add(n.id));

        const outcomes = await mapLimit(batch, MAX_PARALLEL_STEPS, (node) =>
          this.runStep(env, node, nodes, edges, executionContext, scope),
        );

        let waitingAt: string | null = null;
        let failed = false;
        batch.forEach((node, i) => {
          const step = outcomes[i]!;
          results.push(step);
          const stepTokens = Number((step.output as any)?.tokensUsed ?? 0) || 0;
          tokens += stepTokens;
          budget.tokens += stepTokens;

          if (step.status === 'WAITING') {
            waitingAt = node.id;
            return;
          }
          if (step.status === 'FAILED') {
            const fallbacks = edges.filter((e) => e.source === node.id && e.sourceHandle === 'error');
            if (fallbacks.length === 0) {
              if (!failed) error = `${node.label || node.id}: ${String((step.output as any)?.error ?? 'failed')}`;
              failed = true;
              return;
            }
            // Recovered: later steps can see what went wrong and say so.
            executionContext[node.id] = step.output;
            for (const edge of fallbacks) {
              activated.add(edge.target);
              queue.push(edge.target);
            }
            return;
          }

          // Merge step output into context for downstream variable resolution
          if (step.output && typeof step.output === 'object') {
            Object.assign(executionContext, step.output);
            executionContext[node.id] = step.output;
          }
          if (step.status === 'SUCCESS' && !CONTROL_STEP_TYPES.has(node.type)) {
            const text = lastOutputText(step.output);
            if (text !== undefined) executionContext[LAST_OUTPUT_KEY] = text;
          }

          for (const edge of edges) {
            if (edge.source !== node.id || edge.sourceHandle === 'error') continue;
            // A loop's per-item branch already ran inside the loop step.
            if (node.type === 'LOOP' && edge.sourceHandle === LOOP_EACH_HANDLE) continue;
            if (step.branch && edge.sourceHandle && edge.sourceHandle !== step.branch) continue;
            activated.add(edge.target);
            queue.push(edge.target);
          }
        });

        if (failed) {
          status = 'FAILED';
          break;
        }
        if (waitingAt) {
          status = 'WAITING_APPROVAL';
          // Other branches ready beside the approval continue after it.
          const pending = [...new Set(queue)].filter((id) => !done.has(id));
          if (pending.length) await this.rememberPendingBranches(env.runId, waitingAt, pending);
          break;
        }
      }
    } catch (err) {
      status = 'FAILED';
      error = err instanceof Error ? err.message : String(err);
      results.push({
        stepId: 'engine',
        type: 'ENGINE',
        status: 'FAILED',
        output: { error },
      });
    }

    return { status, results, tokens, ...(error ? { error } : {}) };
  }

  /** One step with its run record: opened as running, closed with its outcome. */
  private async runStep(
    env: RunEnv,
    node: WorkflowNode,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    context: Record<string, unknown>,
    scope?: { only: Set<string>; iteration: number },
  ): Promise<WorkflowStepResult> {
    const shown = scope ? { ...node, label: `${node.label || node.id} · item ${scope.iteration + 1}` } : node;
    const stepRowId = await this.openStep(env, shown);
    const started = Date.now();
    const step = await runInAgentScope(
      { workflowId: env.workflow.id, runId: env.runId, agentName: env.workflow.name, depth: env.depth, test: env.mode === 'test' },
      () =>
        node.type === 'MERGE'
          ? Promise.resolve(this.mergeStep(node, edges, nodes, context))
          : node.type === 'LOOP' && edges.some((e) => e.source === node.id && e.sourceHandle === LOOP_EACH_HANDLE)
            ? this.runLoop(env, node, nodes, edges, context)
            : this.runNode(node, context, env),
    );
    await this.closeStep(env, shown, stepRowId, step, Date.now() - started, Number((step.output as any)?.tokensUsed ?? 0) || 0);
    return step;
  }

  /** A join: what each incoming branch produced, by step name. */
  private mergeStep(node: WorkflowNode, edges: WorkflowEdge[], nodes: WorkflowNode[], context: Record<string, unknown>): WorkflowStepResult {
    const merged: Record<string, unknown> = {};
    const parts: string[] = [];
    for (const edge of edges.filter((e) => e.target === node.id)) {
      const source = nodes.find((n) => n.id === edge.source);
      const output = context[edge.source];
      if (output === undefined) continue;
      const name = source?.label || edge.source;
      merged[name] = output;
      const text = lastOutputText(output);
      if (text) parts.push(`### ${name}\n${text}`);
    }
    return {
      stepId: node.id,
      type: node.type,
      status: 'SUCCESS',
      output: { merged, ...(parts.length ? { output: parts.join('\n\n') } : {}) },
    };
  }

  /**
   * Runs a loop's `each` branch once per item of the list at `itemsKey`, each
   * item seeing `{{item}}` and `{{index}}`. The body is everything reachable
   * from the `each` branch; it may not wait for a person (a paused loop
   * couldn't pick up where it stopped).
   */
  private async runLoop(
    env: RunEnv,
    node: WorkflowNode,
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    context: Record<string, unknown>,
  ): Promise<WorkflowStepResult> {
    const fail = (message: string): WorkflowStepResult => ({ stepId: node.id, type: node.type, status: 'FAILED', output: { error: message } });
    const itemsKey = String(node.config['itemsKey'] || 'items');
    let items: unknown = readPath(context, itemsKey);
    if (typeof items === 'string') {
      const text: string = items;
      try {
        items = JSON.parse(text);
      } catch {
        // A plain list: one item per line.
        items = text.split('\n').map((line) => line.trim()).filter(Boolean);
      }
    }
    if (!Array.isArray(items)) return fail(`The loop needs a list at {{${itemsKey}}}, but found ${items === undefined ? 'nothing' : typeof items}.`);

    const bodyStarts = edges.filter((e) => e.source === node.id && e.sourceHandle === LOOP_EACH_HANDLE).map((e) => e.target);
    const body = new Set<string>();
    const stack = [...bodyStarts];
    while (stack.length) {
      const id = stack.pop() as string;
      if (id === node.id || body.has(id)) continue;
      body.add(id);
      stack.push(...edges.filter((e) => e.source === id).map((e) => e.target));
    }
    if (nodes.some((n) => body.has(n.id) && HUMAN_STEP_TYPES.has(n.type))) {
      return fail('Approvals inside a loop aren’t supported yet. Put the approval before or after the loop.');
    }

    const cap = Math.min(Math.max(num(node.config['maxIterations'], MAX_LOOP_ITERATIONS), 1), MAX_LOOP_ITERATIONS);
    const loopResults: unknown[] = [];
    let tokens = 0;
    for (const [index, item] of items.slice(0, cap).entries()) {
      const iteration: Record<string, unknown> = {
        ...context,
        item,
        index,
        loop: { item, index, count: Math.min(items.length, cap) },
        [LAST_OUTPUT_KEY]: typeof item === 'string' ? item : JSON.stringify(item),
      };
      const outcome = await this.runGraph(env, nodes, edges, bodyStarts, iteration, { only: body, iteration: index });
      tokens += outcome.tokens;
      if (outcome.status !== 'SUCCESS') {
        return {
          stepId: node.id,
          type: node.type,
          status: 'FAILED',
          output: { error: `Item ${index + 1}: ${outcome.error ?? outcome.status.toLowerCase()}`, loopResults, tokensUsed: tokens },
        };
      }
      loopResults.push(iteration[LAST_OUTPUT_KEY]);
    }
    return {
      stepId: node.id,
      type: node.type,
      status: 'SUCCESS',
      output: {
        loopResults,
        iterations: loopResults.length,
        ...(items.length > cap ? { truncated: `Only the first ${cap} of ${items.length} items ran.` } : {}),
        tokensUsed: tokens,
      },
    };
  }

  /** The run's budget, created on first use from its limits. */
  private budgetFor(env: RunEnv): RunBudget {
    if (!env.budget) {
      const limits = env.limits ?? DEFAULT_AGENT_RUN_LIMITS;
      env.budget = { limits, steps: 0, tokens: 0, deadline: Date.now() + limits.maxDurationMs };
    }
    return env.budget;
  }

  /** The agent-team budget this run's canvas agents share. */
  private teamFor(env: RunEnv): AgentTeamRun {
    if (!env.team) {
      const budget = this.budgetFor(env);
      env.team = newAgentTeamRun(env.runId, {
        maxDelegations: budget.limits.maxDelegations,
        ...(budget.limits.maxTokens ? { maxTokens: budget.limits.maxTokens } : {}),
        maxDurationMs: Math.max(budget.deadline - Date.now(), 0),
      });
    }
    return env.team;
  }

  /** Why the run must stop before the next steps, or null. */
  private limitReached(budget: RunBudget, nextSteps: number): string | null {
    if (budget.steps + nextSteps > budget.limits.maxSteps) {
      return `Stopped after ${budget.steps} steps: this run may take at most ${budget.limits.maxSteps}. Raise the limit or simplify the flow.`;
    }
    if (Date.now() > budget.deadline) {
      return `Stopped: the run went over its ${Math.round(budget.limits.maxDurationMs / 60_000)}-minute time limit.`;
    }
    if (budget.limits.maxTokens && budget.tokens >= budget.limits.maxTokens) {
      return `Stopped: the run used its ${budget.limits.maxTokens.toLocaleString('en-US')}-token budget.`;
    }
    return null;
  }

  /** Records the branches that were ready beside an approval, so deciding it continues them too. */
  private async rememberPendingBranches(runId: string, stepId: string, pending: string[]) {
    try {
      const approval = await this.prisma.approvalRequest.findFirst({
        where: { executionId: runId, stepId, state: 'PENDING' },
        select: { id: true, proposedPayload: true },
      });
      if (!approval) return;
      await this.prisma.approvalRequest.update({
        where: { id: approval.id },
        data: { proposedPayload: { ...((approval.proposedPayload as Record<string, unknown>) ?? {}), __pending: pending } as any },
      });
    } catch (error) {
      this.logger.warn(`Could not record the branches waiting on ${stepId}: ${String(error)}`);
    }
  }

  /** PAUSED or CANCELLED when someone stopped the run since the last step. */
  private async interruption(runId: string): Promise<'PAUSED' | 'CANCELLED' | null> {
    const row = await this.prisma.aIExecution.findUnique({ where: { id: runId }, select: { status: true } });
    return row?.status === 'PAUSED' || row?.status === 'CANCELLED' ? row.status : null;
  }

  private async rememberResumePoint(runId: string, next: string[], context: Record<string, unknown>) {
    const row = await this.prisma.aIExecution.findUnique({ where: { id: runId }, select: { stateJson: true } });
    const state = (row?.stateJson ?? {}) as Record<string, unknown>;
    await this.prisma.aIExecution.update({
      where: { id: runId },
      data: { stateJson: { ...state, __resume: { next, context } } as any },
    });
  }

  /** Records a step as running before it starts — the live "current step". */
  private async openStep(env: RunEnv, node: WorkflowNode): Promise<string | null> {
    try {
      const row = await this.prisma.aIExecutionStep.create({
        data: {
          executionId: env.runId,
          stepId: node.id,
          nodeType: node.type,
          status: 'RUNNING',
          inputJson: (node.config ?? {}) as any,
          outputJson: {},
        },
      });
      await this.emitRunUpdate(env, { status: 'RUNNING', step: { stepId: node.id, status: 'RUNNING', ...(node.label ? { label: node.label } : {}) } });
      return (row as { id?: string } | undefined)?.id ?? null;
    } catch (error) {
      this.logger.warn(`Could not record step ${node.id} of run ${env.runId}: ${String(error)}`);
      return null;
    }
  }

  private async closeStep(
    env: RunEnv,
    node: WorkflowNode,
    rowId: string | null,
    step: WorkflowStepResult,
    latencyMs: number,
    tokensUsed: number,
  ) {
    const data = {
      status: step.status,
      outputJson: {
        ...((step.output as Record<string, unknown> | null) ?? {}),
        // How many tries it took, when a retry was needed — shown on the timeline.
        ...(step.attempts && step.attempts > 1 ? { attempts: step.attempts } : {}),
      } as any,
      latencyMs,
      tokensUsed,
      errorMessage: (step.output as any)?.error ?? null,
      finishedAt: step.status === 'WAITING' ? null : new Date(),
    };
    try {
      if (rowId) {
        await this.prisma.aIExecutionStep.update({ where: { id: rowId }, data });
      } else {
        await this.prisma.aIExecutionStep.create({
          data: { executionId: env.runId, stepId: node.id, nodeType: node.type, inputJson: (node.config ?? {}) as any, ...data },
        });
      }
    } catch (error) {
      this.logger.warn(`Could not record the result of step ${node.id}: ${String(error)}`);
    }
    await this.emitRunUpdate(env, { status: 'RUNNING', step: { stepId: node.id, status: step.status, ...(node.label ? { label: node.label } : {}) } });
  }

  /**
   * Writes the outcome to both run records. A run someone paused or
   * cancelled keeps that status — the engine only settles runs still running.
   */
  private async finishRun(
    env: RunEnv,
    status: RunOutcome,
    results: WorkflowStepResult[],
    totalTokens: number,
    duration: number,
    error?: string,
  ) {
    if (env.legacyRunId) {
      await this.prisma.workflowExecution.update({
        where: { id: env.legacyRunId },
        data: {
          status: status === 'WAITING_APPROVAL' || status === 'PAUSED' ? 'RUNNING' : status === 'CANCELLED' ? 'FAILED' : status,
          stepResults: JSON.stringify(results).slice(0, 100_000),
          finishedAt: new Date(),
        },
      });
    }
    const failures = results.filter((r) => r.status === 'FAILED').map((r) => ({ stepId: r.stepId, output: r.output }));
    const totals = {
      latencyMs: duration,
      tokensUsed: totalTokens,
      totalCost: Number((totalTokens * 0.000002).toFixed(5)),
    };
    if (status === 'PAUSED' || status === 'CANCELLED') {
      await this.prisma.aIExecution.update({
        where: { id: env.runId },
        data: { ...totals, ...(status === 'CANCELLED' ? { finishedAt: new Date() } : {}) },
      });
    } else {
      await this.prisma.aIExecution.updateMany({
        // Only a run still in flight: never overwrite one someone paused or cancelled.
        where: { id: env.runId, status: { in: ['RUNNING', 'WAITING_APPROVAL'] } },
        data: {
          ...totals,
          status: status === 'WAITING_APPROVAL' ? 'WAITING_APPROVAL' : status === 'SUCCESS' ? 'COMPLETED' : 'FAILED',
          finishedAt: status === 'WAITING_APPROVAL' ? null : new Date(),
          ...(status === 'FAILED'
            ? { errorsJson: { message: error ?? 'A step failed.', failures } as any }
            : failures.length
              ? { errorsJson: { recovered: failures } as any }
              : {}),
        },
      });
    }

    const final = status === 'SUCCESS' ? 'COMPLETED' : status;
    await this.emitRunUpdate(env, { status: final });
    if (status === 'SUCCESS' || status === 'FAILED' || status === 'CANCELLED') {
      const event: AiRunFinishedEvent = {
        workspaceId: env.workflow.workspaceId,
        runId: env.runId,
        workflowId: env.workflow.id,
        agentName: env.workflow.name,
        ownerId: env.workflow.creatorId,
        status: status === 'SUCCESS' ? 'COMPLETED' : status,
        startedBy: env.startedBy,
        test: env.mode === 'test',
        error: error ?? null,
        notify: {
          // Canvas workflows (no profile) only report failures of unattended runs.
          onComplete: env.profile?.notify.onComplete ?? false,
          onFailure: env.profile?.notify.onFailure ?? true,
        },
      };
      this.events?.emit(AppEvent.AiRunFinished, event);
    }
  }

  /** Tells open Studio pages what changed, so nothing has to poll. */
  private async emitRunUpdate(env: RunEnv, update: Omit<AIRunUpdate, 'runId' | 'workflowId'>) {
    if (!this.realtime) return;
    try {
      await this.realtime.broadcastToWorkspace(env.workflow.workspaceId, {
        type: 'ai.run.updated',
        payload: { runId: env.runId, workflowId: env.workflow.id, ...update } satisfies AIRunUpdate,
      });
    } catch (error) {
      this.logger.debug(`Run update for ${env.runId} not broadcast: ${String(error)}`);
    }
  }

  // --- Node Execution Core ---

  private async runNode(
    node: WorkflowNode,
    context: Record<string, unknown>,
    env: RunEnv,
  ): Promise<WorkflowStepResult> {
    if (isNodeDisabled(node)) {
      // Skipped, not failed: downstream nodes still run, as if it were wired
      // straight through.
      return {
        stepId: node.id,
        type: node.type,
        status: 'SKIPPED',
        output: { skipped: true, reason: 'Node disabled in the builder' },
      };
    }
    const cfg = node.config ?? {};
    const retries = Math.min(num(cfg['retries'], 0), 5);
    const timeoutMs = num(cfg['timeoutMs'], MODEL_NODE_TYPES.has(node.type) ? DEFAULT_MODEL_STEP_TIMEOUT_MS : DEFAULT_STEP_TIMEOUT_MS);

    let lastError = '';
    let attempt = 1;
    for (; attempt <= retries + 1; attempt++) {
      try {
        const result = await this.withTimeout(
          this.executeNodeStep(node, context, env),
          timeoutMs,
          node.id,
        );
        if (attempt > 1) {
          result.attempts = attempt;
        }
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        const classified = classifyStepError(lastError);
        this.logger.warn(
          `Step '${node.id}' attempt ${attempt}/${retries + 1} failed (${classified.code}): ${lastError}`,
        );
        // Retrying cannot fix a missing connection or permission; say so now.
        if (!classified.retryable) break;
        if (attempt <= retries) {
          await new Promise((r) => setTimeout(r, backoffMs(attempt, classified.code)));
        }
      }
    }

    const classified = classifyStepError(lastError);
    return {
      stepId: node.id,
      type: node.type,
      status: 'FAILED',
      output: { error: lastError, errorCode: classified.code, retryable: classified.retryable, hint: classified.hint },
      attempts: Math.min(attempt, retries + 1),
    };
  }

  /**
   * The permission and test-mode gate every step passes before it acts.
   * Returns a result to use instead of running the step, or null to run it.
   */
  private gateStep(node: WorkflowNode, env: RunEnv, appAccess?: 'read' | 'write' | 'destructive'): WorkflowStepResult | null {
    const scope = scopeForNode(node.type, node.config ?? {}, appAccess);
    if (scope && env.scopes && !env.scopes.has(scope)) {
      throw new Error(missingPermissionMessage(scope));
    }
    if (env.mode === 'test' && scope && !isReadScope(scope)) {
      const tool = String(node.config?.['toolName'] || node.config?.['tool'] || node.type);
      return {
        stepId: node.id,
        type: node.type,
        status: 'SKIPPED',
        output: {
          dryRun: true,
          wouldRun: tool,
          note: 'Test run — this action was not performed, so nothing was changed.',
        },
      };
    }
    return null;
  }

  private async executeNodeStep(
    node: WorkflowNode,
    context: Record<string, unknown>,
    env: RunEnv,
  ): Promise<WorkflowStepResult> {
    const workspaceId = env.workflow.workspaceId;
    const creatorId = env.workflow.creatorId;
    const cfg = node.config ?? {};
    const type = node.type.toUpperCase();

    switch (type) {
      // 1. Triggers & I/O
      case 'START':
      case 'TRIGGER':
      case 'USER_INPUT':
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { ...context },
        };

      case 'OUTPUT': {
        const template = String(cfg['template'] || cfg['message'] || '');
        // A snapshot, not the live context: the step's output is stored back
        // into the context, and a self-reference made the run unserialisable.
        const rendered = template ? interpolateVariables(template, context) : { ...context };
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { output: rendered },
        };
      }

      // 2. Intelligence
      case 'LLM':
      case 'AI_ACTION': {
        const rawPrompt = String(cfg['prompt'] || 'Process the input data');
        const prompt = interpolateVariables(rawPrompt, context);
        const aiRes = await this.workspaceChat(workspaceId, cfg, [
          { role: 'user', content: prompt },
        ]);
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: {
            aiOutput: aiRes.message.content,
            tokensUsed: aiRes.usage?.totalTokens ?? 0,
            model: aiRes.usedModel,
            ...(aiRes.failedOver ? { failedOver: aiRes.failedOver } : {}),
          },
        };
      }

      case 'PROMPT': {
        const raw = String(cfg['promptText'] || cfg['template'] || '');
        const rendered = interpolateVariables(raw, context);
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { prompt: rendered },
        };
      }

      case 'AGENT':
        this.gateScopeOnly(node, env);
        if (cfg['inlineAgent'] && typeof cfg['inlineAgent'] === 'object') {
          return this.runInlineAgentNode(node, context, env, cfg['inlineAgent'] as InlineAgentSpec);
        }
        return this.runEntityNode(
          node,
          context,
          workspaceId,
          String(cfg['agentId'] || cfg['entityId'] || ''),
          String(cfg['goal'] || cfg['prompt'] || ''),
          env,
        );

      case 'AI_COWORKER':
        this.gateScopeOnly(node, env);
        return this.runEntityNode(
          node,
          context,
          workspaceId,
          String(cfg['coworkerId'] || cfg['entityId'] || ''),
          String(cfg['task'] || cfg['prompt'] || ''),
          env,
        );

      case 'KNOWLEDGE_RETRIEVAL': {
        const kbId = String(cfg['knowledgeBaseId'] || '');
        const queryText = interpolateVariables(String(cfg['query'] || 'information'), context);
        let docs: any[] = [];
        if (kbId) {
          try {
            docs = await this.knowledgeService.retrieve(workspaceId, kbId, {
              query: queryText,
              topK: Math.min(Math.max(num(cfg['topK'], 4), 1), 20),
            });
          } catch {
            docs = [];
          }
        }
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { retrievedDocuments: docs, count: docs.length },
        };
      }

      case 'CLASSIFIER': {
        const input = interpolateVariables(
          String(cfg['input'] || '{{input}}'),
          context,
        );
        const rawCategories = cfg['categories'] ?? cfg['classes'];
        const categories = (
          Array.isArray(rawCategories)
            ? (rawCategories as unknown[]).map(String)
            : String(rawCategories || 'general,support,billing').split(',')
        )
          .map((c) => c.trim())
          .filter(Boolean);
        const aiRes = await this.workspaceChat(workspaceId, cfg, [
          {
            role: 'system',
            content: `Classify the user's text into exactly one of these categories: ${categories.join(', ')}. Reply with the category name only.`,
          },
          { role: 'user', content: input },
        ]);
        const answer = aiRes.message.content.trim().toLowerCase();
        // The model is asked for one label; accept it only if it is one of
        // ours, otherwise route to the explicit fallback branch.
        const chosen =
          categories.find((c) => c.toLowerCase() === answer) ??
          categories.find((c) => answer.includes(c.toLowerCase())) ??
          'default';
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          branch: chosen,
          output: {
            classification: chosen,
            classifiedInput: input,
            tokensUsed: aiRes.usage?.totalTokens ?? 0,
          },
        };
      }

      case 'STRUCTURED_OUTPUT':
      case 'EXTRACT_DATA': {
        const text = interpolateVariables(String(cfg['input'] || '{{input}}'), context);
        const fields = String(cfg['fields'] || cfg['schema'] || '')
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean);
        const aiRes = await this.workspaceChat(workspaceId, cfg, [
          {
            role: 'system',
            content: fields.length
              ? `Extract these fields from the user's text and reply with a single JSON object with exactly these keys: ${fields.join(', ')}. Use null for anything not present. Reply with JSON only.`
              : `Extract the key facts from the user's text as a single flat JSON object. Reply with JSON only.`,
          },
          { role: 'user', content: text },
        ]);
        const raw = aiRes.message.content.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
        let extracted: unknown;
        try {
          extracted = JSON.parse(raw);
        } catch {
          throw new Error('The model did not return valid JSON for this extraction step.');
        }
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { extracted, tokensUsed: aiRes.usage?.totalTokens ?? 0 },
        };
      }

      // 3. Logic & Flow
      case 'CONDITION': {
        const passed = evaluateCondition(conditionSpecFrom(cfg), context);
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          branch: passed ? 'true' : 'false',
          output: { conditionPassed: passed },
        };
      }

      case 'SWITCH': {
        const val = interpolateVariables(String(cfg['value'] || ''), context);
        const cases = (cfg['cases'] as string[]) || [];
        const matched = cases.find((c) => c === val) || 'default';
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          branch: matched,
          output: { switchBranch: matched },
        };
      }

      case 'LOOP':
      case 'ITERATION': {
        const list = (readPath(context, String(cfg['itemsKey'] || 'items')) as any[]) || [];
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { iterations: list.length },
        };
      }

      case 'PARALLEL':
        // A fork: every outgoing branch runs, at the same time (see runGraph).
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { branches: true },
        };

      case 'MERGE':
        // Joined in runGraph, which knows the branches; reached here only
        // without one (e.g. a restart that began at the merge).
        return { stepId: node.id, type: node.type, status: 'SUCCESS', output: { merged: {} } };

      case 'UNSUPPORTED':
        return {
          stepId: node.id,
          type: String(cfg['originalType'] || node.type),
          status: 'SKIPPED',
          output: { skipped: true, reason: String(cfg['reason'] || 'This step can’t run yet.') },
        };

      case 'DELAY': {
        const ms = cfg['seconds'] !== undefined ? num(cfg['seconds'], 0) * 1000 : num(cfg['delayMs'], 0);
        if (ms > MAX_INLINE_DELAY_MS) {
          throw new Error(
            `Delays longer than ${MAX_INLINE_DELAY_MS / 1000} seconds aren't supported yet. Use a schedule trigger or an approval step to pause longer.`,
          );
        }
        await new Promise((r) => setTimeout(r, ms));
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { delayedMs: ms },
        };
      }

      case 'RETRY':
      case 'ERROR_HANDLER':
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { handled: true },
        };

      // 4. Compute & Data
      case 'VARIABLE': {
        const varName = String(cfg['name'] || 'var');
        const varVal = interpolateVariables(String(cfg['value'] || ''), context);
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { [varName]: varVal },
        };
      }

      case 'TEMPLATE':
      case 'TRANSFORM': {
        const tpl = String(cfg['template'] || '');
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { result: interpolateVariables(tpl, context) },
        };
      }

      case 'CODE':
        // There is no sandbox to run member-authored code in, and running it
        // unsandboxed on the API host is not an option. This used to report
        // SUCCESS with `{ computed: true }` without running anything; skip it
        // visibly instead so the run log says what actually happened.
        return {
          stepId: node.id,
          type: node.type,
          status: 'SKIPPED',
          output: {
            skipped: true,
            reason: 'Code steps are not executed. Use a Template or Variable step to shape data.',
          },
        };

      case 'HTTP_REQUEST':
      case 'API_CALL':
      case 'API':
      case 'WEBHOOK': {
        const gated = this.gateStep(node, env);
        if (gated) return gated;
        const rawUrl = String(cfg['url'] ?? '');
        const url = interpolateVariables(rawUrl, context);
        const method = String(cfg['method'] ?? 'GET').toUpperCase();

        const headers: Record<string, string> = {
          'user-agent': 'OneTab-AI-Workflow/1',
          ...((cfg['headers'] as Record<string, string>) ?? {}),
        };
        const hasBody = method !== 'GET' && method !== 'HEAD';
        const body = hasBody && cfg['body'] ? interpolateVariables(String(cfg['body']), context) : undefined;
        if (body && !headers['content-type']) {
          headers['content-type'] = 'application/json';
        }

        // The URL is member-authored and may be interpolated from the trigger
        // payload, so it goes through the shared SSRF guard: private and
        // internal destinations are refused, including via redirect or DNS
        // rebinding.
        const res = await safeFetch(url, {
          method,
          headers,
          ...(body !== undefined ? { body } : {}),
          maxBytes: MAX_API_RESPONSE_CHARS * 4,
        });
        const text = res.text().slice(0, MAX_API_RESPONSE_CHARS);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} from ${url}`);
        }
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { statusCode: res.status, body: text },
        };
      }

      case 'MCP':
      case 'MCP_TOOL': {
        // The canvas stores the picked tool as `<connectionId>::<toolName>`.
        const picked = typeof cfg['mcpTool'] === 'string' ? (cfg['mcpTool'] as string).split('::') : [];
        const mcpCfg =
          picked.length === 2 && !cfg['mcpConnectionId']
            ? { ...cfg, mcpConnectionId: picked[0], mcpToolName: picked[1] }
            : cfg;
        if (mcpCfg['mcpConnectionId'] && mcpCfg['mcpToolName']) {
          const gatedMcp = this.gateStep(node, env);
          if (gatedMcp) return gatedMcp;
          return this.runMcpServerNode(node, context, workspaceId, mcpCfg);
        }
        // A built-in tool or a connected app's action: gated by what it
        // really does (a read runs in a test, a write is simulated).
        return this.runToolNode(node, context, env, cfg);
      }

      case 'TOOL':
      case 'APP':
        return this.runToolNode(node, context, env, cfg);

      case 'END':
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { completed: true, ...context },
        };

      case 'FIRECRAWL_SEARCH': {
        this.gateScopeOnly(node, env);
        const query = interpolateVariables(String(cfg['query'] || cfg['prompt'] || ''), context);
        const limit = Number(cfg['limit']) || 5;
        const result = await this.mcpRegistry.executeTool('firecrawl_search', { query, limit }, { workspaceId, actingUserId: creatorId, timezone: env.timezone });
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { searchResult: result },
        };
      }

      case 'FIRECRAWL_SCRAPE': {
        this.gateScopeOnly(node, env);
        const url = interpolateVariables(String(cfg['url'] || ''), context);
        const result = await this.mcpRegistry.executeTool('firecrawl_scrape', { url }, { workspaceId, actingUserId: creatorId, timezone: env.timezone });
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { scrapeResult: result },
        };
      }

      case 'FIRECRAWL_CRAWL': {
        this.gateScopeOnly(node, env);
        const url = interpolateVariables(String(cfg['url'] || ''), context);
        const limit = Number(cfg['limit']) || 5;
        const result = await this.mcpRegistry.executeTool('firecrawl_crawl', { url, limit }, { workspaceId, actingUserId: creatorId, timezone: env.timezone });
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { crawlResult: result },
        };
      }

      case 'FIRECRAWL_EXTRACT': {
        this.gateScopeOnly(node, env);
        const url = interpolateVariables(String(cfg['url'] || ''), context);
        const prompt = interpolateVariables(String(cfg['prompt'] || 'Extract structured data'), context);
        const result = await this.mcpRegistry.executeTool('firecrawl_extract', { url, prompt, schema: cfg['schema'] as any }, { workspaceId, actingUserId: creatorId, timezone: env.timezone });
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { extractedResult: result },
        };
      }

      // These used to report success with made-up output (a record count of
      // 1, a placeholder file URI) without doing anything. Nothing runs them
      // yet, so they say so instead of pretending.
      case 'DATABASE':
      case 'FILE':
      case 'IMAGE':
      case 'AUDIO':
        return {
          stepId: node.id,
          type: node.type,
          status: 'SKIPPED',
          output: {
            skipped: true,
            reason: `${node.type.toLowerCase()} steps are not executed yet, so this step did nothing.`,
          },
        };

      // 5. Human in the loop
      case 'HUMAN_APPROVAL':
      case 'HUMAN_INPUT': {
        const requiresApproval = cfg['required'] !== false;
        // What the approver reviews (and may edit) — usually the draft the
        // step before wrote, so "approve the report" shows the report.
        const reviewPath = typeof cfg['reviewPath'] === 'string' ? (cfg['reviewPath'] as string) : '';
        const reviewValue = reviewPath ? readPath(context, reviewPath) : undefined;
        const review = reviewPath
          ? {
              path: reviewPath,
              label: String(cfg['reviewLabel'] || 'Draft'),
              value: typeof reviewValue === 'string' ? reviewValue : reviewValue === undefined ? '' : JSON.stringify(reviewValue, null, 2),
            }
          : undefined;
        const action = String(cfg['action'] || 'Approve step execution');
        if (requiresApproval && env.mode === 'test') {
          return {
            stepId: node.id,
            type: node.type,
            status: 'SUCCESS',
            output: {
              approved: true,
              simulated: true,
              note: 'Test run — approval was simulated. A live run waits here for someone to approve.',
              ...(review ? { reviewed: review.value.slice(0, 4_000) } : {}),
            },
          };
        }
        if (requiresApproval) {
          const approval = await this.prisma.approvalRequest.create({
            data: {
              workspaceId,
              entityType: 'WORKFLOW',
              entityId: context['workflowId'] as string,
              // The step would continue as the workflow's creator, so they
              // (or an admin) are who may decide it — see ApprovalsService.
              requesterId: creatorId,
              executionId: env.runId,
              stepId: node.id,
              actionType: action,
              proposedPayload: { ...context, ...(review ? { __review: review } : {}) } as any,
              state: 'PENDING',
            },
          });
          const event: AiApprovalRequestedEvent = {
            workspaceId,
            approvalId: (approval as { id?: string } | undefined)?.id ?? '',
            runId: env.runId,
            workflowId: env.workflow.id,
            agentName: env.workflow.name,
            ownerId: creatorId,
            action,
            notify: env.profile?.notify.onApproval ?? true,
          };
          this.events?.emit(AppEvent.AiApprovalRequested, event);
          return {
            stepId: node.id,
            type: node.type,
            status: 'WAITING',
            output: { waitingForApproval: true, action, ...(review ? { reviewLabel: review.label } : {}) },
          };
        }
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { approved: true },
        };
      }

      default:
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { executed: true },
        };
    }
  }

  /**
   * Runs an `AGENT`/`AI_COWORKER` node through the real unified runtime
   * (`AIRuntimeService.executeTurn`) rather than fabricating a response — the
   * node's configured entity gets a real turn, with its own tools, memory,
   * and (if it calls a destructive integration action) its own approval
   * checkpoint, exactly as it would from a chat `@mention`.
   */
  private async runEntityNode(
    node: WorkflowNode,
    context: Record<string, unknown>,
    workspaceId: string,
    entityId: string,
    rawPrompt: string,
    env: RunEnv,
  ): Promise<WorkflowStepResult> {
    if (!entityId) {
      return {
        stepId: node.id,
        type: node.type,
        status: 'FAILED',
        output: { error: `No agent/coworker selected for node '${node.label || node.id}'.` },
      };
    }
    const promptText = interpolateVariables(
      rawPrompt || 'Execute your configured task using the current workflow context.',
      context,
    );
    // A test run hands the agent only tools that read, so nothing changes.
    const run = await this.aiRuntime.executeTurn(workspaceId, entityId, promptText, {
      ...(env.mode === 'test' ? { readOnly: true } : {}),
      // A coworker with no creator acts for the workflow's owner, never for nobody.
      ...(env.workflow.creatorId ? { requesterId: env.workflow.creatorId } : {}),
      source: 'workflow',
    });
    return {
      stepId: node.id,
      type: node.type,
      status: 'SUCCESS',
      output: {
        entityResponse: run.result,
        toolCalls: run.tools,
        tokensUsed: run.tokensUsed,
        ...(env.mode === 'test' ? { readOnly: true } : {}),
      },
    };
  }

  /**
   * An agent drawn on the Studio canvas (with its team, if it leads one).
   * It runs as the agent the canvas belongs to (`hostAgentId`), with the
   * run's shared team budget, so its delegations are recorded on this run.
   */
  private async runInlineAgentNode(
    node: WorkflowNode,
    context: Record<string, unknown>,
    env: RunEnv,
    spec: InlineAgentSpec,
  ): Promise<WorkflowStepResult> {
    const hostId = String(node.config['hostAgentId'] || '');
    if (!hostId) {
      return {
        stepId: node.id,
        type: node.type,
        status: 'FAILED',
        output: { error: `${spec.name} isn’t attached to a saved agent. Save the agent, then run it again.` },
      };
    }
    const prompt = interpolateVariables(String(node.config['goal'] || ''), context).trim() || 'Do your task using what the run has so far.';
    const run = await this.aiRuntime.executeTurn(env.workflow.workspaceId, hostId, prompt, {
      inlineAgent: spec,
      team: this.teamFor(env),
      ...(env.mode === 'test' ? { readOnly: true } : {}),
      ...(env.workflow.creatorId ? { requesterId: env.workflow.creatorId } : {}),
      source: 'workflow',
    });
    return {
      stepId: node.id,
      type: node.type,
      status: 'SUCCESS',
      output: {
        entityResponse: run.result,
        agent: spec.name,
        toolCalls: run.tools,
        tokensUsed: run.tokensUsed,
        ...(run.notices?.length ? { notices: run.notices } : {}),
        ...(env.mode === 'test' ? { readOnly: true } : {}),
      },
    };
  }

  /** A tool on one of the workspace's connected MCP servers. */
  private async runMcpServerNode(
    node: WorkflowNode,
    context: Record<string, unknown>,
    workspaceId: string,
    cfg: Record<string, unknown>,
  ): Promise<WorkflowStepResult> {
    let rawInput: unknown = cfg['input'] ?? {};
    if (typeof rawInput === 'string') {
      // Parse first, fill in `{{…}}` values after: a value containing quotes
      // must not be able to break (or rewrite) the JSON around it.
      try {
        rawInput = rawInput.trim() ? JSON.parse(rawInput) : {};
      } catch {
        throw new Error(`The input for '${node.label || node.id}' is not valid JSON.`);
      }
    }
    const input: Record<string, unknown> = {};
    for (const [key, value] of Object.entries((rawInput as Record<string, unknown>) ?? {})) {
      input[key] = typeof value === 'string' ? interpolateVariables(value, context) : value;
    }
    const out = await this.mcpServers.callTool(
      workspaceId,
      String(cfg['mcpConnectionId']),
      String(cfg['mcpToolName']),
      input,
    );
    return {
      stepId: node.id,
      type: node.type,
      status: out.isError ? 'FAILED' : 'SUCCESS',
      output: out.isError ? { error: out.text || 'The MCP tool reported an error.' } : { toolResult: out.text || out.content },
    };
  }

  /**
   * Runs a `TOOL`/`MCP`/`APP` node. Resolves `toolName` first against the
   * built-in MCP registry (`search_docs`, `create_task`, …), then — for the
   * canvas's `provider.actionId` convention (e.g. `slack.postMessage`) —
   * against that provider's connected integration actions. Fails openly
   * rather than fabricating a result when neither resolves, so a
   * misconfigured node is visible instead of silently "succeeding".
   */
  private async runToolNode(
    node: WorkflowNode,
    context: Record<string, unknown>,
    env: RunEnv,
    cfg: Record<string, unknown>,
  ): Promise<WorkflowStepResult> {
    const workspaceId = env.workflow.workspaceId;
    const creatorId = env.workflow.creatorId;
    const toolName = String(cfg['toolName'] || cfg['tool'] || '').trim();
    if (!toolName) {
      return {
        stepId: node.id,
        type: node.type,
        status: 'FAILED',
        output: { error: `No tool configured for node '${node.label || node.id}'.` },
      };
    }

    // The canvas edits the input as JSON text; API callers may send an object.
    let rawInput: unknown = cfg['input'] ?? {};
    if (typeof rawInput === 'string') {
      try {
        rawInput = rawInput.trim() ? JSON.parse(rawInput) : {};
      } catch {
        throw new Error(`The input for '${node.label || node.id}' is not valid JSON.`);
      }
    }
    const input: Record<string, unknown> = {};
    for (const [key, value] of Object.entries((rawInput as Record<string, unknown>) ?? {})) {
      input[key] = typeof value === 'string' ? interpolateVariables(value, context) : value;
    }

    if (this.mcpRegistry.getToolDefinitions().some((t) => t.name === toolName)) {
      const gated = this.gateStep(node, env);
      if (gated) return { ...gated, output: { ...(gated.output as object), input } };
      const output = await this.mcpRegistry.executeTool(toolName, input, {
        workspaceId,
        actingUserId: creatorId,
        timezone: env.timezone,
      });
      return { stepId: node.id, type: node.type, status: 'SUCCESS', output: { toolResult: output } };
    }

    const dotIndex = toolName.indexOf('.');
    if (dotIndex > 0) {
      const providerKey = toolName.slice(0, dotIndex).toUpperCase();
      const actionKey = toolName
        .slice(dotIndex + 1)
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');

      // This workspace's integration, or the workflow creator's own — never
      // another member's personal connection (it would be refused anyway).
      const integration = await this.prisma.externalIntegration.findFirst({
        where: {
          provider: providerKey,
          OR: [
            { workspaceId, scopeType: { not: 'USER' } },
            ...(creatorId ? [{ scopeType: 'USER', userId: creatorId }] : []),
          ],
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, status: true },
      });
      const appName = providerKey.charAt(0) + providerKey.slice(1).toLowerCase().replace(/_/g, ' ');
      if (!integration) {
        throw new Error(`${appName} isn’t connected. Connect ${appName} in Integrations, then run the agent again.`);
      }
      if (integration.status !== 'CONNECTED') {
        throw new Error(`The ${appName} connection is ${String(integration.status).toLowerCase()}. Reconnect ${appName} in Integrations to continue.`);
      }

      if (creatorId) {
        const actions = await this.integrations.getActions(integration.id, creatorId, workspaceId);
        const match = actions.find(
          (a) => a.id.toLowerCase().replace(/[^a-z0-9]/g, '') === actionKey,
        );
        if (match) {
          const gated = this.gateStep(node, env, match.permissionLevel as 'read' | 'write' | 'destructive');
          if (gated) return { ...gated, output: { ...(gated.output as object), input } };
          // Workflows gate sensitive steps with an explicit `HUMAN_APPROVAL`
          // node placed before this one in the graph, not an implicit check
          // per tool node — so a `requiresConfirmation` action here is
          // confirmed automatically rather than silently rejected.
          const result = await this.integrations.executeAction(
            integration.id,
            match.id,
            input,
            match.requiresConfirmation ? true : undefined,
            creatorId,
            workspaceId,
          );
          return { stepId: node.id, type: node.type, status: 'SUCCESS', output: { toolResult: result } };
        }
      }
    }

    return {
      stepId: node.id,
      type: node.type,
      status: 'FAILED',
      output: {
        error: `Tool '${toolName}' is not a registered built-in tool or a connected integration action.`,
      },
    };
  }

  /** The scope check alone, for steps whose test-run behaviour is handled elsewhere. */
  private gateScopeOnly(node: WorkflowNode, env: RunEnv): void {
    const scope = scopeForNode(node.type, node.config ?? {});
    if (scope && env.scopes && !env.scopes.has(scope)) throw new Error(missingPermissionMessage(scope));
  }

  private startNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] {
    const hasIncoming = new Set<string>();
    for (const edge of edges) {
      hasIncoming.add(edge.target);
    }
    return nodes
      .filter((n) => !hasIncoming.has(n.id) || n.type === 'START' || n.type === 'TRIGGER')
      .map((n) => n.id);
  }

  private parse<T>(raw: string | null | undefined, fallback: T): T {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }

  private withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    stepId: string,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Step '${stepId}' timed out after ${ms} ms.`));
      }, ms);
      promise
        .then((val) => {
          clearTimeout(timer);
          resolve(val);
        })
        .catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
    });
  }
}
