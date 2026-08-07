import {
  Badge,
  Button,
  EmptyState,
  Input,
  Page,
  PageHeader,
  Panel,
  UserAvatar,
  type PresenceStatus,
} from '@org/ui';
import { cn } from '@org/utils';
import { MessageSquare, Search, SquarePen } from 'lucide-react';
import { useMemo, useState } from 'react';

export interface DirectConversation {
  id: string;
  name: string;
  presence: PresenceStatus;
  preview: string;
  time: string;
  unread: number;
}

const conversations: DirectConversation[] = [
  {
    id: '1',
    name: 'Dev User',
    presence: 'online',
    preview: 'Pushed the vector search fix — mind reviewing?',
    time: '2m',
    unread: 2,
  },
  {
    id: '2',
    name: 'Admin',
    presence: 'busy',
    preview: 'Workspace analytics look healthy this week.',
    time: '1h',
    unread: 0,
  },
  {
    id: '3',
    name: 'Priya Raman',
    presence: 'away',
    preview: 'Sent over the meeting notes from standup.',
    time: 'Yesterday',
    unread: 0,
  },
];

/**
 * The DM inbox: one list of people, one reading pane.
 *
 * Conversations are local sample data until the Matrix DM rooms land — the
 * shape here matches what `useRoom` already returns for channels.
 */
export function DirectMessagesView() {
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(
    conversations[0]?.id ?? null,
  );
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((conversation) =>
      conversation.name.toLowerCase().includes(needle),
    );
  }, [query]);

  const selected = conversations.find((entry) => entry.id === selectedId);

  return (
    <Page width="full">
      <PageHeader
        title="Direct Messages"
        description="Private conversations with people in this workspace."
        icon={<MessageSquare />}
        accent="cyan"
        actions={<Button leadingIcon={<SquarePen />}>New message</Button>}
      />

      <div className="gap-4 grid grid-cols-1 lg:grid-cols-[20rem_1fr]">
        {/* Conversations List Panel (Hidden on mobile when viewing detail) */}
        <div className={cn(mobileView === 'detail' && 'hidden lg:block')}>
          <Panel flush title="Conversations">
            <div className="p-3 border-b border-border">
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search people"
                aria-label="Search direct messages"
                leadingIcon={<Search />}
              />
            </div>

            {visible.length === 0 ? (
              <EmptyState
                size="sm"
                icon={<Search />}
                title="No matches"
                description="No one in this workspace matches that name."
              />
            ) : (
              <ul className="p-2 space-y-px">
                {visible.map((conversation) => (
                  <li key={conversation.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(conversation.id);
                        setMobileView('detail');
                      }}
                      aria-current={conversation.id === selectedId}
                      className={cn(
                        'gap-2.5 p-2 w-full text-left flex items-center rounded-md transition-colors',
                        'focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none',
                        conversation.id === selectedId
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-muted',
                      )}
                    >
                      <UserAvatar
                        name={conversation.name}
                        seed={conversation.id}
                        presence={conversation.presence}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="gap-2 flex items-baseline justify-between">
                          <span className="text-sm font-medium truncate">
                            {conversation.name}
                          </span>
                          <span className="text-xs shrink-0 text-muted-foreground">
                            {conversation.time}
                          </span>
                        </span>
                        <span className="block text-xs truncate text-muted-foreground">
                          {conversation.preview}
                        </span>
                      </span>
                      {conversation.unread > 0 ? (
                        <Badge variant="count">{conversation.unread}</Badge>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* Message Reading Pane (Hidden on mobile when viewing list) */}
        <div className={cn(mobileView === 'list' && 'hidden lg:block')}>
          <Panel
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
                <span>{selected?.name ?? 'No conversation'}</span>
              </div>
            }
            subtitle={selected ? 'Direct message' : undefined}
          >
            <EmptyState
              icon={<MessageSquare />}
              title={
                selected ? `Say hello to ${selected.name}` : 'Pick a conversation'
              }
              description={
                selected
                  ? 'Messages sync through Matrix once this room is provisioned.'
                  : 'Choose someone on the left to open the conversation.'
              }
              action={selected ? <Button>Start the thread</Button> : undefined}
            />
          </Panel>
        </div>
      </div>
    </Page>
  );
}
