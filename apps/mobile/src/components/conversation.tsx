import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Alert } from '../lib/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  downloadAndShare,
  pickFile,
  uploadToMatrix,
  type PickSource,
} from '../lib/files';
import { formatBytes } from '../lib/format';
import { haptics } from '../lib/haptics';
import {
  localpartOf,
  MatrixError,
  mediaMessageContent,
  newTxnId,
  threadReplyContent,
  toTimeline,
  type MatrixEvent,
  type MatrixRestClient,
  type Reaction,
  type TimelineItem,
} from '../lib/matrix';
import { useAuthedImageSource } from '../lib/use-authed-uri';
import { useRoomTimeline } from '../lib/use-room-timeline';
import { useTheme } from '../theme/theme';
import { showActionSheet } from './action-sheet';
import { useKeyboardAvoidingProps } from './navigation';
import { maxContentWidth, radius, spacing } from '../theme/tokens';
import {
  AppText,
  Avatar,
  EmptyState,
  ErrorState,
  IconButton,
  keyboardDismissMode,
  LoadingState,
} from './ui';

/** The quick set offered on long-press; the web picker has the full list. */
const QUICK_REACTIONS = ['👍', '❤️', '😂', '🎉', '👀', '✅'];

interface PendingItem extends TimelineItem {
  /** Set once the homeserver accepted it; hidden when sync delivers it. */
  eventId?: string;
}

/**
 * One room's conversation — a channel, a DM, a group DM, or (with
 * `threadRootId`) one thread inside any of those. Kept live by the room-scoped
 * `/sync` loop while the screen is focused.
 */
