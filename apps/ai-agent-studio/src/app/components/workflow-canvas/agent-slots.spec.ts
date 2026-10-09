import type { Edge, Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import {
  agentHierarchy,
  agentIssues,
  handleOrder,
  isAttachmentEdge,
  isValidSlotConnection,
  resolveAgentModel,
  slotAttachments,
  slotCatalog,
  slotConnectionError,
  withSlotConnection,
} from './agent-slots';

const node = (id: string, type: string): Node => ({ id, type, position: { x: 0, y: 0 }, data: { label: id } });
const nodes = [node('agent', 'AGENT'), node('p1', 'PROMPT_TEMPLATE'), node('p2', 'PROMPT_TEMPLATE'), node('llm', 'AI_CHAT_MODEL'), node('http', 'HTTP_REQUEST'), node('kb', 'KB_SEARCH')];

describe('agent slots', () => {
  it('only lets compatible nodes into a slot', () => {
    expect(isValidSlotConnection({ source: 'agent', sourceHandle: 'prompt', target: 'p1', targetHandle: null }, nodes)).toBe(true);
    expect(isValidSlotConnection({ source: 'agent', sourceHandle: 'prompt', target: 'llm', targetHandle: null }, nodes)).toBe(false);
    expect(isValidSlotConnection({ source: 'agent', sourceHandle: 'tools', target: 'http', targetHandle: null }, nodes)).toBe(true);
    expect(isValidSlotConnection({ source: 'agent', sourceHandle: 'embedding', target: 'kb', targetHandle: null }, nodes)).toBe(true);
    // The main output connects to anything
    expect(isValidSlotConnection({ source: 'agent', sourceHandle: null, target: 'llm', targetHandle: null }, nodes)).toBe(true);
  });

  it('replaces the wire on single slots and stacks on multi slots', () => {
    const first: Edge = { id: 'a', source: 'agent', sourceHandle: 'prompt', target: 'p1' };
    const second: Edge = { id: 'b', source: 'agent', sourceHandle: 'prompt', target: 'p2' };
    expect(withSlotConnection([first], second).map((e) => e.id)).toEqual(['b']);

    const tool: Edge = { id: 't1', source: 'agent', sourceHandle: 'tools', target: 'http' };
    const kb: Edge = { id: 't2', source: 'agent', sourceHandle: 'tools', target: 'kb' };
    expect(withSlotConnection([tool], kb).map((e) => e.id)).toEqual(['t1', 't2']);
    expect(withSlotConnection([tool], { ...tool, id: 'dupe' })).toEqual([tool]);
  });

  it('groups attached nodes by slot and ignores flow edges', () => {
    const edges: Edge[] = [
      { id: '1', source: 'agent', sourceHandle: 'llm', target: 'llm' },
      { id: '2', source: 'agent', sourceHandle: 'tools', target: 'http' },
      { id: '3', source: 'agent', target: 'kb' },
    ];
    const attached = slotAttachments('agent', nodes, edges);
    expect(attached.llm.map((n) => n.id)).toEqual(['llm']);
    expect(attached.tools.map((n) => n.id)).toEqual(['http']);
    expect(attached.embedding).toEqual([]);
    expect(isAttachmentEdge(edges[2])).toBe(false);
  });

  it('orders slot attachments before the main output for layout', () => {
    expect(handleOrder('prompt')).toBeLessThan(handleOrder('tools'));
    expect(handleOrder('tools')).toBeLessThan(handleOrder(null));
    expect(handleOrder('true')).toBeLessThan(handleOrder('false'));
  });

  describe('multi-agent teams', () => {
    const agent = (id: string, type = 'AGENT', config: Record<string, unknown> = {}, extra: Record<string, unknown> = {}): Node => ({
      id,
      type,
      position: { x: 0, y: 0 },
      data: { label: id, config, ...extra },
    });
    const team = (source: string, target: string): Edge => ({ id: `${source}>${target}`, source, sourceHandle: 'agents', target });
    const lead = agent('lead', 'AGENT_COORDINATOR', { model: 'gpt-4o', instructions: 'Lead the team' });
    const worker = agent('worker', 'SUB_AGENT', { instructions: 'Research' });
    const intern = agent('intern', 'SUB_AGENT', { instructions: 'Summarise' });
    const all = [lead, worker, intern, node('p1', 'PROMPT_TEMPLATE')];
    const edges = [team('lead', 'worker'), team('worker', 'intern')];

    it('accepts agents in the Sub-agents slot only', () => {
      expect(isValidSlotConnection({ source: 'lead', sourceHandle: 'agents', target: 'p1', targetHandle: null }, all, [])).toBe(false);
      expect(isValidSlotConnection({ source: 'lead', sourceHandle: 'agents', target: 'worker', targetHandle: null }, all, [])).toBe(true);
    });

    it('refuses loops and a second supervisor', () => {
      expect(slotConnectionError({ source: 'intern', sourceHandle: 'agents', target: 'lead', targetHandle: null }, all, edges)).toMatch(/loop/);
      expect(slotConnectionError({ source: 'lead', sourceHandle: 'agents', target: 'intern', targetHandle: null }, all, edges)).toMatch(/another supervisor/);
    });

    it('nests teams and lets sub-agents inherit the supervisor model', () => {
      const [root] = agentHierarchy(all, edges);
      expect(root.agent.id).toBe('lead');
      expect(root.children[0].agent.id).toBe('worker');
      expect(root.children[0].children[0].agent.id).toBe('intern');
      expect(resolveAgentModel('intern', all, edges)).toEqual({ model: 'gpt-4o', inherited: true });
      expect(agentIssues(intern, all, edges)).toEqual([]);
      expect(agentIssues(intern, all, [])[0]).toMatch(/No model/);
    });

    it('flags a supervisor without sub-agents', () => {
      expect(agentIssues(lead, all, [])).toContain('Supervisor has no sub-agents to delegate to');
    });
  });

  it('offers only compatible catalog entries per slot', () => {
    expect(slotCatalog('prompt').map((n) => n.type)).toEqual(['PROMPT_TEMPLATE']);
    expect(slotCatalog('tools').every((n) => n.category === 'tools')).toBe(true);
  });
});
