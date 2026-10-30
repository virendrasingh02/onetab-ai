import Ionicons from '@expo/vector-icons/Ionicons';
import {
  channelApi,
  coworkersApi,
  queryKeys,
} from '@org/api-client';
import type { ChannelSummary, CoworkerRosterEntry } from '@org/types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Stack,
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Alert } from '../../../../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { showActionSheet } from '../../../../components/action-sheet';
import { NotificationsBell } from '../../../../components/navigation';
import {
  AppRefreshControl,
  AppText,
  Badge,
  Button,
  Divider,
  EmptyState,
  IconButton,
  ListRow,
  LoadingState,
  TextField,
} from '../../../../components/ui';
import { useChatPreferences } from '../../../../lib/chat-preferences';
import {
  directRoomTitle,
  displayNameOf,
  recordAcceptedInvite,
  type DirectRoom,
} from '../../../../lib/direct-rooms';
import { formatChatTime } from '../../../../lib/format';
import { haptics } from '../../../../lib/haptics';
import {
  directRoomsKey,
  useDirectRooms,
} from '../../../../lib/use-direct-rooms';
import { useMatrixClient } from '../../../../lib/use-matrix';
import { useWorkspace } from '../../../../lib/workspace';
import { useTheme } from '../../../../theme/theme';
import { maxContentWidth, radius, spacing } from '../../../../theme/tokens';

export type ChatFilterChip = 'all' | 'unread' | 'channels' | 'dms' | 'ai';

const CHIPS: Array<{ id: ChatFilterChip; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'dms', label: 'Direct' },
  { id: 'channels', label: 'Channels' },
  { id: 'ai', label: 'AI Agents' },
];

const nativeSearch = Platform.OS !== 'web';

