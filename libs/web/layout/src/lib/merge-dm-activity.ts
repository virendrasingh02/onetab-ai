import {
  mergeActivityIndicators,
  type ActivityIndicator,
} from '@org/notifications';

export type LiveDirectMessageCounts = Record<
  string,
  { unreadCount: number; mentionCount: number }
>;

/**
 * Merges live Matrix unread / mention counts over the feed-derived DM dots,
 * keyed by peer user id — the same rule the channel rows use. The feed stays
 * the backstop for rooms the client has not synced; a live count lights a row
 * the moment a message lands.
 */
export function mergeDirectMessageActivity(
  feed: Record<string, ActivityIndicator>,
  live: LiveDirectMessageCounts | undefined,
): Record<string, ActivityIndicator> {
  if (!live) return feed;
  const merged: Record<string, ActivityIndicator> = { ...feed };
  for (const [peerId, counts] of Object.entries(live)) {
    merged[peerId] = mergeActivityIndicators(feed[peerId], counts);
  }
  return merged;
}
