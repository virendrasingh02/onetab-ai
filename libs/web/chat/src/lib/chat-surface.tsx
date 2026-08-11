import {
  AttachmentRenderer,
  BookmarksBar,
  ChatBubble,
  ChatHeader,
  ChatLayout,
  Composer,
  ConversationSearch,
  HuddleBar,
  MemberList,
  MessageList,
  PinnedPanel,
  SavedPanel,
  ThreadListPanel,
  ThreadPanel,
  TypingIndicator,
  type ChannelBookmark,
} from '@org/chat-ui';
import type { Message, PresenceState, RoomMember } from '@org/matrix-client';
import { Badge, Button, Hint } from '@org/ui';
import {
  Bookmark,
  Headphones,
  MessagesSquare,
  Pin,
  Search,
} from 'lucide-react';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { deriveThreads, groupReplies } from './derive-threads.js';

type SidePanel =
  | 'none'
  | 'members'
  | 'thread'
  | 'threads'
  | 'search'
  | 'pinned'
  | 'saved';

export interface ChatSurfaceProps {
  title: string;
  subtitle?: string;
  isEncrypted?: boolean;
  /** Connection banner, or a notice that the data is sample data. */
  banner?: ReactNode;
  /** Matrix id of the reader, so their own messages get the owner actions. */
  myUserId?: string;

  messages: Message[];
  members: RoomMember[];
  typingNames: string[];
  isLoading?: boolean;
  isLoadingOlder?: boolean;
  hasMore?: boolean;
  error?: string | null;
  onLoadOlder?: () => void;
  presenceOf?: (userId: string) => PresenceState;

  bookmarks?: ChannelBookmark[];
  huddleParticipants?: RoomMember[];
  pinnedIds?: string[];
  savedIds?: string[];
  firstUnreadId?: string | null;

  onSend: (body: string, threadRootId?: string) => void | Promise<void>;
  onEdit?: (eventId: string, body: string) => void | Promise<void>;
  onDelete?: (eventId: string) => void | Promise<void>;
  onReact?: (
    eventId: string,
    key: string,
    alreadyReacted: boolean,
  ) => void | Promise<void>;
  onTyping?: (isTyping: boolean) => void;
  onAttach?: (files: FileList, threadRootId?: string) => void | Promise<void>;
  onTogglePin?: (eventId: string) => void;
  onToggleSave?: (eventId: string) => void;
  /**
   * Enables the composer's send split-button. Left unset until scheduled send
   * has somewhere to queue to — an option that silently drops the message
   * would be worse than not offering it.
   */
  onSchedule?: (body: string, when: string) => void;
}

/**
 * The channel conversation, every feature wired but no data source of its own.
 *
 * Both the Matrix-backed panel and the sample-data panel render this, which is
 * what keeps the design honest: there is one implementation of threads, pins,
 * saved items, search and the huddle bar, and switching the homeserver on
 * changes where the messages come from, not how any of it looks.
 */
