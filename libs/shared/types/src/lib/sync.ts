import type { IsoDateString } from './entities.js';

/**
 * One changed row in a {@link SyncChangesDigest}. Deliberately minimal — an id
 * and a timestamp are enough for the client to decide which cached query to
 * invalidate; the full row is fetched lazily by the query that gets refreshed.
 */
export interface SyncResourceChange {
  id: string;
  updatedAt: IsoDateString;
}

/**
 * The incremental "what changed since I last synced" payload, returned by
 * `GET /workspaces/:workspaceId/sync/changes?since=<ISO>`.
 *
 * Used on realtime reconnect and on resume-from-background so the client can do
 * a targeted reconciliation instead of invalidating its entire cache.
 */
export interface SyncChangesDigest {
  workspaceId: string;
  /** Echoes the `since` the client sent (or the server's cap if it was too old). */
  since: IsoDateString;
  /** Authoritative server clock at the moment the digest was built. */
  serverTime: IsoDateString;
  /** True when a category hit its row cap — the client should do a full refetch. */
  hasMore: boolean;
  changed: {
    channels: SyncResourceChange[];
    members: SyncResourceChange[];
    notifications: SyncResourceChange[];
    tasks: SyncResourceChange[];
    projects: SyncResourceChange[];
    meetings: SyncResourceChange[];
  };
  /** The caller's current unread notification total for this workspace. */
  unreadCount: number;
}

/**
 * A lightweight snapshot of the counts the shell shows, for a cheap "are my
 * badges right?" reconciliation without pulling any lists.
 */
export interface SyncState {
  workspaceId: string;
  serverTime: IsoDateString;
  unreadCount: number;
  mentionCount: number;
}
