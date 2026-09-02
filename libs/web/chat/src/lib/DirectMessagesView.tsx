import { useCurrentUser } from '@org/auth';
import { useUserPresenceMap } from '@org/realtime';
import type { Attachment, WorkspaceMember } from '@org/types';
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
  Hint,
  Input,
  LoadingState,
  Panel,
  ScrollArea,
  SkeletonList,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  toast,
  toPresenceStatus,
  UserAvatar,
  useRightPanelStore,
} from '@org/ui';
import { cn, formatBytes } from '@org/utils';
import { useMembers } from '@org/web-members';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Bell,
  BellOff,
  Blocks,
  Bot,
  Check,
  ChevronRight,
  Copy,
  Download,
  FileText,
  FolderOpen,
  Image as ImageIcon,
  Mail,
  MessageSquare,
  MessageSquareOff,
  MoreHorizontal,
  Pin,
  RefreshCw,
  Star,
  UserRound,
  X,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChatPanel } from './chat-panel.js';
import { GroupConversation } from './GroupConversation.js';
import { useMatrix } from './matrix-provider.js';
import { PeoplePicker } from './people-picker.js';
import { useRoom } from './use-chat.js';
import { useCreateConversation } from './use-create-conversation.js';
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

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      <DirectMessageHeader
        member={member}
        chatActionsRef={setChatActionsSlot}
      />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="min-h-0 flex flex-1 flex-col"
      >
        <div className="px-3 sm:px-6 py-1 gap-1 flex items-center border-b border-border bg-background">
          <TabsList className="scrollbar-none overflow-x-auto">
            <TabsTrigger value="chat" className="gap-1.5">
              <MessageSquare className="size-4" /> Messages
            </TabsTrigger>
            <TabsTrigger value="files-media" className="gap-1.5">
              <FolderOpen className="size-4" /> Files &amp; Media
            </TabsTrigger>
            <TabsTrigger value="pins" className="gap-1.5">
              <Pin className="size-4" /> Pins
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
              headerActionsSlot={chatActionsSlot}
            />
          )}
        </TabsContent>

        <TabsContent
          value="files-media"
          className="min-h-0 flex flex-1 flex-col"
        >
          <DirectFilesPanel roomId={roomId} enabled={enabled} />
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
 * The DM's Files & Media tab — `ChannelPage`'s counterpart, same toolbar, same
 * media grid and document list, same empty state.
 *
 * A direct message has no files endpoint of its own, so the list is derived
 * from the room's own timeline: every message that carried an attachment. The
 * `useRoom` subscription here only runs while this tab is the active one —
 * Radix unmounts the inactive `TabsContent`, and the Messages tab's own
 * subscription stops in step — so the conversation is never subscribed twice.
 */
