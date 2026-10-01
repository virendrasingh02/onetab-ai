import { describe, expect, it } from 'vitest';
import {
  AGENT_SCOPES,
  PLATFORM_TOOLS,
  blueprintBlockers,
  compileAgentBlueprint,
  describeAgentScope,
  describeCronExpression,
  emptyAgentBlueprint,
  requiredScopes,
  stepsMissingScopes,
  uniqueStepId,
  workflowGraphSignature,
  type AgentBlueprint,
} from './agent-blueprint.js';
import { AGENT_TEMPLATES, findAgentTemplate, matchAgentTemplate } from './agent-templates.js';

function reportBlueprint(): AgentBlueprint {
  return findAgentTemplate('daily-report')!.blueprint();
}

describe('compileAgentBlueprint', () => {
  it('turns a plan into a linear graph the engine runs', () => {
    const graph = compileAgentBlueprint(reportBlueprint());
    expect(graph.triggerType).toBe('CRON');
    expect(graph.nodes[0]).toMatchObject({ id: 'trigger', type: 'TRIGGER', data: { triggerKind: 'CRON', cron: '0 18 * * 1-5' } });
    expect(graph.nodes.map((n) => n.type)).toEqual([
      'TRIGGER',
      'TOOL',
      'TOOL',
      'TOOL',
      'TOOL',
      'LLM',
      'LLM',
      'HUMAN_APPROVAL',
      'TOOL',
      'OUTPUT',
    ]);
    // Every node but the first is reached from the one before it.
    for (let i = 1; i < graph.nodes.length; i++) {
      expect(graph.edges.some((e) => e.source === graph.nodes[i - 1]!.id && e.target === graph.nodes[i]!.id)).toBe(true);
    }
  });

  it('feeds earlier results into writing steps and grounds them', () => {
    const graph = compileAgentBlueprint(reportBlueprint());
    const report = graph.nodes.find((n) => n.id === 'report')!;
    const prompt = String(report.data['prompt']);
    expect(prompt).toContain('{{completed.toolResult}}');
    expect(prompt).toContain('{{blockers.aiOutput}}');
    expect(prompt).toContain('Never invent tasks');
    expect(prompt).toContain('{{now.date}}');
  });

  it('points the approval at the draft it reviews and the result at the chosen step', () => {
    const graph = compileAgentBlueprint(reportBlueprint());
    expect(graph.nodes.find((n) => n.id === 'review')!.data).toMatchObject({ reviewPath: 'report.aiOutput' });
    expect(graph.nodes.find((n) => n.id === 'result')!.data['template']).toBe('{{report.aiOutput}}');
  });

  it('stores tool input as JSON text the canvas edits', () => {
    const graph = compileAgentBlueprint(reportBlueprint());
    const publish = graph.nodes.find((n) => n.id === 'publish')!;
    expect(publish.data['toolName']).toBe('create_doc');
    expect(JSON.parse(String(publish.data['input']))).toEqual({
      title: 'Daily report — {{now.date}}',
      content: '{{report.aiOutput}}',
    });
  });

  it('inserts an approval before a gated action and wires failure fallbacks', () => {
    const graph = compileAgentBlueprint(findAgentTemplate('email-follow-up')!.blueprint());
    const ids = graph.nodes.map((n) => n.id);
    expect(ids.indexOf('create__approval')).toBe(ids.indexOf('create') - 1);
    // The email step may fail; the run continues to triage instead of stopping.
    expect(graph.edges).toContainEqual(expect.objectContaining({ source: 'inbox', target: 'triage', sourceHandle: 'error' }));
    // The condition's "no" branch ends the run visibly.
    expect(graph.edges).toContainEqual(expect.objectContaining({ source: 'has_followups', target: 'has_followups__stop', sourceHandle: 'false' }));
    expect(graph.edges).toContainEqual(expect.objectContaining({ source: 'has_followups', target: 'create__approval', sourceHandle: 'true' }));
    expect(graph.nodes.find((n) => n.id === 'has_followups')!.data['expression']).toBe('followups.aiOutput contains "title"');
  });

  it('uses the event name as the trigger type for event agents', () => {
    const graph = compileAgentBlueprint(findAgentTemplate('message-to-task')!.blueprint());
    expect(graph.triggerType).toBe('channel.message');
    expect(graph.nodes[0]!.data).toMatchObject({ triggerKind: 'EVENT', event: 'channel.message' });
  });

  it('is deterministic, so canvas edits can be detected', () => {
    const a = compileAgentBlueprint(reportBlueprint());
    const b = compileAgentBlueprint(reportBlueprint());
    expect(workflowGraphSignature(a.nodes, a.edges)).toBe(workflowGraphSignature(b.nodes, b.edges));
    const moved = a.nodes.map((n) => ({ ...n, position: { x: 0, y: 0 } }));
    expect(workflowGraphSignature(moved, a.edges)).toBe(workflowGraphSignature(a.nodes, a.edges));
    const edited = a.nodes.map((n) => (n.id === 'report' ? { ...n, data: { ...n.data, prompt: 'x' } } : n));
    expect(workflowGraphSignature(edited, a.edges)).not.toBe(workflowGraphSignature(a.nodes, a.edges));
  });
});