export function Conversation({
  client,
  roomId,
  threadRootId,
  canPost = true,
  readOnlyHint = 'Only admins can post in this channel.',
  allowFiles = true,
  onRead,
  onOpenThread,
  onSessionInvalid,
}: {
  client: MatrixRestClient;
  roomId: string;
  threadRootId?: string;
  canPost?: boolean;
  readOnlyHint?: string;
  allowFiles?: boolean;
  /** Extra read bookkeeping (the channel API's own unread state). */
  onRead?: () => void;
  onOpenThread?: (rootId: string) => void;
  onSessionInvalid: () => Promise<void>;
}) {
  const { colors } = useTheme();
  const keyboardAvoiding = useKeyboardAvoidingProps();
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [actionItem, setActionItem] = useState<TimelineItem | null>(null);

  const handleMatrixError = useCallback(
    async (error: unknown) => {
      if (error instanceof MatrixError && error.isUnknownToken)
        await onSessionInvalid();
    },
    [onSessionInvalid],
  );

  const { timeline, state } = useRoomTimeline(client, roomId, {
    timelineLimit: threadRootId ? 20 : 40,
    onFatalError: handleMatrixError,
  });

  // A thread's replies are scattered through the room timeline, so they come
  // from the relations API; the sync loop then keeps them live.
  const thread = useThread(client, roomId, threadRootId, state.resets);

  const members = useQuery({
    queryKey: ['mobile', 'room-members', roomId],
    enabled: state.ready,
    staleTime: 5 * 60_000,
    queryFn: () => client.joinedMembers(roomId),
  });

  const items = useMemo(() => {
    const events = threadRootId
      ? [...thread.events, ...state.events]
      : state.events;
    const rows = toTimeline(events, { threadRootId, userId: client.userId });
    const confirmed = new Set(rows.map((t) => t.id));
    return [
      ...rows,
      ...pending.filter((p) => !p.eventId || !confirmed.has(p.eventId)),
    ];
  }, [state.events, thread.events, pending, threadRootId, client.userId]);

  const newestId = useMemo(
    () => [...items].reverse().find((i) => !i.id.startsWith('pending:'))?.id,
    [items],
  );
  useEffect(() => {
    if (!newestId) return;
    void client.markRead(roomId, newestId).catch(() => undefined);
    onRead?.();
  }, [newestId, client, roomId, onRead]);

  /** Sends a message, as a thread reply when this is a thread. */
  const sendContent = async (content: Record<string, unknown>) => {
    const txnId = newTxnId();
    const latestInThread =
      threadRootId &&
      ([...items].reverse().find((i) => !i.id.startsWith('pending:'))?.id ??
        threadRootId);
    const body =
      threadRootId && latestInThread
        ? threadReplyContent(content, threadRootId, latestInThread)
        : content;
    return client.send(roomId, body, txnId);
  };

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    const id = `pending:${newTxnId()}`;
    setPending((prev) => [
      ...prev,
      { id, sender: client.userId, ts: Date.now(), kind: 'text', body: text },
    ]);
    try {
      const { event_id } = await sendContent({ msgtype: 'm.text', body: text });
      haptics.light();
      // Kept until the sync loop delivers the real event, so it never blinks.
      setPending((prev) =>
        prev.map((p) => (p.id === id ? { ...p, eventId: event_id } : p)),
      );
    } catch (error) {
      setPending((prev) => prev.filter((p) => p.id !== id));
      setDraft((current) => current || text);
      await handleMatrixError(error);
      Alert.alert(
        'Message not sent',
        error instanceof Error ? error.message : 'Try again.',
      );
    }
  };

  // Drop confirmed echoes so the pending list does not grow forever.
  useEffect(() => {
    const confirmed = new Set(state.events.map((e) => e.event_id));
    setPending((prev) =>
      prev.some((p) => p.eventId && confirmed.has(p.eventId))
        ? prev.filter((p) => !p.eventId || !confirmed.has(p.eventId))
        : prev,
    );
  }, [state.events]);

  const toggleReaction = async (item: TimelineItem, key: string) => {
    const existing = item.reactions?.find((r) => r.key === key)?.mine;
    haptics.selection();
    try {
      if (existing) await client.redact(roomId, existing, newTxnId());
      else await client.react(roomId, item.id, key, newTxnId());
    } catch (error) {
      await handleMatrixError(error);
      Alert.alert(
        'Reaction not saved',
        error instanceof Error ? error.message : 'Try again.',
      );
    }
  };

  const showActions = (item: TimelineItem) => {
    if (item.id.startsWith('pending:') || item.kind === 'encrypted') return;
    haptics.medium();
    setActionItem(item);
  };

  const attach = async (source: PickSource) => {
    try {
      const file = await pickFile(source);
      if (!file) return;
      setUploading(true);
      const mxcUrl = await uploadToMatrix(
        client.uploadUrl(file.name),
        client.authHeaders,
        file,
      );
      await sendContent(
        mediaMessageContent({
          mxcUrl,
          filename: file.name,
          mimeType: file.mimeType,
          size: file.size,
          width: file.width,
          height: file.height,
        }),
      );
    } catch (error) {
      await handleMatrixError(error);
      Alert.alert(
        'Upload failed',
        error instanceof Error ? error.message : 'Try again.',
      );
    } finally {
      setUploading(false);
    }
  };

  const chooseAttachment = () => {
    showActionSheet({
      options: [
        {
          label: 'Take photo',
          icon: 'camera-outline',
          onPress: () => void attach('camera'),
        },
        {
          label: 'Photo library',
          icon: 'images-outline',
          onPress: () => void attach('library'),
        },
        {
          label: 'File',
          icon: 'document-outline',
          onPress: () => void attach('document'),
        },
      ],
    });
  };

  const openMedia = async (item: TimelineItem) => {
    const url = client.mediaUrl(item.mxcUrl);
    if (!url) return;
    try {
      await downloadAndShare(
        url,
        item.body || 'attachment',
        client.authHeaders,
        item.mimeType,
      );
    } catch (error) {
      Alert.alert(
        'Download failed',
        error instanceof Error ? error.message : 'Try again.',
      );
    }
  };

  if (state.fatal && state.error) {
    return <ErrorState error={state.error} onRetry={() => timeline.start()} />;
  }
  if (!state.ready || (threadRootId && thread.isPending)) {
    return state.error ? (
      <ErrorState error={state.error} onRetry={() => timeline.start()} />
    ) : (
      <LoadingState label="Loading messages…" />
    );
  }
  if (thread.error) {
    return <ErrorState error={thread.error} onRetry={thread.retry} />;
  }

  const reversed = [...items].reverse();
  const loadingOlder = threadRootId ? thread.loadingOlder : state.loadingOlder;
  const loadOlder = threadRootId
    ? thread.loadOlder
    : () => void timeline.loadOlder();

  let composer;
  if (state.encrypted) {
    composer = (
      <AppText variant="muted" style={styles.readOnly}>
        This conversation is end-to-end encrypted. Send messages from web or
        desktop.
      </AppText>
    );
  } else if (!canPost) {
    composer = (
      <AppText variant="muted" style={styles.readOnly}>
        {readOnlyHint}
      </AppText>
    );
  } else {
    composer = (
      <View style={styles.composer}>
        {allowFiles ? (
          uploading ? (
            <ActivityIndicator
              style={styles.attachSpinner}
              color={colors.primaryText}
            />
          ) : (
            <IconButton
              icon="add-circle-outline"
              label="Attach a file"
              onPress={chooseAttachment}
            />
          )
        ) : null}
        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder={threadRootId ? 'Reply in thread' : 'Message'}
          placeholderTextColor={colors.subtle}
          selectionColor={colors.ring}
          cursorColor={colors.primary}
          underlineColorAndroid="transparent"
          multiline
          accessibilityLabel={threadRootId ? 'Reply in thread' : 'Message'}
          style={[
            styles.input,
            {
              color: colors.foreground,
              backgroundColor: colors.background,
              borderColor: colors.input,
            },
          ]}
        />
        <IconButton
          icon="send"
          label="Send message"
          onPress={() => void submit()}
          disabled={!draft.trim()}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      {...keyboardAvoiding}
    >
      {state.error ? (
        <View style={[styles.banner, { backgroundColor: colors.accent }]}>
          <AppText variant="caption">Reconnecting…</AppText>
        </View>
      ) : null}
      <FlatList
        inverted
        keyboardDismissMode={keyboardDismissMode}
        data={reversed}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messages}
        onEndReached={loadOlder}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingOlder ? (
            <ActivityIndicator style={styles.spinner} />
          ) : undefined
        }
        ListEmptyComponent={
          <View style={styles.invertFix}>
            <EmptyState
              icon="chatbubble-ellipses-outline"
              title="No messages yet"
              description="Say hello 👋"
            />
          </View>
        }
        renderItem={({ item, index }) => {
          const prev = reversed[index + 1];
          const grouped =
            prev &&
            prev.sender === item.sender &&
            item.ts - prev.ts < 5 * 60_000 &&
            // The root heads a thread on its own.
            !(threadRootId && prev.id === threadRootId);
          const profile = members.data?.[item.sender];
          return (
            <MessageRow
              item={item}
              name={profile?.displayName ?? localpartOf(item.sender)}
              avatarUrl={client.mediaUrl(profile?.avatarMxc, {
                width: 64,
                height: 64,
              })}
              authHeaders={client.authHeaders}
              thumbnailUrl={
                item.kind === 'image'
                  ? client.mediaUrl(item.mxcUrl, { width: 640, height: 640 })
                  : null
              }
              grouped={Boolean(grouped)}
              isRoot={item.id === threadRootId}
              onOpenMedia={() => void openMedia(item)}
              onLongPress={() => showActions(item)}
              onToggleReaction={(key) => void toggleReaction(item, key)}
              onOpenThread={
                !threadRootId && onOpenThread
                  ? () => onOpenThread(item.id)
                  : undefined
              }
              memberName={(id) =>
                members.data?.[id]?.displayName ?? localpartOf(id)
              }
            />
          );
        }}
      />
      <SafeAreaView
        edges={['bottom']}
        style={[
          styles.composerWrap,
          { borderTopColor: colors.border, backgroundColor: colors.card },
        ]}
      >
        {composer}
      </SafeAreaView>
      <MessageActions
        item={actionItem}
        onClose={() => setActionItem(null)}
        onReact={(item, key) => void toggleReaction(item, key)}
        onOpenThread={
          !threadRootId && onOpenThread
            ? (item) => onOpenThread(item.id)
            : undefined
        }
      />
    </KeyboardAvoidingView>
  );
}

