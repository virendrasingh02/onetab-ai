import {
  RealtimeEventType,
  type RealtimeClient,
  type RealtimeConnectionState,
  type RealtimeEvent,
  type RealtimeEventBus,
} from '@org/realtime';
import type { QueryClient } from '@tanstack/react-query';
import { applyRealtimeEvent } from './realtime-invalidation-map.js';
import { OfflineActionQueue, type ActionExecutor } from './offline-queue.js';
import { runCatchup, writeCursor } from './sync-catchup.js';
import { installSyncMetricsProbe, syncMetrics } from './sync-metrics.js';
import { SyncLeader, type SyncBroadcast } from './sync-leader.js';
import { SyncScheduler } from './sync-scheduler.js';
import { syncStore } from './sync-store.js';
import type {
  RegisterResourceInput,
  SyncPhase,
  SyncPriority,
} from './sync-resource.js';

export interface AttachDeps {
  queryClient: QueryClient;
  bus: RealtimeEventBus;
}

/**
 * The one object that owns background synchronisation for the app.
 *
 * Individual screens do **not** poll. They register a {@link SyncResource} and
 * this manager decides — from one timer — when anything is due, subject to tab
 * visibility, network state, realtime-stream health, workspace scope and
 * multi-tab leadership. It also:
 *
 * - routes every realtime event through the shared invalidation map;
 * - runs an incremental catch-up after any gap in the stream;
 * - replays queued offline actions on reconnect (leader tab only);
 * - keeps {@link syncStore} (and thus the status indicator) honest;
 * - fans the leader's invalidation decisions out to follower tabs.
 *
 * Construct once; call {@link attach} when the query client and realtime bus
 * are available, {@link setWorkspace} whenever the active workspace changes, and
 * {@link dispose} on teardown.
 */
export class BackgroundSyncManager {
  private queryClient: QueryClient | null = null;
  private realtimeClient: RealtimeClient | null = null;
  private scheduler: SyncScheduler | null = null;
  private readonly leader: SyncLeader;
  private readonly queue = new OfflineActionQueue(undefined, (wsId, pending) => {
    if (wsId === this.workspaceId) syncStore.set({ pendingActions: pending });
    this.leader.publish({ kind: 'queue-changed', workspaceId: wsId, pendingActions: pending });
  });

  private workspaceId: string | null = null;
  private connectionState: RealtimeConnectionState = 'disconnected';
  /** True once the SSE stream has connected at least once this session, so the
   * first cold connect reads as "Syncing…" rather than "Reconnecting…". */
  private everConnected = false;
  private online =
    typeof navigator !== 'undefined' ? navigator.onLine : true;
  private visible =
    typeof document !== 'undefined'
      ? document.visibilityState === 'visible'
      : true;
  private catchupInFlight = false;
  private disposed = false;
  private detachFns: Array<() => void> = [];

  constructor() {
    this.leader = new SyncLeader({
      onBecomeLeader: () => {
        syncStore.set({ isLeader: true });
        this.pushConditions();
        // A tab that has just become leader may have missed timers — reconcile.
        void this.reconcile('leadership');
        void this.replayQueue();
      },
      onResignLeader: () => {
        syncStore.set({ isLeader: false });
        this.pushConditions();
      },
      onBroadcast: (message) => this.onLeaderBroadcast(message),
    });
  }

  // --- lifecycle ---------------------------------------------------------

  attach({ queryClient, bus }: AttachDeps): void {
    if (this.disposed) return;
    this.queryClient = queryClient;
    this.scheduler = new SyncScheduler(queryClient);
    this.scheduler.onInvalidate = (queryKey, wsId) => {
      if (this.leader.isLeader) {
        this.leader.publish({
          kind: 'invalidate',
          workspaceId: wsId,
          keys: [queryKey],
        });
      }
    };
    this.scheduler.start();

    // Route realtime events through the shared invalidation map.
    const offBus = bus.onAny((event: RealtimeEvent) => this.onRealtimeEvent(event));
    this.detachFns.push(offBus);

    this.installLifecycleListeners();
    this.leader.start();
    this.pushConditions();
    installSyncMetricsProbe(() => ({
      workspaceId: this.workspaceId,
      connectionState: this.connectionState,
      online: this.online,
      visible: this.visible,
      resources: this.scheduler?.list().map((r) => r.id) ?? [],
    }));
    this.recomputePhase();
  }

  setRealtimeClient(client: RealtimeClient | null): void {
    this.realtimeClient = client;
  }

