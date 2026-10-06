import { describe, expect, it } from 'vitest';
import {
  analyzeStudioGraph,
  applyGraphEdits,
  applyRecommendations,
  buildArchitectSpec,
  describeFlowLine,
  detectAgentRequirements,
  diffStudioGraphs,
  explainStudioGraph,
  interpretEditCommand,
  sanitizeEditOps,
  specToStudioGraph,
  type ArchitectContext,
  type EditInterpretationContext,
  type StudioCanvasGraph,
} from './agent-architect.js';
import type { AgentBlueprint, AgentBlueprintStep } from './agent-blueprint.js';
import { compileStudioGraph } from './studio-graph.js';

function blueprint(steps: AgentBlueprintStep[], extra: Partial<AgentBlueprint> = {}): AgentBlueprint {
  return {
    version: 1,
    name: 'Test agent',
    kind: 'task',
    objective: 'Do the thing.',
    trigger: { kind: 'manual' },
    context: [],
    steps,
    output: { format: 'summary', destination: 'run' },
    params: [],
    scopes: [],
    notify: { onComplete: false, onFailure: true, onApproval: true },
    questions: [],
    assumptions: [],
    warnings: [],
    source: { kind: 'ai' },
    ...extra,
  };
}

const noApps: ArchitectContext = { connectedApps: [], knowledgeBases: [] };

const editCtx: EditInterpretationContext = {
  connectedApps: [],
  knowledgeBases: [{ id: 'kb1', name: 'Handbook' }],
  models: [
    { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', provider: 'anthropic' },
    { id: 'gpt-5', label: 'GPT-5', provider: 'openai' },
  ],
  // Stands in for `parseScheduleText` from @org/utils.
  parseSchedule: (text) => (/monday/i.test(text) ? { cron: '0 9 * * 1' } : /weekday/i.test(text) ? { cron: '0 9 * * 1-5' } : null),
  timezone: 'Asia/Kolkata',
};

describe('detectAgentRequirements', () => {
  it('reads Gmail as the input, Slack as the delivery, and a schedule (success criteria 1)', () => {
    const req = detectAgentRequirements(
      'Create an agent that checks my Gmail every morning, finds important emails, summarizes them and sends the summary to Slack.',
    );
    expect(req.apps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: 'GMAIL', role: 'input' }),
        expect.objectContaining({ provider: 'SLACK', role: 'output' }),
      ]),
    );
    expect(req.triggerHint).toBe('schedule');
    expect(req.outputs).toContain('Report');
  });

  it('sees an HR screening job: documents in, a ranking out, the job description as knowledge (criteria 2)', () => {
    const req = detectAgentRequirements(
      'Create an HR agent that reads resumes, compares candidates against our job description, ranks them and creates a shortlist.',
    );
    expect(req.domain).toBe('hr');
    expect(req.inputs).toContain('Documents');
    expect(req.outputs).toEqual(expect.arrayContaining(['Shortlist', 'Ranking']));
    expect(req.wantsKnowledge).toBe(true);
  });

  it('asks for a CRM when leads are mentioned without naming one', () => {
    const req = detectAgentRequirements('Build a sales follow-up agent for new leads');
    expect(req.domain).toBe('sales');
    expect(req.categories.map((c) => c.category)).toContain('crm');
  });

  it('lists specialists for a multi-agent request', () => {
    const req = detectAgentRequirements(
      'Build an ecommerce operations system that handles orders, refunds, customer support and inventory.',
    );
    expect(req.domain).toBe('ecommerce');
    expect(req.wantsMultiAgent).toBe(true);
    expect(req.specialists).toEqual(['orders', 'refunds', 'customer support', 'inventory']);
  });
});

