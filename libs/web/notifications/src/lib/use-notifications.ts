import { notificationApi, queryKeys } from '@org/api-client';
import type { NotificationPreference } from '@org/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
      input: Partial<Omit<NotificationPreference, 'id' | 'userId' | 'workspaceId'>>,
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
    mutationFn: ({ channelId, muted }: { channelId: string; muted: boolean }) => {
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

function seenKey(workspaceId: string) {
  return `${SEEN_KEY_PREFIX}${workspaceId}`;
}

function readSeenAt(workspaceId: string | undefined): string | null {
  if (!workspaceId || typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(seenKey(workspaceId));
  } catch {
    // Safari in private mode throws on every localStorage access.
    return null;
  }
}

function writeSeenAt(workspaceId: string, at: string) {
  try {
    window.localStorage.setItem(seenKey(workspaceId), at);
  } catch {
    // Nothing to do — the badge simply will not persist across reloads.
  }
  for (const listener of seenListeners) listener();
}

function subscribeSeen(listener: () => void) {
  seenListeners.add(listener);
  // `storage` fires only in *other* tabs, which is exactly the gap above.
  window.addEventListener('storage', listener);
  return () => {
    seenListeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
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
