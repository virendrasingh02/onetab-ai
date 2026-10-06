import type { Edge, Node } from '@xyflow/react';
import { handleOrder } from './agent-slots.js';

/**
 * Layered ("Sugiyama") auto-layout for the workflow canvas.
 *
 *   1. drop back edges so loops don't break layering
 *   2. rank steps by longest path from the triggers
 *   3. route edges that skip layers through invisible waypoints
 *   4. order each layer to minimise edge crossings (barycenter sweeps, best kept)
 *   5. place steps next to the steps they connect to, never overlapping
 *
 * It uses each node's real measured size, keeps If/Else "true" above "false",
 * lays out unconnected flows as separate stacked blocks, keeps sticky notes next
 * to the step they annotate and re-fits stage groups around their members.
 */

export type LayoutDirection = 'LR' | 'TB';

/** Space between layers (columns for LR, rows for TB). */
const LAYER_GAP: Record<LayoutDirection, number> = { LR: 96, TB: 72 };
/** Space between neighbouring steps inside one layer. */
const NODE_GAP: Record<LayoutDirection, number> = { LR: 56, TB: 48 };
/** Space between unconnected flows. */
const COMPONENT_GAP = 96;
const GROUP_PADDING = { side: 24, top: 48, bottom: 24 };
const DEFAULT_SIZE = { width: 240, height: 90 };
/** Thickness of an invisible waypoint on a long edge. */
const WAYPOINT_SIZE = 8;
const ORDER_SWEEPS = 12;
const POSITION_SWEEPS = 8;

type Size = { width: number; height: number };

/** Map lookup for keys the algorithm itself inserted — a miss is a bug, not a user state. */
function must<K, V>(map: Map<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined) throw new Error(`auto-layout: missing entry for ${String(key)}`);
  return value;
}
type Point = { x: number; y: number };

const typeOf = (n: Node) => (n.type || '').toUpperCase();
const isNote = (n: Node) => /NOTE|STICKY|ANNOTATION/.test(typeOf(n));
const isGroup = (n: Node) => /GROUP|STAGE|SUBFLOW|FRAME/.test(typeOf(n));
const isTrigger = (n: Node) => /^START$|TRIGGER/.test(typeOf(n));

function sizeOf(n: Node): Size {
  const styleW = typeof n.style?.width === 'number' ? n.style.width : undefined;
  const styleH = typeof n.style?.height === 'number' ? n.style.height : undefined;
  return {
    width: n.measured?.width ?? n.width ?? styleW ?? DEFAULT_SIZE.width,
    height: n.measured?.height ?? n.height ?? styleH ?? DEFAULT_SIZE.height,
  };
}

const centerOf = (n: Node): Point => {
  const s = sizeOf(n);
  return { x: n.position.x + s.width / 2, y: n.position.y + s.height / 2 };
};

/**
 * Sibling order: an agent's slot attachments (Prompt, LLM, …) first so they sit
 * beside it above its next step; If/Else "true" above "false".
 */
const handleRank = handleOrder;

interface Link {
  source: string;
  target: string;
  rank: number; // handleRank, used to order siblings
}

interface ComponentLayout {
  positions: Map<string, Point>;
  width: number;
  height: number;
}