/** Long-press sheet: quick reactions and "Reply in thread". */
function MessageActions({
  item,
  onClose,
  onReact,
  onOpenThread,
}: {
  item: TimelineItem | null;
  onClose: () => void;
  onReact: (item: TimelineItem, key: string) => void;
  onOpenThread?: (item: TimelineItem) => void;
}) {
  const { colors } = useTheme();
  return (
    <Modal
      visible={Boolean(item)}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
      >
        <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.sheetReactions}>
              {QUICK_REACTIONS.map((key) => {
                const mine = Boolean(
                  item?.reactions?.find((r) => r.key === key)?.mine,
                );
                return (
                  <Pressable
                    key={key}
                    onPress={() => {
                      if (item) onReact(item, key);
                      onClose();
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: mine }}
                    accessibilityLabel={
                      mine ? `Remove ${key} reaction` : `React with ${key}`
                    }
                    style={({ pressed }) => [
                      styles.sheetEmoji,
                      {
                        backgroundColor: mine
                          ? colors.selected
                          : pressed
                            ? colors.accent
                            : 'transparent',
                      },
                    ]}
                  >
                    <AppText style={styles.sheetEmojiText}>{key}</AppText>
                  </Pressable>
                );
              })}
            </View>
            {onOpenThread ? (
              <Pressable
                onPress={() => {
                  if (item) onOpenThread(item);
                  onClose();
                }}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.sheetAction,
                  {
                    borderTopColor: colors.border,
                    backgroundColor: pressed ? colors.accent : 'transparent',
                  },
                ]}
              >
                <Ionicons
                  name="chatbubbles-outline"
                  size={20}
                  color={colors.foreground}
                />
                <AppText variant="body">Reply in thread</AppText>
              </Pressable>
            ) : null}
          </View>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

