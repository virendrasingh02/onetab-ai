import { describe, expect, it } from 'vitest';
import {
  OBSTACLE_PADDING,
  decodeRects,
  encodeRects,
  nearRoute,
  pointAlong,
  polylineToRoundedPath,
  resolveEdgeRouting,
  routeAroundObstacles,
  simplify,
  type Point,
  type Rect,
} from './edge-routing';

/** Whether any segment of the wire passes through a card's interior. */
function crosses(points: Point[], r: Rect): boolean {
  for (let k = 1; k < points.length; k++) {
    const a = points[k - 1];
    const b = points[k];
    const steps = 50;
    for (let s = 1; s < steps; s++) {
      const x = a.x + ((b.x - a.x) * s) / steps;
      const y = a.y + ((b.y - a.y) * s) / steps;
      if (x > r.x && x < r.x + r.width && y > r.y && y < r.y + r.height) return true;
    }
  }
  return false;
}

const isOrthogonal = (points: Point[]) => points.every((p, k) => k === 0 || p.x === points[k - 1].x || p.y === points[k - 1].y);

describe('resolveEdgeRouting', () => {
  it('prefers the connection override, then the canvas default, then smooth', () => {
    expect(resolveEdgeRouting('smart', 'step')).toBe('smart');
    expect(resolveEdgeRouting('auto', 'step')).toBe('step');
    expect(resolveEdgeRouting(undefined, 'straight')).toBe('straight');
    expect(resolveEdgeRouting('nonsense', 'nope')).toBe('smooth');
  });
});

describe('routeAroundObstacles', () => {
  it('runs straight across when nothing is in the way', () => {
    const route = routeAroundObstacles({
      source: { x: 0, y: 0 },
      sourceSide: 'right',
      target: { x: 300, y: 0 },
      targetSide: 'left',
      obstacles: [],
    });
    expect(route).toEqual([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
    ]);
  });

  it('steers around a card sitting between the two ends', () => {
    const blocker: Rect = { x: 120, y: -40, width: 80, height: 80 };
    const route = routeAroundObstacles({
      source: { x: 0, y: 0 },
      sourceSide: 'right',
      target: { x: 400, y: 0 },
      targetSide: 'left',
      obstacles: [blocker],
    });
    expect(route).not.toBeNull();
    const points = route as Point[];
    expect(isOrthogonal(points)).toBe(true);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    expect(points[points.length - 1]).toEqual({ x: 400, y: 0 });
    // Keeps its clearance from the card, not just its outline
    const padded = {
      x: blocker.x - OBSTACLE_PADDING + 1,
      y: blocker.y - OBSTACLE_PADDING + 1,
      width: blocker.width + OBSTACLE_PADDING * 2 - 2,
      height: blocker.height + OBSTACLE_PADDING * 2 - 2,
    };
    expect(crosses(points, padded)).toBe(false);
  });

  it('loops a back-edge around its own source and target cards', () => {
    // Source card on the right, target card on the left: the wire has to go round.
    const sourceCard: Rect = { x: 400, y: -45, width: 200, height: 90 };
    const targetCard: Rect = { x: 0, y: -45, width: 200, height: 90 };
    const route = routeAroundObstacles({
      source: { x: 600, y: 0 },
      sourceSide: 'right',
      target: { x: 0, y: 0 },
      targetSide: 'left',
      obstacles: [sourceCard, targetCard],
    }) as Point[];
    expect(route).not.toBeNull();
    expect(isOrthogonal(route)).toBe(true);
    expect(crosses(route, sourceCard)).toBe(false);
    expect(crosses(route, targetCard)).toBe(false);
    // Leaves rightwards out of the source and enters the target moving right
    expect(route[1].x).toBeGreaterThan(600);
    expect(route[route.length - 2].x).toBeLessThan(0);
  });

  it('finds a clear path through a dense grid of cards quickly', () => {
    // 6 x 5 cards of 240 x 90, 120px apart: wire from the top-left card to the bottom-right one
    const cards: Rect[] = [];
    for (let c = 0; c < 6; c++) for (let r = 0; r < 5; r++) cards.push({ x: c * 360, y: r * 210, width: 240, height: 90 });
    const from = cards[0];
    const to = cards[cards.length - 1];
    const started = performance.now();
    const route = routeAroundObstacles({
      source: { x: from.x + from.width + 16, y: from.y + 45 },
      sourceSide: 'right',
      target: { x: to.x - 16, y: to.y + 45 },
      targetSide: 'left',
      obstacles: cards,
    }) as Point[];
    const elapsed = performance.now() - started;
    expect(route).not.toBeNull();
    expect(isOrthogonal(route)).toBe(true);
    for (const card of cards) expect(crosses(route, card)).toBe(false);
    // Runs per wire per drag frame, so it has to stay cheap
    expect(elapsed).toBeLessThan(50);
  });

  it('leaves and enters perpendicular to vertical handles', () => {
    const route = routeAroundObstacles({
      source: { x: 0, y: 0 },
      sourceSide: 'bottom',
      target: { x: 200, y: 300 },
      targetSide: 'top',
      obstacles: [],
    }) as Point[];
    expect(route[1].x).toBe(0);
    expect(route[1].y).toBeGreaterThan(0);
    expect(route[route.length - 2].x).toBe(200);
    expect(route[route.length - 2].y).toBeLessThan(300);
  });
});

describe('path helpers', () => {
  it('simplify drops collinear and duplicate points', () => {
    expect(
      simplify([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
        { x: 20, y: 10 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 20, y: 10 },
    ]);
  });

  it('rounds corners and puts the label halfway along', () => {
    const [d, lx, ly] = polylineToRoundedPath([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);
    expect(d).toContain('Q100,0');
    expect([lx, ly]).toEqual([100, 0]);
    expect(pointAlong([{ x: 0, y: 0 }, { x: 0, y: 40 }], 0.25)).toEqual([0, 10]);
  });

  it('round-trips rects and filters them to the area around a wire', () => {
    const rects = [{ x: 1, y: 2, width: 3, height: 4 }];
    expect(decodeRects(encodeRects(rects))).toEqual(rects);
    expect(decodeRects('')).toEqual([]);
    expect(nearRoute({ x: 5000, y: 0, width: 10, height: 10 }, { x: 0, y: 0 }, { x: 100, y: 0 })).toBe(false);
    expect(nearRoute({ x: 50, y: 0, width: 10, height: 10 }, { x: 0, y: 0 }, { x: 100, y: 0 })).toBe(true);
  });
});
