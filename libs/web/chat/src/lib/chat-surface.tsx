import { useMessageDensity, useOpenChatPosition } from '@org/common';
import {
  AttachmentRenderer,
  ChatHeader,
  ChatLayout,
  ChannelWelcome,
  type ChannelWelcomePeer,
  type ConversationWelcomeKind,
  Composer,
  ConversationSearch,
  HuddleBar,
  MemberList,
  MessageList,
  MessageRenderer,
  PinnedPanel,
  ThreadListPanel,
  ThreadPanel,
  TypingIndicator,
} from '@org/chat-ui';
import type {
  Message,
  PresenceState,
  RoomMember,
  StructuredMessageAction,
} from '@org/matrix-client';
import { attachmentToMediaItem, useMediaPreview } from '@org/media-preview';
import {
  Badge,
  Button,
  DropdownMenuItem,
  Hint,
  useRightPanelStore,
} from '@org/ui';
import { Headphones, Lock, Pin, Search, Users } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { deriveThreads, groupReplies } from './derive-threads.js';

/**
 * Everything the welcome block at the top of the timeline needs that the
 * conversation itself does not already know.
 *
 * Passing it is what turns the block on. Every conversation gets one — a
 * channel, a group, a one-to-one DM, the note-to-self space — so `kind` says
 * which, and the rest is filled in per kind: `peer` for a DM, `createdAt` /
 * `createdByName` for a channel.
 */
export interface ChatSurfaceWelcome {
  /** Defaults to `'channel'`. */
  kind?: ConversationWelcomeKind;
  createdAt?: Date | string | number;
  createdByName?: string;
  description?: string | null;
  isPrivate?: boolean;
  /** The other party, for a `direct` / `self` conversation. */
  peer?: ChannelWelcomePeer;
  onAddPeople?: () => void;
  onEditDescription?: () => void;
  onOpenCopilot?: () => void;
  /** Opens the peer's profile in the right rail — `direct` conversations only. */
  onViewProfile?: () => void;
}

/**
 * A user profile is no longer one of these: it opens in the shell's right rail
 * through `useRightPanelStore`, so it outlives switching conversations.
 */
type SidePanel =
  'none' | 'members' | 'thread' | 'threads' | 'search' | 'pinned';

export interface ChatSurfaceProps {
  title: string;
  subtitle?: string;
  isEncrypted?: boolean;
  banner?: ReactNode;
  myUserId?: string;

  /**
   * Identity of the room/channel currently bound to this surface — the
   * Matrix room id, typically. Lets the surface (and the message list inside
   * it) tell a conversation *switch* apart from this same conversation simply
   * getting new messages, which is what makes scroll-position memory and the
   * message-identity state reset below possible without remounting anything.
   * Left unset while the room is still being resolved.
   */
  conversationId?: string | null;

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
   * Where the conversation's *menu* entries should live.
   *
   * The header only has room for the two controls you reach for mid-sentence —
   * huddle and search. Anything rarer belongs in the channel's existing "⋯"
   * menu, which the page owns, so the page passes the element inside it and the
   * surface portals its items up there rather than opening a second dropdown
   * three pixels from the first.
   */
  headerMenuSlot?: HTMLElement | null;

  /**
   * Whether the roster control belongs in this conversation.
   *
   * A direct message has exactly two people in it and no way to invite a third,
   * so the member count and its panel are noise there — the header would offer
   * to open a list of the person you are already looking at.
   */
  showMembers?: boolean;

  /** Set to introduce the channel above the first message. See {@link ChatSurfaceWelcome}. */
  welcome?: ChatSurfaceWelcome;

  /**
   * Bumped by the host to ask for a huddle — the channel's details panel does
   * it from the right rail. A counter rather than a boolean because the request
   * has to be repeatable, and because the huddle's own state belongs here,
   * beside the bar that renders it.
   */
  huddleRequest?: number;

  huddleParticipants?: RoomMember[];
  pinnedIds?: string[];
  savedIds?: string[];
  firstUnreadId?: string | null;