describe('buildArchitectSpec + specToStudioGraph', () => {
  const gmailPrompt = 'Check my Gmail every morning, find important emails, summarize them and send the summary to Slack.';
  const gmailPlan = blueprint(
    [
      { id: 'mail', kind: 'collect', title: 'Read new email', tool: 'search_email', input: { query: 'is:unread' } },
      { id: 'summary', kind: 'generate', title: 'Summarize important emails', prompt: 'Summarize the important ones.' },
    ],
    { trigger: { kind: 'schedule', cron: '0 8 * * *', timezone: 'UTC' } },
  );

  it('adds the Slack delivery the planner couldn’t use, and says Slack must be connected', () => {
    const spec = buildArchitectSpec(gmailPlan, detectAgentRequirements(gmailPrompt), { connectedApps: ['GMAIL'], knowledgeBases: [] }, gmailPrompt);
    const slack = spec.steps.find((s) => s.app === 'SLACK');
    expect(slack).toMatchObject({ kind: 'action', title: 'Send via Slack' });
    expect(spec.missingConfiguration.map((m) => m.id)).toContain('connect_slack');
    expect(spec.apps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ provider: 'GMAIL', connected: true }),
        expect.objectContaining({ provider: 'SLACK', connected: false }),
      ]),
    );
    expect(spec.trigger).toMatchObject({ kind: 'schedule', cron: '0 8 * * *' });
  });

  it('picks a connected app’s sending action instead of leaving the step unconfigured', () => {
    const spec = buildArchitectSpec(gmailPlan, detectAgentRequirements(gmailPrompt), {
      connectedApps: ['GMAIL', 'SLACK'],
      appActions: { SLACK: [{ tool: 'SLACK.list_channels', label: 'List', access: 'read' }, { tool: 'SLACK.send_message', label: 'Send', access: 'write' }] },
      knowledgeBases: [],
    }, gmailPrompt);
    expect(spec.steps.find((s) => s.title === 'Send via Slack')?.tool).toBe('SLACK.send_message');
    expect(spec.missingConfiguration.filter((m) => m.kind === 'connection')).toEqual([]);
  });

  it('compiles: the generated graph runs once everything is connected', () => {
    const spec = buildArchitectSpec(gmailPlan, detectAgentRequirements(gmailPrompt), {
      connectedApps: ['GMAIL', 'SLACK'],
      appActions: { SLACK: [{ tool: 'SLACK.send_message', label: 'Send', access: 'write' }] },
      knowledgeBases: [],
    }, gmailPrompt);
    const graph = specToStudioGraph(spec);
    const compiled = compileStudioGraph(graph);
    expect(compiled.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(graph.nodes[0]).toMatchObject({ type: 'TRIGGER_SCHEDULE', data: { config: { cron: '0 8 * * *' } } });
    expect(describeFlowLine(graph)).toBe('Every day at 8:00 AM → Read new email → Summarize important emails → Send via Slack → Result');
    // The writing agent is grounded in what the read step gathered.
    expect(String(graph.nodes.find((n) => n.id === 'summary')?.data.config['goal'])).toContain('{{mail.toolResult}}');
  });

  it('a missing app is an error the run reports, never a step that silently succeeds', () => {
    const spec = buildArchitectSpec(gmailPlan, detectAgentRequirements(gmailPrompt), noApps, gmailPrompt);
    const issues = compileStudioGraph(specToStudioGraph(spec)).issues;
    expect(issues.some((i) => i.level === 'error' && /no tool picked/.test(i.message))).toBe(true);
  });

  it('a support agent gets knowledge, escalation and approval recommendations (criteria 3)', () => {
    const prompt = 'Create a support agent that reads tickets and drafts replies to customers.';
    const spec = buildArchitectSpec(
      blueprint([
        { id: 'tickets', kind: 'collect', title: 'Read open tickets', tool: 'find_tasks', input: {} },
        { id: 'draft', kind: 'generate', title: 'Draft replies' },
        { id: 'post', kind: 'action', title: 'Post replies', tool: 'send_channel_message', input: {} },
      ]),
      detectAgentRequirements(prompt),
      { connectedApps: [], knowledgeBases: [{ id: 'kb1', name: 'Help center' }] },
      prompt,
    );
    expect(spec.domain).toBe('support');
    expect(spec.recommendations.map((r) => r.kind)).toEqual(expect.arrayContaining(['knowledge', 'escalation', 'approval']));
    const withKb = applyRecommendations(spec, spec.recommendations.filter((r) => r.kind === 'knowledge' || r.kind === 'approval').map((r) => r.id));
    expect(withKb.knowledge.enabled).toBe(true);
    expect(withKb.steps.some((s) => s.kind === 'knowledge')).toBe(true);
    expect(withKb.steps.find((s) => s.id === 'post')?.requiresApproval).toBe(true);
    expect(withKb.approvals).toContain('post');
  });

  it('uses the only knowledge base when the request needs documents', () => {
    const prompt = 'Answer questions from our documentation';
    const spec = buildArchitectSpec(blueprint([{ id: 'answer', kind: 'generate', title: 'Answer' }]), detectAgentRequirements(prompt), {
      connectedApps: [],
      knowledgeBases: [{ id: 'kb1', name: 'Docs' }],
    }, prompt);
    expect(spec.knowledge).toMatchObject({ enabled: true, knowledgeBaseId: 'kb1' });
    const graph = specToStudioGraph(spec);
    expect(graph.nodes.find((n) => n.type === 'KB_SEARCH')?.data.config['knowledgeBaseId']).toBe('kb1');
    expect(compileStudioGraph(graph).issues.filter((i) => i.level === 'error')).toEqual([]);
  });

  it('builds a coordinator with specialists for a multi-agent request', () => {
    const prompt = 'Build an ecommerce operations system that handles orders, refunds, customer support and inventory.';
    const spec = buildArchitectSpec(blueprint([{ id: 'ops', kind: 'generate', title: 'Handle the request' }]), detectAgentRequirements(prompt), noApps, prompt);
    expect(spec.team?.members).toHaveLength(4);
    const graph = specToStudioGraph(spec);
    const compiled = compileStudioGraph(graph);
    expect(compiled.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(compiled.agents[0]?.members.map((m) => m.name)).toEqual(['Orders Agent', 'Refunds Agent', 'Customer Support Agent', 'Inventory Agent']);
  });
});

