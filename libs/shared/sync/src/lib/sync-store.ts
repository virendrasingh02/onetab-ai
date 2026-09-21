import { create } from 'zustand';
import type { ErrorClass } from './retry-policy.js';
import type { SyncPhase } from './sync-resource.js';

/**
 * A queued offline action that was dropped without ever applying — surfaced
 * once so a UI bridge can tell the user, instead of the action silently
 * vanishing. `id` is the queue entry's id, so a bridge that only wants to
 * react to *new* drops can dedupe on it.
 */
export interface DroppedOfflineAction {
  id: string;
  kind: string;
  errorClass?: ErrorClass;
  at: string;
}

export interface SyncStatusState {
  /** Coarse state for the status indicator. */
  phase: SyncPhase;
  /** ISO timestamp of the last successful sync (realtime, catch-up or poll). */
  lastSyncedAt: string | null;
  /** Offline actions waiting to be replayed. */
  pendingActions: number;
  /** A message only when the user needs to act (rare). */
  lastError: string | null;
  /** Whether this tab drives the scheduled polling / catch-up work. */
  isLeader: boolean;
  /** A reconcile / catch-up is in flight right now. */
  reconciling: boolean;
  /** The most recent offline-queue action dropped on replay (conflict, permission, validation, or an unknown kind). */
  lastDroppedAction: DroppedOfflineAction | null;

  setPhase: (phase: SyncPhase) => void;
  markSynced: () => void;
  setPending: (count: number) => void;
  setError: (message: string | null) => void;
  setLeader: (isLeader: boolean) => void;
  setReconciling: (value: boolean) => void;
}

/**
 * The one place the UI reads background-sync health from. Deliberately tiny —
 * the manager writes to it, `<SyncStatusIndicator>` and the offline banner read
 * from it, and nothing else should.
 */
export const useSyncStore = create<SyncStatusState>((set) => ({
  phase: 'synced',
  lastSyncedAt: null,
  pendingActions: 0,
  lastError: null,
  isLeader: true,
  reconciling: false,
  lastDroppedAction: null,

  setPhase: (phase) => set({ phase }),
  markSynced: () =>
    set({
      phase: 'synced',
      lastSyncedAt: new Date().toISOString(),
      lastError: null,
      reconciling: false,
    }),
  setPending: (pendingActions) => set({ pendingActions }),
  setError: (lastError) => set({ lastError, phase: lastError ? 'error' : 'synced' }),
  setLeader: (isLeader) => set({ isLeader }),
  setReconciling: (reconciling) => set({ reconciling }),
}));

/** Non-hook read, for the manager and metrics probe. */
export const syncStore = {
  get: useSyncStore.getState,
  set: useSyncStore.setState,
  subscribe: useSyncStore.subscribe,
};
