import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@org/database';
import type { GeofenceTriggerConfig } from '@org/types';
import { CanvasAgentRunService } from './studio/canvas-agent-run.service.js';
import { WorkflowEngineService } from './workflow-engine.service.js';

export interface LocationReading {
  latitude: number;
  longitude: number;
  /** Horizontal accuracy in metres (the radius of uncertainty). */
  accuracy: number;
  /** When the device took the reading. */
  recordedAt: Date;
}

/** What is remembered between readings for one person and one agent. */
export interface PresenceState {
  firstInsideAt: Date | null;
  firstOutsideAt: Date | null;
  lastEvent: 'ENTER' | 'EXIT' | null;
  lastEventAt: Date | null;
}

export interface GeofenceDecision {
  /** The crossing this reading confirms, if any. */
  crossing: 'ENTER' | 'EXIT' | null;
  /** Whether the agent should start (the crossing is one its trigger listens for). */
  fire: boolean;
  state: PresenceState;
  distanceMeters: number | null;
  reason: string;
}

/** Older readings are stale (queued offline); newer than now means a bad clock. */
const MAX_READING_AGE_MS = 15 * 60_000;
const MAX_CLOCK_SKEW_MS = 2 * 60_000;

const EMPTY_STATE: PresenceState = { firstInsideAt: null, firstOutsideAt: null, lastEvent: null, lastEventAt: null };

/** Great-circle distance in metres. */
export function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

/**
 * Decides whether one reading confirms an office entry or exit. Pure — all
 * state goes in and comes out — so the rules are testable without a clock:
 *  - stale, future-dated or imprecise readings change nothing;
 *  - "inside" is within the radius; "outside" is beyond the radius *plus* the
 *    reading's own uncertainty, and anything between holds the current side,
 *    so GPS jitter at the edge never flips it;
 *  - a side must be held for `dwellMinutes` before the crossing counts;
 *  - an exit only follows an entry, and two crossings are at least
 *    `cooldownMinutes` apart.
 */
export function evaluateGeofence(
  reading: LocationReading,
  zone: GeofenceTriggerConfig,
  previous: PresenceState | null,
  now: Date,
): GeofenceDecision {
  const prev = previous ?? EMPTY_STATE;
  const hold = (reason: string, distanceMeters: number | null = null): GeofenceDecision => ({
    crossing: null,
    fire: false,
    state: prev,
    distanceMeters,
    reason,
  });

  const age = now.getTime() - reading.recordedAt.getTime();
  if (age > MAX_READING_AGE_MS) return hold(`Reading is ${Math.round(age / 60_000)} min old — ignored.`);
  if (age < -MAX_CLOCK_SKEW_MS) return hold('Reading is dated in the future — ignored.');
  if (reading.accuracy > zone.accuracyMeters) {
    return hold(`Location accurate to ${Math.round(reading.accuracy)} m; ${zone.officeName} needs ${zone.accuracyMeters} m or better.`);
  }

  const distance = haversineDistance(reading.latitude, reading.longitude, zone.latitude, zone.longitude);
  const inside = distance <= zone.radiusMeters;
  const outside = distance > zone.radiusMeters + reading.accuracy;
  if (!inside && !outside) return hold(`At the edge of ${zone.officeName} (${distance} m) — waiting for a clearer reading.`, distance);

  const dwellMs = zone.dwellMinutes * 60_000;
  const coolingDown = !!prev.lastEventAt && now.getTime() - prev.lastEventAt.getTime() < zone.cooldownMinutes * 60_000;

  if (inside) {
    const firstInsideAt = prev.firstInsideAt ?? now;
    const state: PresenceState = { ...prev, firstInsideAt, firstOutsideAt: null };
    if (prev.lastEvent === 'ENTER') return { crossing: null, fire: false, state, distanceMeters: distance, reason: `Still at ${zone.officeName}.` };
    const stayed = now.getTime() - firstInsideAt.getTime();
    if (stayed < dwellMs) {
      return { crossing: null, fire: false, state, distanceMeters: distance, reason: `At ${zone.officeName}; confirming (${Math.floor(stayed / 60_000)}/${zone.dwellMinutes} min).` };
    }
    if (coolingDown) return { crossing: null, fire: false, state, distanceMeters: distance, reason: `Arrived at ${zone.officeName}, but within the ${zone.cooldownMinutes}-min cooldown.` };
    return {
      crossing: 'ENTER',
      fire: zone.event !== 'EXIT',
      state: { ...state, lastEvent: 'ENTER', lastEventAt: now },
      distanceMeters: distance,
      reason: `Arrived at ${zone.officeName}.`,
    };
  }

  // Outside. Leaving only means something after an arrival.
  if (prev.lastEvent !== 'ENTER') {
    return { crossing: null, fire: false, state: { ...prev, firstInsideAt: null, firstOutsideAt: null }, distanceMeters: distance, reason: `Away from ${zone.officeName} (${distance} m).` };
  }
  const firstOutsideAt = prev.firstOutsideAt ?? now;
  const state: PresenceState = { ...prev, firstInsideAt: null, firstOutsideAt };
  const away = now.getTime() - firstOutsideAt.getTime();
  if (away < dwellMs) {
    return { crossing: null, fire: false, state, distanceMeters: distance, reason: `Left ${zone.officeName}? Confirming (${Math.floor(away / 60_000)}/${zone.dwellMinutes} min).` };
  }
  if (coolingDown) return { crossing: null, fire: false, state, distanceMeters: distance, reason: `Left ${zone.officeName}, but within the ${zone.cooldownMinutes}-min cooldown.` };
  return {
    crossing: 'EXIT',
    fire: zone.event !== 'ENTER',
    state: { ...state, lastEvent: 'EXIT', lastEventAt: now },
    distanceMeters: distance,
    reason: `Left ${zone.officeName}.`,
  };
}

