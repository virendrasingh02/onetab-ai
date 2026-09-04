import { useCurrentUser } from '@org/auth';
import { AddBookmarkDialog } from '@org/chat-ui';
import { useUserPresenceMap } from '@org/realtime';
import type { WorkspaceMember } from '@org/types';
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
  Panel,
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
  ChevronRight,
  Copy,
  ExternalLink,
  FolderOpen,
  Mail,
  MessageSquare,
  MessageSquareOff,
  MoreHorizontal,
  Pin,
  Plus,
  RefreshCw,
  SquarePen,
  Star,
  Trash2,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChatPanel } from './chat-panel.js';
import { ConversationFilesPanel } from './conversation-files-panel.js';
import { GroupConversation } from './GroupConversation.js';
import { useMatrix } from './matrix-provider.js';
import { PeoplePicker } from './people-picker.js';
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
}

export function DirectMessagesView({
  extraPeers,
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
    <NewDirectMessage extraPeers={extraPeers} />
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
  const peerKind: 'person' | 'agent' | 'app' = member.user.id.startsWith(
    'agent-',
  )
    ? 'agent'
    : member.user.id.startsWith('app-')
      ? 'app'
      : 'person';

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      <DirectMessageHeader
        member={member}
        isSelf={isSelf}
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
        className="min-h-0 flex flex-1 flex-col"
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
        <TabsContent
          value="bookmarks"
          className="min-h-0 flex flex-1 flex-col"
        >
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
                    ? "Links and resources you keep in your personal space — only visible to you, on this device."
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
  /** Opens the "Add bookmark" dialog — mirrors `ChannelHeader`'s menu entry. */
  onAddBookmark?: () => void;
  chatActionsRef: (element: HTMLDivElement | null) => void;
}) {
  const { workspaceId, slug: workspaceSlug } = useCurrentWorkspace();
  const preferences = useDirectMessagePreferences(workspaceId);
  const openProfilePanel = useRightPanelStore((s) => s.openProfile);
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

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
                  <ChevronRight className="size-4 text-muted-foreground/70" />
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

        {/* Conversation tools portal in from the chat surface. */}
        <div
          ref={chatActionsRef}
          className="gap-0.5 flex items-center empty:hidden"
        />
      </div>
    </div>
  );
}

/**
 * The picker for a new conversation.
 *
 * One person selected opens a 1:1 DM (the `?user=` deep link, unchanged); two
 * or more create a group DM (`?room=`). The roster itself is `PeoplePicker`,
 * shared with a group's "Add people" dialog.
 */
