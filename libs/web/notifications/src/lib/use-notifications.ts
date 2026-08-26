import { notificationApi, queryKeys } from '@org/api-client';
import type { ActivityFeedItem, NotificationPreference } from '@org/types';
import type { ActivityLevel } from '@org/ui';
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';

/** The centre lists a workspace's recent history, not its whole history. */
const FEED_LIMIT = 50;

/**
 * Activity is append-only and arrives from Matrix, so a short poll keeps the
 * bell honest without a socket. Long enough that an idle tab is cheap.
 */
const FEED_REFETCH_MS = 60_000;

export function useNotificationFeed(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.notifications.feed(workspaceId ?? ''),
    queryFn: () => notificationApi.feed(workspaceId as string, FEED_LIMIT),
    enabled: !!workspaceId,
    staleTime: 30_000,
    refetchInterval: FEED_REFETCH_MS,
  });
}

export function useNotificationPreferences(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.notifications.preferences(workspaceId ?? ''),
    queryFn: () => notificationApi.preferences(workspaceId as string),
    enabled: !!workspaceId,
  });
}

export function useNotificationPreferenceMutations(
  workspaceId: string | undefined,
) {
  const queryClient = useQueryClient();

  const update = useMutation({
    mutationFn: (
      input: Partial<
        Omit<NotificationPreference, 'id' | 'userId' | 'workspaceId'>
      >,
    ) => notificationApi.updatePreferences(workspaceId as string, input),
    /*
     * Muting a channel changes what the feed is allowed to return, so the feed
     * is invalidated alongside the preferences themselves.
     */
    onSuccess: (updated) => {
      queryClient.setQueryData(
        queryKeys.notifications.preferences(workspaceId ?? ''),
        updated,
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.feed(workspaceId ?? ''),
      });
    },
  });

  const toggleChannelMute = useMutation({
    mutationFn: ({
      channelId,
      muted,
    }: {
      channelId: string;
      muted: boolean;
    }) => {
      const current = queryClient.getQueryData<NotificationPreference>(
        queryKeys.notifications.preferences(workspaceId ?? ''),
      );
      const existing = current?.mutedChannelIds ?? [];
      const mutedChannelIds = muted
        ? [...new Set([...existing, channelId])]
        : existing.filter((id) => id !== channelId);

      return notificationApi.updatePreferences(workspaceId as string, {
        mutedChannelIds,
      });
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(
        queryKeys.notifications.preferences(workspaceId ?? ''),
        updated,
      );
      queryClient.invalidateQueries({
        queryKey: queryKeys.notifications.feed(workspaceId ?? ''),
      });
    },
  });

  return { update, toggleChannelMute };
}

export function usePushDevices() {
  return useQuery({
    queryKey: queryKeys.notifications.devices(),
    queryFn: () => notificationApi.devices(),
    staleTime: 5 * 60_000,
  });
}

export function usePushDeviceMutations() {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.notifications.devices(),
    });

  const register = useMutation({
    mutationFn: (input: Parameters<typeof notificationApi.registerDevice>[0]) =>
      notificationApi.registerDevice(input),
    onSuccess: invalidate,
  });

  const revoke = useMutation({
    mutationFn: (registrationId: string) =>
      notificationApi.revokeDevice(registrationId),
    onSuccess: invalidate,
  });

  return { register, revoke };
}

// ---------------------------------------------------------------------------
// Unread tracking
// ---------------------------------------------------------------------------

/*
 * The activity feed has no per-user read state — `recent_activity` is a
 * workspace-wide log, and giving every member a read receipt for every row
 * would cost a table an order of magnitude larger than the log itself.
 *
 * "Unread" is therefore derived on the client: anything that occurred after
 * the last time this browser opened the centre. It is stored per workspace so
 * switching workspaces does not clear the other's badge, and it is read
 * through `useSyncExternalStore` so every mounted bell updates together.
 */
const SEEN_KEY_PREFIX = 'onetab:notifications:seen:';

const seenListeners = new Set<() => void>();

/*
 * Bumped on every marker write so hooks that derive a *map* of markers have a
 * scalar to depend on. `useSyncExternalStore` requires a snapshot that is
 * reference-stable between changes, and a freshly built object never is.
 */
let seenVersion = 0;

/**
 * Markers are per workspace, and additionally per channel.
 *
 * The workspace marker is what the Inbox clears — it answers "have I looked at
 * this workspace's activity at all". The channel marker is set by opening the
 * channel, so reading one channel puts out that channel's dot without also
 * putting out its neighbours'.
 */
