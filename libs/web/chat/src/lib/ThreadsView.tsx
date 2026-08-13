import {
  Badge,
  Button,
  EmptyState,
  LoadingState,
  Panel,
  Page,
  PageHeader,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  UserAvatar,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import { Hash, MessagesSquare, MessageSquareOff, Reply } from 'lucide-react';
import { useState } from 'react';
import { useMatrix } from './matrix-provider.js';
import { useAllThreads, type CrossRoomThread } from './use-all-threads.js';

function ThreadList({
  items,
  isLoading,
  emptyDescription,
}: {
  items: CrossRoomThread[];
  isLoading: boolean;
  emptyDescription: string;
}) {
  if (isLoading) return <LoadingState label="Loading threads…" />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<MessagesSquare />}
        title="Nothing here"
        description={emptyDescription}
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {items.map((thread) => (
        <li
          key={thread.id}
          className="gap-3 p-4 flex items-start hover:bg-muted/50"
        >
          <UserAvatar
            name={thread.authorName}
            src={thread.root?.senderAvatarUrl}
            seed={thread.root?.senderId ?? thread.id}
          />

          <div className="min-w-0 flex-1">
            <div className="gap-2 flex flex-wrap items-center">
              <Badge variant="outline">
                <Hash aria-hidden />
                {thread.roomName}
              </Badge>
              {thread.hasUnread ? <Badge variant="primary">Unread</Badge> : null}
            </div>

            <p className="mt-1.5 text-sm font-medium line-clamp-2 text-foreground">
              {thread.title}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Started by {thread.authorName} · {thread.replyCount}{' '}
              {thread.replyCount === 1 ? 'reply' : 'replies'}
              {thread.lastReplyAt
                ? ` · last reply ${formatRelative(new Date(thread.lastReplyAt).toISOString())}`
                : ''}
            </p>
          </div>

          <Button variant="ghost" size="sm" leadingIcon={<Reply />} disabled>
            Reply
          </Button>
        </li>
      ))}
    </ul>
  );
}

/**
 * Every thread the reader can see, across rooms, in one place.
 *
 * The rows come from the Matrix client's own view of each room's threads, so
 * this is the same data the in-channel thread panel shows — not a second,
 * separately-maintained list.
 */
export function ThreadsView() {
  const [tab, setTab] = useState('all');
  const { enabled } = useMatrix();
  const { threads, isLoading } = useAllThreads();

  const unread = threads.filter((thread) => thread.hasUnread);

  return (
    <Page>
      <PageHeader
        title="Threads"
        description="Follow-up conversations from every channel you are in."
        icon={<MessagesSquare />}
        accent="amber"
      />

      {!enabled ? (
        <Panel flush>
          <EmptyState
            icon={<MessageSquareOff />}
            title="Chat is not configured"
            description="This deployment has no Matrix homeserver, so there are no conversations to thread. Set MATRIX_ENABLED and the homeserver settings to turn on messaging."
          />
        </Panel>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList aria-label="Thread filters" className="mb-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <Panel flush>
              <ThreadList
                items={threads}
                isLoading={isLoading}
                emptyDescription="Reply in a thread from any channel and it will collect here."
              />
            </Panel>
          </TabsContent>

          <TabsContent value="unread">
            <Panel flush>
              <ThreadList
                items={unread}
                isLoading={isLoading}
                emptyDescription="You are caught up on every thread."
              />
            </Panel>
          </TabsContent>
        </Tabs>
      )}
    </Page>
  );
}