  /**
   * The open thread, driven by the URL (`?thread=`). Passing it — even as
   * `null` — hands the surface's thread-panel selection to the host; leaving it
   * `undefined` keeps the old purely-local behaviour.
   */
  deepLinkThreadId?: string | null;
  /** Called when the reader opens or closes a thread, so the host can update the URL. */
  onDeepLinkThreadChange?: (threadRootId: string | null) => void;
  /** A message to scroll to and highlight once it is in the timeline (`?msg=`). */
  deepLinkMessageId?: string | null;
  /** Root ids of threads with replies the reader has not caught up to. */
  unreadThreadRootIds?: readonly string[];
  /** Called while a thread panel is open, so the host can mark it read. */
  onThreadRead?: (threadRootId: string) => void;

  /** Offered by the channel welcome block; there is no bookmarks bar. */
  onAddBookmark?: () => void;
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
  onAssignToMe?: (message: Message) => void;
  onCreateTask?: (message: Message) => void;
  onCreateDoc?: (message: Message) => void;
  onAskAI?: (message: Message) => void;
  onSchedule?: (body: string, when: string) => void;
  onAction?: (
    message: Message,
    action: StructuredMessageAction,
  ) => void | Promise<void>;
  onRetryAgent?: (message: Message) => void | Promise<void>;
  onSendCard?: (
    cardId: string,
    version: number,
    data: Record<string, unknown>,
  ) => void | Promise<void>;
}

/**
 * Matrix presence (`online` / `unavailable` / `offline`) narrowed to the
 * status vocabulary `UserAvatar` draws with — `unavailable` reads as "away".
 */
const PRESENCE_FOR_AVATAR: Record<
  PresenceState,
  'online' | 'away' | 'offline'
> = {
  online: 'online',
  away: 'away',
  busy: 'away',
  unavailable: 'away',
  offline: 'offline',
};

