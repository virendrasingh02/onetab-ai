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

interface StepRow {
  id: string;
  stepId: string;
  status: string;
  outputJson?: unknown;
  startedAt: Date;
}

function makeEngine(
  nodes: unknown[],
  edges: unknown[],
  options: { agentProfile?: unknown; tools?: string[] } = {},
) {
  const steps: StepRow[] = [];
  const workflow = {
    id: 'wf_1',
    workspaceId: 'ws_1',
    creatorId: 'u_1',
    name: 'Test flow',
    nodesJson: JSON.stringify(nodes),
    edgesJson: JSON.stringify(edges),
    agentProfile: options.agentProfile ?? null,
  };
  let aiExecution: Record<string, unknown> = {};
  let legacy: Record<string, unknown> = {};
  let seq = 0;
  const prisma: any = {
    automationWorkflow: {
      findUniqueOrThrow: vi.fn().mockResolvedValue(workflow),
      findUnique: vi.fn().mockResolvedValue(workflow),
    },
    user: { findUnique: vi.fn().mockResolvedValue({ timezone: 'UTC' }) },
    workspaceSubscription: { findUnique: vi.fn().mockResolvedValue({ planTier: 'business' }) },
    creditAccount: { findUnique: vi.fn().mockResolvedValue(null) },
    workflowExecution: {
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockImplementation(async ({ data }) => (legacy = { id: 'legacy_1', ...data })),
      update: vi.fn().mockImplementation(async ({ data }) => (legacy = { ...legacy, ...data })),
      findUnique: vi.fn().mockImplementation(async () => legacy),
    },
    aIExecution: {
      create: vi.fn().mockImplementation(async ({ data }) => (aiExecution = { id: 'exec_1', tokensUsed: 0, latencyMs: 0, entityType: 'WORKFLOW', entityId: 'wf_1', ...data })),
      update: vi.fn().mockImplementation(async ({ data }) => (aiExecution = { ...aiExecution, ...data })),
      updateMany: vi.fn().mockImplementation(async ({ where, data }) => {
        const allowed = where.status?.in ?? (where.status ? [where.status] : null);
        if (allowed && !allowed.includes(aiExecution['status'])) return { count: 0 };
        aiExecution = { ...aiExecution, ...data };
        return { count: 1 };
      }),
      findUnique: vi.fn().mockImplementation(async () => aiExecution),
      findFirst: vi.fn().mockImplementation(async () => aiExecution),
    },
    aIExecutionStep: {
      create: vi.fn().mockImplementation(async ({ data }) => {
        const row = { id: `step_${++seq}`, stepId: data.stepId, status: data.status, outputJson: data.outputJson, startedAt: new Date(Date.now() + seq) };
        steps.push(row);
        return row;
      }),
      update: vi.fn().mockImplementation(async ({ where, data }) => {
        const row = steps.find((s) => s.id === where.id);
        if (row) Object.assign(row, { status: data.status, outputJson: data.outputJson });
        return row;
      }),
      updateMany: vi.fn().mockImplementation(async ({ where, data }) => {
        const hits = steps.filter((s) => s.stepId === where.stepId && s.status === where.status);
        for (const hit of hits) Object.assign(hit, { status: data.status, outputJson: data.outputJson });
        return { count: hits.length };
      }),
      findMany: vi.fn().mockImplementation(async () => [...steps].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())),
    },
    approvalRequest: { create: vi.fn().mockResolvedValue({ id: 'ap_1' }), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    externalIntegration: { findFirst: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn().mockImplementation(async (ops: unknown[]) => Promise.all(ops)),
  };
  const aiService = {
    chat: vi.fn().mockResolvedValue({ message: { content: 'model says hi' }, usage: { totalTokens: 7 } }),
  };
  const registry = {
    getToolDefinitions: () => (options.tools ?? []).map((name) => ({ name, description: name, parameters: {} })),
    executeTool: vi.fn().mockResolvedValue({ ok: true }),
  };
  const events = { emit: vi.fn() };
  const aiRuntime = { executeTurn: vi.fn() };
  const engine = new WorkflowEngineService(
    prisma,
    aiService as any,
    { retrieve: vi.fn().mockResolvedValue([]) } as any,
    aiRuntime as any,
    registry as any,
    { getActions: vi.fn(), executeAction: vi.fn() } as any,
    { resolve: vi.fn().mockReturnValue({ provider: 'openai', model: 'gpt-4o' }) } as any,
    { resolveCredential: vi.fn().mockResolvedValue({ apiKey: 'k', baseUrl: undefined }) } as any,
    { callTool: vi.fn() } as any,
    undefined,
    events as any,
  );
  return {
    engine,
    prisma,
    aiService,
    aiRuntime,
    registry,
    events,
    steps,
    state: () => ({ aiExecution, legacy }),
    setStatus: (status: string) => (aiExecution = { ...aiExecution, status }),
  };
}

const profile = (scopes: string[], extra: Record<string, unknown> = {}) => ({
  version: 1,
  name: 'Agent',
  kind: 'task',
  objective: '',
  trigger: { kind: 'manual' },
  context: [],
  steps: [{ id: 'x', kind: 'collect', title: 'x', tool: 'find_tasks' }],
  output: { format: 'summary', destination: 'run' },
  params: [],
  scopes,
  notify: { onComplete: false, onFailure: true, onApproval: true },
  questions: [],
  assumptions: [],
  warnings: [],
  source: { kind: 'manual' },
  ...extra,
});

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

  it('gives every run the date, its params and the run link', async () => {
    const { engine, aiService } = makeEngine(
      [node('start', 'START'), node('llm', 'LLM', { prompt: '{{now.date}}|{{params.projectId}}|{{run.link}}' })],
      [edge('start', 'llm')],
      { agentProfile: profile([], { params: [{ key: 'projectId', label: 'Project', type: 'project', value: 'p_9' }] }) },
    );
    await engine.executeWorkflow('wf_1', {});
    const content = aiService.chat.mock.calls[0][0].messages[0].content as string;
    expect(content).toMatch(/^\d{4}-\d{2}-\d{2}\|p_9\|ai\/runs\?run=exec_1$/);
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

  it('records each step as running before it finishes', async () => {
    const { engine, steps, prisma } = makeEngine(
      [node('start', 'START'), node('llm', 'LLM', { prompt: 'hi' })],
      [edge('start', 'llm')],
    );
    await engine.executeWorkflow('wf_1', {});
    expect(prisma.aIExecutionStep.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ stepId: 'llm', status: 'RUNNING' }) }),
    );
    expect(steps.find((s) => s.stepId === 'llm')?.status).toBe('SUCCESS');
  });

  it('pauses at an approval and resumes the rest of the run when approved', async () => {
    const { engine, prisma, steps, state, events } = makeEngine(
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
    expect(events.emit).toHaveBeenCalledWith('ai.approval.requested', expect.objectContaining({ runId: 'exec_1', ownerId: 'u_1' }));
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
    expect(steps.filter((s) => s.stepId === 'approve').map((s) => s.status)).toEqual(['SUCCESS']);
    expect(state().aiExecution['status']).toBe('COMPLETED');
  });

  it('uses the approver’s edit of the reviewed draft', async () => {
    const { engine, prisma, steps } = makeEngine(
      [
        node('start', 'START'),
        node('draft', 'LLM', { prompt: 'write' }),
        node('approve', 'HUMAN_APPROVAL', { reviewPath: 'draft.aiOutput', reviewLabel: 'Report' }),
        node('result', 'OUTPUT', { template: '{{draft.aiOutput}}' }),
      ],
      [edge('start', 'draft'), edge('draft', 'approve'), edge('approve', 'result')],
    );
    await engine.executeWorkflow('wf_1', {});
    const payload = prisma.approvalRequest.create.mock.calls[0][0].data.proposedPayload as Record<string, any>;
    expect(payload['__review']).toEqual({ path: 'draft.aiOutput', label: 'Report', value: 'model says hi' });
    await engine.resumeAfterApproval({
      workflowId: 'wf_1',
      executionId: 'exec_1',
      stepId: 'approve',
      decision: 'APPROVED',
      approverId: 'u_1',
      comment: null,
      proposedPayload: { ...payload, __review: { ...payload['__review'], value: 'edited by a person' } },
    });
    expect(steps.find((s) => s.stepId === 'result')?.outputJson).toEqual({ output: 'edited by a person' });
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

  it('continues down an error branch when a step fails, and says it recovered', async () => {
    const { engine, steps, state } = makeEngine(
      [
        node('start', 'START'),
        node('mail', 'TOOL', { toolName: 'nope_tool', input: '{}' }),
        node('write', 'OUTPUT', { template: 'wrote anyway' }),
      ],
      [edge('start', 'mail'), edge('mail', 'write', 'error')],
    );
    const result = await engine.executeWorkflow('wf_1', {});
    expect(result.status).toBe('SUCCESS');
    expect(steps.find((s) => s.stepId === 'mail')?.status).toBe('FAILED');
    expect(steps.find((s) => s.stepId === 'write')?.status).toBe('SUCCESS');
    expect(state().aiExecution['errorsJson']).toEqual({ recovered: [expect.objectContaining({ stepId: 'mail' })] });
  });

  it('never follows an error branch after a success', async () => {
    const { engine, steps } = makeEngine(
      [
        node('start', 'START'),
        node('read', 'TOOL', { toolName: 'find_tasks', input: '{}' }),
        node('ok', 'OUTPUT', { template: 'ok' }),
        node('fallback', 'OUTPUT', { template: 'fallback' }),
      ],
      [edge('start', 'read'), edge('read', 'ok'), edge('read', 'fallback', 'error')],
      { tools: ['find_tasks'] },
    );
    await engine.executeWorkflow('wf_1', {});
    const ran = steps.map((s) => s.stepId);
    expect(ran).toContain('ok');
    expect(ran).not.toContain('fallback');
  });

  it('refuses a tool outside the agent’s granted permissions, without retrying', async () => {
    const { engine, registry, steps } = makeEngine(
      [node('start', 'START'), node('save', 'TOOL', { toolName: 'create_doc', input: '{"title":"x"}', retries: 3 })],
      [edge('start', 'save')],
      { agentProfile: profile(['tasks:read']), tools: ['create_doc'] },
    );
    const result = await engine.executeWorkflow('wf_1', {});
    expect(result.status).toBe('FAILED');
    expect(registry.executeTool).not.toHaveBeenCalled();
    const output = steps.find((s) => s.stepId === 'save')?.outputJson as Record<string, unknown>;
    expect(output['errorCode']).toBe('MISSING_PERMISSION');
    expect(String(output['error'])).toMatch(/Create docs/);
  });

  it('in a test run, reads for real but simulates writes and approvals', async () => {
    const { engine, registry, prisma, steps, state } = makeEngine(
      [
        node('start', 'START'),
        node('read', 'TOOL', { toolName: 'find_tasks', input: '{}' }),
        node('approve', 'HUMAN_APPROVAL', { reviewPath: 'read.toolResult' }),
        node('save', 'TOOL', { toolName: 'create_doc', input: '{"title":"Report"}' }),
      ],
      [edge('start', 'read'), edge('read', 'approve'), edge('approve', 'save')],
      { agentProfile: profile(['tasks:read', 'docs:write']), tools: ['find_tasks', 'create_doc'] },
    );
    const result = await engine.executeWorkflow('wf_1', {}, { mode: 'test' });
    expect(result.status).toBe('SUCCESS');
    expect(registry.executeTool).toHaveBeenCalledTimes(1);
    expect(registry.executeTool).toHaveBeenCalledWith('find_tasks', {}, expect.anything());
    expect(prisma.approvalRequest.create).not.toHaveBeenCalled();
    expect(steps.find((s) => s.stepId === 'save')).toMatchObject({ status: 'SKIPPED', outputJson: expect.objectContaining({ dryRun: true, wouldRun: 'create_doc' }) });
    expect(steps.find((s) => s.stepId === 'approve')?.outputJson).toMatchObject({ simulated: true });
    expect(state().aiExecution['stateJson']).toMatchObject({ __mode: 'test' });
  });

  it('retries a transient failure, but not a missing connection', async () => {
    const { engine, registry } = makeEngine(
      [node('start', 'START'), node('read', 'TOOL', { toolName: 'find_tasks', input: '{}', retries: 2 })],
      [edge('start', 'read')],
      { tools: ['find_tasks'] },
    );
    registry.executeTool.mockRejectedValueOnce(new Error('connect ETIMEDOUT')).mockResolvedValueOnce({ ok: true });
    const first = await engine.executeWorkflow('wf_1', {});
    expect(first.status).toBe('SUCCESS');
    expect(registry.executeTool).toHaveBeenCalledTimes(2);

    registry.executeTool.mockReset();
    registry.executeTool.mockRejectedValue(new Error('Gmail isn’t connected. Connect Gmail in Integrations.'));
    const second = await engine.executeWorkflow('wf_1', {});
    expect(second.status).toBe('FAILED');
    expect(registry.executeTool).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(second.results)).toMatch(/MISSING_CONNECTION/);
  });

  it('stops at the next step when cancelled mid-run', async () => {
    const { engine, aiService, steps, state, setStatus } = makeEngine(
      [node('start', 'START'), node('one', 'LLM', { prompt: 'a' }), node('two', 'LLM', { prompt: 'b' })],
      [edge('start', 'one'), edge('one', 'two')],
    );
    aiService.chat.mockImplementationOnce(async () => {
      setStatus('CANCELLED');
      return { message: { content: 'first' }, usage: { totalTokens: 1 } };
    });
    const result = await engine.executeWorkflow('wf_1', {});
    expect(result.status).toBe('CANCELLED');
    expect(steps.map((s) => s.stepId)).not.toContain('two');
    expect(state().aiExecution['status']).toBe('CANCELLED');
  });

  it('pauses between steps and resumes where it stopped', async () => {
    const { engine, aiService, steps, state, setStatus } = makeEngine(
      [node('start', 'START'), node('one', 'LLM', { prompt: 'a' }), node('two', 'OUTPUT', { template: '{{one.aiOutput}}' })],
      [edge('start', 'one'), edge('one', 'two')],
    );
    aiService.chat.mockImplementationOnce(async () => {
      setStatus('PAUSED');
      return { message: { content: 'first' }, usage: { totalTokens: 1 } };
    });
    const paused = await engine.executeWorkflow('wf_1', {});
    expect(paused.status).toBe('PAUSED');
    expect(state().aiExecution['status']).toBe('PAUSED');
    expect((state().aiExecution['stateJson'] as any).__resume.next).toEqual(['two']);

    await engine.resumeRun('ws_1', 'exec_1');
    await vi.waitFor(() => expect(state().aiExecution['status']).toBe('COMPLETED'));
    expect(steps.find((s) => s.stepId === 'two')?.outputJson).toEqual({ output: 'first' });
  });

  it('restarts from a step with what the earlier steps produced', async () => {
    const { engine, registry, steps, prisma } = makeEngine(
      [
        node('start', 'START'),
        node('read', 'TOOL', { toolName: 'find_tasks', input: '{}' }),
        node('write', 'OUTPUT', { template: 'n={{read.toolResult.count}}' }),
      ],
      [edge('start', 'read'), edge('read', 'write')],
      { tools: ['find_tasks'] },
    );
    registry.executeTool.mockResolvedValue({ count: 3 });
    await engine.executeWorkflow('wf_1', {});
    registry.executeTool.mockClear();
    prisma.aIExecution.findFirst.mockResolvedValueOnce({
      id: 'exec_1',
      entityType: 'WORKFLOW',
      entityId: 'wf_1',
      status: 'FAILED',
      stateJson: {},
    });
    await engine.restartFromStep('ws_1', 'exec_1', 'write', 'u_1');
    await vi.waitFor(() => expect(steps.filter((s) => s.stepId === 'write')[1]?.status).toBe('SUCCESS'));
    expect(registry.executeTool).not.toHaveBeenCalled();
    expect(steps.filter((s) => s.stepId === 'write')[1]?.outputJson).toEqual({ output: 'n=3' });
  });

  it('reports a finished run for notifications', async () => {
    const { engine, events } = makeEngine([node('start', 'START'), node('end', 'OUTPUT')], [edge('start', 'end')]);
    await engine.executeWorkflow('wf_1', {}, { startedBy: 'schedule' });
    expect(events.emit).toHaveBeenCalledWith(
      'ai.run.finished',
      expect.objectContaining({ runId: 'exec_1', status: 'COMPLETED', startedBy: 'schedule', ownerId: 'u_1', test: false }),
    );
  });
});

