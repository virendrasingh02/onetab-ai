import Ionicons from '@expo/vector-icons/Ionicons';
import { channelApi, queryKeys } from '@org/api-client';
import type { ChannelSummary } from '@org/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { Alert } from '../../../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AppText,
  Badge,
  Button,
  Divider,
  EmptyState,
  ErrorState,
  ListRow,
  LoadingState,
  TextField,
} from '../../../components/ui';
import {
  directRoomTitle,
  displayNameOf,
  recordAcceptedInvite,
  type DirectRoom,
} from '../../../lib/direct-rooms';
import { relativeTime } from '../../../lib/format';
import { directRoomsKey, useDirectRooms } from '../../../lib/use-direct-rooms';
import { useMatrixClient } from '../../../lib/use-matrix';
import { useWorkspace } from '../../../lib/workspace';
import { useTheme } from '../../../theme/theme';
import { maxContentWidth, radius, spacing } from '../../../theme/tokens';

type Segment = 'channels' | 'dms';

export default function ChatTab() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [segment, setSegment] = useState<Segment>(
    tab === 'dms' ? 'dms' : 'channels',
  );
  useEffect(() => {
    if (tab === 'dms' || tab === 'channels') setSegment(tab);
  }, [tab]);
  const { colors } = useTheme();

  return (
    <SafeAreaView
      edges={[]}
      style={[styles.flex, { backgroundColor: colors.background }]}
    >
      <View style={styles.segmentsWrap}>
        <View
          style={[styles.segments, { backgroundColor: colors.accent }]}
          accessibilityRole="tablist"
        >
          {(
            [
              ['channels', 'Channels'],
              ['dms', 'Direct messages'],
            ] as const
          ).map(([value, label]) => {
            const active = segment === value;
            return (
              <Pressable
                key={value}
                onPress={() => setSegment(value)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[
                  styles.segment,
                  active ? { backgroundColor: colors.card } : null,
                ]}
              >
                <AppText
                  variant="label"
                  style={{
                    color: active ? colors.foreground : colors.mutedForeground,
                  }}
                >
                  {label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
      {segment === 'channels' ? <ChannelList /> : <DirectMessageList />}
    </SafeAreaView>
  );
}

function ChannelList() {
  const { workspaceId } = useWorkspace();
  const router = useRouter();
  const { colors } = useTheme();
  const [filter, setFilter] = useState('');

  const query = useQuery({
    queryKey: queryKeys.channels.list(workspaceId, false),
    queryFn: () => channelApi.list(workspaceId, false),
  });

  const channels = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return (query.data ?? [])
      .filter(
        (c) =>
          !c.isArchived && (!needle || c.name.toLowerCase().includes(needle)),
      )
      .sort((a, b) => {
        // Favourites, then channels I am in, then the rest to browse.
        const rank = (c: ChannelSummary) =>
          c.membership?.isFavorite ? 0 : c.membership ? 1 : 2;
        return rank(a) - rank(b) || a.name.localeCompare(b.name);
      });
  }, [query.data, filter]);

  if (query.isPending) return <LoadingState label="Loading channels…" />;
  if (query.error)
    return (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} />
    );

  return (
    <FlatList
      data={channels}
      keyExtractor={(c) => c.id}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={Divider}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          tintColor={colors.primaryText}
        />
      }
      ListHeaderComponent={
        <View style={styles.search}>
          <TextField
            placeholder="Find a channel"
            value={filter}
            onChangeText={setFilter}
            accessibilityLabel="Find a channel"
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          icon="chatbubbles-outline"
          title="No channels"
          description="Channels you can see in this workspace appear here."
        />
      }
      renderItem={({ item }) => (
        <ListRow
          title={`# ${item.name}`}
          subtitle={
            item.topic ?? item.description ?? `${item.memberCount} members`
          }
          right={
            <View style={styles.badges}>
              {item.visibility === 'PRIVATE' ? (
                <Ionicons name="lock-closed" size={14} color={colors.subtle} />
              ) : null}
              {item.membership?.isMuted ? (
                <Ionicons
                  name="notifications-off-outline"
                  size={14}
                  color={colors.subtle}
                />
              ) : null}
              {!item.membership ? <Badge label="Join" tone="info" /> : null}
            </View>
          }
          onPress={() =>
            router.push({
              pathname: '/channel/[slug]',
              params: { slug: item.slug },
            })
          }
        />
      )}
    />
  );
}

