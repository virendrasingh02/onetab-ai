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
    // a straight chain stays on one line — centered on the node
    expect(centerY(start)).toBe(centerY(agent));
    expect(centerY(end)).toBe(centerY(agent));
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
    // Edges run straight: End's middle sits on the agent's center
    expect(Math.abs(centerY(out.get('end')!) - centerY(agent))).toBeLessThan(1);
    expect(Math.abs(centerY(out.get('kb')!) - centerY(agent))).toBeLessThan(1);
  });

  it('attachmentsOnly hangs attachments under their agent and leaves the flow where it is', () => {
    const nodes = [
      node('start', 'START', undefined, { x: 10, y: 20 }),
      node('agent', 'AGENT', { width: 290, height: 400 }, { x: 400, y: 30 }),
      node('end', 'END', undefined, { x: 900, y: 70 }),
      node('kb', 'KB_SEARCH', { width: 240, height: 100 }, { x: 5, y: 900 }),
      node('mail', 'APP_CONNECTOR_ACTION', { width: 260, height: 140 }, { x: 1300, y: 1200 }),
    ];
    const edges = [edge('start', 'agent'), edge('agent', 'end'), edge('agent', 'kb', 'embedding'), edge('agent', 'mail', 'tools')];
    const out = byId(layoutWorkflow(nodes, edges, { attachmentsOnly: true }));
    for (const id of ['start', 'agent', 'end']) expect(out.get(id)!.position).toEqual(nodes.find((n) => n.id === id)!.position);
    const agent = out.get('agent')!;
    const kb = out.get('kb')!;
    const mail = out.get('mail')!;
    expect(kb.position.y).toBeGreaterThanOrEqual(agent.position.y + 400);
    expect(mail.position.y).toBe(kb.position.y);
    // Knowledge before Tools, the row centred under the agent card
    expect(kb.position.x).toBeLessThan(mail.position.x);
    const rowCenter = (kb.position.x + mail.position.x + 260) / 2;
    expect(Math.abs(rowCenter - (agent.position.x + 145))).toBeLessThan(2);
  });

  describe('tree arrangement', () => {
    const fan = {
      nodes: [node('s', 'START'), node('a'), node('b'), node('a1'), node('a2'), node('b1'), node('m', 'AGENT', { width: 300, height: 160 })],
      edges: [edge('s', 'a'), edge('s', 'b'), edge('a', 'a1'), edge('a', 'a2'), edge('b', 'b1'), edge('a2', 'm'), edge('b1', 'm')],
    };

    it('centres each parent on its children and never overlaps', () => {
      const list = layoutWorkflow(fan.nodes, fan.edges, { arrange: 'tree' });
      for (let i = 0; i < list.length; i++)
        for (let j = i + 1; j < list.length; j++) expect(overlaps(list[i], list[j]), `${list[i].id}/${list[j].id}`).toBe(false);
      const out = byId(list);
      const mid = (x: string, y: string) => (centerY(out.get(x)!) + centerY(out.get(y)!)) / 2;
      expect(Math.abs(centerY(out.get('a')!) - mid('a1', 'a2'))).toBeLessThan(1);
      expect(Math.abs(centerY(out.get('s')!) - mid('a', 'b'))).toBeLessThan(1);
      // a's whole branch sits on one side of b's
      expect(box(out.get('a2')!).bottom).toBeLessThanOrEqual(out.get('b1')!.position.y);
    });

    it('still runs every edge forward, merges included', () => {
      const out = byId(layoutWorkflow(fan.nodes, fan.edges, { arrange: 'tree' }));
      for (const e of fan.edges) expect(out.get(e.source)!.position.x).toBeLessThan(out.get(e.target)!.position.x);
    });

    it('lays out top to bottom too', () => {
      const out = byId(layoutWorkflow(fan.nodes, fan.edges, { direction: 'TB', arrange: 'tree' }));
      expect(out.get('s')!.position.y).toBeLessThan(out.get('a')!.position.y);
      expect(out.get('a')!.position.x).toBeLessThan(out.get('b')!.position.x);
    });
  });

  it('spreads further apart with more spacing', () => {
    const nodes = [node('s', 'START'), node('a'), node('b')];
    const edges = [edge('s', 'a'), edge('s', 'b')];
    const gapOf = (spacing: 'compact' | 'spacious') => {
      const out = byId(layoutWorkflow(nodes, edges, { spacing }));
      return out.get('a')!.position.x - box(out.get('s')!).right;
    };
    expect(gapOf('spacious')).toBeGreaterThan(gapOf('compact'));
  });

  it('nests a sub-agent’s own attachments under it', () => {
    const nodes = [node('start', 'START'), node('lead', 'AGENT'), node('sub', 'SUB_AGENT'), node('subPrompt', 'PROMPT_TEMPLATE')];
    const out = byId(layoutWorkflow(nodes, [edge('start', 'lead'), edge('lead', 'sub', 'agents'), edge('sub', 'subPrompt', 'prompt')]));
    expect(out.get('sub')!.position.y).toBeGreaterThan(out.get('lead')!.position.y + 90);
    expect(out.get('subPrompt')!.position.y).toBeGreaterThan(out.get('sub')!.position.y + 90);
  });
});