/** A small existing agent: read → write → post → result. */
function existingGraph(): StudioCanvasGraph {
  return {
    nodes: [
      { id: 'trigger', type: 'TRIGGER_MANUAL', position: { x: 0, y: 0 }, data: { label: 'When you run it', config: {} } },
      { id: 'read', type: 'MCP_TOOL', position: { x: 300, y: 0 }, data: { label: 'Read tasks', config: { toolName: 'find_tasks', input: '{}' } } },
      { id: 'write', type: 'AGENT', position: { x: 600, y: 0 }, data: { label: 'Write report', config: { goal: 'Write it. {{read.toolResult}}', model: 'gpt-5' } } },
      { id: 'post', type: 'MCP_TOOL', position: { x: 900, y: 0 }, data: { label: 'Post report', config: { toolName: 'send_channel_message', input: '{}' } } },
      { id: 'result', type: 'END', position: { x: 1200, y: 0 }, data: { label: 'Result', config: { template: '{{write.entityResponse}}' } } },
    ],
    edges: [
      { id: 'e1', source: 'trigger', target: 'read' },
      { id: 'e2', source: 'read', target: 'write' },
      { id: 'e3', source: 'write', target: 'post' },
      { id: 'e4', source: 'post', target: 'result' },
    ],
  };
}

