import type { ThreadSummaryItem } from '@org/chat-ui';
import type { Message, RoomMember } from '@org/matrix-client';

/** Words that address the reader or the whole channel. */
const MENTION_TRIGGERS = ['@here', '@channel', '@everyone'];

export interface ChannelMention {
  message: Message;
  /** The token that matched, shown as the reason the message is listed. */
  trigger: string;
}

/** Groups a timeline's threaded replies by the message they hang off. */
export function groupReplies(messages: Message[]): Map<string, Message[]> {
  const grouped = new Map<string, Message[]>();

  for (const message of messages) {
    if (!message.threadRootId) continue;
    const existing = grouped.get(message.threadRootId);
    if (existing) existing.push(message);
    else grouped.set(message.threadRootId, [message]);
  }

  return grouped;
}

/**
 * Rolls a timeline up into one summary per thread.
 *
 * Threads are a view over the timeline rather than a separate resource, so
 * every surface that shows them — the side panel, the channel tab, a future
 * cross-channel inbox — derives them the same way from whatever messages it
 * already has.
 */
export function deriveThreads(
  messages: Message[],
  members: RoomMember[],
  options: { myUserId?: string; lastReadAt?: number } = {},
): ThreadSummaryItem[] {
  const byId = new Map(messages.map((message) => [message.id, message]));
  const memberById = new Map(members.map((member) => [member.userId, member]));
  const replies = groupReplies(messages);

  const summaries: ThreadSummaryItem[] = [];

  for (const [rootId, thread] of replies) {
    const root = byId.get(rootId);
    if (!root) continue;

    const lastReplyAt = Math.max(...thread.map((reply) => reply.timestamp));
    const participantIds = [
      ...new Set([root.senderId, ...thread.map((reply) => reply.senderId)]),
    ];

    summaries.push({
      root,
      replyCount: thread.length,
      participants: participantIds
        .map((userId) => memberById.get(userId))
        .filter((member): member is RoomMember => !!member),
      lastReplyAt,
      // Unread means someone else replied after the reader last caught up.
      hasUnread:
        thread.at(-1)?.senderId !== options.myUserId &&
        (options.lastReadAt === undefined || lastReplyAt > options.lastReadAt),
    });
  }

  return summaries.sort((a, b) => b.lastReplyAt - a.lastReplyAt);
}

/**
 * Messages that address the reader by name, or the channel as a whole.
 *
 * Matching the body is a stand-in for Matrix push rules, which is where real
 * mentions come from; the shape of the result is what the tab renders either
 * way.
 */
export function deriveMentions(
  messages: Message[],
  options: { myUserId?: string; myDisplayName?: string } = {},
): ChannelMention[] {
  const tokens = [...MENTION_TRIGGERS];
  if (options.myDisplayName) {
    tokens.unshift(`@${options.myDisplayName.toLowerCase()}`);
  }

  return messages.flatMap((message) => {
    if (message.senderId === options.myUserId || message.isRedacted) return [];

    const body = message.body.toLowerCase();
    const trigger = tokens.find((token) => body.includes(token));
    return trigger ? [{ message, trigger }] : [];
  });
}