describe('permissions', () => {
  it('derives the scopes a plan needs from its tools', () => {
    expect(requiredScopes(reportBlueprint()).sort()).toEqual(
      ['activity:read', 'docs:write', 'meetings:read', 'tasks:read'].sort(),
    );
    expect(requiredScopes({ steps: [{ id: 'x', kind: 'action', title: 'Send', tool: 'GMAIL.send_message' }] })).toEqual([
      'app:gmail:write',
    ]);
  });

  it('flags steps that need a scope the agent was not granted', () => {
    const bp = { ...reportBlueprint(), scopes: ['tasks:read' as const] };
    const missing = stepsMissingScopes(bp).map((m) => m.scope);
    expect(missing).toContain('docs:write');
    expect(missing).toContain('meetings:read');
  });

  it('describes app scopes in words', () => {
    expect(describeAgentScope('app:gmail:read')).toMatchObject({ label: 'Read Gmail', access: 'read' });
    expect(describeAgentScope('tasks:write').access).toBe('write');
  });

  it('labels every platform tool scope', () => {
    for (const tool of Object.values(PLATFORM_TOOLS)) {
      expect(describeAgentScope(tool.scope).label).not.toBe(tool.scope);
    }
    expect(Object.keys(AGENT_SCOPES).length).toBeGreaterThan(10);
  });
});

describe('templates', () => {
  it('only use tools the platform has and grant the scopes they need', () => {
    for (const template of AGENT_TEMPLATES) {
      const bp = template.blueprint();
      for (const s of bp.steps) {
        if (s.tool) expect(PLATFORM_TOOLS[s.tool], `${template.id}:${s.id}`).toBeDefined();
      }
      expect(stepsMissingScopes(bp), template.id).toEqual([]);
      expect(new Set(bp.steps.map((s) => s.id)).size, template.id).toBe(bp.steps.length);
    }
  });

  it('match requests when AI planning is unavailable', () => {
    expect(matchAgentTemplate('Every morning create my todo list from today’s meetings')?.template.id).toBe('daily-todo');
    expect(matchAgentTemplate('Prepare my daily work report at 6 PM')?.template.id).toBe('daily-report');
    expect(matchAgentTemplate('Review my project and tell me what is blocked')?.template.id).toBe('project-health');
    expect(matchAgentTemplate('Create a task whenever an important project message arrives')?.template.id).toBe('message-to-task');
    expect(matchAgentTemplate('xyzzy')).toBeNull();
  });
});

describe('blockers and helpers', () => {
  it('reports what stops an agent being switched on', () => {
    const bp = findAgentTemplate('message-to-task')!.blueprint();
    expect(blueprintBlockers(bp)).toContain('Choose the channel to watch.');
    expect(blueprintBlockers(emptyAgentBlueprint())).toContain('Add at least one step.');
    expect(blueprintBlockers(reportBlueprint())).toEqual([]);
  });

  it('describes common schedules', () => {
    expect(describeCronExpression('0 18 * * 1-5')).toBe('Weekdays at 6:00 PM');
    expect(describeCronExpression('30 8 * * *')).toBe('Every day at 8:30 AM');
    expect(describeCronExpression('0 16 * * 5')).toBe('Every Friday at 4:00 PM');
    expect(describeCronExpression('0 * * * *')).toBe('Every hour');
    expect(describeCronExpression('0 17 L * *')).toBe('Month-end at 5:00 PM');
  });

  it('makes unique, readable step ids', () => {
    expect(uniqueStepId('Get today’s tasks', [])).toBe('get_today_s_tasks');
    expect(uniqueStepId('Report', ['report'])).toBe('report_2');
    expect(uniqueStepId('Result', [])).toBe('result_2');
  });
});
