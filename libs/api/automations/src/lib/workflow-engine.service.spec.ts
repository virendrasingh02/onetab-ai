import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkflowEngineService } from './workflow-engine.service.js';

/** A canvas-shaped node: settings flat on `data`, as the builder saves them. */
const node = (id: string, type: string, data: Record<string, unknown> = {}) => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { type, label: id, ...data },
});
const edge = (source: string, target: string, sourceHandle?: string) => ({
  id: `${source}-${target}`,
  source,
  target,
  ...(sourceHandle ? { sourceHandle } : {}),
});

function makeEngine(nodes: unknown[], edges: unknown[]) {
  const steps: Array<{ stepId: string; status: string }> = [];
  const workflow = {
    id: 'wf_1',
    workspaceId: 'ws_1',
    creatorId: 'u_1',
    name: 'Test flow',
    nodesJson: JSON.stringify(nodes),
    edgesJson: JSON.stringify(edges),
  };
  let aiExecution: Record<string, unknown> = {};
  let legacy: Record<string, unknown> = {};
  const prisma: any = {
    automationWorkflow: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(workflow),
      findUnique: vi.fn().mockResolvedValue(workflow),
    },
    workspaceSubscription: { findUnique: vi.fn().mockResolvedValue({ planTier: 'business' }) },
    creditAccount: { findUnique: vi.fn().mockResolvedValue(null) },
    workflowExecution: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockImplementation(async ({ data }) => (legacy = { id: 'legacy_1', ...data })),
      update: vi.fn().mockImplementation(async ({ data }) => (legacy = { ...legacy, ...data })),
      findUnique: vi.fn().mockImplementation(async () => legacy),
    },
    aIExecution: {
      create: vi.fn().mockImplementation(async ({ data }) => (aiExecution = { id: 'exec_1', tokensUsed: 0, latencyMs: 0, ...data })),
      update: vi.fn().mockImplementation(async ({ data }) => (aiExecution = { ...aiExecution, ...data })),
      findUnique: vi.fn().mockImplementation(async () => aiExecution),
    },
    aIExecutionStep: {
      create: vi.fn().mockImplementation(async ({ data }) => {
        steps.push({ stepId: data.stepId, status: data.status });
        return data;
      }),
      updateMany: vi.fn().mockImplementation(async ({ where, data }) => {
        const hits = steps.filter((s) => s.stepId === where.stepId && s.status === where.status);
        for (const hit of hits) hit.status = data.status;
        return { count: hits.length };
      }),
    },
    approvalRequest: { create: vi.fn().mockResolvedValue({ id: 'ap_1' }) },
    externalIntegration: { findFirst: vi.fn().mockResolvedValue(null) },
  };
  const aiService = {
    chat: vi.fn().mockResolvedValue({ message: { content: 'model says hi' }, usage: { totalTokens: 7 } }),
  };
  const engine = new WorkflowEngineService(
    prisma,
    aiService as any,
    { retrieve: vi.fn().mockResolvedValue([]) } as any,
    { executeTurn: vi.fn() } as any,
    { getToolDefinitions: () => [], executeTool: vi.fn() } as any,
    { getActions: vi.fn(), executeAction: vi.fn() } as any,
    { resolve: vi.fn().mockReturnValue({ provider: 'openai', model: 'gpt-4o' }) } as any,
    { resolveCredential: vi.fn().mockResolvedValue({ apiKey: 'k', baseUrl: undefined }) } as any,
    { callTool: vi.fn() } as any,
  );
  return { engine, prisma, aiService, steps, state: () => ({ aiExecution, legacy }) };
}

