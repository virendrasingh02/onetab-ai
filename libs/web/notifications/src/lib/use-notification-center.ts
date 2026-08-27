import { notificationApi, queryKeys } from '@org/api-client';
import type { NotificationView, Paginated } from '@org/types';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

const PAGE_SIZE = 15;

/**
 * The bell badge count.
 *
 * Server-authoritative (`notification.readAt`), unlike the activity-feed badge
 * which is derived from a localStorage marker. Polled on an interval and on
 * window focus so a notification raised in another tab or by a teammate shows
 * up without a reload.
 */
export function useNotificationUnreadCount(workspaceId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(workspaceId ?? ''),
    queryFn: () => notificationApi.unreadCount(workspaceId as string),
    enabled: !!workspaceId,
    staleTime: 20_000,
    refetchInterval: 45_000,
    refetchOnWindowFocus: true,
    select: (data) => data.count,
  });
}

/** The paginated list behind the open bell menu. */
export function useNotificationList(
  workspaceId: string | undefined,
  options: { unreadOnly?: boolean; enabled?: boolean } = {},
) {
  const query = useInfiniteQuery({
    queryKey: queryKeys.notifications.list(
      workspaceId ?? '',
      options.unreadOnly ?? false,
    ),
    queryFn: ({ pageParam }) =>
      notificationApi.list(workspaceId as string, {
        cursor: pageParam as string | undefined,
        limit: PAGE_SIZE,
        unreadOnly: options.unreadOnly,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? (last.nextCursor ?? undefined) : undefined),
    enabled: !!workspaceId && options.enabled !== false,
    staleTime: 15_000,
  });

  const items = useMemo(
    () => query.data?.pages.flatMap((page) => page.items) ?? [],
    [query.data],
  );

  return { ...query, items };
}

type ListCache = InfiniteData<Paginated<NotificationView>> | undefined;

/**
 * Read / dismiss mutations, applied optimistically to every notification cache
 * (both the `all` and `unread` lists, and the badge count) and rolled back on
 * failure. `onSettled` re-syncs against the server.
 */
export function useNotificationMutations(workspaceId: string | undefined) {
  const qc = useQueryClient();
  const ws = workspaceId ?? '';

  const listKeys = useMemo(
    () => [
      queryKeys.notifications.list(ws, false),
      queryKeys.notifications.list(ws, true),
    ],
    [ws],
  );
  const countKey = useMemo(
    () => queryKeys.notifications.unreadCount(ws),
    [ws],
  );

  const patchLists = useCallback(
    (fn: (item: NotificationView) => NotificationView | null) => {
      for (const key of listKeys) {
        qc.setQueryData<ListCache>(key, (data) => {
          if (!data) return data;
          return {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items
                .map((item) => fn(item))
                .filter((item): item is NotificationView => item !== null),
            })),
          };
        });
      }
    },
    [qc, listKeys],
  );

  const bumpCount = useCallback(
    (delta: number) => {
      qc.setQueryData<{ count: number }>(countKey, (prev) =>
        prev ? { count: Math.max(0, prev.count + delta) } : prev,
      );
    },
    [qc, countKey],
  );

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: countKey });
    for (const key of listKeys) qc.invalidateQueries({ queryKey: key });
    // The Inbox feed and sidebar dots read the same underlying activity, so
    // keep them honest too.
    qc.invalidateQueries({ queryKey: queryKeys.notifications.feed(ws) });
  }, [qc, countKey, listKeys, ws]);

  const markRead = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(ws, id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: countKey });
      let wasUnread = false;
      patchLists((item) => {
        if (item.id !== id) return item;
        if (!item.read) wasUnread = true;
        return { ...item, read: true };
      });
      if (wasUnread) bumpCount(-1);
      return { wasUnread };
    },
    onError: () => invalidate(),
    onSettled: () => invalidate(),
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationApi.markAllRead(ws),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: countKey });
      patchLists((item) => (item.read ? item : { ...item, read: true }));
      qc.setQueryData<{ count: number }>(countKey, { count: 0 });
    },
    onError: () => invalidate(),
    onSettled: () => invalidate(),
  });

  const dismiss = useMutation({
    mutationFn: (id: string) => notificationApi.dismiss(ws, id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: countKey });
      let wasUnread = false;
      patchLists((item) => {
        if (item.id !== id) return item;
        if (!item.read) wasUnread = true;
        return null;
      });
      if (wasUnread) bumpCount(-1);
      return { wasUnread };
    },
    onError: () => invalidate(),
    onSettled: () => invalidate(),
  });

  return { markRead, markAllRead, dismiss };
}
