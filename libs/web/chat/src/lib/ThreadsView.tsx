import { channelApi, queryKeys } from '@org/api-client';
import { useQuery } from '@tanstack/react-query';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  Tabs,
  TabsList,
  TabsTrigger,
  UserAvatar,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import { Hash, MessagesSquare, Reply } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAllThreads, type CrossRoomThread } from './use-all-threads.js';

function ThreadList({
  items,
  isLoading,
  emptyDescription,
  workspaceSlug,
  firstChannelSlug,
}: {
  items: CrossRoomThread[];
  isLoading: boolean;
  emptyDescription: string;
  workspaceSlug?: string;
  firstChannelSlug?: string;
}) {
  if (isLoading) return <LoadingState label="Loading threads…" />;

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<MessagesSquare />}
        title="No threads yet"
        description={emptyDescription}
        action={
          firstChannelSlug ? (
            <Button asChild size="sm" variant="outline">
              <Link to={`/w/${workspaceSlug}/c/${firstChannelSlug}`}>
                Open #{firstChannelSlug}
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link to={`/w/${workspaceSlug}/channels`}>Browse channels</Link>
            </Button>
          )
        }
      />
    );
  }

  return (
    <ul className="space-y-2.5">
      {items.map((thread) => {
        const channelSlug =
          thread.roomName?.toLowerCase().replace(/[^a-z0-9-_]/g, '-') ||
          'general';
        const channelLink = `/w/${workspaceSlug}/c/${channelSlug}`;

        return (
          <li key={thread.id}>
            <Card className="p-4 gap-4 group flex items-start justify-between bg-surface transition-colors hover:border-border-strong">
              <div className="gap-3 min-w-0 flex flex-1 items-start">
                <UserAvatar
                  name={thread.authorName}
                  src={thread.root?.senderAvatarUrl}
                  seed={thread.root?.senderId ?? thread.id}
                />

                <div className="min-w-0 flex-1">
                  <div className="gap-2 flex flex-wrap items-center">
                    <span className="text-xs font-semibold text-foreground">
                      {thread.authorName}
                    </span>
                    <Link
                      to={channelLink}
                      className="gap-1 font-medium inline-flex items-center text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <Badge
                        variant="outline"
                        className="gap-1 py-0 h-5 text-[11px]"
                      >
                        <Hash className="size-3" aria-hidden />
                        {thread.roomName}
                      </Badge>
                    </Link>
                    {thread.hasUnread ? (
                      <Badge variant="primary" className="py-0 h-4 text-[10px]">
                        Unread
                      </Badge>
                    ) : null}
                    {thread.lastReplyAt ? (
                      <span className="font-mono text-[11px] text-muted-foreground">
                        · last reply{' '}
                        {formatRelative(
                          new Date(thread.lastReplyAt).toISOString(),
                        )}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-2 text-xs sm:text-sm font-medium leading-relaxed line-clamp-2 text-foreground">
                    {thread.title}
                  </p>
                  <p className="mt-1.5 font-mono text-[10px] text-subtle">
                    {thread.replyCount}{' '}
                    {thread.replyCount === 1 ? 'reply' : 'replies'} in
                    conversation
                  </p>
                </div>
              </div>

              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs shrink-0"
              >
                <Link to={channelLink}>
                  <Reply className="size-3.5" />
                  <span>Reply</span>
                </Link>
              </Button>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Every thread the reader can see, across rooms, in one place.
 */
export function ThreadsView() {
  const [tab, setTab] = useState('all');
  const { slug, workspaceId } = useCurrentWorkspace();
  const channelsQuery = useQuery({
    queryKey: queryKeys.channels.list(workspaceId ?? '', false),
    queryFn: () => channelApi.list(workspaceId as string, false),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
  const { threads, isLoading } = useAllThreads();

  const unread = useMemo(
    () => threads.filter((thread) => thread.hasUnread),
    [threads],
  );

  const activeThreads = tab === 'unread' ? unread : threads;
  const firstChannel = channelsQuery.data?.[0]?.slug ?? 'general';

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      {/* Channel-style Header (Inbox & Saved style) */}
      <div className="top-0 backdrop-blur-md sticky z-20 shrink-0 border-b border-border bg-background/95">
        <div className="gap-2.5 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between">
          <div className="min-w-0 gap-2 flex items-center">
            <div className="min-w-0 gap-1.5 flex items-center">
              <MessagesSquare
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <h2 className="text-sm font-semibold tracking-tight truncate text-foreground">
                Threads
              </h2>
              {/* <Badge
                variant={threads.length > 0 ? 'primary' : 'neutral'}
                className="px-1.5 py-0 h-4.5 text-[11px]"
              >
                {threads.length > 0 ? `${threads.length} threads` : '0 threads'}
              </Badge> */}
            </div>

            {/* <div className="h-4 mx-1 sm:block hidden w-px bg-border" />

            <p className="min-w-0 text-xs sm:block hidden max-w-[48ch] truncate text-muted-foreground">
              Follow-up conversations from every channel you are in
            </p> */}
          </div>

          <div className="gap-2 flex items-center">
            <Tabs value={tab} onValueChange={setTab} className="h-7">
              <TabsList className="h-7 p-0.5">
                <TabsTrigger value="all" className="h-6 px-2.5 text-xs">
                  All
                </TabsTrigger>
                <TabsTrigger
                  value="unread"
                  className="h-6 px-2.5 text-xs gap-1"
                >
                  <span>Unread</span>
                  {unread.length > 0 ? (
                    <Badge
                      variant="neutral"
                      className="px-1 py-0 h-3.5 text-[10px]"
                    >
                      {unread.length}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      <div className="min-h-0 p-3 sm:p-6 flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          <ThreadList
            items={activeThreads}
            isLoading={isLoading}
            emptyDescription={
              tab === 'unread'
                ? 'You are caught up on every thread.'
                : 'Reply in a thread from any channel and it will collect here.'
            }
            workspaceSlug={slug}
            firstChannelSlug={firstChannel}
          />
        </div>
      </div>
    </div>
  );
}
