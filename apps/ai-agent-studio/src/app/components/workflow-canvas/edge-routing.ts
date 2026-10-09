/**
 * Edge routing for the Studio canvas.
 *
 * - `smooth`   curved bezier (drawn by custom-edges)
 * - `step`     orthogonal with rounded corners (React Flow's smooth-step)
 * - `smart`    orthogonal and obstacle-aware: the wire bends around every card
 *              in its way instead of cutting through it (computed here)
 * - `straight` a direct line
 *
 * The canvas has one default routing (saved in the graph's `layout.edgeStyle`);
 * a single connection can override it with `edge.data.routing`.
 */

export type EdgeRouting = 'smooth' | 'step' | 'smart' | 'straight';
/** A connection's own setting: `auto` follows the canvas default. */
export type EdgeRoutingOverride = EdgeRouting | 'auto';

export const EDGE_ROUTINGS: readonly EdgeRouting[] = ['smooth', 'step', 'smart', 'straight'];

export const EDGE_ROUTING_LABELS: Record<EdgeRouting, string> = {
  smooth: 'Curved',
  step: 'Orthogonal',
  smart: 'Smart',
  straight: 'Straight',
};

export const EDGE_ROUTING_HINTS: Record<EdgeRouting, string> = {
  smooth: 'Soft curves between steps',
  step: 'Right angles with rounded corners',
  smart: 'Right angles that steer around cards',
  straight: 'Direct lines',
};

export function isEdgeRouting(value: unknown): value is EdgeRouting {
  return typeof value === 'string' && (EDGE_ROUTINGS as readonly string[]).includes(value);
}

/** The routing a connection is drawn with: its own override, else the canvas default. */
export function resolveEdgeRouting(override: unknown, canvasDefault: unknown): EdgeRouting {
  if (isEdgeRouting(override)) return override;
  return isEdgeRouting(canvasDefault) ? canvasDefault : 'smooth';
}

export type Side = 'left' | 'right' | 'top' | 'bottom';
export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const OUT: Record<Side, [number, number]> = {
  left: [-1, 0],
  right: [1, 0],
  top: [0, -1],
  bottom: [0, 1],
};

/** Clearance kept between a smart wire and any card it passes. */
export const OBSTACLE_PADDING = 18;
/** How far a wire runs straight out of a handle before it may turn. */
const STUB = OBSTACLE_PADDING + 10;
/** Extra cost per bend, so the router prefers fewer turns over a slightly shorter wire. */
const BEND_COST = 40;
/** How far around the two ends obstacles are considered (keeps the grid small). */
export const ROUTING_MARGIN = 320;
/** Upper bound on grid lines per axis; beyond it the router gives up (caller falls back). */
const MAX_LINES = 90;

export interface SmartRouteInput {
  source: Point;
  sourceSide: Side;
  target: Point;
  targetSide: Side;
  /** Cards to steer around (canvas coordinates, unpadded). */
  obstacles: Rect[];
}

/**
 * The bends of an orthogonal wire from `source` to `target` that leaves and
 * enters along the handles' sides and avoids every obstacle (padded by
 * OBSTACLE_PADDING). Returns null when no such wire exists within the search
 * area; the caller then draws a plain orthogonal wire.
 *
 * Shortest path (length + BEND_COST per turn) over a sparse grid made of the
 * padded obstacle edges and the two stub ends.
 */
