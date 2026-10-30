import { describe, expect, it } from 'vitest';
import {
  compileStudioGraph,
  DEFAULT_AGENT_RUN_LIMITS,
  flattenAgentTeam,
  isStudioGraph,
  LAST_OUTPUT_KEY,
  MAX_AGENT_RUN_LIMITS,
  readRunLimits,
  studioGraphApps,
} from './studio-graph.js';

const node = (
  id: string,
  type: string,
  config: Record<string, unknown> = {},
  label?: string,
) => ({
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
    expect(result.edges.map((e) => `${e.source}>${e.target}`)).toEqual([
      't>a',
      'a>o',
    ]);
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
        node(
          'sup',
          'AGENT_COORDINATOR',
          {
            instructions: 'Lead.',
            model: 'big',
            delegation: 'parallel',
            maxIterations: 99,
          },
          'Lead',
        ),
        node('r', 'SUB_AGENT', { instructions: 'Research.' }, 'Research'),
        node(
          'w',
          'SUB_AGENT',
          { instructions: 'Write.', model: 'small' },
          'Writer',
        ),
        node('e', 'SUB_AGENT', { instructions: 'Edit.' }, 'Editor'),
      ],
      edges: [
        edge('t', 'sup'),
        edge('sup', 'r', 'agents'),
        edge('sup', 'w', 'agents'),
        edge('w', 'e', 'agents'),
      ],
    });

    expect(result.nodes.map((n) => n.id)).toEqual(['t', 'sup']);
    const [lead] = result.agents;
    expect(lead!.delegation).toBe('parallel');
    expect(lead!.maxSteps).toBe(10);
    expect(lead!.members.map((m) => [m.name, m.model])).toEqual([
      ['Research', 'big'],
      ['Writer', 'small'],
    ]);
    expect(lead!.members[1]!.members.map((m) => [m.name, m.model])).toEqual([
      ['Editor', 'small'],
    ]);
    expect(flattenAgentTeam(lead!).map((a) => a.key)).toEqual([
      'sup',
      'r',
      'w',
      'e',
    ]);
  });

  it('flags a supervisor with no team and a cycle of reporting', () => {
    const lonely = compileStudioGraph({
      nodes: [
        node('t', 'TRIGGER_MANUAL'),
        node('s', 'AGENT_COORDINATOR', { instructions: 'x' }),
      ],
      edges: [edge('t', 's')],
    });
    expect(lonely.issues).toContainEqual(
      expect.objectContaining({ nodeId: 's', level: 'error' }),
    );

    const cyclic = compileStudioGraph({
      nodes: [
        node('t', 'TRIGGER_MANUAL'),
        node('a', 'AGENT', { instructions: 'a' }),
        node('b', 'SUB_AGENT', { instructions: 'b' }),
      ],
      edges: [
        edge('t', 'a'),
        edge('a', 'b', 'agents'),
        edge('b', 'a', 'agents'),
      ],
    });
    expect(
      cyclic.issues.some((i) => i.level === 'error' && /loop/.test(i.message)),
    ).toBe(true);
  });

  it('maps logic steps and keeps only the handles the engine branches on', () => {
    const result = compileStudioGraph({
      nodes: [
        node('t', 'TRIGGER_MANUAL'),
        node('if', 'IF_ELSE', {
          variable: '{{input.score}}',
          operator: 'greater_than',
          value: '5',
        }),
        node('par', 'PARALLEL_SPLIT'),
        node('x', 'AI_SUMMARIZER', {
          length: 'short',
          format: 'bullet_points',
        }),
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
    expect(byId.get('if')).toMatchObject({
      type: 'CONDITION',
      config: { field: 'input.score', operator: 'gt', value: '5' },
    });
    expect(byId.get('par')!.type).toBe('PARALLEL');
    expect(byId.get('x')).toMatchObject({ type: 'LLM' });
    expect(String(byId.get('x')!.config['prompt'])).toMatch(
      /short summary as bullet points/,
    );
    expect(byId.get('loop')).toMatchObject({
      type: 'LOOP',
      config: { itemsKey: 'rows' },
    });
    expect(byId.get('ok')).toMatchObject({
      type: 'HUMAN_APPROVAL',
      config: { action: 'Send it?', reviewPath: LAST_OUTPUT_KEY },
    });
    expect(byId.get('end')!.type).toBe('OUTPUT');

    const handles = Object.fromEntries(
      result.edges.map((e) => [
        `${e.source}>${e.target}`,
        e.sourceHandle ?? null,
      ]),
    );
    expect(handles).toMatchObject({
      'if>par': 'true',
      'if>end': 'false',
      'par>x': null,
      'par>y': null,
      'loop>each': 'each',
      'loop>ok': null,
    });
  });

  it('never lets an unknown step silently succeed', () => {
    const result = compileStudioGraph({
      nodes: [
        node('t', 'TRIGGER_MANUAL'),
        node('g', 'AI_GUARDRAIL'),
        node('z', 'SOMETHING_NEW'),
        node('a', 'AGENT', { instructions: 'x' }),
      ],
      edges: [edge('t', 'g'), edge('g', 'z'), edge('z', 'a')],
    });
    const types = Object.fromEntries(result.nodes.map((n) => [n.id, n.type]));
    expect(types).toMatchObject({ g: 'UNSUPPORTED', z: 'UNSUPPORTED' });
    expect(
      result.issues.filter((i) => i.level === 'warning').map((i) => i.nodeId),
    ).toEqual(expect.arrayContaining(['g', 'z']));
  });

  it('reports an empty or trigger-only canvas as an error', () => {
    expect(compileStudioGraph({ nodes: [], edges: [] }).issues[0]!.level).toBe(
      'error',
    );
    const triggerOnly = compileStudioGraph({
      nodes: [node('t', 'TRIGGER_MANUAL')],
      edges: [],
    });
    expect(triggerOnly.issues.some((i) => i.level === 'error')).toBe(true);
  });

  it('warns about tool attachments it cannot hand to an agent', () => {
    const result = compileStudioGraph({
      nodes: [
        node('t', 'TRIGGER_MANUAL'),
        node('a', 'AGENT', { instructions: 'x' }),
        node('s', 'SLACK_SEND'),
      ],
      edges: [edge('t', 'a'), edge('a', 's', 'tools')],
    });
    expect(result.agents[0]!.tools).toEqual([]);
    expect(result.issues).toContainEqual(
      expect.objectContaining({ nodeId: 's', level: 'warning' }),
    );
  });
});

describe('knowledge steps', () => {
  it('refuses a knowledge search with no knowledge base picked', () => {
    const result = compileStudioGraph({
      nodes: [
        node('t', 'TRIGGER_MANUAL'),
        node(
          'kb',
          'KB_SEARCH',
          { knowledgeBaseId: '' },
          'Search company knowledge',
        ),
      ],
      edges: [edge('t', 'kb')],
    });
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        nodeId: 'kb',
        level: 'error',
        message: expect.stringMatching(/pick a knowledge base/),
      }),
    );
  });
});