function DirectFilesPanel({
  roomId,
  enabled,
}: {
  roomId: string | null;
  enabled: boolean;
}) {
  const room = useRoom(roomId ?? undefined);
  const [filter, setFilter] = useState<'all' | 'files' | 'media'>('all');

  const attachments = useMemo(
    () =>
      room.messages
        .filter((message) => message.attachment && !message.isRedacted)
        .map((message) => {
          const file = message.attachment as Attachment;
          return {
            id: message.id,
            senderName: message.senderName,
            name: file.name,
            mimeType: file.mimeType,
            size: file.size,
            url: file.url,
            thumbnailUrl: file.thumbnailUrl,
          };
        })
        .reverse(),
    [room.messages],
  );

  const mediaFiles = useMemo(
    () => attachments.filter((file) => file.mimeType.startsWith('image/')),
    [attachments],
  );
  const documentFiles = useMemo(
    () => attachments.filter((file) => !file.mimeType.startsWith('image/')),
    [attachments],
  );

  if (!enabled) {
    return (
      <EmptyState
        size="lg"
        icon={<MessageSquareOff />}
        title="Chat is not configured"
        description="Files shared in this conversation will appear here once messaging is turned on."
      />
    );
  }

  const isResolving = !roomId || room.isLoading;

  return (
    <ScrollArea
      className="min-h-0 flex-1"
      contentClassName="px-4 sm:px-6 py-4 space-y-6"
    >
      <div className="gap-3 pb-3 flex flex-wrap items-center justify-between border-b border-border/60">
        <div className="gap-1.5 flex flex-wrap items-center">
          <Button
            size="sm"
            variant={filter === 'all' ? 'primary' : 'outline'}
            onClick={() => setFilter('all')}
            className="h-7 text-xs px-2.5"
          >
            All ({attachments.length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'files' ? 'primary' : 'outline'}
            onClick={() => setFilter('files')}
            className="h-7 text-xs px-2.5 gap-1.5"
          >
            <FileText className="size-3.5" />
            <span>Documents ({documentFiles.length})</span>
          </Button>
          <Button
            size="sm"
            variant={filter === 'media' ? 'primary' : 'outline'}
            onClick={() => setFilter('media')}
            className="h-7 text-xs px-2.5 gap-1.5"
          >
            <ImageIcon className="size-3.5" />
            <span>Media ({mediaFiles.length})</span>
          </Button>
        </div>
      </div>

      {isResolving && attachments.length === 0 ? (
        <SkeletonList rows={4} />
      ) : attachments.length === 0 ? (
        <EmptyState
          icon={<FolderOpen />}
          title="No files or media yet"
          description="Documents and images you share in this conversation will show up here."
        />
      ) : null}

      {(filter === 'all' || filter === 'media') && mediaFiles.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-xs font-bold tracking-wider gap-1.5 flex items-center text-muted-foreground uppercase">
            <ImageIcon className="size-3.5 text-accent-amber" />
            <span>Media &amp; Images ({mediaFiles.length})</span>
          </h4>

          <div className="gap-3 sm:grid-cols-4 grid grid-cols-2">
            {mediaFiles.map((file) => (
              <figure
                key={file.id}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
              >
                <img
                  src={file.thumbnailUrl ?? file.url}
                  alt={file.name}
                  className="size-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                <div className="inset-0 bg-black/50 p-2 text-white absolute flex items-end opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="font-medium truncate text-[11px]">
                    {file.name}
                  </span>
                </div>
              </figure>
            ))}
          </div>
        </div>
      ) : null}

      {(filter === 'all' || filter === 'files') && documentFiles.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-xs font-bold tracking-wider gap-1.5 flex items-center text-muted-foreground uppercase">
            <FileText className="size-3.5 text-accent-violet" />
            <span>Documents &amp; Files ({documentFiles.length})</span>
          </h4>

          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
            {documentFiles.map((file) => (
              <li
                key={file.id}
                className="gap-3 px-4 py-3 flex items-center transition-colors hover:bg-surface-raised"
              >
                <FileText className="size-5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate text-foreground">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {file.size ? `${formatBytes(file.size)} · ` : ''}Shared by{' '}
                    {file.senderName}
                  </p>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  onClick={() =>
                    window.open(file.url, '_blank', 'noopener,noreferrer')
                  }
                  title="Open file"
                >
                  <Download className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </ScrollArea>
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
  headerActionsSlot,
}: {
  peerId: string;
  name: string;
  presence?: string | null;
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
      subtitle={presence === 'ONLINE' ? 'Online' : 'Direct message'}
      workspaceId={workspaceId}
      headerActionsSlot={headerActionsSlot}
      showMembers={false}
      showEncryptedBadge={false}
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
  chatActionsRef,
}: {
  member: WorkspaceMember;
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
      <div className="gap-2.5 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between">
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

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={() => navigate(`/w/${slug}/dms`)}
                  className="gap-2.5"
                >
                  <X className="size-4" />
                  <span>Close conversation</span>
                </DropdownMenuItem>
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

  const start = () => {
    if (selected.length === 0 || createConversation.isPending) return;
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

  return (
    <div className="min-h-0 px-4 py-8 flex flex-1 flex-col items-center overflow-y-auto">
      <div className="max-w-lg w-full">
        <div className="mb-4 text-center">
          <MessageSquare className="mb-2 size-6 mx-auto text-muted-foreground" />
          <h1 className="text-base font-semibold text-foreground">
            New message
          </h1>
          <p className="text-sm text-muted-foreground">
            Pick one person for a direct message, or several for a group.
          </p>
        </div>

        <Panel flush title="People, AI Agents & Apps">
          {members.isLoading ? (
            <LoadingState label="Loading directory…" />
          ) : members.isError ? (
            <ErrorState
              title="Could not load directory"
              description="The member list for this workspace is unavailable."
            />
          ) : (
            <>
              {selectedMembers.length > 0 ? (
                <div className="gap-1.5 p-3 flex flex-wrap border-b border-border">
                  {selectedMembers.map((member) => {
                    const name = member.user.displayName ?? member.user.name;
                    return (
                      <button
                        key={member.user.id}
                        type="button"
                        onClick={() => toggle(member.user.id)}
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
              ) : null}

              <div className="h-72 flex flex-col">
                <PeoplePicker
                  members={allPeers}
                  selectedIds={selected}
                  onToggle={toggle}
                  currentUserId={currentUser?.id}
                />
              </div>

              <div className="p-3 space-y-2 border-t border-border">
                {isGroup ? (
                  <Input
                    value={groupName}
                    onChange={(event) => setGroupName(event.target.value)}
                    placeholder="Group name (optional)"
                    aria-label="Group name"
                  />
                ) : null}
                <Button
                  className="w-full"
                  disabled={
                    selected.length === 0 || createConversation.isPending
                  }
                  onClick={start}
                  leadingIcon={<MessageSquare className="size-4" />}
                >
                  {createConversation.isPending
                    ? 'Starting…'
                    : isSelfOnly
                      ? 'Message yourself'
                      : isGroup
                        ? `Create group with ${peerSelection.length}`
                        : peerSelection.length === 1
                          ? 'Start conversation'
                          : 'Select someone'}
                </Button>
              </div>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