export function routeAroundObstacles({ source, sourceSide, target, targetSide, obstacles }: SmartRouteInput): Point[] | null {
  const [sdx, sdy] = OUT[sourceSide];
  const [tdx, tdy] = OUT[targetSide];
  const start: Point = { x: source.x + sdx * STUB, y: source.y + sdy * STUB };
  const end: Point = { x: target.x + tdx * STUB, y: target.y + tdy * STUB };

  const padded = obstacles.map((r) => ({
    x1: r.x - OBSTACLE_PADDING,
    y1: r.y - OBSTACLE_PADDING,
    x2: r.x + r.width + OBSTACLE_PADDING,
    y2: r.y + r.height + OBSTACLE_PADDING,
  }));
  // A stub end that lands inside a card's clearance (cards packed tightly)
  // would make the route impossible; such a card can't be avoided anyway.
  const strictlyInside = (p: Point, b: (typeof padded)[number]) => p.x > b.x1 && p.x < b.x2 && p.y > b.y1 && p.y < b.y2;
  const blockers = padded.filter((b) => !strictlyInside(start, b) && !strictlyInside(end, b));

  let minX = Math.min(start.x, end.x);
  let maxX = Math.max(start.x, end.x);
  let minY = Math.min(start.y, end.y);
  let maxY = Math.max(start.y, end.y);
  for (const b of blockers) {
    minX = Math.min(minX, b.x1);
    maxX = Math.max(maxX, b.x2);
    minY = Math.min(minY, b.y1);
    maxY = Math.max(maxY, b.y2);
  }
  // A free lane around everything, so there is always a way round
  const LANE = OBSTACLE_PADDING * 2;
  const xsSet = new Set<number>([start.x, end.x, minX - LANE, maxX + LANE, (start.x + end.x) / 2]);
  const ysSet = new Set<number>([start.y, end.y, minY - LANE, maxY + LANE, (start.y + end.y) / 2]);
  for (const b of blockers) {
    xsSet.add(b.x1);
    xsSet.add(b.x2);
    ysSet.add(b.y1);
    ysSet.add(b.y2);
  }
  const xs = [...xsSet].sort((a, b) => a - b);
  const ys = [...ysSet].sort((a, b) => a - b);
  if (xs.length > MAX_LINES || ys.length > MAX_LINES) return null;

  const W = xs.length;
  const H = ys.length;
  const nodeAt = (p: Point) => {
    const i = xs.indexOf(p.x);
    const j = ys.indexOf(p.y);
    return i < 0 || j < 0 ? -1 : j * W + i;
  };
  const startNode = nodeAt(start);
  const endNode = nodeAt(end);
  if (startNode < 0 || endNode < 0) return null;

  const blocked = (ax: number, ay: number, bx: number, by: number) => {
    // Grid lines sit on obstacle edges, so a unit segment is either fully
    // inside a padded card or fully outside: test its midpoint.
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    for (const b of blockers) if (mx > b.x1 && mx < b.x2 && my > b.y1 && my < b.y2) return true;
    return false;
  };
  const pointBlocked = (x: number, y: number) => {
    for (const b of blockers) if (x > b.x1 && x < b.x2 && y > b.y1 && y < b.y2) return true;
    return false;
  };

  // Directions: 0 right, 1 down, 2 left, 3 up
  const DIRS: [number, number][] = [
    [1, 0],
    [0, 1],
    [-1, 0],
    [0, -1],
  ];
  const dirOf = (dx: number, dy: number) => DIRS.findIndex(([x, y]) => x === dx && y === dy);
  const startDir = dirOf(sdx, sdy);
  // The wire must finish travelling into the target: opposite of its outward side
  const endDir = dirOf(-tdx, -tdy);

  const total = W * H * 4;
  const dist = new Float64Array(total).fill(Infinity);
  const prev = new Int32Array(total).fill(-1);
  const heap = new MinHeap();
  const startState = startNode * 4 + startDir;
  dist[startState] = 0;
  heap.push(0, startState);

  let goal = -1;
  while (heap.size > 0) {
    const [d, state] = heap.pop();
    if (d > dist[state]) continue;
    const node = state >> 2;
    const dir = state & 3;
    if (node === endNode) {
      // Arriving already heading into the target costs nothing extra; the last
      // turn into it is a bend otherwise. A U-turn into it is not allowed.
      if (dir === endDir || (dir + 2) % 4 !== endDir) {
        goal = state;
        break;
      }
    }
    const i = node % W;
    const j = (node - i) / W;
    for (let nd = 0; nd < 4; nd++) {
      if (nd === (dir + 2) % 4) continue; // no doubling back
      const ni = i + DIRS[nd][0];
      const nj = j + DIRS[nd][1];
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      if (blocked(xs[i], ys[j], xs[ni], ys[nj])) continue;
      if (pointBlocked(xs[ni], ys[nj])) continue;
      const nNode = nj * W + ni;
      let cost = d + Math.abs(xs[ni] - xs[i]) + Math.abs(ys[nj] - ys[j]) + (nd === dir ? 0 : BEND_COST);
      if (nNode === endNode && nd !== endDir) cost += BEND_COST;
      const nState = nNode * 4 + nd;
      if (cost < dist[nState]) {
        dist[nState] = cost;
        prev[nState] = state;
        heap.push(cost, nState);
      }
    }
  }
  if (goal < 0) return null;

  const route: Point[] = [];
  for (let s = goal; s >= 0; s = prev[s]) {
    const n = s >> 2;
    const i = n % W;
    route.push({ x: xs[i], y: ys[(n - i) / W] });
  }
  route.reverse();
  return simplify([source, ...route, target]);
}