/** Lay out one connected flow. Positions are top-left, normalised so the block starts at (0,0). */
function layoutComponent(
  ids: string[],
  links: Link[],
  sizes: Map<string, Size>,
  nodeById: Map<string, Node>,
  dir: LayoutDirection,
): ComponentLayout {
  const alongOf = (s: Size) => (dir === 'LR' ? s.width : s.height);
  const acrossOf = (s: Size) => (dir === 'LR' ? s.height : s.width);

  const out = new Map<string, Link[]>(ids.map((id) => [id, []]));
  const indegree = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const l of links) {
    out.get(l.source)?.push(l);
    indegree.set(l.target, (indegree.get(l.target) ?? 0) + 1);
  }
  out.forEach((list) => list.sort((a, b) => a.rank - b.rank));

  // Roots: triggers first, then anything nothing feeds into, then the rest (pure cycles)
  const roots = [
    ...ids.filter((id) => isTrigger(must(nodeById, id))),
    ...ids.filter((id) => !isTrigger(must(nodeById, id)) && (indegree.get(id) ?? 0) === 0),
  ];

  // 1. Cycle removal: DFS, keep every edge except back edges
  const dag = new Map<string, Link[]>(ids.map((id) => [id, []]));
  const visited = new Set<string>();
  const onStack = new Set<string>();
  const visit = (u: string) => {
    visited.add(u);
    onStack.add(u);
    for (const l of out.get(u) ?? []) {
      if (onStack.has(l.target)) continue; // back edge → ignored for layering
      must(dag, u).push(l);
      if (!visited.has(l.target)) visit(l.target);
    }
    onStack.delete(u);
  };
  for (const r of roots) if (!visited.has(r)) visit(r);
  for (const id of ids) if (!visited.has(id)) visit(id);

  // 2. Ranking: longest path in topological order
  const dagIn = new Map<string, number>(ids.map((id) => [id, 0]));
  dag.forEach((list) => list.forEach((l) => dagIn.set(l.target, (dagIn.get(l.target) ?? 0) + 1)));
  const queue = ids.filter((id) => (dagIn.get(id) ?? 0) === 0);
  const topo: string[] = [];
  const remaining = new Map(dagIn);
  while (queue.length) {
    const u = (queue.shift() as string);
    topo.push(u);
    for (const l of dag.get(u) ?? []) {
      const left = (remaining.get(l.target) ?? 0) - 1;
      remaining.set(l.target, left);
      if (left === 0) queue.push(l.target);
    }
  }
  const rank = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const u of topo) {
    for (const l of dag.get(u) ?? []) {
      rank.set(l.target, Math.max(rank.get(l.target) ?? 0, (rank.get(u) ?? 0) + 1));
    }
  }
  // A non-trigger source (e.g. a config step feeding layer 4) sits just before what it feeds
  for (const id of ids) {
    const children = dag.get(id) ?? [];
    if ((dagIn.get(id) ?? 0) === 0 && !isTrigger(must(nodeById, id)) && children.length > 0) {
      rank.set(id, Math.max(0, Math.min(...children.map((l) => rank.get(l.target) ?? 0)) - 1));
    }
  }

  // 3. Long edges get invisible waypoints so the crossing reduction can route them
  const layerCount = Math.max(...ids.map((id) => rank.get(id) ?? 0)) + 1;
  const layers: string[][] = Array.from({ length: layerCount }, () => []);
  const segOut = new Map<string, string[]>();
  const segIn = new Map<string, string[]>();
  const allIds = [...ids];
  const addSeg = (a: string, b: string) => {
    if (!segOut.has(a)) segOut.set(a, []);
    if (!segIn.has(b)) segIn.set(b, []);
    must(segOut, a).push(b);
    must(segIn, b).push(a);
  };
  for (const id of ids) {
    for (const l of dag.get(id) ?? []) {
      const from = must(rank, id);
      const to = must(rank, l.target);
      let prev = id;
      for (let r = from + 1; r < to; r++) {
        const wp = `__wp:${id}>${l.target}:${r}`;
        sizes.set(wp, { width: WAYPOINT_SIZE, height: WAYPOINT_SIZE });
        rank.set(wp, r);
        allIds.push(wp);
        addSeg(prev, wp);
        prev = wp;
      }
      addSeg(prev, l.target);
    }
  }

  // 4a. Initial order: depth-first from the roots, so branches stay together and
  //     siblings follow handle order (true → default → false)
  const seen = new Set<string>();
  const place = (u: string) => {
    if (seen.has(u)) return;
    seen.add(u);
    layers[must(rank, u)].push(u);
    for (const v of segOut.get(u) ?? []) place(v);
  };
  for (const r of roots) place(r);
  for (const id of allIds) place(id);

  // 4b. Crossing reduction: barycenter sweeps down and up, keeping the best ordering seen
  const indexIn = (layer: string[]) => new Map(layer.map((id, i) => [id, i]));
  const crossings = (ls: string[][]) => {
    let total = 0;
    for (let r = 0; r < ls.length - 1; r++) {
      const nextIdx = indexIn(ls[r + 1]);
      const segs: [number, number][] = [];
      ls[r].forEach((u, i) => (segOut.get(u) ?? []).forEach((v) => segs.push([i, nextIdx.get(v) ?? 0])));
      for (let a = 0; a < segs.length; a++)
        for (let b = a + 1; b < segs.length; b++)
          if ((segs[a][0] - segs[b][0]) * (segs[a][1] - segs[b][1]) < 0) total++;
    }
    return total;
  };
  const sortByBarycenter = (layer: string[], neighbours: Map<string, string[]>, refLayer: string[]) => {
    const refIdx = indexIn(refLayer);
    const keyed = layer.map((id, i) => {
      const ns = (neighbours.get(id) ?? []).map((n) => refIdx.get(n)).filter((v): v is number => v !== undefined);
      return { id, key: ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : i, i };
    });
    keyed.sort((a, b) => a.key - b.key || a.i - b.i); // stable: ties keep branch order
    return keyed.map((k) => k.id);
  };
  let best = layers.map((l) => [...l]);
  let bestCrossings = crossings(best);
  const current = layers.map((l) => [...l]);
  for (let sweep = 0; sweep < ORDER_SWEEPS && bestCrossings > 0; sweep++) {
    if (sweep % 2 === 0) {
      for (let r = 1; r < current.length; r++) current[r] = sortByBarycenter(current[r], segIn, current[r - 1]);
    } else {
      for (let r = current.length - 2; r >= 0; r--) current[r] = sortByBarycenter(current[r], segOut, current[r + 1]);
    }
    const c = crossings(current);
    if (c < bestCrossings) {
      bestCrossings = c;
      best = current.map((l) => [...l]);
    }
  }

  // 5a. Across-axis: each step moves toward the centre of what it connects to,
  //     then the layer is packed so neighbours keep their order and gap.
  const gap = NODE_GAP[dir];
  const center = new Map<string, number>();
  for (const layer of best) {
    let cursor = 0;
    for (const id of layer) {
      const s = acrossOf(must(sizes, id));
      center.set(id, cursor + s / 2);
      cursor += s + gap;
    }
    const shift = cursor / 2;
    layer.forEach((id) => center.set(id, must(center, id) - shift));
  }
  const pack = (layer: string[], desired: number[]) => {
    const s = layer.map((id) => acrossOf(must(sizes, id)));
    const sep = (i: number) => (s[i] + s[i + 1]) / 2 + gap;
    const fwd = [...desired];
    for (let i = 1; i < fwd.length; i++) fwd[i] = Math.max(desired[i], fwd[i - 1] + sep(i - 1));
    const bwd = [...desired];
    for (let i = bwd.length - 2; i >= 0; i--) bwd[i] = Math.min(desired[i], bwd[i + 1] - sep(i));
    // both satisfy every separation constraint, so their average does too
    layer.forEach((id, i) => center.set(id, (fwd[i] + bwd[i]) / 2));
  };
  const relax = (layer: string[], neighbours: Map<string, string[]>) => {
    const desired = layer.map((id) => {
      const ns = neighbours.get(id) ?? [];
      return ns.length ? ns.reduce((a, n) => a + (center.get(n) ?? 0), 0) / ns.length : must(center, id);
    });
    pack(layer, desired);
  };
  for (let sweep = 0; sweep < POSITION_SWEEPS; sweep++) {
    if (sweep % 2 === 0) for (let r = 1; r < best.length; r++) relax(best[r], segIn);
    else for (let r = best.length - 2; r >= 0; r--) relax(best[r], segOut);
  }
  // finish on a downward pass so steps line up with what feeds them
  for (let r = 1; r < best.length; r++) relax(best[r], segIn);

  // 5b. Along-axis: each layer is as deep as its biggest step; steps are centred in it
  const layerDepth = best.map((layer) => Math.max(0, ...layer.map((id) => alongOf(must(sizes, id)))));
  const layerStart: number[] = [];
  let cursor = 0;
  layerDepth.forEach((depth, r) => {
    layerStart[r] = cursor;
    cursor += depth + (depth > WAYPOINT_SIZE ? LAYER_GAP[dir] : LAYER_GAP[dir] / 2);
  });

  const positions = new Map<string, Point>();
  let minAcross = Infinity;
  let maxAcross = -Infinity;
  let maxAlong = 0;
  best.forEach((layer, r) => {
    for (const id of layer) {
      if (id.startsWith('__wp:')) continue;
      const s = must(sizes, id);
      const along = layerStart[r] + (layerDepth[r] - alongOf(s)) / 2;
      const across = must(center, id) - acrossOf(s) / 2;
      minAcross = Math.min(minAcross, across);
      maxAcross = Math.max(maxAcross, across + acrossOf(s));
      maxAlong = Math.max(maxAlong, along + alongOf(s));
      positions.set(id, dir === 'LR' ? { x: along, y: across } : { x: across, y: along });
    }
  });
  // normalise to start at (0,0)
  positions.forEach((p, id) =>
    positions.set(id, dir === 'LR' ? { x: p.x, y: p.y - minAcross } : { x: p.x - minAcross, y: p.y }),
  );
  const acrossExtent = maxAcross - minAcross;
  return {
    positions,
    width: dir === 'LR' ? maxAlong : acrossExtent,
    height: dir === 'LR' ? acrossExtent : maxAlong,
  };
}

