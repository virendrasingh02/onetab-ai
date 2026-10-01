import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService, type AutomationWorkflow } from '@org/database';
import {
  AGENT_TEMPLATES,
  blueprintBlockers,
  compileAgentBlueprint,
  describeTriggerShort,
  stepsMissingScopes,
  workflowGraphSignature,
  type AgentBlueprint,
  type AgentProfile,
} from '@org/types';
import { nextCronRun, startOfZonedDay } from '@org/utils';
import { AutomationsService } from '../automations.service.js';
import { readAgentProfile } from '../run-support.js';
import { WorkflowEngineService } from '../workflow-engine.service.js';
import { workflowSchedule } from '../workflow-schedule.listener.js';
import { AgentPlannerService } from './agent-planner.service.js';

export type AgentState = 'draft' | 'active' | 'paused' | 'archived';

/** What one step changed between two blueprints, in words — a version's "Changes". */
/** JSON with keys in a fixed order: a stored profile comes back from JSONB with its keys reordered. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)))
      : v,
  );
}

export function describeBlueprintChanges(before: AgentBlueprint | null, after: AgentBlueprint): string {
  if (!before) return 'Created from a plan';
  const changes: string[] = [];
  if (before.name !== after.name) changes.push(`renamed to “${after.name}”`);
  if (describeTriggerShort(before.trigger) !== describeTriggerShort(after.trigger) || before.trigger.timezone !== after.trigger.timezone) {
    changes.push(`runs ${describeTriggerShort(after.trigger).toLowerCase()}`);
  }
  const beforeIds = new Map(before.steps.map((s) => [s.id, s]));
  const afterIds = new Map(after.steps.map((s) => [s.id, s]));
  const added = after.steps.filter((s) => !beforeIds.has(s.id));
  const removed = before.steps.filter((s) => !afterIds.has(s.id));
  const edited = after.steps.filter((s) => beforeIds.has(s.id) && stableJson(beforeIds.get(s.id)) !== stableJson(s));
  if (added.length) changes.push(`added ${added.map((s) => `“${s.title}”`).join(', ')}`);
  if (removed.length) changes.push(`removed ${removed.map((s) => `“${s.title}”`).join(', ')}`);
  if (edited.length) changes.push(`edited ${edited.map((s) => `“${s.title}”`).join(', ')}`);
  const reordered =
    !added.length && !removed.length && before.steps.map((s) => s.id).join() !== after.steps.map((s) => s.id).join();
  if (reordered) changes.push('reordered steps');
  const grantedBefore = new Set(before.scopes);
  const granted = after.scopes.filter((s) => !grantedBefore.has(s));
  const revoked = before.scopes.filter((s) => !after.scopes.includes(s));
  if (granted.length) changes.push(`granted ${granted.join(', ')}`);
  if (revoked.length) changes.push(`removed permission ${revoked.join(', ')}`);
  if (stableJson(before.output) !== stableJson(after.output)) changes.push('changed the output');
  if (stableJson(before.params) !== stableJson(after.params)) changes.push('changed settings');
  if (stableJson(before.notify) !== stableJson(after.notify)) changes.push('changed notifications');
  if (before.objective !== after.objective) changes.push('updated the objective');
  if ((before.instructions ?? '').trim() !== (after.instructions ?? '').trim()) changes.push('updated the writing guidance');
  if (!changes.length) return 'Saved without changes';
  const text = changes.join('; ');
  return (text.charAt(0).toUpperCase() + text.slice(1)).slice(0, 480);
}

/**
 * The AI Agent Studio's agents. An agent the Studio plans is an
 * `AutomationWorkflow` carrying the blueprint it was compiled from
 * (`agentProfile`), so it runs, schedules, versions and shows up in Runs
 * exactly like any workflow — this service adds the plan-level operations:
 * create from a blueprint, re-plan, lifecycle, run live or as a test, and the
 * Home summary.
 */
