import { describe, expect, it } from 'vitest';
import {
  compileStudioGraph,
  DEFAULT_AGENT_RUN_LIMITS,
  flattenAgentTeam,
  isStudioGraph,
  LAST_OUTPUT_KEY,
  MAX_AGENT_RUN_LIMITS,
  readRunLimits,
} from './studio-graph.js';

const node = (id: string, type: string, config: Record<string, unknown> = {}, label?: string) => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { ...(label ? { label } : {}), config },
});
const edge = (source: string, target: string, sourceHandle?: string) => ({
  id: `${source}-${target}-${sourceHandle ?? ''}`,
  source,
  target,
  ...(sourceHandle ? { sourceHandle } : {}),
});

describe('compileStudioGraph', () => {
  it('folds slot attachments into the agent and keeps them off the run path', () => {
    const result = compileStudioGraph({
      nodes: [
        node('t', 'TRIGGER_MANUAL'),
        node('a', 'AGENT', { tools: ['kb_search'] }, 'Researcher'),
        node('p', 'PROMPT_TEMPLATE', { prompt: 'You research things.' }),
        node('m', 'AI_CHAT_MODEL', { model: 'llama-3.3', temperature: 0.2 }),
        node('f', 'FIRECRAWL_SEARCH'),
        node('k', 'KB_SEARCH', { knowledgeBaseId: 'kb1', topK: 50 }),
        node('o', 'END'),
      ],
      edges: [
        edge('t', 'a'),
        edge('a', 'o'),
        edge('a', 'p', 'prompt'),
        edge('a', 'm', 'llm'),
        edge('a', 'f', 'tools'),
        edge('a', 'k', 'embedding'),
      ],
    });

    expect(result.nodes.map((n) => [n.id, n.type])).toEqual([
      ['t', 'TRIGGER'],
      ['a', 'AGENT'],
      ['o', 'OUTPUT'],
    ]);
    expect(result.edges.map((e) => `${e.source}>${e.target}`)).toEqual(['t>a', 'a>o']);
    const [agent] = result.agents;
    expect(agent).toMatchObject({
      key: 'a',
      name: 'Researcher',
      instructions: 'You research things.',
      model: 'llama-3.3',
      temperature: 0.2,
      tools: ['search_docs', 'firecrawl_search'],
      knowledge: [{ knowledgeBaseId: 'kb1', topK: 20 }],
      delegation: 'router',
      members: [],
    });
    expect(result.nodes[1]!.config['goal']).toBe(`{{${LAST_OUTPUT_KEY}}}`);
    expect(result.issues.filter((i) => i.level === 'error')).toEqual([]);
  });

  it('builds teams from the Sub-agents slot, members inheriting the model', () => {
    const result = compileStudioGraph({
      nodes: [
        node('t', 'TRIGGER_CHAT'),
        node('sup', 'AGENT_COORDINATOR', { instructions: 'Lead.', model: 'big', delegation: 'parallel', maxIterations: 99 }, 'Lead'),
        node('r', 'SUB_AGENT', { instructions: 'Research.' }, 'Research'),
        node('w', 'SUB_AGENT', { instructions: 'Write.', model: 'small' }, 'Writer'),
        node('e', 'SUB_AGENT', { instructions: 'Edit.' }, 'Editor'),
      ],
      edges: [edge('t', 'sup'), edge('sup', 'r', 'agents'), edge('sup', 'w', 'agents'), edge('w', 'e', 'agents')],
    });

    expect(result.nodes.map((n) => n.id)).toEqual(['t', 'sup']);
    const [lead] = result.agents;
    expect(lead!.delegation).toBe('parallel');
    expect(lead!.maxSteps).toBe(10);
    expect(lead!.members.map((m) => [m.name, m.model])).toEqual([
      ['Research', 'big'],
      ['Writer', 'small'],
    ]);
    expect(lead!.members[1]!.members.map((m) => [m.name, m.model])).toEqual([['Editor', 'small']]);
    expect(flattenAgentTeam(lead!).map((a) => a.key)).toEqual(['sup', 'r', 'w', 'e']);
  });

  it('flags a supervisor with no team and a cycle of reporting', () => {
    const lonely = compileStudioGraph({
      nodes: [node('t', 'TRIGGER_MANUAL'), node('s', 'AGENT_COORDINATOR', { instructions: 'x' })],
      edges: [edge('t', 's')],
    });
    expect(lonely.issues).toContainEqual(expect.objectContaining({ nodeId: 's', level: 'error' }));

    const cyclic = compileStudioGraph({
      nodes: [node('t', 'TRIGGER_MANUAL'), node('a', 'AGENT', { instructions: 'a' }), node('b', 'SUB_AGENT', { instructions: 'b' })],
      edges: [edge('t', 'a'), edge('a', 'b', 'agents'), edge('b', 'a', 'agents')],
    });
    expect(cyclic.issues.some((i) => i.level === 'error' && /loop/.test(i.message))).toBe(true);
  });

  it('maps logic steps and keeps only the handles the engine branches on', () => {
    const result = compileStudioGraph({
      nodes: [
        node('t', 'TRIGGER_MANUAL'),
        node('if', 'IF_ELSE', { variable: '{{input.score}}', operator: 'greater_than', value: '5' }),
        node('par', 'PARALLEL_SPLIT'),
        node('x', 'AI_SUMMARIZER', { length: 'short', format: 'bullet_points' }),
        node('y', 'AI_TRANSLATOR', { targetLanguage: 'French' }),
        node('mg', 'MERGE_PATHS'),
        node('loop', 'LOOP', { itemsKey: 'rows' }),
        node('each', 'AI_CHAT_MODEL', { prompt: 'Handle {{item}}' }),
        node('ok', 'USER_APPROVAL', { action: 'Send it?' }),
        node('end', 'CHAT_RESPONSE'),
        node('note', 'STICKY_NOTE', { note: 'hi' }),
      ],
      edges: [
        edge('t', 'if'),
        edge('if', 'par', 'true'),
        edge('if', 'end', 'false'),
        edge('par', 'x', 'true'),
        edge('par', 'y', 'false'),
        edge('x', 'mg'),
        edge('y', 'mg'),
        edge('mg', 'loop'),
        edge('loop', 'each', 'each'),
        edge('loop', 'ok'),
        edge('ok', 'end'),
      ],
    });

    const byId = new Map(result.nodes.map((n) => [n.id, n]));
    expect(byId.has('note')).toBe(false);
    expect(byId.get('if')).toMatchObject({ type: 'CONDITION', config: { field: 'input.score', operator: 'gt', value: '5' } });
    expect(byId.get('par')!.type).toBe('PARALLEL');
    expect(byId.get('x')).toMatchObject({ type: 'LLM' });
    expect(String(byId.get('x')!.config['prompt'])).toMatch(/short summary as bullet points/);
    expect(byId.get('loop')).toMatchObject({ type: 'LOOP', config: { itemsKey: 'rows' } });
    expect(byId.get('ok')).toMatchObject({ type: 'HUMAN_APPROVAL', config: { action: 'Send it?', reviewPath: LAST_OUTPUT_KEY } });
    expect(byId.get('end')!.type).toBe('OUTPUT');

    const handles = Object.fromEntries(result.edges.map((e) => [`${e.source}>${e.target}`, e.sourceHandle ?? null]));
    expect(handles).toMatchObject({ 'if>par': 'true', 'if>end': 'false', 'par>x': null, 'par>y': null, 'loop>each': 'each', 'loop>ok': null });
  });

  it('never lets an unknown step silently succeed', () => {
    const result = compileStudioGraph({
      nodes: [node('t', 'TRIGGER_MANUAL'), node('g', 'AI_GUARDRAIL'), node('z', 'SOMETHING_NEW'), node('a', 'AGENT', { instructions: 'x' })],
      edges: [edge('t', 'g'), edge('g', 'z'), edge('z', 'a')],
    });
    const types = Object.fromEntries(result.nodes.map((n) => [n.id, n.type]));
    expect(types).toMatchObject({ g: 'UNSUPPORTED', z: 'UNSUPPORTED' });
    expect(result.issues.filter((i) => i.level === 'warning').map((i) => i.nodeId)).toEqual(expect.arrayContaining(['g', 'z']));
  });

  it('reports an empty or trigger-only canvas as an error', () => {
    expect(compileStudioGraph({ nodes: [], edges: [] }).issues[0]!.level).toBe('error');
    const triggerOnly = compileStudioGraph({ nodes: [node('t', 'TRIGGER_MANUAL')], edges: [] });
    expect(triggerOnly.issues.some((i) => i.level === 'error')).toBe(true);
  });

  it('warns about tool attachments it cannot hand to an agent', () => {
    const result = compileStudioGraph({
      nodes: [node('t', 'TRIGGER_MANUAL'), node('a', 'AGENT', { instructions: 'x' }), node('s', 'SLACK_SEND')],
      edges: [edge('t', 'a'), edge('a', 's', 'tools')],
    });
    expect(result.agents[0]!.tools).toEqual([]);
    expect(result.issues).toContainEqual(expect.objectContaining({ nodeId: 's', level: 'warning' }));
  });
});

