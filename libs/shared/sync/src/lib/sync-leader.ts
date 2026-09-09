import { syncMetrics } from './sync-metrics.js';

const LOCK_NAME = 'onetab-sync-leader';
const CHANNEL_NAME = 'onetab_sync';

/** A message fanned out from the leader tab to its followers. */
export type SyncBroadcast =
  | {
      kind: 'invalidate';
      workspaceId: string;
      /** Serialisable query keys to invalidate in the follower's cache. */
      keys: unknown[][];
    }
  | {
      kind: 'status';
      workspaceId: string | null;
      phase: string;
      lastSyncedAt: string | null;
      pendingActions: number;
    }
  | { kind: 'queue-changed'; workspaceId: string; pendingActions: number };

export interface SyncLeaderOptions {
  onBecomeLeader: () => void;
  onResignLeader: () => void;
  onBroadcast: (message: SyncBroadcast) => void;
}

/**
 * Elects exactly one "leader" tab to run the scheduled polling and catch-up
 * work, so N open tabs do not each hammer the API on the same timers. Leadership
 * is held via the Web Locks API — the lock is released automatically when the
 * tab closes or crashes, and another tab picks it up immediately.
 *
 * The realtime SSE stream is still per-tab (each tab needs its own live events);
 * this only de-duplicates the *polling* and *reconciliation* traffic, which is
 * where the waste is. Followers receive the leader's invalidation decisions
 * over a {@link BroadcastChannel} and apply them to their own query cache.
 *
 * Where Web Locks is unavailable every tab is its own leader — correct, just
 * without the de-duplication.
 */
export class SyncLeader {
  private channel: BroadcastChannel | null = null;
  private releaseLock: (() => void) | null = null;
  private isLeaderFlag = false;
  private disposed = false;

  constructor(private readonly options: SyncLeaderOptions) {}

  get isLeader(): boolean {
    return this.isLeaderFlag;
  }

  start(): void {
    if (typeof window === 'undefined') return;

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.channel = new BroadcastChannel(CHANNEL_NAME);
        this.channel.onmessage = (event: MessageEvent) => {
          if (this.isLeaderFlag) return; // the leader does not act on its own echo
          const data = event.data as SyncBroadcast | undefined;
          if (data && typeof data === 'object' && 'kind' in data) {
            this.options.onBroadcast(data);
          }
        };
      } catch {
        this.channel = null;
      }
    }

    const locks = (navigator as Navigator & { locks?: LockManager }).locks;
    if (!locks?.request) {
      // No Web Locks — act as leader unconditionally.
      this.setLeader(true);
      return;
    }

    // Hold the lock for the lifetime of the tab. The promise inside the
    // callback never resolves until we choose to resign, so whoever is waiting
    // only gets it when this tab goes away (or disposes).
    void locks
      .request(LOCK_NAME, { mode: 'exclusive' }, () => {
        if (this.disposed) return;
        this.setLeader(true);
        return new Promise<void>((resolve) => {
          this.releaseLock = () => {
            this.setLeader(false);
            resolve();
          };
        });
      })
      .catch(() => {
        // Lock request rejected (e.g. page in bfcache) — retry once on resume.
        if (!this.disposed) this.setLeader(false);
      });
  }

  /** Leader-only: fan a message out to every follower tab. */
  publish(message: SyncBroadcast): void {
    if (!this.channel) return;
    try {
      this.channel.postMessage(message);
    } catch {
      // Channel closed mid-send — ignore.
    }
  }

  dispose(): void {
    this.disposed = true;
    this.releaseLock?.();
    this.releaseLock = null;
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }

  private setLeader(next: boolean): void {
    if (this.isLeaderFlag === next) return;
    this.isLeaderFlag = next;
    syncMetrics.setLeader(next);
    if (next) this.options.onBecomeLeader();
    else this.options.onResignLeader();
  }
}
