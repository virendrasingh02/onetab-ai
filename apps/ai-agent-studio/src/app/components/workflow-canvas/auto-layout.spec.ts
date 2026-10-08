import type { Edge, Node } from '@xyflow/react';
import { describe, expect, it } from 'vitest';
import { layoutWorkflow } from './auto-layout';

const node = (id: string, type = 'AGENT', size = { width: 240, height: 90 }, position = { x: 0, y: 0 }): Node => ({
  id,
  type,
  position,
  data: { label: id },
  measured: size,
});
const edge = (source: string, target: string, sourceHandle?: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
  ...(sourceHandle ? { sourceHandle } : {}),
});

const byId = (nodes: Node[]) => new Map(nodes.map((n) => [n.id, n]));
const box = (n: Node) => ({
  left: n.position.x,
  top: n.position.y,
  right: n.position.x + (n.measured?.width ?? 0),
  bottom: n.position.y + (n.measured?.height ?? 0),
});
const overlaps = (a: Node, b: Node) => {
  const A = box(a);
  const B = box(b);
  return A.left < B.right && B.left < A.right && A.top < B.bottom && B.top < A.bottom;
};
const centerY = (n: Node) => n.position.y + (n.measured?.height ?? 0) / 2;

describe('layoutWorkflow', () => {
  it('flows left to right in dependency order', () => {
    const out = byId(
      layoutWorkflow(
        [node('end', 'END'), node('agent'), node('start', 'START')],
        [edge('start', 'agent'), edge('agent', 'end')],
      ),
    );
    const start = out.get('start') as Node;
    const agent = out.get('agent') as Node;
    const end = out.get('end') as Node;
    expect(start.position.x).toBeLessThan(agent.position.x);
    expect(agent.position.x).toBeLessThan(end.position.x);
    // a straight chain stays on one line — an agent's line is its header dots
    expect(centerY(start)).toBe(agent.position.y + 32);
    expect(centerY(end)).toBe(agent.position.y + 32);
  });

  it('never overlaps nodes, whatever their sizes', () => {
    const nodes = [
      node('t', 'START'),
      node('a', 'AGENT', { width: 280, height: 140 }),
      node('b', 'AGENT', { width: 200, height: 60 }),
      node('c', 'AGENT', { width: 260, height: 120 }),
      node('d', 'AGENT', { width: 220, height: 80 }),
      node('e', 'END'),
    ];
    const edges = [edge('t', 'a'), edge('t', 'b'), edge('t', 'c'), edge('a', 'd'), edge('b', 'd'), edge('c', 'e'), edge('d', 'e')];
    const out = layoutWorkflow(nodes, edges);
    for (let i = 0; i < out.length; i++)
      for (let j = i + 1; j < out.length; j++) expect(overlaps(out[i], out[j])).toBe(false);
  });

  it('puts the If/Else "true" branch above the "false" branch', () => {
    const out = byId(
      layoutWorkflow(
        [node('if', 'IF_ELSE'), node('no'), node('yes'), node('start', 'START')],
        [edge('start', 'if'), edge('if', 'no', 'false'), edge('if', 'yes', 'true')],
      ),
    );
    expect((out.get('yes') as Node).position.y).toBeLessThan((out.get('no') as Node).position.y);
  });

  it('removes the crossing in a crossed pair', () => {
    // a1→b2 and a2→b1 cross unless one layer is reordered
    const out = byId(
      layoutWorkflow(
        [node('s', 'START'), node('a1'), node('a2'), node('b1'), node('b2')],
        [edge('s', 'a1'), edge('s', 'a2'), edge('a1', 'b2'), edge('a2', 'b1')],
      ),
    );
    const above = (x: string, y: string) => (out.get(x) as Node).position.y < (out.get(y) as Node).position.y;
    expect(above('a1', 'a2')).toBe(above('b2', 'b1'));
  });

  it('survives loops', () => {
    const out = byId(
      layoutWorkflow(
        [node('s', 'START'), node('loop', 'WHILE_LOOP'), node('work'), node('done', 'END')],
        [edge('s', 'loop'), edge('loop', 'work'), edge('work', 'loop'), edge('loop', 'done')],
      ),
    );
    expect((out.get('s') as Node).position.x).toBeLessThan((out.get('loop') as Node).position.x);
    expect((out.get('loop') as Node).position.x).toBeLessThan((out.get('work') as Node).position.x);
  });

  it('stacks unconnected flows instead of interleaving them', () => {
    const out = byId(
      layoutWorkflow(
        [node('s1', 'START'), node('x1'), node('s2', 'START'), node('x2')],
        [edge('s1', 'x1'), edge('s2', 'x2')],
      ),
    );
    const first = Math.max(box(out.get('s1') as Node).bottom, box(out.get('x1') as Node).bottom);
    const second = Math.min((out.get('s2') as Node).position.y, (out.get('x2') as Node).position.y);
    expect(second).toBeGreaterThan(first);
  });

  it('keeps the graph anchored where it was', () => {
    const nodes = [node('s', 'START', undefined, { x: 500, y: 300 }), node('a', 'AGENT', undefined, { x: 900, y: 700 })];
    const out = layoutWorkflow(nodes, [edge('s', 'a')]);
    expect(Math.min(...out.map((n) => n.position.x))).toBe(500);
    expect(Math.min(...out.map((n) => n.position.y))).toBe(300);
  });

  it('re-fits a stage group around the steps it contained', () => {
    const group: Node = {
      id: 'g',
      type: 'GROUP',
      position: { x: -50, y: -50 },
      style: { width: 800, height: 400 },
      data: {},
      measured: { width: 800, height: 400 },
    };
    const nodes = [group, node('s', 'START', undefined, { x: 0, y: 0 }), node('a', 'AGENT', undefined, { x: 300, y: 100 })];
    const out = byId(layoutWorkflow(nodes, [edge('s', 'a')]));
    const g = out.get('g') as Node;
    for (const id of ['s', 'a']) {
      const b = box(out.get(id) as Node);
      expect(b.left).toBeGreaterThan(g.position.x);
      expect(b.right).toBeLessThan(g.position.x + Number(g.style?.width));
      expect(b.top).toBeGreaterThan(g.position.y);
      expect(b.bottom).toBeLessThan(g.position.y + Number(g.style?.height));
    }
  });

  it('keeps a sticky note at the same offset from the step it annotates', () => {
    const note: Node = { id: 'n', type: 'STICKY_NOTE', position: { x: 10, y: -120 }, data: {}, measured: { width: 200, height: 80 } };
    const nodes = [note, node('s', 'START', undefined, { x: 0, y: 0 }), node('a', 'AGENT', undefined, { x: 900, y: 600 })];
    const out = byId(layoutWorkflow(nodes, [edge('s', 'a')]));
    const s = out.get('s') as Node;
    const n = out.get('n') as Node;
    expect(n.position.x - s.position.x).toBe(10);
    expect(n.position.y - s.position.y).toBe(-120);
  });

  it('hangs an agent’s attachments in a row under it, clear of the flow (the Orbit AI canvas)', () => {
    const nodes = [
      node('start', 'START'),
      node('kb', 'KB_SEARCH'),
      node('agent', 'AGENT', { width: 380, height: 440 }),
      node('end', 'END'),
      node('prompt', 'PROMPT_TEMPLATE', { width: 360, height: 380 }),
      node('llm', 'AI_CHAT_MODEL', { width: 240, height: 120 }),
    ];
    const out = byId(
      layoutWorkflow(nodes, [edge('start', 'kb'), edge('kb', 'agent'), edge('agent', 'end'), edge('agent', 'prompt', 'prompt'), edge('agent', 'llm', 'llm')]),
    );
    const all = [...out.values()];
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(overlaps(all[i], all[j]), `${all[i].id}/${all[j].id}`).toBe(false);
    const agent = out.get('agent')!;
    const prompt = out.get('prompt')!;
    const llm = out.get('llm')!;
    // Below the agent card, prompt first, and the flow still lines up on the card itself
    expect(prompt.position.y).toBeGreaterThanOrEqual(agent.position.y + 440);
    expect(llm.position.y).toBe(prompt.position.y);
    expect(prompt.position.x).toBeLessThan(llm.position.x);
    expect(out.get('end')!.position.x).toBeGreaterThan(agent.position.x + 380);
    // Edges run straight: End's middle sits on the agent's header dots, not the middle of its tall card
    expect(Math.abs(centerY(out.get('end')!) - (agent.position.y + 32))).toBeLessThan(1);
    expect(Math.abs(centerY(out.get('kb')!) - (agent.position.y + 32))).toBeLessThan(1);
  });

  it('nests a sub-agent’s own attachments under it', () => {
    const nodes = [node('start', 'START'), node('lead', 'AGENT'), node('sub', 'SUB_AGENT'), node('subPrompt', 'PROMPT_TEMPLATE')];
    const out = byId(layoutWorkflow(nodes, [edge('start', 'lead'), edge('lead', 'sub', 'agents'), edge('sub', 'subPrompt', 'prompt')]));
    expect(out.get('sub')!.position.y).toBeGreaterThan(out.get('lead')!.position.y + 90);
    expect(out.get('subPrompt')!.position.y).toBeGreaterThan(out.get('sub')!.position.y + 90);
  });
});
