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
  UserProfileRightPanel,
  type ChannelBookmark,
} from '@org/chat-ui';
import type { Message, PresenceState, RoomMember } from '@org/matrix-client';
import { Badge, Button, Hint } from '@org/ui';
import {
  Bookmark,
  Headphones,
  Lock,
  MessagesSquare,
  Pin,
  Search,
  Users,
} from 'lucide-react';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { deriveThreads, groupReplies } from './derive-threads.js';

type SidePanel =
  | 'none'
  | 'members'
  | 'thread'
  | 'threads'
  | 'search'
  | 'pinned'
  | 'saved'
  | 'user-profile';

export interface ChatSurfaceProps {
  title: string;
  subtitle?: string;
  isEncrypted?: boolean;
  banner?: ReactNode;
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

  /**
   * Where the conversation's action buttons should live.
   *
   * A page that already renders its own channel header (the channel page does)
   * passes the element it reserved for them: the surface then drops its own
   * header and portals the actions up there, so the channel is titled once
   * instead of twice. Left unset — direct messages, for one — the surface keeps
   * rendering the header itself.
   */
  headerActionsSlot?: HTMLElement | null;

  /**
   * Whether the roster control belongs in this conversation.
   *
   * A direct message has exactly two people in it and no way to invite a third,
   * so the member count and its panel are noise there — the header would offer
   * to open a list of the person you are already looking at.
   */
  showMembers?: boolean;

  bookmarks?: ChannelBookmark[];
  huddleParticipants?: RoomMember[];
  pinnedIds?: string[];
  savedIds?: string[];
  firstUnreadId?: string | null;

  onAddBookmark?: () => void;
  onRemoveBookmark?: (id: string) => void;
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
  onSchedule?: (body: string, when: string) => void;
}

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
  headerActionsSlot,
  showMembers = true,
  bookmarks = [],
  huddleParticipants = [],
  pinnedIds = [],
  savedIds = [],
  firstUnreadId,
  onAddBookmark,
  onRemoveBookmark,
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
  const [selectedUser, setSelectedUser] = useState<{
    userId: string;
    name: string;
    avatarUrl?: string;
    role?: string;
    powerLevel?: number;
  } | null>(null);
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

  const repliesByRoot = useMemo(() => groupReplies(messages), [messages]);

  const rootMessages = useMemo(
    () => messages.filter((message) => !message.threadRootId),
    [messages],
  );

  const threads = useMemo(
    () =>
      deriveThreads(messages, members, {
        myUserId,
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

  const handleOpenUserProfile = useCallback((user: {
    userId: string;
    name: string;
    avatarUrl?: string;
    role?: string;
    powerLevel?: number;
  }) => {
    setSelectedUser(user);
    setPanel('user-profile');
  }, []);

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
      : panel === 'user-profile'
        ? selectedUser ? selectedUser.name : 'User Profile'
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

  const headerActions = (
    <>
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
  );

  return (
    <ChatLayout
      banner={banner}
      header={
        <>
          {headerActionsSlot ? (
            createPortal(
              <div className="flex items-center gap-0.5 text-muted-foreground">
                {isEncrypted ? (
                  <Hint label="End-to-end encrypted">
                    <Lock
                      className="size-3.5 shrink-0"
                      aria-label="End-to-end encrypted"
                    />
                  </Hint>
                ) : null}

                {headerActions}

                {showMembers ? (
                  <Hint label="Channel Members">
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label="Channel Members"
                      aria-pressed={panel === 'members'}
                      onClick={() => toggle('members')}
                      leadingIcon={<Users />}
                    >
                      {members.length}
                    </Button>
                  </Hint>
                ) : null}
              </div>,
              headerActionsSlot,
            )
          ) : (
            <ChatHeader
              title={title}
              subtitle={subtitle}
              isEncrypted={isEncrypted}
              memberCount={showMembers ? members.length : undefined}
              onToggleMembers={showMembers ? () => toggle('members') : undefined}
              actions={headerActions}
            />
          )}

          <BookmarksBar
            bookmarks={bookmarks}
            onAdd={onAddBookmark}
            onRemove={onRemoveBookmark}
          />

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
        panel === 'user-profile' && selectedUser ? (
          <UserProfileRightPanel
            userId={selectedUser.userId}
            name={selectedUser.name}
            avatarUrl={selectedUser.avatarUrl}
            role={selectedUser.role}
            powerLevel={selectedUser.powerLevel}
          />
        ) : panel === 'members' ? (
          <MemberList
            members={members}
            presenceOf={presenceOf}
            onSelect={(m) =>
              handleOpenUserProfile({
                userId: m.userId,
                name: m.displayName,
                avatarUrl: m.avatarUrl,
                powerLevel: m.powerLevel,
                role: m.powerLevel >= 100 ? 'Admin' : m.powerLevel >= 50 ? 'Moderator' : 'Member',
              })
            }
          />
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
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative">
      {/* No `overflow` here: the list owns its own scroller, and nesting one
          inside another gave the timeline two scrollbars. */}
      <div className="flex-1 min-h-0 flex flex-col">
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
      </div>

      <div className="shrink-0 sticky bottom-0 z-20 w-full bg-surface-raised border-t border-border/50">
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
      </div>
    </div>
    </ChatLayout>
  );
}
