/**
 * Lightweight in-process counters for the background sync system.
 *
 * No third-party service — this feeds the existing console/logging story and a
 * `window.__oneTabSync()` snapshot in development. Everything here is cheap and
 * synchronous; it must never be in the hot path of a render.
 */
export interface SyncMetricsSnapshot {
  /** Scheduled resource invalidations that ran. */
  scheduledRuns: number;
  /** Realtime events applied to the cache. */
  realtimeApplied: number;
  /** Realtime events dropped as duplicates or cross-workspace. */
  realtimeDropped: number;
  /** Catch-up (incremental reconcile) fetches that completed. */
  catchupRuns: number;
  /** Individual resource keys invalidated by a catch-up digest. */
  catchupItems: number;
  /** Catch-up / scheduled operations that threw. */
  failures: number;
  /** Realtime reconnect transitions observed. */
  reconnects: number;
  /** Backoff retries scheduled across all units of work. */
  retries: number;
  /** Offline-queue entries successfully replayed. */
  queueReplayed: number;
  /** Offline-queue entries dropped after a terminal error. */
  queueDropped: number;
  /** Duration of the most recent catch-up, in ms. */
  lastCatchupMs: number;
  /** ISO timestamp of the last successful sync of any kind. */
  lastSyncedAt: string | null;
  /** Whether this tab currently holds the sync-leader lock. */
  isLeader: boolean;
}

type Counter = keyof Omit<
  SyncMetricsSnapshot,
  'lastCatchupMs' | 'lastSyncedAt' | 'isLeader'
>;

const state: SyncMetricsSnapshot = {
  scheduledRuns: 0,
  realtimeApplied: 0,
  realtimeDropped: 0,
  catchupRuns: 0,
  catchupItems: 0,
  failures: 0,
  reconnects: 0,
  retries: 0,
  queueReplayed: 0,
  queueDropped: 0,
  lastCatchupMs: 0,
  lastSyncedAt: null,
  isLeader: false,
};

function debugEnabled(): boolean {
  try {
    if (
      typeof import.meta !== 'undefined' &&
      (import.meta as { env?: Record<string, unknown> }).env?.['DEV']
    ) {
      return true;
    }
  } catch {
    // import.meta not available (e.g. CJS test runner) — fall through.
  }
  try {
    return (localStorage.getItem('debug') ?? '').includes('sync');
  } catch {
    return false;
  }
}

export const syncMetrics = {
  bump(counter: Counter, by = 1): void {
    state[counter] += by;
  },
  setLeader(isLeader: boolean): void {
    state.isLeader = isLeader;
  },
  recordCatchup(durationMs: number, itemCount: number): void {
    state.catchupRuns += 1;
    state.catchupItems += itemCount;
    state.lastCatchupMs = Math.round(durationMs);
    state.lastSyncedAt = new Date().toISOString();
  },
  markSynced(): void {
    state.lastSyncedAt = new Date().toISOString();
  },
  snapshot(): SyncMetricsSnapshot {
    return { ...state };
  },
  log(scope: string, ...args: unknown[]): void {
    if (!debugEnabled()) return;
    // eslint-disable-next-line no-console
    console.debug(`[sync:${scope}]`, ...args);
  },
};

/**
 * Exposes `window.__oneTabSync()` for manual inspection during development.
 * Safe to call repeatedly; a no-op outside a browser.
 */
export function installSyncMetricsProbe(
  extra: () => Record<string, unknown> = () => ({}),
): void {
  if (typeof window === 'undefined') return;
  try {
    (window as unknown as Record<string, unknown>)['__oneTabSync'] = () => ({
      ...syncMetrics.snapshot(),
      ...extra(),
    });
  } catch {
    // Assigning to window can throw in locked-down embeds — ignore.
  }
}
