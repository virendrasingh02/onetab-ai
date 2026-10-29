import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  replyContent,
  threadReplyContent,
  toTimeline,
  type MatrixEvent,
  type MatrixRestClient,
  type Reaction,
  type TimelineItem,
} from '../lib/matrix';
import { useAuthedImageSource } from '../lib/use-authed-uri';
import { useRoomTimeline } from '../lib/use-room-timeline';
import { secureStore } from '../lib/secure-store';
import { useTheme } from '../theme/theme';
import { showActionSheet } from './action-sheet';
import { useKeyboardAvoidingProps } from './navigation';
import { maxContentWidth, radius, spacing } from '../theme/tokens';
import {
  AppText,
  Avatar,
  Badge,
  Divider,
  EmptyState,
  ErrorState,
  IconButton,
  keyboardDismissMode,
  LoadingState,
  TextField,
} from './ui';

/** The quick set offered on long-press; WhatsApp style. */
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const DRAFT_SAVE_DELAY_MS = 400;
const MAX_DRAFT_CHARS = 2000;

interface PendingItem extends TimelineItem {
  /** Set once the homeserver accepted it; hidden when sync delivers it. */
  eventId?: string;
  replyToId?: string;
}

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
  onRead?: () => void;
  onOpenThread?: (rootId: string) => void;
  onSessionInvalid: () => Promise<void>;
}) {
  const { colors, dark } = useTheme();
  const keyboardAvoiding = useKeyboardAvoidingProps();
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [actionItem, setActionItem] = useState<TimelineItem | null>(null);
  const [replyingTo, setReplyingTo] = useState<TimelineItem | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [detailsOpen, setDetailsOpen] = useState(false);

  const draftStorageKey = useMemo(
    () =>
      `draft_${[roomId, threadRootId].filter(Boolean).join('_').replace(/[^a-zA-Z0-9_.-]/g, '_')}`,
    [roomId, threadRootId],
  );

  // Unsent drafts live in the device store. Writes are debounced (a Keychain/
  // Keystore write per keystroke is slow) and flushed on unmount/room change.
  const draftWrite = useRef<{
    timer: ReturnType<typeof setTimeout>;
    flush: () => void;
  } | null>(null);
  const flushDraftWrite = useCallback(() => {
    const pending = draftWrite.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    draftWrite.current = null;
    pending.flush();
  }, []);
  const persistDraft = useCallback(
    (text: string, immediate = false) => {
      if (draftWrite.current) clearTimeout(draftWrite.current.timer);
      const flush = () => {
        // SecureStore values are capped around 2 KB; keep the head of long drafts.
        void (text.trim()
          ? secureStore.set(draftStorageKey, text.slice(0, MAX_DRAFT_CHARS))
          : secureStore.remove(draftStorageKey)
        ).catch(() => undefined);
      };
      if (immediate) {
        draftWrite.current = null;
        flush();
        return;
      }
      draftWrite.current = {
        timer: setTimeout(() => {
          draftWrite.current = null;
          flush();
        }, DRAFT_SAVE_DELAY_MS),
        flush,
      };
    },
    [draftStorageKey],
  );

  // Restore the saved draft without clobbering anything typed meanwhile.
  useEffect(() => {
    let active = true;
    void secureStore
      .get(draftStorageKey)
      .then((saved) => {
        if (active && saved) setDraft((current) => current || saved);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      flushDraftWrite();
    };
  }, [draftStorageKey, flushDraftWrite]);

  const handleDraftChange = useCallback(
    (text: string) => {
      setDraft(text);
      persistDraft(text);
    },
    [persistDraft],
  );

  const handleMatrixError = useCallback(
    async (error: unknown) => {
      if (error instanceof MatrixError && error.isUnknownToken) {
        await onSessionInvalid();
      }
    },
    [onSessionInvalid],
  );

  const { timeline, state } = useRoomTimeline(client, roomId, {
    timelineLimit: threadRootId ? 20 : 40,
    onFatalError: handleMatrixError,
  });

  const thread = useThread(client, roomId, threadRootId, state.resets);

  const members = useQuery({
    queryKey: ['mobile', 'room-members', roomId],
    enabled: state.ready,
    staleTime: 5 * 60_000,
    queryFn: () => client.joinedMembers(roomId),
  });

  const allItems = useMemo(() => {
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

  // Apply search filter if active
  const items = useMemo(() => {
    if (!searchFilter.trim()) return allItems;
    const q = searchFilter.trim().toLowerCase();
    return allItems.filter((item) => item.body.toLowerCase().includes(q));
  }, [allItems, searchFilter]);

  const newestId = useMemo(
    () => [...items].reverse().find((i) => !i.id.startsWith('pending:'))?.id,
    [items],
  );

  useEffect(() => {
    if (!newestId) return;
    void client.markRead(roomId, newestId).catch(() => undefined);
    onRead?.();
  }, [newestId, client, roomId, onRead]);

  const sendContent = async (content: Record<string, unknown>) => {
    const txnId = newTxnId();
    if (threadRootId) {
      const latestInThread =
        [...items].reverse().find((i) => !i.id.startsWith('pending:'))?.id ??
        threadRootId;
      return client.send(
        roomId,
        threadReplyContent(content, threadRootId, latestInThread),
        txnId,
      );
    }
    if (replyingTo) {
      return client.send(roomId, replyContent(content, replyingTo.id), txnId);
    }
    return client.send(roomId, content, txnId);
  };

  const submit = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    persistDraft('', true);
    const id = `pending:${newTxnId()}`;
    const replyTargetId = replyingTo?.id;
    setReplyingTo(null);

    setPending((prev) => [
      ...prev,
      {
        id,
        sender: client.userId,
        ts: Date.now(),
        kind: 'text',
        body: text,
        replyToId: replyTargetId,
      },
    ]);

    try {
      const { event_id } = await sendContent({
        msgtype: 'm.text',
        body: text,
      });
      haptics.light();
      setPending((prev) =>
        prev.map((p) => (p.id === id ? { ...p, eventId: event_id } : p)),
      );
    } catch (error) {
      setPending((prev) => prev.filter((p) => p.id !== id));
      setDraft((current) => current || text);
      persistDraft(text, true);
      await handleMatrixError(error);
      Alert.alert(
        'Message not sent',
        error instanceof Error ? error.message : 'Try again.',
      );
    }
  };

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
          label: 'Document',
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

  return (
    <KeyboardAvoidingView style={styles.flex} {...keyboardAvoiding}>
      {/* Top Header Utilities: Search Toggle & Details Button */}
      <View
        style={[
          styles.toolbar,
          { backgroundColor: colors.card, borderBottomColor: colors.border },
        ]}
      >
        <IconButton
          icon={searchOpen ? 'close' : 'search-outline'}
          label={searchOpen ? 'Close search' : 'Search messages'}
          onPress={() => {
            setSearchOpen(!searchOpen);
            if (searchOpen) setSearchFilter('');
          }}
        />
        <AppText variant="caption" style={styles.flex}>
          {searchFilter ? `Found ${items.length} matching messages` : ''}
        </AppText>
        <IconButton
          icon="information-circle-outline"
          label="Conversation details"
          onPress={() => setDetailsOpen(true)}
        />
      </View>

      {/* In-Chat Search Bar */}
      {searchOpen ? (
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.card, borderBottomColor: colors.border },
          ]}
        >
          <TextField
            placeholder="Search this conversation…"
            value={searchFilter}
            onChangeText={setSearchFilter}
            autoFocus
            clearButtonMode="always"
            autoCapitalize="none"
          />
        </View>
      ) : null}

      {/* Reconnecting Banner */}
      {state.error ? (
        <View style={[styles.banner, { backgroundColor: colors.accent }]}>
          <AppText variant="caption">Reconnecting to chat server…</AppText>
        </View>
      ) : null}

      {/* WhatsApp Message Timeline */}
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
            <ActivityIndicator style={styles.spinner} color={colors.primary} />
          ) : undefined
        }
        ListEmptyComponent={
          <View style={styles.invertFix}>
            <EmptyState
              icon="chatbubble-ellipses-outline"
              title={searchFilter ? 'No matching messages' : 'No messages yet'}
              description={
                searchFilter
                  ? `No messages matched "${searchFilter}".`
                  : 'Say hello to start the conversation 👋'
              }
            />
          </View>
        }
        renderItem={({ item, index }) => {
          const isMine = item.sender === client.userId;
          const prev = reversed[index + 1];
          const grouped =
            prev &&
            prev.sender === item.sender &&
            item.ts - prev.ts < 5 * 60_000 &&
            !(threadRootId && prev.id === threadRootId);
          const profile = members.data?.[item.sender];
          const senderName = profile?.displayName ?? localpartOf(item.sender);

          // Find quoted message if replying
          const replyTarget = item.replyToId
            ? allItems.find((m) => m.id === item.replyToId)
            : undefined;

          return (
            <WhatsAppMessageBubble
              item={item}
              isMine={isMine}
              name={senderName}
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
              replyTarget={replyTarget}
              onOpenMedia={() => void openMedia(item)}
              onLongPress={() => showActions(item)}
              onSwipeReply={() => setReplyingTo(item)}
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

      {/* Replying Banner Above Composer */}
      {replyingTo ? (
        <View
          style={[
            styles.replyBanner,
            { backgroundColor: colors.card, borderTopColor: colors.border },
          ]}
        >
          <View
            style={[styles.replyAccent, { backgroundColor: colors.primary }]}
          />
          <View style={styles.flex}>
            <AppText
              variant="label"
              style={{ color: colors.primaryText, fontSize: 13 }}
            >
              Replying to{' '}
              {members.data?.[replyingTo.sender]?.displayName ??
                localpartOf(replyingTo.sender)}
            </AppText>
            <AppText variant="caption" numberOfLines={1}>
              {replyingTo.body}
            </AppText>
          </View>
          <IconButton
            icon="close-circle"
            label="Cancel reply"
            onPress={() => setReplyingTo(null)}
          />
        </View>
      ) : null}

      {/* WhatsApp Multiline Composer */}
      <SafeAreaView
        edges={['bottom']}
        style={[
          styles.composerWrap,
          { borderTopColor: colors.border, backgroundColor: colors.card },
        ]}
      >
        {state.encrypted ? (
          <AppText variant="muted" style={styles.readOnly}>
            🔒 This conversation is end-to-end encrypted. Use web/desktop to send.
          </AppText>
        ) : !canPost ? (
          <AppText variant="muted" style={styles.readOnly}>
            {readOnlyHint}
          </AppText>
        ) : (
          <View style={styles.composer}>
            {allowFiles ? (
              uploading ? (
                <ActivityIndicator
                  style={styles.attachSpinner}
                  color={colors.primaryText}
                />
              ) : (
                <IconButton
                  icon="add-circle"
                  label="Attach file"
                  onPress={chooseAttachment}
                />
              )
            ) : null}

            <TextInput
              value={draft}
              onChangeText={handleDraftChange}
              placeholder={
                threadRootId
                  ? 'Reply in thread…'
                  : replyingTo
                    ? 'Type a reply…'
                    : 'Message…'
              }
              placeholderTextColor={colors.subtle}
              selectionColor={colors.ring}
              cursorColor={colors.primary}
              underlineColorAndroid="transparent"
              multiline
              accessibilityLabel="Message input"
              style={[
                styles.input,
                {
                  color: colors.foreground,
                  backgroundColor: dark ? '#1c2421' : '#f0f2f1',
                  borderColor: 'transparent',
                },
              ]}
            />

            <Pressable
              onPress={() => void submit()}
              disabled={!draft.trim()}
              accessibilityRole="button"
              accessibilityLabel="Send message"
              style={({ pressed }) => [
                styles.sendButton,
                {
                  backgroundColor: draft.trim()
                    ? colors.primary
                    : colors.disabled,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Ionicons
                name="send"
                size={18}
                color={
                  draft.trim()
                    ? colors.primaryForeground
                    : colors.mutedForeground
                }
              />
            </Pressable>
          </View>
        )}
      </SafeAreaView>

      {/* Long-Press Action Sheet & Emoji Reaction Bar */}
      <MessageActions
        item={actionItem}
        onClose={() => setActionItem(null)}
        onReact={(item, key) => void toggleReaction(item, key)}
        onReply={(item) => setReplyingTo(item)}
        onOpenThread={
          !threadRootId && onOpenThread
            ? (item) => onOpenThread(item.id)
            : undefined
        }
      />

      {/* Conversation Details Modal */}
      <ConversationDetailsModal
        visible={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        roomId={roomId}
        isEncrypted={Boolean(state.encrypted)}
        memberCount={members.data ? Object.keys(members.data).length : 0}
        members={members.data ?? {}}
      />
    </KeyboardAvoidingView>
  );
}

/**
 * WhatsApp-Inspired Message Bubble
 */
function WhatsAppMessageBubble({
  item,
  isMine,
  name,
  avatarUrl,
  authHeaders,
  thumbnailUrl,
  grouped,
  isRoot,
  replyTarget,
  onOpenMedia,
  onLongPress,
  onSwipeReply: _onSwipeReply,
  onToggleReaction,
  onOpenThread,
  memberName,
}: {
  item: TimelineItem;
  isMine: boolean;
  name: string;
  avatarUrl: string | null;
  authHeaders: Record<string, string>;
  thumbnailUrl: string | null;
  grouped: boolean;
  isRoot: boolean;
  replyTarget?: TimelineItem;
  onOpenMedia: () => void;
  onLongPress: () => void;
  onSwipeReply: () => void;
  onToggleReaction: (key: string) => void;
  onOpenThread?: () => void;
  memberName: (id: string) => string;
}) {
  const { colors, dark } = useTheme();
  const time = new Date(item.ts).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
  const pending = item.id.startsWith('pending:');

  // Detect tool executions or AI structured messages
  const isToolExecution =
    item.body.startsWith('[Tool execution]') ||
    item.body.startsWith('[AI Action]') ||
    item.body.includes('"tool":') ||
    item.body.includes('"action":');

  return (
    <View
      style={[
        styles.bubbleRow,
        isMine ? styles.bubbleRowMine : styles.bubbleRowOther,
        grouped ? styles.bubbleRowGrouped : null,
      ]}
    >
      {!isMine && !grouped ? (
        <Avatar name={name} uri={avatarUrl} headers={authHeaders} size={28} />
      ) : !isMine && grouped ? (
        <View style={styles.avatarSpacer} />
      ) : null}

      <Pressable
        onLongPress={onLongPress}
        delayLongPress={300}
        accessibilityRole="text"
        accessibilityHint="Long-press to react, reply or share"
        style={({ pressed }) => [
          styles.bubble,
          isMine
            ? [
                styles.bubbleMine,
                {
                  backgroundColor: dark ? '#054638' : '#dcf8c6',
                },
              ]
            : [
                styles.bubbleOther,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                },
              ],
          pending ? styles.pendingBubble : null,
          isRoot ? styles.rootBubble : null,
          pressed ? { opacity: 0.92 } : null,
        ]}
      >
        {/* Incoming sender name header for group chats */}
        {!isMine && !grouped ? (
          <AppText
            variant="label"
            style={[styles.senderHeader, { color: colors.primaryText }]}
          >
            {name}
          </AppText>
        ) : null}

        {/* Quoted Reply Preview */}
        {replyTarget ? (
          <View
            style={[
              styles.quotedBox,
              {
                borderLeftColor: colors.primary,
                backgroundColor: isMine
                  ? dark
                    ? 'rgba(0,0,0,0.2)'
                    : 'rgba(0,0,0,0.06)'
                  : dark
                    ? 'rgba(255,255,255,0.06)'
                    : colors.accent,
              },
            ]}
          >
            <AppText
              variant="label"
              style={{ fontSize: 11, color: colors.primaryText }}
            >
              {memberName(replyTarget.sender)}
            </AppText>
            <AppText variant="caption" numberOfLines={1}>
              {replyTarget.body}
            </AppText>
          </View>
        ) : null}

        {/* AI Tool Execution Accordion */}
        {isToolExecution ? (
          <AIToolExecutionCard body={item.body} />
        ) : item.kind === 'image' && thumbnailUrl ? (
          <Pressable
            onPress={onOpenMedia}
            onLongPress={onLongPress}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Image attachment: ${item.body}`}
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
              styles.fileBox,
              {
                backgroundColor: isMine
                  ? dark
                    ? 'rgba(0,0,0,0.25)'
                    : 'rgba(0,0,0,0.05)'
                  : colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons
              name={
                item.kind === 'audio'
                  ? 'musical-notes-outline'
                  : item.kind === 'video'
                    ? 'videocam-outline'
                    : 'document-text-outline'
              }
              size={24}
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
            selectable
            style={[
              styles.bubbleText,
              item.kind === 'encrypted' || item.kind === 'notice'
                ? { color: colors.mutedForeground, fontStyle: 'italic' }
                : undefined,
            ]}
          >
            {item.body}
          </AppText>
        )}

        {/* Bubble Footer: Time + Delivery Status Ticks */}
        <View style={styles.bubbleFooter}>
          {item.edited ? (
            <AppText variant="caption" style={styles.editedText}>
              edited ·{' '}
            </AppText>
          ) : null}
          <AppText variant="caption" style={styles.footerTime}>
            {pending ? 'Sending…' : time}
          </AppText>
          {isMine ? (
            pending ? (
              <Ionicons
                name="time-outline"
                size={12}
                color={colors.subtle}
                style={styles.tickIcon}
              />
            ) : (
              <Ionicons
                name="checkmark-done"
                size={14}
                color={colors.primaryText}
                style={styles.tickIcon}
              />
            )
          ) : null}
        </View>

        {/* Thread Replies Button */}
        {item.threadReplyCount && onOpenThread ? (
          <Pressable
            onPress={onOpenThread}
            accessibilityRole="button"
            accessibilityLabel={`Open thread with ${item.threadReplyCount} replies`}
            style={styles.threadBadge}
            hitSlop={6}
          >
            <Ionicons
              name="chatbubbles-outline"
              size={13}
              color={colors.primaryText}
            />
            <AppText
              variant="caption"
              style={{ color: colors.primaryText, fontWeight: '600' }}
            >
              {item.threadReplyCount}{' '}
              {item.threadReplyCount === 1 ? 'reply' : 'replies'}
            </AppText>
          </Pressable>
        ) : null}

        {/* Floating Reactions on Bubble Edge */}
        {item.reactions?.length ? (
          <View
            style={[
              styles.floatingReactions,
              isMine ? styles.reactionsRight : styles.reactionsLeft,
            ]}
          >
            {item.reactions.map((reaction) => (
              <ReactionBadge
                key={reaction.key}
                reaction={reaction}
                memberName={memberName}
                onPress={() => onToggleReaction(reaction.key)}
              />
            ))}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}

/**
 * AI Tool Execution Accordion Card
 */
function AIToolExecutionCard({ body }: { body: string }) {
  const { colors, dark } = useTheme();
  const [expanded, setExpanded] = useState(false);

  return (
    <View
      style={[
        styles.toolCard,
        {
          backgroundColor: dark ? '#13211c' : '#f0fbf4',
          borderColor: 'rgba(96, 198, 134, 0.4)',
        },
      ]}
    >
      <Pressable
        onPress={() => setExpanded(!expanded)}
        style={styles.toolHeader}
      >
        <Ionicons name="sparkles" size={16} color={colors.primaryText} />
        <AppText
          variant="label"
          style={{ flex: 1, fontSize: 13, color: colors.primaryText }}
        >
          AI Tool Execution
        </AppText>
        <Badge label="Completed" tone="success" />
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.subtle}
        />
      </Pressable>
      {expanded ? (
        <AppText
          variant="caption"
          style={styles.toolPayload}
          selectable
        >
          {body}
        </AppText>
      ) : null}
    </View>
  );
}

/**
 * Image thumbnail
 */
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

/**
 * Floating Reaction Badge
 */
function ReactionBadge({
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
      accessibilityLabel={`${reaction.key} ${reaction.count}, ${who}`}
      style={[
        styles.reactionBadge,
        {
          borderColor: mine ? colors.primaryText : colors.border,
          backgroundColor: mine ? colors.selected : colors.card,
        },
      ]}
    >
      <AppText style={{ fontSize: 13 }}>{reaction.key}</AppText>
      <AppText
        variant="caption"
        style={{
          fontSize: 11,
          fontWeight: '700',
          color: mine ? colors.primaryText : colors.foreground,
        }}
      >
        {reaction.count}
      </AppText>
    </Pressable>
  );
}

/**
 * Long-Press Message Actions & Quick Reaction Bar
 */
function MessageActions({
  item,
  onClose,
  onReact,
  onReply,
  onOpenThread,
}: {
  item: TimelineItem | null;
  onClose: () => void;
  onReact: (item: TimelineItem, key: string) => void;
  onReply: (item: TimelineItem) => void;
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
      <Pressable style={styles.backdrop} onPress={onClose}>
        <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onStartShouldSetResponder={() => true}
          >
            {/* Quick emoji reactions */}
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

            {/* Action 1: Reply */}
            <Pressable
              onPress={() => {
                if (item) onReply(item);
                onClose();
              }}
              style={({ pressed }) => [
                styles.sheetAction,
                {
                  borderTopColor: colors.border,
                  backgroundColor: pressed ? colors.accent : 'transparent',
                },
              ]}
            >
              <Ionicons
                name="arrow-undo-outline"
                size={20}
                color={colors.foreground}
              />
              <AppText variant="body">Reply</AppText>
            </Pressable>

            {/* Action 2: Reply in thread */}
            {onOpenThread ? (
              <Pressable
                onPress={() => {
                  if (item) onOpenThread(item);
                  onClose();
                }}
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

/**
 * Conversation Details Modal
 */
function ConversationDetailsModal({
  visible,
  onClose,
  roomId,
  isEncrypted,
  memberCount,
  members,
}: {
  visible: boolean;
  onClose: () => void;
  roomId: string;
  isEncrypted: boolean;
  memberCount: number;
  members: Record<string, { displayName: string; avatarMxc?: string | null }>;
}) {
  const { colors } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <SafeAreaView edges={['bottom']} style={styles.sheetWrap}>
          <View
            style={[
              styles.sheet,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.detailsHeader}>
              <AppText variant="heading">Conversation Info</AppText>
              <IconButton icon="close" label="Close" onPress={onClose} />
            </View>

            <View style={styles.detailsContent}>
              <View style={styles.detailsRow}>
                <Ionicons
                  name={isEncrypted ? 'lock-closed' : 'lock-open-outline'}
                  size={20}
                  color={isEncrypted ? colors.primaryText : colors.subtle}
                />
                <View style={styles.flex}>
                  <AppText variant="label">
                    {isEncrypted ? 'End-to-end encrypted' : 'Standard room'}
                  </AppText>
                  <AppText variant="caption">Room: {roomId}</AppText>
                </View>
              </View>

              <Divider />

              <View style={styles.detailsRow}>
                <Ionicons name="people-outline" size={20} color={colors.subtle} />
                <View style={styles.flex}>
                  <AppText variant="label">Participants ({memberCount})</AppText>
                  <AppText variant="caption">
                    {Object.values(members)
                      .slice(0, 5)
                      .map((m) => m.displayName)
                      .join(', ')}
                    {memberCount > 5 ? '…' : ''}
                  </AppText>
                </View>
              </View>
            </View>
          </View>
        </SafeAreaView>
      </Pressable>
    </Modal>
  );
}

/**
 * Thread relation loader
 */
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

const styles = StyleSheet.create({
  flex: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
  searchBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
  messages: {
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  banner: { alignItems: 'center', paddingVertical: spacing.xs },
  invertFix: { transform: [{ scaleY: -1 }] },
  spinner: { marginVertical: spacing.md },

  // Bubble Row Styles
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginVertical: 3,
    gap: 6,
  },
  bubbleRowMine: {
    justifyContent: 'flex-end',
  },
  bubbleRowOther: {
    justifyContent: 'flex-start',
  },
  bubbleRowGrouped: {
    marginTop: 1,
  },
  avatarSpacer: {
    width: 28,
  },

  // Bubble Container
  bubble: {
    maxWidth: '82%',
    borderRadius: radius.lg,
    paddingHorizontal: 11,
    paddingTop: 7,
    paddingBottom: 6,
  },
  bubbleMine: {
    borderBottomRightRadius: 2,
  },
  bubbleOther: {
    borderBottomLeftRadius: 2,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pendingBubble: { opacity: 0.65 },
  rootBubble: {
    borderWidth: 2,
  },

  senderHeader: {
    fontWeight: '700',
    fontSize: 12,
    marginBottom: 2,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 20,
  },

  // Quoted Preview
  quotedBox: {
    borderLeftWidth: 3,
    borderRadius: radius.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 4,
  },

  // Footer & Ticks
  bubbleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 3,
    marginTop: 3,
  },
  footerTime: {
    fontSize: 11,
    opacity: 0.7,
  },
  editedText: {
    fontSize: 10,
    fontStyle: 'italic',
    opacity: 0.6,
  },
  tickIcon: {
    marginLeft: 1,
  },

  // Media
  image: {
    width: 230,
    height: 230,
    borderRadius: radius.md,
    marginTop: spacing.xs,
  },
  fileBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.xs,
    maxWidth: 260,
  },

  // AI Tool Card
  toolCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    marginVertical: spacing.xs,
  },
  toolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  toolPayload: {
    fontFamily: 'monospace',
    fontSize: 12,
    marginTop: spacing.xs,
    opacity: 0.85,
  },

  // Floating Reactions
  floatingReactions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 3,
    marginTop: -4,
    marginBottom: 2,
  },
  reactionsRight: {
    alignSelf: 'flex-end',
  },
  reactionsLeft: {
    alignSelf: 'flex-start',
  },
  reactionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  threadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    alignSelf: 'flex-start',
  },

  // Reply Banner
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
  replyAccent: {
    width: 3,
    height: 32,
    borderRadius: 2,
  },

  // Composer
  composerWrap: { borderTopWidth: StyleSheet.hairlineWidth },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    width: '100%',
    maxWidth: maxContentWidth,
    alignSelf: 'center',
  },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 120,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingTop: 8,
    paddingBottom: 8,
    fontSize: 16,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  attachSpinner: { width: 38 },

  // Sheets
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
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
    paddingBottom: spacing.sm,
  },
  sheetReactions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: spacing.md,
  },
  sheetEmoji: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetEmojiText: { fontSize: 24, lineHeight: 30 },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  detailsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  detailsContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  readOnly: { textAlign: 'center', padding: spacing.md },
});
