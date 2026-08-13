import { useCurrentUser } from '@org/auth';
import type { WorkspaceMember } from '@org/types';
import {
  Button,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Page,
  PageHeader,
  Panel,
  toPresenceStatus,
  UserAvatar,
} from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import { useMembers } from '@org/web-members';
import { useCurrentWorkspace } from '@org/web-workspace';
import { MessageSquare, MessageSquareOff, Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChatPanel } from './chat-panel.js';
import { useMatrix } from './matrix-provider.js';
import { useDirectRoom } from './use-direct-room.js';

/**
 * The DM inbox: the people in this workspace on the left, their conversation
 * on the right.
 *
 * There is no "conversations" endpoint, so the list is the workspace roster
 * rather than a list of open threads — the same set of people, ordered by who
 * is around rather than by who spoke last. The reading pane is the real Matrix
 * room, opened on demand.
 */
export function DirectMessagesView() {
  const { workspaceId } = useCurrentWorkspace();
  const currentUser = useCurrentUser();
  const members = useMembers(workspaceId);
  const { enabled } = useMatrix();

  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  // Messaging yourself is not a conversation.
  const people = useMemo(
    () =>
      (members.data ?? []).filter(
        (member) => member.user.id !== currentUser?.id,
      ),
    [members.data, currentUser?.id],
  );

  /*
   * The selection lives in the URL so the sidebar's DM rows can deep-link
   * straight to a person, and so a reload keeps the pane open.
   */
  const selectedId = searchParams.get('user') ?? people[0]?.user.id;
  const selected = people.find((member) => member.user.id === selectedId);

  const select = (member: WorkspaceMember) => {
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.set('user', member.user.id);
        return next;
      },
      { replace: true },
    );
    setMobileView('detail');
  };

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return people;
    return people.filter((member) =>
      (member.user.displayName ?? member.user.name)
        .toLowerCase()
        .includes(needle),
    );
  }, [people, query]);

  return (
    <Page width="full">
      <PageHeader
        title="Direct Messages"
        description="Private conversations with people in this workspace."
        icon={<MessageSquare />}
        accent="cyan"
      />

      <div className="gap-4 grid grid-cols-1 lg:grid-cols-[20rem_1fr]">
        {/* People list (hidden on mobile while a conversation is open) */}
        <div className={cn(mobileView === 'detail' && 'hidden lg:block')}>
          <Panel flush title="People">
            <div className="p-3 border-b border-border">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search people"
                aria-label="Search direct messages"
                leadingIcon={<Search />}
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
              <ul className="p-2 space-y-px">
                {visible.map((member) => {
                  const name = member.user.displayName ?? member.user.name;
                  const isSelected = member.user.id === selectedId;

                  return (
                    <li key={member.user.id}>
                      <button
                        type="button"
                        onClick={() => select(member)}
                        aria-current={isSelected}
                        className={cn(
                          'gap-2.5 p-2 w-full text-left flex items-center rounded-md transition-colors',
                          'focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none',
                          isSelected
                            ? 'bg-accent text-accent-foreground'
                            : 'hover:bg-muted',
                        )}
                      >
                        <UserAvatar
                          name={name}
                          src={member.user.avatarUrl}
                          seed={member.user.id}
                          presence={toPresenceStatus(member.user.presence)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="gap-2 flex items-baseline justify-between">
                            <span className="text-sm font-medium truncate">
                              {name}
                            </span>
                            {member.user.lastSeenAt ? (
                              <span className="text-xs shrink-0 text-muted-foreground">
                                {formatRelative(member.user.lastSeenAt)}
                              </span>
                            ) : null}
                          </span>
                          <span className="block text-xs truncate text-muted-foreground">
                            {member.role.toLowerCase()}
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

        {/* Conversation (hidden on mobile while the list is open) */}
        <div className={cn(mobileView === 'list' && 'hidden lg:block')}>
          <Panel
            flush
            title={
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMobileView('list')}
                  className="lg:hidden text-xs h-7 px-2"
                >
                  ← Back to list
                </Button>
                <span>
                  {selected
                    ? (selected.user.displayName ?? selected.user.name)
                    : 'No conversation'}
                </span>
              </div>
            }
          >
            {!enabled ? (
              <EmptyState
                icon={<MessageSquareOff />}
                title="Chat is not configured"
                description="This deployment has no Matrix homeserver. Set MATRIX_ENABLED and the homeserver settings to turn on direct messages."
              />
            ) : selected ? (
              <DirectConversation
                key={selected.user.id}
                member={selected}
              />
            ) : (
              <EmptyState
                icon={<MessageSquare />}
                title="Pick a conversation"
                description="Choose someone on the left to open the conversation."
              />
            )}
          </Panel>
        </div>
      </div>
    </Page>
  );
}

/**
 * One person's conversation.
 *
 * Split out so the DM room resolves per selection: mounting it with a `key` of
 * the peer's id means switching people tears down the old room's subscriptions
 * instead of leaving them attached to a stale timeline.
 */
function DirectConversation({ member }: { member: WorkspaceMember }) {
  const name = member.user.displayName ?? member.user.name;
  const { roomId, isLoading, error } = useDirectRoom(member.user.id);

  if (error) {
    return (
      <ErrorState title={`Could not open the chat with ${name}`} description={error} />
    );
  }

  if (isLoading || !roomId) {
    return <LoadingState label={`Opening your conversation with ${name}…`} />;
  }

  return (
    <ChatPanel
      roomId={roomId}
      title={name}
      subtitle={
        member.user.presence === 'ONLINE' ? 'Online' : 'Direct message'
      }
    />
  );
}
