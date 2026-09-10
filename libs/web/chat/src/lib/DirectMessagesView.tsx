import { useCurrentUser } from '@org/auth';
import { AddBookmarkDialog, Composer } from '@org/chat-ui';
import { useUserPresenceMap } from '@org/realtime';
import type { ChannelSummary, RoomMember, WorkspaceMember } from '@org/types';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
  EmptyState,
  ErrorState,
  Field,
  Hint,
  Input,
  LoadingState,
  ScrollArea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
  toPresenceStatus,
  UserAvatar,
  useRightPanelStore,
} from '@org/ui';
import { cn } from '@org/utils';
import { useMembers } from '@org/web-members';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Bell,
  BellOff,
  Blocks,
  Bookmark,
  Bot,
  Check,
  Copy,
  ExternalLink,
  FolderOpen,
  Hash,
  Mail,
  MessageSquare,
  MessageSquareOff,
  MoreHorizontal,
  Phone,
  Pin,
  Plus,
  RefreshCw,
  SquarePen,
  Star,
  Trash2,
  UserRound,
  Users,
  Video,
  X,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChatPanel } from './chat-panel.js';
import { ConversationFilesPanel } from './conversation-files-panel.js';
import { GroupConversation } from './GroupConversation.js';
import { useMatrix } from './matrix-provider.js';
import {
  NewMessageRecipients,
  type RecipientChannel,
  type RecipientPerson,
} from './new-message-recipients.js';
import { peerKindOf } from './peer-kind.js';
import { useCall } from './use-call.js';
import { useChannelRoom } from './use-channel-room.js';
import { useCreateConversation } from './use-create-conversation.js';
import { useDirectMessageBookmarks } from './use-dm-bookmarks.js';
import { useDirectRoom } from './use-direct-room.js';
import { useDirectMessagePreferences } from './use-dm-preferences.js';

/**
 * A direct message, laid out like a channel.
 *
 * The conversation is the page: header, then the full-height chat surface —
 * the same shape `ChannelPage` has, so a DM and a channel read and behave the
 * same way. There is deliberately no people list beside it; the workspace
 * sidebar already lists everyone, and a second roster inside the page made the
 * DM the only conversation in the app with its own nav.
 *
 * What a DM does not get is membership: it is one-to-one for its whole life,
 * so there is no roster control, no invite, and no join.
 */
export interface DirectMessagesViewProps {
  /**
   * AI agents and connected apps, pre-shaped as `WorkspaceMember`s (id
   * prefixed `agent-`/`app-`) so the picker and the open conversation list
   * them alongside teammates. Supplied by the host rather than fetched in
   * here: `web-chat` has no dependency on `web-agents`/`web-integrations` —
   * both of those already depend on `web-chat` for `ChatPanel`, so the
   * reverse import would be circular. See `apps/web`'s route for the DM page.
   */
  extraPeers?: WorkspaceMember[];
  /**
   * The viewer's channels, for the "New message" recipient field — pick one to
   * post there instead of opening a DM. Passed in by the host for the same
   * layering reason as `extraPeers`: `web-chat` sits below `web-channels`.
   */
  channels?: ChannelSummary[];
}

export function DirectMessagesView({
  extraPeers,
  channels,
}: DirectMessagesViewProps = {}) {
  const [searchParams] = useSearchParams();
  const { peerId: routePeerId } = useParams<{ peerId?: string }>();
  // `/dms/:peerId` is the 1:1 deep link; `?user=` is the old query form,
  // still honoured for links persisted server-side (search, notifications).
  const peerId = routePeerId ?? searchParams.get('user');
  const roomId = searchParams.get('room');

  // `?room=` is a group DM — it has no single peer to key on, so it is
  // addressed by its Matrix room id.
  if (roomId) {
    return <GroupConversation roomId={roomId} extraPeers={extraPeers} />;
  }

  return peerId ? (
    <DirectConversation peerId={peerId} extraPeers={extraPeers} />
  ) : (
    <NewDirectMessage extraPeers={extraPeers} channels={channels} />
  );
}

/**
 * One person's conversation.
 *
 * Not remounted when `?user=` changes to a different peer: `useDirectRoom` and
 * `useRoom` both react to the id changing on their own — subscribing to the
 * new room and detaching from the old one is already what their effects'
 * cleanup does — so forcing a remount around it would only tear down and
 * rebuild the header, composer and layout for no correctness reason, which is
 * exactly the flicker switching people used to cause. See `ChatPanel`.
 */