describe('editing in plain words', () => {
  it('adds approval before the agent sends anything — the existing workflow, not a new one (criteria 4)', () => {
    const graph = existingGraph();
    const plan = interpretEditCommand('Add approval before the agent sends anything.', graph, editCtx);
    expect(plan?.ops).toEqual([{ op: 'insert_approval_before', nodeIds: ['post'] }]);
    const { graph: next, errors } = applyGraphEdits(graph, plan!.ops);
    expect(errors).toEqual([]);
    expect(describeFlowLine(next)).toBe('When you run it → Read tasks → Write report → Approve: Post report → Post report → Result');
    const diff = diffStudioGraphs(graph, next);
    expect(diff.added).toEqual(['Approve: Post report']);
    expect(diff.removed).toEqual([]);
    expect(diff.changed).toEqual([]);
    expect(compileStudioGraph(next).issues.filter((i) => i.level === 'error')).toEqual([]);
  });

  it('changes the schedule, model and retries, and nothing else', () => {
    const graph = existingGraph();
    const plan = interpretEditCommand('Run it every Monday. Use Claude instead of GPT. Make it retry failed API calls three times.', graph, editCtx)!;
    const { graph: next } = applyGraphEdits(graph, plan.ops);
    expect(next.nodes[0]).toMatchObject({ type: 'TRIGGER_SCHEDULE', data: { config: { cron: '0 9 * * 1', timezone: 'Asia/Kolkata' } } });
    expect(next.nodes.find((n) => n.id === 'write')?.data.config['model']).toBe('claude-sonnet-5-5');
    expect(next.nodes.find((n) => n.id === 'read')?.data.config['retries']).toBe(3);
    expect(next.nodes.find((n) => n.id === 'write')?.data.config['retries']).toBeUndefined();
    const diff = diffStudioGraphs(graph, next);
    expect(diff.added).toEqual([]);
    expect(diff.rewired).toBe(false);
    expect(diff.changed.map((c) => c.label).sort()).toEqual(['Every Monday at 9:00 AM', 'Post report', 'Read tasks', 'Write report']);
  });

  it('says so when the model asked for isn’t set up, instead of inventing one', () => {
    const plan = interpretEditCommand('Use Gemini instead', existingGraph(), editCtx);
    expect(plan?.ops).toEqual([]);
    expect(plan?.notes[0]).toMatch(/No gemini model is set up/i);
  });

  it('adds Slack after the report, flagged as needing a connection', () => {
    const plan = interpretEditCommand('Add Slack notifications.', existingGraph(), editCtx)!;
    const { graph: next } = applyGraphEdits(existingGraph(), plan.ops);
    expect(describeFlowLine(next)).toContain('Write report → Notify in Slack → Post report');
    expect(plan.notes[0]).toMatch(/Slack isn’t connected/);
  });

  it('uses the company knowledge base, wired into the writer', () => {
    const plan = interpretEditCommand('Use our company documents', existingGraph(), editCtx)!;
    const { graph: next } = applyGraphEdits(existingGraph(), plan.ops);
    const kb = next.nodes.find((n) => n.type === 'KB_SEARCH')!;
    expect(kb.data.config['knowledgeBaseId']).toBe('kb1');
    expect(String(next.nodes.find((n) => n.id === 'write')?.data.config['goal'])).toContain(`{{${kb.id}.retrievedDocuments}}`);
  });

  it('turns two AI steps into a coordinator with a specialist (criteria 6)', () => {
    const graph = existingGraph();
    graph.nodes.splice(3, 0, { id: 'review', type: 'AGENT', position: { x: 750, y: 0 }, data: { label: 'Review report', config: { goal: 'Check it.' } } });
    graph.edges = [
      { id: 'e1', source: 'trigger', target: 'read' },
      { id: 'e2', source: 'read', target: 'write' },
      { id: 'e3', source: 'write', target: 'review' },
      { id: 'e3b', source: 'review', target: 'post' },
      { id: 'e4', source: 'post', target: 'result' },
    ];
    const plan = interpretEditCommand('Turn this into a multi-agent system', graph, editCtx)!;
    const { graph: next, errors } = applyGraphEdits(graph, plan.ops);
    expect(errors).toEqual([]);
    const compiled = compileStudioGraph(next);
    expect(compiled.issues.filter((i) => i.level === 'error')).toEqual([]);
    expect(compiled.agents).toHaveLength(1);
    expect(compiled.agents[0]?.members.map((m) => m.name)).toEqual(['Review report']);
    expect(describeFlowLine(next)).toBe('When you run it → Read tasks → Coordinator → Post report → Result');
  });

  it('returns null for requests it doesn’t recognise, so a model can try', () => {
    expect(interpretEditCommand('Make the tone friendlier for enterprise buyers', existingGraph(), editCtx)).toBeNull();
  });

  it('keeps only well-formed model ops that point at real steps', () => {
    const { ops, dropped } = sanitizeEditOps(
      {
        ops: [
          { op: 'update_step', nodeId: 'write', config: { instructions: 'Friendlier.' } },
          { op: 'remove_step', nodeId: 'ghost' },
          { op: 'add_step', type: 'SHELL_EXEC', label: 'rm -rf' },
          { op: 'set_model', model: 'made-up-model' },
        ],
      },
      existingGraph(),
      editCtx,
    );
    expect(ops).toEqual([{ op: 'update_step', nodeId: 'write', config: { instructions: 'Friendlier.' } }]);
    expect(dropped).toBe(3);
  });

  it('diff of an unchanged graph says nothing changed', () => {
    expect(diffStudioGraphs(existingGraph(), existingGraph()).changedAnything).toBe(false);
  });
});

