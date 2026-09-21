import { channelApi, queryKeys } from '@org/api-client';
import { useMessageDensity, useChatPreferences } from '@org/common';
import {
  AttachmentRenderer,
  Composer,
  ComposerWarning,
  MessageRenderer,
} from '@org/chat-ui';
import type { ComposerContext } from '@org/types';
import type { Message, RoomKind, RoomMember } from '@org/matrix-client';
import { attachmentToMediaItem, useMediaPreview } from '@org/media-preview';
import { useComposerControl } from './use-composer-control.js';
import { useComposerAddActions } from './use-composer-add-actions.js';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import {
  isPolicyRoleAllowed,
  PolicySubjectRole,
  roleHasPermission,
  WorkspacePermission,
  type ChannelSummary,
} from '@org/types';
import { useCurrentWorkspace, useWorkspacePolicies } from '@org/web-workspace';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, Hash, Lock, MessagesSquare, User, Users } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMatrix } from './matrix-provider.js';
import { useAllThreads, type CrossRoomThread } from './use-all-threads.js';
import { useRoomActions, useRoomSummary } from './use-chat.js';
import { useThreadConversation } from './use-thread-conversation.js';
import { formatRoomMemberSummary } from './thread-roster.js';

export { formatRoomMemberSummary };

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

/** Every thread bucketed under the specific channel or DM it belongs to. */
interface RoomThreadGroup {
  roomId: string;
  roomName: string;
  roomKind: RoomKind;
  threads: CrossRoomThread[];
  lastActivity: number;
  unreadCount: number;
}

/** Groups a mixed thread list by the exact room it hangs off, most active room first. */
function groupThreadsByRoom(items: CrossRoomThread[]): RoomThreadGroup[] {
  const byRoom = new Map<string, RoomThreadGroup>();

  for (const thread of items) {
    let group = byRoom.get(thread.roomId);
    if (!group) {
      group = {
        roomId: thread.roomId,
        roomName: thread.roomName,
        roomKind: thread.roomKind,
        threads: [],
        lastActivity: 0,
        unreadCount: 0,
      };
      byRoom.set(thread.roomId, group);
    }
    group.threads.push(thread);
    group.lastActivity = Math.max(group.lastActivity, thread.lastReplyAt ?? 0);
    if (thread.hasUnread) group.unreadCount += 1;
  }

  return [...byRoom.values()].sort((a, b) => b.lastActivity - a.lastActivity);
}

/** Renders a message's file attachment the same way a channel timeline does. */
function useAttachmentSlot() {
  const { openPreview } = useMediaPreview();

  return useCallback(
    (message: Message): ReactNode => {
      const attachment = message.attachment;
      if (!attachment) return undefined;
      return (
        <AttachmentRenderer
          attachment={attachment}
          kind={message.kind}
          onOpen={() =>
            openPreview([
              attachmentToMediaItem(attachment, message.kind, message.id, {
                senderId: message.senderId,
                senderName: message.senderName,
                senderAvatarUrl: message.senderAvatarUrl,
                timestamp: message.timestamp,
              }),
            ])
          }
        />
      );
    },
    [openPreview],
  );
}

/* --- an opened thread's replies and a live reply box --------------------- */