function DirectMessageList() {
  const router = useRouter();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const matrix = useMatrixClient();
  const query = useDirectRooms(matrix.client);
  const [filter, setFilter] = useState('');
  const [opening, setOpening] = useState<string | null>(null);

  // No timer: the list refreshes whenever the tab comes back into view.
  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const rooms = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return (query.data ?? []).filter(
      (r) => !needle || directRoomTitle(r).toLowerCase().includes(needle),
    );
  }, [query.data, filter]);

  const open = async (room: DirectRoom) => {
    const client = matrix.client;
    if (!client) return;
    if (room.membership === 'invite') {
      setOpening(room.roomId);
      try {
        await client.join(room.roomId);
        await recordAcceptedInvite(client, room);
        void queryClient.invalidateQueries({
          queryKey: directRoomsKey(client.userId),
        });
      } catch (error) {
        Alert.alert(
          'Could not join',
          error instanceof Error ? error.message : 'Try again.',
        );
        return;
      } finally {
        setOpening(null);
      }
    }
    router.push({ pathname: '/dm/[roomId]', params: { roomId: room.roomId } });
  };

  if (matrix.isPending || (matrix.client && query.isPending))
    return <LoadingState label="Loading conversations…" />;
  if (matrix.error || query.error)
    return (
      <ErrorState
        error={matrix.error ?? query.error}
        onRetry={() => {
          void matrix.refetch();
          void query.refetch();
        }}
      />
    );
  if (!matrix.client)
    return (
      <EmptyState
        icon="chatbubbles-outline"
        title="Chat isn't set up on this server"
        description="Ask your workspace admin to enable messaging."
      />
    );

  return (
    <FlatList
      data={rooms}
      keyExtractor={(r) => r.roomId}
      contentContainerStyle={styles.list}
      ItemSeparatorComponent={Divider}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          tintColor={colors.primaryText}
        />
      }
      ListHeaderComponent={
        <View style={styles.search}>
          <TextField
            placeholder="Find a conversation"
            value={filter}
            onChangeText={setFilter}
            accessibilityLabel="Find a conversation"
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          <Button
            label="New message"
            icon="create-outline"
            variant="secondary"
            onPress={() => router.push('/dm/new')}
          />
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          icon="chatbubble-outline"
          title="No direct messages"
          description="Start a conversation with one person or a small group."
        />
      }
      renderItem={({ item }) => {
        const title = directRoomTitle(item);
        const avatarId = item.kind === 'direct' ? item.peers[0] : undefined;
        const preview = subtitleFor(item);
        return (
          <ListRow
            title={title}
            subtitle={preview}
            avatar={{
              name: title,
              uri: avatarId
                ? matrix.client?.mediaUrl(item.avatars[avatarId], {
                    width: 72,
                    height: 72,
                  })
                : null,
              headers: matrix.client?.authHeaders,
            }}
            onPress={() => void open(item)}
            right={
              <View style={styles.badges}>
                {item.encrypted ? (
                  <Ionicons
                    name="lock-closed"
                    size={14}
                    color={colors.subtle}
                    accessibilityLabel="End-to-end encrypted"
                  />
                ) : null}
                {item.kind === 'group' ? (
                  <Ionicons
                    name="people-outline"
                    size={16}
                    color={colors.subtle}
                    accessibilityLabel="Group"
                  />
                ) : null}
                {opening === item.roomId ? (
                  <Badge label="Joining…" tone="info" />
                ) : item.membership === 'invite' ? (
                  <Badge label="Invite" tone="info" />
                ) : item.unread ? (
                  <Badge
                    label={String(item.unread)}
                    tone={item.highlight ? 'danger' : 'info'}
                  />
                ) : null}
              </View>
            }
          />
        );
      }}
    />
  );
}

function subtitleFor(room: DirectRoom): string | null {
  if (room.membership === 'invite') {
    return room.inviter
      ? `${displayNameOf(room, room.inviter)} invited you`
      : 'Invitation';
  }
  const last = room.lastMessage;
  if (!last) return room.encrypted ? 'Encrypted conversation' : null;
  const who =
    room.kind === 'group' ? `${displayNameOf(room, last.sender)}: ` : '';
  return `${who}${last.body} · ${relativeTime(new Date(last.ts).toISOString())}`;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  segmentsWrap: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  segments: { flexDirection: 'row', padding: 3, borderRadius: radius.lg },
  segment: {
    flex: 1,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  list: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  search: { paddingVertical: spacing.md, gap: spacing.sm },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