function NewDirectMessage({ extraPeers }: { extraPeers?: WorkspaceMember[] }) {
  const { workspaceId } = useCurrentWorkspace();
  const currentUser = useCurrentUser();
  const members = useMembers(workspaceId);
  const createConversation = useCreateConversation();

  const navigate = useNavigate();
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const [selected, setSelected] = useState<string[]>([]);
  const [groupName, setGroupName] = useState('');

  const allPeers = useMemo(
    () => [...(members.data ?? []), ...(extraPeers ?? [])],
    [members.data, extraPeers],
  );

  const selectedMembers = useMemo(
    () => allPeers.filter((member) => selected.includes(member.user.id)),
    [allPeers, selected],
  );

  // The caller is implicit in every conversation, so they do not count toward
  // "is this a group?" — picking yourself plus one person is still a 1:1, and
  // picking only yourself is a note-to-self DM.
  const peerSelection = useMemo(
    () => selected.filter((id) => id !== currentUser?.id),
    [selected, currentUser?.id],
  );
  const isSelfOnly = selected.length > 0 && peerSelection.length === 0;
  const isGroup = peerSelection.length >= 2;

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((entry) => entry !== id)
        : [...current, id],
    );

  const canStart = selected.length > 0 && !createConversation.isPending;

  const start = () => {
    if (!canStart) return;
    createConversation.mutate(
      { peerIds: selected, name: isGroup ? groupName : undefined },
      {
        onSuccess: (result) => {
          navigate(
            result.kind === 'direct'
              ? `/w/${workspaceSlug}/dms/${result.peerId}`
              : `/w/${workspaceSlug}/dms?room=${result.roomId}`,
            { replace: true },
          );
        },
        onError: (err) =>
          toast.error(err.message || 'Could not start the conversation'),
      },
    );
  };

  const firstPeer = selectedMembers.find(
    (member) => member.user.id === peerSelection[0],
  );
  const firstPeerName =
    firstPeer?.user.displayName ?? firstPeer?.user.name ?? 'this person';

  // Spelled out under the picker so the button's effect is never a surprise.
  const outcome = createConversation.isPending
    ? 'Starting the conversation…'
    : selected.length === 0
      ? 'Pick one person for a direct message, or several for a group.'
      : isSelfOnly
        ? 'Opens a private space just for you — notes, links, drafts.'
        : isGroup
          ? `Creates a group conversation with ${peerSelection.length} people.`
          : `Opens a direct message with ${firstPeerName}.`;

  const buttonLabel = createConversation.isPending
    ? 'Starting…'
    : isSelfOnly
      ? 'Message yourself'
      : isGroup
        ? `Create group with ${peerSelection.length}`
        : peerSelection.length === 1
          ? 'Start conversation'
          : 'Select someone';

  return (
    <div
      className="min-h-0 flex flex-1 flex-col"
      onKeyDown={(event) => {
        // ⌘/Ctrl+Enter starts from anywhere in the picker, matching the composer.
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
          event.preventDefault();
          start();
        }
      }}
    >
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
              {selected.length > 0 ? (
                <Badge
                  variant="neutral"
                  className="px-1.5 py-0 h-4 text-[10px]"
                >
                  {selected.length} selected
                </Badge>
              ) : null}
            </div>
          </div>

          <div className="gap-2 flex items-center">
            {selected.length > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected([])}
                className="h-7 text-xs gap-1.5"
              >
                <X className="size-3.5" />
                <span>Clear</span>
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="min-h-0 p-3 sm:p-6 flex-1 overflow-y-auto">
        <div className="max-w-xl mx-auto w-full">
          {members.isLoading ? (
            <LoadingState label="Loading directory…" />
          ) : members.isError ? (
            <ErrorState
              title="Could not load directory"
              description="The member list for this workspace is unavailable."
            />
          ) : (
            <Panel flush title="People, AI Agents & Apps">
              {selectedMembers.length > 0 ? (
                <div className="p-3 space-y-2 border-b border-border bg-surface-muted/30">
                  <div className="gap-2 flex items-center justify-between">
                    <span className="font-semibold tracking-wide text-[11px] text-muted-foreground uppercase">
                      Selected · {selectedMembers.length}
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelected([])}
                      className="font-medium text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="gap-1.5 flex flex-wrap">
                    {selectedMembers.map((member) => {
                      const name = member.user.displayName ?? member.user.name;
                      return (
                        <button
                          key={member.user.id}
                          type="button"
                          onClick={() => toggle(member.user.id)}
                          aria-label={`Remove ${name}`}
                          className="gap-1 pl-1 pr-1.5 py-0.5 text-xs inline-flex items-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/15"
                        >
                          <UserAvatar
                            name={name}
                            src={member.user.avatarUrl}
                            seed={member.user.id}
                            className="size-4"
                          />
                          <span className="max-w-[12ch] truncate">{name}</span>
                          <X className="size-3" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="flex h-[22rem] flex-col">
                <PeoplePicker
                  members={allPeers}
                  selectedIds={selected}
                  onToggle={toggle}
                  currentUserId={currentUser?.id}
                  className="flex-1"
                />
              </div>

              <div className="p-3 space-y-2.5 border-t border-border">
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

                <p className="gap-1.5 text-xs flex items-start text-muted-foreground">
                  {isGroup ? (
                    <Users className="size-3.5 mt-px shrink-0" aria-hidden />
                  ) : (
                    <MessageSquare
                      className="size-3.5 mt-px shrink-0"
                      aria-hidden
                    />
                  )}
                  <span>{outcome}</span>
                </p>

                <Button
                  type="button"
                  className="w-full"
                  disabled={!canStart}
                  onClick={start}
                  leadingIcon={<MessageSquare className="size-4" />}
                >
                  {buttonLabel}
                </Button>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
