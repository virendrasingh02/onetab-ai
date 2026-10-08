import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ConnectorRegistryService } from '@org/api-integrations';
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

/** The schedule a compiled canvas graph starts with, if its trigger is a valid schedule. */
export function canvasSchedule(compiled: CompiledStudioGraph): { cron: string; timezone: string | null } | null {
  const trigger = compiled.nodes.find((n) => n.type === 'TRIGGER');
  const cron = trigger?.config['cron'];
  if (typeof cron !== 'string' || cron.split(/\s+/).length !== 5) return null;
  const timezone = trigger?.config['timezone'];
  return { cron, timezone: typeof timezone === 'string' && timezone ? timezone : null };
}

/** The app event a compiled canvas graph starts with, if its trigger is a connector trigger. */
export function canvasAppTrigger(
  compiled: CompiledStudioGraph,
): { provider: string; triggerId: string; input: Record<string, unknown> } | null {
  const trigger = compiled.nodes.find((n) => n.type === 'TRIGGER');
  const connector = trigger?.config['connector'] as { provider?: unknown; triggerId?: unknown; input?: unknown } | undefined;
  if (!connector || typeof connector.provider !== 'string' || typeof connector.triggerId !== 'string') return null;
  const input =
    connector.input && typeof connector.input === 'object' && !Array.isArray(connector.input)
      ? (connector.input as Record<string, unknown>)
      : {};
  return { provider: connector.provider, triggerId: connector.triggerId, input };
}

