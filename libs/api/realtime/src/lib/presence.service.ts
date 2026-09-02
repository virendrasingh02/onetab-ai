import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Interval } from '@nestjs/schedule';
import { AppEvent } from '@org/api-common';
import { CacheService } from '@org/api-cache';
import { PrismaService } from '@org/database';
import type { UserPresence } from '@org/types';

interface ClientSession {
  clientId: string;
  userId: string;
  workspaceId: string | null;
  connectedAt: Date;
  lastActiveAt: Date;
}

interface UserPresenceState {
  userId: string;
  activeClientIds: Set<string>;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastActiveAt: Date;
  lastSeenAt: Date;
  connectedAt: Date;
  statusText: string | null;
  statusEmoji: string | null;
  workspaces: Set<string>;
}

@Injectable()
export class PresenceService {
  private readonly logger = new Logger(PresenceService.name);

  // clientId -> ClientSession
  private readonly clientSessions = new Map<string, ClientSession>();

  // userId -> UserPresenceState
  private readonly userPresenceStates = new Map<string, UserPresenceState>();

  private readonly idleThresholdMs = 3 * 60_000; // 3 minutes -> away
  private readonly disconnectThresholdMs = 60_000; // 60 seconds without heartbeat -> offline

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
    const now = new Date();
    const wsId = workspaceId ?? null;

    this.clientSessions.set(clientId, {
      clientId,
      userId,
      workspaceId: wsId,
      connectedAt: now,
      lastActiveAt: now,
    });

    let state = this.userPresenceStates.get(userId);
    const wasOffline = !state || state.status === 'offline';