describe('WorkflowEngineService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('runs a canvas-built LLM step with the prompt it was given', async () => {
    const { engine, aiService } = makeEngine(
      [node('start', 'START'), node('llm', 'LLM', { prompt: 'Summarise {{input.text}}', model: 'gpt-4o' })],
      [edge('start', 'llm')],
    );
    const result = await engine.executeWorkflow('wf_1', { input: { text: 'the report' } });
    expect(result.status).toBe('SUCCESS');
    expect(aiService.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: 'k',
        messages: [{ role: 'user', content: 'Summarise the report' }],
      }),
    );
  });

  it('follows only the branch a condition chose', async () => {
    const { engine, steps } = makeEngine(
      [
        node('start', 'START'),
        node('check', 'CONDITION', { expression: 'input.score >= 0.8' }),
        node('yes', 'OUTPUT', { template: 'high' }),
        node('no', 'OUTPUT', { template: 'low' }),
      ],
      [edge('start', 'check'), edge('check', 'yes', 'true'), edge('check', 'no', 'false')],
    );
    await engine.executeWorkflow('wf_1', { input: { score: 0.9 } });
    const ran = steps.map((s) => s.stepId);
    expect(ran).toContain('yes');
    expect(ran).not.toContain('no');
  });

  it('runs a merge once, after every started branch has finished', async () => {
    const { engine, steps } = makeEngine(
      [
        node('start', 'START'),
        node('a1', 'VARIABLE', { name: 'a', value: '1' }),
        node('a2', 'VARIABLE', { name: 'a2', value: '2' }),
        node('a3', 'VARIABLE', { name: 'a3', value: '3' }),
        node('b1', 'VARIABLE', { name: 'b', value: '1' }),
        node('merge', 'MERGE'),
        node('end', 'OUTPUT'),
      ],
      [
        edge('start', 'a1'),
        edge('start', 'b1'),
        edge('a1', 'a2'),
        edge('a2', 'a3'),
        edge('a3', 'merge'),
        edge('b1', 'merge'),
        edge('merge', 'end'),
      ],
    );
    await engine.executeWorkflow('wf_1', {});
    const ran = steps.map((s) => s.stepId);
    expect(ran.filter((id) => id === 'merge')).toHaveLength(1);
    expect(ran.filter((id) => id === 'end')).toHaveLength(1);
    expect(ran.indexOf('merge')).toBeGreaterThan(ran.indexOf('a3'));
  });

  it('pauses at an approval and resumes the rest of the run when approved', async () => {
    const { engine, prisma, steps, state } = makeEngine(
      [
        node('start', 'START'),
        node('approve', 'HUMAN_APPROVAL'),
        node('after', 'OUTPUT', { template: 'done' }),
      ],
      [edge('start', 'approve'), edge('approve', 'after')],
    );
    const paused = await engine.executeWorkflow('wf_1', { input: 'x' });
    expect(paused.status).toBe('WAITING_APPROVAL');
    expect(prisma.approvalRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ requesterId: 'u_1', executionId: 'exec_1' }) }),
    );
    expect(steps.map((s) => s.stepId)).not.toContain('after');

    const context = (prisma.approvalRequest.create.mock.calls[0][0].data.proposedPayload ?? {}) as Record<string, unknown>;
    const resumed = await engine.resumeAfterApproval({
      workflowId: 'wf_1',
      executionId: 'exec_1',
      stepId: 'approve',
      decision: 'APPROVED',
      approverId: 'u_admin',
      comment: 'ok',
      proposedPayload: context,
    });
    expect(resumed?.status).toBe('SUCCESS');
    expect(steps.map((s) => s.stepId)).toContain('after');
    // The waiting approval row is settled in place, not duplicated.
    expect(steps.filter((s) => s.stepId === 'approve')).toEqual([{ stepId: 'approve', status: 'SUCCESS' }]);
    expect(state().aiExecution['status']).toBe('COMPLETED');
  });

  it('closes a rejected run as failed without running the rest', async () => {
    const { engine, prisma, steps, state } = makeEngine(
      [node('start', 'START'), node('approve', 'HUMAN_APPROVAL'), node('after', 'OUTPUT')],
      [edge('start', 'approve'), edge('approve', 'after')],
    );
    await engine.executeWorkflow('wf_1', {});
    const context = prisma.approvalRequest.create.mock.calls[0][0].data.proposedPayload;
    await engine.resumeAfterApproval({
      workflowId: 'wf_1',
      executionId: 'exec_1',
      stepId: 'approve',
      decision: 'REJECTED',
      approverId: 'u_admin',
      comment: null,
      proposedPayload: context,
    });
    expect(steps.map((s) => s.stepId)).not.toContain('after');
    expect(steps.find((s) => s.stepId === 'approve')?.status).toBe('FAILED');
    expect(state().aiExecution['status']).toBe('FAILED');
  });

  it('fails a delay it cannot honour instead of shortening it', async () => {
    const { engine } = makeEngine(
      [node('start', 'START'), node('wait', 'DELAY', { seconds: 300 })],
      [edge('start', 'wait')],
    );
    const result = await engine.executeWorkflow('wf_1', {});
    expect(result.status).toBe('FAILED');
    expect(JSON.stringify(result.results)).toMatch(/aren't supported yet/);
  });

  it('refuses an HTTP step aimed at a private address', async () => {
    const { engine } = makeEngine(
      [node('start', 'START'), node('call', 'HTTP_REQUEST', { method: 'GET', url: 'http://169.254.169.254/latest/meta-data' })],
      [edge('start', 'call')],
    );
    const result = await engine.executeWorkflow('wf_1', {});
    expect(result.status).toBe('FAILED');
  });
});