/** The root and its replies for a thread view, with back-paging. */
function useThread(
  client: MatrixRestClient,
  roomId: string,
  rootId: string | undefined,
  resets: number,
) {
  const [older, setOlder] = useState<MatrixEvent[]>([]);
  const [olderToken, setOlderToken] = useState<string | null | undefined>();
  const [loadingOlder, setLoadingOlder] = useState(false);

  const query = useQuery({
    // `resets` refetches after a sync gap, which may have skipped replies.
    queryKey: ['mobile', 'thread', roomId, rootId, resets],
    enabled: Boolean(rootId),
    queryFn: async () => {
      const id = rootId as string;
      const [root, replies] = await Promise.all([
        client.event(roomId, id),
        client.threadReplies(roomId, id),
      ]);
      return { events: [root, ...replies.chunk], next: replies.next_batch };
    },
  });

  useEffect(() => {
    if (olderToken === undefined && query.data)
      setOlderToken(query.data.next ?? null);
  }, [query.data, olderToken]);

  const loadOlder = () => {
    if (!rootId || loadingOlder || !olderToken) return;
    setLoadingOlder(true);
    client
      .threadReplies(roomId, rootId, olderToken)
      .then((page) => {
        setOlder((prev) => [...prev, ...page.chunk]);
        setOlderToken(page.next_batch ?? null);
      })
      .catch(() => undefined)
      .finally(() => setLoadingOlder(false));
  };

  const events = useMemo(
    () => [...(query.data?.events ?? []), ...older],
    [query.data, older],
  );

  return {
    events,
    isPending: Boolean(rootId) && query.isPending,
    error: query.error,
    retry: () => void query.refetch(),
    loadingOlder,
    loadOlder,
  };
}

