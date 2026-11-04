import { getAccessToken, http } from '@org/api-client';
import type { UserPresence } from '@org/types';
import type { RealtimeEventBus } from './realtime-event-bus.js';
import {
  RealtimeEventType,
  type PresenceUpdatedPayload,
  type RealtimeEvent,
} from './types.js';

export interface PresenceServiceOptions {
  bus: RealtimeEventBus;
  workspaceId?: string | null;
  userId?: string | null;
  idleTimeoutMs?: number;
  heartbeatIntervalMs?: number;
}

export type PresenceChangeListener = (
  userId: string,
  presence: UserPresence,
) => void;

/** Long enough that a reload or workspace switch doesn't blank the roster. */
const CONNECTION_LOSS_GRACE_MS = 8_000;

/** Identifies this tab, so the server can combine it with the user's others. */
function createDeviceId(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `web-${Date.now().toString(36)}-${random}`;
}

/**
 * Client-side Presence Service.
 *
 * Maintains a live cache of user presence across the active workspace,
 * captures local user interaction with throttled idle detection,
 * and synchronizes presence updates via heartbeats and real-time events.
 */
export class PresenceService {
  private readonly bus: RealtimeEventBus;
  private currentWorkspaceId: string | null = null;
  private currentUserId: string | null = null;
  private presenceMap = new Map<string, UserPresence>();
  private listeners = new Set<PresenceChangeListener>();

  private localStatus: 'online' | 'away' | 'busy' | 'offline' = 'online';
  /** Mirrors the server-persisted pin (account-level, shared across devices). */
  private manualAway = false;
  private lastActivityAt = Date.now();
  private idleTimeoutMs: number;
  private heartbeatIntervalMs: number;

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private idleCheckTimer: ReturnType<typeof setInterval> | null = null;
  private unsubscribeBus: (() => void) | null = null;
  private isDisposed = false;

  private readonly deviceId = createDeviceId();
  private connectionLossTimer: ReturnType<typeof setTimeout> | null = null;
  /** Set when the map can no longer be trusted; cleared by a good snapshot. */
  private snapshotStale = false;
  private removeWindowListeners: (() => void) | null = null;

  constructor(options: PresenceServiceOptions) {
    this.bus = options.bus;
    this.currentWorkspaceId = options.workspaceId ?? null;
    this.currentUserId = options.userId ?? null;
    this.idleTimeoutMs = options.idleTimeoutMs ?? 3 * 60_000; // 3 minutes
    this.heartbeatIntervalMs = options.heartbeatIntervalMs ?? 25_000; // 25s

    this.initBusListener();
    this.initUserActivityTracker();
    this.startHeartbeatLoop();
    this.startIdleCheckLoop();

    if (this.currentWorkspaceId) {
      void this.fetchWorkspacePresenceSnapshot(this.currentWorkspaceId);
    }
  }

  public setContext(userId: string | null, workspaceId: string | null) {
    const wsChanged = this.currentWorkspaceId !== workspaceId;
    this.currentUserId = userId;
    this.currentWorkspaceId = workspaceId;

    if (wsChanged) {
      // Clear presence map on workspace switch
      this.presenceMap.clear();
      if (workspaceId) {
        void this.fetchWorkspacePresenceSnapshot(workspaceId);
      }
    }
  }

  /**
   * Fed by the realtime stream's state. Back online: report in and reload the
   * roster, since presence events were missed. Still down after a short grace:
   * nothing shown can be vouched for any more, so stop showing it as live.
   */
  public setConnected(connected: boolean) {
    if (connected) {
      this.clearConnectionLossTimer();
      void this.resync();
      return;
    }
    if (this.connectionLossTimer) return;
    const isOffline =
      typeof navigator !== 'undefined' && navigator.onLine === false;
    this.connectionLossTimer = setTimeout(
      () => {
        this.connectionLossTimer = null;
        this.markConnectionLost();
      },
      isOffline ? 0 : CONNECTION_LOSS_GRACE_MS,
    );
  }

  private clearConnectionLossTimer() {
    if (this.connectionLossTimer) clearTimeout(this.connectionLossTimer);
    this.connectionLossTimer = null;
  }

  private markConnectionLost() {
    if (this.isDisposed) return;
    this.snapshotStale = true;

    const self = this.currentUserId;
    if (self && !this.presenceMap.has(self)) {
      const unknown = this.getPresence(self);
      this.presenceMap.set(self, unknown);
      this.notifyListeners(self, unknown);
    }
    for (const [userId, presence] of this.presenceMap.entries()) {
      if (presence.status === 'offline') continue;
      const updated: UserPresence = { ...presence, status: 'offline' };
      this.presenceMap.set(userId, updated);
      this.notifyListeners(userId, updated);
    }
  }