describe('WorkflowEngineService — agentic execution', () => {
  it('runs independent branches at the same time, then joins them', async () => {
    const { engine, aiService, steps } = makeEngine(
      [
        node('start', 'START'),
        node('fork', 'PARALLEL'),
        node('a', 'LLM', { prompt: 'A' }),
        node('b', 'LLM', { prompt: 'B' }),
        node('join', 'MERGE'),
        node('end', 'OUTPUT'),
      ],
      [edge('start', 'fork'), edge('fork', 'a'), edge('fork', 'b'), edge('a', 'join'), edge('b', 'join'), edge('join', 'end')],
    );
    let running = 0;
    let peak = 0;
    aiService.chat.mockImplementation(async ({ messages }: any) => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 20));
      running--;
      return { message: { content: `said ${messages[0].content}` }, usage: { totalTokens: 5 } };
    });

    const run = await engine.executeWorkflow('wf_1', {});

    expect(run.status).toBe('SUCCESS');
    expect(peak).toBe(2);
    const join = run.results.find((r) => r.stepId === 'join')!;
    expect((join.output as any).merged).toMatchObject({ a: expect.objectContaining({ aiOutput: 'said A' }), b: expect.objectContaining({ aiOutput: 'said B' }) });
    expect((join.output as any).output).toContain('### a\nsaid A');
    expect(steps.filter((s) => s.stepId === 'join')).toHaveLength(1);
  });

  it('feeds each step the previous step’s text by default', async () => {
    const { engine, aiService } = makeEngine(
      [node('start', 'START'), node('one', 'LLM', { prompt: 'Summarise: {{__last}}' }), node('two', 'LLM', { prompt: 'Translate: {{__last}}' })],
      [edge('start', 'one'), edge('one', 'two')],
    );
    aiService.chat
      .mockResolvedValueOnce({ message: { content: 'short version' }, usage: { totalTokens: 1 } })
      .mockResolvedValueOnce({ message: { content: 'version courte' }, usage: { totalTokens: 1 } });

    await engine.executeWorkflow('wf_1', { message: 'a long text' });

    expect(aiService.chat.mock.calls[0][0].messages[0].content).toBe('Summarise: a long text');
    expect(aiService.chat.mock.calls[1][0].messages[0].content).toBe('Translate: short version');
  });

  it('runs a loop’s each-branch once per item and continues after it', async () => {
    const { engine, aiService, steps } = makeEngine(
      [node('start', 'START'), node('loop', 'LOOP', { itemsKey: 'rows' }), node('each', 'LLM', { prompt: 'Handle {{item}} #{{index}}' }), node('after', 'OUTPUT')],
      [edge('start', 'loop'), edge('loop', 'each', 'each'), edge('loop', 'after')],
    );
    aiService.chat.mockImplementation(async ({ messages }: any) => ({ message: { content: `done ${messages[0].content}` }, usage: { totalTokens: 2 } }));

    const run = await engine.executeWorkflow('wf_1', { rows: ['x', 'y', 'z'] });

    expect(run.status).toBe('SUCCESS');
    const prompts = aiService.chat.mock.calls.map((c: any) => c[0].messages[0].content);
    expect(prompts).toEqual(['Handle x #0', 'Handle y #1', 'Handle z #2']);
    const loop = run.results.find((r) => r.stepId === 'loop')!;
    expect(loop.output).toMatchObject({ iterations: 3, loopResults: ['done Handle x #0', 'done Handle y #1', 'done Handle z #2'], tokensUsed: 6 });
    // The body ran inside the loop, not again afterwards.
    expect(steps.filter((s) => s.stepId === 'each')).toHaveLength(3);
    expect(steps.map((s) => s.stepId)).toContain('after');
  });

  it('refuses a loop over something that is not a list, and an approval inside a loop', async () => {
    const notList = makeEngine(
      [node('start', 'START'), node('loop', 'LOOP', { itemsKey: 'rows' }), node('each', 'LLM')],
      [edge('start', 'loop'), edge('loop', 'each', 'each')],
    );
    const bad = await notList.engine.executeWorkflow('wf_1', { rows: 42 });
    expect(bad.status).toBe('FAILED');

    const gated = makeEngine(
      [node('start', 'START'), node('loop', 'LOOP', { itemsKey: 'rows' }), node('ok', 'HUMAN_APPROVAL')],
      [edge('start', 'loop'), edge('loop', 'ok', 'each')],
    );
    const refused = await gated.engine.executeWorkflow('wf_1', { rows: [1] });
    expect(refused.status).toBe('FAILED');
    expect((refused.results.find((r) => r.stepId === 'loop')!.output as any).error).toMatch(/Approvals inside a loop/);
  });

  it('stops a run at its step limit', async () => {
    const { engine } = makeEngine(
      [node('start', 'START'), node('loop', 'LOOP', { itemsKey: 'rows' }), node('each', 'VARIABLE', { name: 'v', value: '{{item}}' })],
      [edge('start', 'loop'), edge('loop', 'each', 'each')],
    );
    const run = await (engine as any).executeWorkflow('wf_1', { rows: [1, 2, 3, 4, 5] }, { limits: { maxSteps: 4 } });
    expect(run.status).toBe('FAILED');
    expect((run.results.find((r: any) => r.stepId === 'loop').output as any).error).toMatch(/at most 4/);
  });

  it('skips a step the canvas can’t run yet, visibly, and carries on', async () => {
    const { engine, steps } = makeEngine(
      [node('start', 'START'), node('g', 'UNSUPPORTED', { reason: 'Not yet.', originalType: 'AI_GUARDRAIL' }), node('end', 'OUTPUT')],
      [edge('start', 'g'), edge('g', 'end')],
    );
    const run = await engine.executeWorkflow('wf_1', {});
    expect(run.status).toBe('SUCCESS');
    expect(run.results.find((r) => r.stepId === 'g')).toMatchObject({ status: 'SKIPPED', type: 'AI_GUARDRAIL', output: { reason: 'Not yet.' } });
    expect(steps.map((s) => s.stepId)).toContain('end');
  });

  it('keeps a branch that was ready beside an approval, and runs it once approved', async () => {
    const { engine, prisma, steps } = makeEngine(
      [node('start', 'START'), node('fork', 'PARALLEL'), node('ok', 'HUMAN_APPROVAL'), node('slow1', 'VARIABLE', { name: 'a', value: '1' }), node('slow2', 'VARIABLE', { name: 'b', value: '2' }), node('after', 'OUTPUT')],
      [edge('start', 'fork'), edge('fork', 'ok'), edge('fork', 'slow1'), edge('slow1', 'slow2'), edge('ok', 'after')],
    );
    let payload: Record<string, unknown> = {};
    prisma.approvalRequest.create.mockImplementation(async ({ data }: any) => {
      payload = data.proposedPayload;
      return { id: 'ap_1' };
    });
    prisma.approvalRequest.findFirst = vi.fn().mockResolvedValue({ id: 'ap_1', proposedPayload: {} });
    prisma.approvalRequest.update = vi.fn().mockImplementation(async ({ data }: any) => {
      payload = { ...payload, ...data.proposedPayload };
      return {};
    });

    const paused = await engine.executeWorkflow('wf_1', {});
    expect(paused.status).toBe('WAITING_APPROVAL');
    // The other lane ran first; the approval waited until nothing else was ready.
    expect(steps.map((s) => s.stepId)).toEqual(expect.arrayContaining(['slow1', 'slow2']));

    await engine.resumeAfterApproval({
      workflowId: 'wf_1',
      executionId: 'exec_1',
      stepId: 'ok',
      decision: 'APPROVED',
      approverId: 'u_2',
      comment: null,
      proposedPayload: payload,
    });
    expect(steps.map((s) => s.stepId)).toContain('after');
  });

  it('runs a canvas agent as its host agent, sharing one team budget across the run', async () => {
    const spec = { key: 'a1', name: 'Researcher', instructions: 'x', tools: [], knowledge: [], delegation: 'router', members: [] };
    const { engine, aiRuntime } = makeEngine(
      [node('start', 'START'), node('a1', 'AGENT', { inlineAgent: spec, hostAgentId: 'host_1', goal: 'Look into {{__last}}' }), node('a2', 'AGENT', { inlineAgent: { ...spec, key: 'a2' }, hostAgentId: 'host_1' })],
      [edge('start', 'a1'), edge('a1', 'a2')],
    );
    aiRuntime.executeTurn.mockResolvedValue({ result: 'findings', tools: [], tokensUsed: 12 });

    const run = await engine.executeWorkflow('wf_1', { message: 'solar panels' }, { mode: 'test' });

    expect(run.status).toBe('SUCCESS');
    const [first, second] = aiRuntime.executeTurn.mock.calls;
    expect(first[1]).toBe('host_1');
    expect(first[2]).toBe('Look into solar panels');
    expect(first[3]).toMatchObject({ inlineAgent: spec, readOnly: true, requesterId: 'u_1', team: expect.objectContaining({ executionId: 'exec_1' }) });
    expect(second[3].team).toBe(first[3].team);
    expect(second[2]).toBe('Do your task using what the run has so far.');
    expect(run.results.find((r) => r.stepId === 'a1')!.output).toMatchObject({ entityResponse: 'findings', tokensUsed: 12 });
  });

  it('fails a canvas agent that isn’t attached to a saved agent, instead of guessing', async () => {
    const { engine, aiRuntime } = makeEngine(
      [node('start', 'START'), node('a1', 'AGENT', { inlineAgent: { key: 'a1', name: 'Solo', instructions: '', tools: [], knowledge: [], delegation: 'router', members: [] } })],
      [edge('start', 'a1')],
    );
    const run = await engine.executeWorkflow('wf_1', {});
    expect(run.status).toBe('FAILED');
    expect(aiRuntime.executeTurn).not.toHaveBeenCalled();
  });
});