/**
 * Returns a copy of `nodes` with tidy positions. Edges are untouched. The laid-out
 * graph keeps the top-left corner the flow had before, so the canvas doesn't jump away.
 */
export function layoutWorkflow(nodes: Node[], edges: Edge[], direction: LayoutDirection = 'LR'): Node[] {
  const flow = nodes.filter((n) => !isNote(n) && !isGroup(n));
  if (flow.length === 0) return nodes;
  const notes = nodes.filter(isNote);
  const groups = nodes.filter((n) => isGroup(n) && !isNote(n));
  const nodeById = new Map(flow.map((n) => [n.id, n]));
  const sizes = new Map(flow.map((n) => [n.id, sizeOf(n)]));

  // Unique real connections between flow steps
  const seenPairs = new Set<string>();
  const links: Link[] = [];
  for (const e of edges) {
    if (!nodeById.has(e.source) || !nodeById.has(e.target) || e.source === e.target) continue;
    const key = `${e.source}>${e.target}`;
    if (seenPairs.has(key)) continue;
    seenPairs.add(key);
    links.push({ source: e.source, target: e.target, rank: handleRank(e.sourceHandle) });
  }

  // Remember what belongs together before anything moves
  const oldLeft = Math.min(...flow.map((n) => n.position.x));
  const oldTop = Math.min(...flow.map((n) => n.position.y));
  const groupMembers = new Map<string, string[]>();
  for (const g of groups) {
    const s = sizeOf(g);
    groupMembers.set(
      g.id,
      flow
        .filter((n) => {
          const c = centerOf(n);
          return c.x >= g.position.x && c.x <= g.position.x + s.width && c.y >= g.position.y && c.y <= g.position.y + s.height;
        })
        .map((n) => n.id),
    );
  }
  const noteAnchors = new Map<string, { anchor: string; dx: number; dy: number }>();
  for (const note of notes) {
    const c = centerOf(note);
    let nearest: Node | null = null;
    let bestDist = Infinity;
    for (const n of flow) {
      const nc = centerOf(n);
      const d = Math.hypot(nc.x - c.x, nc.y - c.y);
      if (d < bestDist) {
        bestDist = d;
        nearest = n;
      }
    }
    if (nearest) {
      noteAnchors.set(note.id, {
        anchor: nearest.id,
        dx: note.position.x - nearest.position.x,
        dy: note.position.y - nearest.position.y,
      });
    }
  }

  // Connected components, in reading order: flows with a trigger first, then by where they were
  const adjacency = new Map<string, string[]>(flow.map((n) => [n.id, []]));
  links.forEach((l) => {
    must(adjacency, l.source).push(l.target);
    must(adjacency, l.target).push(l.source);
  });
  const componentOf = new Map<string, number>();
  const components: string[][] = [];
  for (const n of flow) {
    if (componentOf.has(n.id)) continue;
    const comp: string[] = [];
    const stack = [n.id];
    componentOf.set(n.id, components.length);
    while (stack.length) {
      const u = (stack.pop() as string);
      comp.push(u);
      for (const v of adjacency.get(u) ?? []) {
        if (!componentOf.has(v)) {
          componentOf.set(v, components.length);
          stack.push(v);
        }
      }
    }
    components.push(comp);
  }
  const acrossStart = (ids: string[]) =>
    Math.min(...ids.map((id) => (direction === 'LR' ? must(nodeById, id).position.y : must(nodeById, id).position.x)));
  components.sort((a, b) => {
    const at = a.some((id) => isTrigger(must(nodeById, id))) ? 0 : 1;
    const bt = b.some((id) => isTrigger(must(nodeById, id))) ? 0 : 1;
    return at - bt || acrossStart(a) - acrossStart(b);
  });

  // Lay out each flow and stack them
  const positions = new Map<string, Point>();
  let offset = 0;
  for (const comp of components) {
    const set = new Set(comp);
    const result = layoutComponent(
      comp,
      links.filter((l) => set.has(l.source)),
      sizes,
      nodeById,
      direction,
    );
    result.positions.forEach((p, id) =>
      positions.set(id, direction === 'LR' ? { x: p.x, y: p.y + offset } : { x: p.x + offset, y: p.y }),
    );
    offset += (direction === 'LR' ? result.height : result.width) + COMPONENT_GAP;
  }

  // Anchor at the old top-left corner
  positions.forEach((p, id) =>
    positions.set(id, { x: Math.round(p.x + oldLeft), y: Math.round(p.y + oldTop) }),
  );

  return nodes.map((n) => {
    const p = positions.get(n.id);
    if (p) return { ...n, position: p };

    // Sticky note: same offset from the step it annotated
    const anchor = noteAnchors.get(n.id);
    if (anchor) {
      const ap = positions.get(anchor.anchor);
      if (ap) return { ...n, position: { x: Math.round(ap.x + anchor.dx), y: Math.round(ap.y + anchor.dy) } };
    }

    // Stage group: re-fit around the steps it contained
    const members = (groupMembers.get(n.id) ?? []).filter((id) => positions.has(id));
    if (members.length > 0) {
      const boxes = members.map((id) => ({ p: must(positions, id), s: must(sizes, id) }));
      const left = Math.min(...boxes.map((b) => b.p.x)) - GROUP_PADDING.side;
      const top = Math.min(...boxes.map((b) => b.p.y)) - GROUP_PADDING.top;
      const right = Math.max(...boxes.map((b) => b.p.x + b.s.width)) + GROUP_PADDING.side;
      const bottom = Math.max(...boxes.map((b) => b.p.y + b.s.height)) + GROUP_PADDING.bottom;
      return {
        ...n,
        position: { x: Math.round(left), y: Math.round(top) },
        style: { ...n.style, width: Math.round(right - left), height: Math.round(bottom - top) },
      };
    }
    return n;
  });
}