export function ChatSurface({
  title,
  subtitle,
  isEncrypted = false,
  banner,
  myUserId,
  messages,
  members,
  typingNames,
  isLoading = false,
  isLoadingOlder = false,
  hasMore = false,
  error,
  onLoadOlder,
  presenceOf,
  bookmarks = [],
  huddleParticipants = [],
  pinnedIds = [],
  savedIds = [],
  firstUnreadId,
  onSend,
  onEdit,
  onDelete,
  onReact,
  onTyping,
  onAttach,
  onTogglePin,
  onToggleSave,
  onSchedule,
}: ChatSurfaceProps) {
  const [panel, setPanel] = useState<SidePanel>('none');
  const [threadRootId, setThreadRootId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [huddleJoined, setHuddleJoined] = useState(false);
  const [huddleMuted, setHuddleMuted] = useState(false);

  const byId = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  );

  const memberById = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members],
  );

  /** Replies grouped by the message they hang off, computed once per render. */
  const repliesByRoot = useMemo(() => groupReplies(messages), [messages]);

  const rootMessages = useMemo(
    () => messages.filter((message) => !message.threadRootId),
    [messages],
  );

  const threads = useMemo(
    () =>
      deriveThreads(messages, members, {
        myUserId,
        // Everything above the unread line has been read; without a line, the
        // reader is caught up and no thread should claim to be new.
        lastReadAt: firstUnreadId
          ? (byId.get(firstUnreadId)?.timestamp ?? 0)
          : Date.now(),
      }),
    [messages, members, myUserId, firstUnreadId, byId],
  );

  const pinnedMessages = useMemo(
    () =>
      pinnedIds
        .map((id) => byId.get(id))
        .filter((message): message is Message => !!message),
    [pinnedIds, byId],
  );

  const savedMessages = useMemo(
    () =>
      savedIds
        .map((id) => byId.get(id))
        .filter((message): message is Message => !!message),
    [savedIds, byId],
  );

  // Joining puts the reader in the roster, so a huddle they started on their
  // own does not report itself as empty.
  const huddleRoster = useMemo(() => {
    const me = myUserId ? memberById.get(myUserId) : undefined;
    if (!huddleJoined || !me) return huddleParticipants;
    return huddleParticipants.some(
      (participant) => participant.userId === me.userId,
    )
      ? huddleParticipants
      : [me, ...huddleParticipants];
  }, [huddleParticipants, huddleJoined, myUserId, memberById]);

  const searchResults = useMemo(() => {
    const needle = searchQuery.trim().toLowerCase();
    if (!needle) return [];
    return messages.filter(
      (message) =>
        !message.isRedacted && message.body.toLowerCase().includes(needle),
    );
  }, [messages, searchQuery]);

  /**
   * Scrolls a message into view and tints it.
   *
   * The timeline is virtualised, so a message far outside the rendered window
   * has no node to scroll to; the highlight is still set, so it is visible the
   * moment the reader scrolls to it. Precise jumping needs the virtualizer's
   * index, which arrives with server-side search.
   */
  const jumpTo = useCallback((messageId: string) => {
    setHighlightId(messageId);
    document
      .querySelector(`[data-message-id="${CSS.escape(messageId)}"]`)
      ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, []);

  const threadRoot = threadRootId ? (byId.get(threadRootId) ?? null) : null;
  const threadReplies = threadRootId
    ? (repliesByRoot.get(threadRootId) ?? [])
    : [];

  const renderMessage = useCallback(
    (message: Message, grouped: boolean) => {
      const replies = repliesByRoot.get(message.id) ?? [];

      return (
        <ChatBubble
          message={message}
          isOwn={message.senderId === myUserId}
          isGrouped={grouped}
          isHighlighted={message.id === highlightId}
          isPinned={pinnedIds.includes(message.id)}
          isSaved={savedIds.includes(message.id)}
          threadReplyCount={replies.length}
          threadParticipants={[
            ...new Set(replies.map((reply) => reply.senderId)),
          ]
            .map((userId) => memberById.get(userId))
            .filter((member): member is RoomMember => !!member)}
          lastReplyAt={
            replies.length > 0
              ? Math.max(...replies.map((reply) => reply.timestamp))
              : undefined
          }
          onReact={
            onReact
              ? (key) =>
                  void onReact(
                    message.id,
                    key,
                    message.reactions.some(
                      (reaction) =>
                        reaction.key === key && reaction.reactedByMe,
                    ),
                  )
              : undefined
          }
          onEdit={onEdit ? () => setEditing(message) : undefined}
          onDelete={onDelete ? () => void onDelete(message.id) : undefined}
          onOpenThread={() => {
            setThreadRootId(message.threadRootId ?? message.id);
            setPanel('thread');
          }}
          onTogglePin={onTogglePin ? () => onTogglePin(message.id) : undefined}
          onToggleSave={
            onToggleSave ? () => onToggleSave(message.id) : undefined
          }
          onCopyText={() => void navigator.clipboard?.writeText(message.body)}
          onCopyLink={() =>
            void navigator.clipboard?.writeText(
              `${window.location.origin}${window.location.pathname}#${message.id}`,
            )
          }
          attachmentSlot={
            message.attachment ? (
              <AttachmentRenderer
                attachment={message.attachment}
                kind={message.kind}
              />
            ) : null
          }
        />
      );
    },
    [
      repliesByRoot,
      memberById,
      myUserId,
      highlightId,
      pinnedIds,
      savedIds,
      onReact,
      onEdit,
      onDelete,
      onTogglePin,
      onToggleSave,
    ],
  );

  const sidePanelTitle =
    panel === 'members'
      ? 'Members'
      : panel === 'search'
        ? 'Search'
        : panel === 'pinned'
          ? `Pinned${pinnedMessages.length ? ` — ${pinnedMessages.length}` : ''}`
          : panel === 'saved'
            ? 'Saved for later'
            : panel === 'threads'
              ? 'Threads'
              : 'Thread';

  const toggle = (next: SidePanel) =>
    setPanel((current) => (current === next ? 'none' : next));

  return (
    <ChatLayout
      banner={banner}
      header={
        <>
          <ChatHeader
            title={title}
            subtitle={subtitle}
            isEncrypted={isEncrypted}
            memberCount={members.length}
            onToggleMembers={() => toggle('members')}
            actions={
              <>
                {/*
                  Starting a huddle only appears when none is running; once one
                  is, `HuddleBar` below owns every huddle control, so the state
                  never has two places to disagree about.
                */}
                {huddleParticipants.length === 0 && !huddleJoined ? (
                  <Hint label="Start a huddle">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Start a huddle"
                      onClick={() => setHuddleJoined(true)}
                    >
                      <Headphones />
                    </Button>
                  </Hint>
                ) : null}

                <Hint label="Threads">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Threads"
                    aria-pressed={panel === 'threads'}
                    onClick={() => toggle('threads')}
                  >
                    <MessagesSquare />
                  </Button>
                </Hint>

                <Hint label="Pinned messages">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Pinned messages"
                    aria-pressed={panel === 'pinned'}
                    onClick={() => toggle('pinned')}
                    leadingIcon={<Pin />}
                  >
                    {pinnedMessages.length > 0 ? (
                      <Badge variant="neutral">{pinnedMessages.length}</Badge>
                    ) : null}
                  </Button>
                </Hint>

                <Hint label="Saved for later">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Saved for later"
                    aria-pressed={panel === 'saved'}
                    onClick={() => toggle('saved')}
                  >
                    <Bookmark />
                  </Button>
                </Hint>

                <Hint label="Search in conversation">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Search in conversation"
                    aria-pressed={panel === 'search'}
                    onClick={() => toggle('search')}
                  >
                    <Search />
                  </Button>
                </Hint>
              </>
            }
          />

          <BookmarksBar bookmarks={bookmarks} onAdd={() => undefined} />

          <HuddleBar
            participants={huddleRoster}
            isJoined={huddleJoined}
            isMuted={huddleMuted}
            onJoin={() => setHuddleJoined(true)}
            onLeave={() => setHuddleJoined(false)}
            onToggleMute={() => setHuddleMuted((muted) => !muted)}
          />
        </>
      }
      sidePanelTitle={sidePanelTitle}
      onCloseSidePanel={() => setPanel('none')}
      sidePanel={
        panel === 'members' ? (
          <MemberList members={members} presenceOf={presenceOf} />
        ) : panel === 'search' ? (
          <ConversationSearch
            query={searchQuery}
            onQueryChange={setSearchQuery}
            results={searchResults}
            onJump={jumpTo}
          />
        ) : panel === 'pinned' ? (
          <PinnedPanel
            messages={pinnedMessages}
            onJump={jumpTo}
            onUnpin={onTogglePin}
          />
        ) : panel === 'saved' ? (
          <SavedPanel
            messages={savedMessages}
            onJump={jumpTo}
            onRemove={onToggleSave}
          />
        ) : panel === 'threads' ? (
          <ThreadListPanel
            threads={threads}
            onOpen={(rootId) => {
              setThreadRootId(rootId);
              setPanel('thread');
            }}
          />
        ) : panel === 'thread' && threadRoot ? (
          <ThreadPanel
            replyCount={threadReplies.length}
            rootSlot={renderMessage(threadRoot, false)}
            repliesSlot={threadReplies.map((reply) => (
              <div key={reply.id}>{renderMessage(reply, false)}</div>
            ))}
            composerSlot={
              <Composer
                members={members}
                showFormatting={false}
                placeholder="Reply in thread…"
                onSend={(body) => onSend(body, threadRoot.id)}
                onTyping={onTyping}
                onAttach={
                  onAttach
                    ? (files) => void onAttach(files, threadRoot.id)
                    : undefined
                }
              />
            }
          />
        ) : null
      }
    >
      <MessageList
        messages={rootMessages}
        isLoading={isLoading}
        isLoadingOlder={isLoadingOlder}
        hasMore={hasMore}
        error={error}
        unreadBeforeId={firstUnreadId}
        onLoadOlder={onLoadOlder}
        renderMessage={renderMessage}
      />

      <TypingIndicator names={typingNames} />

      <Composer
        members={members}
        onTyping={onTyping}
        onAttach={onAttach ? (files) => void onAttach(files) : undefined}
        placeholder={editing ? 'Edit your message…' : `Message ${title}`}
        onSchedule={onSchedule}
        contextSlot={
          editing ? (
            <div className="mb-2 gap-2 px-2 py-1 text-xs flex items-center rounded-md bg-muted">
              <span className="flex-1 truncate">Editing: {editing.body}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
            </div>
          ) : null
        }
        onSend={async (body) => {
          if (editing && onEdit) {
            await onEdit(editing.id, body);
            setEditing(null);
          } else {
            await onSend(body);
          }
        }}
      />
    </ChatLayout>
  );
}
