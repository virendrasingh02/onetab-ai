import { queryKeys, syncApi } from '@org/api-client';
import type { SyncChangesDigest } from '@org/types';
import type { QueryClient } from '@tanstack/react-query';
import { classifyError } from './retry-policy.js';
import { syncMetrics } from './sync-metrics.js';

const cursorKey = (workspaceId: string) =>
  `onetab:sync:${workspaceId}:lastSyncedAt`;

export function readCursor(workspaceId: string): string | null {
  try {
    return localStorage.getItem(cursorKey(workspaceId));
  } catch {
    return null;
  }
}

export function writeCursor(workspaceId: string, iso: string): void {
  try {
    localStorage.setItem(cursorKey(workspaceId), iso);
  } catch {
    // Storage unavailable — catch-up still works, it just re-scans a wider
    // window next time.
  }
}

export interface CatchupResult {
  applied: number;
  /** The digest, when the endpoint answered; `null` on fallback. */
  digest: SyncChangesDigest | null;
  /** True when the endpoint was missing and a broad refresh was used instead. */
  fellBack: boolean;
}

export interface CatchupDeps {
  queryClient: QueryClient;
  /** Broad refresh used when the digest endpoint is unavailable. */
  fallbackRefresh: () => number;
}

/**
 * Incremental reconciliation after a gap in the realtime stream (reconnect,
 * resume from background, coming back online).
 *
 * Asks the API what changed in this workspace since the client's stored cursor
 * and invalidates only the affected query keys — never the whole cache. If the
 * endpoint is not deployed (404) it falls back to refreshing the active + high
 * priority resources via `fallbackRefresh`.
 */
export async function runCatchup(
  workspaceId: string,
  deps: CatchupDeps,
): Promise<CatchupResult> {
  const started =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  const since =
    readCursor(workspaceId) ??
    new Date(Date.now() - 10 * 60_000).toISOString();

  let digest: SyncChangesDigest;
  try {
    digest = await syncApi.changes(workspaceId, since);
  } catch (error) {
    const { status } = classifyError(error);
    if (status === 404) {
      const applied = deps.fallbackRefresh();
      syncMetrics.recordCatchup(
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) -
          started,
        applied,
      );
      return { applied, digest: null, fellBack: true };
    }
    throw error;
  }

  const applied = applyDigest(workspaceId, digest, deps.queryClient);
  writeCursor(workspaceId, digest.serverTime);
  syncMetrics.recordCatchup(
    (typeof performance !== 'undefined' ? performance.now() : Date.now()) -
      started,
    applied,
  );
  return { applied, digest, fellBack: false };
}

/**
 * Turns a digest into targeted `invalidateQueries` calls. Exported for tests.
 * Returns the number of query keys invalidated.
 */
export function applyDigest(
  workspaceId: string,
  digest: SyncChangesDigest,
  queryClient: QueryClient,
): number {
  if (digest.workspaceId !== workspaceId) return 0;
  const ws = workspaceId;
  const keys: unknown[][] = [];
  const push = (key: readonly unknown[]) => keys.push(key as unknown[]);

  const { changed } = digest;

  if (changed.channels.length > 0) {
    push(queryKeys.channels.all(ws));
  }
  if (changed.members.length > 0) {
    push(queryKeys.members.all(ws));
  }
  if (changed.notifications.length > 0 || digest.hasMore) {
    push(queryKeys.notifications.unreadCount(ws));
    push(queryKeys.notifications.feed(ws));
    push(queryKeys.notifications.list(ws, false));
    push(queryKeys.notifications.list(ws, true));
  }
  if (changed.tasks.length > 0) {
    push(['work-tools', ws, 'tasks']);
  }
  if (changed.projects.length > 0) {
    push(['work-tools', ws, 'projects']);
  }
  if (changed.meetings.length > 0) {
    push(['work-tools', ws, 'meetings']);
  }
  // A capped category means we might have missed rows — widen to a full
  // per-domain refresh so nothing is left stale.
  if (digest.hasMore) {
    push(queryKeys.channels.all(ws));
    push(queryKeys.members.all(ws));
    push(['work-tools', ws]);
  }

  for (const key of keys) {
    queryClient.invalidateQueries({ queryKey: key });
  }
  return keys.length;
}
