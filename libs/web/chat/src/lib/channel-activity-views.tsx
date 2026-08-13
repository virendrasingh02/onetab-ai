import { ThreadListPanel } from '@org/chat-ui';
import type { Message, RoomMember } from '@org/matrix-client';
import { Badge, EmptyState, LoadingState, UserAvatar } from '@org/ui';
import { formatListTimestamp } from '@org/utils';
import { AtSign, MessageSquareOff } from 'lucide-react';
import { useMemo } from 'react';
import { deriveMentions, deriveThreads } from './derive-threads.js';
import { useMatrix } from './matrix-provider.js';
import { useChannelRoom } from './use-channel-room.js';
import { useRoom } from './use-chat.js';

export interface ChannelActivityProps {
  channelId: string;
  channelName: string;
}

/**
 * Threads and mentions read from the same timeline the conversation does.
 *
 * They live here rather than in `@org/web-channels` for the same reason
 * `ChannelChat` does: the channel library asks for a channel's threads and
 * gets them, without learning where a timeline comes from.
 *
 * `myUserId` comes from the Matrix session, not the application user: the
 * timeline addresses people by their Matrix id, so a mention of "me" can only
 * be recognised in those terms.
 */
function useChannelTimeline(channelId: string) {
  const { client, enabled } = useMatrix();
  const { roomId } = useChannelRoom(channelId);
  const live = useRoom(roomId ?? undefined);

  return {
    messages: live.messages,
    members: live.members,
    myUserId: client?.getSession()?.userId,
    // Without a homeserver there is no timeline to wait for.
    isLoading: enabled && live.isLoading,
    isConfigured: enabled,
  };
}

export function ChannelThreads({ channelId }: ChannelActivityProps) {
  const timeline = useChannelTimeline(channelId);

  const threads = useMemo(
    () =>
      deriveThreads(timeline.messages, timeline.members, {
        myUserId: timeline.myUserId,
      }),
    [timeline.messages, timeline.members, timeline.myUserId],
  );

  if (timeline.isLoading) return <LoadingState label="Loading threads…" />;

  if (!timeline.isConfigured) return <ChatNotConfigured subject="Threads" />;

  return <ThreadListPanel threads={threads} />;
}

export function ChannelMentions({
  channelId,
  channelName,
}: ChannelActivityProps) {
  const timeline = useChannelTimeline(channelId);

  const myDisplayName = timeline.members.find(
    (member: RoomMember) => member.userId === timeline.myUserId,
  )?.displayName;

  const mentions = useMemo(
    () =>
      deriveMentions(timeline.messages, {
        myUserId: timeline.myUserId,
        myDisplayName,
      }),
    [timeline.messages, timeline.myUserId, myDisplayName],
  );

  if (timeline.isLoading) return <LoadingState label="Loading mentions…" />;

  if (!timeline.isConfigured) return <ChatNotConfigured subject="Mentions" />;

  if (mentions.length === 0) {
    return (
      <EmptyState
        icon={<AtSign />}
        title="No mentions"
        description={`Messages that mention you, or the whole of #${channelName}, will appear here.`}
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {mentions.map(({ message, trigger }) => (
        <MentionRow key={message.id} message={message} trigger={trigger} />
      ))}
    </ul>
  );
}

/** Shown in place of a timeline-derived tab when there is no homeserver. */
function ChatNotConfigured({ subject }: { subject: string }) {
  return (
    <EmptyState
      icon={<MessageSquareOff />}
      title="Chat is not configured"
      description={`${subject} are derived from this channel's conversation, and this deployment has no Matrix homeserver.`}
    />
  );
}

function MentionRow({
  message,
  trigger,
}: {
  message: Message;
  trigger: string;
}) {
  return (
    <li className="gap-3 p-3 flex items-start hover:bg-muted/50">
      <UserAvatar
        name={message.senderName}
        src={message.senderAvatarUrl}
        seed={message.senderId}
        size="sm"
      />

      <div className="min-w-0 flex-1">
        <div className="gap-2 flex items-baseline">
          <span className="text-sm font-semibold truncate">
            {message.senderName}
          </span>
          <span className="text-xs shrink-0 text-subtle">
            {formatListTimestamp(message.timestamp)}
          </span>
          <Badge variant="primary" className="ml-auto shrink-0">
            {trigger}
          </Badge>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{message.body}</p>
      </div>
    </li>
  );
}
