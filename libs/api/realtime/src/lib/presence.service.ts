import { Injectable } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { Interval } from '@nestjs/schedule';
import { AppEvent, type UserStatusChangedEvent } from '@org/api-common';
import { CacheService } from '@org/api-cache';
import { PrismaService } from '@org/database';
import type { UserPresence } from '@org/types';

type PresenceValue = UserPresence['status'];

interface ClientSession {
  clientId: string;
  userId: string;
  workspaceId: string | null;
}

/** What one device (browser tab, desktop window) last told us about itself. */
interface DeviceReading {
  status: 'online' | 'away' | 'busy';
  lastBeatAt: number;
}

interface UserPresenceState {
  userId: string;
  activeClientIds: Set<string>;
  /** Readings per device; the visible status is derived from all of them. */
  devices: Map<string, DeviceReading>;
  status: PresenceValue;
  lastActiveAt: Date;
  lastSeenAt: Date;
  connectedAt: Date;
  statusText: string | null;
  statusEmoji: string | null;
  workspaces: Set<string>;
  /** User pinned themselves away; idle/heartbeat/reconnect must not undo it. */
  manualAway: boolean;
  /** Do-not-disturb or a scheduled status holding the dot. */
  held: 'busy' | 'away' | null;
  /** When the last stream closed; null while one is open. */
  disconnectedAt: number | null;
  lastBeatAt: number;
  /** Last `lastSeenAt` written to the DB, so heartbeats don't write each time. */
  persistedSeenAt: number;
}

const TO_DB = {
  online: 'ONLINE',
  away: 'AWAY',
  busy: 'BUSY',
  offline: 'OFFLINE',
} as const;

const DEFAULT_DEVICE = 'default';
const CONNECTION_DEVICE_PREFIX = 'conn:';
const MAX_DEVICES_PER_USER = 32;

@Injectable()
export class PresenceService {
  // clientId -> ClientSession
  private readonly clientSessions = new Map<string, ClientSession>();

  // userId -> UserPresenceState
  private readonly userPresenceStates = new Map<string, UserPresenceState>();

  // userId -> state being loaded, so a heartbeat racing the stream shares it.
  private readonly loadingStates = new Map<
    string,
    Promise<UserPresenceState>
  >();

