import { randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException, Optional, UnauthorizedException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AppEvent, secretsEqual } from '@org/api-common';
import { ConnectorRegistryService } from '@org/api-integrations';
import { PrismaService } from '@org/database';
import {
  AGENT_EVENTS,
  CANVAS_AGENT_TRIGGER,
  compileStudioGraph,
  isStudioGraph,
  type CompiledStudioGraph,
  type GeofenceTriggerConfig,
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

/** The geofence a compiled canvas graph starts on, if its trigger is a Location trigger. */
export function canvasGeofence(compiled: CompiledStudioGraph): GeofenceTriggerConfig | null {
  const trigger = compiled.nodes.find((n) => n.type === 'TRIGGER');
  const geofence = trigger?.config['geofence'];
  return trigger?.config['trigger'] === 'TRIGGER_LOCATION' && geofence && typeof geofence === 'object'
    ? (geofence as GeofenceTriggerConfig)
    : null;
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

/** The workspace event a compiled canvas graph starts on (`task.created`, …), if any. */
export function canvasEvent(compiled: CompiledStudioGraph): { name: string; label: string } | null {
  const trigger = compiled.nodes.find((n) => n.type === 'TRIGGER');
  if (trigger?.config['trigger'] !== 'TRIGGER_APP_EVENT' || trigger.config['connector']) return null;
  const known = AGENT_EVENTS.find((e) => e.value === trigger.config['event']);
  return known ? { name: known.value, label: known.label } : null;
}

/** Whether a compiled canvas graph starts on its inbound webhook. */
export function canvasWebhook(compiled: CompiledStudioGraph): boolean {
  return compiled.nodes.find((n) => n.type === 'TRIGGER')?.config['trigger'] === 'TRIGGER_WEBHOOK';
}

/** The route a canvas agent's webhook is served on, relative to the API base URL. */
export const canvasWebhookPath = (workspaceId: string, agentId: string) => `/workspaces/${workspaceId}/agent-graphs/${agentId}/webhook`;

/** The trigger node of a synced engine workflow, if its nodes parse. */
function syncedTriggerConfig(nodesJson: string | null | undefined): Record<string, unknown> | null {
  try {
    const nodes = JSON.parse(nodesJson ?? '[]') as Array<{ type?: string; config?: Record<string, unknown> }>;
    return nodes.find((n) => n.type === 'TRIGGER')?.config ?? null;
  } catch {
    return null;
  }
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
    @Optional() private readonly events?: EventEmitter2,
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
  async activation(workspaceId: string, agentId: string, opts: { canManage?: boolean } = {}) {
    const agent = await this.load(workspaceId, agentId);
    const workflow = await this.prisma.automationWorkflow.findFirst({
      where: { workspaceId, triggerType: CANVAS_AGENT_TRIGGER, description: canvasMarker(agentId) },
      select: { id: true, isActive: true, nodesJson: true },
    });
    const compiled =
      agent.graphJson && isStudioGraph(agent.graphJson) ? compileStudioGraph(JSON.parse(agent.graphJson) as Record<string, unknown>) : null;
    const schedule = compiled ? canvasSchedule(compiled) : null;
    const app = compiled ? canvasAppTrigger(compiled) : null;
    const event = compiled ? canvasEvent(compiled) : null;
    const secret = syncedTriggerConfig(workflow?.nodesJson)?.['webhookSecret'];
    const webhook =
      compiled && canvasWebhook(compiled)
        ? {
            path: canvasWebhookPath(workspaceId, agentId),
            // The secret starts runs as the owner, so only they or an admin see it.
            ...(opts.canManage && workflow?.isActive && typeof secret === 'string' ? { secret } : {}),
          }
        : null;
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
    return { active: !!workflow?.isActive, schedule, appTrigger, event, webhook };
  }

  /**
   * Switches scheduled runs on or off. Switching on needs a graph that
   * compiles without errors and starts with a schedule; the run acts with the
   * owner's access, like any live run.
   */
  async setActive(workspaceId: string, agentId: string, active: boolean) {
    await this.applyActive(workspaceId, agentId, active);
    // The agent's "on/off + schedule" shows in lists and its header everywhere.
    this.events?.emit(AppEvent.AgentChanged, { workspaceId, agentId, kind: 'entity', action: 'state' });
    // Only the owner or an admin can switch it, so they get the webhook secret.
    return this.activation(workspaceId, agentId, { canManage: true });
  }

  private async applyActive(workspaceId: string, agentId: string, active: boolean): Promise<void> {
    const agent = await this.load(workspaceId, agentId);
    if (!active) {
      await this.prisma.automationWorkflow.updateMany({
        where: { workspaceId, triggerType: CANVAS_AGENT_TRIGGER, description: canvasMarker(agentId) },
        data: { isActive: false },
      });
      return;
    }
    const compiled = this.compile(agent.graphJson);
    const errors = compiled.issues.filter((i) => i.level === 'error');
    if (errors.length) {
      throw new BadRequestException({ code: 'GRAPH_INVALID', message: `It can’t run by itself yet: ${errors.map((e) => e.message).join(' ')}`, issues: compiled.issues });
    }
    const schedule = canvasSchedule(compiled);
    const app = canvasAppTrigger(compiled);
    const webhook = canvasWebhook(compiled);
    if (!schedule && !app && !canvasEvent(compiled) && !webhook && !canvasGeofence(compiled)) {
      throw new BadRequestException({
        code: 'NO_SCHEDULE',
        message:
          'It has nothing to start it. Give its trigger a schedule (for example “every weekday at 9 AM”), an app event (for example “New email”), a workspace event or a webhook, then switch it on.',
      });
    }
    if (app && this.connectors && !this.knownTrigger(app.provider, app.triggerId)) {
      throw new BadRequestException({
        code: 'UNKNOWN_TRIGGER',
        message: `${this.appName(app.provider)} has no “${app.triggerId}” event. Pick another event on the trigger.`,
      });
    }
    // A webhook gets its secret the first time it is switched on; `syncWorkflow` keeps it from then on.
    const workflowId = await this.syncWorkflow(agent, compiled, webhook ? randomBytes(24).toString('base64url') : undefined);
    await this.prisma.automationWorkflow.update({ where: { id: workflowId }, data: { isActive: true } });
  }

  /** Issues a new webhook secret; the old one stops working at once. */
  async rotateWebhookSecret(workspaceId: string, agentId: string) {
    const agent = await this.load(workspaceId, agentId);
    const compiled = this.compile(agent.graphJson);
    if (!canvasWebhook(compiled)) {
      throw new BadRequestException({ code: 'NO_WEBHOOK', message: 'This agent doesn’t start on a webhook.' });
    }
    const workflowId = await this.syncWorkflow(agent, compiled, randomBytes(24).toString('base64url'), { replaceSecret: true });
    const workflow = await this.prisma.automationWorkflow.findUniqueOrThrow({ where: { id: workflowId }, select: { isActive: true } });
    if (!workflow.isActive) {
      throw new BadRequestException({ code: 'NOT_ACTIVE', message: 'Switch the agent on first; its webhook gets a secret then.' });
    }
    return this.activation(workspaceId, agentId, { canManage: true });
  }

  /**
   * An inbound webhook call. The agent must be switched on and the caller
   * must send its secret; the run is live and acts as the agent's owner.
   */
  async webhook(workspaceId: string, agentId: string, payload: Record<string, unknown>, secretHeader: string | undefined) {
    const agent = await this.prisma.aIAgent.findFirst({
      where: { id: agentId, workspaceId, type: 'agent' },
      select: { id: true, name: true, creatorId: true, graphJson: true },
    });
    const workflow = agent
      ? await this.prisma.automationWorkflow.findFirst({
          where: { workspaceId, triggerType: CANVAS_AGENT_TRIGGER, description: canvasMarker(agentId), archivedAt: null },
          select: { id: true, isActive: true, nodesJson: true },
        })
      : null;
    const secret = syncedTriggerConfig(workflow?.nodesJson)?.['webhookSecret'];
    // One answer for "no such agent", "not switched on" and "wrong secret", so the route can't be probed.
    if (!agent || !workflow?.isActive || typeof secret !== 'string' || !secretsEqual(secretHeader?.trim(), secret)) {
      throw new UnauthorizedException('Unknown agent, agent switched off, or invalid x-webhook-secret header.');
    }
    const compiled = this.compile(agent.graphJson);
    if (!canvasWebhook(compiled) || compiled.issues.some((i) => i.level === 'error')) {
      throw new BadRequestException({ code: 'GRAPH_INVALID', message: 'This agent no longer starts on a webhook, or its canvas has problems to fix.' });
    }
    await this.syncWorkflow(agent, compiled);
    const started = await this.engine.startWorkflow(
      workflow.id,
      { trigger: 'WEBHOOK', ...payload, event: payload, triggeredAt: new Date().toISOString() },
      { startedBy: 'webhook', limits: compiled.limits },
    );
    return { runId: started.runId, status: started.status };
  }

  /**
   * Switched-on canvas agents in a workspace that start on a workspace event,
   * read from (and synced to) their current graph — what
   * `AutomationTriggerListener` starts alongside plain workflows.
   */
  async activeEventTriggers(workspaceId: string, event: string, excludeWorkflowId?: string) {
    const workflows = await this.prisma.automationWorkflow.findMany({
      where: {
        workspaceId,
        isActive: true,
        archivedAt: null,
        triggerType: CANVAS_AGENT_TRIGGER,
        ...(excludeWorkflowId ? { id: { not: excludeWorkflowId } } : {}),
      },
      select: { id: true, description: true },
    });
    const out: Array<{ id: string; name: string; nodesJson: string; creatorId: string | null; limits: CompiledStudioGraph['limits'] }> = [];
    for (const workflow of workflows) {
      const agentId = workflow.description?.startsWith('canvas-agent:') ? workflow.description.slice('canvas-agent:'.length) : null;
      if (!agentId) continue;
      const agent = await this.prisma.aIAgent.findFirst({
        where: { id: agentId, workspaceId, type: 'agent' },
        select: { id: true, name: true, creatorId: true, graphJson: true },
      });
      if (!agent?.graphJson || !isStudioGraph(agent.graphJson)) continue;
      const compiled = compileStudioGraph(JSON.parse(agent.graphJson) as Record<string, unknown>);
      if (canvasEvent(compiled)?.name !== event || compiled.issues.some((i) => i.level === 'error')) continue;
      await this.syncWorkflow(agent, compiled);
      const trigger = compiled.nodes.find((n) => n.type === 'TRIGGER');
      out.push({
        id: workflow.id,
        name: agent.name,
        // Just the trigger, which is all the listener's filter reads.
        nodesJson: JSON.stringify(trigger ? [trigger] : []),
        creatorId: agent.creatorId,
        limits: compiled.limits,
      });
    }
    return out;
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

  /**
   * Switched-on agents in a workspace that start on a Location trigger and
   * belong to `userId`. Only a person's own agents react to their device: a
   * location ping is personal, and the agent's app actions run as its creator.
   */
  async activeLocationTriggers(workspaceId: string, userId: string) {
    const workflows = await this.prisma.automationWorkflow.findMany({
      where: { workspaceId, creatorId: userId, isActive: true, archivedAt: null, triggerType: CANVAS_AGENT_TRIGGER },
      select: { id: true, description: true },
    });
    const out: Array<{
      workflowId: string;
      agent: { id: string; name: string; creatorId: string | null };
      geofence: GeofenceTriggerConfig;
      compiled: CompiledStudioGraph;
    }> = [];
    for (const workflow of workflows) {
      const agentId = workflow.description?.startsWith('canvas-agent:') ? workflow.description.slice('canvas-agent:'.length) : null;
      if (!agentId) continue;
      const agent = await this.prisma.aIAgent.findFirst({
        where: { id: agentId, type: 'agent', creatorId: userId },
        select: { id: true, name: true, creatorId: true, graphJson: true },
      });
      if (!agent?.graphJson || !isStudioGraph(agent.graphJson)) continue;
      const compiled = compileStudioGraph(JSON.parse(agent.graphJson) as Record<string, unknown>);
      const geofence = canvasGeofence(compiled);
      if (!geofence || compiled.issues.some((i) => i.level === 'error')) continue;
      out.push({ workflowId: workflow.id, agent: { id: agent.id, name: agent.name, creatorId: agent.creatorId }, geofence, compiled });
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
    newWebhookSecret?: string,
    opts: { replaceSecret?: boolean } = {},
  ): Promise<string> {
    const existing = await this.prisma.automationWorkflow.findFirst({
      where: { triggerType: CANVAS_AGENT_TRIGGER, description: canvasMarker(agent.id) },
      select: { id: true, nodesJson: true },
    });
    // The webhook secret lives on the engine workflow, not the canvas (which
    // any member can read), and survives every re-sync. A graph that no
    // longer starts on a webhook drops it.
    const kept = syncedTriggerConfig(existing?.nodesJson)?.['webhookSecret'];
    const webhookSecret = canvasWebhook(compiled)
      ? opts.replaceSecret
        ? newWebhookSecret
        : typeof kept === 'string' && kept
          ? kept
          : newWebhookSecret
      : undefined;
    // Agent nodes run as this agent: its owner, credits and logs.
    const nodes = compiled.nodes.map((n) =>
      n.type === 'AGENT'
        ? { ...n, config: { ...n.config, hostAgentId: agent.id } }
        : n.type === 'TRIGGER' && webhookSecret
          ? { ...n, config: { ...n.config, webhookSecret } }
          : n,
    );
    // `isActive` is "runs by itself on its schedule" — only `setActive` turns
    // it on; a test or manual run never does.
    const data = {
      name: agent.name,
      nodesJson: JSON.stringify(nodes),
      edgesJson: JSON.stringify(compiled.edges),
    };
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