  /** Called by the provider whenever the SSE connection state changes. */
  setConnectionState(state: RealtimeConnectionState): void {
    const previous = this.connectionState;
    this.connectionState = state;
    this.scheduler?.updateConditions({ realtimeConnected: state === 'connected' });

    if (state === 'connected' && previous !== 'connected') {
      if (this.everConnected) {
        syncMetrics.bump('reconnects');
      }
      this.everConnected = true;
      // Any transition into `connected` may follow a gap in the stream.
      void this.reconcile('reconnect');
      void this.replayQueue();
    }
    this.recomputePhase();
  }

  /**
   * Switches the active workspace. Cancels in-flight requests for the workspace
   * being left, re-points every condition at the new one, and runs a catch-up
   * so the entered workspace is immediately current.
   */
  async setWorkspace(workspaceId: string | null): Promise<void> {
    if (this.workspaceId === workspaceId) return;
    const previous = this.workspaceId;
    this.workspaceId = workspaceId;

    if (previous && this.queryClient) {
      // Stop any background refetch aimed at the workspace we are leaving so it
      // cannot land in the cache after the switch.
      this.queryClient.cancelQueries({
        predicate: (query) => query.queryKey.some((part) => part === previous),
      });
    }

    this.pushConditions();
    syncStore.set({
      pendingActions: workspaceId ? this.queue.pending(workspaceId) : 0,
    });
    this.recomputePhase();

    if (workspaceId && this.online) {
      await this.reconcile('workspace-switch');
      void this.replayQueue();
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const fn of this.detachFns) fn();
    this.detachFns = [];
    this.scheduler?.stop();
    this.scheduler = null;
    this.leader.dispose();
    this.queryClient = null;
    this.realtimeClient = null;
  }

  // --- resource registry ----------------------------------------------

  registerResource(input: RegisterResourceInput): void {
    this.scheduler?.register(input);
  }

  unregisterResource(id: string): void {
    this.scheduler?.unregister(id);
  }

  setResourceEnabled(id: string, enabled: boolean): void {
    this.scheduler?.setEnabled(id, enabled);
  }

  // --- offline queue -------------------------------------------------

  registerOfflineExecutor(kind: string, executor: ActionExecutor): void {
    this.queue.registerExecutor(kind, executor);
  }

  /**
   * Records an action taken offline for replay on reconnect. If the app is
   * actually online it runs the executor immediately instead of queueing.
   */
  async enqueueOfflineAction(action: {
    kind: string;
    dedupeKey: string;
    payload: unknown;
  }): Promise<void> {
    const ws = this.workspaceId;
    if (!ws) return;
    this.queue.enqueue({ ...action, workspaceId: ws });
    syncStore.set({ pendingActions: this.queue.pending(ws) });
    if (this.online && this.leader.isLeader) {
      await this.replayQueue();
    }
  }

  // --- manual controls ---------------------------------------------

  /**
   * Explicit "refresh now". Invalidates the active workspace's active + high
   * resources and runs a catch-up. Never resets queries, so optimistic updates
   * and in-flight mutations are preserved. A no-op if a reconcile is already
   * running.
   */
  async manualResync(): Promise<void> {
    if (this.catchupInFlight || !this.workspaceId) return;
    // If the socket is down, a manual re-sync should also try to bring it back.
    if (this.connectionState !== 'connected') {
      this.realtimeClient?.reconnect();
    }
    await this.reconcile('manual', ['active', 'high']);
  }

  // --- internals ---------------------------------------------------

  private onRealtimeEvent(event: RealtimeEvent): void {
    if (!this.queryClient || !this.workspaceId) return;
    if (event.type === RealtimeEventType.Heartbeat) return;
    const applied = applyRealtimeEvent(event, {
      queryClient: this.queryClient,
      workspaceId: this.workspaceId,
    });
    if (applied > 0) {
      // A realtime event is proof the stream is live and current.
      this.markSynced();
    }
  }

  private onLeaderBroadcast(message: SyncBroadcast): void {
    if (!this.queryClient) return;
    if (message.kind === 'invalidate') {
      if (message.workspaceId !== this.workspaceId) return;
      for (const key of message.keys) {
        this.queryClient.invalidateQueries({ queryKey: key });
      }
    } else if (message.kind === 'queue-changed') {
      if (message.workspaceId === this.workspaceId) {
        syncStore.set({ pendingActions: message.pendingActions });
      }
    }
  }

