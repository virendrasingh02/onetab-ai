import { channelApi, queryKeys } from '@org/api-client';
import { Composer, MarkdownMessage } from '@org/chat-ui';
import type { Message } from '@org/matrix-client';
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
import { cn, formatListTimestamp, formatRelative } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpRight,
  ChevronDown,
  Hash,
  MessagesSquare,
  Paperclip,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMatrix } from './matrix-provider.js';
import { useAllThreads, type CrossRoomThread } from './use-all-threads.js';
import { useRoomActions, useRoomSummary } from './use-chat.js';
import { useThreadConversation } from './use-thread-conversation.js';

/** The route that opens this thread in its own conversation. */
function useChannelLink(
  thread: CrossRoomThread,
  workspaceSlug: string | undefined,
  channelSlugByName?: Map<string, string>,
) {
  return useMemo(() => {
    if (thread.roomKind === 'channel') {
      const slug =
        channelSlugByName?.get(thread.roomName?.toLowerCase() ?? '') ||
        thread.roomName?.toLowerCase().replace(/[^a-z0-9-_]/g, '-') ||
        'general';
      return `/w/${workspaceSlug}/c/${slug}?thread=${thread.id}`;
    }
    if (thread.roomKind === 'group') {
      return `/w/${workspaceSlug}/dms?room=${thread.roomId}&thread=${thread.id}`;
    }
    return `/w/${workspaceSlug}/dms`;
  }, [thread, workspaceSlug, channelSlugByName]);
}

/* --- one message row inside an opened thread ----------------------------- */

