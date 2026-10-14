import { describe, expect, it, vi } from 'vitest';
import { PlanGateService } from './plan-gate.service.js';

function build(planTier: string | null, counts: { entities?: number; studio?: number; workflows?: number }, sub: object = {}) {
  const prisma: any = {
    workspaceSubscription: {
      findUnique: vi.fn().mockResolvedValue(planTier ? { planTier, trialStatus: null, trialEnd: null, ...sub } : null),
    },
    aIAgent: { count: vi.fn().mockResolvedValue(counts.entities ?? 0) },
    automationWorkflow: {
      count: vi.fn().mockImplementation(async ({ where }: any) =>
        // `agentProfile: { not: DbNull }` => Studio agents; `{ equals: DbNull }` => plain workflows
        where.agentProfile && 'not' in where.agentProfile ? (counts.studio ?? 0) : (counts.workflows ?? 0),
      ),
    },
  };
  return new PlanGateService(prisma);
}

describe('PlanGateService', () => {
  it('counts entity agents and Studio agents together against the Free limit of 3', async () => {
    const gate = build('FREE', { entities: 2, studio: 1 });
    await expect(gate.assertCanCreate('ws', 'agent')).rejects.toMatchObject({
      response: { code: 'PLAN_LIMIT_REACHED', limit: 3, used: 3, resource: 'micro_agents' },
    });
  });

  it('allows creation below the limit', async () => {
    await expect(build('FREE', { entities: 1, studio: 1 }).assertCanCreate('ws', 'agent')).resolves.toBeUndefined();
  });

  it('treats a workspace with no subscription row as Free', async () => {
    await expect(build(null, { studio: 3 }).assertCanCreate('ws', 'agent')).rejects.toMatchObject({
      response: { code: 'PLAN_LIMIT_REACHED' },
    });
  });

  it('applies the workflow limit to plain workflows only', async () => {
    // Free allows 3 active automations; Studio agents must not use them up.
    await expect(build('FREE', { studio: 5, workflows: 2 }).assertCanCreate('ws', 'workflow')).resolves.toBeUndefined();
    await expect(build('FREE', { workflows: 3 }).assertCanCreate('ws', 'workflow')).rejects.toMatchObject({
      response: { resource: 'max_active_automations', limit: 3 },
    });
  });

  it('honours higher plans and unlimited tiers', async () => {
    await expect(build('PRO', { entities: 9 }).assertCanCreate('ws', 'agent')).resolves.toBeUndefined();
    await expect(build('PRO', { entities: 10 }).assertCanCreate('ws', 'agent')).rejects.toBeDefined();
    await expect(build('ENTERPRISE', { entities: 9999 }).assertCanCreate('ws', 'agent')).resolves.toBeUndefined();
  });

  it('falls back to Free limits once an unconverted trial has expired', async () => {
    const lapsed = { trialStatus: 'ACTIVE', trialEnd: new Date(Date.now() - 1000) };
    // Under the Free cap of 3 the workspace can still create…
    await expect(build('PRO', { entities: 2 }, lapsed).assertCanCreate('ws', 'agent')).resolves.toBeUndefined();
    // …but Pro's higher allowance no longer applies.
    await expect(build('PRO', { entities: 3 }, lapsed).assertCanCreate('ws', 'agent')).rejects.toMatchObject({
      response: { code: 'PLAN_LIMIT_REACHED', limit: 3 },
    });
  });
});