  /** Incremental reconciliation after any kind of gap. */
  private async reconcile(
    reason: string,
    priorities: SyncPriority[] = ['active', 'high', 'low'],
  ): Promise<void> {
    if (!this.queryClient || !this.workspaceId || !this.online) return;
    if (this.catchupInFlight) return;
    this.catchupInFlight = true;
    syncStore.set({ reconciling: true });
    this.recomputePhase();
    const workspaceId = this.workspaceId;

    try {
      syncMetrics.log('catchup', reason, workspaceId);
      const result = await runCatchup(workspaceId, {
        queryClient: this.queryClient,
        fallbackRefresh: () => this.scheduler?.refreshNow(priorities) ?? 0,
      });
      if (this.leader.isLeader && result.digest) {
        // Let followers apply the same targeted invalidations.
        this.leader.publish({
          kind: 'invalidate',
          workspaceId,
          keys: catchupKeysFor(workspaceId, result),
        });
      }
      this.markSynced();
    } catch (error) {
      syncMetrics.bump('failures');
      syncMetrics.log('catchup', 'failed', error);
      // Do not surface — a failed catch-up just means the next event or the
      // next reconnect tries again. The status indicator shows "reconnecting".
      this.recomputePhase();
    } finally {
      this.catchupInFlight = false;
      syncStore.set({ reconciling: false });
      this.recomputePhase();
    }
  }

  private async replayQueue(): Promise<void> {
    if (!this.leader.isLeader || !this.online || !this.workspaceId) return;
    await this.queue.replay(this.workspaceId);
    syncStore.set({ pendingActions: this.queue.pending(this.workspaceId) });
  }

  private markSynced(): void {
    syncMetrics.markSynced();
    const now = new Date().toISOString();
    if (this.workspaceId) writeCursor(this.workspaceId, now);
    syncStore.set({ lastSyncedAt: now });
    this.recomputePhase();
  }

  private installLifecycleListeners(): void {
    if (typeof window === 'undefined') return;

    const onOnline = () => {
      this.online = true;
      this.pushConditions();
      this.recomputePhase();
      void this.reconcile('online');
      void this.replayQueue();
    };
    const onOffline = () => {
      this.online = false;
      this.pushConditions();
      this.recomputePhase();
    };
    const onVisibility = () => {
      const nowVisible = document.visibilityState === 'visible';
      const wasVisible = this.visible;
      this.visible = nowVisible;
      this.pushConditions();
      if (nowVisible && !wasVisible) {
        // Returning to the tab — a light reconciliation, not a reload.
        void this.reconcile('resume');
      }
    };
    // `resume` fires when the page comes back from the frozen state on mobile /
    // heavily throttled desktop; treat it like a visibility resume.
    const onResume = () => void this.reconcile('resume');

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    document.addEventListener('visibilitychange', onVisibility);
    document.addEventListener('resume', onResume);

    this.detachFns.push(() => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      document.removeEventListener('visibilitychange', onVisibility);
      document.removeEventListener('resume', onResume);
    });
  }

  private pushConditions(): void {
    this.scheduler?.updateConditions({
      online: this.online,
      visible: this.visible,
      realtimeConnected: this.connectionState === 'connected',
      activeWorkspaceId: this.workspaceId,
      isLeader: this.leader.isLeader,
    });
  }

  private recomputePhase(): void {
    const state = syncStore.get();
    let phase: SyncPhase;

    const socketDown =
      this.connectionState === 'reconnecting' ||
      this.connectionState === 'disconnected';

    if (!this.online) {
      phase = 'offline';
    } else if (socketDown && this.everConnected) {
      // A *dropped* socket is the informative thing to surface, even with a
      // reconcile running behind it. A socket that has never connected yet is
      // just the app warming up — that reads as "Syncing…", not "Reconnecting…".
      phase = 'reconnecting';
    } else if (state.reconciling) {
      phase = 'syncing';
    } else if (!this.everConnected && this.connectionState !== 'connected') {
      phase = 'syncing';
    } else {
      phase = 'synced';
    }

    if (phase !== state.phase) syncStore.set({ phase });
  }
}

/**
 * The keys a completed catch-up touched, so the leader can replay the same
 * targeted invalidations to follower tabs. Mirrors `applyDigest`.
 */
function catchupKeysFor(
  workspaceId: string,
  result: Awaited<ReturnType<typeof runCatchup>>,
): unknown[][] {
  if (!result.digest) return [];
  const ws = workspaceId;
  const d = result.digest;
  const keys: unknown[][] = [];
  if (d.changed.channels.length) keys.push(['channels', ws]);
  if (d.changed.members.length) keys.push(['members', ws]);
  if (d.changed.notifications.length || d.hasMore) {
    keys.push(['notifications', ws, 'unread-count']);
    keys.push(['notifications', ws, 'feed']);
  }
  if (d.changed.tasks.length) keys.push(['work-tools', ws, 'tasks']);
  if (d.changed.projects.length) keys.push(['work-tools', ws, 'projects']);
  if (d.changed.meetings.length) keys.push(['work-tools', ws, 'meetings']);
  return keys;
}
