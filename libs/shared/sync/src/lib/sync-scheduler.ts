import type { QueryClient } from '@tanstack/react-query';
import { RetryPolicy } from './retry-policy.js';
import {
  CADENCE_BASE_MS,
  normalizeResource,
  queryKeyMentionsWorkspace,
  type RegisterResourceInput,
  type SyncPriority,
  type SyncResource,
} from './sync-resource.js';
import { syncMetrics } from './sync-metrics.js';

/** Snapshot of the conditions the scheduler adapts its cadence to. */
export interface SchedulerConditions {
  online: boolean;
  /** `document.visibilityState === 'visible'`. */
  visible: boolean;
  /** The realtime SSE stream is connected. */
  realtimeConnected: boolean;
  /** The workspace the app is currently showing. */
  activeWorkspaceId: string | null;
  /** This tab holds the sync-leader lock (only the leader polls). */
  isLeader: boolean;
}

interface Tracked {
  resource: SyncResource;
  /** `performance.now()` of the last invalidation. */
  lastRunAt: number;
  retry: RetryPolicy;
}

const HIDDEN_MULTIPLIER = 6;
const TICK_MS = 1_000;

/**
 * Owns the *single* timer for all background polling.
 *
 * Feature code registers a {@link SyncResource}; the scheduler decides, once a
 * second, which resources are due and invalidates their query key. It never
 * fires for a resource outside the active workspace, never while offline, and
 * suppresses a resource's poll entirely while the realtime stream is up if that
 * resource is already kept fresh by realtime events.
 */
export class SyncScheduler {
  private readonly resources = new Map<string, Tracked>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private conditions: SchedulerConditions = {
    online: true,
    visible: true,
    realtimeConnected: false,
    activeWorkspaceId: null,
    isLeader: true,
  };

  /**
   * Called after every invalidation the scheduler performs, so the manager can
   * fan the decision out to follower tabs (which run no timers of their own).
   */
  onInvalidate: ((queryKey: unknown[], workspaceId: string) => void) | null =
    null;

  constructor(
    private readonly queryClient: QueryClient,
    private readonly now: () => number = () =>
      typeof performance !== 'undefined' ? performance.now() : Date.now(),
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  updateConditions(patch: Partial<SchedulerConditions>): void {
    this.conditions = { ...this.conditions, ...patch };
  }

  register(input: RegisterResourceInput): void {
    const resource = normalizeResource(input);
    if (
      typeof process !== 'undefined' &&
      process.env?.['NODE_ENV'] !== 'production' &&
      !queryKeyMentionsWorkspace(resource.queryKey, resource.workspaceId)
    ) {
      console.warn(
        `[sync] resource "${resource.id}" queryKey does not contain its workspaceId ` +
          `(${resource.workspaceId}) — background invalidation could cross workspaces.`,
      );
    }
    const existing = this.resources.get(resource.id);
    this.resources.set(resource.id, {
      resource,
      lastRunAt: existing?.lastRunAt ?? this.now(),
      retry: existing?.retry ?? new RetryPolicy(),
    });
  }

  unregister(id: string): void {
    this.resources.delete(id);
  }

  setEnabled(id: string, enabled: boolean): void {
    const tracked = this.resources.get(id);
    if (tracked) tracked.resource.enabled = enabled;
  }

  /** Every registered resource id, for debugging. */
  list(): SyncResource[] {
    return [...this.resources.values()].map((t) => t.resource);
  }

  /**
   * Forces an immediate refresh of resources matching a priority filter for the
   * active workspace. Used by manual re-sync and by resume/reconnect
   * reconciliation. Resets each affected resource's backoff.
   */
  refreshNow(priorities: SyncPriority[] = ['active', 'high', 'low']): number {
    const ws = this.conditions.activeWorkspaceId;
    if (!ws) return 0;
    let count = 0;
    for (const tracked of this.resources.values()) {
      const { resource } = tracked;
      if (!resource.enabled) continue;
      if (resource.workspaceId !== ws) continue;
      if (!priorities.includes(resource.priority)) continue;
      this.runResource(tracked);
      count += 1;
    }
    return count;
  }

  private tick(): void {
    const { online, activeWorkspaceId, isLeader } = this.conditions;
    if (!online || !activeWorkspaceId || !isLeader) return;

    const nowT = this.now();
    for (const tracked of this.resources.values()) {
      const { resource } = tracked;
      if (!resource.enabled) continue;
      if (resource.workspaceId !== activeWorkspaceId) continue;

      const interval = this.effectiveInterval(tracked);
      if (!Number.isFinite(interval)) continue;
      if (nowT - tracked.lastRunAt < interval) continue;

      this.runResource(tracked);
    }
  }

  private runResource(tracked: Tracked): void {
    tracked.lastRunAt = this.now();
    try {
      const queryKey = tracked.resource.queryKey as unknown[];
      this.queryClient.invalidateQueries({ queryKey });
      this.onInvalidate?.(queryKey, tracked.resource.workspaceId);
      tracked.retry.reset();
      syncMetrics.bump('scheduledRuns');
    } catch {
      tracked.retry.nextDelay();
      syncMetrics.bump('failures');
      syncMetrics.bump('retries');
    }
  }

  /**
   * The current poll interval for a resource, in ms, or `Infinity` if it should
   * not poll right now.
   */
  private effectiveInterval(tracked: Tracked): number {
    const { resource, retry } = tracked;
    const { visible, realtimeConnected } = this.conditions;

    if (resource.cadence === 'manual') return Number.POSITIVE_INFINITY;

    // A resource kept fresh by realtime events does not poll while the socket
    // is up. It falls back to the `low` cadence when the socket is down so it
    // cannot drift indefinitely.
    if (resource.realtimeEvents.length > 0 && realtimeConnected) {
      return Number.POSITIVE_INFINITY;
    }

    let base =
      resource.realtimeEvents.length > 0
        ? CADENCE_BASE_MS.low
        : CADENCE_BASE_MS[resource.cadence];

    if (!visible) {
      if (resource.cadence === 'low') return Number.POSITIVE_INFINITY;
      base *= HIDDEN_MULTIPLIER;
    }

    // While backing off from a failure, honour the retry delay if it is longer.
    if (retry.failing) {
      return Math.max(base, retry.currentFloor());
    }
    return base;
  }
}
