import { RealtimeEventBus } from '@org/realtime';
import type { SyncChangesDigest } from '@org/types';
import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackgroundSyncManager } from './background-sync-manager.js';
import {
  INVALIDATION_MAX_WAIT_MS,
  INVALIDATION_WINDOW_MS,
} from './realtime-invalidation-batcher.js';
import { readCursor } from './sync-catchup.js';
import { useSyncStore } from './sync-store.js';

const { changes } = vi.hoisted(() => ({ changes: vi.fn() }));

vi.mock('@org/api-client', async (importActual) => {
  const actual = await importActual<Record<string, unknown>>();
  return { ...actual, syncApi: { changes } };
});

const WS = 'ws_1';

function emptyDigest(workspaceId: string): SyncChangesDigest {
  return {
    workspaceId,
    since: '2020-01-01T00:00:00.000Z',
    serverTime: new Date().toISOString(),
    hasMore: false,
    changed: {
      channels: [],
      members: [],
      notifications: [],
      tasks: [],
      projects: [],
      meetings: [],
    },
    unreadCount: 0,
  };
}

describe('BackgroundSyncManager', () => {
  let manager: InstanceType<typeof BackgroundSyncManager>;
  let qc: QueryClient;
  let bus: RealtimeEventBus;
  let invalidate: ReturnType<typeof vi.spyOn>;
  let cancel: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    changes.mockReset();
    changes.mockImplementation(async (workspaceId: string) =>
      emptyDigest(workspaceId),
    );
    localStorage.clear();
    useSyncStore.setState({
      phase: 'synced',
      lastSyncedAt: null,
      pendingActions: 0,
      lastError: null,
      isLeader: true,
      reconciling: false,
    });

    qc = new QueryClient();
    invalidate = vi
      .spyOn(qc, 'invalidateQueries')
      .mockImplementation(() => undefined as never);
    cancel = vi
      .spyOn(qc, 'cancelQueries')
      .mockImplementation(() => Promise.resolve());
    bus = new RealtimeEventBus();
    manager = new BackgroundSyncManager();
    manager.attach({ queryClient: qc, bus });
  });

  afterEach(() => {
    manager.dispose();
  });

  describe('realtime invalidation batching', () => {
    const emit = (type: string, payload: object = {}, workspaceId = WS) =>
      bus.emit({
        id: `e-${Math.random()}`,
        type,
        timestamp: new Date().toISOString(),
        workspaceId,
        payload: { workspaceId, ...payload },
      });
    const invalidatedKeys = () =>
      invalidate.mock.calls.map(
        (call: unknown[]) => (call[0] as { queryKey: unknown[] }).queryKey,
      );

    beforeEach(async () => {
      await manager.setWorkspace(WS);
      invalidate.mockClear();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('applies a single event within the window', () => {
      emit('channel.created');
      expect(invalidate).not.toHaveBeenCalled();

      vi.advanceTimersByTime(INVALIDATION_WINDOW_MS);

      expect(invalidate).toHaveBeenCalledTimes(1);
      expect(invalidate).toHaveBeenCalledWith({ queryKey: ['channels', WS] });
    });

    it('turns a burst of task events into one invalidation per key', () => {
      for (let i = 0; i < 25; i++) {
        emit('kanban.updated', { taskId: `t${i}` });
        emit('task.updated', { taskId: `t${i}` });
        emit('comment.created', { taskId: `t${i}` });
        emit('notification.read');
      }

      vi.advanceTimersByTime(INVALIDATION_WINDOW_MS);

      const keys = invalidatedKeys();
      expect(keys.filter((k) => k[0] === 'work-tools')).toEqual([
        ['work-tools', WS, 'tasks'],
      ]);
      expect(new Set(keys.map((k) => JSON.stringify(k))).size).toBe(keys.length);
      expect(keys).toHaveLength(4); // the tasks prefix + three notification keys
    });

    it('keeps refreshing during an endless stream of events', () => {
      for (let elapsed = 0; elapsed < 3000; elapsed += 100) {
        emit('kanban.updated');
        vi.advanceTimersByTime(100);
      }

      expect(invalidate).toHaveBeenCalledTimes(3);
    });

    it('drops pending keys on workspace switch and leaves the cursor for catch-up', async () => {
      const cursor = readCursor(WS);
      vi.advanceTimersByTime(1000);
      emit('channel.created');

      await manager.setWorkspace('ws_2');
      vi.advanceTimersByTime(INVALIDATION_MAX_WAIT_MS);

      expect(invalidatedKeys()).not.toContainEqual(['channels', WS]);
      expect(readCursor(WS)).toBe(cursor);
    });

    it('drops pending keys on dispose', () => {
      emit('channel.created');

      manager.dispose();
      vi.advanceTimersByTime(INVALIDATION_MAX_WAIT_MS);

      expect(invalidate).not.toHaveBeenCalled();
    });

    it('marks the stream synced when the batch flushes', () => {
      useSyncStore.setState({ lastSyncedAt: null });
      emit('channel.created');
      expect(useSyncStore.getState().lastSyncedAt).toBeNull();

      vi.advanceTimersByTime(INVALIDATION_WINDOW_MS);

      expect(useSyncStore.getState().lastSyncedAt).not.toBeNull();
    });

    it('marks the stream synced at once for an event with its own refresh timer', () => {
      useSyncStore.setState({ lastSyncedAt: null });
      emit('agent.updated', { agentId: 'a1' });
      expect(useSyncStore.getState().lastSyncedAt).not.toBeNull();
    });
  });

  it('ignores a realtime event for a different workspace', async () => {
    await manager.setWorkspace(WS);
    invalidate.mockClear();

    bus.emit({
      id: 'e2',
      type: 'channel.created',
      timestamp: new Date().toISOString(),
      workspaceId: 'ws_other',
      payload: { workspaceId: 'ws_other' },
    });

    expect(invalidate).not.toHaveBeenCalled();
  });

  it('cancels in-flight queries for the workspace being left on switch', async () => {
    await manager.setWorkspace('ws_a');
    expect(cancel).not.toHaveBeenCalled(); // nothing to leave yet

    await manager.setWorkspace('ws_b');
    expect(cancel).toHaveBeenCalledTimes(1);
    const predicate = (cancel.mock.calls[0][0] as { predicate: (q: unknown) => boolean })
      .predicate;
    expect(predicate({ queryKey: ['channels', 'ws_a'] })).toBe(true);
    expect(predicate({ queryKey: ['channels', 'ws_b'] })).toBe(false);
  });

  it('runs a catch-up when the workspace changes', async () => {
    await manager.setWorkspace(WS);
    expect(changes).toHaveBeenCalledWith(WS, expect.any(String));
  });

  it('runs a catch-up on realtime reconnect', async () => {
    await manager.setWorkspace(WS);
    changes.mockClear();

    manager.setConnectionState('reconnecting');
    manager.setConnectionState('connected');
    await vi.waitFor(() => expect(changes).toHaveBeenCalled());
  });

  it('reflects offline / reconnecting / synced in the sync store phase', async () => {
    await manager.setWorkspace(WS);

    manager.setConnectionState('connected');
    // The connect triggers an async reconcile (phase 'syncing'); let it settle.
    await vi.waitFor(() =>
      expect(useSyncStore.getState().phase).toBe('synced'),
    );

    window.dispatchEvent(new Event('offline'));
    expect(useSyncStore.getState().phase).toBe('offline');

    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() =>
      expect(useSyncStore.getState().phase).not.toBe('offline'),
    );

    manager.setConnectionState('reconnecting');
    expect(useSyncStore.getState().phase).toBe('reconnecting');
  });

  it('manualResync is a no-op while a reconcile is already in flight', async () => {
    await manager.setWorkspace(WS);
    changes.mockClear();
    let resolveChanges: (v: SyncChangesDigest) => void = () => undefined;
    changes.mockImplementation(
      () =>
        new Promise<SyncChangesDigest>((res) => {
          resolveChanges = res;
        }),
    );

    const first = manager.manualResync();
    const second = manager.manualResync(); // should bail immediately
    resolveChanges(emptyDigest(WS));
    await Promise.all([first, second]);

    expect(changes).toHaveBeenCalledTimes(1);
  });

  it('queues an offline action and replays it once back online', async () => {
    await manager.setWorkspace(WS);
    const exec = vi.fn(async () => undefined);
    manager.registerOfflineExecutor('test.mark', exec);

    window.dispatchEvent(new Event('offline'));
    await manager.enqueueOfflineAction({
      kind: 'test.mark',
      dedupeKey: 'n1',
      payload: { id: 'n1' },
    });
    expect(exec).not.toHaveBeenCalled();
    expect(useSyncStore.getState().pendingActions).toBe(1);

    window.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(exec).toHaveBeenCalledTimes(1));
    expect(useSyncStore.getState().pendingActions).toBe(0);
  });
});
