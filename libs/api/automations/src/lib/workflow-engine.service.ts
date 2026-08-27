import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';
import { AIInfrastructureService } from '@org/api-ai';
import { isBlockedRequestUrl } from './url-guard.js';

export interface WorkflowStepResult {
  stepId: string;
  type: string;
  status: 'SUCCESS' | 'FAILED' | 'SKIPPED';
  output: unknown;
  /** Which outgoing branch to follow — set by CONDITION, ignored otherwise. */
  branch?: 'true' | 'false';
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
  /** `true` / `false` for the two sides of a CONDITION; absent otherwise. */
  sourceHandle?: string | null;
}

/** A node cannot be visited more times than this in one run — cheap cycle guard. */
const MAX_NODE_VISITS = 50;
const DEFAULT_STEP_TIMEOUT_MS = 15_000;
const MAX_API_RESPONSE_CHARS = 4_000;

function num(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** Reads a possibly-dotted path out of the trigger payload. */
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

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AIInfrastructureService,
  ) {}

  /**
   * Runs a workflow as a directed graph.
   *
   * Execution starts at the trigger node (or any node with no incoming edge),
   * runs each node, then follows its outgoing edges — honouring a CONDITION's
   * `true` / `false` branch via `edge.sourceHandle`. A `RUNNING` row is written
   * before the first step and updated at the end, so an in-flight or crashed
   * run is visible rather than absent. Steps can declare `config.retries` and
   * `config.timeoutMs`; a step that still fails stops that branch and fails the
   * run.
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

    const nodes = this.parse<WorkflowNode[]>(workflow.nodesJson, []);
    const edges = this.parse<WorkflowEdge[]>(workflow.edgesJson, []);
    const nodeById = new Map(nodes.map((n) => [n.id, n]));

    const execution = await this.prisma.workflowExecution.create({
      data: {
        workflowId: workflow.id,
        status: 'RUNNING',
        triggerPayload: JSON.stringify(initialPayload).slice(0, 20_000),
        stepResults: '[]',
      },
    });

    const results: WorkflowStepResult[] = [];
    let overallStatus: 'SUCCESS' | 'FAILED' = 'SUCCESS';

    try {
      const starts = this.startNodes(nodes, edges);
      if (starts.length === 0 && nodes.length > 0) {
        // No graph structure — fall back to running the nodes in array order.
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
            `Node '${nodeId}' visited ${seen} times — aborting to avoid a loop.`,
          );
        }

        const step = await this.runNode(node, initialPayload);
        results.push(step);

        if (step.status === 'FAILED') {
          overallStatus = 'FAILED';
          break;
        }

        for (const edge of edges) {
          if (edge.source !== nodeId) continue;
          // A CONDITION only continues down the branch it evaluated to.
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

    const finished = await this.prisma.workflowExecution.update({
      where: { id: execution.id },
      data: {
        status: overallStatus,
        stepResults: JSON.stringify(results).slice(0, 100_000),
        finishedAt: new Date(),
      },
    });

    return { executionId: finished.id, status: overallStatus, results };
  }

  // --- node execution ------------------------------------------------------

  private async runNode(
    node: WorkflowNode,
    payload: Record<string, unknown>,
  ): Promise<WorkflowStepResult> {
    const cfg = node.config ?? {};
    const retries = Math.min(num(cfg['retries'], 0), 5);
    const timeoutMs = num(cfg['timeoutMs'], DEFAULT_STEP_TIMEOUT_MS);

    let lastError = '';
    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        const result = await this.withTimeout(
          this.executeNodeStep(node, payload),
          timeoutMs,
          node.id,
        );
        return { ...result, attempts: attempt };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt <= retries) {
          await new Promise((r) => setTimeout(r, 500 * attempt));
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
    payload: Record<string, unknown>,
  ): Promise<WorkflowStepResult> {
    const cfg = node.config ?? {};
    this.logger.log(`Running step node ${node.id} [${node.type}]`);

    switch (node.type) {
      case 'TRIGGER':
      case 'START':
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { payload },
        };

      case 'CONDITION': {
        const passed = this.evaluateCondition(cfg, payload);
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          branch: passed ? 'true' : 'false',
          output: {
            conditionPassed: passed,
            field: cfg['field'] ?? null,
            operator: cfg['operator'] ?? 'exists',
          },
        };
      }

      case 'API_CALL':
      case 'WEBHOOK': {
        const url = String(cfg['url'] ?? '');
        const method =
          node.type === 'WEBHOOK'
            ? 'POST'
            : String(cfg['method'] ?? 'GET').toUpperCase();
        const blocked = isBlockedRequestUrl(url);
        if (blocked) {
          throw new Error(`Refusing request to '${url}': ${blocked}`);
        }

        const headers: Record<string, string> = {
          'user-agent': 'OneTab-AI-Workflow/1',
          ...((cfg['headers'] as Record<string, string>) ?? {}),
        };
        const hasBody = method !== 'GET' && method !== 'HEAD';
        const body =
          hasBody && cfg['body'] !== undefined
            ? typeof cfg['body'] === 'string'
              ? (cfg['body'] as string)
              : JSON.stringify(cfg['body'])
            : node.type === 'WEBHOOK'
              ? JSON.stringify(payload)
              : undefined;
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

      case 'AI_ACTION': {
        const prompt =
          (cfg['prompt'] as string | undefined) ??
          `Summarize workflow payload: ${JSON.stringify(payload)}`;
        const aiRes = await this.aiService.chat({
          ...(cfg['provider']
            ? { provider: cfg['provider'] as never }
            : {}),
          ...(cfg['model'] ? { model: String(cfg['model']) } : {}),
          messages: [{ role: 'user', content: prompt }],
        });
        return {
          stepId: node.id,
          type: node.type,
          status: 'SUCCESS',
          output: { aiOutput: aiRes.message.content },
        };
      }

      default:
        // An unknown node type is a workflow authoring error — surface it as a
        // failure rather than a silent pass.
        throw new Error(`Unknown workflow node type '${node.type}'.`);
    }
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
      case 'gt':
        return Number(actual) > Number(expected);
      case 'gte':
        return Number(actual) >= Number(expected);
      case 'lt':
        return Number(actual) < Number(expected);
      case 'lte':
        return Number(actual) <= Number(expected);
      case 'contains':
        return String(actual).includes(String(expected));
      case 'truthy':
        return Boolean(actual);
      case 'falsy':
        return !actual;
      default:
        return false;
    }
  }

  // --- graph helpers -----------------------------------------------------

  private startNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]): string[] {
    const explicit = nodes
      .filter((n) => n.type === 'TRIGGER' || n.type === 'START')
      .map((n) => n.id);
    if (explicit.length > 0) return explicit;

    const hasIncoming = new Set(edges.map((e) => e.target));
    return nodes.filter((n) => !hasIncoming.has(n.id)).map((n) => n.id);
  }

  private parse<T>(json: string | null, fallback: T): T {
    try {
      const parsed = JSON.parse(json || 'null');
      return parsed == null ? fallback : (parsed as T);
    } catch {
      return fallback;
    }
  }

  private async withTimeout<T>(
    work: Promise<T>,
    ms: number,
    nodeId: string,
  ): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`Step '${nodeId}' timed out after ${ms}ms.`)),
        ms,
      );
    });
    try {
      return await Promise.race([work, timeout]);
    } finally {
      clearTimeout(timer!);
    }
  }
}
