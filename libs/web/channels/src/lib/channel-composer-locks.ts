import type { ChannelSummary } from '@org/types';

const ANNOUNCEMENT_ONLY =
  'Only admins and designated members can post in this announcement channel.';

/**
 * Why the viewer can't post (or reply) in `channel`, for the composers'
 * read-only bars — or undefined where they can. Shared by every surface that
 * renders a channel conversation, so they all lock the same way.
 *
 * Locks only on an explicit `false`: a channel cached before `canPost` /
 * `canReply` shipped has them `undefined`, and should not flash the bar until
 * the next refetch fills them in.
 */
export function channelComposerLocks(channel: ChannelSummary): {
  composerReadOnlyMessage?: string;
  threadComposerReadOnlyMessage?: string;
} {
  if (!channel.membership) return {};
  return {
    composerReadOnlyMessage:
      channel.canPost === false
        ? channel.mode === 'ANNOUNCEMENT'
          ? ANNOUNCEMENT_ONLY
          : 'You don’t have permission to post in this channel.'
        : undefined,
    /* Distinct from the main composer: an announcement channel can allow
       top-level posts while replies are switched off (`allowReplies`), which
       `canPost` alone would miss. */
    threadComposerReadOnlyMessage:
      channel.canReply === false
        ? channel.canPost === false
          ? ANNOUNCEMENT_ONLY
          : 'Replies are turned off in this announcement channel.'
        : undefined,
  };
}
