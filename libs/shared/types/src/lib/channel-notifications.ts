/**
 * A member's per-channel notification level — Slack's "All new posts / Just
 * mentions / Nothing".
 *
 * Stored as two membership flags rather than one enum so the long-standing
 * `isMuted` keeps its meaning everywhere it is already read: `isMuted` is
 * "Nothing", and `mentionsOnly` only counts while the channel is not muted.
 * Muting therefore never loses the level underneath — unmuting a channel that
 * was on "Just mentions" goes back to "Just mentions".
 *
 * The level governs *notifications* (sounds, alerts). Unread state is not
 * affected: a "Just mentions" channel still turns bold when something new
 * arrives, exactly as in Slack.
 */

export type ChannelNotificationLevel = 'all' | 'mentions' | 'nothing';

export interface ChannelNotificationFlags {
  isMuted: boolean;
  mentionsOnly?: boolean;
}

export function channelNotificationLevel(
  membership: ChannelNotificationFlags | null | undefined,
): ChannelNotificationLevel {
  if (!membership) return 'all';
  if (membership.isMuted) return 'nothing';
  return membership.mentionsOnly ? 'mentions' : 'all';
}

/**
 * The preferences patch that moves a membership to `level`. "Nothing" only
 * sets `isMuted`, leaving `mentionsOnly` as it was so unmuting restores it.
 */
export function channelNotificationLevelInput(
  level: ChannelNotificationLevel,
): { isMuted: boolean; mentionsOnly?: boolean } {
  if (level === 'nothing') return { isMuted: true };
  return { isMuted: false, mentionsOnly: level === 'mentions' };
}

export const CHANNEL_NOTIFICATION_LEVEL_LABELS: Record<
  ChannelNotificationLevel,
  string
> = {
  all: 'All new posts',
  mentions: 'Just mentions',
  nothing: 'Nothing',
};
