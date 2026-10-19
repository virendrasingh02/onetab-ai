import { notificationApi, queryKeys } from '@org/api-client';
import type { NotificationView } from '@org/types';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter, type Href } from 'expo-router';
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  View,
} from 'react-native';
import {
  AppRefreshControl,
  Avatar,
  Divider,
  EmptyState,
  ErrorState,
  IconButton,
  ListRow,
  LoadingState,
} from '../../components/ui';
import { routeForDeepLink } from '../../lib/deep-links';
import { relativeTime } from '../../lib/format';
import { useWorkspace } from '../../lib/workspace';
import { useTheme } from '../../theme/theme';
import { maxContentWidth, spacing } from '../../theme/tokens';

export default function NotificationsScreen() {
  const { workspaceId } = useWorkspace();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colors } = useTheme();

  const list = useInfiniteQuery({
    queryKey: queryKeys.notifications.list(workspaceId),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      notificationApi.list(workspaceId, { cursor: pageParam, limit: 30 }),
    getNextPageParam: (page) =>
      page.hasMore ? (page.nextCursor ?? undefined) : undefined,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({
      queryKey: queryKeys.notifications.all(workspaceId),
    });
  };

  const markAll = useMutation({
    mutationFn: () => notificationApi.markAllRead(workspaceId),
    onSuccess: () => {
      invalidate();
      void Notifications.setBadgeCountAsync(0);
    },
  });

  const open = (item: NotificationView) => {
    if (!item.read)
      void notificationApi.markRead(workspaceId, item.id).then(invalidate);
    const route = routeForDeepLink(item.deepLink);
    if (route.pathname !== '/notifications') {
      router.push({ pathname: route.pathname, params: route.params } as Href);
    }
  };

  if (list.isPending) return <LoadingState label="Loading notifications…" />;
  if (list.error)
    return (
      <ErrorState error={list.error} onRetry={() => void list.refetch()} />
    );

  const items = list.data.pages.flatMap((p) => p.items);

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <IconButton
              icon="checkmark-done-outline"
              label="Mark all as read"
              onPress={() => markAll.mutate()}
              disabled={markAll.isPending}
            />
          ),
        }}
      />
      <FlatList
        data={items}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Divider}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetchingNextPage)
            void list.fetchNextPage();
        }}
        refreshControl={
          <AppRefreshControl
            refreshing={list.isRefetching}
            onRefresh={() => void list.refetch()}
            />
        }
        ListFooterComponent={
          list.isFetchingNextPage ? (
            <ActivityIndicator style={styles.footer} />
          ) : undefined
        }
        ListEmptyComponent={
          <EmptyState
            icon="notifications-off-outline"
            title="No notifications"
            description="Mentions, assignments and agent updates land here."
          />
        }
        renderItem={({ item }) => (
          <View
            style={
              !item.read
                ? { backgroundColor: colors.selected, borderRadius: 8 }
                : undefined
            }
          >
            <ListRow
              title={item.title}
              subtitle={[item.body, relativeTime(item.createdAt)]
                .filter(Boolean)
                .join(' · ')}
              right={
                item.actor ? (
                  <Avatar
                    name={item.actor.displayName || item.actor.name}
                    uri={item.actor.avatarUrl}
                    size={28}
                  />
                ) : null
              }
              chevron={false}
              onPress={() => open(item)}
            />
          </View>
        )}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    padding: spacing.lg,
  },
  footer: { marginVertical: spacing.lg },
});
