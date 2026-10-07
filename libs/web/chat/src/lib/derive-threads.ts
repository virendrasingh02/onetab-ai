import type { ThreadSummaryItem } from '@org/chat-ui';
import type { Message, RoomMember, Thread } from '@org/matrix-client';

/**
 * How many replies a thread has. Counting the loaded replies is exact once the
 * whole thread is in (deleted replies already dropped), but before the thread
 * is opened the client holds only its newest page — then the server's count
 * is the truth.
 */
export function threadReplyCount(loaded: number, summary?: Thread): number {
  if (!summary?.hasOlderReplies) return loaded;
  return Math.max(loaded, summary.replyCount);
}

/** Words that address the reader or the whole channel. */
const MENTION_TRIGGERS = ['@here', '@channel', '@everyone'];

export interface ChannelMention {
  message: Message;
  /** The token that matched, shown as the reason the message is listed. */
  trigger: string;
}

/**
 * Groups a timeline's threaded replies by the message they hang off. Deleted
 * replies are left out, so they neither render nor count towards "N replies".
 */
export function groupReplies(messages: Message[]): Map<string, Message[]> {
  const grouped = new Map<string, Message[]>();

  for (const message of messages) {
    if (!message.threadRootId || message.isRedacted) continue;
    const existing = grouped.get(message.threadRootId);
    if (existing) existing.push(message);
    else grouped.set(message.threadRootId, [message]);
  }

  // Older replies can land after newer ones (a thread's history is loaded
  // after its live replies have already arrived), so order by time. Stable,
  // so equal timestamps keep their arrival order.
  for (const replies of grouped.values()) {
    replies.sort((a, b) => a.timestamp - b.timestamp);
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
  options: {
    myUserId?: string;
    lastReadAt?: number;
    /** The client's per-thread summaries, for counts of partly loaded threads. */
    summaries?: ReadonlyMap<string, Thread>;
  } = {},
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
      replyCount: threadReplyCount(thread.length, options.summaries?.get(rootId)),
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
 * The real answer comes from Matrix push rules, surfaced per message as
 * `Message.isMention` — that is what covers a keyword or an id-localpart
 * mention the body scan would miss, and what agrees with the room's highlight
 * count and the floating "unread mentions" pill. Matching the body is kept only
 * as the fallback for before the client has synced its push rules (`isMention`
 * still `undefined`).
 */
export function deriveMentions(
  messages: Message[],
  options: { myUserId?: string; myDisplayName?: string } = {},
): ChannelMention[] {
  const tokens = [...MENTION_TRIGGERS];
  if (options.myDisplayName) {
    tokens.unshift(`@${options.myDisplayName.toLowerCase()}`);
  }

  const labelFor = (body: string) =>
    tokens.find((token) => body.includes(token)) ??
    (options.myDisplayName ? `@${options.myDisplayName}` : '@you');

  return messages.flatMap((message) => {
    if (message.senderId === options.myUserId || message.isRedacted) return [];

    const body = message.body.toLowerCase();
    if (message.isMention !== undefined) {
      return message.isMention ? [{ message, trigger: labelFor(body) }] : [];
    }

    const trigger = tokens.find((token) => body.includes(token));
    return trigger ? [{ message, trigger }] : [];
  });
}