describe('connector cards', () => {
  it('compiles an app action card into a real PROVIDER.action step with its input', () => {
    const result = compileStudioGraph({
      nodes: [
        node('t', 'TRIGGER_MANUAL'),
        node(
          's',
          'APP_CONNECTOR_ACTION',
          {
            provider: 'slack',
            actionId: 'send_message',
            input: { channelId: 'C1', text: '{{__last}}' },
          },
          'Post',
        ),
      ],
      edges: [edge('t', 's')],
    });
    expect(result.nodes[1]).toMatchObject({
      type: 'MCP_TOOL',
      config: {
        toolName: 'SLACK.send_message',
        input: { channelId: 'C1', text: '{{__last}}' },
      },
    });
    expect(result.issues.filter((i) => i.level === 'error')).toEqual([]);
  });

  it('refuses an app action card with no action picked', () => {
    const result = compileStudioGraph({
      nodes: [
        node('t', 'TRIGGER_MANUAL'),
        node('s', 'APP_CONNECTOR_ACTION', { provider: 'GITHUB' }),
      ],
      edges: [edge('t', 's')],
    });
    expect(result.issues).toContainEqual(
      expect.objectContaining({ nodeId: 's', level: 'error' }),
    );
  });

  it('keeps the first release’s Teams cards working as generic connector steps', () => {
    const result = compileStudioGraph({
      nodes: [
        node('t', 'TEAMS_TRIGGER_MESSAGE', {
          input: { teamId: 'T', channelId: 'C' },
        }),
        node('m', 'TEAMS_SEND_MESSAGE', {
          teamId: 'T',
          channelId: 'C',
          message: 'hi',
          connectionId: 'conn-ms-teams-corp',
        }),
      ],
      edges: [edge('t', 'm')],
    });
    expect(result.nodes[0]).toMatchObject({
      type: 'TRIGGER',
      config: {
        event: 'connector:MICROSOFT_TEAMS:new_message',
        connector: { provider: 'MICROSOFT_TEAMS', triggerId: 'new_message' },
      },
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
        node('t', 'APP_CONNECTOR_TRIGGER', {
          provider: 'GMAIL',
          triggerId: 'new_email',
          input: { query: 'label:support' },
        }),
        node('a', 'AGENT', { instructions: 'Triage it.' }),
      ],
      edges: [edge('t', 'a')],
    });
    expect(result.nodes[0].config).toEqual({
      trigger: 'TRIGGER_APP_EVENT',
      event: 'connector:GMAIL:new_email',
      connector: {
        provider: 'GMAIL',
        triggerId: 'new_email',
        input: { query: 'label:support' },
      },
    });
  });

  it('hands connector actions plugged into an agent to the runtime by tool name and app', () => {
    const result = compileStudioGraph({
      nodes: [
        node('t', 'TRIGGER_MANUAL'),
        node('a', 'AGENT', {
          instructions: 'Keep the team posted.',
          tools: ['GITHUB.list_issues'],
        }),
        node('s', 'APP_CONNECTOR_ACTION', {
          provider: 'slack',
          actionId: 'send_message',
        }),
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

  it('gives an agent every action switched on in one app card', () => {
    const graph = (actionIds: string[]) =>
      compileStudioGraph({
        nodes: [
          node('t', 'TRIGGER_MANUAL'),
          node('a', 'AGENT', { instructions: 'Triage mail.' }),
          node('g', 'APP_CONNECTOR_ACTION', {
            provider: 'GMAIL',
            actionId: 'send_message',
            actionIds,
          }),
        ],
        edges: [edge('t', 'a'), edge('a', 'g', 'tools')],
      });
    expect(graph(['search_messages', 'send_message']).agents[0]).toMatchObject({
      tools: ['gmail_search_messages', 'gmail_send_message'],
      connectors: ['GMAIL'],
    });
    const none = graph([]);
    expect(none.agents[0]!.tools).toEqual([]);
    expect(none.issues).toContainEqual(
      expect.objectContaining({ nodeId: 'g', level: 'error' }),
    );
  });
});

describe('studioGraphApps', () => {
  it('counts an app drawn as the step after the agent, not only as its tool', () => {
    const graphJson = JSON.stringify({
      nodes: [
        node('t', 'START'),
        node('a', 'AGENT', {
          instructions: 'Read my mail.',
          tools: ['firecrawl_search'],
        }),
        node('g', 'APP_CONNECTOR_ACTION', {
          provider: 'GMAIL',
          actionId: 'send_message',
          actionIds: ['search_messages', 'send_message'],
          requireApproval: true,
        }),
        node('s', 'APP_CONNECTOR_ACTION', {
          provider: 'slack',
          actionId: 'send_message',
        }),
      ],
      edges: [edge('t', 'a'), edge('a', 'g'), edge('a', 's', 'tools')],
    });
    expect(studioGraphApps(graphJson)).toEqual({
      providers: ['SLACK', 'GMAIL'],
      tools: [
        'slack_send_message',
        'gmail_search_messages',
        'gmail_send_message',
      ],
      approvalTools: ['gmail_search_messages', 'gmail_send_message'],
    });
  });

  it('counts planner-made app steps that only name the app they need', () => {
    const graphJson = JSON.stringify({
      nodes: [
        node('t', 'START'),
        node('git', 'MCP_TOOL', {
          toolName: 'GITHUB.list_commits',
          needsConnection: 'GITHUB',
        }),
        // No action picked yet — the app is still needed.
        node('slack', 'MCP_TOOL', { toolName: '', needsConnection: 'SLACK' }),
        // A workspace MCP server tool needs no app connection.
        node('mcp', 'MCP_TOOL', { toolName: 'search' }),
      ],
      edges: [edge('t', 'git'), edge('git', 'slack'), edge('slack', 'mcp')],
    });
    expect(studioGraphApps(graphJson)).toEqual({
      providers: ['GITHUB', 'SLACK'],
      tools: ['github_list_commits'],
      approvalTools: [],
    });
  });

  it('is empty for anything that is not a canvas', () => {
    expect(studioGraphApps(null)).toEqual({
      providers: [],
      tools: [],
      approvalTools: [],
    });
    expect(studioGraphApps('not json')).toEqual({
      providers: [],
      tools: [],
      approvalTools: [],
    });
  });
});

describe('readRunLimits', () => {
  it('defaults, and clamps a graph’s own limits to the maxima', () => {
    expect(readRunLimits(undefined)).toEqual(DEFAULT_AGENT_RUN_LIMITS);
    expect(
      readRunLimits({
        limits: { maxSteps: 10_000, maxDelegations: 3, maxTokens: 50 },
      }),
    ).toEqual({
      maxSteps: MAX_AGENT_RUN_LIMITS.maxSteps,
      maxDurationMs: DEFAULT_AGENT_RUN_LIMITS.maxDurationMs,
      maxDelegations: 3,
      maxTokens: 1_000,
    });
  });
});

describe('isStudioGraph', () => {
  it('tells canvas graphs from Agent Builder graphs', () => {
    expect(
      isStudioGraph(JSON.stringify({ nodes: [node('a', 'AGENT')], edges: [] })),
    ).toBe(true);
    expect(
      isStudioGraph(
        JSON.stringify({
          nodes: [{ id: 'a', type: 'agent', data: { kind: 'agent' } }],
        }),
      ),
    ).toBe(false);
    expect(isStudioGraph('not json')).toBe(false);
    expect(isStudioGraph(null)).toBe(false);
  });
});

describe('location trigger + attendance', () => {
  it('compiles the geofence onto the trigger and the attendance card into its app action', () => {
    const compiled = compileStudioGraph({
      nodes: [
        node('geo', 'TRIGGER_LOCATION', {
          latitude: '12.97',
          longitude: 77.59,
          radiusMeters: 9999,
          eventType: 'enter',
          officeName: 'HQ',
        }),
        node('punch', 'ATTENDANCE_ACTION', {
          provider: 'SLACK',
          actionId: 'check_in',
          input: { note: 'hi' },
        }),
      ],
      edges: [edge('geo', 'punch')],
    });
    expect(compiled.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(compiled.nodes[0].config).toEqual({
      trigger: 'TRIGGER_LOCATION',
      geofence: {
        event: 'ENTER',
        officeName: 'HQ',
        latitude: 12.97,
        longitude: 77.59,
        radiusMeters: 5000,
        dwellMinutes: 3,
        accuracyMeters: 100,
        cooldownMinutes: 60,
      },
    });
    // Bound to Attendance whatever `provider` says.
    expect(compiled.nodes[1]).toMatchObject({
      type: 'MCP_TOOL',
      config: { toolName: 'ATTENDANCE.check_in', input: { note: 'hi' } },
    });
  });

  it('refuses a location trigger with no office coordinates', () => {
    const compiled = compileStudioGraph({
      nodes: [
        node('geo', 'TRIGGER_LOCATION', { radiusMeters: 100 }, 'Office'),
        node('punch', 'ATTENDANCE_ACTION', { actionId: 'check_in' }),
      ],
      edges: [edge('geo', 'punch')],
    });
    expect(compiled.issues).toContainEqual(
      expect.objectContaining({
        nodeId: 'geo',
        level: 'error',
        message: expect.stringContaining('latitude'),
      }),
    );
  });
});

describe('connector approvals', () => {
  const flow = (requireApproval: unknown) =>
    compileStudioGraph({
      nodes: [
        node('t', 'TRIGGER_MANUAL'),
        node('c', 'CONDITION', { field: 'order.total' }),
        node(
          's',
          'APP_CONNECTOR_ACTION',
          {
            provider: 'whatsapp',
            actionId: 'send_template_message',
            requireApproval,
            input: { to: '{{order.phone}}', templateName: 'order_update' },
          },
          'Message customer',
        ),
        node('o', 'OUTPUT', { template: 'done' }),
      ],
      edges: [edge('t', 'c'), edge('c', 's'), edge('s', 'o')],
    });

  it('puts an approval step in front of an action that asks for one, showing what will be sent', () => {
    const result = flow(true);
    const approval = result.nodes.find((n) => n.id === 's__approval');
    expect(approval).toMatchObject({
      type: 'HUMAN_APPROVAL',
      config: { required: true, reviewLabel: 'What will happen' },
    });
    expect(String(approval?.config['reviewText'])).toContain(
      '**to:** {{order.phone}}',
    );
    expect(
      result.edges.filter((e) => e.target === 's').map((e) => e.source),
    ).toEqual(['s__approval']);
    expect(
      result.edges
        .filter((e) => e.target === 's__approval')
        .map((e) => e.source),
    ).toEqual(['c']);
    // Everything after the action still hangs off the action itself.
    expect(result.edges.some((e) => e.source === 's' && e.target === 'o')).toBe(
      true,
    );
  });

  it('adds nothing when approval is off', () => {
    expect(flow(undefined).nodes.some((n) => n.type === 'HUMAN_APPROVAL')).toBe(
      false,
    );
    expect(flow('false').nodes.some((n) => n.type === 'HUMAN_APPROVAL')).toBe(
      false,
    );
  });
});

describe('app step after an agent', () => {
  const flow = (input: Record<string, unknown>) =>
    compileStudioGraph({
      nodes: [
        node('t', 'START'),
        node('a', 'AGENT', { instructions: 'Be helpful.' }, 'Gmail PA'),
        node(
          'g',
          'APP_CONNECTOR_ACTION',
          {
            provider: 'GMAIL',
            actionId: 'send_message',
            requireApproval: true,
            input,
          },
          'Gmail',
        ),
        node('o', 'END'),
      ],
      edges: [edge('t', 'a'), edge('a', 'g'), edge('g', 'o')],
    });

  it('fills an empty action from the agent’s answer, and the approval reviews that', () => {
    const result = flow({});
    expect(result.nodes.find((n) => n.id === 'g__input')).toMatchObject({
      type: 'TOOL_INPUT',
      config: { toolName: 'GMAIL.send_message' },
    });
    expect(result.nodes.find((n) => n.id === 'g')?.config['inputFrom']).toBe(
      'g__input.toolInput',
    );
    expect(
      result.nodes.find((n) => n.id === 'g__approval')?.config,
    ).toMatchObject({ reviewPath: 'g__input.toolInput' });
    expect(
      result.edges.filter((e) => e.target === 'g__input').map((e) => e.source),
    ).toEqual(['a']);
    expect(
      result.edges
        .filter((e) => e.target === 'g__approval')
        .map((e) => e.source),
    ).toEqual(['g__input']);
    expect(
      result.edges.filter((e) => e.target === 'g').map((e) => e.source),
    ).toEqual(['g__approval']);
    // The run's agent knows the step follows it; the agent as drawn (chat, profile) doesn't change.
    const runAgent = result.nodes.find((n) => n.id === 'a')?.config[
      'inlineAgent'
    ] as { instructions: string };
    expect(runAgent.instructions).toContain(
      'next step runs “send message” in Gmail',
    );
    expect(result.agents[0].instructions).toBe('Be helpful.');
  });

  it('warns about code inside {{ }}, which the engine leaves empty', () => {
    const result = flow({
      to: ['{{list.toolResult.items?.map(i => i.email)}}'],
      subject: '{{now.date}}',
    });
    const warning = result.issues.find((i) => i.nodeId === 'g');
    expect(warning).toMatchObject({
      level: 'warning',
      message: expect.stringContaining(
        'isn’t a plain {{step.field}} reference',
      ),
    });
    expect(warning?.message).not.toContain('now.date');
  });

  it('leaves an action that has its own input alone', () => {
    const result = flow({
      to: ['a@example.com'],
      subject: 'Hi',
      bodyText: '{{__last}}',
    });
    expect(result.nodes.some((n) => n.type === 'TOOL_INPUT')).toBe(false);
    expect(
      result.nodes.find((n) => n.id === 'g__approval')?.config['reviewText'],
    ).toBeDefined();
  });
});

describe('compileStudioGraph — team steps', () => {
  it('runs a coworker, a saved agent and an automation as themselves', () => {
    const out = compileStudioGraph({
      nodes: [
        node('t', 'TRIGGER_MANUAL'),
        node('c', 'AI_COWORKER', { coworkerId: 'ledger', task: 'Reconcile {{t.message}}' }),
        node('a', 'CALL_AGENT', { agentId: 'writer' }),
        node('w', 'RUN_WORKFLOW', { workflowId: 'wf1' }),
      ],
      edges: [edge('t', 'c'), edge('c', 'a'), edge('a', 'w')],
    });
    const byId = Object.fromEntries(out.nodes.map((n) => [n.id, n]));
    expect(byId['c']).toMatchObject({ type: 'AI_COWORKER', config: { coworkerId: 'ledger', task: 'Reconcile {{t.message}}' } });
    // A saved agent is an AGENT step with no inline spec: the entity's own turn.
    expect(byId['a']).toMatchObject({ type: 'AGENT', config: { agentId: 'writer', goal: `{{${LAST_OUTPUT_KEY}}}` } });
    expect(byId['a']?.config['inlineAgent']).toBeUndefined();
    expect(byId['w']).toMatchObject({ type: 'RUN_WORKFLOW', config: { workflowId: 'wf1', input: { message: `{{${LAST_OUTPUT_KEY}}}` } } });
    // Saved agents aren't canvas agents.
    expect(out.agents).toEqual([]);
    expect(out.issues.filter((i) => i.level === 'error')).toEqual([]);
  });

  it('asks for a pick when a team step has none', () => {
    const out = compileStudioGraph({
      nodes: [node('t', 'TRIGGER_MANUAL'), node('c', 'AI_COWORKER'), node('a', 'CALL_AGENT'), node('w', 'RUN_WORKFLOW')],
      edges: [edge('t', 'c'), edge('c', 'a'), edge('a', 'w')],
    });
    expect(out.issues.filter((i) => i.level === 'error').map((i) => i.nodeId).sort()).toEqual(['a', 'c', 'w']);
  });

  it('does not hand off to a saved agent drawn before an app action', () => {
    const out = compileStudioGraph({
      nodes: [
        node('t', 'TRIGGER_MANUAL'),
        node('a', 'CALL_AGENT', { agentId: 'writer' }),
        node('s', 'APP_CONNECTOR_ACTION', { provider: 'SLACK', connectorId: 'slack', actionId: 'send_message', input: {} }),
      ],
      edges: [edge('t', 'a'), edge('a', 's')],
    });
    expect(out.nodes.find((n) => n.id === 'a')?.config['inlineAgent']).toBeUndefined();
  });
});