export interface LocationEventResult {
  agentId: string;
  agentName: string;
  crossing: 'ENTER' | 'EXIT' | null;
  reason: string;
  runId?: string;
}

/**
 * Takes a person's device location and starts their own Location-triggered
 * agents when it confirms an office entry or exit. Presence is kept per agent
 * in `geofence_presences`, so it survives restarts and multiple API instances.
 */
@Injectable()
export class LocationAutomationService {
  private readonly logger = new Logger(LocationAutomationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly canvasAgents: CanvasAgentRunService,
    private readonly engine: WorkflowEngineService,
  ) {}

  async processLocationEvent(workspaceId: string, userId: string, reading: LocationReading): Promise<{ results: LocationEventResult[] }> {
    const now = new Date();
    const triggers = await this.canvasAgents.activeLocationTriggers(workspaceId, userId);
    const results: LocationEventResult[] = [];

    for (const entry of triggers) {
      const row = await this.prisma.geofencePresence.findUnique({
        where: { workflowId_userId: { workflowId: entry.workflowId, userId } },
      });
      const previous: PresenceState | null = row
        ? {
            firstInsideAt: row.firstInsideAt,
            firstOutsideAt: row.firstOutsideAt,
            lastEvent: row.lastEvent === 'ENTER' || row.lastEvent === 'EXIT' ? row.lastEvent : null,
            lastEventAt: row.lastEventAt,
          }
        : null;
      const decision = evaluateGeofence(reading, entry.geofence, previous, now);
      const result: LocationEventResult = { agentId: entry.agent.id, agentName: entry.agent.name, crossing: decision.crossing, reason: decision.reason };
      results.push(result);

      // Save the new state only if nobody else did since we read it — two
      // pings racing must not both confirm the same crossing.
      const data = { ...decision.state, lastSeenAt: now };
      let saved: boolean;
      if (row) {
        const { count } = await this.prisma.geofencePresence.updateMany({ where: { id: row.id, updatedAt: row.updatedAt }, data });
        saved = count === 1;
      } else {
        saved = await this.prisma.geofencePresence
          .create({ data: { workflowId: entry.workflowId, workspaceId, userId, ...data } })
          .then(() => true)
          .catch((error: { code?: string }) => {
            if (error.code === 'P2002') return false;
            throw error;
          });
      }
      if (!saved) {
        result.crossing = null;
        result.reason = 'Another location update was handled at the same moment.';
        continue;
      }
      if (!decision.fire || !decision.crossing) continue;

      try {
        await this.canvasAgents.sync(entry.agent, entry.compiled);
        const location = {
          event: decision.crossing,
          officeName: entry.geofence.officeName,
          distanceMeters: decision.distanceMeters,
          latitude: reading.latitude,
          longitude: reading.longitude,
          accuracy: reading.accuracy,
          at: reading.recordedAt.toISOString(),
        };
        const run = await this.engine.startWorkflow(
          entry.workflowId,
          { trigger: 'LOCATION', location, message: decision.reason },
          { startedBy: 'event', userId, limits: entry.compiled.limits },
        );
        result.runId = run.runId;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.reason = `${decision.reason} Starting the agent failed: ${message}`;
        this.logger.warn(`Location trigger for '${entry.agent.name}' (${entry.agent.id}) failed: ${message}`);
      }
    }

    return { results };
  }
}