function DirectConversation({
  peerId,
  extraPeers,
}: {
  peerId: string;
  extraPeers?: WorkspaceMember[];
}) {
  const { workspaceId } = useCurrentWorkspace();
  const members = useMembers(workspaceId);
  const { enabled } = useMatrix();
  const currentUser = useCurrentUser();
  const openProfile = useRightPanelStore((s) => s.openProfile);

  // Resolved once here and reused: `DirectRoom` also calls `useDirectRoom` for
  // the same peer, but it is one React Query keyed on the peer id with an
  // infinite stale time, so the second call is a cache hit — not a second round
  // of room provisioning. The tab strip's Files & Media panel needs the room id
  // too, and hooks cannot run after the early returns below.
  const { roomId } = useDirectRoom(peerId);

  // Mirrors `ChannelPage`: the conversation is one tab beside Files & Media and
  // Pins, so a DM and a channel carry the same chrome.
  const [activeTab, setActiveTab] = useState('chat');

  // Callback ref, not `useRef`: the conversation only portals its tools into
  // this element once it exists, and a render has to be triggered when it does.
  const [chatActionsSlot, setChatActionsSlot] = useState<HTMLDivElement | null>(
    null,
  );

  // Private, per-browser bookmarks — the same affordance a channel has, keyed
  // on the peer so they survive the room resolving and follow the person, not
  // the Matrix room. Only 1:1 conversations get this; a group DM
  // (`GroupConversation`) has no tab strip.
  const { bookmarks, addBookmark, removeBookmark } = useDirectMessageBookmarks(
    workspaceId,
    peerId,
  );
  const [addBookmarkOpen, setAddBookmarkOpen] = useState(false);

  const allMembers = useMemo(
    () => [...(members.data ?? []), ...(extraPeers ?? [])],
    [members.data, extraPeers],
  );

  const member = allMembers.find((entry) => entry.user.id === peerId);

  if (members.isLoading)
    return <LoadingState fullPage label="Opening conversation…" />;

  if (members.isError) {
    return (
      <ErrorState
        fullPage
        title="Could not load this conversation"
        description="The member list for this workspace is unavailable."
        onRetry={() => members.refetch()}
      />
    );
  }

  if (!member) {
    return (
      <ErrorState
        fullPage
        title="Person not found"
        description="They may have left this workspace, or the link is out of date."
      />
    );
  }

  const name = member.user.displayName ?? member.user.name;
  const isSelf = member.user.id === currentUser?.id;
  const peerKind = peerKindOf(member.user.id);

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      <DirectMessageHeader
        member={member}
        isSelf={isSelf}
        roomId={roomId}
        onAddBookmark={() => setAddBookmarkOpen(true)}
        chatActionsRef={setChatActionsSlot}
      />

      <AddBookmarkDialog
        open={addBookmarkOpen}
        onOpenChange={setAddBookmarkOpen}
        onAdd={addBookmark}
        description={
          isSelf
            ? 'Keep a link handy in your personal space. Only you can see it, on this device.'
            : `Save a link from your conversation with ${name}. Only you can see it, on this device.`
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="min-h-0 gap-0 flex flex-1 flex-col"
      >
        <div className="px-3 sm:px-6 py-1 gap-1 flex items-center border-b border-border bg-background">
          <TabsList className="scrollbar-none overflow-x-auto">
            <TabsTrigger value="chat" className="gap-1.5">
              <MessageSquare className="size-4 inline" /> Messages
            </TabsTrigger>
            <TabsTrigger value="files-media" className="gap-1.5">
              <FolderOpen className="size-4 inline" /> Files &amp; Media
            </TabsTrigger>
            <TabsTrigger value="bookmarks" className="gap-1.5">
              <Bookmark className="size-4 inline" /> Bookmarks
              {bookmarks.length > 0 ? (
                <Badge
                  variant="neutral"
                  className="ml-0.5 px-1 py-0 text-[10px]"
                >
                  {bookmarks.length}
                </Badge>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="pins" className="gap-1.5">
              <Pin className="size-4 inline" /> Pins
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          value="chat"
          className="min-h-0 flex flex-1 flex-col overflow-hidden"
        >
          {!enabled ? (
            <EmptyState
              size="lg"
              icon={<MessageSquareOff />}
              title="Chat is not configured"
              description="This deployment has no Matrix homeserver. Set MATRIX_ENABLED and the homeserver settings to turn on direct messages."
            />
          ) : (
            <DirectRoom
              peerId={member.user.id}
              name={name}
              presence={member.user.presence}
              avatarUrl={member.user.avatarUrl}
              isSelf={isSelf}
              peerKind={peerKind}
              onViewProfile={
                isSelf
                  ? undefined
                  : () =>
                      openProfile({
                        userId: member.user.id,
                        name,
                        avatarUrl: member.user.avatarUrl ?? undefined,
                        role: member.role,
                        timezone: member.user.timezone,
                        statusEmoji: member.user.statusEmoji,
                        statusText: member.user.statusText,
                      })
              }
              headerActionsSlot={chatActionsSlot}
            />
          )}
        </TabsContent>

        <TabsContent
          value="files-media"
          className="min-h-0 flex flex-1 flex-col"
        >
          <ConversationFilesPanel
            context={{ type: 'DIRECT', id: peerId }}
            roomId={roomId}
            workspaceId={workspaceId}
            enabled={enabled}
            currentUserId={currentUser?.id}
          />
        </TabsContent>

        {/* Bookmarks tab — `ChannelPage`'s counterpart, private to the reader
            and scoped to this one person. */}
        <TabsContent value="bookmarks" className="min-h-0 flex flex-1 flex-col">
          <ScrollArea
            className="min-h-0 flex-1"
            contentClassName="px-4 sm:px-6 py-4 space-y-4"
          >
            <div className="pb-3 flex items-center justify-between border-b border-border/60">
              <div>
                <h3 className="text-sm font-semibold gap-2 flex items-center text-foreground">
                  <Bookmark className="size-4 text-primary" />
                  <span>{isSelf ? 'Saved links' : 'My Bookmarks'}</span>
                </h3>
                <p className="text-xs mt-0.5 text-muted-foreground">
                  {isSelf
                    ? 'Links and resources you keep in your personal space — only visible to you, on this device.'
                    : `Links and resources you've saved from your conversation with ${name} — only visible to you, on this device.`}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setAddBookmarkOpen(true)}
                className="gap-1.5 text-xs h-7"
              >
                <Plus className="size-3.5" />
                <span>Add bookmark</span>
              </Button>
            </div>

            {bookmarks.length === 0 ? (
              <EmptyState
                icon={<Bookmark />}
                title="No bookmarks yet"
                description="Save links, spreadsheets, Figma designs, and docs from this conversation for quick access. Only you can see them, on this device."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddBookmarkOpen(true)}
                  >
                    Add first bookmark
                  </Button>
                }
              />
            ) : (
              <div className="gap-3 sm:grid-cols-2 lg:grid-cols-3 grid">
                {bookmarks.map((bm) => (
                  <div
                    key={bm.id}
                    className="group p-3 relative flex items-start justify-between rounded-card border border-border bg-surface shadow-xs transition-all hover:border-border-strong hover:bg-surface-raised"
                  >
                    <a
                      href={bm.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 gap-2.5 flex flex-1 items-start outline-none"
                    >
                      <div className="size-8 text-base flex shrink-0 items-center justify-center rounded-md border border-border bg-surface-raised">
                        {bm.emoji || '🔗'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate text-foreground transition-colors group-hover:text-primary">
                          {bm.label}
                        </p>
                        <p className="text-xs mt-0.5 truncate text-muted-foreground">
                          {bm.href}
                        </p>
                      </div>
                    </a>

                    <div className="gap-1 flex items-center opacity-0 transition-opacity group-hover:opacity-100">
                      <a
                        href={bm.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded text-muted-foreground hover:text-foreground"
                        aria-label="Open link"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => removeBookmark(bm.id)}
                        className="p-1 rounded text-muted-foreground hover:text-destructive"
                        aria-label="Remove bookmark"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="pins" className="min-h-0 flex flex-1 flex-col">
          <ScrollArea className="min-h-0 flex-1" contentClassName="px-6 py-4">
            <EmptyState
              icon={<Pin />}
              title="Nothing pinned"
              description="Pin important messages in this conversation so they stay easy to find."
            />
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Binds the peer to their Matrix room, then hands it to the same surface a
 * channel uses — minus the roster, which a two-person room has no use for.
 */
function DirectRoom({
  peerId,
  name,
  presence,
  avatarUrl,
  isSelf = false,
  peerKind = 'person',
  onViewProfile,
  headerActionsSlot,
}: {
  peerId: string;
  name: string;
  presence?: string | null;
  avatarUrl?: string | null;
  /** True for the note-to-self conversation. */
  isSelf?: boolean;
  peerKind?: 'person' | 'agent' | 'app';
  /** Opens the peer's profile in the right rail. Omitted for note-to-self. */
  onViewProfile?: () => void;
  headerActionsSlot: HTMLElement | null;
}) {
  const { workspaceId } = useCurrentWorkspace();
  const { roomId, error } = useDirectRoom(peerId);

  if (error) {
    return (
      <ErrorState
        title={`Could not open the chat with ${name}`}
        description={error}
      />
    );
  }

  /*
   * `roomId` is null on every switch to a peer whose room has not been
   * resolved yet, not only the first. `ChatPanel` renders through that
   * instead of being swapped out for a `LoadingState` here — see the note by
   * `DirectRoom`'s caller, and `ChatPanel`'s `isConnecting`.
   */
  return (
    <ChatPanel
      roomId={roomId}
      title={name}
      subtitle={
        isSelf
          ? 'Your space'
          : presence === 'ONLINE'
            ? 'Online'
            : 'Direct message'
      }
      workspaceId={workspaceId}
      headerActionsSlot={headerActionsSlot}
      showMembers={false}
      showEncryptedBadge={false}
      welcome={{
        kind: isSelf ? 'self' : 'direct',
        peer: {
          name,
          userId: peerId,
          avatarUrl,
          presence,
          kind: peerKind,
        },
        onViewProfile,
      }}
    />
  );
}

/**
 * The DM's title row — `ChannelHeader`'s counterpart, and the same height and
 * padding, so moving between a channel and a DM does not move the page.
 *
 * The channel header's membership controls (join, member avatars, archive) have
 * no meaning here and are left out rather than shown disabled. What it does
 * share is the per-conversation controls — favorite and the overflow menu — so
 * a DM is not the one conversation in the app you cannot star or mute.
 */
function DirectMessageHeader({
  member,
  isSelf = false,
  roomId,
  onAddBookmark,
  chatActionsRef,
}: {
  member: WorkspaceMember;
  /**
   * The note-to-self conversation. It is pinned to the top of the sidebar and
   * has nowhere to be dismissed to, so it never offers "Close conversation" —
   * it is always there.
   */
  isSelf?: boolean;
  /** The resolved Matrix room id, required to start a 1:1 call. */
  roomId?: string | null;
  /** Opens the "Add bookmark" dialog — mirrors `ChannelHeader`'s menu entry. */
  onAddBookmark?: () => void;
  chatActionsRef: (element: HTMLDivElement | null) => void;
}) {
  const { workspaceId, slug: workspaceSlug } = useCurrentWorkspace();
  const preferences = useDirectMessagePreferences(workspaceId);
  const openProfilePanel = useRightPanelStore((s) => s.openProfile);
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const { state: callState, startCall } = useCall();

  const canCall =
    !isSelf &&
    !member.user.id.startsWith('agent-') &&
    !member.user.id.startsWith('app-') &&
    Boolean(roomId);

  const handleStartVoiceCall = useCallback(async () => {
    if (!roomId) {
      toast.error('Conversation is still connecting');
      return;
    }
    try {
      await startCall(roomId, 'voice');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Could not start voice call', { description: message });
    }
  }, [roomId, startCall]);

  const handleStartVideoCall = useCallback(async () => {
    if (!roomId) {
      toast.error('Conversation is still connecting');
      return;
    }
    try {
      await startCall(roomId, 'video');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Could not start video call', { description: message });
    }
  }, [roomId, startCall]);

  // Live presence, exactly as the sidebar's DM row reads it — the avatar's
  // status dot was bound to `member.user.presence`, a snapshot from the members
  // query that never updates, so it sat on whatever the peer's state was when
  // the roster loaded (usually "offline"). The realtime map is the same source
  // the sidebar dot uses; the snapshot stays as the fallback.
  const presenceMap = useUserPresenceMap();
  const name = member.user.displayName ?? member.user.name;
  const presence =
    presenceMap[member.user.id]?.status ??
    toPresenceStatus(member.user.presence);
  const slug = workspaceSlug || 'default';

  const isFavorite = preferences.isFavorite(member.user.id);
  const isMuted = preferences.isMuted(member.user.id);

  const handleOpenProfile = () => {
    openProfilePanel({
      userId: member.user.id,
      name,
      avatarUrl: member.user.avatarUrl ?? undefined,
      // No email: `PublicUser` is the public projection and deliberately
      // withholds it. The profile panel treats it as optional.
      role: member.role,
      timezone: member.user.timezone,
      statusEmoji: member.user.statusEmoji,
      statusText: member.user.statusText,
      status:
        presence === 'online'
          ? 'online'
          : presence === 'away'
            ? 'unavailable'
            : 'offline',
    });
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/w/${slug}/dms/${member.user.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link copied', {
      description: 'Conversation link copied to clipboard.',
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggleFavorite = () => {
    preferences.toggleFavorite(member.user.id);
    toast.success(
      isFavorite ? 'Removed from favorites' : 'Added to favorites',
      { description: `${name} · direct message` },
    );
  };

  const handleToggleMuted = () => {
    preferences.toggleMuted(member.user.id);
    toast.success(isMuted ? 'Conversation unmuted' : 'Conversation muted', {
      description: isMuted
        ? `You will be notified about new messages from ${name}.`
        : `New messages from ${name} will not notify you.`,
    });
  };

  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncConversation = useCallback(() => {
    setIsSyncing(true);
    toast.success('Conversation synchronized', {
      description: 'Matrix timeline and peer presence updated.',
    });
    setTimeout(() => setIsSyncing(false), 800);
  }, []);

  return (
    <div className="top-0 backdrop-blur-md sticky z-20 shrink-0 border-b border-border bg-background/95">
      <div className="gap-2.5 px-3 sm:px-6 py-1.5 min-h-12 flex flex-wrap items-center justify-between">
        <div className="min-w-0 gap-2 flex items-center">
          <div className="min-w-0 gap-2 flex items-center">
            <button
              type="button"
              onClick={handleOpenProfile}
              className="gap-2 p-1 -m-1 flex cursor-pointer items-center rounded-md text-left transition-colors hover:bg-accent/60 focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
              aria-label={`View ${name}'s profile`}
            >
              <UserAvatar
                name={name}
                src={member.user.avatarUrl}
                seed={member.user.id}
                presence={presence}
                size="sm"
                className="size-7"
              />
              <h2 className="text-base font-semibold tracking-tight truncate text-foreground">
                {name}
              </h2>
            </button>
            {member.user.statusEmoji ? (
              <span
                className="text-xs select-none"
                title={
                  member.user.statusText
                    ? `${member.user.statusEmoji} ${member.user.statusText}`
                    : undefined
                }
              >
                {member.user.statusEmoji}
              </span>
            ) : null}
            {member.user.id.startsWith('agent-') ? (
              <Badge
                variant="primary"
                className="gap-0.5 py-0 h-4 font-bold tracking-wider text-[9px] uppercase"
              >
                <Bot className="size-2.5 mr-0.5 inline-block" />
                <span>AI AGENT</span>
              </Badge>
            ) : member.user.id.startsWith('app-') ? (
              <Badge
                variant="neutral"
                className="gap-0.5 py-0 h-4 font-bold tracking-wider border-accent-violet/20 bg-accent-violet-soft text-[9px] text-accent-violet uppercase"
              >
                <Blocks className="size-2.5 mr-0.5 inline-block" />
                <span>APP</span>
              </Badge>
            ) : null}
            {isMuted ? (
              <Badge variant="neutral" className="gap-1 text-muted-foreground">
                <BellOff className="size-3" />
                <span>Muted</span>
              </Badge>
            ) : null}
          </div>

          <div className="gap-0.5 flex items-center">
            {/* 1. Fav icon */}
            <Hint
              label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            >
              <Button
                variant="ghost"
                size="icon-sm"
                aria-pressed={isFavorite}
                aria-label={
                  isFavorite ? 'Remove from favorites' : 'Add to favorites'
                }
                onClick={handleToggleFavorite}
                className={isFavorite ? 'text-warning' : undefined}
              >
                <Star
                  className={cn(
                    'size-4',
                    isFavorite && 'fill-current text-accent-amber',
                  )}
                />
              </Button>
            </Hint>

            {/* 2. 3-dot dropdown menu */}
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Conversation options"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" className="w-64">
                <DropdownMenuItem
                  onClick={handleCopyLink}
                  className="justify-between"
                >
                  <div className="gap-2.5 flex items-center">
                    {copied ? (
                      <Check className="size-4 text-success-text" />
                    ) : (
                      <Copy className="size-4" />
                    )}
                    <span>{copied ? 'Link copied!' : 'Copy link'}</span>
                  </div>
                  <DropdownMenuShortcut>C</DropdownMenuShortcut>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleSyncConversation}
                  className="justify-between"
                >
                  <div className="gap-2.5 flex items-center">
                    <RefreshCw
                      className={cn('size-4', isSyncing && 'animate-spin')}
                    />
                    <span>Sync conversation</span>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleOpenProfile}
                  className="gap-2.5 cursor-pointer"
                >
                  <UserRound className="size-4" />
                  <span>Open profile & details</span>
                </DropdownMenuItem>

                {onAddBookmark ? (
                  <DropdownMenuItem
                    onClick={onAddBookmark}
                    className="justify-between"
                  >
                    <div className="gap-2.5 flex items-center">
                      <Bookmark className="size-4" />
                      <span>Add bookmark</span>
                    </div>
                    <DropdownMenuShortcut>B</DropdownMenuShortcut>
                  </DropdownMenuItem>
                ) : null}

                <DropdownMenuSeparator />

                <DropdownMenuItem className="justify-between">
                  <div className="gap-2.5 flex items-center">
                    <Mail className="size-4" />
                    <span>Mark as unread</span>
                  </div>
                  <DropdownMenuShortcut>U</DropdownMenuShortcut>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={handleToggleFavorite}
                  className="justify-between"
                >
                  <div className="gap-2.5 flex items-center">
                    <Star
                      className={cn(
                        'size-4',
                        isFavorite && 'fill-current text-accent-amber',
                      )}
                    />
                    <span>{isFavorite ? 'Remove Favorite' : 'Favorite'}</span>
                  </div>
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={handleToggleMuted}
                  description={
                    isMuted
                      ? 'Turn notifications for this conversation back on.'
                      : 'Keep the conversation in your sidebar without being notified.'
                  }
                >
                  {isMuted ? (
                    <Bell className="size-4" />
                  ) : (
                    <BellOff className="size-4" />
                  )}
                  <span>
                    {isMuted ? 'Unmute conversation' : 'Mute conversation'}
                  </span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => navigate(`/w/${slug}/settings/notifications`)}
                  className="gap-2.5"
                >
                  <Bell className="size-4" />
                  <span>Notification settings</span>
                </DropdownMenuItem>

                {canCall ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={handleStartVoiceCall}
                      disabled={callState !== null && callState !== 'ended'}
                      className="gap-2.5"
                    >
                      <Phone className="size-4" />
                      <span>Start voice call</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={handleStartVideoCall}
                      disabled={callState !== null && callState !== 'ended'}
                      className="gap-2.5"
                    >
                      <Video className="size-4" />
                      <span>Start video call</span>
                    </DropdownMenuItem>
                  </>
                ) : null}

                {!isSelf ? (
                  <>
                    <DropdownMenuSeparator />

                    <DropdownMenuItem
                      onClick={() => navigate(`/w/${slug}/dms`)}
                      className="gap-2.5"
                    >
                      <X className="size-4" />
                      <span>Close conversation</span>
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="gap-1 flex items-center">
          {canCall ? (
            <>
              <Hint label="Start voice call">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Start voice call"
                  onClick={handleStartVoiceCall}
                  disabled={callState !== null && callState !== 'ended'}
                >
                  <Phone className="size-4" />
                </Button>
              </Hint>
              <Hint label="Start video call">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Start video call"
                  onClick={handleStartVideoCall}
                  disabled={callState !== null && callState !== 'ended'}
                >
                  <Video className="size-4" />
                </Button>
              </Hint>
            </>
          ) : null}

          {/* Conversation tools portal in from the chat surface. */}
          <div
            ref={chatActionsRef}
            className="gap-0.5 flex items-center empty:hidden"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * The composer for a new conversation — the "New message" screen.
 *
 * Recipients are typed into a Slack-style "To:" field: channels, people, AI
 * agents and apps all come out of one autocomplete. A channel and a set of
 * people are mutually exclusive targets — you post to one channel, or you open
 * a DM (1:1 for one person, group for several).
 *
 * The message box below it is the real `Composer`. Its first send *creates*
 * the conversation (or resolves the channel's room), posts the message, and
 * navigates into it; "Open without a message" does the create/resolve step
 * alone. The `?user=` / `?room=` / `/c/:slug` deep links are all unchanged.
 */
function NewDirectMessage({
  extraPeers,
  channels,
}: {
  extraPeers?: WorkspaceMember[];
  channels?: ChannelSummary[];
}) {
  const { workspaceId, slug } = useCurrentWorkspace();
  const currentUser = useCurrentUser();
  const members = useMembers(workspaceId);
  const createConversation = useCreateConversation();
  const { client, enabled } = useMatrix();
  const navigate = useNavigate();

  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  // The channel's Matrix room is provisioned as soon as one is picked, so it is
  // ready by the time the first message is sent.
  const channelRoom = useChannelRoom(selectedChannelId ?? undefined);

  const allPeers = useMemo(
    () => [...(members.data ?? []), ...(extraPeers ?? [])],
    [members.data, extraPeers],
  );

  const peopleOptions = useMemo<RecipientPerson[]>(
    () =>
      allPeers.map((member) => {
        const id = member.user.id;
        return {
          id,
          name: member.user.displayName ?? member.user.name,
          handle: member.user.name,
          avatarUrl: member.user.avatarUrl,
          presence: member.user.presence,
          kind: peerKindOf(id),
          isSelf: id === currentUser?.id,
          statusText: member.user.statusText,
        };
      }),
    [allPeers, currentUser?.id],
  );

  // Only channels the viewer is in and may post to — anything else would bounce
  // at the room's power levels.
  const channelOptions = useMemo<RecipientChannel[]>(
    () =>
      (channels ?? [])
        .filter(
          (channel) =>
            channel.membership && channel.canPost && !channel.isArchived,
        )
        .map((channel) => ({
          id: channel.id,
          name: channel.name,
          slug: channel.slug,
          isPrivate: channel.visibility === 'PRIVATE',
        }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [channels],
  );

  const selectedChannel =
    channelOptions.find((channel) => channel.id === selectedChannelId) ?? null;

  const selectedMembers = useMemo(
    () => allPeers.filter((member) => selectedPeople.includes(member.user.id)),
    [allPeers, selectedPeople],
  );

  // The caller is implicit in every conversation, so they do not count toward
  // "is this a group?" — picking yourself plus one person is still a 1:1, and
  // picking only yourself is a note-to-self DM.
  const peerSelection = useMemo(
    () => selectedPeople.filter((id) => id !== currentUser?.id),
    [selectedPeople, currentUser?.id],
  );
  const isSelfOnly = selectedPeople.length > 0 && peerSelection.length === 0;
  const isGroup = peerSelection.length >= 2;
  const hasRecipients = selectedPeople.length > 0 || Boolean(selectedChannel);
  const isBusy = isStarting || createConversation.isPending;
  // A picked channel is only a usable target once its Matrix room has resolved.
  const channelConnecting = Boolean(selectedChannel) && !channelRoom.roomId;
  const canDispatch = hasRecipients && !isBusy && !channelConnecting;

  const recipientCount = selectedPeople.length + (selectedChannel ? 1 : 0);

  const clearRecipients = () => {
    setSelectedPeople([]);
    setSelectedChannelId(null);
  };

  const firstPeer = selectedMembers.find(
    (member) => member.user.id === peerSelection[0],
  );
  const firstPeerName =
    firstPeer?.user.displayName ?? firstPeer?.user.name ?? 'this person';

  const composerMembers = useMemo<RoomMember[]>(
    () =>
      selectedMembers.map((member) => ({
        userId: member.user.id,
        displayName: member.user.displayName ?? member.user.name,
        avatarUrl: member.user.avatarUrl ?? undefined,
        powerLevel: 0,
        membership: 'join' as const,
      })),
    [selectedMembers],
  );

  /** Creates the DM / group, or points at the chosen channel's room. */
  const resolveTarget = useCallback(async (): Promise<{
    roomId: string;
    href: string;
  } | null> => {
    if (selectedChannel) {
      if (!channelRoom.roomId) {
        toast.error('That channel is still connecting — try again in a moment.');
        return null;
      }
      return {
        roomId: channelRoom.roomId,
        href: `/w/${slug}/c/${selectedChannel.slug}`,
      };
    }

    const result = await createConversation.mutateAsync({
      peerIds: selectedPeople,
      name: isGroup ? groupName : undefined,
    });
    return {
      roomId: result.roomId,
      href:
        result.kind === 'direct'
          ? `/w/${slug}/dms/${result.peerId}`
          : `/w/${slug}/dms?room=${result.roomId}`,
    };
  }, [
    selectedChannel,
    channelRoom.roomId,
    slug,
    createConversation,
    selectedPeople,
    isGroup,
    groupName,
  ]);

  const handleSend = useCallback(
    async (body: string) => {
      if (!client || !canDispatch) return;
      setIsStarting(true);
      try {
        const target = await resolveTarget();
        if (!target) return;
        if (body.trim()) await client.sendMessage(target.roomId, body);
        navigate(target.href, { replace: true });
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : 'Could not start the conversation',
        );
      } finally {
        setIsStarting(false);
      }
    },
    [client, canDispatch, resolveTarget, navigate],
  );

  const handleAttach = useCallback(
    async (files: FileList) => {
      if (!client || !canDispatch || files.length === 0) return;
      setIsStarting(true);
      try {
        const target = await resolveTarget();
        if (!target) return;
        for (const file of Array.from(files)) {
          await client.sendFile(target.roomId, file);
        }
        navigate(target.href, { replace: true });
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not attach that file',
        );
      } finally {
        setIsStarting(false);
      }
    },
    [client, canDispatch, resolveTarget, navigate],
  );

  const openWithoutMessage = useCallback(async () => {
    if (!canDispatch) return;
    setIsStarting(true);
    try {
      const target = await resolveTarget();
      if (target) navigate(target.href, { replace: true });
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Could not start the conversation',
      );
    } finally {
      setIsStarting(false);
    }
  }, [canDispatch, resolveTarget, navigate]);

  // Spelled out under the field so the outcome is never a surprise.
  const outcome = (() => {
    if (isBusy) return 'Starting the conversation…';
    if (channelConnecting) return `Connecting to #${selectedChannel?.name}…`;
    if (selectedChannel)
      return `Your message is posted to #${selectedChannel.name}.`;
    if (selectedPeople.length === 0)
      return 'Pick a channel to post there, or one or more people for a direct message.';
    if (isSelfOnly)
      return 'Opens a private space just for you — notes, links, drafts.';
    if (isGroup)
      return `Creates a group conversation with ${peerSelection.length} people.`;
    return `Opens a direct message with ${firstPeerName}.`;
  })();

  const openLabel = selectedChannel
    ? `Open #${selectedChannel.name}`
    : isSelfOnly
      ? 'Open your space'
      : isGroup
        ? `Open group with ${peerSelection.length}`
        : 'Open conversation';

  const composerPlaceholder = selectedChannel
    ? `Message #${selectedChannel.name}`
    : isSelfOnly
      ? 'Write a note to yourself…'
      : isGroup
        ? 'Message the group…'
        : peerSelection.length === 1
          ? `Message ${firstPeerName}`
          : 'Start a new message';

  const headline = selectedChannel
    ? `Message #${selectedChannel.name}`
    : isSelfOnly
      ? 'Your space'
      : isGroup
        ? 'New group message'
        : peerSelection.length === 1
          ? `New message to ${firstPeerName}`
          : 'Who do you want to message?';

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      {/* Channel-style Header (Inbox & Threads style) */}
      <div className="top-0 backdrop-blur-md sticky z-20 shrink-0 border-b border-border bg-background/95">
        <div className="gap-2.5 px-3 sm:px-6 py-1.5 min-h-12 flex flex-wrap items-center justify-between">
          <div className="min-w-0 gap-2 flex items-center">
            <div className="min-w-0 gap-1.5 flex items-center">
              <SquarePen
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <h2 className="text-sm font-semibold tracking-tight truncate text-foreground">
                New message
              </h2>
              {recipientCount > 0 ? (
                <Badge
                  variant="neutral"
                  className="px-1.5 py-0 h-4 text-[10px]"
                >
                  {recipientCount} selected
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="gap-2 flex items-center">
            {recipientCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearRecipients}
                className="h-7 text-xs gap-1.5"
              >
                <X className="size-3.5" />
                <span>Clear</span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Content — a full-height compose view, laid out like an open
          conversation: recipients strip, a body that fills, composer pinned. */}
      {members.isLoading ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <LoadingState label="Loading directory…" />
        </div>
      ) : members.isError ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <ErrorState
            title="Could not load directory"
            description="The member list for this workspace is unavailable."
          />
        </div>
      ) : !enabled ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            size="lg"
            icon={<MessageSquareOff />}
            title="Chat is not configured"
            description="This deployment has no Matrix homeserver. Set MATRIX_ENABLED and the homeserver settings to start a conversation."
          />
        </div>
      ) : (
        <div className="min-h-0 flex flex-1 flex-col">
          {/* Recipients strip */}
          <div className="shrink-0 px-4 sm:px-6 py-3 sm:py-4 space-y-3 border-b border-border bg-background">
            <NewMessageRecipients
              people={peopleOptions}
              channels={channelOptions}
              selectedPeopleIds={selectedPeople}
              onChangePeople={setSelectedPeople}
              selectedChannelId={selectedChannelId}
              onChangeChannel={setSelectedChannelId}
              autoFocus
            />

            {isGroup ? (
              <Field
                label="Group name"
                optional
                htmlFor="new-dm-group-name"
                hint="Leave blank to name it after the people in it."
              >
                <Input
                  id="new-dm-group-name"
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder={`${firstPeerName} and ${
                    peerSelection.length - 1
                  } more`}
                />
              </Field>
            ) : null}
          </div>

          {/* Body — fills the space between the recipients and the composer. */}
          <div className="min-h-0 gap-4 p-6 text-center flex flex-1 flex-col items-center justify-center overflow-y-auto">
            <div className="size-12 flex items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              {selectedChannel ? (
                <Hash className="size-6" />
              ) : isGroup ? (
                <Users className="size-6" />
              ) : (
                <MessageSquare className="size-6" />
              )}
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-foreground">
                {headline}
              </h3>
              <p className="max-w-md mx-auto text-xs text-muted-foreground">
                {outcome} Type below and press{' '}
                <kbd className="px-1 py-0.5 font-sans text-[10px] rounded border border-border bg-background">
                  Enter
                </kbd>{' '}
                to send.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canDispatch}
              onClick={openWithoutMessage}
              leadingIcon={<MessageSquare className="size-4" />}
            >
              {openLabel}
            </Button>
          </div>

          {/* Composer — pinned to the bottom, like a real conversation. */}
          <div className="shrink-0 border-t border-border">
            <Composer
              conversationId={`new-message:${workspaceId ?? 'default'}`}
              members={composerMembers}
              placeholder={composerPlaceholder}
              disabled={!canDispatch}
              onSend={handleSend}
              onAttach={handleAttach}
            />
          </div>
        </div>
      )}
    </div>
  );
}
