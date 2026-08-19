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
  PRESENCE_LABELS,
  SearchInput,
  toast,
  toPresenceStatus,
  UserAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import { useMembers } from '@org/web-members';
import { useCurrentWorkspace } from '@org/web-workspace';
import {
  Bell,
  BellOff,
  Check,
  ChevronRight,
  Copy,
  MessageSquare,
  MessageSquareOff,
  MoreHorizontal,
  Search,
  Star,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
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
export function DirectMessagesView() {
  const [searchParams] = useSearchParams();
  const peerId = searchParams.get('user');

  return peerId ? <DirectConversation peerId={peerId} /> : <NewDirectMessage />;
}

/**
 * One person's conversation.
 *
 * Keyed on the peer in `DirectMessagesView`'s caller by way of the URL: landing
 * on a different `?user=` remounts this component, so switching people tears
 * down the old room's subscriptions instead of leaving them attached to a stale
 * timeline.
 */
function DirectConversation({ peerId }: { peerId: string }) {
  const { workspaceId } = useCurrentWorkspace();
  const members = useMembers(workspaceId);
  const { enabled } = useMatrix();

  // Callback ref, not `useRef`: the conversation only portals its tools into
  // this element once it exists, and a render has to be triggered when it does.
  const [chatActionsSlot, setChatActionsSlot] = useState<HTMLDivElement | null>(
    null,
  );

  const member = (members.data ?? []).find((entry) => entry.user.id === peerId);

  if (members.isLoading) return <LoadingState fullPage label="Opening conversation…" />;

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
    <div className="flex min-h-0 flex-1 flex-col">
      <DirectMessageHeader member={member} chatActionsRef={setChatActionsSlot} />

      {!enabled ? (
        <EmptyState
          size="lg"
          icon={<MessageSquareOff />}
          title="Chat is not configured"
          description="This deployment has no Matrix homeserver. Set MATRIX_ENABLED and the homeserver settings to turn on direct messages."
        />
      ) : (
        <DirectRoom
          key={member.user.id}
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
  const { roomId, isLoading, error } = useDirectRoom(peerId);

  if (error) {
    return (
      <ErrorState
        title={`Could not open the chat with ${name}`}
        description={error}
      />
    );
  }

  if (isLoading || !roomId) {
    return <LoadingState label={`Opening your conversation with ${name}…`} />;
  }

  return (
    <ChatPanel
      roomId={roomId}
      title={name}
      subtitle={presence === 'ONLINE' ? 'Online' : 'Direct message'}
      headerActionsSlot={headerActionsSlot}
      showMembers={false}
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
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const name = member.user.displayName ?? member.user.name;
  const presence = toPresenceStatus(member.user.presence);
  const slug = workspaceSlug || 'default';

  const isFavorite = preferences.isFavorite(member.user.id);
  const isMuted = preferences.isMuted(member.user.id);

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

  return (
    <div className="border-b border-border bg-background">
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 sm:px-6 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <UserAvatar
              name={name}
              src={member.user.avatarUrl}
              seed={member.user.id}
              presence={presence}
              size="sm"
              className="size-7"
            />
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
              {name}
            </h2>
            {member.user.statusEmoji ? (
              <span
                className="select-none text-xs"
                title={
                  member.user.statusText
                    ? `${member.user.statusEmoji} ${member.user.statusText}`
                    : undefined
                }
              >
                {member.user.statusEmoji}
              </span>
            ) : null}
            <Badge variant="neutral">{PRESENCE_LABELS[presence]}</Badge>
            {isMuted ? (
              <Badge variant="neutral" className="gap-1 text-muted-foreground">
                <BellOff className="size-3" />
                <span>Muted</span>
              </Badge>
            ) : null}
          </div>

          <div className="flex items-center gap-0.5">
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
                <Star className={cn('size-4', isFavorite && 'fill-current')} />
              </Button>
            </Hint>

            <Hint label="Copy link to this conversation">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Copy link to this conversation"
                onClick={handleCopyLink}
                className="text-muted-foreground hover:text-foreground"
              >
                {copied ? (
                  <Check className="size-4 text-success-text" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </Hint>

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
                  <div className="flex items-center gap-2.5">
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
                  onClick={handleToggleFavorite}
                  className="justify-between"
                >
                  <div className="flex items-center gap-2.5">
                    <Star
                      className={cn(
                        'size-4',
                        isFavorite && 'fill-current text-accent-amber',
                      )}
                    />
                    <span>
                      {isFavorite ? 'Remove Favorite' : 'Favorite'}
                    </span>
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
                  onClick={() => navigate(`/w/${slug}/members`)}
                  className="gap-2.5"
                >
                  <UserRound className="size-4" />
                  <span>View profile</span>
                </DropdownMenuItem>

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

          {/* The handle is the one bit of identity the avatar and name do not
              already carry; it drops out first when the row gets tight. */}
          <p className="hidden min-w-0 max-w-[32ch] truncate border-l border-border pl-2 text-xs text-muted-foreground lg:block">
            @{member.user.name}
          </p>
        </div>

        {/* Conversation tools portal in from the chat surface. */}
        <div
          ref={chatActionsRef}
          className="flex items-center gap-0.5 empty:hidden"
        />
      </div>
    </div>
  );
}

/**
 * The picker for "New direct message" — the only place a list of people still
 * belongs, since there is nobody selected to show a conversation for.
 */
function NewDirectMessage() {
  const { workspaceId } = useCurrentWorkspace();
  const currentUser = useCurrentUser();
  const members = useMembers(workspaceId);

  const [, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');

  // Messaging yourself is not a conversation.
  const people = useMemo(
    () =>
      (members.data ?? []).filter(
        (member) => member.user.id !== currentUser?.id,
      ),
    [members.data, currentUser?.id],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return people;
    return people.filter((member) =>
      (member.user.displayName ?? member.user.name)
        .toLowerCase()
        .includes(needle),
    );
  }, [people, query]);

  const select = (member: WorkspaceMember) =>
    setSearchParams({ user: member.user.id }, { replace: true });

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="mb-4 text-center">
          <MessageSquare className="mx-auto mb-2 size-6 text-muted-foreground" />
          <h1 className="text-base font-semibold text-foreground">
            New direct message
          </h1>
          <p className="text-sm text-muted-foreground">
            Pick someone in this workspace to start a one-to-one conversation.
          </p>
        </div>

        <Panel flush title="People">
          <div className="border-b border-border p-3">
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search people"
              label="Search people"
            />
          </div>

          {members.isLoading ? (
            <LoadingState label="Loading people…" />
          ) : members.isError ? (
            <ErrorState
              title="Could not load people"
              description="The member list for this workspace is unavailable."
            />
          ) : visible.length === 0 ? (
            <EmptyState
              size="sm"
              icon={people.length === 0 ? <Users /> : <Search />}
              title={people.length === 0 ? 'No teammates yet' : 'No matches'}
              description={
                people.length === 0
                  ? 'Invite someone to this workspace to start a conversation.'
                  : 'No one in this workspace matches that name.'
              }
            />
          ) : (
            <ul className="space-y-px p-2">
              {visible.map((member) => {
                const name = member.user.displayName ?? member.user.name;

                return (
                  <li key={member.user.id}>
                    <button
                      type="button"
                      onClick={() => select(member)}
                      className="flex w-full items-center gap-2.5 rounded-md p-2 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                    >
                      <UserAvatar
                        name={name}
                        src={member.user.avatarUrl}
                        seed={member.user.id}
                        presence={toPresenceStatus(member.user.presence)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          @{member.user.name}
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