function seenKey(workspaceId: string, channelId?: string) {
  return channelId
    ? `${SEEN_KEY_PREFIX}${workspaceId}:c:${channelId}`
    : `${SEEN_KEY_PREFIX}${workspaceId}`;
}

function readSeenAt(
  workspaceId: string | undefined,
  channelId?: string,
): string | null {
  if (!workspaceId || typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(seenKey(workspaceId, channelId));
  } catch {
    // Safari in private mode throws on every localStorage access.
    return null;
  }
}

function notifySeenChanged() {
  seenVersion += 1;
  for (const listener of seenListeners) listener();
}

function writeSeenAt(workspaceId: string, at: string, channelId?: string) {
  try {
    window.localStorage.setItem(seenKey(workspaceId, channelId), at);
  } catch {
    // Nothing to do — the badge simply will not persist across reloads.
  }
  notifySeenChanged();
}

function subscribeSeen(listener: () => void) {
  seenListeners.add(listener);
  // `storage` fires only in *other* tabs, which is exactly the gap above.
  const onStorage = () => {
    seenVersion += 1;
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    seenListeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Re-renders whenever any seen marker changes, in this tab or another. */
function useSeenVersion(): number {
  return useSyncExternalStore(
    subscribeSeen,
    () => seenVersion,
    () => 0,
  );
}

export interface NotificationUnread {
  count: number;
  /** Marks everything currently in the feed as seen. */
  markAllSeen: () => void;
}

export function useNotificationUnread(
  workspaceId: string | undefined,
  feed: Array<{ occurredAt: string }> | undefined,
): NotificationUnread {
  const seenAt = useSyncExternalStore(
    subscribeSeen,
    () => readSeenAt(workspaceId),
    () => null,
  );

  /*
   * First visit in this browser: stamp the marker at the newest row already on
   * screen. Without it the badge would stay at zero forever, since "unread"
   * is defined relative to a marker that would never be written until the user
   * opened a centre they had no reason to open.
   */
  useEffect(() => {
    if (!workspaceId || seenAt || !feed) return;
    writeSeenAt(workspaceId, feed[0]?.occurredAt ?? new Date().toISOString());
  }, [workspaceId, seenAt, feed]);

  const count = useMemo(() => {
    if (!feed?.length || !seenAt) return 0;
    const seenTime = Date.parse(seenAt);
    if (Number.isNaN(seenTime)) return 0;
    return feed.filter((item) => Date.parse(item.occurredAt) > seenTime).length;
  }, [feed, seenAt]);

  const markAllSeen = useCallback(() => {
    if (!workspaceId) return;
    const newest = feed?.[0]?.occurredAt;
    writeSeenAt(workspaceId, newest ?? new Date().toISOString());
  }, [workspaceId, feed]);

  return { count, markAllSeen };
}

// ---------------------------------------------------------------------------
// Activity indicators
// ---------------------------------------------------------------------------

/**
 * What a single row in the sidebar should show.
 *
 * `level` is what the dot renders; the counts are there so a mention can carry
 * a number without the caller re-deriving it from the feed.
 */
export interface ActivityIndicator {
  level: ActivityLevel;
  count: number;
  mentionCount: number;
}

const NO_ACTIVITY: ActivityIndicator = {
  level: 'none',
  count: 0,
  mentionCount: 0,
};

/** Rows that landed after `seenAt`. A missing marker means nothing is unread. */
function unreadSince(
  items: ActivityFeedItem[] | undefined,
  seenAt: string | null,
): ActivityFeedItem[] {
  if (!items?.length || !seenAt) return [];
  const seenTime = Date.parse(seenAt);
  if (Number.isNaN(seenTime)) return [];
  return items.filter((item) => Date.parse(item.occurredAt) > seenTime);
}

function toIndicator(items: ActivityFeedItem[]): ActivityIndicator {
  if (!items.length) return NO_ACTIVITY;
  const mentionCount = items.filter((item) => item.isMention).length;
  return {
    level: mentionCount > 0 ? 'mention' : 'activity',
    count: items.length,
    mentionCount,
  };
}

/**
 * An indicator per workspace, including ones the user is not currently in.
 *
 * Every workspace's feed is fetched under the same query key and options the
 * current workspace already uses, so the workspace on screen costs nothing
 * extra — React Query serves it from the one cache entry rather than issuing a
 * second request with a conflicting refetch interval.
 */
export function useWorkspaceActivity(
  workspaceIds: string[],
): Record<string, ActivityIndicator> {
  const seenVersionValue = useSeenVersion();

  const feeds = useQueries({
    queries: workspaceIds.map((workspaceId) => ({
      queryKey: queryKeys.notifications.feed(workspaceId),
      queryFn: () => notificationApi.feed(workspaceId, FEED_LIMIT),
      staleTime: 30_000,
      refetchInterval: FEED_REFETCH_MS,
    })),
  });

  const feedData = feeds.map((query) => query.data);

  /*
   * Both `feeds` and `feedData` are rebuilt every render, and their length
   * changes as workspaces load, so neither can be a dependency: a spread
   * dependency array that changes size is a React error, and the arrays
   * themselves would recompute this on every render. `dataUpdatedAt` moves only
   * when a feed actually refetches, which is exactly when the answer can change.
   */
  const fingerprint = feeds.map((query) => query.dataUpdatedAt).join(',');
  const idsKey = workspaceIds.join(',');

  return useMemo(() => {
    const result: Record<string, ActivityIndicator> = {};
    workspaceIds.forEach((workspaceId, index) => {
      result[workspaceId] = toIndicator(
        unreadSince(feedData[index], readSeenAt(workspaceId)),
      );
    });
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey, fingerprint, seenVersionValue]);
}

/**
 * An indicator per channel of one workspace.
 *
 * A channel counts as read once the *channel's* own marker passes the row, or
 * once the workspace marker does — so both opening the channel and clearing the
 * Inbox put the dot out, and neither one silences the channels next to it.
 */
export function useChannelActivity(
  workspaceId: string | undefined,
  feed: ActivityFeedItem[] | undefined,
): Record<string, ActivityIndicator> {
  const seenVersionValue = useSeenVersion();

  return useMemo(() => {
    const result: Record<string, ActivityIndicator> = {};
    if (!workspaceId || !feed?.length) return result;

    const workspaceSeen = Date.parse(readSeenAt(workspaceId) ?? '');
    const channelSeen = new Map<string, number>();
    const grouped = new Map<string, ActivityFeedItem[]>();

    for (const item of feed) {
      const channelId = item.channel?.id;
      if (!channelId) continue;

      if (!channelSeen.has(channelId)) {
        const parsed = Date.parse(readSeenAt(workspaceId, channelId) ?? '');
        channelSeen.set(
          channelId,
          Math.max(
            Number.isNaN(parsed) ? 0 : parsed,
            Number.isNaN(workspaceSeen) ? 0 : workspaceSeen,
          ),
        );
      }

      const cutoff = channelSeen.get(channelId) ?? 0;
      // A zero cutoff means this browser has never stamped a marker; treating
      // the whole backlog as unread would light up every channel on first run.
      if (cutoff === 0 || Date.parse(item.occurredAt) <= cutoff) continue;

      const bucket = grouped.get(channelId);
      if (bucket) bucket.push(item);
      else grouped.set(channelId, [item]);
    }

    for (const [channelId, items] of grouped) {
      result[channelId] = toIndicator(items);
    }
    return result;
    /* `seenVersionValue` is not read in the body — the markers it stands for
       are, via `readSeenAt`. Dropping it would leave stale dots on screen after
       a channel is marked read, which is the one thing this must not do. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, feed, seenVersionValue]);
}

/**
 * Stamps a channel as read.
 *
 * Called when the channel page mounts, which is the moment the user has
 * actually seen what is in it.
 */
export function useMarkChannelSeen(workspaceId: string | undefined) {
  return useCallback(
    (channelId: string | undefined) => {
      if (!workspaceId || !channelId) return;
      writeSeenAt(workspaceId, new Date().toISOString(), channelId);
    },
    [workspaceId],
  );
}

/**
 * Stamps a channel as unread again — the inverse of `useMarkChannelSeen`.
 *
 * Backdates the channel's marker rather than clearing it: `useChannelActivity`
 * treats a cutoff of exactly zero (i.e. never stamped) as "don't light up the
 * whole backlog", so clearing the key here would silently do nothing whenever
 * the workspace-level marker is already caught up. `1` (one millisecond past
 * the epoch) is old enough that every real message sorts after it, while still
 * being a real, non-zero timestamp.
 */
export function useMarkChannelUnread(workspaceId: string | undefined) {
  return useCallback(
    (channelId: string | undefined) => {
      if (!workspaceId || !channelId) return;
      writeSeenAt(workspaceId, new Date(1).toISOString(), channelId);
    },
    [workspaceId],
  );
}
