import { classifyError } from './retry-policy.js';
import { syncMetrics } from './sync-metrics.js';

/**
 * A user action taken while offline that should be re-attempted once the
 * connection returns. Deliberately limited (this pass) to idempotent
 * read-state operations — marking a notification read, clearing a badge,
 * setting presence — where a late replay can never surprise the user.
 */
export interface QueuedAction {
  id: string;
  /** Registered executor name, e.g. `notification.markRead`. */
  kind: string;
  workspaceId: string;
  /**
   * Collapses repeats: enqueuing an action whose `dedupeKey` already exists
   * replaces the earlier one (last write wins) instead of stacking.
   */
  dedupeKey: string;
  payload: unknown;
  enqueuedAt: string;
  attempts: number;
}

export type ActionExecutor = (
  payload: unknown,
  workspaceId: string,
) => Promise<void>;

interface Persistence {
  read(workspaceId: string): QueuedAction[];
  write(workspaceId: string, actions: QueuedAction[]): void;
}

const KEY = (workspaceId: string) => `onetab:sync:${workspaceId}:queue`;

const localStoragePersistence: Persistence = {
  read(workspaceId) {
    try {
      const raw = localStorage.getItem(KEY(workspaceId));
      const parsed = raw ? (JSON.parse(raw) as QueuedAction[]) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },
  write(workspaceId, actions) {
    try {
      if (actions.length === 0) localStorage.removeItem(KEY(workspaceId));
      else localStorage.setItem(KEY(workspaceId), JSON.stringify(actions));
    } catch {
      // Storage unavailable — the queue degrades to in-memory only.
    }
  },
};

const MAX_ATTEMPTS = 5;
const MAX_QUEUE = 200;

/**
 * A per-workspace, ordered, persisted queue of offline actions.
 *
 * Only the sync leader calls {@link replay}; followers just enqueue and let the
 * leader drain. Replay is strictly in order and stops at the first entry that
 * still needs the network, so ordering is preserved across reconnects.
 */
export class OfflineActionQueue {
  private readonly executors = new Map<string, ActionExecutor>();
  /** In-memory mirror so reads are cheap and work without storage. */
  private readonly memory = new Map<string, QueuedAction[]>();
  private replaying = false;

  constructor(
    private readonly persistence: Persistence = localStoragePersistence,
    private readonly onChange: (workspaceId: string, pending: number) => void = () =>
      undefined,
  ) {}

  registerExecutor(kind: string, executor: ActionExecutor): void {
    this.executors.set(kind, executor);
  }

  private load(workspaceId: string): QueuedAction[] {
    let list = this.memory.get(workspaceId);
    if (!list) {
      list = this.persistence.read(workspaceId);
      this.memory.set(workspaceId, list);
    }
    return list;
  }

  private save(workspaceId: string, list: QueuedAction[]): void {
    this.memory.set(workspaceId, list);
    this.persistence.write(workspaceId, list);
    this.onChange(workspaceId, list.length);
  }

  pending(workspaceId: string): number {
    return this.load(workspaceId).length;
  }

  enqueue(
    action: Omit<QueuedAction, 'id' | 'enqueuedAt' | 'attempts'>,
  ): void {
    const list = this.load(action.workspaceId).filter(
      (a) => a.dedupeKey !== action.dedupeKey,
    );
    list.push({
      ...action,
      id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      enqueuedAt: new Date().toISOString(),
      attempts: 0,
    });
    // Bound the queue — drop the oldest if a long offline stint overflows it.
    while (list.length > MAX_QUEUE) list.shift();
    this.save(action.workspaceId, list);
    syncMetrics.log('queue', 'enqueued', action.kind, action.dedupeKey);
  }

  clear(workspaceId: string): void {
    this.save(workspaceId, []);
  }

  /**
   * Drains the queue in order. Returns when it is empty or the next entry needs
   * a network that is still unavailable. Terminal failures (validation,
   * permission, conflict) drop the entry; transient ones keep it for the next
   * reconnect.
   */
  async replay(workspaceId: string): Promise<void> {
    if (this.replaying) return;
    this.replaying = true;
    try {
      // Work against a snapshot copy; re-persist after each entry so a crash
      // mid-drain does not replay already-applied actions.
      for (;;) {
        const list = this.load(workspaceId);
        const next = list[0];
        if (!next) break;

        const executor = this.executors.get(next.kind);
        if (!executor) {
          // Unknown kind (code changed under a persisted queue) — drop it.
          this.save(workspaceId, list.slice(1));
          syncMetrics.bump('queueDropped');
          continue;
        }

        try {
          await executor(next.payload, workspaceId);
          this.save(workspaceId, list.slice(1));
          syncMetrics.bump('queueReplayed');
          syncMetrics.log('queue', 'replayed', next.kind);
        } catch (error) {
          const { retryable } = classifyError(error);
          next.attempts += 1;
          if (!retryable || next.attempts >= MAX_ATTEMPTS) {
            this.save(workspaceId, list.slice(1));
            syncMetrics.bump('queueDropped');
            syncMetrics.log('queue', 'dropped', next.kind, error);
            continue;
          }
          // Still transient — stop here, preserve order, try again next time.
          this.save(workspaceId, list);
          break;
        }
      }
    } finally {
      this.replaying = false;
    }
  }
}