describe('explain and optimise', () => {
  it('explains the workflow in plain words', () => {
    const text = explainStudioGraph(existingGraph());
    expect(text).toContain('It runs when you start it.');
    expect(text).toContain('Then it will read tasks, then use an AI agent to “write report”, then post report.');
  });

  it('merges back-to-back AI steps into one call', () => {
    const graph = existingGraph();
    graph.nodes.splice(3, 0, { id: 'polish', type: 'AGENT', position: { x: 750, y: 0 }, data: { label: 'Polish report', config: { goal: 'Polish it.' } } });
    graph.edges = [
      { id: 'e1', source: 'trigger', target: 'read' },
      { id: 'e2', source: 'read', target: 'write' },
      { id: 'e3', source: 'write', target: 'polish' },
      { id: 'e3b', source: 'polish', target: 'post' },
      { id: 'e4', source: 'post', target: 'result' },
    ];
    graph.nodes.find((n) => n.id === 'result')!.data.config['template'] = '{{polish.entityResponse}}';
    const before = analyzeStudioGraph(graph);
    expect(before.aiCalls).toBe(2);
    const merge = before.suggestions.find((s) => s.id === 'merge_write_polish')!;
    const { graph: next } = applyGraphEdits(graph, merge.ops!);
    expect(analyzeStudioGraph(next).aiCalls).toBe(1);
    expect(next.nodes.find((n) => n.id === 'result')?.data.config['template']).toBe('{{write.entityResponse}}');
    expect(compileStudioGraph(next).issues.filter((i) => i.level === 'error')).toEqual([]);
  });

  it('suggests retries on reads and flags steps nothing reaches', () => {
    const graph = existingGraph();
    graph.nodes.push({ id: 'orphan', type: 'AGENT', position: { x: 0, y: 400 }, data: { label: 'Orphan', config: {} } });
    const analysis = analyzeStudioGraph(graph);
    expect(analysis.unreachable).toEqual(['orphan']);
    expect(analysis.suggestions.find((s) => s.id === 'retry_reads')?.ops).toEqual([{ op: 'set_retries', retries: 2, nodeIds: ['read'] }]);
  });
});