function ThreadDetail({
  thread,
  channelLink,
  isPrivate,
  members,
  mentionNames,
  actions,
  myUserId,
  editing,
  setEditing,
  attachmentSlot,
  density,
}: {
  thread: CrossRoomThread;
  channelLink: string;
  isPrivate?: boolean;
  members: RoomMember[];
  mentionNames: string[];
  actions: ReturnType<typeof useRoomActions>;
  myUserId: string | undefined;
  editing: Message | null;
  setEditing: (message: Message | null) => void;
  attachmentSlot: (message: Message) => ReactNode;
  density: 'comfy' | 'compact';
}) {
  const { messages, isLoading, send, markRead } = useThreadConversation(
    thread.roomId,
    thread.id,
  );

  const { workspace, workspaceId, slug: workspaceSlug } = useCurrentWorkspace();
  const policiesQuery = useWorkspacePolicies(workspaceId);
  const canReact = isPolicyRoleAllowed(
    workspace?.role,
    policiesQuery.data?.whoCanReact ?? PolicySubjectRole.MEMBERS,
  );
  const canModerateMessages = roleHasPermission(
    workspace?.role,
    WorkspacePermission.MODERATE_MESSAGES,
  );

  const composerContext = useMemo<ComposerContext>(
    () => ({
      surfaceKind: 'thread',
      workspaceId,
      roomId: thread.roomId,
      threadRootId: thread.id,
    }),
    [workspaceId, thread.roomId, thread.id],
  );

  const composerControl = useComposerControl(composerContext, members);
  const handleAddAction = useComposerAddActions({
    workspaceId,
    roomId: thread.roomId,
    slug: workspaceSlug,
  });

  // Opening an unread thread catches its read marker up to the latest reply.
  useEffect(() => {
    if (thread.hasUnread) markRead();
  }, [markRead, thread.hasUnread]);

  const replies = useMemo(
    () => messages.filter((message) => message.id !== thread.id),
    [messages, thread.id],
  );

  const isChannel = thread.roomKind === 'channel';
  const roomLabel =
    isChannel
      ? isPrivate
        ? thread.roomName
        : `#${thread.roomName}`
      : thread.roomName;

  const { chat } = useChatPreferences();

  return (
    <div className="border-t border-border bg-muted/20">
      <div className="flex items-center gap-2 px-4 py-1.5 text-[11px] font-medium text-muted-foreground">
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
        <p className="px-4 pb-3 text-xs text-subtle">
          Be the first to reply — your message stays in this thread.
        </p>
      ) : (
        <ul>
          {replies.map((reply) => (
            <li key={reply.id}>
              <MessageRenderer
                message={reply}
                isOwn={reply.senderId === myUserId}
                density={density}
                mentionNames={mentionNames}
                threadParticipants={[]}
                onReact={
                  canReact
                    ? (key) =>
                        void actions.toggleReaction(
                          reply.id,
                          key,
                          reply.reactions.some(
                            (reaction) =>
                              reaction.key === key && reaction.reactedByMe,
                          ),
                        )
                    : undefined
                }
                onEdit={
                  reply.senderId === myUserId
                    ? () => setEditing(reply)
                    : undefined
                }
                onDelete={
                  reply.senderId === myUserId || canModerateMessages
                    ? () => void actions.remove(reply.id)
                    : undefined
                }
                canModerateMessages={canModerateMessages}
                editWindowMinutes={policiesQuery.data?.messageEditWindowMinutes}
                onRetry={
                  reply.sendState === 'failed'
                    ? () => void actions.retry(reply.id)
                    : undefined
                }
                onCopyText={() =>
                  void navigator.clipboard?.writeText(reply.body)
                }
                onCopyLink={() =>
                  void navigator.clipboard?.writeText(
                    `${window.location.origin}${window.location.pathname}#${reply.id}`,
                  )
                }
                attachmentSlot={attachmentSlot(reply)}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-border bg-card px-2 py-2">
        <Composer
          onSend={async (body) => {
            if (editing) {
              await actions.edit(editing.id, body);
              setEditing(null);
            } else {
              await send(body);
            }
          }}
          onTyping={chat?.sendTypingNotice !== false ? actions.setTyping : undefined}
          enterToSend={chat?.enterToSend ?? true}
          onAttach={(files) => void actions.attach(files, thread.id)}
          conversationId={`thread:${thread.id}`}
          members={members}
          currentUserId={myUserId}
          placeholder={editing ? 'Edit your message…' : `Reply in ${roomLabel}…`}
          showFormatting={false}
          onMentionsChange={composerControl.onMentionsChange}
          edit={
            editing ? { messageId: editing.id, initialMarkdown: editing.body } : null
          }
          contextSlot={
            editing ? (
              <div className="mb-2 flex items-center gap-2 rounded-md bg-muted px-2 py-1 text-xs">
                <span className="flex-1 truncate font-medium">
                  Editing message
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </Button>
              </div>
            ) : composerControl.warning ? (
              <ComposerWarning
                state={composerControl.warning}
                onDismiss={composerControl.dismissWarning}
                onAdd={handleAddAction}
                channelName={thread.roomName}
                surfaceKind="thread"
              />
            ) : null
          }
        />
        <div className="flex justify-end px-1 pt-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <Link to={channelLink}>
              {isChannel ? (
                isPrivate ? (
                  <Lock className="size-3 shrink-0" aria-hidden />
                ) : (
                  <Hash className="size-3 shrink-0" aria-hidden />
                )
              ) : null}
              <span>Open in {roomLabel}</span>
              <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

/* --- a thread's root, rendered as the same bubble the channel renders ---- */

function ThreadRow({
  thread,
  open,
  onToggle,
  workspaceSlug,
  channelSlugByName,
  isPrivate,
  myUserId,
  density,
}: {
  thread: CrossRoomThread;
  open: boolean;
  onToggle: (id: string) => void;
  workspaceSlug?: string;
  channelSlugByName?: Map<string, string>;
  isPrivate?: boolean;
  myUserId?: string;
  density: 'comfy' | 'compact';
}) {
  const { members } = useRoomSummary(thread.roomId);
  const actions = useRoomActions(thread.roomId);
  const attachmentSlot = useAttachmentSlot();
  const [editing, setEditing] = useState<Message | null>(null);
  const channelLink = useChannelLink(thread, workspaceSlug, channelSlugByName);

  const mentionNames = useMemo(
    () => members.map((member) => member.displayName),
    [members],
  );

  const threadParticipants = useMemo<RoomMember[]>(
    () =>
      thread.participants.map((participant) => ({
        userId: participant.userId,
        displayName: participant.name,
        avatarUrl: participant.avatarUrl,
        powerLevel: 0,
        membership: 'join' as const,
      })),
    [thread.participants],
  );

  if (!thread.root) {
    // Rare: the root hasn't synced into this room's loaded timeline yet.
    return (
      <li className="px-4 py-3 text-sm text-subtle">
        {thread.authorName} started a thread — {thread.replyCount}{' '}
        {thread.replyCount === 1 ? 'reply' : 'replies'}.
      </li>
    );
  }
  const root = thread.root;

  return (
    <li>
      <MessageRenderer
        message={root}
        isOwn={root.senderId === myUserId}
        density={density}
        mentionNames={mentionNames}
        threadReplyCount={thread.replyCount}
        threadHasUnread={thread.hasUnread}
        threadParticipants={threadParticipants}
        lastReplyAt={thread.lastReplyAt}
        onOpenThread={() => onToggle(thread.id)}
        onReact={(key) =>
          void actions.toggleReaction(
            root.id,
            key,
            root.reactions.some(
              (reaction) => reaction.key === key && reaction.reactedByMe,
            ),
          )
        }
        onEdit={
          root.senderId === myUserId
            ? () => {
                setEditing(root);
                if (!open) onToggle(thread.id);
              }
            : undefined
        }
        onDelete={
          root.senderId === myUserId
            ? () => void actions.remove(root.id)
            : undefined
        }
        onRetry={
          root.sendState === 'failed'
            ? () => void actions.retry(root.id)
            : undefined
        }
        onCopyText={() => void navigator.clipboard?.writeText(root.body)}
        onCopyLink={() =>
          void navigator.clipboard?.writeText(
            `${window.location.origin}${window.location.pathname}#${root.id}`,
          )
        }
        attachmentSlot={attachmentSlot(root)}
      />

      {open ? (
        <ThreadDetail
          thread={thread}
          channelLink={channelLink}
          isPrivate={isPrivate}
          members={members}
          mentionNames={mentionNames}
          actions={actions}
          myUserId={myUserId}
          editing={editing}
          setEditing={setEditing}
          attachmentSlot={attachmentSlot}
          density={density}
        />
      ) : null}
    </li>
  );
}

/* --- one room's threads, under its own channel/DM heading ---------------- */

function RoomThreadSection({
  group,
  openIds,
  onToggle,
  workspaceSlug,
  channelSlugByName,
  channelByName,
  channelBySlug,
  myUserId,
  density,
}: {
  group: RoomThreadGroup;
  openIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  workspaceSlug?: string;
  channelSlugByName?: Map<string, string>;
  channelByName?: Map<string, ChannelSummary>;
  channelBySlug?: Map<string, ChannelSummary>;
  myUserId?: string;
  density: 'comfy' | 'compact';
}) {
  const isChannel = group.roomKind === 'channel';
  const channel = isChannel
    ? channelByName?.get(group.roomName.toLowerCase()) ??
      channelBySlug?.get(group.roomName.toLowerCase())
    : undefined;
  const isPrivate = channel ? channel.visibility === 'PRIVATE' : false;

  const Icon = isChannel
    ? isPrivate
      ? Lock
      : Hash
    : group.roomKind === 'group'
      ? Users
      : group.roomKind === 'direct'
        ? User
        : MessagesSquare;

  const { members } = useRoomSummary(group.roomId);
  const memberSubtitle = useMemo(() => {
    const fallback =
      channel?.description ||
      channel?.topic ||
      (channel?.memberCount
        ? `${channel.memberCount} ${channel.memberCount === 1 ? 'member' : 'members'}`
        : null);
    return formatRoomMemberSummary(members, myUserId, fallback);
  }, [members, myUserId, channel]);

  const roomLink = useMemo(() => {
    if (isChannel) {
      const slug =
        channel?.slug ||
        channelSlugByName?.get(group.roomName.toLowerCase()) ||
        group.roomName.toLowerCase().replace(/[^a-z0-9-_]/g, '-') ||
        'general';
      return `/w/${workspaceSlug}/c/${slug}`;
    }
    if (group.roomKind === 'group' || group.roomKind === 'direct') {
      return `/w/${workspaceSlug}/dms?room=${group.roomId}`;
    }
    return `/w/${workspaceSlug}/dms`;
  }, [
    isChannel,
    channel,
    channelSlugByName,
    group.roomName,
    group.roomKind,
    group.roomId,
    workspaceSlug,
  ]);

  return (
    <section>
      <div className="mb-2.5 flex items-start justify-between gap-3 px-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              to={roomLink}
              className="group inline-flex min-w-0 items-center gap-1.5 transition-colors"
            >
              <Icon
                className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors"
                aria-hidden
              />
              <h3 className="truncate text-[13px] font-semibold text-foreground group-hover:underline">
                {group.roomName}
              </h3>
            </Link>
            <Badge variant="neutral" className="h-4 px-1.5 py-0 text-[10px]">
              {group.threads.length}
            </Badge>
            {group.unreadCount > 0 ? (
              <Badge variant="primary" className="h-4 px-1.5 py-0 text-[10px]">
                {group.unreadCount} unread
              </Badge>
            ) : null}
          </div>
          {memberSubtitle ? (
            <p className="mt-0.5 pl-5 truncate text-[11px] text-muted-foreground">
              {memberSubtitle}
            </p>
          ) : null}
        </div>
        {group.lastActivity ? (
          <span className="shrink-0 font-mono text-[11px] text-subtle pt-0.5">
            {formatRelative(new Date(group.lastActivity).toISOString())}
          </span>
        ) : null}
      </div>

      <Card className="gap-0 overflow-hidden p-0">
        <ul className="divide-y divide-border">
          {group.threads.map((thread) => (
            <ThreadRow
              key={thread.id}
              thread={thread}
              open={openIds.has(thread.id)}
              onToggle={onToggle}
              workspaceSlug={workspaceSlug}
              channelSlugByName={channelSlugByName}
              isPrivate={isPrivate}
              myUserId={myUserId}
              density={density}
            />
          ))}
        </ul>
      </Card>
    </section>
  );
}

function ThreadList({
  items,
  isLoading,
  emptyDescription,
  openIds,
  onToggle,
  workspaceSlug,
  firstChannelSlug,
  channelSlugByName,
  channelByName,
  channelBySlug,
  myUserId,
  density,
}: {
  items: CrossRoomThread[];
  isLoading: boolean;
  emptyDescription: string;
  openIds: ReadonlySet<string>;
  onToggle: (id: string) => void;
  workspaceSlug?: string;
  firstChannelSlug?: string;
  channelSlugByName?: Map<string, string>;
  channelByName?: Map<string, ChannelSummary>;
  channelBySlug?: Map<string, ChannelSummary>;
  myUserId?: string;
  density: 'comfy' | 'compact';
}) {
  const groups = useMemo(() => groupThreadsByRoom(items), [items]);

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
      {groups.map((group) => (
        <RoomThreadSection
          key={group.roomId}
          group={group}
          openIds={openIds}
          onToggle={onToggle}
          workspaceSlug={workspaceSlug}
          channelSlugByName={channelSlugByName}
          channelByName={channelByName}
          channelBySlug={channelBySlug}
          myUserId={myUserId}
          density={density}
        />
      ))}
    </div>
  );
}

/**
 * Every thread the reader can see, across rooms, in one place — grouped under
 * the exact channel or DM it belongs to and rendered with the same bubble a
 * channel timeline uses, so a thread here looks and behaves like it does in
 * the conversation it came from. Each one opens inline with its replies and a
 * live reply box, so following up never means leaving this page.
 */
export function ThreadsView() {
  const [tab, setTab] = useState('all');
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(
    () => new Set<string>(),
  );
  const { slug, workspaceId } = useCurrentWorkspace();
  const { client } = useMatrix();
  // Read here so this view stays consistent with whatever comfy/compact
  // preference the reader already set for channels — ChatBubble is a
  // controlled component and needs it passed explicitly.
  const density = useMessageDensity();

  const myUserId = client?.getSession()?.userId;

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

  const channelByName = useMemo(
    () =>
      new Map<string, ChannelSummary>(
        (channelsQuery.data ?? []).map((channel) => [
          channel.name.toLowerCase(),
          channel,
        ]),
      ),
    [channelsQuery.data],
  );

  const channelBySlug = useMemo(
    () =>
      new Map<string, ChannelSummary>(
        (channelsQuery.data ?? []).map((channel) => [
          channel.slug.toLowerCase(),
          channel,
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
          channelByName={channelByName}
          channelBySlug={channelBySlug}
          myUserId={myUserId}
          density={density}
        />
      </div>
    </div>
  );
}
