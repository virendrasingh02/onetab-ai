import { describe, expect, it } from 'vitest';
import {
  agentToolGate,
  agentToolNeedsApproval,
  convertLegacyAgentGraph,
  DEFAULT_AGENT_RUNTIME,
  deriveAgentFromGraph,
  isAgentBuilderGraph,
  readAgentRuntime,
} from './agent-config.js';

const node = (id: string, kind: string, config: Record<string, unknown>) => ({
  id,
  type: kind,
  position: { x: 0, y: 0 },
  data: { kind, config },
});

const builderGraph = (extra: unknown[] = []) =>
  JSON.stringify({
    nodes: [
      node('a', 'agent', { name: 'Triage Bot', role: 'Support triage', objective: 'Route tickets', autonomy: 'supervised' }),
      node('m', 'model', { provider: 'openai', model: 'gpt-4o', temperature: 0.1, maxTokens: 2048 }),
      node('p', 'prompt', { systemPrompt: 'You triage tickets.', responseFormat: 'json' }),
      node('t1', 'tool', { toolId: 'search_docs', requiresApproval: false }),
      node('t2', 'tool', { toolId: 'create_task', requiresApproval: true }),
      node('t3', 'tool', { toolId: 'create_task' }),
      ...extra,
    ],
    edges: [],
  });

describe('deriveAgentFromGraph', () => {
  it('maps identity, model, instructions and tools onto the runtime columns', () => {
    const derived = deriveAgentFromGraph(builderGraph());
    expect(derived).toMatchObject({
      name: 'Triage Bot',
      role: 'Support triage',
      description: 'Route tickets',
      provider: 'openai',
      model: 'gpt-4o',
      systemPrompt: 'You triage tickets.',
      tools: ['search_docs', 'create_task'],
    });
    expect(derived?.runtime).toMatchObject({
      autonomy: 'supervised',
      temperature: 0.1,
      maxTokens: 2048,
      responseFormat: 'json',
      toolPolicies: { create_task: { requiresApproval: true } },
      useWorkspaceMemory: false,
    });
  });

  it('reads knowledge, guardrails, schedules and outputs', () => {
    const derived = deriveAgentFromGraph(
      builderGraph([
        node('mem', 'memory', { strategy: 'summary' }),
        node('k', 'knowledge', { knowledgeBaseId: 'kb_1', topK: 99 }),
        node('k2', 'knowledge', { collection: 'legacy-free-text' }),
        node('g1', 'guardrail', { policy: 'pii-redaction', action: 'block' }),
        node('g2', 'guardrail', { policy: 'cost-cap', maxTokens: 1500 }),
        node('tr', 'trigger', { type: 'schedule', expression: '0 9 * * 1-5', task: 'Summarise overnight tickets', enabled: true }),
        node('tr2', 'trigger', { type: 'mention', expression: '@bot' }),
        node('o1', 'output', { channel: 'matrix-channel', target: 'ch_1' }),
        node('o2', 'output', { channel: 'task', target: '' }),
        node('o3', 'output', { channel: 'email', target: 'a@b.c' }),
      ]),
    );
    expect(derived?.runtime).toMatchObject({
      useWorkspaceMemory: true,
      knowledge: [{ knowledgeBaseId: 'kb_1', topK: 20 }],
      guardrails: { pii: 'block', maxTokensPerRun: 1500 },
      schedules: [{ cronExpression: '0 9 * * 1-5', task: 'Summarise overnight tickets', enabled: true }],
      outputs: [
        { kind: 'channel', target: 'ch_1' },
        { kind: 'task', target: '' },
      ],
    });
  });

  it('ignores nodes that are not wired to the agent core', () => {
    const graph = JSON.stringify({
      nodes: [
        node('a', 'agent', { name: 'Bot' }),
        node('p', 'prompt', { systemPrompt: 'Hi' }),
        node('t1', 'tool', { toolId: 'search_docs' }),
        node('t2', 'tool', { toolId: 'create_task' }),
        node('o', 'output', { channel: 'webhook', url: 'https://hooks.example.com/x' }),
      ],
      edges: [
        { id: 'e1', source: 'p', target: 'a' },
        { id: 'e2', source: 't1', target: 'a' },
        { id: 'e3', source: 'a', target: 'o' },
      ],
    });
    const derived = deriveAgentFromGraph(graph)!;
    expect(derived.tools).toEqual(['search_docs']);
    expect(derived.runtime.outputs).toEqual([{ kind: 'webhook', target: 'https://hooks.example.com/x' }]);
  });

  it('falls back to semi autonomy for an unknown value', () => {
    const graph = JSON.stringify({ nodes: [node('a', 'agent', { name: 'X', autonomy: 'yolo' })], edges: [] });
    expect(deriveAgentFromGraph(graph)?.runtime.autonomy).toBe('semi');
  });

  it('derives nothing from a legacy Studio graph or garbage', () => {
    expect(deriveAgentFromGraph(JSON.stringify({ nodes: [{ id: 's', type: 'START', data: {} }] }))).toBeNull();
    expect(deriveAgentFromGraph('not json')).toBeNull();
    expect(deriveAgentFromGraph(null)).toBeNull();
  });
});

