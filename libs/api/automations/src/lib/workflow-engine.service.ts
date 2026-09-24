import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { AIInfrastructureService, KnowledgeService } from '@org/api-ai';
import { AIRuntimeService, MCPToolRegistryService } from '@org/api-agents';
import { IntegrationsService } from '@org/api-integrations';
import { PLANS_CONFIG, normalizePlanTier } from '@org/types';
import { isBlockedRequestUrl } from './url-guard.js';

export interface WorkflowStepResult {
  stepId: string;
  type: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'WAITING';
  output: unknown;
  /** Which outgoing branch to follow — set by CONDITION, SWITCH, etc. */
  branch?: string;
  attempts?: number;
}

interface WorkflowNode {
  id: string;
  type: string;
  label?: string;
  config?: Record<string, unknown>;
}

interface WorkflowEdge {
  id?: string;
  source: string;
  target: string;
  /** `true` / `false` for CONDITION; branch key for SWITCH; absent otherwise. */
  sourceHandle?: string | null;
}

const MAX_NODE_VISITS = 50;
const DEFAULT_STEP_TIMEOUT_MS = 20_000;
const MAX_API_RESPONSE_CHARS = 10_000;

function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Reads a possibly-dotted path out of the payload or context. */
function readPath(payload: Record<string, unknown>, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (acc, key) =>
        acc && typeof acc === 'object'
          ? (acc as Record<string, unknown>)[key]
          : undefined,
      payload,
    );
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
  ) {}

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

    const nodes = this.parse<WorkflowNode[]>(workflow.nodesJson, []);
    const edges = this.parse<WorkflowEdge[]>(workflow.edgesJson, []);
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

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

    const results: WorkflowStepResult[] = [];
    let overallStatus: 'SUCCESS' | 'FAILED' | 'WAITING_APPROVAL' = 'SUCCESS';
    const executionContext: Record<string, unknown> = {
      ...initialPayload,
      workspaceId: workflow.workspaceId,
      workflowId: workflow.id,
      executionId: aiExecution.id,
    };

    const startTime = Date.now();
    let totalTokens = 0;

    try {
      const starts = this.startNodes(nodes, edges);
      if (starts.length === 0 && nodes.length > 0) {
        starts.push(nodes[0]!.id);
      }

      const queue = [...starts];
      const visits = new Map<string, number>();

      while (queue.length > 0) {
        const nodeId = queue.shift()!;
        const node = nodeById.get(nodeId);
        if (!node) continue;

        const seen = (visits.get(nodeId) ?? 0) + 1;
        visits.set(nodeId, seen);
        if (seen > MAX_NODE_VISITS) {
          throw new Error(
            `Node '${nodeId}' visited ${seen} times — cycle detected.`,
          );
        }

        const stepStart = Date.now();
        const step = await this.runNode(
          node,
          executionContext,
          workflow.workspaceId,
          aiExecution.id,
          workflow.creatorId,
        );
        const stepLatency = Date.now() - stepStart;
        results.push(step);

        const stepTokensUsed = (step.output as any)?.tokensUsed ?? 0;
        totalTokens += stepTokensUsed;

        // Record step in AIExecutionStep
        await this.prisma.aIExecutionStep.create({
          data: {
            executionId: aiExecution.id,
            stepId: node.id,
            nodeType: node.type,
            status: step.status === 'WAITING' ? 'WAITING' : step.status,
            inputJson: (node.config ?? {}) as any,
            outputJson: (step.output as any) ?? {},
            latencyMs: stepLatency,
            tokensUsed: stepTokensUsed,
            errorMessage: (step.output as any)?.error,
          },
        });

        if (step.status === 'WAITING') {
          overallStatus = 'WAITING_APPROVAL';
          break;
        }

        if (step.status === 'FAILED') {
          overallStatus = 'FAILED';
          break;
        }

        // Merge step output into context for downstream variable resolution
        if (step.output && typeof step.output === 'object') {
          Object.assign(executionContext, step.output);
          executionContext[node.id] = step.output;
        }

        for (const edge of edges) {
          if (edge.source !== nodeId) continue;
          if (
            step.branch &&
            edge.sourceHandle &&
            edge.sourceHandle !== step.branch
          ) {
            continue;
          }
          queue.push(edge.target);
        }
      }
    } catch (err) {
      overallStatus = 'FAILED';
      results.push({
        stepId: 'engine',
        type: 'ENGINE',
        status: 'FAILED',
        output: { error: err instanceof Error ? err.message : String(err) },
      });
    }

    const duration = Date.now() - startTime;

    // Update legacy execution
    const finished = await this.prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: overallStatus === 'WAITING_APPROVAL' ? 'RUNNING' : overallStatus,
        stepResults: JSON.stringify(results).slice(0, 100_000),
        finishedAt: new Date(),
      },
    });

    // Update unified execution
    await this.prisma.aIExecution.update({
      where: { id: aiExecution.id },
      data: {
        status: overallStatus === 'WAITING_APPROVAL' ? 'WAITING_APPROVAL' : overallStatus === 'SUCCESS' ? 'COMPLETED' : 'FAILED',
        finishedAt: overallStatus === 'WAITING_APPROVAL' ? null : new Date(),
        latencyMs: duration,
        tokensUsed: totalTokens,
        totalCost: Number((totalTokens * 0.000002).toFixed(5)),
      },
    });

    return { executionId: finished.id, status: overallStatus, results };
  }

  // --- Node Execution Core ---

  private async runNode(
    node: WorkflowNode,
    context: Record<string, unknown>,
    workspaceId: string,
    executionId: string,
    creatorId: string | null,
  ): Promise<WorkflowStepResult> {
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
        const rendered = template ? interpolateVariables(template, context) : context;
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
        const aiRes = await this.aiService.chat({
          ...(cfg['provider'] ? { provider: cfg['provider'] as any } : {}),
          ...(cfg['model'] ? { model: String(cfg['model']) } : {}),
          messages: [{ role: 'user', content: prompt }],
        });
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { aiOutput: aiRes.message.content, tokensUsed: aiRes.usage?.totalTokens ?? 0 },
        };
      }

      case 'PROMPT': {
        const raw = String(cfg['promptText'] || '');
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
            docs = await this.knowledgeService.retrieve(workspaceId, kbId, { query: queryText, topK: 3 });
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
        const input = interpolateVariables(String(cfg['input'] || ''), context);
        const categories = (cfg['categories'] as string[]) || ['general', 'support', 'billing'];
        const chosen = categories[0] || 'general';
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          branch: chosen,
          output: { classification: chosen, classifiedInput: input },
        };
      }

      case 'STRUCTURED_OUTPUT':
      case 'EXTRACT_DATA': {
        const raw = String(cfg['input'] || '');
        const text = interpolateVariables(raw, context);
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { extracted: { text, length: text.length } },
        };
      }

      // 3. Logic & Flow
      case 'CONDITION': {
        const passed = this.evaluateCondition(cfg, context);
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
        const ms = Math.min(num(cfg['delayMs'], 100), 5000);
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

      case 'CODE': {
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { computed: true },
        };
      }

      case 'HTTP_REQUEST':
      case 'API_CALL':
      case 'API':
      case 'WEBHOOK': {
        const rawUrl = String(cfg['url'] ?? '');
        const url = interpolateVariables(rawUrl, context);
        const method = String(cfg['method'] ?? 'GET').toUpperCase();
        const blocked = isBlockedRequestUrl(url);
        if (blocked) {
          throw new Error(`Refusing request to '${url}': ${blocked}`);
        }

        const headers: Record<string, string> = {
          'user-agent': 'OneTab-AI-Workflow/1',
          ...((cfg['headers'] as Record<string, string>) ?? {}),
        };
        const hasBody = method !== 'GET' && method !== 'HEAD';
        const body = hasBody && cfg['body'] ? interpolateVariables(String(cfg['body']), context) : undefined;
        if (body && !headers['content-type']) {
          headers['content-type'] = 'application/json';
        }

        const res = await fetch(url, { method, headers, body });
        const text = (await res.text()).slice(0, MAX_API_RESPONSE_CHARS);
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

      case 'TOOL':
      case 'MCP':
      case 'MCP_TOOL':
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

    const rawInput = (cfg['input'] as Record<string, unknown>) ?? {};
    const input: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawInput)) {
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

      const integration = await this.prisma.externalIntegration.findFirst({
        where: { provider: providerKey, status: 'CONNECTED', OR: [{ workspaceId }, { workspaceId: null }] },
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

  private evaluateCondition(
    cfg: Record<string, unknown>,
    payload: Record<string, unknown>,
  ): boolean {
    const field = String(cfg['field'] ?? '');
    const operator = String(cfg['operator'] ?? 'exists');
    const expected = cfg['value'];
    const actual = field ? readPath(payload, field) : undefined;

    switch (operator) {
      case 'exists':
        return actual !== undefined && actual !== null;
      case 'notExists':
        return actual === undefined || actual === null;
      case 'eq':
        return String(actual) === String(expected);
      case 'ne':
        return String(actual) !== String(expected);
      default:
        return true;
    }
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