  private async resync(): Promise<void> {
    if (this.isDisposed) return;
    await this.sendHeartbeat(this.localStatus);
    if (this.currentWorkspaceId) {
      await this.fetchWorkspacePresenceSnapshot(this.currentWorkspaceId);
    }
  }

  public getPresence(userId: string): UserPresence {
    const cached = this.presenceMap.get(userId);
    if (cached) return cached;

    // Fallback if not in cache yet
    return {
      userId,
      workspaceId: this.currentWorkspaceId,
      status: 'offline',
      lastSeenAt: null,
      lastActiveAt: null,
    };
  }

  public getAllPresence(): Record<string, UserPresence> {
    const result: Record<string, UserPresence> = {};
    for (const [id, presence] of this.presenceMap.entries()) {
      result[id] = presence;
    }
    return result;
  }

  public isOnline(userId: string): boolean {
    const p = this.presenceMap.get(userId);
    return p?.status === 'online';
  }

  public onPresenceChange(listener: PresenceChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * "Set yourself as away/active". Persisted server-side (not per browser):
   * idle activity, reconnects and other devices can't undo it, and every
   * device sees the same state.
   */
  public async setManualAway(away: boolean): Promise<void> {
    const prev = { manual: this.manualAway, status: this.localStatus };
    this.manualAway = away;
    this.applyLocal(away ? 'away' : 'online');
    try {
      const res = await http.patch<{ presence?: UserPresence }>(
        '/realtime/presence',
        {
          presence: away ? 'away' : 'online',
          workspaceId: this.currentWorkspaceId,
          deviceId: this.deviceId,
        },
      );
      this.applyOwnReading(res.data?.presence);
    } catch (err) {
      this.manualAway = prev.manual;
      this.applyLocal(prev.status);
      throw err;
    }
  }

  private syncManualFlag(p?: UserPresence | null) {
    if (!p || p.userId !== this.currentUserId) return;
    if (typeof p.manualAway === 'boolean') {
      this.manualAway = p.manualAway;
      if (p.manualAway) this.localStatus = 'away';
      else if (this.localStatus === 'away' && p.status === 'online') {
        this.localStatus = 'online';
      }
    }
  }

  /** The server's view of us: other devices can make it differ from ours. */
  private applyOwnReading(p?: UserPresence | null) {
    if (!p || p.userId !== this.currentUserId) return;
    this.syncManualFlag(p);
    const existing = this.presenceMap.get(p.userId);
    this.presenceMap.set(p.userId, p);
    if (existing?.status !== p.status) this.notifyListeners(p.userId, p);
  }

  private applyLocal(status: 'online' | 'away' | 'busy' | 'offline') {
    this.localStatus = status;
    this.lastActivityAt = Date.now();
    if (!this.currentUserId) return;
    const existing = this.getPresence(this.currentUserId);
    const updated: UserPresence = {
      ...existing,
      status,
      manualAway: this.manualAway,
      lastActiveAt: new Date().toISOString(),
    };
    this.presenceMap.set(this.currentUserId, updated);
    this.notifyListeners(this.currentUserId, updated);
  }

  public isManualAway(): boolean {
    return this.manualAway;
  }

  public setLocalPresence(
    status: 'online' | 'away' | 'busy' | 'offline',
    statusText?: string,
    statusEmoji?: string,
  ): Promise<void> {
    this.localStatus = status;
    this.lastActivityAt = Date.now();

    if (this.currentUserId) {
      const existing = this.getPresence(this.currentUserId);
      const updated: UserPresence = {
        ...existing,
        status,
        statusText: statusText !== undefined ? statusText : existing.statusText,
        statusEmoji:
          statusEmoji !== undefined ? statusEmoji : existing.statusEmoji,
        lastActiveAt: new Date().toISOString(),
      };
      this.presenceMap.set(this.currentUserId, updated);
      this.notifyListeners(this.currentUserId, updated);
    }

    return this.sendHeartbeat(status, statusText, statusEmoji);
  }

  private initBusListener() {
    this.unsubscribeBus = this.bus.on<PresenceUpdatedPayload>(
      RealtimeEventType.PresenceUpdated,
      (event: RealtimeEvent<PresenceUpdatedPayload>) => {
        const payload = event.payload;
        if (!payload || !payload.userId) return;

        this.syncManualFlag(payload as unknown as UserPresence);

        const existing = this.presenceMap.get(payload.userId);
        const updated: UserPresence = {
          userId: payload.userId,
          workspaceId:
            payload.workspaceId ??
            existing?.workspaceId ??
            this.currentWorkspaceId,
          status: payload.status,
          lastSeenAt: payload.lastSeenAt ?? existing?.lastSeenAt ?? null,
          lastActiveAt: payload.lastActiveAt ?? existing?.lastActiveAt ?? null,
          // `null` means the status was cleared; only `undefined` keeps it.
          statusText:
            payload.statusText !== undefined
              ? payload.statusText
              : (existing?.statusText ?? null),
          statusEmoji:
            payload.statusEmoji !== undefined
              ? payload.statusEmoji
              : (existing?.statusEmoji ?? null),
          manualAway: payload.manualAway ?? existing?.manualAway,
        };

        this.presenceMap.set(payload.userId, updated);
        this.notifyListeners(payload.userId, updated);
      },
    );
  }

  private notifyListeners(userId: string, presence: UserPresence) {
    for (const listener of this.listeners) {
      try {
        listener(userId, presence);
      } catch (err) {
        console.error('[PresenceService] Listener error:', err);
      }
    }
  }

  private async fetchWorkspacePresenceSnapshot(workspaceId: string) {
    try {
      const response = await http.get<{ presence: UserPresence[] }>(
        `/workspaces/${workspaceId}/presence`,
      );
      // The user switched workspace while this was in flight.
      if (this.isDisposed || workspaceId !== this.currentWorkspaceId) return;
      if (response.data?.presence) {
        for (const item of response.data.presence) {
          this.syncManualFlag(item);
          this.presenceMap.set(item.userId, item);
          this.notifyListeners(item.userId, item);
        }
        this.snapshotStale = false;
      }
    } catch {
      // Network offline; the heartbeat loop retries while the map is stale.
      this.snapshotStale = true;
    }
  }

  private initUserActivityTracker() {
    if (typeof window === 'undefined') return;

    let throttleTimer: ReturnType<typeof setTimeout> | null = null;

    const onUserInteraction = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        throttleTimer = null;
      }, 2000);

