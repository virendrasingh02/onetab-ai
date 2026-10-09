import type { Edge, Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import {
  applyDraft,
  draftChanges,
  emptyDraft,
  exportModule,
  importModule,
  patchDraft,
  patchLimits,
  readAgentModules,
  summarizeAgentModules,
  summarizeModule,
  validateModule,
} from './agent-module-model';

const node = (id: string, type: string, config: Record<string, unknown> = {}, label = id): Node => ({
  id,
  type,
  position: { x: 0, y: 0 },
  data: { label, config },
});
const edge = (source: string, target: string, sourceHandle?: string): Edge => ({ id: `${source}-${target}`, source, target, sourceHandle });

const graph = () => {
  const nodes = [
    node('agent', 'AGENT', { instructions: 'Help with {{ticket.id}}.', tools: ['search_docs', 'SLACK.send_message'], toolPolicies: { 'SLACK.send_message': 'ask_user' }, delegation: 'parallel' }, 'Lead'),
    node('llm', 'AI_CHAT_MODEL', { model: 'gpt-4o', temperature: 0.2 }),
    node('kb', 'KB_SEARCH', { knowledgeBaseId: 'kb1', topK: 4, mode: 'HYBRID' }),
    node('kb2', 'KB_SEARCH', {}),
    node('helper', 'SUB_AGENT', { role: 'Researcher' }, 'Helper'),
  ];
  const edges = [edge('agent', 'llm', 'llm'), edge('agent', 'kb', 'embedding'), edge('agent', 'kb2', 'embedding'), edge('agent', 'helper', 'agents')];
  return { nodes, edges };
};

describe('readAgentModules', () => {
  it('reads every module from where the graph keeps it', () => {
    const { nodes, edges } = graph();
    const view = readAgentModules(nodes[0], nodes, edges, { limits: { maxDelegations: 5 } });
    expect(view.prompt).toMatchObject({ textNodeId: 'agent', textKey: 'instructions', fromPromptNode: false });
    expect(view.llm).toMatchObject({ targetNodeId: 'llm', fromLlmNode: true, model: 'gpt-4o', temperature: 0.2 });
    expect(view.knowledge.sources.map((s) => s.binding?.knowledgeBaseId ?? null)).toEqual(['kb1', null]);
    expect(view.tools.entries.map((e) => [e.kind, e.toolName, e.policy ?? null])).toEqual([
      ['builtin', 'search_docs', null],
      ['connector', 'slack_send_message', 'ask_user'],
    ]);
    expect(view.subAgents.delegation).toBe('parallel');
    expect(view.subAgents.members[0]).toMatchObject({ nodeId: 'helper', role: 'Researcher', model: { model: 'gpt-4o', inherited: true } });
    expect(view.subAgents.limits.maxDelegations).toBe(5);
  });

  it('reads the plugged-in prompt card over the agent’s own instructions', () => {
    const nodes = [node('agent', 'AGENT', { instructions: 'own' }), node('p', 'PROMPT_TEMPLATE', { prompt: 'from card' })];
    const view = readAgentModules(nodes[0], nodes, [edge('agent', 'p', 'prompt')]);
    expect(view.prompt).toMatchObject({ textNodeId: 'p', textKey: 'prompt', text: 'from card' });
  });
});

describe('validation and summaries', () => {
  it('flags the knowledge card with no base, and the undeclared variable', () => {
    const { nodes, edges } = graph();
    const view = readAgentModules(nodes[0], nodes, edges);
    const knowledge = validateModule('knowledge', view);
    expect(knowledge).toEqual([expect.objectContaining({ level: 'warning', section: 'sources', field: 'node-kb2' })]);
    expect(validateModule('prompt', view).some((i) => i.message.includes('{{ticket.id}}'))).toBe(true);
  });

  it('summarizes each module for the card', () => {
    const { nodes, edges } = graph();
    const summaries = summarizeAgentModules(readAgentModules(nodes[0], nodes, edges));
    const by = Object.fromEntries(summaries.map((s) => [s.id, s]));
    expect(by['llm'].title).toBe('gpt-4o');
    expect(by['llm'].detail).toContain('Temperature 0.2');
    expect(by['knowledge']).toMatchObject({ title: '2 sources', state: 'warning' });
    expect(by['tools']).toMatchObject({ title: '2 enabled', state: 'configured' });
    expect(by['subAgents']).toMatchObject({ title: '1 specialist', detail: 'Parallel delegation' });
  });

  it('reports a missing model as an error', () => {
    const nodes = [node('a', 'AGENT', { instructions: 'Do the thing well for every customer, always.' })];
    const summary = summarizeModule('llm', readAgentModules(nodes[0], nodes, []));
    expect(summary).toMatchObject({ state: 'error', title: 'No model' });
  });
});

describe('drafts', () => {
  it('lays edits over the graph without touching it, and knows what changed', () => {
    const { nodes, edges } = graph();
    let draft = patchDraft(emptyDraft(), nodes, 'llm', { temperature: 0.9 });
    draft = patchDraft(draft, nodes, 'agent', { delegation: undefined });
    expect(nodes[1].data['config']).toEqual({ model: 'gpt-4o', temperature: 0.2 });
    const view = readAgentModules(applyDraft(nodes, draft).find((n) => n.id === 'agent')!, applyDraft(nodes, draft), edges);
    expect(view.llm.temperature).toBe(0.9);
    expect(view.subAgents.delegation).toBe('router');
    expect(draftChanges(nodes, draft, undefined)).toEqual({ nodeIds: ['llm', 'agent'], settings: false });
    // Editing back to the original value is not a change
    const back = patchDraft(draft, nodes, 'llm', { temperature: 0.2 });
    expect(draftChanges(nodes, back, undefined).nodeIds).toEqual(['agent']);
  });

  it('patches run limits in the graph settings', () => {
    const draft = patchLimits(emptyDraft(), { limits: { maxSteps: 50 }, other: true }, { maxDelegations: 3, maxSteps: undefined });
    expect(draft.graphSettings).toEqual({ other: true, limits: { maxDelegations: 3 } });
  });
});

describe('export / import', () => {
  it('round-trips a module onto another agent, touching only its own keys', () => {
    const { nodes, edges } = graph();
    const view = readAgentModules(nodes[0], nodes, edges);
    const exported = exportModule('tools', view, nodes);
    expect(exported).toMatchObject({ module: 'tools', nodes: { agent: { tools: ['search_docs', 'SLACK.send_message'] } } });

    const other = [node('b', 'AGENT', { instructions: 'keep me' })];
    const otherView = readAgentModules(other[0], other, []);
    const { draft, applied } = importModule('tools', otherView, emptyDraft(), other, exported);
    expect(applied).toBe(2);
    expect(draft.configs['b']).toEqual({ instructions: 'keep me', tools: ['search_docs', 'SLACK.send_message'], toolPolicies: { 'SLACK.send_message': 'ask_user' } });
  });

  it('refuses a file for a different module', () => {
    const { nodes, edges } = graph();
    const view = readAgentModules(nodes[0], nodes, edges);
    expect(() => importModule('llm', view, emptyDraft(), nodes, { module: 'tools', nodes: {} })).toThrow(/tools settings/);
  });
});
