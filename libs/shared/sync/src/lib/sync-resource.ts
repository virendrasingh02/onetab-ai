import type { QueryKey } from '@tanstack/react-query';

/**
 * How often a resource needs a scheduled poll, *independent* of the realtime
 * stream. The manager always prefers a realtime event or an incremental
 * catch-up; a poll is the fallback for when neither is available.
 *
 * - `realtime` — the resource has a realtime channel and never needs a timer
 *   while the socket is connected. It still gets a poll when the socket is
 *   down (at the `low` cadence) so it does not go completely stale.
 * - `high` — user-facing and time-sensitive (unread counts, the open inbox).
 *   ~30 s while the tab is focused, backed right off while hidden.
 * - `low` — background context that can lag a few minutes (version banners,
 *   the activity digest). Effectively paused while the tab is hidden.
 * - `manual` — only ever refreshed by an explicit user action / catch-up.
 */
export type CadenceClass = 'realtime' | 'high' | 'low' | 'manual';

/** Ordering for reconciliation — `active` resources are refreshed first. */
export type SyncPriority = 'active' | 'high' | 'low';

export type SyncPhase =
  | 'synced'
  | 'syncing'
  | 'reconnecting'
  | 'offline'
  | 'error';

/** Base poll interval per cadence class, in milliseconds, for a focused tab. */
export const CADENCE_BASE_MS: Record<CadenceClass, number> = {
  realtime: 45_000,
  high: 30_000,
  low: 240_000,
  manual: Number.POSITIVE_INFINITY,
};

/**
 * A unit of background-synchronised server state.
 *
 * Feature code registers one of these per query it wants kept fresh instead of
 * hand-rolling a `refetchInterval`. The manager owns the single timer that
 * decides when any of them is due, and it never fires one for a workspace other
 * than the active one.
 */
export interface SyncResource {
  /** Stable id, unique per mounted consumer (e.g. `notifications-feed:<wsId>`). */
  id: string;
  /**
   * The workspace this resource belongs to. The manager asserts (in dev) that
   * `queryKey` contains this value, and never invalidates the key while a
   * different workspace is active.
   */
  workspaceId: string;
  /** Coarse label for metrics / debugging (`notifications`, `channels`, …). */
  resourceType: string;
  /** The TanStack Query key to invalidate when the resource is due. */
  queryKey: QueryKey;
  cadence: CadenceClass;
  priority: SyncPriority;
  /**
   * Realtime event types that already keep this resource fresh. While the
   * socket is connected the scheduler suppresses this resource's poll entirely
   * if the list is non-empty.
   */
  realtimeEvents: string[];
  /** Registered but paused — kept in the registry, never scheduled. */
  enabled: boolean;
}

export interface RegisterResourceInput {
  id: string;
  workspaceId: string;
  resourceType: string;
  queryKey: QueryKey;
  cadence: CadenceClass;
  priority?: SyncPriority;
  realtimeEvents?: string[];
  enabled?: boolean;
}

export function normalizeResource(input: RegisterResourceInput): SyncResource {
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    resourceType: input.resourceType,
    queryKey: input.queryKey,
    cadence: input.cadence,
    priority: input.priority ?? (input.cadence === 'high' ? 'high' : 'low'),
    realtimeEvents: input.realtimeEvents ?? [],
    enabled: input.enabled ?? true,
  };
}

/**
 * Whether `queryKey` visibly carries `workspaceId`. Used as a dev-time guard so
 * a mis-scoped key can never leak one workspace's data into another's cache.
 */
export function queryKeyMentionsWorkspace(
  queryKey: QueryKey,
  workspaceId: string,
): boolean {
  if (!workspaceId) return true;
  return queryKey.some((part) => part === workspaceId);
}
