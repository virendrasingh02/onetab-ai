import { Injectable } from '@nestjs/common';
import { AIEntitiesService } from '@org/api-agents';
import { ConnectorRegistryService } from '@org/api-integrations';
import { PrismaService } from '@org/database';
import {
  BUSINESS_COWORKER_KEYS,
  CANVAS_AGENT_TRIGGER,
  PLANS_CONFIG,
  buildConnectableApps,
  buildRosterConnectors,
  coworkerTemplateKey,
  getCoworkerTemplate,
  resolveCoworkerCollaborators,
  resolveEffectivePlanTier,
  workflowCoworkerIds,
  type CoworkerRoster,
  type CoworkerRosterEntry,
  type RosterConnectorInput,
} from '@org/types';

const DAY = 86_400_000;
const OPEN_TASK_STATES = ['PENDING', 'QUEUED', 'RUNNING', 'WAITING', 'APPROVAL_REQUIRED', 'PAUSED'];

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function toolCount(tools: string): number {
  try {
    const parsed = JSON.parse(tools);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/**
 * The Coworkers page in one read: each coworker as an Orchestrator with its
 * specialist agents, connector nodes (canonical connections, shared across
 * coworkers), the workflows that call it, and its real run, task, approval
 * and deployment numbers — plus the plan's shared allocation. Nothing here
 * is estimated: a coworker with no runs shows zero.
 */
@Injectable()
export class CoworkerRosterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entities: AIEntitiesService,
    private readonly connectors: ConnectorRegistryService,
  ) {}

  async getRoster(workspaceId: string, userId: string): Promise<CoworkerRoster> {
    // Same as the coworker list: make sure the defaults exist (and adopt old ones) first.
    await this.entities.initializeDefaultCoworkers(workspaceId, userId);

    const now = Date.now();
    const since30 = new Date(now - 30 * DAY);
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const coworkers = await this.prisma.aIAgent.findMany({
      where: { workspaceId, type: 'coworker' },
      include: {
        agentLinks: { include: { agent: { select: { id: true, name: true, role: true, isActive: true } } } },
        appLinks: { include: { integration: { select: { id: true, provider: true, displayName: true, status: true, scopeType: true } } } },
        deployments: { select: { status: true } },
        _count: { select: { channelCoworkers: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
    const ids = coworkers.map((c) => c.id);
    const creatorIds = [...new Set(coworkers.map((c) => c.creatorId).filter((id): id is string => !!id))];
    const creators = creatorIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: creatorIds } },
          select: { id: true, name: true, displayName: true, avatarUrl: true },
        })
      : [];
    const ownerOf = new Map(creators.map((u) => [u.id, { id: u.id, name: u.displayName || u.name, avatarUrl: u.avatarUrl }]));
    const nameOf = new Map(coworkers.map((c) => [c.id, c.name]));

    const [summaries, workflows, runs30, runsMonth, lastRuns, waiting, openTasks, doneTasks, subscription, aiRunsThisMonth, runningNow] =
      await Promise.all([
        this.connectors.list(workspaceId, userId),
        // Automations, plus Studio canvases read from the canvas itself (so a step
        // counts as soon as it's saved), not from the engine copy each run syncs.
        Promise.all([
          this.prisma.automationWorkflow.findMany({
            where: { workspaceId, archivedAt: null, triggerType: { not: CANVAS_AGENT_TRIGGER }, nodesJson: { contains: 'AI_COWORKER' } },
            select: { id: true, name: true, isActive: true, nodesJson: true },
          }),
          this.prisma.aIAgent.findMany({
            where: { workspaceId, type: 'agent', isActive: true, graphJson: { contains: 'AI_COWORKER' } },
            select: { id: true, name: true, isActive: true, graphJson: true },
          }),
        ]).then(([automations, canvases]) => [
          ...automations.map((w) => ({ id: w.id, name: w.name, isActive: w.isActive, nodesJson: w.nodesJson, kind: 'automation' as const })),
          ...canvases.map((a) => ({ id: a.id, name: a.name, isActive: a.isActive, nodesJson: a.graphJson, kind: 'canvas' as const })),
        ]),
        this.prisma.aIExecution.groupBy({
          by: ['agentId', 'status'],
          where: { workspaceId, agentId: { in: ids }, startedAt: { gte: since30 } },
          _count: { _all: true },
          _sum: { tokensUsed: true, latencyMs: true },
        }),
        this.prisma.aIExecution.groupBy({
          by: ['agentId'],
          where: { workspaceId, agentId: { in: ids }, startedAt: { gte: monthStart } },
          _count: { _all: true },
        }),
        this.prisma.aIExecution.groupBy({
          by: ['agentId'],
          where: { workspaceId, agentId: { in: ids } },
          _max: { startedAt: true },
        }),
        this.prisma.aIExecution.groupBy({
          by: ['agentId'],
          where: { workspaceId, agentId: { in: ids }, status: 'WAITING_APPROVAL' },
          _count: { _all: true },
        }),
        this.prisma.agentTask.groupBy({
          by: ['agentKey'],
          where: { workspaceId, agentKey: { in: ids }, status: { in: OPEN_TASK_STATES } },
          _count: { _all: true },
        }),
        this.prisma.agentTask.groupBy({
          by: ['agentKey'],
          where: { workspaceId, agentKey: { in: ids }, status: 'COMPLETED', completedAt: { gte: since30 } },
          _count: { _all: true },
        }),
        this.prisma.workspaceSubscription.findUnique({
          where: { workspaceId },
          select: { planTier: true, status: true, trialStatus: true, trialEnd: true, convertedAt: true },
        }),
        this.prisma.aIExecution.count({ where: { workspaceId, startedAt: { gte: monthStart } } }),
        this.prisma.aIExecution.count({ where: { workspaceId, status: 'RUNNING' } }),
      ]);

    const registry = new Map<string, RosterConnectorInput>(
      summaries.map((s) => [
        s.provider,
        {
          provider: s.provider,
          name: s.name,
          category: s.category,
          serverConfigured: s.serverConfigured,
          unavailableReason: s.unavailableReason,
          readActions: s.capabilities.filter((c) => c.permissionLevel === 'read').length,
          writeActions: s.capabilities.filter((c) => c.permissionLevel !== 'read').length,
          triggers: s.triggers.length,
          connections: s.connections.map((c) => ({ id: c.id, status: c.status, scopeType: c.scopeType, displayName: c.displayName })),
        },
      ]),
    );

    // One connection, many coworkers: who else uses each canonical connection.
    const usersOf = new Map<string, Array<{ id: string; name: string }>>();
    for (const c of coworkers) {
      for (const link of c.appLinks) {
        const list = usersOf.get(link.integrationId) ?? [];
        list.push({ id: c.id, name: c.name });
        usersOf.set(link.integrationId, list);
      }
    }
    const workflowCoworkers = workflows.map((w) => ({ ...w, coworkerIds: workflowCoworkerIds(w.nodesJson) }));

    const entries: CoworkerRosterEntry[] = coworkers.map((c) => {
      const configuration = record(c.configuration);
      const permissions = record(c.permissions);
      const templateKey = coworkerTemplateKey(configuration) ?? null;
      const template = getCoworkerTemplate(templateKey);
      const sharing = new Map([...usersOf].map(([integrationId, list]) => [integrationId, list.filter((u) => u.id !== c.id)]));

      const mine30 = runs30.filter((r) => r.agentId === c.id);
      const runs30d = mine30.reduce((n, r) => n + r._count._all, 0);
      const finished = mine30.filter((r) => r.status !== 'RUNNING' && r.status !== 'WAITING_APPROVAL');
      const finishedCount = finished.reduce((n, r) => n + r._count._all, 0);
      const latency = finished.reduce((n, r) => n + (r._sum.latencyMs ?? 0), 0);
      const lastRun = lastRuns.find((r) => r.agentId === c.id)?._max.startedAt ?? null;

      return {
        id: c.id,
        name: c.name,
        role: c.role,
        description: c.description,
        avatarUrl: c.avatarUrl,
        status: c.status,
        isActive: c.isActive,
        creatorId: c.creatorId,
        owner: c.creatorId ? (ownerOf.get(c.creatorId) ?? null) : null,
        templateKey,
        adoptedFrom: typeof configuration['adoptedFrom'] === 'string' ? (configuration['adoptedFrom'] as string) : null,
        // What the runtime will actually call.
        provider: c.provider || null,
        model: c.model || null,
        orchestrator: {
          tools: toolCount(c.tools),
          grantedWrites: Array.isArray(permissions['allowActions']) ? (permissions['allowActions'] as unknown[]).length : 0,
          collaborators: resolveCoworkerCollaborators(c, coworkers).map((id) => ({ id, name: nameOf.get(id) ?? id })),
        },
        specialists: c.agentLinks.map((l) => ({ id: l.agent.id, name: l.agent.name, role: l.agent.role, isActive: l.agent.isActive })),
        connectors: buildRosterConnectors({
          templateProviders: template?.connectors ?? [],
          attached: c.appLinks.map((l) => ({
            integrationId: l.integration.id,
            provider: l.integration.provider,
            status: l.integration.status,
            displayName: l.integration.displayName,
            scopeType: l.integration.scopeType === 'USER' ? 'USER' : 'WORKSPACE',
          })),
          registry,
          sharing,
        }),
        workflows: workflowCoworkers
          .filter((w) => w.coworkerIds.includes(c.id))
          .map((w) => ({
            id: w.id,
            name: w.name,
            isActive: w.isActive,
            kind: w.kind,
            sharedWith: w.coworkerIds.filter((id) => id !== c.id && nameOf.has(id)).map((id) => ({ id, name: nameOf.get(id) as string })),
          })),
        channels: c._count.channelCoworkers,
        deployments: { total: c.deployments.length, active: c.deployments.filter((d) => d.status === 'ACTIVE').length },
        activity: {
          runs30d,
          failed30d: mine30.filter((r) => r.status === 'FAILED').reduce((n, r) => n + r._count._all, 0),
          waitingApproval: waiting.find((r) => r.agentId === c.id)?._count._all ?? 0,
          runsThisMonth: runsMonth.find((r) => r.agentId === c.id)?._count._all ?? 0,
          tokens30d: mine30.reduce((n, r) => n + (r._sum.tokensUsed ?? 0), 0),
          avgLatencyMs: finishedCount ? Math.round(latency / finishedCount) : null,
          lastRunAt: (lastRun ?? c.lastActiveAt)?.toISOString() ?? null,
          openTasks: openTasks.find((t) => t.agentKey === c.id)?._count._all ?? 0,
          completedTasks30d: doneTasks.find((t) => t.agentKey === c.id)?._count._all ?? 0,
        },
      };
    });

    // The five business coworkers first, in their fixed order, then the rest by name.
    const rank = (e: CoworkerRosterEntry) => {
      const i = e.templateKey ? BUSINESS_COWORKER_KEYS.indexOf(e.templateKey) : -1;
      return i === -1 ? BUSINESS_COWORKER_KEYS.length : i;
    };
    entries.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));

    const plan = PLANS_CONFIG[resolveEffectivePlanTier(subscription)];
    return {
      coworkers: entries,
      connectableApps: buildConnectableApps({ registry, sharing: usersOf }),
      plan: {
        name: plan.name,
        requestsPerMonth: plan.machineLimits.requestsPerMonth,
        aiRunsThisMonth,
        concurrentExecutions: plan.machineLimits.concurrentExecutions,
        runningNow,
        cpu: plan.machineLimits.cpu,
        ramGb: plan.machineLimits.ramGb,
        maxExecutionTimeMs: plan.machineLimits.maxExecutionTimeMs,
      },
      generatedAt: new Date(now).toISOString(),
    };
  }
}