/** Drops repeated points and the middle of any three collinear ones. */
export function simplify(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && last.x === p.x && last.y === p.y) continue;
    if (out.length >= 2) {
      const a = out[out.length - 2];
      const b = last;
      if ((a.x === b.x && b.x === p.x) || (a.y === b.y && b.y === p.y)) {
        out[out.length - 1] = p;
        continue;
      }
    }
    out.push(p);
  }
  return out;
}

/**
 * An SVG path through `points` with each corner rounded (radius capped by the
 * neighbouring segments), plus the point halfway along it for the label.
 */
export function polylineToRoundedPath(points: Point[], radius = 14): [string, number, number] {
  if (points.length === 0) return ['', 0, 0];
  let d = `M${points[0].x},${points[0].y}`;
  for (let k = 1; k < points.length - 1; k++) {
    const a = points[k - 1];
    const b = points[k];
    const c = points[k + 1];
    const lenIn = Math.hypot(b.x - a.x, b.y - a.y);
    const lenOut = Math.hypot(c.x - b.x, c.y - b.y);
    const r = Math.min(radius, lenIn / 2, lenOut / 2);
    const inX = b.x - ((b.x - a.x) / (lenIn || 1)) * r;
    const inY = b.y - ((b.y - a.y) / (lenIn || 1)) * r;
    const outX = b.x + ((c.x - b.x) / (lenOut || 1)) * r;
    const outY = b.y + ((c.y - b.y) / (lenOut || 1)) * r;
    d += ` L${inX},${inY} Q${b.x},${b.y} ${outX},${outY}`;
  }
  const last = points[points.length - 1];
  d += ` L${last.x},${last.y}`;
  const [lx, ly] = pointAlong(points, 0.5);
  return [d, lx, ly];
}

/** The point at `fraction` of the polyline's length. */
export function pointAlong(points: Point[], fraction: number): [number, number] {
  if (points.length === 1) return [points[0].x, points[0].y];
  let length = 0;
  for (let k = 1; k < points.length; k++) length += Math.hypot(points[k].x - points[k - 1].x, points[k].y - points[k - 1].y);
  let remaining = length * fraction;
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1];
    const b = points[k];
    const seg = Math.hypot(b.x - a.x, b.y - a.y);
    if (remaining <= seg) {
      const t = seg === 0 ? 0 : remaining / seg;
      return [a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t];
    }
    remaining -= seg;
  }
  const last = points[points.length - 1];
  return [last.x, last.y];
}

/** Whether a rect is close enough to a wire's ends to matter for routing it. */
export function nearRoute(rect: Rect, a: Point, b: Point, margin = ROUTING_MARGIN): boolean {
  const minX = Math.min(a.x, b.x) - margin;
  const maxX = Math.max(a.x, b.x) + margin;
  const minY = Math.min(a.y, b.y) - margin;
  const maxY = Math.max(a.y, b.y) + margin;
  return rect.x < maxX && rect.x + rect.width > minX && rect.y < maxY && rect.y + rect.height > minY;
}

/** Packs rects into a string, so a React Flow store selector can compare by value. */
export function encodeRects(rects: Rect[]): string {
  return rects.map((r) => `${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`).join(';');
}

export function decodeRects(key: string): Rect[] {
  if (!key) return [];
  return key.split(';').map((part) => {
    const [x, y, width, height] = part.split(',').map(Number);
    return { x, y, width, height };
  });
}

/** Minimal binary min-heap of (priority, value). */
class MinHeap {
  private keys: number[] = [];
  private vals: number[] = [];
  get size() {
    return this.keys.length;
  }
  push(key: number, val: number) {
    const keys = this.keys;
    const vals = this.vals;
    let i = keys.length;
    keys.push(key);
    vals.push(val);
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= key) break;
      keys[i] = keys[p];
      vals[i] = vals[p];
      i = p;
    }
    keys[i] = key;
    vals[i] = val;
  }
  pop(): [number, number] {
    const keys = this.keys;
    const vals = this.vals;
    const topK = keys[0];
    const topV = vals[0];
    const lastK = keys.pop() as number;
    const lastV = vals.pop() as number;
    if (keys.length > 0) {
      let i = 0;
      const n = keys.length;
      for (;;) {
        const l = 2 * i + 1;
        if (l >= n) break;
        const r = l + 1;
        const c = r < n && keys[r] < keys[l] ? r : l;
        if (keys[c] >= lastK) break;
        keys[i] = keys[c];
        vals[i] = vals[c];
        i = c;
      }
      keys[i] = lastK;
      vals[i] = lastV;
    }
    return [topK, topV];
  }
}