    if (!state) {
      // Load initial status / text from DB
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          statusText: true,
          statusEmoji: true,
          presence: true,
          lastSeenAt: true,
        },
      });

      state = {
        userId,
        activeClientIds: new Set([clientId]),
        status: user?.presence === 'BUSY' ? 'busy' : 'online',
        lastActiveAt: now,
        lastSeenAt: now,
        connectedAt: now,
        statusText: user?.statusText ?? null,
        statusEmoji: user?.statusEmoji ?? null,
        workspaces: new Set(),
      };
      this.userPresenceStates.set(userId, state);
    } else {
      state.activeClientIds.add(clientId);
      state.lastActiveAt = now;
      if (state.status === 'offline' || state.status === 'away') {
        state.status = 'online';
      }
    }

    if (wsId) {
      state.workspaces.add(wsId);
    } else {
      // Load user's active workspaces for presence broadcasting
      const memberships = await this.prisma.workspaceMember.findMany({
        where: { userId, status: 'ACTIVE' },
        select: { workspaceId: true },
      });
      for (const m of memberships) {
        state.workspaces.add(m.workspaceId);
      }
    }

    // Persist online state to DB
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        presence: state.status === 'busy' ? 'BUSY' : 'ONLINE',
        lastSeenAt: now,
      },
    });

    const presenceResult = this.toUserPresence(state, wsId);
    await this.cache.set(`presence:user:${userId}`, presenceResult, 300_000);

    if (wasOffline) {
      this.events.emit(AppEvent.PresenceUpdated, {
        workspaceId: wsId,
        actorId: userId,
        presence: presenceResult,
        targetWorkspaces: Array.from(state.workspaces),
      });
    }

    return presenceResult;
  }

  /**
   * Removes a client connection upon disconnect.
   */
  async removeConnection(clientId: string): Promise<void> {
    const session = this.clientSessions.get(clientId);
    if (!session) return;

    this.clientSessions.delete(clientId);
    const { userId, workspaceId } = session;

    const state = this.userPresenceStates.get(userId);
    if (!state) return;

    state.activeClientIds.delete(clientId);

    // If no remaining active connections, transition to offline
    if (state.activeClientIds.size === 0) {
      const now = new Date();
      state.status = 'offline';
      state.lastSeenAt = now;

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          presence: 'OFFLINE',
          lastSeenAt: now,
        },
      });

      const presenceResult = this.toUserPresence(state, workspaceId);
      await this.cache.set(`presence:user:${userId}`, presenceResult, 300_000);

      this.events.emit(AppEvent.PresenceUpdated, {
        workspaceId,
        actorId: userId,
        presence: presenceResult,
        targetWorkspaces: Array.from(state.workspaces),
      });
    }
  }

  /**
   * Records a heartbeat / activity ping from a user.
   */
  async recordHeartbeat(
    userId: string,
    workspaceId?: string | null,
    status?: 'online' | 'away' | 'busy' | 'offline',
    statusText?: string | null,
    statusEmoji?: string | null,
  ): Promise<UserPresence> {
    const now = new Date();
    let state = this.userPresenceStates.get(userId);
    const previousStatus = state?.status;

    if (!state) {
      state = {
        userId,
        activeClientIds: new Set(),
        status: status ?? 'online',
        lastActiveAt: now,
        lastSeenAt: now,
        connectedAt: now,
        statusText: statusText ?? null,
        statusEmoji: statusEmoji ?? null,
        workspaces: new Set(workspaceId ? [workspaceId] : []),
      };
      this.userPresenceStates.set(userId, state);
    } else {
      state.lastActiveAt = now;
      if (status) state.status = status;
      if (statusText !== undefined) state.statusText = statusText;
      if (statusEmoji !== undefined) state.statusEmoji = statusEmoji;
      if (workspaceId) state.workspaces.add(workspaceId);
    }

    const presenceResult = this.toUserPresence(state, workspaceId);
    await this.cache.set(`presence:user:${userId}`, presenceResult, 300_000);

    // If status changed, emit presence update
    if (previousStatus && previousStatus !== state.status) {
      this.events.emit(AppEvent.PresenceUpdated, {
        workspaceId,
        actorId: userId,
        presence: presenceResult,
        targetWorkspaces: Array.from(state.workspaces),
      });

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          presence:
            state.status === 'online'
              ? 'ONLINE'
              : state.status === 'away'
              ? 'AWAY'
              : state.status === 'busy'
              ? 'BUSY'
              : 'OFFLINE',
          lastSeenAt: now,
        },
      });
    }

    return presenceResult;
  }

  /**
   * Sets explicit presence for a user.
   */
  async setExplicitPresence(
    userId: string,
    presence: 'online' | 'away' | 'busy' | 'offline',
    workspaceId?: string | null,
  ): Promise<UserPresence> {
    return this.recordHeartbeat(userId, workspaceId, presence);
  }

  /**
   * Gets user presence snapshot across cluster nodes.
   */
  async getUserPresence(
    userId: string,
    workspaceId?: string | null,
  ): Promise<UserPresence> {
    // 1. Check local node state
    const state = this.userPresenceStates.get(userId);
    if (state) {
      return this.toUserPresence(state, workspaceId);
    }

    // 2. Check cluster-wide Redis cache
    const cached = await this.cache.get<UserPresence>(`presence:user:${userId}`);
    if (cached) {
      return {
        ...cached,
        workspaceId: workspaceId ?? cached.workspaceId,
      };
    }

    // 3. Fallback to database
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        presence: true,
        lastSeenAt: true,
        statusText: true,
        statusEmoji: true,
      },
    });

    if (!user) {
      return {
        userId,
        status: 'offline',
        lastSeenAt: null,
      };
    }

    const normalizedStatus: 'online' | 'away' | 'busy' | 'offline' =
      user.presence === 'ONLINE'
        ? 'online'
        : user.presence === 'AWAY'
        ? 'away'
        : user.presence === 'BUSY'
        ? 'busy'
        : 'offline';

    const result: UserPresence = {
      userId: user.id,
      workspaceId: workspaceId ?? null,
      status: normalizedStatus,
      lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
      statusText: user.statusText,
      statusEmoji: user.statusEmoji,
    };

    await this.cache.set(`presence:user:${userId}`, result, 300_000);
    return result;
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
            presence: true,
            lastSeenAt: true,
            statusText: true,
            statusEmoji: true,
          },
        },
      },
    });

    const results: UserPresence[] = [];
    for (const m of members) {
      const liveState = this.userPresenceStates.get(m.userId);
      if (liveState) {
        results.push(this.toUserPresence(liveState, workspaceId));
        continue;
      }

      const cached = await this.cache.get<UserPresence>(`presence:user:${m.userId}`);
      if (cached) {
        results.push({ ...cached, workspaceId });
        continue;
      }

      const status: 'online' | 'away' | 'busy' | 'offline' =
        m.user.presence === 'ONLINE'
          ? 'online'
          : m.user.presence === 'AWAY'
          ? 'away'
          : m.user.presence === 'BUSY'
          ? 'busy'
          : 'offline';

      results.push({
        userId: m.userId,
        workspaceId,
        status,
        lastSeenAt: m.user.lastSeenAt?.toISOString() ?? null,
        statusText: m.user.statusText,
        statusEmoji: m.user.statusEmoji,
      });
    }

    return results;
  }

  /**
   * Periodic reaper to detect idle ('away') or disconnected ('offline') clients.
   */
  @Interval(15_000)
  async reapStalePresence(): Promise<void> {
    const now = Date.now();

    for (const [userId, state] of this.userPresenceStates.entries()) {
      if (state.status === 'offline') continue;

      const idleDuration = now - state.lastActiveAt.getTime();

      // Check if user has no active clients and timeout passed
      if (state.activeClientIds.size === 0 && idleDuration > this.disconnectThresholdMs) {
        state.status = 'offline';
        state.lastSeenAt = new Date();

        await this.prisma.user.update({
          where: { id: userId },
          data: { presence: 'OFFLINE', lastSeenAt: state.lastSeenAt },
        });

        const presenceResult = this.toUserPresence(state);
        this.events.emit(AppEvent.PresenceUpdated, {
          workspaceId: null,
          actorId: userId,
          presence: presenceResult,
          targetWorkspaces: Array.from(state.workspaces),
        });
        continue;
      }

      // Check if active user went idle (> 3 minutes without interaction)
      if (state.status === 'online' && idleDuration > this.idleThresholdMs) {
        state.status = 'away';

        await this.prisma.user.update({
          where: { id: userId },
          data: { presence: 'AWAY' },
        });

        const presenceResult = this.toUserPresence(state);
        this.events.emit(AppEvent.PresenceUpdated, {
          workspaceId: null,
          actorId: userId,
          presence: presenceResult,
          targetWorkspaces: Array.from(state.workspaces),
        });
      }
    }
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
    };
  }
}