function MessageRow({
  item,
  name,
  avatarUrl,
  authHeaders,
  thumbnailUrl,
  grouped,
  isRoot,
  onOpenMedia,
  onLongPress,
  onToggleReaction,
  onOpenThread,
  memberName,
}: {
  item: TimelineItem;
  name: string;
  avatarUrl: string | null;
  authHeaders: Record<string, string>;
  thumbnailUrl: string | null;
  grouped: boolean;
  isRoot: boolean;
  onOpenMedia: () => void;
  onLongPress: () => void;
  onToggleReaction: (key: string) => void;
  onOpenThread?: () => void;
  memberName: (id: string) => string;
}) {
  const { colors } = useTheme();
  const time = new Date(item.ts).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  const pending = item.id.startsWith('pending:');

  return (
    <Pressable
      onLongPress={onLongPress}
      delayLongPress={300}
      accessibilityHint="Long-press to react or reply in a thread"
      style={[
        styles.row,
        grouped ? styles.rowGrouped : null,
        pending ? styles.pending : null,
        isRoot ? [styles.rootRow, { borderBottomColor: colors.border }] : null,
      ]}
    >
      <View style={styles.avatarCol}>
        {grouped ? null : (
          <Avatar name={name} uri={avatarUrl} headers={authHeaders} size={34} />
        )}
      </View>
      <View style={styles.flex}>
        {grouped ? null : (
          <View style={styles.meta}>
            <AppText variant="label" numberOfLines={1}>
              {name}
            </AppText>
            <AppText variant="caption">{pending ? 'Sending…' : time}</AppText>
          </View>
        )}
        {item.kind === 'image' && thumbnailUrl ? (
          <Pressable
            onPress={onOpenMedia}
            onLongPress={onLongPress}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Image ${item.body}`}
          >
            <Thumbnail uri={thumbnailUrl} headers={authHeaders} />
          </Pressable>
        ) : item.kind === 'file' ||
          item.kind === 'video' ||
          item.kind === 'audio' ? (
          <Pressable
            onPress={onOpenMedia}
            onLongPress={onLongPress}
            accessibilityRole="button"
            accessibilityLabel={`Download ${item.body}`}
            style={[
              styles.file,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <Ionicons
              name="document-attach-outline"
              size={22}
              color={colors.primaryText}
            />
            <View style={styles.flex}>
              <AppText variant="body" numberOfLines={1}>
                {item.body}
              </AppText>
              {item.size ? (
                <AppText variant="caption">{formatBytes(item.size)}</AppText>
              ) : null}
            </View>
            <Ionicons name="download-outline" size={18} color={colors.subtle} />
          </Pressable>
        ) : (
          <AppText
            variant="body"
            style={
              item.kind === 'encrypted' || item.kind === 'notice'
                ? { color: colors.mutedForeground, fontStyle: 'italic' }
                : undefined
            }
          >
            {item.body}
            {item.edited ? (
              <AppText variant="caption"> (edited)</AppText>
            ) : null}
          </AppText>
        )}
        {item.reactions?.length ? (
          <View style={styles.reactions}>
            {item.reactions.map((reaction) => (
              <ReactionPill
                key={reaction.key}
                reaction={reaction}
                memberName={memberName}
                onPress={() => onToggleReaction(reaction.key)}
              />
            ))}
          </View>
        ) : null}
        {item.threadReplyCount && onOpenThread ? (
          <Pressable
            onPress={onOpenThread}
            accessibilityRole="button"
            accessibilityLabel={`Open thread, ${item.threadReplyCount} replies`}
            style={styles.threadLink}
            hitSlop={6}
          >
            <Ionicons
              name="chatbubbles-outline"
              size={14}
              color={colors.primaryText}
            />
            <AppText variant="caption" style={{ color: colors.primaryText }}>
              {item.threadReplyCount}{' '}
              {item.threadReplyCount === 1 ? 'reply' : 'replies'}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

/** An image message; authenticated media, so the source needs the header. */
function Thumbnail({
  uri,
  headers,
}: {
  uri: string;
  headers: Record<string, string>;
}) {
  const { colors } = useTheme();
  const source = useAuthedImageSource(uri, headers);
  const style = [styles.image, { backgroundColor: colors.muted }];
  return source ? (
    <Image source={source} style={style} resizeMode="cover" />
  ) : (
    <View style={style} />
  );
}

function ReactionPill({
  reaction,
  memberName,
  onPress,
}: {
  reaction: Reaction;
  memberName: (id: string) => string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const mine = Boolean(reaction.mine);
  const who = reaction.senders.map(memberName).join(', ');
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: mine }}
      accessibilityLabel={`${reaction.key} ${reaction.count}, ${who}. ${
        mine ? 'Tap to remove your reaction' : 'Tap to react'
      }`}
      style={({ pressed }) => [
        styles.pill,
        {
          borderColor: mine ? colors.primaryText : colors.border,
          backgroundColor: mine ? colors.selected : colors.card,
          opacity: pressed ? 0.7 : 1,
        },
      ]}
    >
      <AppText variant="body">{reaction.key}</AppText>
      <AppText
        variant="caption"
        style={mine ? { color: colors.primaryText } : undefined}
      >
        {reaction.count}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  messages: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  banner: { alignItems: 'center', paddingVertical: spacing.xs },
  invertFix: { transform: [{ scaleY: -1 }] },
  spinner: { marginVertical: spacing.md },
  row: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.md },
  rowGrouped: { paddingTop: 2 },
  rootRow: {
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pending: { opacity: 0.6 },
  avatarCol: { width: 34 },
  meta: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  image: {
    width: 220,
    height: 220,
    borderRadius: radius.lg,
    marginTop: spacing.xs,
  },
  file: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.xs,
    maxWidth: 320,
  },
  reactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 30,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.xl,
  },
  threadLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  composerWrap: { borderTopWidth: StyleSheet.hairlineWidth },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 140,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 16,
  },
  attachSpinner: { width: 44 },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheetWrap: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    padding: spacing.md,
  },
  sheet: {
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sheetReactions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.sm,
  },
  sheetEmoji: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetEmojiText: { fontSize: 26, lineHeight: 32 },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  readOnly: { textAlign: 'center', padding: spacing.md },
});
