import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InlineAgentSpec } from '@org/types';
import { AIRuntimeService, composeTeamPrompt, memberToolName, mergeStricterPolicies, newAgentTeamRun } from './ai-runtime.service.js';

const agent = (key: string, name: string, extra: Partial<InlineAgentSpec> = {}): InlineAgentSpec => ({
  key,
  name,
  instructions: `You are ${name}.`,
  tools: [],
  knowledge: [],
  delegation: 'router',
  members: [],
  ...extra,
});

/** A model stub that answers by who is asking (the system prompt). */
type Reply = { content?: string; toolCalls?: Array<{ name: string; args: Record<string, unknown> }> };

describe('AIRuntimeService — canvas agents and teams', () => {
  let service: AIRuntimeService;
  let prisma: any;
  let aiService: any;
  let credentialService: any;
  let mcpRegistry: any;
  let modelResolver: any;
  let tasks: any[];
  let messages: any[];
  let replies: Record<string, Reply[]>;
  let prompts: Array<{ system: string; user: string }>;

  beforeEach(() => {
    tasks = [];
    messages = [];
    prompts = [];
    replies = {};
    prisma = {
      aIAgent: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'host_1',
          name: 'Host',
          type: 'agent',
          role: 'Assistant',
          systemPrompt: 'Host prompt',
          provider: 'nvidia',
          model: 'host-model',
          tools: '[]',
          isActive: true,
          creatorId: 'user_1',
          configuration: {},
          workspace: { name: 'WS' },
        }),
        findMany: vi.fn().mockResolvedValue([]),
        update: vi.fn(),
      },
      agentExecutionLog: { create: vi.fn().mockResolvedValue({ id: 'log_1' }) },
      creditAccount: { findUnique: vi.fn().mockResolvedValue(null) },
      aIMemory: { findMany: vi.fn().mockResolvedValue([]) },
      aIExecution: {
        create: vi.fn().mockResolvedValue({ id: 'exec_1' }),
        update: vi.fn().mockResolvedValue({}),
      },
      aIExecutionStep: { create: vi.fn().mockResolvedValue({}) },
      agentTask: {
        create: vi.fn(async ({ data }: any) => {
          const row = { id: `task_${tasks.length + 1}`, ...data };
          tasks.push(row);
          return row;
        }),
        update: vi.fn(async ({ where, data }: any) => {
          const row = tasks.find((t) => t.id === where.id);
          Object.assign(row, data);
          return row;
        }),
      },
      agentMessage: {
        create: vi.fn(async ({ data }: any) => {
          messages.push(data);
          return { id: `msg_${messages.length}`, ...data };
        }),
      },
    };
    let call = 0;
    aiService = {
      chat: vi.fn(async ({ messages: convo, tools }: any) => {
        const system = String(convo[0].content);
        const user = String(convo[1].content);
        prompts.push({ system, user });
        const who = Object.keys(replies).find((name) => system.startsWith(`You are ${name}.`));
        const queue = who ? replies[who]! : [];
        const reply = queue.length > 1 ? queue.shift()! : (queue[0] ?? { content: 'ok' });
        const offered = new Set((tools ?? []).map((t: any) => t.function.name));
        return {
          message: {
            role: 'assistant',
            content: reply.content ?? '',
            toolCalls: (reply.toolCalls ?? [])
              .filter((c) => offered.has(c.name))
              .map((c) => ({ id: `call_${++call}`, function: { name: c.name, arguments: JSON.stringify(c.args) } })),
          },
          usage: { totalTokens: 10 },
        };
      }),
    };
    credentialService = { resolveCredential: vi.fn().mockResolvedValue({ apiKey: 'key' }) };
    mcpRegistry = {
      getToolSchemas: vi.fn().mockReturnValue([{ type: 'function', function: { name: 'everything' } }]),
      getToolSchemasFor: vi.fn((names: string[]) => names.map((name) => ({ type: 'function', function: { name } }))),
      getToolDefinitions: vi.fn().mockReturnValue([]),
      hasTool: vi.fn(() => true),
      executeTool: vi.fn(),
    };
    modelResolver = { resolve: vi.fn(({ requestedModel }: any) => ({ provider: requestedModel.startsWith('gpt') ? 'openai' : 'nvidia', model: requestedModel })) };

    service = new AIRuntimeService(
      prisma,
      aiService,
      credentialService,
      mcpRegistry,
      { getToolsForEntity: vi.fn().mockResolvedValue([]) } as any,
      { executeAction: vi.fn() } as any,
      { createForEntityAction: vi.fn().mockResolvedValue({ id: 'approval_1' }) } as any,
      { deductCredits: vi.fn().mockResolvedValue(undefined) } as any,
      { broadcastToWorkspace: vi.fn().mockResolvedValue(undefined) } as any,
      { getToolBindings: vi.fn().mockResolvedValue([]), callTool: vi.fn() } as any,
      { retrieve: vi.fn().mockResolvedValue([]) } as any,
      { emit: vi.fn() } as any,
      modelResolver,
    );
  });

  it('runs a canvas agent as its host, with only the tools drawn on it', async () => {
    replies['Solo'] = [{ content: 'done' }];
    const result = await service.executeTurn('ws_1', 'host_1', 'Do it', { inlineAgent: agent('a1', 'Solo') });

    expect(result.result).toBe('done');
    expect(result.entityName).toBe('Solo');
    expect(prompts[0]!.system.startsWith('You are Solo.')).toBe(true);
    // No tools drawn → none offered (an agent row with no list gets everything).
    expect(mcpRegistry.getToolSchemas).not.toHaveBeenCalled();
    expect(aiService.chat.mock.calls[0][0].tools).toBeUndefined();
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ agentKey: 'a1', executionId: 'exec_1', status: 'COMPLETED', parentTaskId: null });
  });

  it('lets a router supervisor delegate, both members in the same round, and records the work', async () => {
    const research = agent('r', 'Researcher');
    const writer = agent('w', 'Writer');
    const lead = agent('lead', 'Lead', { members: [research, writer] });
    replies['Lead'] = [
      {
        toolCalls: [
          { name: memberToolName(research, 0), args: { request: 'Find facts' } },
          { name: memberToolName(writer, 1), args: { request: 'Draft intro' } },
        ],
      },
      { content: 'Final report' },
    ];
    replies['Researcher'] = [{ content: 'facts' }];
    replies['Writer'] = [{ content: 'intro' }];

    const result = await service.executeTurn('ws_1', 'host_1', 'Write a report', { inlineAgent: lead });

    expect(result.result).toBe('Final report');
    // Lead's two calls + one call per member, 10 tokens each.
    expect(result.tokensUsed).toBe(40);
    const byKey = Object.fromEntries(tasks.map((t) => [t.agentKey, t]));
    expect(byKey['lead']).toMatchObject({ status: 'COMPLETED', parentTaskId: null });
    expect(byKey['r']).toMatchObject({ status: 'COMPLETED', parentTaskId: byKey['lead'].id, delegatedBy: 'lead' });
    expect(byKey['w']).toMatchObject({ status: 'COMPLETED', output: expect.objectContaining({ result: 'intro' }) });
    expect(messages.map((m) => `${m.fromName}>${m.toName}:${m.kind}`).sort()).toEqual(
      ['Lead>Researcher:task', 'Lead>Writer:task', 'Researcher>Lead:result', 'Writer>Lead:result'].sort(),
    );
    expect(result.tools.map((t) => t.status)).toEqual(['success', 'success']);
  });

  it('runs a sequential team in order, each member seeing the one before', async () => {
    const lead = agent('lead', 'Lead', { delegation: 'sequential', members: [agent('a', 'Alpha'), agent('b', 'Beta')] });
    replies['Alpha'] = [{ content: 'alpha-out' }];
    replies['Beta'] = [{ content: 'beta-out' }];
    replies['Lead'] = [{ content: 'merged' }];

    await service.executeTurn('ws_1', 'host_1', 'Plan', { inlineAgent: lead });

    const order = prompts.map((p) => p.system.split('.')[0]);
    expect(order).toEqual(['You are Alpha', 'You are Beta', 'You are Lead']);
    expect(prompts[1]!.user).toContain('alpha-out');
    expect(prompts[2]!.user).toContain('### Alpha\nalpha-out');
    expect(prompts[2]!.user).toContain('### Beta\nbeta-out');
    const beta = tasks.find((t) => t.agentKey === 'b');
    expect(beta.dependencies).toEqual([tasks.find((t) => t.agentKey === 'a').id]);
  });

  it('refuses delegations beyond the team budget and tells the supervisor', async () => {
    const one = agent('x', 'X');
    const two = agent('y', 'Y');
    const lead = agent('lead', 'Lead', { members: [one, two] });
    replies['Lead'] = [
      { toolCalls: [{ name: memberToolName(one, 0), args: { request: 'a' } }] },
      { toolCalls: [{ name: memberToolName(two, 1), args: { request: 'b' } }] },
      { content: 'wrapped up' },
    ];

    const team = newAgentTeamRun('run_9', { maxDelegations: 1 });
    const result = await service.executeTurn('ws_1', 'host_1', 'Go', { inlineAgent: lead, team });

    expect(team.delegations).toBe(1);
    expect(result.tools[1]).toMatchObject({ status: 'failed', error: expect.stringMatching(/all 1 delegations/) });
    expect(tasks.every((t) => t.executionId === 'run_9')).toBe(true);
    expect(tasks.map((t) => t.agentKey)).toEqual(['lead', 'x']);
  });

  it('stops a team at the depth cap', async () => {
    const level = (n: number, members: InlineAgentSpec[] = []) => agent(`d${n}`, `D${n}`, { delegation: 'sequential', members });
    const chain = level(1, [level(2, [level(3, [level(4, [level(5)])])])]);

    await service.executeTurn('ws_1', 'host_1', 'Go', { inlineAgent: chain });

    // The lead plus three levels of delegation; the fifth is refused.
    expect(tasks.map((t) => t.agentKey)).toEqual(['d1', 'd2', 'd3', 'd4']);
    expect(prompts.find((p) => p.system.startsWith('You are D4.'))!.user).toMatch(/could not finish: A team can delegate at most 3 levels down/);
  });

  it('falls back to the host model when the canvas model’s provider has no key, and says so', async () => {
    credentialService.resolveCredential.mockResolvedValue({ apiKey: '' });
    const result = await service.executeTurn('ws_1', 'host_1', 'Hi', { inlineAgent: agent('a', 'Solo', { model: 'gpt-4o' }) });

    expect(aiService.chat.mock.calls[0][0]).toMatchObject({ provider: 'nvidia', model: 'host-model' });
    expect(result.notices).toEqual([expect.stringMatching(/set to gpt-4o, but openai isn’t connected/)]);
  });

  it('tries the canvas fallback model before the host model', async () => {
    credentialService.resolveCredential.mockImplementation(async (provider: string) => ({ apiKey: provider === 'openai' ? '' : 'key' }));
    const result = await service.executeTurn('ws_1', 'host_1', 'Hi', {
      inlineAgent: agent('a', 'Solo', { model: 'gpt-4o', fallbackModel: 'claude-sonnet-4-5' }),
    });

    expect(aiService.chat.mock.calls[0][0]).toMatchObject({ model: 'claude-sonnet-4-5' });
    expect(result.notices).toEqual([expect.stringMatching(/openai isn’t connected .* used its fallback claude-sonnet-4-5/)]);
  });

  it('refuses to host a canvas agent on a coworker', async () => {
    prisma.aIAgent.findFirst.mockResolvedValue({ id: 'c', name: 'Tracker', type: 'coworker', isActive: true, workspace: { name: 'WS' } });
    await expect(service.executeTurn('ws_1', 'c', 'Hi', { inlineAgent: agent('a', 'Solo') })).rejects.toThrow(/run on an agent/);
  });
});

describe('team helpers', () => {
  it('names delegation tools readably and uniquely', () => {
    expect(memberToolName({ name: 'Market Researcher!' }, 0)).toBe('delegate_to_1_market_researcher');
    expect(memberToolName({ name: '日本' }, 2)).toBe('delegate_to_3_agent');
  });

  it('lets a canvas tighten tool policies but never loosen them', () => {
    expect(
      mergeStricterPolicies(
        { send_email: 'blocked', create_task: 'auto_allow' },
        { send_email: 'ask_user', create_task: 'ask_user', search_docs: 'auto_allow', delete_doc: 'blocked' },
      ),
    ).toEqual({ send_email: 'blocked', create_task: 'ask_user', delete_doc: 'blocked' });
  });

  it('puts failures in the supervisor prompt instead of hiding them', () => {
    expect(composeTeamPrompt('Q', [{ name: 'A', ok: false, result: 'timeout' }])).toContain('### A\n(could not finish: timeout)');
  });
});
