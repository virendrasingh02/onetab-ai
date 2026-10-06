import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@org/database';
import {
  CANVAS_AGENT_TRIGGER,
  compileStudioGraph,
  isStudioGraph,
  type CompiledStudioGraph,
  type StudioGraphIssue,
} from '@org/types';
import type { RunCanvasAgentInput } from '@org/validation';
import { WorkflowEngineService } from '../workflow-engine.service.js';

/** How a canvas agent's engine workflow is found again: an exact marker, never a guess. */
const canvasMarker = (agentId: string) => `canvas-agent:${agentId}`;

/**
 * Runs agents drawn on the Studio canvas (`apps/ai-agent-studio`).
 *
 * The canvas graph is compiled (`compileStudioGraph`) into an engine
 * workflow that belongs to the agent — one per agent, refreshed on every
 * run — and started like any workflow. So a canvas agent gets the engine's
 * live updates, approvals, pause / resume / cancel, retries, limits and the
 * Runs view, and its agent teams record their tasks and messages on the run.
 */
@Injectable()
export class CanvasAgentRunService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: WorkflowEngineService,
  ) {}

  /** What would run, and what's wrong with it — for a saved graph or one being edited. */
  async validate(workspaceId: string, agentId: string, graphJson?: string): Promise<{ valid: boolean; issues: StudioGraphIssue[] }> {
    const agent = await this.load(workspaceId, agentId);
    const compiled = this.compile(graphJson ?? agent.graphJson);
    return { valid: !compiled.issues.some((i) => i.level === 'error'), issues: compiled.issues };
  }

  async run(workspaceId: string, agentId: string, userId: string, body: RunCanvasAgentInput) {
    const agent = await this.load(workspaceId, agentId);
    const compiled = this.compile(agent.graphJson);
    const errors = compiled.issues.filter((i) => i.level === 'error');
    if (errors.length) {
      throw new BadRequestException({
        code: 'GRAPH_INVALID',
        message: `Fix ${errors.length === 1 ? 'this' : `these ${errors.length} problems`} before running: ${errors.map((e) => e.message).join(' ')}`,
        issues: compiled.issues,
      });
    }
    const workflowId = await this.syncWorkflow(agent, compiled);
    const payload = { ...(body.input ?? {}), ...(body.message ? { message: body.message } : {}) };
    const started = await this.engine.startWorkflow(workflowId, payload, {
      mode: body.mode,
      startedBy: 'person',
      userId,
      limits: compiled.limits,
    });
    return { runId: started.runId, status: started.status, workflowId, issues: compiled.issues };
  }

  /** The canvas agent's recent runs, newest first. */
  async listRuns(workspaceId: string, agentId: string) {
    await this.load(workspaceId, agentId);
    const workflow = await this.prisma.automationWorkflow.findFirst({
      where: { workspaceId, triggerType: CANVAS_AGENT_TRIGGER, description: canvasMarker(agentId) },
      select: { id: true },
    });
    if (!workflow) return [];
    return this.prisma.aIExecution.findMany({
      where: { workspaceId, workflowId: workflow.id },
      orderBy: { startedAt: 'desc' },
      take: 25,
      select: { id: true, status: true, startedAt: true, finishedAt: true, latencyMs: true, tokensUsed: true, totalCost: true, stateJson: true },
    });
  }

  /** One run with everything that happened in it: steps, the team's tasks and messages, approvals. */
  async getRun(workspaceId: string, runId: string) {
    const run = await this.prisma.aIExecution.findFirst({
      where: { id: runId, workspaceId },
      include: {
        steps: { orderBy: { startedAt: 'asc' } },
        agentTasks: { orderBy: { createdAt: 'asc' } },
        agentMessages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!run) throw new NotFoundException('Run not found.');
    const approvals = await this.prisma.approvalRequest.findMany({
      where: { workspaceId, executionId: runId },
      select: { id: true, stepId: true, actionType: true, state: true, createdAt: true, respondedAt: true, comment: true },
      orderBy: { createdAt: 'asc' },
    });
    return { ...run, approvals };
  }

  private async load(workspaceId: string, agentId: string) {
    const agent = await this.prisma.aIAgent.findFirst({
      where: { id: agentId, workspaceId, type: 'agent' },
      select: { id: true, name: true, creatorId: true, graphJson: true },
    });
    if (!agent) throw new NotFoundException('Agent not found.');
    return agent;
  }

  private compile(graphJson: string | null | undefined): CompiledStudioGraph {
    if (!graphJson || !isStudioGraph(graphJson)) {
      throw new BadRequestException({
        code: 'NOT_A_CANVAS_GRAPH',
        message: 'This agent has no Studio canvas to run. Open it in the Studio and add steps first.',
      });
    }
    return compileStudioGraph(JSON.parse(graphJson) as Record<string, unknown>);
  }

  /** Creates or refreshes the engine workflow the canvas compiles into. */
  private async syncWorkflow(
    agent: { id: string; name: string; creatorId: string | null },
    compiled: CompiledStudioGraph,
  ): Promise<string> {
    // Agent nodes run as this agent: its owner, credits and logs.
    const nodes = compiled.nodes.map((n) => (n.type === 'AGENT' ? { ...n, config: { ...n.config, hostAgentId: agent.id } } : n));
    const data = {
      name: agent.name,
      nodesJson: JSON.stringify(nodes),
      edgesJson: JSON.stringify(compiled.edges),
      isActive: true,
    };
    const existing = await this.prisma.automationWorkflow.findFirst({
      where: { triggerType: CANVAS_AGENT_TRIGGER, description: canvasMarker(agent.id) },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.automationWorkflow.update({ where: { id: existing.id }, data });
      return existing.id;
    }
    const workspace = await this.prisma.aIAgent.findUniqueOrThrow({ where: { id: agent.id }, select: { workspaceId: true } });
    const created = await this.prisma.automationWorkflow.create({
      data: {
        ...data,
        workspaceId: workspace.workspaceId,
        creatorId: agent.creatorId,
        triggerType: CANVAS_AGENT_TRIGGER,
        description: canvasMarker(agent.id),
      },
      select: { id: true },
    });
    return created.id;
  }
}