function ThreadMessage({
  message,
  isOwn,
  mentionNames,
}: {
  message: Message;
  isOwn: boolean;
  mentionNames: string[];
}) {
  return (
    <div className="flex items-start gap-2.5">
      <UserAvatar
        name={message.senderName}
        src={message.senderAvatarUrl}
        seed={message.senderId}
        size="sm"
        indicator={false}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-foreground">
            {message.senderName}
          </span>
          {isOwn ? (
            <span className="text-[10px] font-normal text-subtle">you</span>
          ) : null}
          <span className="shrink-0 text-[10px] text-subtle">
            {formatListTimestamp(message.timestamp)}
          </span>
          {message.sendState === 'sending' ? (
            <span className="text-[10px] text-subtle">sending…</span>
          ) : null}
          {message.sendState === 'failed' ? (
            <span className="text-[10px] font-medium text-destructive">
              failed to send
            </span>
          ) : null}
        </div>

        {message.isRedacted ? (
          <p className="mt-0.5 text-[13px] italic text-subtle">
            This message was deleted.
          </p>
        ) : message.body ? (
          <MarkdownMessage
            text={message.body}
            mentionNames={mentionNames}
            className="mt-0.5"
          />
        ) : null}

        {message.attachment ? (
          <a
            href={message.attachment.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex max-w-full items-center gap-1 text-xs text-primary-text hover:underline"
          >
            <Paperclip className="size-3 shrink-0" aria-hidden />
            <span className="truncate">{message.attachment.name}</span>
          </a>
        ) : null}
      </div>
    </div>
  );
}

/* --- an opened thread: root, replies, and a live reply box -------------- */

function ThreadDetail({
  thread,
  channelLink,
}: {
  thread: CrossRoomThread;
  channelLink: string;
}) {
  const { client } = useMatrix();
  const { members } = useRoomSummary(thread.roomId);
  const actions = useRoomActions(thread.roomId);
  const { messages, isLoading, send, markRead } = useThreadConversation(
    thread.roomId,
    thread.id,
  );

  const myUserId = client?.getSession()?.userId;

  // Opening an unread thread catches its read marker up to the latest reply.
  useEffect(() => {
    if (thread.hasUnread) markRead();
  }, [markRead, thread.hasUnread]);

  const rootMessage =
    thread.root ?? messages.find((message) => message.id === thread.id) ?? null;
  const replies = useMemo(
    () => messages.filter((message) => message.id !== thread.id),
    [messages, thread.id],
  );
  const mentionNames = useMemo(
    () => members.map((member) => member.displayName),
    [members],
  );

  const roomLabel =
    thread.roomKind === 'channel'
      ? `#${thread.roomName}`
      : thread.roomKind === 'group'
        ? thread.roomName
        : 'conversation';

  return (
    <div className="border-t border-border bg-muted/30">
      {rootMessage ? (
        <div className="px-3 py-3 sm:px-4">
          <ThreadMessage
            message={rootMessage}
            isOwn={rootMessage.senderId === myUserId}
            mentionNames={mentionNames}
          />
        </div>
      ) : null}

      <div className="px-3 sm:px-4">
        <div className="flex items-center gap-2 py-1 text-[11px] font-medium text-muted-foreground">
          <span className="h-px flex-1 bg-border" aria-hidden />
          <span>
            {isLoading
              ? 'Loading replies…'
              : replies.length === 0
                ? 'No replies yet'
                : `${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
          </span>
          <span className="h-px flex-1 bg-border" aria-hidden />
        </div>

        {!isLoading && replies.length === 0 ? (
          <p className="pb-3 text-xs text-subtle">
            Be the first to reply — your message stays in this thread.
          </p>
        ) : (
          <ul className="space-y-3 pb-3">
            {replies.map((reply) => (
              <li key={reply.id}>
                <ThreadMessage
                  message={reply}
                  isOwn={reply.senderId === myUserId}
                  mentionNames={mentionNames}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border bg-card px-2 py-2">
        <Composer
          onSend={send}
          onTyping={actions.setTyping}
          onAttach={(files) => void actions.attach(files, thread.id)}
          conversationId={`thread:${thread.id}`}
          members={members}
          currentUserId={myUserId}
          placeholder={`Reply in ${roomLabel}…`}
          showFormatting={false}
        />
        <div className="flex justify-end px-1 pt-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Link to={channelLink}>
              <span>Open in {roomLabel}</span>
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/* --- collapsed thread summary ----------------------------------------------- */

function ThreadRow({
  thread,
  open,
  onToggle,
  workspaceSlug,
  channelSlugByName,
}: {
  thread: CrossRoomThread;
  open: boolean;
  onToggle: (id: string) => void;
  workspaceSlug?: string;
  channelSlugByName?: Map<string, string>;
}) {
  const isChannel = thread.roomKind === 'channel';
  const channelLink = useChannelLink(thread, workspaceSlug, channelSlugByName);

  return (
    <li>
      <Card
        className={cn(
          'gap-0 overflow-hidden p-0 bg-card transition-colors',
          open ? 'border-border-strong' : 'hover:border-border-strong',
        )}
      >
        <button
          type="button"
          onClick={() => onToggle(thread.id)}
          aria-expanded={open}
          className="flex w-full items-start gap-3 p-3 text-left outline-none focus-visible:bg-muted/40 sm:p-4"
        >
          <UserAvatar
            name={thread.authorName}
            src={thread.root?.senderAvatarUrl}
            seed={thread.root?.senderId ?? thread.id}
            size="md"
            indicator={false}
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate text-sm font-semibold text-foreground">
                {thread.authorName}
              </span>
              <span className="inline-flex h-5 items-center gap-1 rounded-md border border-border bg-muted/60 px-1.5 text-[11px] font-medium text-muted-foreground">
                {isChannel ? (
                  <Hash className="size-3 shrink-0" aria-hidden />
                ) : (
                  <MessagesSquare className="size-3 shrink-0" aria-hidden />
                )}
                <span className="max-w-[16ch] truncate">{thread.roomName}</span>
              </span>
              {thread.hasUnread ? (
                <Badge variant="primary" className="h-4 py-0 text-[10px]">
                  Unread
                </Badge>
              ) : null}
              {thread.lastReplyAt ? (
                <span className="ml-auto shrink-0 font-mono text-[11px] text-subtle">
                  {formatRelative(new Date(thread.lastReplyAt).toISOString())}
                </span>
              ) : null}
            </div>

            <p
              className={cn(
                'mt-1.5 text-sm leading-relaxed text-foreground',
                !open && 'line-clamp-2',
              )}
            >
              {thread.title}
            </p>

            <div className="mt-2 flex items-center gap-2">
              {thread.participants.length > 0 ? (
                <span className="flex items-center -space-x-1.5">
                  {thread.participants.slice(0, 3).map((participant) => (
                    <UserAvatar
                      key={participant.userId}
                      name={participant.name}
                      src={participant.avatarUrl}
                      seed={participant.userId}
                      size="xs"
                      indicator={false}
                      className="ring-2 ring-card"
                    />
                  ))}
                </span>
              ) : null}
              <span className="text-xs font-medium text-primary-text">
                {thread.replyCount}{' '}
                {thread.replyCount === 1 ? 'reply' : 'replies'}
              </span>
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                {open ? 'Hide thread' : 'Open & reply'}
                <ChevronDown
                  className={cn(
                    'size-3.5 transition-transform',
                    open && 'rotate-180',
                  )}
                  aria-hidden
                />
              </span>
            </div>
          </div>
        </button>

        {open ? (
          <ThreadDetail thread={thread} channelLink={channelLink} />
        ) : null}
      </Card>
    </li>
  );
}

/** Buckets a mixed thread list into the sidebar's own top-level categories. */
const THREAD_GROUPS: ReadonlyArray<{
  key: string;
  label: string;
  icon: typeof Hash;
  match: (thread: CrossRoomThread) => boolean;
}> = [
  {
    key: 'channels',
    label: 'Channels',
    icon: Hash,
    match: (thread) => thread.roomKind === 'channel',
  },
  {
    key: 'dms',
    label: 'Direct Messages',
    icon: MessagesSquare,
    match: (thread) => thread.roomKind !== 'channel',
  },
];

function ThreadList({
  items,
  isLoading,
  emptyDescription,
  openIds,
  onToggle,
  workspaceSlug,
  firstChannelSlug,
  channelSlugByName,
}: {
  items: CrossRoomThread[];
  isLoading: boolean;
  emptyDescription: string;
  openIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  workspaceSlug?: string;
  firstChannelSlug?: string;
  channelSlugByName?: Map<string, string>;
}) {
  const groups = useMemo(
    () =>
      THREAD_GROUPS.map((group) => ({
        ...group,
        items: items.filter(group.match),
      })).filter((group) => group.items.length > 0),
    [items],
  );

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
    <div className="space-y-6">
      {groups.map((group) => {
        const Icon = group.icon;
        return (
          <section key={group.key}>
            <h3 className="mb-2.5 flex items-center gap-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Icon className="size-3.5" aria-hidden />
              <span>{group.label}</span>
              <Badge variant="neutral" className="h-4 px-1.5 py-0 text-[10px]">
                {group.items.length}
              </Badge>
            </h3>
            <ul className="space-y-2.5">
              {group.items.map((thread) => (
                <ThreadRow
                  key={thread.id}
                  thread={thread}
                  open={openIds.has(thread.id)}
                  onToggle={onToggle}
                  workspaceSlug={workspaceSlug}
                  channelSlugByName={channelSlugByName}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/**
 * Every thread the reader can see, across rooms, in one place — each one
 * openable inline with its replies and a live reply box, so following up never
 * means leaving this page.
 */
export function ThreadsView() {
  const [tab, setTab] = useState('all');
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const { slug, workspaceId } = useCurrentWorkspace();

  const channelsQuery = useQuery({
    queryKey: queryKeys.channels.list(workspaceId ?? '', false),
    queryFn: () => channelApi.list(workspaceId as string, false),
    enabled: !!workspaceId,
    staleTime: 30_000,
  });
  const { threads, isLoading } = useAllThreads();

  const toggle = useCallback((id: string) => {
    setOpenIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const unread = useMemo(
    () => threads.filter((thread) => thread.hasUnread),
    [threads],
  );

  const channelSlugByName = useMemo(
    () =>
      new Map(
        (channelsQuery.data ?? []).map((channel) => [
          channel.name.toLowerCase(),
          channel.slug,
        ]),
      ),
    [channelsQuery.data],
  );

  const activeThreads = tab === 'unread' ? unread : threads;
  const firstChannel = channelsQuery.data?.[0]?.slug ?? 'general';

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background text-foreground">
      <div className="sticky top-0 z-20 shrink-0 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="flex min-h-12 flex-wrap items-center justify-between gap-2.5 px-3 py-1.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <MessagesSquare
              className="size-4 shrink-0 text-primary"
              aria-hidden
            />
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
              Threads
            </h2>
            <Badge variant="outline" className="h-5 px-1.5 py-0 text-[11px]">
              {threads.length}
            </Badge>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="h-7">
            <TabsList className="h-7 p-0.5">
              <TabsTrigger value="all" className="h-6 px-2.5 text-xs">
                All
              </TabsTrigger>
              <TabsTrigger
                value="unread"
                className="h-6 gap-1 px-2.5 text-xs"
              >
                <span>Unread</span>
                {unread.length > 0 ? (
                  <Badge
                    variant="neutral"
                    className="h-3.5 px-1 py-0 text-[10px]"
                  >
                    {unread.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6">
        <div className="mx-auto max-w-3xl">
          <ThreadList
            items={activeThreads}
            isLoading={isLoading}
            emptyDescription={
              tab === 'unread'
                ? 'You are caught up on every thread.'
                : 'Reply in a thread from any channel and it will collect here.'
            }
            openIds={openIds}
            onToggle={toggle}
            workspaceSlug={slug}
            firstChannelSlug={firstChannel}
            channelSlugByName={channelSlugByName}
          />
        </div>
      </div>
    </div>
  );
}