describe('knowledge steps', () => {
  it('refuses a knowledge search with no knowledge base picked', () => {
    const result = compileStudioGraph({
      nodes: [node('t', 'TRIGGER_MANUAL'), node('kb', 'KB_SEARCH', { knowledgeBaseId: '' }, 'Search company knowledge')],
      edges: [edge('t', 'kb')],
    });
    expect(result.issues).toContainEqual(expect.objectContaining({ nodeId: 'kb', level: 'error', message: expect.stringMatching(/pick a knowledge base/) }));
  });
});

describe('connector cards', () => {
  it('compiles an app action card into a real PROVIDER.action step with its input', () => {
    const result = compileStudioGraph({
      nodes: [
        node('t', 'TRIGGER_MANUAL'),
        node('s', 'APP_CONNECTOR_ACTION', { provider: 'slack', actionId: 'send_message', input: { channelId: 'C1', text: '{{__last}}' } }, 'Post'),
      ],
      edges: [edge('t', 's')],
    });
    expect(result.nodes[1]).toMatchObject({
      type: 'MCP_TOOL',
      config: { toolName: 'SLACK.send_message', input: { channelId: 'C1', text: '{{__last}}' } },
    });
    expect(result.issues.filter((i) => i.level === 'error')).toEqual([]);
  });

  it('refuses an app action card with no action picked', () => {
    const result = compileStudioGraph({
      nodes: [node('t', 'TRIGGER_MANUAL'), node('s', 'APP_CONNECTOR_ACTION', { provider: 'GITHUB' })],
      edges: [edge('t', 's')],
    });
    expect(result.issues).toContainEqual(expect.objectContaining({ nodeId: 's', level: 'error' }));
  });

  it('keeps the first release’s Teams cards working as generic connector steps', () => {
    const result = compileStudioGraph({
      nodes: [
        node('t', 'TEAMS_TRIGGER_MESSAGE', { input: { teamId: 'T', channelId: 'C' } }),
        node('m', 'TEAMS_SEND_MESSAGE', { teamId: 'T', channelId: 'C', message: 'hi', connectionId: 'conn-ms-teams-corp' }),
      ],
      edges: [edge('t', 'm')],
    });
    expect(result.nodes[0]).toMatchObject({
      type: 'TRIGGER',
      config: { event: 'connector:MICROSOFT_TEAMS:new_message', connector: { provider: 'MICROSOFT_TEAMS', triggerId: 'new_message' } },
    });
    expect(result.nodes[1].config).toEqual({
      toolName: 'MICROSOFT_TEAMS.send_channel_message',
      input: { teamId: 'T', channelId: 'C', content: 'hi' },
      needsConnection: 'MICROSOFT_TEAMS',
    });
  });

  it('compiles an app trigger card into a connector event the poller watches', () => {
    const result = compileStudioGraph({
      nodes: [
        node('t', 'APP_CONNECTOR_TRIGGER', { provider: 'GMAIL', triggerId: 'new_email', input: { query: 'label:support' } }),
        node('a', 'AGENT', { instructions: 'Triage it.' }),
      ],
      edges: [edge('t', 'a')],
    });
    expect(result.nodes[0].config).toEqual({
      trigger: 'TRIGGER_APP_EVENT',
      event: 'connector:GMAIL:new_email',
      connector: { provider: 'GMAIL', triggerId: 'new_email', input: { query: 'label:support' } },
    });
  });

  it('hands connector actions plugged into an agent to the runtime by tool name and app', () => {
    const result = compileStudioGraph({
      nodes: [
        node('t', 'TRIGGER_MANUAL'),
        node('a', 'AGENT', { instructions: 'Keep the team posted.', tools: ['GITHUB.list_issues'] }),
        node('s', 'APP_CONNECTOR_ACTION', { provider: 'slack', actionId: 'send_message' }),
      ],
      edges: [edge('t', 'a'), edge('a', 's', 'tools')],
    });
    expect(result.agents[0]).toMatchObject({
      tools: ['github_list_issues', 'slack_send_message'],
      connectors: ['GITHUB', 'SLACK'],
    });
    // A tool attachment is not a step of its own.
    expect(result.nodes.map((n) => n.id)).toEqual(['t', 'a']);
  });
});

describe('readRunLimits', () => {
  it('defaults, and clamps a graph’s own limits to the maxima', () => {
    expect(readRunLimits(undefined)).toEqual(DEFAULT_AGENT_RUN_LIMITS);
    expect(readRunLimits({ limits: { maxSteps: 10_000, maxDelegations: 3, maxTokens: 50 } })).toEqual({
      maxSteps: MAX_AGENT_RUN_LIMITS.maxSteps,
      maxDurationMs: DEFAULT_AGENT_RUN_LIMITS.maxDurationMs,
      maxDelegations: 3,
      maxTokens: 1_000,
    });
  });
});

describe('isStudioGraph', () => {
  it('tells canvas graphs from Agent Builder graphs', () => {
    expect(isStudioGraph(JSON.stringify({ nodes: [node('a', 'AGENT')], edges: [] }))).toBe(true);
    expect(isStudioGraph(JSON.stringify({ nodes: [{ id: 'a', type: 'agent', data: { kind: 'agent' } }] }))).toBe(false);
    expect(isStudioGraph('not json')).toBe(false);
    expect(isStudioGraph(null)).toBe(false);
  });
});