export function ChatSurface({
  title,
  subtitle,
  isEncrypted = false,
  banner,
  myUserId,
  conversationId,
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
  headerMenuSlot,
  showMembers = true,
  welcome,
  huddleRequest = 0,
  huddleParticipants = [],
  pinnedIds = [],
  savedIds = [],
  firstUnreadId,
  deepLinkThreadId,
  onDeepLinkThreadChange,
  deepLinkMessageId,
  unreadThreadRootIds,
  onThreadRead,
  onAddBookmark,
  onSend,
  onEdit,
  onDelete,
  onReact,
  onTyping,
  onAttach,
  onTogglePin,
  onToggleSave,
  onAssignToMe,
  onCreateTask,
  onCreateDoc,
  onAskAI,
  onSchedule,
  onAction,
  onRetryAgent,
  onSendCard,
}: ChatSurfaceProps) {
  const messageDensity = useMessageDensity();
  const openPosition = useOpenChatPosition();
  const { openPreview } = useMediaPreview();
  const [panel, setPanel] = useState<SidePanel>('none');
  const [threadRootId, setThreadRootId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Message | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [huddleJoined, setHuddleJoined] = useState(false);
  const [huddleMuted, setHuddleMuted] = useState(false);

  /* Zero is the initial value, not a request — see `huddleRequest`. */
  useEffect(() => {
    if (huddleRequest > 0) setHuddleJoined(true);
  }, [huddleRequest]);

  /*
   * Which thread the URL currently points at, as last reconciled here. Guards
   * the two directions from fighting: the effect below opens the panel when the
   * `?thread=` param changes, and the open/close handlers push the param when
   * the reader acts — without this ref each would re-trigger the other.
   */
  const deepLinkThreadApplied = useRef<string | null | undefined>(undefined);

  const notifyThreadChange = useCallback(
    (rootId: string | null) => {
      if (deepLinkThreadId === undefined) return;
      if (rootId === deepLinkThreadApplied.current) return;
      deepLinkThreadApplied.current = rootId;
      onDeepLinkThreadChange?.(rootId);
    },
    [deepLinkThreadId, onDeepLinkThreadChange],
  );

  const openThreadPanel = useCallback(
    (rootId: string) => {
      setThreadRootId(rootId);
      setPanel('thread');
      notifyThreadChange(rootId);
    },
    [notifyThreadChange],
  );

  /*
   * This surface used to be torn down and rebuilt on every conversation
   * switch — its host unmounted the whole tree while the next room loaded —
   * which reset all of this state for free. Now that the switch happens in
   * place (see `ChatPanel`), state tied to a specific message or room has to
   * be let go explicitly here, or it would carry over pointing at content
   * that no longer belongs to what's on screen: an editor left open on a
   * message from the old room, a "you're in a huddle" indicator for a call
   * already left behind. Which side panel is open (members, search, pinned)
   * is a UI preference, not tied to any one message, so it is left alone —
   * carrying it forward, now showing the new room's own data, is the point.
   */
  useEffect(() => {
    setThreadRootId(null);
    setEditing(null);
    setHighlightId(null);
    setSearchQuery('');
    setHuddleJoined(false);
    setHuddleMuted(false);
    // An open single-thread view has nothing left to show once its root
    // message is gone with it — fall back to the thread list rather than
    // close the panel outright.
    setPanel((current) => (current === 'thread' ? 'threads' : current));
    // Let the URL re-open the right thread for the new conversation (below).
    deepLinkThreadApplied.current = undefined;
  }, [conversationId]);

  /*
   * URL → panel. Runs after the reset above, so on a conversation switch the
   * `?thread=` param wins over the blanket `setThreadRootId(null)`.
   */
  useEffect(() => {
    if (deepLinkThreadId === undefined) return;
    if (deepLinkThreadId === deepLinkThreadApplied.current) return;
    deepLinkThreadApplied.current = deepLinkThreadId;
    if (deepLinkThreadId) {
      setThreadRootId(deepLinkThreadId);
      setPanel('thread');
    } else {
      setThreadRootId(null);
      setPanel((current) => (current === 'thread' ? 'none' : current));
    }
  }, [deepLinkThreadId, conversationId]);

  const byId = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  );

  const memberById = useMemo(
    () => new Map(members.map((member) => [member.userId, member])),
    [members],
  );

  const repliesByRoot = useMemo(() => groupReplies(messages), [messages]);

  // Display names carry spaces, so the message renderer needs the roster to
  // know where a `@mention` ends.
  const mentionNames = useMemo(
    () => [
      'here',
      'channel',
      'everyone',
      ...members.map((member) => member.displayName),
    ],
    [members],
  );

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

  /* `savedIds` still drives each bubble's bookmark toggle; the list of saved
     messages itself now lives on the Saved page in the sidebar. */

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

  /*
   * Deep link to a message (`?msg=`). Waits for the message to actually be in
   * the timeline — it may still be paging in — and only jumps once per id, so a
   * later render does not yank the reader back after they have scrolled away.
   */
  const jumpedToDeepLink = useRef<string | null>(null);
  useEffect(() => {
    if (!deepLinkMessageId) {
      jumpedToDeepLink.current = null;
      return;
    }
    if (deepLinkMessageId === jumpedToDeepLink.current) return;
    if (!byId.has(deepLinkMessageId)) return;
    jumpedToDeepLink.current = deepLinkMessageId;
    jumpTo(deepLinkMessageId);
  }, [deepLinkMessageId, byId, jumpTo]);

  const unreadThreadRoots = useMemo(
    () => new Set(unreadThreadRootIds ?? []),
    [unreadThreadRootIds],
  );

  const threadRoot = threadRootId ? (byId.get(threadRootId) ?? null) : null;
  const threadReplies = threadRootId
    ? (repliesByRoot.get(threadRootId) ?? [])
    : [];

  /* Mark a thread read while its panel is open, and again when a reply lands. */
  useEffect(() => {
    if (panel !== 'thread' || !threadRootId) return;
    onThreadRead?.(threadRootId);
  }, [panel, threadRootId, threadReplies.length, onThreadRead]);

  const openProfilePanel = useRightPanelStore((s) => s.openProfile);

  const handleOpenUserProfile = useCallback(
    (user: {
      userId: string;
      name: string;
      avatarUrl?: string;
      role?: string;
      powerLevel?: number;
    }) => {
      setPanel('none');
      openProfilePanel({
        userId: user.userId,
        name: user.name,
        avatarUrl: user.avatarUrl,
        role: user.role,
        powerLevel: user.powerLevel,
      });
    },
    [openProfilePanel],
  );

  const renderMessage = useCallback(
    (message: Message, grouped: boolean) => {
      const replies = repliesByRoot.get(message.id) ?? [];

      return (
        <MessageRenderer
          message={message}
          isOwn={message.senderId === myUserId}
          isGrouped={grouped}
          density={messageDensity}
          isHighlighted={message.id === highlightId}
          mentionNames={mentionNames}
          isPinned={pinnedIds.includes(message.id)}
          isSaved={savedIds.includes(message.id)}
          threadReplyCount={replies.length}
          threadHasUnread={unreadThreadRoots.has(
            message.threadRootId ?? message.id,
          )}
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
              ? (key: string) =>
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
          onOpenThread={() =>
            openThreadPanel(message.threadRootId ?? message.id)
          }
          onTogglePin={onTogglePin ? () => onTogglePin(message.id) : undefined}
          onToggleSave={
            onToggleSave ? () => onToggleSave(message.id) : undefined
          }
          onAssignToMe={onAssignToMe ? () => onAssignToMe(message) : undefined}
          onCreateTask={onCreateTask ? () => onCreateTask(message) : undefined}
          onCreateDoc={onCreateDoc ? () => onCreateDoc(message) : undefined}
          onAskAI={onAskAI ? () => onAskAI(message) : undefined}
          onAction={
            onAction
              ? (action: StructuredMessageAction) =>
                  void onAction(message, action)
              : undefined
          }
          onRetry={onRetryAgent ? () => void onRetryAgent(message) : undefined}
          onCopyText={() => void navigator.clipboard?.writeText(message.body)}
          onCopyLink={() =>
            void navigator.clipboard?.writeText(
              `${window.location.origin}${window.location.pathname}#${message.id}`,
            )
          }
          attachmentSlot={(() => {
            const attachment = message.attachment;
            if (!attachment) return null;
            return (
              <AttachmentRenderer
                attachment={attachment}
                kind={message.kind}
                onOpen={() =>
                  openPreview([
                    attachmentToMediaItem(attachment, message.kind, message.id, {
                      senderId: message.senderId,
                      senderName: message.senderName,
                      senderAvatarUrl: message.senderAvatarUrl,
                      senderPresence: presenceOf
                        ? PRESENCE_FOR_AVATAR[presenceOf(message.senderId)]
                        : undefined,
                      timestamp: message.timestamp,
                      channelName: title,
                      isEncrypted: isEncrypted || message.isEncrypted,
                    }),
                  ])
                }
              />
            );
          })()}
        />
      );
    },
    [
      repliesByRoot,
      memberById,
      myUserId,
      messageDensity,
      highlightId,
      mentionNames,
      pinnedIds,
      savedIds,
      unreadThreadRoots,
      openThreadPanel,
      onReact,
      onEdit,
      onDelete,
      onTogglePin,
      onToggleSave,
      onAssignToMe,
      onCreateTask,
      onCreateDoc,
      onAskAI,
      onAction,
      onRetryAgent,
      openPreview,
      presenceOf,
      title,
      isEncrypted,
    ],
  );

  const sidePanelTitle =
    panel === 'members'
      ? 'Members'
      : panel === 'search'
        ? 'Search'
        : `Pinned${pinnedMessages.length ? ` — ${pinnedMessages.length}` : ''}`;

  const toggle = (next: SidePanel) =>
    setPanel((current) => {
      const isOpening = current !== next;
      if (isOpening) {
        useRightPanelStore.getState().dismiss();
      }
      return isOpening ? next : 'none';
    });

  /*
   * Threads are the one conversation panel that reads as its own place rather
   * than a lens on the messages beside it — you leave the channel scrolling
   * where it is and work through replies. So it goes to the app's right rail,
   * as its own panel, instead of the in-conversation side column the other
   * four share.
   *
   * The state stays here: the thread composer, the open root and the reply list
   * all belong to this conversation, so the rail publishes an element and this
   * portals into it.
   */
  const inThreads = panel === 'threads' || panel === 'thread';
  const threadsSlot = useRightPanelStore((s) => s.slots.threads);
  const openHosted = useRightPanelStore((s) => s.openHosted);
  const closeHosted = useRightPanelStore((s) => s.closeHosted);

  const closeThreads = useCallback(() => {
    setPanel('none');
    setThreadRootId(null);
    notifyThreadChange(null);
  }, [notifyThreadChange]);

  useEffect(() => {
    if (!inThreads) return;
    openHosted('threads', {
      title: panel === 'thread' ? 'Thread' : 'Threads',
      onClose: closeThreads,
    });
    return () => closeHosted('threads');
  }, [inThreads, panel, closeThreads, openHosted, closeHosted]);

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

      {/*
        Threads, pinned and saved used to sit here too, which made five icons
        plus a member stack in a row that also has to hold the channel name.
        Threads is a sidebar destination and opens in the right rail from any
        message; saved is a sidebar destination; pinned moved into the channel's
        "⋯" menu below. What is left is the two you reach for mid-sentence.
      */}
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

  /*
   * Portalled into the host's own "⋯" menu. Radix finds its items by querying
   * the content element's DOM, so items rendered into a container inside it
   * still take part in keyboard navigation — which is what makes this work
   * rather than needing a second dropdown of our own.
   */
  const headerMenuItems = (
    <DropdownMenuItem
      className="justify-between"
      onSelect={() => toggle('pinned')}
    >
      <span className="gap-2.5 flex items-center">
        <Pin className="size-4" />
        <span>Pinned messages</span>
      </span>
      {pinnedMessages.length > 0 ? (
        <Badge variant="neutral">{pinnedMessages.length}</Badge>
      ) : null}
    </DropdownMenuItem>
  );

  return (
    <ChatLayout
      banner={banner}
      header={
        <>
          {headerMenuSlot
            ? createPortal(headerMenuItems, headerMenuSlot)
            : null}

          {headerActionsSlot ? (
            createPortal(
              <div className="gap-0.5 flex items-center text-muted-foreground">
                {isEncrypted ? (
                  <Hint label="End-to-end encrypted">
                    <Lock
                      className="size-3.5 shrink-0"
                      aria-label="End-to-end encrypted"
                    />
                  </Hint>
                ) : null}

                {headerActions}

                {/* The member stack and its panel moved to the right rail's
                    channel details, which lists them with room to search. */}
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
              onToggleMembers={
                showMembers ? () => toggle('members') : undefined
              }
              actions={headerActions}
            />
          )}

          {/*
            A bookmarks strip used to sit here, under the header. Channels show
            their bookmarks in a tab of their own — this was the same links a
            second time, in a horizontal scroller, costing a row of height on
            every conversation. The huddle bar that sat under it is a floating
            dock now, so the header is the header alone.
          */}
        </>
      }
      sidePanelTitle={sidePanelTitle}
      onCloseSidePanel={() => setPanel('none')}
      sidePanel={
        panel === 'search' ? (
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
        ) : panel === 'members' ? (
          <MemberList
            members={members}
            presenceOf={presenceOf}
            onSelect={(member) =>
              handleOpenUserProfile({
                userId: member.userId,
                name: member.displayName,
                avatarUrl: member.avatarUrl,
                powerLevel: member.powerLevel,
              })
            }
          />
        ) : null
      }
    >
      <div className="min-h-0 relative flex flex-1 flex-col overflow-hidden">
        {/*
          The huddle bar opens full-width in the shell's dock below all three
          columns — it portals into `HuddleDock`, so where it sits in this tree
          does not place it. The state lives here because the huddle is this
          conversation's; the button that starts one is in the header.
        */}
        <HuddleBar
          participants={huddleRoster}
          isJoined={huddleJoined}
          isMuted={huddleMuted}
          onJoin={() => setHuddleJoined(true)}
          onLeave={() => setHuddleJoined(false)}
          onToggleMute={() => setHuddleMuted((muted) => !muted)}
        />

        {/* Threads live in the app's right rail — see the note by `inThreads`. */}
        {inThreads && threadsSlot
          ? createPortal(
              panel === 'thread' && threadRoot ? (
                <ThreadPanel
                  replyCount={threadReplies.length}
                  rootSlot={renderMessage(threadRoot, false)}
                  repliesSlot={threadReplies.map((reply) => (
                    <div key={reply.id}>{renderMessage(reply, false)}</div>
                  ))}
                  composerSlot={
                    <Composer
                      conversationId={
                        conversationId
                          ? `${conversationId}-thread-${threadRoot.id}`
                          : null
                      }
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
              ) : (
                <ThreadListPanel
                  threads={threads}
                  onOpen={(rootId) => openThreadPanel(rootId)}
                />
              ),
              threadsSlot,
            )
          : null}

        {/* No `overflow` here: the list owns its own scroller, and nesting one
          inside another gave the timeline two scrollbars. */}
        <div className="min-h-0 flex flex-1 flex-col">
          <MessageList
            conversationId={conversationId}
            messages={rootMessages}
            isLoading={isLoading}
            isLoadingOlder={isLoadingOlder}
            hasMore={hasMore}
            error={error}
            unreadBeforeId={firstUnreadId}
            density={messageDensity}
            openPosition={openPosition}
            onLoadOlder={onLoadOlder}
            renderMessage={renderMessage}
            introSlot={
              welcome ? (
                <ChannelWelcome
                  kind={welcome.kind}
                  channelName={title}
                  isPrivate={welcome.isPrivate ?? isEncrypted}
                  createdAt={welcome.createdAt}
                  createdByName={welcome.createdByName}
                  description={
                    welcome.description ??
                    (!welcome.kind || welcome.kind === 'channel'
                      ? subtitle
                      : undefined)
                  }
                  members={members}
                  memberCount={members.length}
                  peer={welcome.peer}
                  onAddPeople={welcome.onAddPeople}
                  onEditDescription={welcome.onEditDescription}
                  onOpenCopilot={welcome.onOpenCopilot}
                  onViewProfile={welcome.onViewProfile}
                  onAddBookmark={
                    !welcome.kind || welcome.kind === 'channel'
                      ? onAddBookmark
                      : undefined
                  }
                  onStartHuddle={
                    welcome.kind === 'self' ||
                    welcome.peer?.kind === 'agent' ||
                    welcome.peer?.kind === 'app'
                      ? undefined
                      : () => setHuddleJoined(true)
                  }
                />
              ) : null
            }
          />
        </div>

        <div className="bottom-0 sticky z-20 w-full shrink-0 bg-background">
          <TypingIndicator names={typingNames} />
          <Composer
            conversationId={conversationId}
            members={members}
            onTyping={onTyping}
            onAttach={onAttach ? (files) => void onAttach(files) : undefined}
            placeholder={editing ? 'Edit your message…' : `Message ${title}`}
            onSchedule={onSchedule}
            onSendCard={onSendCard}
            contextSlot={
              editing ? (
                <div className="mb-2 gap-2 px-2 py-1 text-xs flex items-center rounded-md bg-muted">
                  <span className="flex-1 truncate">
                    Editing: {editing.body}
                  </span>
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