export default function ChatTab() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const [filterChip, setFilterChip] = useState<ChatFilterChip>(
    tab === 'dms' ? 'dms' : tab === 'channels' ? 'channels' : 'all',
  );
  useEffect(() => {
    if (tab === 'dms') setFilterChip('dms');
    else if (tab === 'channels') setFilterChip('channels');
  }, [tab]);

  const { colors } = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { workspaceId, workspace } = useWorkspace();
  const [search, setSearch] = useState('');
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);

  // Chat preferences (pin, mute, archive)
  const chatPrefs = useChatPreferences(workspaceId);

  // 1. Matrix Direct Rooms
  const matrix = useMatrixClient();
  const directRoomsQuery = useDirectRooms(matrix.client);

  // 2. Channels
  const channelsQuery = useQuery({
    queryKey: queryKeys.channels.list(workspaceId, false),
    queryFn: () => channelApi.list(workspaceId, false),
  });

  // 3. AI Coworkers
  const coworkersQuery = useQuery({
    queryKey: ['mobile', 'coworkers-roster', workspaceId],
    queryFn: () => coworkersApi.roster(workspaceId).catch(() => null),
  });

  const { refetch: refetchDirectRooms } = directRoomsQuery;
  const { refetch: refetchChannels } = channelsQuery;

  useFocusEffect(
    useCallback(() => {
      void refetchDirectRooms();
      void refetchChannels();
    }, [refetchDirectRooms, refetchChannels]),
  );

  const openDirectRoom = useCallback(
    async (room: DirectRoom) => {
      const client = matrix.client;
      if (!client) return;
      if (room.membership === 'invite') {
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
        }
      }
      router.push({ pathname: '/dm/[roomId]', params: { roomId: room.roomId } });
    },
    [matrix.client, queryClient, router],
  );

  const openChannel = useCallback(
    (channel: ChannelSummary) => {
      router.push({
        pathname: '/channel/[slug]',
        params: { slug: channel.slug },
      });
    },
    [router],
  );

  // Context menu for long-pressing conversation item
  const handleLongPress = useCallback(
    (id: string, name: string, isChannel: boolean) => {
      haptics.medium();
      const isPinned = chatPrefs.isPinned(id);
      const isMuted = chatPrefs.isMuted(id);
      const isArchived = chatPrefs.isArchived(id);

      showActionSheet({
        title: name,
        options: [
          {
            label: isPinned ? 'Unpin chat' : 'Pin chat to top',
            icon: isPinned ? 'pin-outline' : 'pin',
            onPress: () => {
              void chatPrefs.togglePin(id);
              haptics.selection();
            },
          },
          {
            label: isMuted ? 'Unmute notifications' : 'Mute notifications',
            icon: isMuted ? 'volume-high-outline' : 'volume-mute-outline',
            onPress: () => {
              void chatPrefs.toggleMute(id);
              haptics.selection();
            },
          },
          {
            label: isArchived ? 'Unarchive chat' : 'Archive chat',
            icon: isArchived ? 'archive-outline' : 'archive',
            onPress: () => {
              void chatPrefs.toggleArchive(id);
              haptics.selection();
            },
          },
          ...(isChannel
            ? [
                {
                  label: 'Channel details',
                  icon: 'information-circle-outline' as const,
                  onPress: () => {
                    router.push({
                      pathname: '/channel/[slug]',
                      params: { slug: id },
                    });
                  },
                },
              ]
            : []),
        ],
      });
    },
    [chatPrefs, router],
  );

  // Filtered and Sorted Conversation Unified List
  const conversationItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    const items: Array<{
      id: string;
      title: string;
      subtitle: string;
      avatarName: string;
      avatarUri?: string | null;
      timestamp: number | string;
      unread: number;
      isPinned: boolean;
      isMuted: boolean;
      isArchived: boolean;
      isChannel: boolean;
      isDirect: boolean;
      isAI: boolean;
      onPress: () => void;
      onLongPress: () => void;
      deliveryState?: 'sending' | 'sent' | 'read';
    }> = [];

    // Add Direct Rooms
    const directRooms = directRoomsQuery.data ?? [];
    for (const r of directRooms) {
      const title = directRoomTitle(r);
      const isPinned = chatPrefs.isPinned(r.roomId);
      const isMuted = chatPrefs.isMuted(r.roomId);
      const isArchived = chatPrefs.isArchived(r.roomId);
      const last = r.lastMessage;
      const subtitle = last
        ? `${r.kind === 'group' ? `${displayNameOf(r, last.sender)}: ` : ''}${last.body}`
        : r.encrypted
          ? 'End-to-end encrypted'
          : 'Direct message';
      const avatarId = r.kind === 'direct' ? r.peers[0] : undefined;
      const avatarUri = avatarId
        ? matrix.client?.mediaUrl(r.avatars[avatarId], {
            width: 72,
            height: 72,
          })
        : null;

      const isMine = last?.sender === matrix.client?.userId;
      const deliveryState = isMine
        ? r.unread > 0
          ? 'sent'
          : 'read'
        : undefined;

      items.push({
        id: r.roomId,
        title,
        subtitle,
        avatarName: title,
        avatarUri,
        timestamp: last?.ts || r.lastActivity || 0,
        unread: r.unread,
        isPinned,
        isMuted,
        isArchived,
        isChannel: false,
        isDirect: true,
        isAI: false,
        onPress: () => void openDirectRoom(r),
        onLongPress: () => handleLongPress(r.roomId, title, false),
        deliveryState,
      });
    }

    // Add Channels
    const channels = channelsQuery.data ?? [];
    for (const c of channels) {
      if (c.isArchived) continue;
      const isPinned = chatPrefs.isPinned(c.slug);
      const isMuted = chatPrefs.isMuted(c.slug) || Boolean(c.membership?.isMuted);
      const isArchived = chatPrefs.isArchived(c.slug);
      const unreadCount = 0;
      const subtitle = c.topic ?? c.description ?? `${c.memberCount} members`;

      items.push({
        id: c.slug,
        title: `# ${c.name}`,
        subtitle,
        avatarName: c.name,
        avatarUri: null,
        timestamp: c.createdAt || 0,
        unread: unreadCount,
        isPinned,
        isMuted,
        isArchived,
        isChannel: true,
        isDirect: false,
        isAI: false,
        onPress: () => openChannel(c),
        onLongPress: () => handleLongPress(c.slug, `# ${c.name}`, true),
      });
    }

    // Add AI Coworkers
    const coworkers = coworkersQuery.data?.coworkers ?? [];
    for (const cw of coworkers) {
      const isPinned = chatPrefs.isPinned(`cw:${cw.id}`);
      const isMuted = chatPrefs.isMuted(`cw:${cw.id}`);
      const isArchived = chatPrefs.isArchived(`cw:${cw.id}`);

      items.push({
        id: `cw:${cw.id}`,
        title: `${cw.name} 🤖`,
        subtitle: `${cw.role || 'AI Coworker'} · Tap to message`,
        avatarName: cw.name,
        avatarUri: cw.avatarUrl,
        timestamp: 0,
        unread: 0,
        isPinned,
        isMuted,
        isArchived,
        isChannel: false,
        isDirect: false,
        isAI: true,
        onPress: () => {
          // Open coworker details and tasks dashboard
          router.push({
            pathname: '/coworker/[coworkerId]',
            params: { coworkerId: cw.id },
          });
        },
        onLongPress: () => handleLongPress(`cw:${cw.id}`, cw.name, false),
      });
    }

    // Apply Filter Chips
    let filtered = items;
    if (filterChip === 'unread') {
      filtered = filtered.filter((i) => i.unread > 0);
    } else if (filterChip === 'channels') {
      filtered = filtered.filter((i) => i.isChannel);
    } else if (filterChip === 'dms') {
      filtered = filtered.filter((i) => i.isDirect);
    } else if (filterChip === 'ai') {
      filtered = filtered.filter((i) => i.isAI);
    }

    // Apply Search Query
    if (q) {
      filtered = filtered.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.subtitle.toLowerCase().includes(q),
      );
    }

    // Sort: Pinned first, then by timestamp descending
    return filtered.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      const timeA = new Date(a.timestamp).getTime();
      const timeB = new Date(b.timestamp).getTime();
      return timeB - timeA;
    });
  }, [
    directRoomsQuery.data,
    channelsQuery.data,
    coworkersQuery.data,
    filterChip,
    search,
    chatPrefs,
    matrix.client,
    openDirectRoom,
    openChannel,
    handleLongPress,
    router,
  ]);

  const isRefreshing =
    directRoomsQuery.isRefetching ||
    channelsQuery.isRefetching ||
    coworkersQuery.isRefetching;

  const handleRefresh = () => {
    void refetchDirectRooms();
    void refetchChannels();
    void coworkersQuery.refetch();
  };

  return (
    <SafeAreaView
      edges={[]}
      style={[styles.flex, { backgroundColor: colors.background }]}
    >
      <Stack.Screen
        options={{
          headerTitle: workspace?.name ? `${workspace.name}` : 'Chats',
          headerRight: () => (
            <View style={styles.headerActions}>
              <IconButton
                icon="create-outline"
                label="New message"
                onPress={() => setNewChatModalOpen(true)}
              />
              <NotificationsBell />
            </View>
          ),
          headerSearchBarOptions: nativeSearch
            ? {
                placeholder: 'Search chats & messages',
                autoCapitalize: 'none',
                hideWhenScrolling: false,
                onChangeText: (event) => setSearch(event.nativeEvent.text),
                onCancelButtonPress: () => setSearch(''),
              }
            : undefined,
        }}
      />

      {/* WhatsApp Filter Chips Row */}
      <View style={styles.chipsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {CHIPS.map((chip) => {
            const active = filterChip === chip.id;
            return (
              <Pressable
                key={chip.id}
                onPress={() => {
                  haptics.selection();
                  setFilterChip(chip.id);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.card,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <AppText
                  variant="label"
                  style={{
                    color: active
                      ? colors.primaryForeground
                      : colors.mutedForeground,
                    fontSize: 13,
                  }}
                >
                  {chip.label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Inline Search fallback for web */}
      {!nativeSearch ? (
        <View style={styles.searchWrap}>
          <TextField
            placeholder="Search chats..."
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
        </View>
      ) : null}

      {/* Conversation List */}
      <FlatList
        data={conversationItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={Divider}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <AppRefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
          />
        }
        ListEmptyComponent={
          directRoomsQuery.isPending && channelsQuery.isPending ? (
            <LoadingState label="Loading chats…" />
          ) : (
            <EmptyState
              icon="chatbubbles-outline"
              title={search ? 'No matching conversations' : 'No chats yet'}
              description={
                search
                  ? `Nothing matches "${search.trim()}".`
                  : 'Start a direct message, talk to an AI coworker, or browse channels.'
              }
              action={
                search ? undefined : (
                  <Button
                    label="Start a conversation"
                    icon="create-outline"
                    onPress={() => setNewChatModalOpen(true)}
                  />
                )
              }
            />
          )
        }
        renderItem={({ item }) => {
          const timeLabel = formatChatTime(item.timestamp);
          return (
            <ListRow
              title={item.title}
              subtitle={item.subtitle}
              avatar={{
                name: item.avatarName,
                uri: item.avatarUri,
                headers: matrix.client?.authHeaders,
              }}
              onPress={item.onPress}
              onLongPress={item.onLongPress}
              right={
                <View style={styles.rowRight}>
                  {timeLabel ? (
                    <AppText
                      variant="caption"
                      style={[
                        styles.timeText,
                        item.unread > 0
                          ? { color: colors.primaryText, fontWeight: '600' }
                          : undefined,
                      ]}
                    >
                      {timeLabel}
                    </AppText>
                  ) : null}

                  <View style={styles.badgeRow}>
                    {item.isPinned ? (
                      <Ionicons
                        name="pin"
                        size={14}
                        color={colors.subtle}
                        style={styles.metaIcon}
                      />
                    ) : null}

                    {item.isMuted ? (
                      <Ionicons
                        name="notifications-off-outline"
                        size={14}
                        color={colors.subtle}
                        style={styles.metaIcon}
                      />
                    ) : null}

                    {item.deliveryState === 'sending' ? (
                      <Ionicons
                        name="time-outline"
                        size={13}
                        color={colors.subtle}
                      />
                    ) : item.deliveryState === 'sent' ? (
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={colors.subtle}
                      />
                    ) : item.deliveryState === 'read' ? (
                      <Ionicons
                        name="checkmark-done"
                        size={15}
                        color={colors.primaryText}
                      />
                    ) : null}

                    {item.unread > 0 ? (
                      <View
                        style={[
                          styles.unreadBadge,
                          { backgroundColor: colors.primary },
                        ]}
                      >
                        <AppText
                          variant="caption"
                          style={{
                            color: colors.primaryForeground,
                            fontWeight: '700',
                            fontSize: 11,
                          }}
                        >
                          {item.unread > 99 ? '99+' : item.unread}
                        </AppText>
                      </View>
                    ) : null}
                  </View>
                </View>
              }
            />
          );
        }}
      />

      {/* WhatsApp-style Floating Action Button for New Chat */}
      <Pressable
        onPress={() => {
          haptics.selection();
          setNewChatModalOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel="New conversation"
        style={[
          styles.fab,
          {
            backgroundColor: colors.primary,
            shadowColor: '#000',
          },
        ]}
      >
        <Ionicons
          name="chatbubble-ellipses"
          size={24}
          color={colors.primaryForeground}
        />
      </Pressable>

      {/* New Conversation Modal */}
      <NewChatSheet
        visible={newChatModalOpen}
        onClose={() => setNewChatModalOpen(false)}
        coworkers={coworkersQuery.data?.coworkers ?? []}
      />
    </SafeAreaView>
  );
}

function NewChatSheet({
  visible,
  onClose,
  coworkers,
}: {
  visible: boolean;
  onClose: () => void;
  coworkers: CoworkerRosterEntry[];
}) {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <SafeAreaView edges={['bottom']} style={styles.sheetContent}>
          <View
            style={[
              styles.sheetCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.sheetHeader}>
              <AppText variant="heading">Start a conversation</AppText>
              <IconButton icon="close" label="Close" onPress={onClose} />
            </View>

            <ListRow
              icon="person-add-outline"
              title="New direct message"
              subtitle="Message any team member"
              onPress={() => {
                onClose();
                router.push('/dm/new');
              }}
            />
            <Divider />
            <ListRow
              icon="sparkles-outline"
              title="New custom agent"
              subtitle="Configure an autonomous task agent"
              onPress={() => {
                onClose();
                router.push('/agent/new');
              }}
            />

            {coworkers.length > 0 ? (
              <>
                <Divider />
                <View style={styles.coworkerHeader}>
                  <AppText variant="label" style={{ color: colors.mutedForeground }}>
                    AI COWORKERS
                  </AppText>
                </View>
                {coworkers.slice(0, 4).map((cw) => (
                  <ListRow
                    key={cw.id}
                    avatar={{ name: cw.name, uri: cw.avatarUrl }}
                    title={cw.name}
                    subtitle={cw.role || 'Autonomous Coworker'}
                    right={<Badge label="Online" tone="success" />}
                    onPress={() => {
                      onClose();
                      router.push({
                        pathname: '/coworker/[coworkerId]',
                        params: { coworkerId: cw.id },
                      });
                    }}
                  />
                ))}
              </>
            ) : null}
          </View>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  chipsWrap: {
    paddingVertical: spacing.sm,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
  chipsScroll: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchWrap: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
  list: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingBottom: 80,
  },
  rowRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
    minWidth: 64,
  },
  timeText: {
    fontSize: 12,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaIcon: {
    opacity: 0.8,
  },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContent: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
  sheetCard: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
  coworkerHeader: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
});
