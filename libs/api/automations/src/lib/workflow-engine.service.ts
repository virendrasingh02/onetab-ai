import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { safeFetch } from '@org/api-common';
import {
  AICredentialService,
  AIInfrastructureService,
  KnowledgeService,
  MCPService,
  ModelResolverService,
} from '@org/api-ai';
import { AIRuntimeService, MCPToolRegistryService } from '@org/api-agents';
import { IntegrationsService } from '@org/api-integrations';
import { PLANS_CONFIG, normalizePlanTier, type AIChatMessage } from '@org/types';
import {
  conditionSpecFrom,
  evaluateCondition,
  normalizeWorkflowNodes,
  readPath,
  type WorkflowNode,
} from './workflow-graph.js';

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
  /** `true` / `false` for CONDITION; branch key for SWITCH; absent otherwise. */
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
const DEFAULT_STEP_TIMEOUT_MS = 20_000;
const MAX_API_RESPONSE_CHARS = 10_000;

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
    const { provider, model } = this.modelResolver.resolve({
      ...(cfg['provider'] ? { requestedProvider: cfg['provider'] as any } : {}),
      ...(cfg['model'] ? { requestedModel: String(cfg['model']) } : {}),
    });
    const cred = await this.credentials.resolveCredential(provider, { workspaceId });
    const temperature = Number(cfg['temperature']);
    return this.aiService.chat({
      provider,
      model,
      apiKey: cred.apiKey,
      baseUrl: cred.baseUrl,
      messages,
      ...(Number.isFinite(temperature) ? { temperature } : {}),
    });
  }

  /**
   * Executes a workflow with support for all 35+ node types, universal variables,
   * human-in-the-loop approvals, branching, and execution telemetry persistence.
   */
  async executeWorkflow(
    workflowId: string,
    initialPayload: Record<string, unknown> = {},
  ) {
    const workflow = await this.prisma.automationWorkflow.findUniqueOrThrow({
      where: { id: workflowId },
    });
    this.logger.log(
      `Executing automation workflow '${workflow.name}' (${workflow.id})`,
    );

    // Enforce Plan, Trial, Concurrency & AI Credit limits
    const sub = await this.prisma.workspaceSubscription.findUnique({
      where: { workspaceId: workflow.workspaceId },
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

    // Check shared credit balance
    const creditAccount = await this.prisma.creditAccount.findUnique({
      where: { workspaceId: workflow.workspaceId },
    });
    if (creditAccount && creditAccount.balance <= 0) {
      throw new BadRequestException({
        code: 'CREDIT_LIMIT_REACHED',
        message:
          'Your shared AI credit balance is depleted. Please top up your credits to continue running workflows.',
      });
    }

    // Check concurrent executions limit
    const maxConcurrent = planConfig.machineLimits.concurrentExecutions;
    if (maxConcurrent !== -1) {
      const runningCount = await this.prisma.workflowExecution.count({
        where: {
          workflow: { workspaceId: workflow.workspaceId },
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

    // Check monthly requests quota
    const maxMonthly = planConfig.machineLimits.requestsPerMonth;
    if (maxMonthly !== -1) {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const monthlyCount = await this.prisma.workflowExecution.count({
        where: {
          workflow: { workspaceId: workflow.workspaceId },
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

    const nodes = normalizeWorkflowNodes(this.parse<unknown>(workflow.nodesJson, []));
    const edges = this.parse<WorkflowEdge[]>(workflow.edgesJson, []);

    // 1. Create legacy WorkflowExecution row for backwards compatibility
    const execution = await this.prisma.workflowExecution.create({
      data: {
        workflowId: workflow.id,
        status: 'RUNNING',
        triggerPayload: JSON.stringify(initialPayload).slice(0, 20_000),
        stepResults: '[]',
      },
    });

    // 2. Create unified AIExecution row
    const aiExecution = await this.prisma.aIExecution.create({
      data: {
        workspaceId: workflow.workspaceId,
        entityType: 'WORKFLOW',
        entityId: workflow.id,
        workflowId: workflow.id,
        status: 'RUNNING',
        stateJson: initialPayload as any,
      },
    });

    const executionContext: Record<string, unknown> = {
      ...initialPayload,
      workspaceId: workflow.workspaceId,
      workflowId: workflow.id,
      executionId: aiExecution.id,
      // Lets a run paused at an approval find its legacy row again on resume.
      [RUN_ID_KEY]: execution.id,
    };

    const starts = this.startNodes(nodes, edges);
    if (starts.length === 0 && nodes.length > 0) starts.push(nodes[0]!.id);

    const startTime = Date.now();
    const outcome = await this.runGraph(workflow, nodes, edges, starts, executionContext, aiExecution.id);
    await this.finishRun(execution.id, aiExecution.id, outcome.status, outcome.results, outcome.tokens, Date.now() - startTime);

    // `runId` is the unified run record the AI Workspace's Runs view shows.
    return { executionId: execution.id, runId: aiExecution.id, status: outcome.status, results: outcome.results };
  }

  /**
   * Continues a run that paused at a HUMAN_APPROVAL / HUMAN_INPUT step once a
   * person decides it. Approved: execution continues from the step's
   * successors with the context as it was when it paused (plus the decision).
   * Rejected: the run is closed as failed. Before this, approving marked the
   * run "completed" and every step after the approval silently never ran.
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
    const legacyRunId = typeof context[RUN_ID_KEY] === 'string' ? (context[RUN_ID_KEY] as string) : null;
    const legacy = legacyRunId
      ? await this.prisma.workflowExecution.findUnique({ where: { id: legacyRunId } })
      : null;
    const previous = this.parse<WorkflowStepResult[]>(legacy?.stepResults, []);

    const decisionStep: WorkflowStepResult = {
      stepId: event.stepId,
      type: 'HUMAN_APPROVAL',
      status: event.decision === 'APPROVED' ? 'SUCCESS' : 'FAILED',
      output: { decision: event.decision, approverId: event.approverId, comment: event.comment },
    };
    // Settle the approval step that has been waiting, so the trace shows one
    // row per step with its outcome rather than a waiting row and a second one.
    const settled = await this.prisma.aIExecutionStep.updateMany({
      where: { executionId: aiExecution.id, stepId: event.stepId, status: 'WAITING' },
      data: { status: decisionStep.status, outputJson: decisionStep.output as any },
    });
    if (settled.count === 0) {
      await this.prisma.aIExecutionStep.create({
        data: {
          executionId: aiExecution.id,
          stepId: event.stepId,
          nodeType: 'HUMAN_APPROVAL',
          status: decisionStep.status,
          outputJson: decisionStep.output as any,
        },
      });
    }

    if (event.decision === 'REJECTED') {
      await this.finishRun(legacyRunId, aiExecution.id, 'FAILED', [...previous, decisionStep], aiExecution.tokensUsed, aiExecution.latencyMs);
      return { status: 'FAILED' as const };
    }

    const nodes = normalizeWorkflowNodes(this.parse<unknown>(workflow.nodesJson, []));
    const edges = this.parse<WorkflowEdge[]>(workflow.edgesJson, []);
    context['approval'] = { approverId: event.approverId, comment: event.comment };
    const next = edges.filter((e) => e.source === event.stepId).map((e) => e.target);

    await this.prisma.aIExecution.update({ where: { id: aiExecution.id }, data: { status: 'RUNNING' } });
    const startTime = Date.now();
    const outcome = await this.runGraph(workflow, nodes, edges, next, context, aiExecution.id);
    await this.finishRun(
      legacyRunId,
      aiExecution.id,
      outcome.status,
      [...previous, decisionStep, ...outcome.results],
      aiExecution.tokensUsed + outcome.tokens,
      aiExecution.latencyMs + (Date.now() - startTime),
    );
    return { status: outcome.status };
  }

  /**
   * Walks the graph from `startIds`, running each reachable step once per
   * visit and following only the branch a CONDITION/SWITCH/CLASSIFIER chose.
   * Stops at the first failure or at a step that waits for a person.
   */
  private async runGraph(
    workflow: { id: string; workspaceId: string; creatorId: string | null },
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    startIds: string[],
    executionContext: Record<string, unknown>,
    aiExecutionId: string,
  ): Promise<{ status: 'SUCCESS' | 'FAILED' | 'WAITING_APPROVAL'; results: WorkflowStepResult[]; tokens: number }> {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const results: WorkflowStepResult[] = [];
    let status: 'SUCCESS' | 'FAILED' | 'WAITING_APPROVAL' = 'SUCCESS';
    let tokens = 0;

    try {
      const queue = [...startIds];
      // Each step runs once per run: a node two branches lead to (a MERGE, or
      // any shared downstream step) used to run once per incoming branch.
      const done = new Set<string>();
      const activated = new Set<string>(startIds);
      const deferrals = new Map<string, number>();

      while (queue.length > 0) {
        const nodeId = queue.shift()!;
        const node = nodeById.get(nodeId);
        if (!node || done.has(nodeId)) continue;

        // A MERGE (join) waits until every branch that was started and leads
        // into it has finished, so it sees all of their outputs.
        if (node.type === 'MERGE') {
          const pending = edges.some(
            (e) => e.target === nodeId && activated.has(e.source) && !done.has(e.source),
          );
          const waited = (deferrals.get(nodeId) ?? 0) + 1;
          if (pending && waited <= MAX_NODE_VISITS) {
            deferrals.set(nodeId, waited);
            queue.push(nodeId);
            continue;
          }
        }
        done.add(nodeId);

        const stepStart = Date.now();
        const step = await this.runNode(node, executionContext, workflow.workspaceId, aiExecutionId, workflow.creatorId);
        const stepLatency = Date.now() - stepStart;
        results.push(step);

        const stepTokensUsed = (step.output as any)?.tokensUsed ?? 0;
        tokens += stepTokensUsed;

        await this.prisma.aIExecutionStep.create({
          data: {
            executionId: aiExecutionId,
            stepId: node.id,
            nodeType: node.type,
            status: step.status,
            inputJson: (node.config ?? {}) as any,
            outputJson: (step.output as any) ?? {},
            latencyMs: stepLatency,
            tokensUsed: stepTokensUsed,
            errorMessage: (step.output as any)?.error,
          },
        });

        if (step.status === 'WAITING') {
          status = 'WAITING_APPROVAL';
          break;
        }
        if (step.status === 'FAILED') {
          status = 'FAILED';
          break;
        }

        // Merge step output into context for downstream variable resolution
        if (step.output && typeof step.output === 'object') {
          Object.assign(executionContext, step.output);
          executionContext[node.id] = step.output;
        }

        for (const edge of edges) {
          if (edge.source !== nodeId) continue;
          if (step.branch && edge.sourceHandle && edge.sourceHandle !== step.branch) continue;
          activated.add(edge.target);
          queue.push(edge.target);
        }
      }
    } catch (err) {
      status = 'FAILED';
      results.push({
        stepId: 'engine',
        type: 'ENGINE',
        status: 'FAILED',
        output: { error: err instanceof Error ? err.message : String(err) },
      });
    }

    return { status, results, tokens };
  }

  /** Writes the outcome to both run records (legacy and unified). */
  private async finishRun(
    legacyRunId: string | null,
    aiExecutionId: string,
    status: 'SUCCESS' | 'FAILED' | 'WAITING_APPROVAL',
    results: WorkflowStepResult[],
    totalTokens: number,
    duration: number,
  ) {
    if (legacyRunId) {
      await this.prisma.workflowExecution.update({
        where: { id: legacyRunId },
        data: {
          status: status === 'WAITING_APPROVAL' ? 'RUNNING' : status,
          stepResults: JSON.stringify(results).slice(0, 100_000),
          finishedAt: new Date(),
        },
      });
    }
    await this.prisma.aIExecution.update({
      where: { id: aiExecutionId },
      data: {
        status: status === 'WAITING_APPROVAL' ? 'WAITING_APPROVAL' : status === 'SUCCESS' ? 'COMPLETED' : 'FAILED',
        finishedAt: status === 'WAITING_APPROVAL' ? null : new Date(),
        latencyMs: duration,
        tokensUsed: totalTokens,
        totalCost: Number((totalTokens * 0.000002).toFixed(5)),
        ...(status === 'FAILED'
          ? { errorsJson: (results.filter((r) => r.status === 'FAILED').map((r) => ({ stepId: r.stepId, output: r.output })) as any) }
          : {}),
      },
    });
  }

  // --- Node Execution Core ---

  private async runNode(
    node: WorkflowNode,
    context: Record<string, unknown>,
    workspaceId: string,
    executionId: string,
    creatorId: string | null,
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
    const timeoutMs = num(cfg['timeoutMs'], DEFAULT_STEP_TIMEOUT_MS);

    let lastError = '';
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        const result = await this.withTimeout(
          this.executeNodeStep(node, context, workspaceId, executionId, creatorId),
          timeoutMs,
          node.id,
        );
        if (attempt > 1) {
          result.attempts = attempt;
        }
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Step '${node.id}' attempt ${attempt}/${retries + 1} failed: ${lastError}`,
        );
        if (attempt <= retries) {
          await new Promise((r) => setTimeout(r, 100 * attempt));
        }
      }
    }

    return {
      stepId: node.id,
      type: node.type,
      status: 'FAILED',
      output: { error: lastError },
      attempts: retries + 1,
    };
  }

  private async executeNodeStep(
    node: WorkflowNode,
    context: Record<string, unknown>,
    workspaceId: string,
    executionId: string,
    creatorId: string | null,
  ): Promise<WorkflowStepResult> {
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
          output: { aiOutput: aiRes.message.content, tokensUsed: aiRes.usage?.totalTokens ?? 0 },
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
        return this.runEntityNode(
          node,
          context,
          workspaceId,
          String(cfg['agentId'] || cfg['entityId'] || ''),
          String(cfg['goal'] || cfg['prompt'] || ''),
        );

      case 'AI_COWORKER':
        return this.runEntityNode(
          node,
          context,
          workspaceId,
          String(cfg['coworkerId'] || cfg['entityId'] || ''),
          String(cfg['task'] || cfg['prompt'] || ''),
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
      case 'MERGE':
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { merged: true },
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
          return this.runMcpServerNode(node, context, workspaceId, mcpCfg);
        }
        return this.runToolNode(node, context, workspaceId, creatorId, cfg);
      }

      case 'TOOL':
      case 'APP':
        return this.runToolNode(node, context, workspaceId, creatorId, cfg);

      case 'END':
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { completed: true, ...context },
        };

      case 'FIRECRAWL_SEARCH': {
        const query = interpolateVariables(String(cfg['query'] || cfg['prompt'] || ''), context);
        const limit = Number(cfg['limit']) || 5;
        const result = await this.mcpRegistry.executeTool('firecrawl_search', { query, limit }, { workspaceId, actingUserId: creatorId });
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { searchResult: result },
        };
      }

      case 'FIRECRAWL_SCRAPE': {
        const url = interpolateVariables(String(cfg['url'] || ''), context);
        const result = await this.mcpRegistry.executeTool('firecrawl_scrape', { url }, { workspaceId, actingUserId: creatorId });
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { scrapeResult: result },
        };
      }

      case 'FIRECRAWL_CRAWL': {
        const url = interpolateVariables(String(cfg['url'] || ''), context);
        const limit = Number(cfg['limit']) || 5;
        const result = await this.mcpRegistry.executeTool('firecrawl_crawl', { url, limit }, { workspaceId, actingUserId: creatorId });
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { crawlResult: result },
        };
      }

      case 'FIRECRAWL_EXTRACT': {
        const url = interpolateVariables(String(cfg['url'] || ''), context);
        const prompt = interpolateVariables(String(cfg['prompt'] || 'Extract structured data'), context);
        const result = await this.mcpRegistry.executeTool('firecrawl_extract', { url, prompt, schema: cfg['schema'] as any }, { workspaceId, actingUserId: creatorId });
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { extractedResult: result },
        };
      }

      case 'DATABASE': {
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { dbRecordCount: 1 },
        };
      }

      case 'FILE':
      case 'IMAGE':
      case 'AUDIO':
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { fileUri: String(cfg['uri'] || 'file://data') },
        };

      // 5. Human in the loop
      case 'HUMAN_APPROVAL':
      case 'HUMAN_INPUT': {
        const requiresApproval = cfg['required'] !== false;
        if (requiresApproval) {
          await this.prisma.approvalRequest.create({
            data: {
              workspaceId,
              entityType: 'WORKFLOW',
              entityId: context['workflowId'] as string,
              // The step would continue as the workflow's creator, so they
              // (or an admin) are who may decide it — see ApprovalsService.
              requesterId: creatorId,
              executionId,
              stepId: node.id,
              actionType: String(cfg['action'] || 'Approve step execution'),
              proposedPayload: context as any,
              state: 'PENDING',
            },
          });
          return {
            stepId: node.id,
            type: node.type,
            status: 'WAITING',
            output: { waitingForApproval: true },
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
    const run = await this.aiRuntime.executeTurn(workspaceId, entityId, promptText, {});
    return {
      stepId: node.id,
      type: node.type,
      status: 'SUCCESS',
      output: { entityResponse: run.result, toolCalls: run.tools },
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
    workspaceId: string,
    creatorId: string | null,
    cfg: Record<string, unknown>,
  ): Promise<WorkflowStepResult> {
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
      const output = await this.mcpRegistry.executeTool(toolName, input, {
        workspaceId,
        actingUserId: creatorId,
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
          status: 'CONNECTED',
          OR: [
            { workspaceId, scopeType: { not: 'USER' } },
            ...(creatorId ? [{ scopeType: 'USER', userId: creatorId }] : []),
          ],
        },
        select: { id: true },
      });

      if (integration && creatorId) {
        const actions = await this.integrations.getActions(integration.id, creatorId, workspaceId);
        const match = actions.find(
          (a) => a.id.toLowerCase().replace(/[^a-z0-9]/g, '') === actionKey,
        );
        if (match) {
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