export interface CanvasAppTriggerStatus {
  provider: string;
  triggerId: string;
  label: string;
  lastPolledAt: string | null;
  lastFiredAt: string | null;
  lastError: string | null;
}

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
    @Optional() private readonly connectors?: ConnectorRegistryService,
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

  /**
   * Whether the agent runs by itself: its engine workflow is switched on and
   * its saved graph starts with a schedule or an app event. An app event also
   * reports how watching it is going (last check, last run, last problem).
   */
  async activation(workspaceId: string, agentId: string) {
    const agent = await this.load(workspaceId, agentId);
    const workflow = await this.prisma.automationWorkflow.findFirst({
      where: { workspaceId, triggerType: CANVAS_AGENT_TRIGGER, description: canvasMarker(agentId) },
      select: { id: true, isActive: true },
    });
    const compiled =
      agent.graphJson && isStudioGraph(agent.graphJson) ? compileStudioGraph(JSON.parse(agent.graphJson) as Record<string, unknown>) : null;
    const schedule = compiled ? canvasSchedule(compiled) : null;
    const app = compiled ? canvasAppTrigger(compiled) : null;
    let appTrigger: CanvasAppTriggerStatus | null = null;
    if (app) {
      const state = workflow?.id
        ? await this.prisma.connectorTriggerState.findUnique({
            where: { workflowId: workflow.id },
            select: { lastPolledAt: true, lastFiredAt: true, lastError: true },
          })
        : null;
      appTrigger = {
        provider: app.provider,
        triggerId: app.triggerId,
        label: this.triggerLabel(app.provider, app.triggerId),
        lastPolledAt: state?.lastPolledAt?.toISOString() ?? null,
        lastFiredAt: state?.lastFiredAt?.toISOString() ?? null,
        lastError: state?.lastError ?? null,
      };
    }
    return { active: !!workflow?.isActive, schedule, appTrigger };
  }

  /**
   * Switches scheduled runs on or off. Switching on needs a graph that
   * compiles without errors and starts with a schedule; the run acts with the
   * owner's access, like any live run.
   */
  async setActive(workspaceId: string, agentId: string, active: boolean) {
    const agent = await this.load(workspaceId, agentId);
    if (!active) {
      await this.prisma.automationWorkflow.updateMany({
        where: { workspaceId, triggerType: CANVAS_AGENT_TRIGGER, description: canvasMarker(agentId) },
        data: { isActive: false },
      });
      return { active: false, schedule: null, appTrigger: null };
    }
    const compiled = this.compile(agent.graphJson);
    const errors = compiled.issues.filter((i) => i.level === 'error');
    if (errors.length) {
      throw new BadRequestException({ code: 'GRAPH_INVALID', message: `It can’t run by itself yet: ${errors.map((e) => e.message).join(' ')}`, issues: compiled.issues });
    }
    const schedule = canvasSchedule(compiled);
    const app = canvasAppTrigger(compiled);
    if (!schedule && !app) {
      throw new BadRequestException({
        code: 'NO_SCHEDULE',
        message:
          'It has nothing to start it. Give its trigger a schedule (for example “every weekday at 9 AM”) or an app event (for example “New email”), then switch it on.',
      });
    }
    if (app && this.connectors && !this.knownTrigger(app.provider, app.triggerId)) {
      throw new BadRequestException({
        code: 'UNKNOWN_TRIGGER',
        message: `${this.appName(app.provider)} has no “${app.triggerId}” event. Pick another event on the trigger.`,
      });
    }
    const workflowId = await this.syncWorkflow(agent, compiled);
    await this.prisma.automationWorkflow.update({ where: { id: workflowId }, data: { isActive: true } });
    return {
      active: true,
      schedule,
      appTrigger: app
        ? {
            provider: app.provider,
            triggerId: app.triggerId,
            label: this.triggerLabel(app.provider, app.triggerId),
            lastPolledAt: null,
            lastFiredAt: null,
            lastError: null,
          }
        : null,
    };
  }

  /**
   * Switched-on canvas agents that start on an app event, compiled from their
   * current graph — what the connector-trigger poller watches.
   */
  async activeAppTriggers() {
    const workflows = await this.prisma.automationWorkflow.findMany({
      where: { isActive: true, archivedAt: null, triggerType: CANVAS_AGENT_TRIGGER },
      select: { id: true, description: true, workspaceId: true },
    });
    const out: Array<{
      workflowId: string;
      workspaceId: string;
      agent: { id: string; name: string; creatorId: string | null };
      trigger: { provider: string; triggerId: string; input: Record<string, unknown> };
      compiled: CompiledStudioGraph;
    }> = [];
    for (const workflow of workflows) {
      const agentId = workflow.description?.startsWith('canvas-agent:') ? workflow.description.slice('canvas-agent:'.length) : null;
      if (!agentId) continue;
      const agent = await this.prisma.aIAgent.findFirst({
        where: { id: agentId, type: 'agent' },
        select: { id: true, name: true, creatorId: true, graphJson: true },
      });
      if (!agent?.graphJson || !isStudioGraph(agent.graphJson)) continue;
      const compiled = compileStudioGraph(JSON.parse(agent.graphJson) as Record<string, unknown>);
      const trigger = canvasAppTrigger(compiled);
      if (!trigger || compiled.issues.some((i) => i.level === 'error')) continue;
      out.push({
        workflowId: workflow.id,
        workspaceId: workflow.workspaceId,
        agent: { id: agent.id, name: agent.name, creatorId: agent.creatorId },
        trigger,
        compiled,
      });
    }
    return out;
  }

  /** Refreshes the engine workflow from a compiled graph before a triggered run. */
  sync(agent: { id: string; name: string; creatorId: string | null }, compiled: CompiledStudioGraph): Promise<string> {
    return this.syncWorkflow(agent, compiled);
  }

  private knownTrigger(provider: string, triggerId: string): boolean {
    try {
      return !!this.connectors?.trigger(provider, triggerId);
    } catch {
      return false;
    }
  }

  private appName(provider: string): string {
    try {
      return this.connectors?.manifest(provider).name ?? provider;
    } catch {
      return provider.charAt(0) + provider.slice(1).toLowerCase().replace(/_/g, ' ');
    }
  }

  private triggerLabel(provider: string, triggerId: string): string {
    let label: string;
    try {
      label = this.connectors?.trigger(provider, triggerId)?.label ?? triggerId;
    } catch {
      label = triggerId;
    }
    return `${this.appName(provider)} · ${label}`;
  }

  /**
   * Switched-on canvas agents whose schedule is due now — read from the
   * agent's *current* saved graph, which is compiled and synced before it
   * runs, so a schedule or step edited since switching on is what runs.
   */
  async dueScheduledRuns(now: Date, isDue: (cron: string, at: Date, timezone: string | null) => boolean) {
    const workflows = await this.prisma.automationWorkflow.findMany({
      where: { isActive: true, archivedAt: null, triggerType: CANVAS_AGENT_TRIGGER },
      select: { id: true, description: true },
    });
    const due: Array<{ workflowId: string; agentId: string; name: string; limits: CompiledStudioGraph['limits'] }> = [];
    for (const workflow of workflows) {
      const agentId = workflow.description?.startsWith('canvas-agent:') ? workflow.description.slice('canvas-agent:'.length) : null;
      if (!agentId) continue;
      const agent = await this.prisma.aIAgent.findFirst({ where: { id: agentId, type: 'agent' }, select: { id: true, name: true, creatorId: true, graphJson: true, workspaceId: true } });
      if (!agent?.graphJson || !isStudioGraph(agent.graphJson)) continue;
      const compiled = compileStudioGraph(JSON.parse(agent.graphJson) as Record<string, unknown>);
      const schedule = canvasSchedule(compiled);
      if (!schedule || !isDue(schedule.cron, now, schedule.timezone)) continue;
      if (compiled.issues.some((i) => i.level === 'error')) continue;
      await this.syncWorkflow(agent, compiled);
      due.push({ workflowId: workflow.id, agentId, name: agent.name, limits: compiled.limits });
    }
    return due;
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
    // `isActive` is "runs by itself on its schedule" — only `setActive` turns
    // it on; a test or manual run never does.
    const data = {
      name: agent.name,
      nodesJson: JSON.stringify(nodes),
      edgesJson: JSON.stringify(compiled.edges),
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
        isActive: false,
      },
      select: { id: true },
    });
    return created.id;
  }
}