@Injectable()
export class AgentStudioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly engine: WorkflowEngineService,
    private readonly automations: AutomationsService,
    private readonly planner: AgentPlannerService,
  ) {}

  /* ------------------------------------------------------------ create -- */

  async create(workspaceId: string, userId: string, input: AgentBlueprint, activate = false) {
    const blueprint = await this.checked(workspaceId, userId, input);
    const compiled = compileAgentBlueprint(blueprint);
    const profile: AgentProfile = {
      ...blueprint,
      compiledSignature: workflowGraphSignature(compiled.nodes, compiled.edges),
      compiledAt: new Date().toISOString(),
    };
    const workflow = await this.prisma.automationWorkflow.create({
      data: {
        workspaceId,
        creatorId: userId,
        name: blueprint.name,
        description: blueprint.objective || null,
        triggerType: compiled.triggerType,
        nodesJson: JSON.stringify(compiled.nodes),
        edgesJson: JSON.stringify(compiled.edges),
        agentProfile: profile as object,
        isActive: false,
      },
    });
    await this.automations.snapshot(workspaceId, workflow.id, { summary: describeBlueprintChanges(null, blueprint) });
    if (activate) await this.setState(workspaceId, workflow.id, 'active');
    return this.get(workspaceId, workflow.id, userId);
  }

  /**
   * Saves an edited blueprint. The graph is recompiled from it; when the graph
   * was changed on the canvas since the last compile, that would throw those
   * edits away, so it is refused unless the caller says to overwrite them.
   */
  async update(workspaceId: string, workflowId: string, userId: string, input: AgentBlueprint, overwriteCanvasEdits = false) {
    const workflow = await this.find(workspaceId, workflowId);
    const before = readAgentProfile(workflow.agentProfile);
    if (before?.compiledSignature && !overwriteCanvasEdits) {
      const current = workflowGraphSignature(this.parse(workflow.nodesJson), this.parse(workflow.edgesJson));
      if (current !== before.compiledSignature) {
        throw new ConflictException({
          code: 'CANVAS_EDITED',
          message: 'This agent was edited on the canvas since its plan was saved. Saving the plan replaces those canvas edits.',
        });
      }
    }
    const blueprint = await this.checked(workspaceId, userId, input);
    const compiled = compileAgentBlueprint(blueprint);
    const profile: AgentProfile = {
      ...blueprint,
      compiledSignature: workflowGraphSignature(compiled.nodes, compiled.edges),
      compiledAt: new Date().toISOString(),
    };
    const blockers = blueprintBlockers(blueprint);
    await this.prisma.automationWorkflow.update({
      where: { id: workflowId },
      data: {
        name: blueprint.name,
        description: blueprint.objective || null,
        triggerType: compiled.triggerType,
        nodesJson: JSON.stringify(compiled.nodes),
        edgesJson: JSON.stringify(compiled.edges),
        agentProfile: profile as object,
        // An active agent that now has open questions stops until they are answered.
        ...(workflow.isActive && blockers.length ? { isActive: false } : {}),
      },
    });
    await this.automations.snapshot(workspaceId, workflowId, { summary: describeBlueprintChanges(before, blueprint) });
    return this.get(workspaceId, workflowId, userId);
  }

  /** Re-checks a blueprint server-side the same way the planner builds one. */
  private async checked(workspaceId: string, userId: string, input: AgentBlueprint): Promise<AgentBlueprint> {
    const catalog = await this.planner.catalog(workspaceId, userId);
    const known = new Set([...catalog.tools.map((t) => t.name), ...catalog.apps.flatMap((a) => a.actions.map((x) => x.tool))]);
    const unknown = input.steps.filter((s) => s.tool && !known.has(s.tool) && !s.tool.includes('.'));
    if (unknown.length) {
      throw new BadRequestException(`These steps use tools that don’t exist: ${unknown.map((s) => `“${s.title}” (${s.tool})`).join(', ')}.`);
    }
    const appAccess = new Map(catalog.apps.flatMap((a) => a.actions.map((x) => [x.tool, x.access] as const)));
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } });
    const timezone = input.trigger.timezone || user?.timezone || 'UTC';
    let finalized: AgentBlueprint;
    try {
      finalized = await this.planner.finalize(workspaceId, input, { timezone, catalog, userId });
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : 'The plan is not valid.');
    }
    // `finalize` recomputes scopes and default approvals; what the person set
    // on the plan — its grants, its approvals, its notifications — wins.
    const result: AgentBlueprint = {
      ...finalized,
      scopes: input.scopes,
      steps: input.steps.map((s) => ({ ...s })),
      notify: input.notify,
    };
    const missing = stepsMissingScopes(result, (tool) => appAccess.get(tool));
    const permissionNote = /permission the agent doesn’t have/;
    result.warnings = [
      ...result.warnings.filter((w) => !permissionNote.test(w)),
      // Saving a step outside its permissions is allowed — the run refuses
      // that step, visibly — but the plan says so up front.
      ...(missing.length
        ? [
            `${missing.length} step${missing.length === 1 ? '' : 's'} need${missing.length === 1 ? 's' : ''} a permission the agent doesn’t have (${[...new Set(missing.map((m) => m.scope))].join(', ')}). Those steps will fail until you grant it.`,
          ]
        : []),
    ].slice(0, 10);
    return result;
  }

  /* ------------------------------------------------------------- read -- */

  async get(workspaceId: string, workflowId: string, viewerId: string) {
    const workflow = await this.find(workspaceId, workflowId);
    const [summary] = await this.summaries(workspaceId, viewerId, [workflow]);
    const profile = readAgentProfile(workflow.agentProfile);
    const nodes = this.parse(workflow.nodesJson);
    const edges = this.parse(workflow.edgesJson);
    const canvasEdited = !!profile?.compiledSignature && workflowGraphSignature(nodes, edges) !== profile.compiledSignature;
    return {
      ...summary!,
      profile,
      canvasEdited,
      blockers: profile ? blueprintBlockers(profile) : [],
      nodes,
      edges,
    };
  }

  /** Every workflow in the workspace with its state, trigger, last run and next run — the library. */
  async list(workspaceId: string, viewerId: string) {
    const workflows = await this.prisma.automationWorkflow.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
    });
    return this.summaries(workspaceId, viewerId, workflows);
  }

  private async summaries(
    workspaceId: string,
    viewerId: string,
    workflows: AutomationWorkflow[],
  ) {
    if (workflows.length === 0) return [];
    const ids = workflows.map((w) => w.id);
    const creatorIds = [...new Set(workflows.map((w) => w.creatorId).filter((id): id is string => !!id))];
    const since = new Date(Date.now() - 24 * 60 * 60_000);
    const [creators, lastRuns, recentFailures, publishedVersions, runCounts] = await Promise.all([
      this.prisma.user.findMany({ where: { id: { in: creatorIds } }, select: { id: true, name: true, displayName: true, avatarUrl: true } }),
      this.prisma.aIExecution.findMany({
        where: { workspaceId, entityType: 'WORKFLOW', entityId: { in: ids } },
        orderBy: { startedAt: 'desc' },
        distinct: ['entityId'],
        select: { id: true, entityId: true, status: true, startedAt: true, finishedAt: true, stateJson: true },
      }),
      this.prisma.aIExecution.groupBy({
        by: ['entityId'],
        where: { workspaceId, entityType: 'WORKFLOW', entityId: { in: ids }, status: 'FAILED', startedAt: { gte: since } },
        _count: { _all: true },
      }),
      this.prisma.aIWorkflowVersion.groupBy({
        by: ['workflowId'],
        where: { workflowId: { in: ids }, isPublished: true },
        _max: { versionNumber: true },
      }),
      this.prisma.aIExecution.groupBy({
        by: ['entityId'],
        where: { workspaceId, entityType: 'WORKFLOW', entityId: { in: ids } },
        _count: { _all: true },
      }),
    ]);
    const creatorById = new Map(creators.map((c) => [c.id, c]));
    const lastRunBy = new Map(lastRuns.map((r) => [r.entityId, r]));
    const failuresBy = new Map(recentFailures.map((r) => [r.entityId, r._count._all]));
    const publishedBy = new Map(publishedVersions.map((v) => [v.workflowId, v._max.versionNumber]));
    const runsBy = new Map(runCounts.map((r) => [r.entityId, r._count._all]));

    return workflows.map((w) => {
      const profile = readAgentProfile(w.agentProfile);
      const creator = w.creatorId ? creatorById.get(w.creatorId) : undefined;
      const published = publishedBy.get(w.id) ?? null;
      const state: AgentState = w.archivedAt ? 'archived' : w.isActive ? 'active' : published ? 'paused' : 'draft';
      const schedule = w.triggerType === 'CRON' ? workflowSchedule(w.nodesJson) : null;
      const nextRun =
        schedule && state === 'active' ? nextCronRun(schedule.cron, new Date(), schedule.timezone)?.toISOString() ?? null : null;
      const last = lastRunBy.get(w.id);
      return {
        id: w.id,
        name: w.name,
        description: w.description,
        kind: profile?.kind ?? 'workflow',
        isStudioAgent: !!profile,
        triggerType: w.triggerType,
        trigger: profile
          ? profile.trigger
          : schedule
            ? { kind: 'schedule' as const, cron: schedule.cron, ...(schedule.timezone ? { timezone: schedule.timezone } : {}) }
            : w.triggerType === 'MANUAL' || w.triggerType === 'WEBHOOK'
              ? { kind: 'manual' as const }
              : { kind: 'event' as const, event: w.triggerType as never },
        state,
        isActive: w.isActive,
        archivedAt: w.archivedAt?.toISOString() ?? null,
        publishedVersion: published,
        nextRunAt: nextRun,
        owner: creator
          ? { id: creator.id, name: creator.displayName || creator.name, avatarUrl: creator.avatarUrl }
          : null,
        isMine: w.creatorId === viewerId,
        templateId: profile?.source.templateId ?? null,
        stepCount: profile?.steps.length ?? this.parse(w.nodesJson).length,
        scopes: profile?.scopes ?? null,
        lastRun: last
          ? {
              id: last.id,
              status: last.status,
              startedAt: last.startedAt.toISOString(),
              finishedAt: last.finishedAt?.toISOString() ?? null,
              test: (last.stateJson as Record<string, unknown> | null)?.['__mode'] === 'test',
            }
          : null,
        runCount: runsBy.get(w.id) ?? 0,
        recentFailures: failuresBy.get(w.id) ?? 0,
        createdAt: w.createdAt.toISOString(),
        updatedAt: w.updatedAt.toISOString(),
      };
    });
  }

  /* -------------------------------------------------------- lifecycle -- */

  async setState(workspaceId: string, workflowId: string, state: AgentState) {
    const workflow = await this.find(workspaceId, workflowId);
    const profile = readAgentProfile(workflow.agentProfile);
    if (state === 'active') {
      const blockers = profile ? blueprintBlockers(profile) : [];
      if (blockers.length) {
        throw new BadRequestException({ code: 'AGENT_NOT_READY', message: `Before switching it on: ${blockers.join(' ')}` });
      }
      // What runs on a trigger is always a published version someone can roll back to.
      await this.automations.snapshot(workspaceId, workflowId, { summary: 'Published and switched on', publish: true });
      await this.prisma.automationWorkflow.update({ where: { id: workflowId }, data: { isActive: true, archivedAt: null } });
    } else if (state === 'paused') {
      await this.prisma.automationWorkflow.update({ where: { id: workflowId }, data: { isActive: false } });
    } else if (state === 'archived') {
      await this.prisma.automationWorkflow.update({ where: { id: workflowId }, data: { isActive: false, archivedAt: new Date() } });
    } else {
      await this.prisma.automationWorkflow.update({ where: { id: workflowId }, data: { archivedAt: null } });
    }
    return { id: workflowId, state };
  }

  async duplicate(workspaceId: string, workflowId: string, userId: string) {
    const workflow = await this.find(workspaceId, workflowId);
    const profile = readAgentProfile(workflow.agentProfile);
    const name = `${workflow.name} (copy)`.slice(0, 120);
    const copy = await this.prisma.automationWorkflow.create({
      data: {
        workspaceId,
        creatorId: userId,
        name,
        description: workflow.description,
        triggerType: workflow.triggerType,
        nodesJson: workflow.nodesJson,
        edgesJson: workflow.edgesJson,
        ...(profile ? { agentProfile: { ...profile, name } as object } : {}),
        isActive: false,
      },
    });
    await this.automations.snapshot(workspaceId, copy.id, { summary: `Duplicated from “${workflow.name}”` });
    return this.get(workspaceId, copy.id, userId);
  }

  /* -------------------------------------------------------------- run -- */

  /**
   * Starts a run and returns straight away — the Studio follows it live. A
   * test run changes nothing: writes are simulated and approvals pass.
   */
  async run(
    workspaceId: string,
    workflowId: string,
    userId: string,
    input: { text?: string; mode?: 'live' | 'test'; event?: Record<string, unknown> },
  ) {
    const workflow = await this.find(workspaceId, workflowId);
    if (workflow.archivedAt) throw new BadRequestException('Unarchive this agent before running it.');
    const profile = readAgentProfile(workflow.agentProfile);
    const mode = input.mode === 'test' ? 'test' : 'live';
    if (profile && mode === 'live') {
      const blockers = blueprintBlockers(profile);
      if (blockers.length) {
        throw new BadRequestException({ code: 'AGENT_NOT_READY', message: `Before it can run: ${blockers.join(' ')}` });
      }
    }
    const payload: Record<string, unknown> = {
      ...(input.text ? { input: { text: input.text } } : { input: { text: '' } }),
      ...(input.event ? { ...input.event, event: input.event, trigger: 'test-event' } : {}),
    };
    return this.engine.startWorkflow(workflowId, payload, { mode, startedBy: 'person', userId });
  }

  /* ------------------------------------------------------------- home -- */

  async home(workspaceId: string, userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { timezone: true, name: true, displayName: true } });
    const timezone = user?.timezone || 'UTC';
    const today = startOfZonedDay(new Date(), timezone);

    const [agents, runsToday, activeRuns, approvals, tasksCreated, docsCreated] = await Promise.all([
      this.list(workspaceId, userId),
      this.prisma.aIExecution.findMany({
        where: { workspaceId, startedAt: { gte: today } },
        orderBy: { startedAt: 'desc' },
        take: 200,
        select: { id: true, entityType: true, entityId: true, status: true, startedAt: true, finishedAt: true, stateJson: true },
      }),
      this.prisma.aIExecution.findMany({
        where: { workspaceId, status: { in: ['RUNNING', 'PAUSED', 'WAITING_APPROVAL'] } },
        orderBy: { startedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          entityType: true,
          entityId: true,
          status: true,
          startedAt: true,
          steps: { orderBy: { startedAt: 'desc' }, take: 1, select: { stepId: true, status: true, nodeType: true } },
        },
      }),
      this.prisma.approvalRequest.findMany({
        where: { workspaceId, state: 'PENDING', requesterId: userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { id: true, entityType: true, entityId: true, executionId: true, actionType: true, createdAt: true },
      }),
      this.prisma.$queryRaw<Array<{ count: bigint }>>`
        SELECT count(*)::bigint AS count FROM tasks
        WHERE "workspaceId" = ${workspaceId} AND "createdAt" >= ${today} AND jsonb_exists("customFields", 'createdByAgent')`,
      this.prisma.aIExecutionStep.count({
        where: {
          status: 'SUCCESS',
          startedAt: { gte: today },
          inputJson: { path: ['toolName'], equals: 'create_doc' },
          execution: { workspaceId },
        },
      }),
    ]);

    const byId = new Map(agents.map((a) => [a.id, a]));
    const live = runsToday.filter((r) => (r.stateJson as Record<string, unknown> | null)?.['__mode'] !== 'test');
    const completedToday = live.filter((r) => r.status === 'COMPLETED');
    const failedToday = live.filter((r) => r.status === 'FAILED');
    const usedTemplates = new Set(agents.map((a) => a.templateId).filter(Boolean));

    return {
      greetingName: (user?.displayName || user?.name || '').split(' ')[0] ?? '',
      timezone,
      stats: {
        running: activeRuns.filter((r) => r.status === 'RUNNING').length,
        completedToday: completedToday.length,
        itemsCreatedToday: Number(tasksCreated[0]?.count ?? 0) + docsCreated,
        approvalsWaiting: approvals.length,
        // Agents with a problem, counted once: failed today, or switched on and still failing.
        issues: new Set([
          ...failedToday.map((r) => r.entityId),
          ...agents.filter((a) => a.state === 'active' && a.lastRun?.status === 'FAILED').map((a) => a.id),
        ]).size,
        activeAgents: agents.filter((a) => a.state === 'active').length,
      },
      runningNow: activeRuns.map((r) => ({
        id: r.id,
        status: r.status,
        startedAt: r.startedAt.toISOString(),
        entityType: r.entityType,
        entityId: r.entityId,
        name: byId.get(r.entityId)?.name ?? null,
        currentStep: r.steps[0] ? { stepId: r.steps[0].stepId, status: r.steps[0].status, nodeType: r.steps[0].nodeType } : null,
      })),
      approvals: approvals.map((a) => ({
        id: a.id,
        runId: a.executionId,
        action: a.actionType,
        createdAt: a.createdAt.toISOString(),
        agentName: byId.get(a.entityId)?.name ?? null,
      })),
      recentlyCompleted: completedToday.slice(0, 8).map((r) => ({
        id: r.id,
        entityId: r.entityId,
        name: byId.get(r.entityId)?.name ?? null,
        finishedAt: r.finishedAt?.toISOString() ?? null,
      })),
      failed: failedToday.slice(0, 8).map((r) => ({
        id: r.id,
        entityId: r.entityId,
        name: byId.get(r.entityId)?.name ?? null,
        startedAt: r.startedAt.toISOString(),
      })),
      scheduled: agents
        .filter((a) => a.nextRunAt)
        .sort((a, b) => (a.nextRunAt ?? '').localeCompare(b.nextRunAt ?? ''))
        .slice(0, 8)
        .map((a) => ({ id: a.id, name: a.name, nextRunAt: a.nextRunAt, trigger: a.trigger })),
      recommended: AGENT_TEMPLATES.filter((t) => !usedTemplates.has(t.id))
        .slice(0, 6)
        .map((t) => t.id),
    };
  }

  /* ---------------------------------------------------------- versions -- */

  async version(workspaceId: string, workflowId: string, versionNumber: number) {
    await this.find(workspaceId, workflowId);
    const version = await this.prisma.aIWorkflowVersion.findUnique({
      where: { workflowId_versionNumber: { workflowId, versionNumber } },
    });
    if (!version) throw new NotFoundException(`Version ${versionNumber} not found.`);
    return {
      versionNumber: version.versionNumber,
      name: version.name,
      changeSummary: version.changeSummary,
      isPublished: version.isPublished,
      createdAt: version.createdAt.toISOString(),
      profile: readAgentProfile(version.agentProfile),
      nodes: this.parse(version.nodesJson),
      edges: this.parse(version.edgesJson),
    };
  }

  /* ----------------------------------------------------------- helpers -- */

  private async find(workspaceId: string, workflowId: string) {
    const workflow = await this.prisma.automationWorkflow.findFirst({ where: { id: workflowId, workspaceId } });
    if (!workflow) throw new NotFoundException('Agent not found.');
    return workflow;
  }

  private parse(json: string): unknown[] {
    try {
      const value = JSON.parse(json);
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }
}