  /**
   * No heartbeat for this long means the device is gone. An open stream proves
   * nothing: after a network cut the server can keep a dead socket for minutes.
   * Above the 60s floor browsers throttle background-tab timers to.
   */
  private readonly staleDeviceMs = 90_000;
  /** Survives a reload or workspace switch without flashing "offline". */
  private readonly disconnectGraceMs = 10_000;
  /** Other nodes trust a cached reading only about as long as a heartbeat. */
  private readonly cacheTtlMs = 120_000;
  private readonly seenPersistIntervalMs = 60_000;
  /** DB rows left "online" by a crash are older than any live user's. */
  private readonly ghostAfterMs = 5 * 60_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly events: EventEmitter2,
  ) {}

  /**
   * Records a new SSE or socket client connection for a user.
   */
  async recordConnection(
    clientId: string,
    userId: string,
    workspaceId?: string | null,
  ): Promise<UserPresence> {
    const wsId = workspaceId ?? null;
    this.clientSessions.set(clientId, { clientId, userId, workspaceId: wsId });

    const state = await this.ensureState(userId);
    const now = Date.now();
    state.activeClientIds.add(clientId);
    state.disconnectedAt = null;
    if (wsId) state.workspaces.add(wsId);

    // A fresh stream counts as a live device until its first heartbeat, unless
    // real devices are already reporting (an idle tab reconnecting is not
    // proof the user came back).
    if (this.freshDevices(state, now).length === 0) {
      state.connectedAt = new Date(now);
      state.devices.set(`${CONNECTION_DEVICE_PREFIX}${clientId}`, {
        status: 'online',
        lastBeatAt: now,
      });
    }

    return this.settle(state, wsId);
  }

  /**
   * Removes a client connection upon disconnect. The user stays as they are
   * for a short grace period, then the reaper takes them offline.
   */
  async removeConnection(clientId: string): Promise<void> {
    const session = this.clientSessions.get(clientId);
    if (!session) return;
    this.clientSessions.delete(clientId);

    const state = this.userPresenceStates.get(session.userId);
    if (!state) return;

    state.activeClientIds.delete(clientId);
    if (state.activeClientIds.size === 0) {
      // Its device entry stays: that's what carries them through the grace.
      state.disconnectedAt = Date.now();
    } else {
      state.devices.delete(`${CONNECTION_DEVICE_PREFIX}${clientId}`);
    }
  }

  /**
   * Records a heartbeat / activity ping from one of a user's devices.
   */
  async recordHeartbeat(
    userId: string,
    workspaceId?: string | null,
    status?: PresenceValue,
    statusText?: string | null,
    statusEmoji?: string | null,
    deviceId?: string | null,
  ): Promise<UserPresence> {
    const state = await this.ensureState(userId);
    const now = Date.now();
    const device = deviceId || DEFAULT_DEVICE;

    state.lastBeatAt = now;
    for (const key of state.devices.keys()) {
      if (key.startsWith(CONNECTION_DEVICE_PREFIX)) state.devices.delete(key);
    }

    if (status === 'offline') {
      state.devices.delete(device);
    } else {
      const reported = status ?? state.devices.get(device)?.status ?? 'online';
      state.devices.set(device, { status: reported, lastBeatAt: now });
      if (reported === 'online') state.lastActiveAt = new Date(now);
    }
    this.pruneDevices(state, now);

    if (statusText !== undefined) state.statusText = statusText;
    if (statusEmoji !== undefined) state.statusEmoji = statusEmoji;
    if (workspaceId) state.workspaces.add(workspaceId);

    return this.settle(state, workspaceId);
  }

  /**
   * Sets explicit presence for a user.
   */
  async setExplicitPresence(
    userId: string,
    presence: PresenceValue,
    workspaceId?: string | null,
    deviceId?: string | null,
  ): Promise<UserPresence> {
    // online/away are the user's own "Set yourself as ..." toggle: persist it
    // so it survives reconnects and applies on every device.
    if (presence !== 'online' && presence !== 'away') {
      return this.recordHeartbeat(
        userId,
        workspaceId,
        presence,
        undefined,
        undefined,
        deviceId,
      );
    }

    const manualAway = presence === 'away';
    await this.prisma.user.update({
      where: { id: userId },
      data: { presenceManualAway: manualAway },
    });
    const state = await this.ensureState(userId);
    state.manualAway = manualAway;

    const result = await this.recordHeartbeat(
      userId,
      workspaceId,
      manualAway ? undefined : 'online',
      undefined,
      undefined,
      deviceId,
    );
    // Broadcast even when the dot didn't move, so the user's other devices
    // pick up the pin.
    this.broadcast(state, result, workspaceId);
    return result;
  }

  /**
   * A status saved outside the heartbeat path (status dialog, schedule, expiry)
   * — fold it into the live state, or the next read would undo it.
   */
  @OnEvent(AppEvent.UserStatusChanged)
  async onUserStatusChanged(e: UserStatusChangedEvent): Promise<void> {
    const state = this.userPresenceStates.get(e.userId);
    if (!state) {
      await this.cache.del(`presence:user:${e.userId}`);
      return;
    }

    state.statusText = e.statusText;
    state.statusEmoji = e.statusEmoji;
    if (e.presence === 'BUSY') state.held = 'busy';
    else if (e.presence === 'AWAY') state.held = 'away';
    else if (e.presence === 'ONLINE' || e.source === 'schedule-cleared') {
      state.held = null;
    }

    const result = await this.settle(state);
    this.broadcast(state, result);
  }

  /**
   * Gets user presence snapshot across cluster nodes.
   */
  async getUserPresence(
    userId: string,
    workspaceId?: string | null,
  ): Promise<UserPresence> {
    const live = await this.readLive(userId, workspaceId);
    if (live) return live;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        lastSeenAt: true,
        statusText: true,
        statusEmoji: true,
      },
    });

    return {
      userId,
      workspaceId: workspaceId ?? null,
      status: 'offline',
      lastSeenAt: user?.lastSeenAt?.toISOString() ?? null,
      statusText: user?.statusText ?? null,
      statusEmoji: user?.statusEmoji ?? null,
    };
  }

  /**
   * Returns presence list for all active members in a workspace.
   */
  async getWorkspacePresence(workspaceId: string): Promise<UserPresence[]> {
    const members = await this.prisma.workspaceMember.findMany({
      where: { workspaceId, status: 'ACTIVE' },
      select: {
        userId: true,
        user: {
          select: {
            lastSeenAt: true,
            statusText: true,
            statusEmoji: true,
          },
        },
      },
    });

    const results: UserPresence[] = [];
    for (const m of members) {
      const live = await this.readLive(m.userId, workspaceId);
      // Nobody live is reporting for them, so they're offline — whatever
      // `User.presence` says (a crash leaves that column "ONLINE").
      results.push(
        live ?? {
          userId: m.userId,
          workspaceId,
          status: 'offline',
          lastSeenAt: m.user.lastSeenAt?.toISOString() ?? null,
          statusText: m.user.statusText,
          statusEmoji: m.user.statusEmoji,
        },
      );
    }

    return results;
  }

  /**
   * Periodic reaper: takes users offline once their last stream has closed or
   * their devices stopped heartbeating.
   */
  @Interval(15_000)
  async reapStalePresence(): Promise<void> {
    const now = Date.now();

    for (const [userId, state] of this.userPresenceStates.entries()) {
      // Their stream closed and nothing has beaten since: the app is gone.
      if (
        state.disconnectedAt !== null &&
        state.lastBeatAt <= state.disconnectedAt &&
        now - state.disconnectedAt > this.disconnectGraceMs
      ) {
        state.devices.clear();
      }
      this.pruneDevices(state, now);

      try {
        await this.settle(state);
      } catch {
        // One failed write must not stop the sweep; the next tick retries.
        continue;
      }

      if (state.status === 'offline' && state.activeClientIds.size === 0) {
        this.userPresenceStates.delete(userId);
      }
    }
  }

  /**
   * Clears `User.presence` for accounts nobody is live on — rows a crash or
   * restart left "online", which rosters reading the column would keep showing.
   */
  @Interval(5 * 60_000)
  async sweepGhostPresence(): Promise<void> {
    await this.prisma.user.updateMany({
      where: {
        presence: { not: 'OFFLINE' },
        id: { notIn: Array.from(this.userPresenceStates.keys()) },
        OR: [
          { lastSeenAt: null },
          { lastSeenAt: { lt: new Date(Date.now() - this.ghostAfterMs) } },
        ],
      },
      data: { presence: 'OFFLINE' },
    });
  }

  /** This node's reading, else one a sibling node shared through the cache. */
  private async readLive(
    userId: string,
    workspaceId?: string | null,
  ): Promise<UserPresence | null> {
    const state = this.userPresenceStates.get(userId);
    if (state) return this.toUserPresence(state, workspaceId);

    const cached = await this.cache.get<UserPresence>(
      `presence:user:${userId}`,
    );
    if (!cached) return null;
    return { ...cached, workspaceId: workspaceId ?? cached.workspaceId };
  }

  /** The live state for a user, loaded once even under concurrent callers. */
  private async ensureState(userId: string): Promise<UserPresenceState> {
    const existing = this.userPresenceStates.get(userId);
    if (existing) return existing;

    let loading = this.loadingStates.get(userId);
    if (!loading) {
      loading = this.loadState(userId).finally(() => {
        this.loadingStates.delete(userId);
      });
      this.loadingStates.set(userId, loading);
    }
    return loading;
  }

  private async loadState(userId: string): Promise<UserPresenceState> {
    const [user, memberships] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          statusText: true,
          statusEmoji: true,
          presence: true,
          presenceManualAway: true,
          lastSeenAt: true,
        },
      }),
      // Presence is per account: every shared workspace needs the updates, not
      // only the one this client happens to have open.
      this.prisma.workspaceMember.findMany({
        where: { userId, status: 'ACTIVE' },
        select: { workspaceId: true },
      }),
    ]);

    const now = new Date();
    const state: UserPresenceState = {
      userId,
      activeClientIds: new Set(),
      devices: new Map(),
      status: 'offline',
      manualAway: user?.presenceManualAway ?? false,
      held: user?.presence === 'BUSY' ? 'busy' : null,
      lastActiveAt: now,
      lastSeenAt: user?.lastSeenAt ?? now,
      connectedAt: now,
      statusText: user?.statusText ?? null,
      statusEmoji: user?.statusEmoji ?? null,
      workspaces: new Set(memberships.map((m) => m.workspaceId)),
      disconnectedAt: null,
      lastBeatAt: 0,
      persistedSeenAt: 0,
    };
    this.userPresenceStates.set(userId, state);
    return state;
  }

  private freshDevices(state: UserPresenceState, now: number): DeviceReading[] {
    return Array.from(state.devices.values()).filter(
      (d) => now - d.lastBeatAt <= this.staleDeviceMs,
    );
  }

  private pruneDevices(state: UserPresenceState, now: number): void {
    for (const [key, device] of state.devices.entries()) {
      if (now - device.lastBeatAt > this.staleDeviceMs) {
        state.devices.delete(key);
      }
    }
    // Every page load is a new device id; a reload loop must not grow this.
    while (state.devices.size > MAX_DEVICES_PER_USER) {
      const oldest = state.devices.keys().next().value;
      if (oldest === undefined) break;
      state.devices.delete(oldest);
    }
  }

  /**
   * The one status a user shows: an idle tab must not mark someone away while
   * another device is in active use, so the most available device wins.
   */
  private deriveStatus(state: UserPresenceState, now: number): PresenceValue {
    const devices = this.freshDevices(state, now);
    if (devices.length === 0) return 'offline';
    if (state.manualAway) return 'away';
    if (state.held) return state.held;
    if (devices.some((d) => d.status === 'busy')) return 'busy';
    return devices.some((d) => d.status === 'online') ? 'online' : 'away';
  }

  /** Applies the derived status; every change is persisted and broadcast. */
  private async settle(
    state: UserPresenceState,
    workspaceId?: string | null,
  ): Promise<UserPresence> {
    const now = Date.now();
    const next = this.deriveStatus(state, now);
    const changed = next !== state.status;
    state.status = next;

    const isLive = next !== 'offline';
    const seenDue = now - state.persistedSeenAt >= this.seenPersistIntervalMs;
    if (isLive || changed) state.lastSeenAt = new Date(now);

    if (changed || (isLive && seenDue)) {
      await this.prisma.user.update({
        where: { id: state.userId },
        data: { presence: TO_DB[next], lastSeenAt: state.lastSeenAt },
      });
      state.persistedSeenAt = now;
    }

    const result = this.toUserPresence(state, workspaceId);
    await this.cache.set(
      `presence:user:${state.userId}`,
      result,
      this.cacheTtlMs,
    );

    if (changed) this.broadcast(state, result, workspaceId);
    return result;
  }

  private broadcast(
    state: UserPresenceState,
    presence: UserPresence,
    workspaceId?: string | null,
  ): void {
    this.events.emit(AppEvent.PresenceUpdated, {
      workspaceId: workspaceId ?? null,
      actorId: state.userId,
      presence,
      targetWorkspaces: Array.from(state.workspaces),
    });
  }

  private toUserPresence(
    state: UserPresenceState,
    workspaceId?: string | null,
  ): UserPresence {
    return {
      userId: state.userId,
      workspaceId: workspaceId ?? Array.from(state.workspaces)[0] ?? null,
      status: state.status,
      lastSeenAt: state.lastSeenAt.toISOString(),
      lastActiveAt: state.lastActiveAt.toISOString(),
      connectedAt: state.connectedAt.toISOString(),
      statusText: state.statusText,
      statusEmoji: state.statusEmoji,
      manualAway: state.manualAway,
    };
  }
}
