import {
  Badge,
  Button,
  EmptyState,
  LoadingState,
  Panel,
  Tabs,
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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Channel-style Header */}
      <div className="border-b border-border bg-background">
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 sm:px-6 py-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <MessagesSquare className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
                Threads
              </h2>
              {unread.length > 0 ? (
                <Badge variant="primary" className="text-[11px] px-1.5 py-0 h-4.5">
                  {unread.length} unread
                </Badge>
              ) : null}
            </div>

            <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

            <p className="hidden min-w-0 max-w-[48ch] truncate text-xs text-muted-foreground sm:block">
              Follow-up conversations from every channel you are in
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Tabs value={tab} onValueChange={setTab} className="h-7">
              <TabsList className="h-7 p-0.5">
                <TabsTrigger value="all" className="h-6 px-2.5 text-xs">
                  All
                </TabsTrigger>
                <TabsTrigger value="unread" className="h-6 px-2.5 text-xs gap-1">
                  <span>Unread</span>
                  {unread.length > 0 ? (
                    <Badge variant="neutral" className="text-[10px] px-1 py-0 h-3.5">
                      {unread.length}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6">
        {!enabled ? (
          <Panel flush>
            <EmptyState
              icon={<MessageSquareOff />}
              title="Chat is not configured"
              description="This deployment has no Matrix homeserver, so there are no conversations to thread. Set MATRIX_ENABLED and the homeserver settings to turn on messaging."
            />
          </Panel>
        ) : (
          <div className="mx-auto max-w-5xl">
            {tab === 'all' ? (
              <Panel flush>
                <ThreadList
                  items={threads}
                  isLoading={isLoading}
                  emptyDescription="Reply in a thread from any channel and it will collect here."
                />
              </Panel>
            ) : (
              <Panel flush>
                <ThreadList
                  items={unread}
                  isLoading={isLoading}
                  emptyDescription="You are caught up on every thread."
                />
              </Panel>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
