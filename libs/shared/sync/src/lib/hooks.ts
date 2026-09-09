import { useRealtime } from '@org/realtime';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { CadenceClass, RegisterResourceInput } from './sync-resource.js';
import { CADENCE_BASE_MS } from './sync-resource.js';
import { useOptionalBackgroundSync } from './sync-provider.js';
import { useSyncStore, type SyncStatusState } from './sync-store.js';

/**
 * Registers a query with the central scheduler for the lifetime of the calling
 * component, instead of hand-rolling a `refetchInterval`. The manager owns the
 * one timer that decides when this key is due — visibility-aware, workspace-
 * scoped, suppressed while realtime covers it, backed off on failure.
 */
export function useBackgroundResource(
  input: RegisterResourceInput | null | undefined,
): void {
  const manager = useOptionalBackgroundSync();
  const serialized = input ? JSON.stringify(input.queryKey) : null;

  useEffect(() => {
    if (!manager || !input || !input.workspaceId) return;
    manager.registerResource(input);
    return () => manager.unregisterResource(input.id);
    // The query key (serialized) plus the scalar fields are the real identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    manager,
    input?.id,
    input?.workspaceId,
    input?.cadence,
    input?.priority,
    input?.enabled,
    serialized,
  ]);
}

export interface SyncStatus {
  phase: SyncStatusState['phase'];
  lastSyncedAt: string | null;
  pendingActions: number;
  isLeader: boolean;
  /** A short, humane label suitable for a subtle indicator. */
  label: string;
  /** True when the user should be told something needs their attention. */
  needsAttention: boolean;
}

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const deltaMs = Date.now() - Date.parse(iso);
  if (!Number.isFinite(deltaMs)) return '';
  if (deltaMs < 45_000) return 'just now';
  const min = Math.round(deltaMs / 60_000);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.round(hr / 24)}d ago`;
}

/** Reactive background-sync health for the status indicator + offline banner. */
export function useSyncStatus(): SyncStatus {
  const phase = useSyncStore((s) => s.phase);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);
  const pendingActions = useSyncStore((s) => s.pendingActions);
  const isLeader = useSyncStore((s) => s.isLeader);

  return useMemo(() => {
    let label: string;
    switch (phase) {
      case 'offline':
        label =
          pendingActions > 0
            ? `Offline — ${pendingActions} change${pendingActions === 1 ? '' : 's'} will sync`
            : "Offline — changes sync when you're back online";
        break;
      case 'reconnecting':
        label = 'Reconnecting…';
        break;
      case 'syncing':
        label = 'Syncing…';
        break;
      case 'error':
        label = 'Sync failed';
        break;
      default:
        label = lastSyncedAt ? `Synced ${relativeTime(lastSyncedAt)}` : 'Synced';
    }
    return {
      phase,
      lastSyncedAt,
      pendingActions,
      isLeader,
      label,
      needsAttention: phase === 'error',
    };
  }, [phase, lastSyncedAt, pendingActions, isLeader]);
}

/**
 * An explicit "refresh now" callback. Invalidates the active workspace's live
 * queries and runs a catch-up without a full reload; a no-op while a reconcile
 * is already running. Safe to wire to a button or a command-palette action.
 */
export function useManualResync(): () => Promise<void> {
  const manager = useOptionalBackgroundSync();
  return useCallback(async () => {
    await manager?.manualResync();
  }, [manager]);
}

/** Enqueue an idempotent action to replay when the connection returns. */
export function useEnqueueOfflineAction(): (action: {
  kind: string;
  dedupeKey: string;
  payload: unknown;
}) => Promise<void> {
  const manager = useOptionalBackgroundSync();
  return useCallback(
    async (action) => {
      await manager?.enqueueOfflineAction(action);
    },
    [manager],
  );
}

function subscribeVisibility(onChange: () => void): () => void {
  if (typeof document === 'undefined') return () => undefined;
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

function readVisible(): boolean {
  return typeof document === 'undefined'
    ? true
    : document.visibilityState === 'visible';
}

/**
 * A drop-in `refetchInterval` value for a `useQuery` that has been brought under
 * the sync manager. Returns `false` (no poll) when the realtime stream is up and
 * the tab is hidden, a long interval when the stream is up and the tab is
 * visible (a cheap backstop), and the cadence's base interval when the stream is
 * down. Keeps the existing `useQuery` call sites intact while removing their
 * fixed, always-on timers.
 */
export function useSyncCadence(cadence: CadenceClass): number | false {
  const { isConnected } = useRealtime();
  const visible = useSyncExternalStore(
    subscribeVisibility,
    readVisible,
    () => true,
  );

  return useMemo(() => {
    if (cadence === 'manual') return false;
    if (isConnected) {
      // Realtime covers freshness; poll only as a rare backstop when focused.
      return visible ? Math.max(CADENCE_BASE_MS.low, 180_000) : false;
    }
    const base = CADENCE_BASE_MS[cadence];
    return visible ? base : base * 4;
  }, [cadence, isConnected, visible]);
}
