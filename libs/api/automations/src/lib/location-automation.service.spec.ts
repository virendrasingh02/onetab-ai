import type { GeofenceTriggerConfig } from '@org/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LocationAutomationService,
  evaluateGeofence,
  haversineDistance,
  type LocationReading,
  type PresenceState,
} from './location-automation.service.js';

const office: GeofenceTriggerConfig = {
  event: 'BOTH',
  officeName: 'HQ',
  latitude: 12.9716,
  longitude: 77.5946,
  radiusMeters: 100,
  dwellMinutes: 3,
  accuracyMeters: 100,
  cooldownMinutes: 60,
};

const T0 = new Date('2026-10-12T09:00:00Z');
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);
const inside = (when: Date, accuracy = 10): LocationReading => ({ latitude: 12.9716, longitude: 77.5946, accuracy, recordedAt: when });
const farAway = (when: Date): LocationReading => ({ latitude: 13.05, longitude: 77.65, accuracy: 10, recordedAt: when });

/** Feeds readings through the evaluator the way the service does. */
function walk(readings: Array<[LocationReading, Date]>, zone = office) {
  let state: PresenceState | null = null;
  return readings.map(([reading, now]) => {
    const decision = evaluateGeofence(reading, zone, state, now);
    state = decision.state;
    return decision;
  });
}

describe('haversineDistance', () => {
  it('is 0 for the same point and ~44 m for 0.0004° of latitude', () => {
    expect(haversineDistance(12.9716, 77.5946, 12.9716, 77.5946)).toBe(0);
    expect(haversineDistance(12.9716, 77.5946, 12.972, 77.5946)).toBe(44);
  });
});

describe('evaluateGeofence', () => {
  it('ignores stale, future-dated and imprecise readings without touching state', () => {
    expect(evaluateGeofence(inside(at(-30)), office, null, T0)).toMatchObject({ crossing: null, reason: expect.stringContaining('old') });
    expect(evaluateGeofence(inside(at(10)), office, null, T0).reason).toContain('future');
    const imprecise = evaluateGeofence(inside(T0, 350), office, null, T0);
    expect(imprecise.crossing).toBeNull();
    expect(imprecise.state.firstInsideAt).toBeNull();
  });

  it('confirms an arrival only after the dwell time', () => {
    const [first, early, confirmed, again] = walk([
      [inside(T0), T0],
      [inside(at(2)), at(2)],
      [inside(at(3)), at(3)],
      [inside(at(4)), at(4)],
    ]);
    expect(first.crossing).toBeNull();
    expect(early.crossing).toBeNull();
    expect(confirmed).toMatchObject({ crossing: 'ENTER', fire: true });
    expect(again.crossing).toBeNull(); // still there — never a second check-in
  });

  it('holds the current side at the zone edge (GPS jitter)', () => {
    // ~120 m out with 50 m uncertainty: neither confidently in nor out.
    const edge: LocationReading = { latitude: 12.97268, longitude: 77.5946, accuracy: 50, recordedAt: T0 };
    expect(evaluateGeofence(edge, office, null, T0).reason).toContain('edge');
  });

  it('needs an arrival before a departure, then confirms leaving after dwell + cooldown', () => {
    expect(walk([[farAway(T0), T0]])[0].crossing).toBeNull();

    const zone = { ...office, cooldownMinutes: 30 };
    const decisions = walk(
      [
        [inside(T0), T0],
        [inside(at(3)), at(3)], // ENTER at +3
        [farAway(at(10)), at(10)],
        [farAway(at(14)), at(14)], // dwelled, but within the 30-min cooldown
        [farAway(at(40)), at(40)], // EXIT
      ],
      zone,
    );
    expect(decisions.map((d) => d.crossing)).toEqual([null, 'ENTER', null, null, 'EXIT']);
    expect(decisions[3].reason).toContain('cooldown');
  });

  it('records a crossing the trigger does not listen for, without firing', () => {
    const decisions = walk(
      [
        [inside(T0), T0],
        [inside(at(3)), at(3)],
      ],
      { ...office, event: 'EXIT' },
    );
    expect(decisions[1]).toMatchObject({ crossing: 'ENTER', fire: false });
    expect(decisions[1].state.lastEvent).toBe('ENTER');
  });
});

describe('LocationAutomationService', () => {
  const zone = { ...office, dwellMinutes: 0 };
  let prisma: any;
  let canvasAgents: any;
  let engine: any;
  let service: LocationAutomationService;

  beforeEach(() => {
    prisma = {
      geofencePresence: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    canvasAgents = {
      activeLocationTriggers: vi.fn().mockResolvedValue([
        { workflowId: 'wf-1', agent: { id: 'ag-1', name: 'Attendance', creatorId: 'u-1' }, geofence: zone, compiled: { limits: {} } },
      ]),
      sync: vi.fn().mockResolvedValue('wf-1'),
    };
    engine = { startWorkflow: vi.fn().mockResolvedValue({ runId: 'run-1' }) };
    service = new LocationAutomationService(prisma, canvasAgents, engine);
  });

  it('starts the person’s own agent with the crossing, recorded as an event run', async () => {
    const { results } = await service.processLocationEvent('ws-1', 'u-1', inside(new Date()));

    expect(canvasAgents.activeLocationTriggers).toHaveBeenCalledWith('ws-1', 'u-1');
    expect(results[0]).toMatchObject({ crossing: 'ENTER', runId: 'run-1' });
    expect(engine.startWorkflow).toHaveBeenCalledWith(
      'wf-1',
      expect.objectContaining({ trigger: 'LOCATION', location: expect.objectContaining({ event: 'ENTER', officeName: 'HQ' }) }),
      expect.objectContaining({ startedBy: 'event', userId: 'u-1' }),
    );
  });

  it('does not start the agent when a concurrent update already moved the state', async () => {
    prisma.geofencePresence.findUnique.mockResolvedValue({
      id: 'p-1',
      updatedAt: new Date(),
      firstInsideAt: null,
      firstOutsideAt: null,
      lastEvent: null,
      lastEventAt: null,
    });
    prisma.geofencePresence.updateMany.mockResolvedValue({ count: 0 });

    const { results } = await service.processLocationEvent('ws-1', 'u-1', inside(new Date()));

    expect(results[0].crossing).toBeNull();
    expect(engine.startWorkflow).not.toHaveBeenCalled();
  });
});