describe('agentToolNeedsApproval', () => {
  const runtime = (autonomy: 'supervised' | 'semi' | 'autonomous', policies = {}) => ({
    ...DEFAULT_AGENT_RUNTIME,
    autonomy,
    toolPolicies: policies,
  });

  it('supervised gates every tool, reads included', () => {
    expect(agentToolNeedsApproval(runtime('supervised'), 'search_docs')).toBe(true);
  });

  it('semi lets reads through and gates writes and unknown tools', () => {
    expect(agentToolNeedsApproval(runtime('semi'), 'search_docs')).toBe(false);
    expect(agentToolNeedsApproval(runtime('semi'), 'create_task')).toBe(true);
    expect(agentToolNeedsApproval(runtime('semi'), 'mcp_abc_delete')).toBe(true);
  });

  it('autonomous only gates tools flagged by the builder', () => {
    expect(agentToolNeedsApproval(runtime('autonomous'), 'create_task')).toBe(false);
    expect(
      agentToolNeedsApproval(runtime('autonomous', { create_task: { requiresApproval: true } }), 'create_task'),
    ).toBe(true);
  });
});

describe('readAgentRuntime', () => {
  it('defaults to the previous behaviour when an agent has no runtime config', () => {
    expect(readAgentRuntime({})).toEqual(DEFAULT_AGENT_RUNTIME);
    expect(readAgentRuntime(null).autonomy).toBe('autonomous');
  });

  it('repairs malformed collections', () => {
    const runtime = readAgentRuntime({ runtime: { autonomy: 'semi', knowledge: 'x', outputs: null } });
    expect(runtime.autonomy).toBe('semi');
    expect(runtime.knowledge).toEqual([]);
    expect(runtime.outputs).toEqual([]);
  });
});

describe('convertLegacyAgentGraph', () => {
  const legacy = JSON.stringify({
    nodes: [
      { id: 's', type: 'START', data: { label: 'Start' } },
      { id: 'f', type: 'FIRECRAWL_SEARCH', data: { label: 'Search', config: { query: '{{input}}' } } },
      { id: 'a', type: 'AGENT', data: { label: 'Writer', config: { instructions: 'Write a brief.', model: 'gpt-4o', temperature: 0.4 } } },
      { id: 'c', type: 'IF_ELSE', data: { label: 'Has results?' } },
      { id: 'x', type: 'TRANSFORM', data: { label: 'Format' } },
      { id: 'h', type: 'USER_APPROVAL', data: { label: 'Approve' } },
      { id: 'e', type: 'END', data: { label: 'Done' } },
    ],
    edges: [],
  });

  it('carries identity, instructions, model and tools into a builder graph', () => {
    const result = convertLegacyAgentGraph(legacy, { name: 'Research Agent', role: 'Researcher' });
    expect(result).not.toBeNull();
    const graphJson = JSON.stringify(result!.graph);
    expect(isAgentBuilderGraph(graphJson)).toBe(true);
    const derived = deriveAgentFromGraph(graphJson)!;
    expect(derived).toMatchObject({
      name: 'Research Agent',
      role: 'Researcher',
      model: 'gpt-4o',
      systemPrompt: 'Write a brief.',
      tools: ['firecrawl_search'],
    });
    // An approval step becomes supervised autonomy rather than disappearing.
    expect(derived.runtime.autonomy).toBe('supervised');
  });

  it('reports control-flow steps it cannot represent', () => {
    const result = convertLegacyAgentGraph(legacy, { name: 'Research Agent' })!;
    expect(result.unsupportedSteps.map((s) => s.type)).toEqual(['IF_ELSE', 'TRANSFORM']);
  });

  it('leaves builder graphs alone', () => {
    expect(convertLegacyAgentGraph(builderGraph(), { name: 'X' })).toBeNull();
  });
});

describe('agentToolGate', () => {
  const rt = (raw: Record<string, unknown>) => readAgentRuntime({ runtime: raw });

  it('blocks a tool the owner blocked, whatever the autonomy', () => {
    expect(agentToolGate(rt({ autonomy: 'autonomous', rules: { policies: { create_task: 'blocked' } } }), 'create_task', false)).toBe('blocked');
  });

  it('gates writes at levels 2–3 and everything at 0–1', () => {
    expect(agentToolGate(rt({ autonomyLevel: 3 }), 'create_task', false)).toBe('approval');
    expect(agentToolGate(rt({ autonomyLevel: 3 }), 'search_docs', true)).toBe('allow');
    expect(agentToolGate(rt({ autonomyLevel: 0 }), 'search_docs', true)).toBe('approval');
  });

  it('keeps legacy agents exactly as their autonomy said', () => {
    const legacy = rt({ autonomy: 'autonomous' });
    expect(legacy.autonomyLevel).toBeUndefined();
    expect(agentToolGate(legacy, 'create_task', false)).toBe('allow');
    expect(agentToolGate(rt({ autonomy: 'supervised', autonomyLevel: 4 }), 'search_docs', true)).toBe('approval');
  });

  it('lets an explicit per-tool allow win over the autonomy gate', () => {
    expect(agentToolNeedsApproval(rt({ autonomy: 'semi', rules: { policies: { create_task: 'auto_allow' } } }), 'create_task')).toBe(false);
  });
});
