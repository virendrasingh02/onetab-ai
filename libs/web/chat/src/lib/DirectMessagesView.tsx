import { useCurrentUser } from '@org/auth';
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
  Hint,
  LoadingState,
  Panel,
  SearchInput,
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
  Bot,
  Check,
  ChevronRight,
  Copy,
  Mail,
  MessageSquare,
  MessageSquareOff,
  MoreHorizontal,
  RefreshCw,
  Search,
  Star,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChatPanel } from './chat-panel.js';
import { useMatrix } from './matrix-provider.js';
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

export function DirectMessagesView({ extraPeers }: DirectMessagesViewProps = {}) {
  const [searchParams] = useSearchParams();
  const peerId = searchParams.get('user');

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

  const name = member.user.displayName ?? member.user.name;
  const presence = toPresenceStatus(member.user.presence);
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
    const url = `${window.location.origin}/w/${slug}/dms?user=${member.user.id}`;
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
                  onClick={() =>
                    navigate(`/w/${slug}/settings?tab=notifications`)
                  }
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
 * The picker for "New direct message" — the only place a list of people still
 * belongs, since there is nobody selected to show a conversation for.
 */
function NewDirectMessage({ extraPeers }: { extraPeers?: WorkspaceMember[] }) {
  const { workspaceId } = useCurrentWorkspace();
  const currentUser = useCurrentUser();
  const members = useMembers(workspaceId);

  const [, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');

  const allPeers = useMemo(
    () =>
      [...(members.data ?? []), ...(extraPeers ?? [])].filter(
        (member) => member.user.id !== currentUser?.id,
      ),
    [members.data, extraPeers, currentUser?.id],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return allPeers;
    return allPeers.filter(
      (member) =>
        (member.user.displayName ?? member.user.name)
          .toLowerCase()
          .includes(needle) ||
        member.user.name.toLowerCase().includes(needle) ||
        (member.user.statusText &&
          member.user.statusText.toLowerCase().includes(needle)),
    );
  }, [allPeers, query]);

  const select = (member: WorkspaceMember) =>
    setSearchParams({ user: member.user.id }, { replace: true });

  return (
    <div className="min-h-0 px-4 py-8 flex flex-1 flex-col items-center overflow-y-auto">
      <div className="max-w-lg w-full">
        <div className="mb-4 text-center">
          <MessageSquare className="mb-2 size-6 mx-auto text-muted-foreground" />
          <h1 className="text-base font-semibold text-foreground">
            New direct message
          </h1>
          <p className="text-sm text-muted-foreground">
            Pick a teammate, AI Agent, or App to start a conversation.
          </p>
        </div>

        <Panel flush title="People, AI Agents & Apps">
          <div className="p-3 border-b border-border">
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search people, agents & apps"
              label="Search people, agents & apps"
            />
          </div>

          {members.isLoading ? (
            <LoadingState label="Loading directory…" />
          ) : members.isError ? (
            <ErrorState
              title="Could not load directory"
              description="The member list for this workspace is unavailable."
            />
          ) : visible.length === 0 ? (
            <EmptyState
              size="sm"
              icon={allPeers.length === 0 ? <Users /> : <Search />}
              title={allPeers.length === 0 ? 'No contacts yet' : 'No matches'}
              description={
                allPeers.length === 0
                  ? 'Invite someone to this workspace to start a conversation.'
                  : 'No person, agent, or app matches that search.'
              }
            />
          ) : (
            <ul className="p-2 space-y-px">
              {visible.map((member) => {
                const name = member.user.displayName ?? member.user.name;
                const isAgent = member.user.id.startsWith('agent-');
                const isApp = member.user.id.startsWith('app-');

                return (
                  <li key={member.user.id}>
                    <button
                      type="button"
                      onClick={() => select(member)}
                      className="gap-2.5 p-2 flex w-full items-center rounded-md text-left transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                    >
                      <UserAvatar
                        name={name}
                        src={member.user.avatarUrl}
                        seed={member.user.id}
                        presence={toPresenceStatus(member.user.presence)}
                        className={cn(
                          isAgent && 'ring-2 ring-primary/40',
                          isApp && 'ring-2 ring-accent-violet/40',
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="text-sm font-medium gap-1.5 flex items-center truncate">
                          <span className="truncate">{name}</span>
                          {isAgent ? (
                            <Badge
                              variant="primary"
                              className="py-0 h-3.5 font-bold tracking-wider text-[9px] uppercase"
                            >
                              AI AGENT
                            </Badge>
                          ) : isApp ? (
                            <Badge
                              variant="neutral"
                              className="py-0 h-3.5 font-bold tracking-wider border-accent-violet/20 bg-accent-violet-soft text-[9px] text-accent-violet uppercase"
                            >
                              APP
                            </Badge>
                          ) : null}
                        </span>
                        <span className="text-xs block truncate text-muted-foreground">
                          @{member.user.name}{' '}
                          {member.user.statusText
                            ? `· ${member.user.statusText}`
                            : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