describe('connections', () => {
  it('fills an app step once the app is connected, without planning again', async () => {
    const { refreshSpecConnections } = await import('./agent-architect.js');
    const prompt = 'Summarize new tasks and send the summary to Slack.';
    const spec = buildArchitectSpec(blueprint([{ id: 'sum', kind: 'generate', title: 'Summarize' }]), detectAgentRequirements(prompt), noApps, prompt);
    expect(spec.missingConfiguration.map((m) => m.id)).toContain('connect_slack');
    const next = refreshSpecConnections(spec, { connectedApps: ['SLACK'], appActions: { SLACK: [{ tool: 'SLACK.send_message', label: 'Send', access: 'write' }] }, knowledgeBases: [] });
    expect(next.steps.find((s) => s.title === 'Send via Slack')).toMatchObject({ tool: 'SLACK.send_message' });
    expect(next.missingConfiguration.map((m) => m.id)).not.toContain('connect_slack');
    expect(next.apps.find((a) => a.provider === 'SLACK')?.connected).toBe(true);
  });

  it('“Connect Slack” points a waiting step at the connected app', () => {
    const graph = existingGraph();
    graph.nodes.splice(3, 0, { id: 'slack', type: 'MCP_TOOL', position: { x: 0, y: 0 }, data: { label: 'Send via Slack', config: { toolName: '', needsConnection: 'SLACK' } } });
    const plan = interpretEditCommand('Connect Slack', graph, { ...editCtx, connectedApps: ['SLACK'], appActions: { SLACK: [{ tool: 'SLACK.send_message', label: 'Send', access: 'write' }] } })!;
    expect(plan.ops).toEqual([{ op: 'update_step', nodeId: 'slack', config: { toolName: 'SLACK.send_message', needsConnection: '' } }]);
    const notConnected = interpretEditCommand('Connect Salesforce and Gmail', graph, editCtx)!;
    expect(notConnected.ops).toEqual([]);
    expect(notConnected.notes).toHaveLength(2);
  });
});

describe('cleaning up a model’s plan', () => {
  it('turns a channel post titled with the app the person named into that app’s step, and asks for one approval, not two', () => {
    const prompt = 'Check my Gmail every morning, find important emails, summarize them and send the summary to Slack.';
    const spec = buildArchitectSpec(
      blueprint(
        [
          { id: 'mail', kind: 'collect', title: 'Find important emails', tool: 'search_email', input: {} },
          { id: 'sum', kind: 'generate', title: 'Summarize important emails' },
          { id: 'review', kind: 'approval', title: 'Review the summary' },
          { id: 'post', kind: 'action', title: 'Post summary to Slack', tool: 'send_channel_message', input: { channelSlug: '{{params.slackChannel}}' }, requiresApproval: true },
        ],
        { questions: [{ id: 'post_channel', question: 'Which channel should it post to?', field: 'output.channelSlug' }] },
      ),
      detectAgentRequirements(prompt),
      noApps,
      prompt,
    );
    expect(spec.steps.map((s) => s.title)).toEqual(['Find important emails', 'Summarize important emails', 'Review the summary', 'Post summary to Slack']);
    expect(spec.steps[3]).toMatchObject({ app: 'SLACK' });
    expect(spec.steps[3]?.tool).toBeUndefined();
    expect(spec.steps[3]?.requiresApproval).toBeUndefined();
    expect(spec.missingConfiguration.map((m) => m.id)).toEqual(['connect_gmail', 'connect_slack']);
  });
});

describe('saying only what is true', () => {
  it('doesn’t add a second approval where one already stands', () => {
    const graph = existingGraph();
    graph.nodes.splice(3, 0, { id: 'ok', type: 'USER_APPROVAL', position: { x: 0, y: 0 }, data: { label: 'Review', config: {} } });
    graph.edges = [
      { id: 'e1', source: 'trigger', target: 'read' },
      { id: 'e2', source: 'read', target: 'write' },
      { id: 'e3', source: 'write', target: 'ok' },
      { id: 'e3b', source: 'ok', target: 'post' },
      { id: 'e4', source: 'post', target: 'result' },
    ];
    const plan = interpretEditCommand('Add human approval before sending emails.', graph, editCtx)!;
    expect(plan.ops).toEqual([]);
    expect(plan.notes[0]).toMatch(/already waits for your approval before “Post report”/);
  });

  it('leaves designing a team from a single AI step to a model', () => {
    expect(interpretEditCommand('Turn this into a multi-agent system', existingGraph(), editCtx)).toBeNull();
  });

  it('describes a changed trigger plainly', () => {
    const { graph: next } = applyGraphEdits(existingGraph(), [{ op: 'set_trigger', kind: 'schedule', cron: '0 9 * * 1' }]);
    expect(diffStudioGraphs(existingGraph(), next).summary).toEqual(['Changed the trigger to “Every Monday at 9:00 AM”']);
  });
});