      this.lastActivityAt = Date.now();

      // If user was away, transition back to online immediately
      if (this.localStatus === 'away' && !this.manualAway) {
        this.setLocalPresence('online');
      }
    };

    const onVisibilityChange = () => {
      // Hidden tabs fall through to the idle check, which marks them away.
      if (document.visibilityState === 'visible') onUserInteraction();
    };

    const events = [
      'mousemove',
      'keydown',
      'touchstart',
      'scroll',
      'click',
      'focus',
    ];
    for (const ev of events) {
      window.addEventListener(ev, onUserInteraction, { passive: true });
    }
    document.addEventListener('visibilitychange', onVisibilityChange);

    this.removeWindowListeners = () => {
      if (throttleTimer) clearTimeout(throttleTimer);
      for (const ev of events) {
        window.removeEventListener(ev, onUserInteraction);
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }

  private startIdleCheckLoop() {
    this.idleCheckTimer = setInterval(() => {
      if (this.isDisposed || !this.currentUserId || this.localStatus === 'busy')
        return;

      const idleTime = Date.now() - this.lastActivityAt;
      const isDocumentHidden =
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden';

      if (
        this.localStatus === 'online' &&
        (idleTime > this.idleTimeoutMs ||
          (isDocumentHidden && idleTime > 60_000))
      ) {
        this.localStatus = 'away';
        this.setLocalPresence('away');
      }
    }, 15_000);
  }

  private startHeartbeatLoop() {
    // Initial heartbeat after 1s
    setTimeout(() => {
      if (!this.isDisposed) {
        this.sendHeartbeat(this.localStatus);
      }
    }, 1000);

    this.heartbeatTimer = setInterval(() => {
      if (this.isDisposed) return;
      if (this.snapshotStale) void this.resync();
      else void this.sendHeartbeat(this.localStatus);
    }, this.heartbeatIntervalMs);
  }

  private async sendHeartbeat(
    status: 'online' | 'away' | 'busy' | 'offline',
    statusText?: string,
    statusEmoji?: string,
  ): Promise<void> {
    const token = getAccessToken();
    if (!token || !this.currentUserId) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    try {
      const res = await http.post<{ presence?: UserPresence }>(
        '/realtime/heartbeat',
        {
          status,
          workspaceId: this.currentWorkspaceId,
          statusText,
          statusEmoji,
          deviceId: this.deviceId,
        },
      );
      if (!this.isDisposed) this.applyOwnReading(res.data?.presence);
    } catch {
      // Ignore heartbeat error
    }
  }

  public dispose() {
    this.isDisposed = true;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.idleCheckTimer) clearInterval(this.idleCheckTimer);
    this.clearConnectionLossTimer();
    if (this.removeWindowListeners) this.removeWindowListeners();
    if (this.unsubscribeBus) this.unsubscribeBus();
    this.listeners.clear();
    this.presenceMap.clear();
  }
}
