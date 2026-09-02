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
  private lastActivityAt = Date.now();
  private idleTimeoutMs: number;
  private heartbeatIntervalMs: number;

  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private idleCheckTimer: ReturnType<typeof setInterval> | null = null;
  private unsubscribeBus: (() => void) | null = null;
  private isDisposed = false;

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
  }

  public setContext(userId: string | null, workspaceId: string | null) {
    const wsChanged = this.currentWorkspaceId !== workspaceId;
    this.currentUserId = userId;
    this.currentWorkspaceId = workspaceId;

    if (wsChanged) {
      // Clear presence map on workspace switch
      this.presenceMap.clear();
      if (workspaceId) {
        this.fetchWorkspacePresenceSnapshot(workspaceId);
      }
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

        const existing = this.presenceMap.get(payload.userId);
        const updated: UserPresence = {
          userId: payload.userId,
          workspaceId: payload.workspaceId ?? existing?.workspaceId ?? this.currentWorkspaceId,
          status: payload.status,
          lastSeenAt: payload.lastSeenAt ?? existing?.lastSeenAt ?? null,
          lastActiveAt: payload.lastActiveAt ?? existing?.lastActiveAt ?? null,
          statusText: payload.statusText ?? existing?.statusText ?? null,
          statusEmoji: payload.statusEmoji ?? existing?.statusEmoji ?? null,
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
      if (response.data?.presence) {
        for (const item of response.data.presence) {
          this.presenceMap.set(item.userId, item);
          this.notifyListeners(item.userId, item);
        }
      }
    } catch {
      // Ignore snapshot failure on network offline
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
      if (this.localStatus === 'away') {
        this.setLocalPresence('online');
      }
    };

    const events = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click', 'focus'];
    for (const ev of events) {
      window.addEventListener(ev, onUserInteraction, { passive: true });
    }

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        onUserInteraction();
      } else {
        // Tab hidden — if hidden for a while, it will transition to away in idle check
      }
    });

    window.addEventListener('beforeunload', () => {
      // Best-effort navigator.sendBeacon on tab close
      if (this.currentUserId && navigator.sendBeacon && getAccessToken()) {
        const url = `/api/v1/realtime/heartbeat`;
        const data = JSON.stringify({
          status: 'offline',
          workspaceId: this.currentWorkspaceId,
        });
        const blob = new Blob([data], { type: 'application/json' });
        navigator.sendBeacon(url, blob);
      }
    });
  }

  private startIdleCheckLoop() {
    this.idleCheckTimer = setInterval(() => {
      if (this.isDisposed || !this.currentUserId || this.localStatus === 'busy') return;

      const idleTime = Date.now() - this.lastActivityAt;
      const isDocumentHidden =
        typeof document !== 'undefined' && document.visibilityState === 'hidden';

      if (this.localStatus === 'online' && (idleTime > this.idleTimeoutMs || (isDocumentHidden && idleTime > 60_000))) {
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
      this.sendHeartbeat(this.localStatus);
    }, this.heartbeatIntervalMs);
  }

  private async sendHeartbeat(
    status: 'online' | 'away' | 'busy' | 'offline',
    statusText?: string,
    statusEmoji?: string,
  ): Promise<void> {
    const token = getAccessToken();
    if (!token || !this.currentUserId) return;

    try {
      await http.post('/realtime/heartbeat', {
        status,
        workspaceId: this.currentWorkspaceId,
        statusText,
        statusEmoji,
      });
    } catch {
      // Ignore heartbeat error
    }
  }

  public dispose() {
    this.isDisposed = true;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    if (this.idleCheckTimer) clearInterval(this.idleCheckTimer);
    if (this.unsubscribeBus) this.unsubscribeBus();
    this.listeners.clear();
    this.presenceMap.clear();
  }
}
