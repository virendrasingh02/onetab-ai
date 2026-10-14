import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@org/database';
import { CANVAS_AGENT_TRIGGER, PLANS_CONFIG, resolveEffectivePlanTier } from '@org/types';

export type PlanGatedKind = 'agent' | 'workflow';

/**
 * Server-side plan limits for things the AI Agent Studio and the Automations
 * center create. Mirrors the checks `AIEntitiesService` already applies to
 * micro agents, so a limit holds whichever app creates the thing — hiding a
 * button is never the only protection.
 *
 * Counting rules (kept identical to the billing summary):
 *  - agents    = AIAgent rows of type "agent" + Studio-planned agents
 *                (AutomationWorkflow with an agentProfile)
 *  - workflows = plain automation workflows (no agentProfile, not a hidden
 *                canvas-run workflow)
 */
@Injectable()
export class PlanGateService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanCreate(workspaceId: string, kind: PlanGatedKind): Promise<void> {
    const sub = await this.prisma.workspaceSubscription.findUnique({
      where: { workspaceId },
      select: { planTier: true, status: true, trialStatus: true, trialEnd: true, convertedAt: true },
    });

    // An expired, unconverted trial falls back to Free limits rather than
    // blocking creation outright.
    const plan = PLANS_CONFIG[resolveEffectivePlanTier(sub)];
    const limit = kind === 'agent' ? plan.machineLimits.microAgents : plan.limits.max_active_automations;
    if (limit === -1) return;

    const used = await this.countFor(workspaceId, kind);
    if (used >= limit) {
      const noun = kind === 'agent' ? 'agent' : 'workflow';
      throw new BadRequestException({
        code: 'PLAN_LIMIT_REACHED',
        message: `You've reached the ${noun} limit (${limit}) on the ${plan.name} plan. Upgrade to create more.`,
        limit,
        used,
        resource: kind === 'agent' ? 'micro_agents' : 'max_active_automations',
      });
    }
  }

  async countFor(workspaceId: string, kind: PlanGatedKind): Promise<number> {
    const notCanvas = { triggerType: { not: CANVAS_AGENT_TRIGGER } };
    if (kind === 'agent') {
      const [entities, studio] = await Promise.all([
        this.prisma.aIAgent.count({ where: { workspaceId, type: 'agent' } }),
        this.prisma.automationWorkflow.count({
          where: { workspaceId, ...notCanvas, agentProfile: { not: Prisma.DbNull } },
        }),
      ]);
      return entities + studio;
    }
    return this.prisma.automationWorkflow.count({
      where: { workspaceId, ...notCanvas, agentProfile: { equals: Prisma.DbNull } },
    });
  }
}
