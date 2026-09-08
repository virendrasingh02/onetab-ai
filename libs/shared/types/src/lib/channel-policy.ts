/**
 * Channel posting policy (brief §3) — one source of truth for "who may post
 * here", shared by the API (which enforces it, and mirrors it into the Matrix
 * room's power levels) and the web client (which uses it to hide the composer
 * rather than let a message bounce).
 *
 * Pure functions only — no I/O — so both sides import the same rules and the
 * button state and the server can never drift apart, exactly like
 * `permissions.ts`.
 */

import { ChannelMode, ChannelRole, WorkspaceRole, hasWorkspaceRole } from './enums.js';

export interface ChannelPostingContext {
  mode: ChannelMode;
  /** The channel's creator — always an authorized poster. */
  createdById: string;
  /** Extra user ids allowed to post in announcement mode. */
  announcementPosterIds: readonly string[];
}

export interface ChannelViewer {
  userId: string;
  /** The viewer's role in this channel, or null when they are not a member. */
  channelRole: ChannelRole | null;
  /** The viewer's workspace role, or null when not a workspace member. */
  workspaceRole: WorkspaceRole | null;
}

/**
 * Whether `viewer` may post in a channel with `channel`'s policy.
 *
 * - STANDARD — any channel member may post (matches today's behaviour).
 * - ANNOUNCEMENT — only channel admins, the creator, workspace admins/owners,
 *   and anyone named in `announcementPosterIds`.
 */
export function canPostInChannel(
  channel: ChannelPostingContext,
  viewer: ChannelViewer,
): boolean {
  if (channel.mode === ChannelMode.STANDARD) {
    return viewer.channelRole !== null;
  }
  return isAuthorizedAnnouncementPoster(channel, viewer);
}

/** The authorized-poster test for an announcement channel, ignoring `mode`. */
export function isAuthorizedAnnouncementPoster(
  channel: Pick<ChannelPostingContext, 'createdById' | 'announcementPosterIds'>,
  viewer: ChannelViewer,
): boolean {
  if (viewer.channelRole === ChannelRole.ADMIN) return true;
  if (channel.createdById === viewer.userId) return true;
  if (
    viewer.workspaceRole !== null &&
    hasWorkspaceRole(viewer.workspaceRole, WorkspaceRole.ADMIN)
  ) {
    return true;
  }
  return channel.announcementPosterIds.includes(viewer.userId);
}

/**
 * The full set of user ids allowed to post in an announcement channel, given
 * the channel's own fields plus the resolved admin id lists. The API uses this
 * to decide which members get raised to a posting power level in the Matrix
 * room; nobody outside this set can send `m.room.message` there.
 */
export function announcementPosterUserIds(input: {
  createdById: string;
  announcementPosterIds: readonly string[];
  channelAdminIds: readonly string[];
  workspaceAdminIds: readonly string[];
}): string[] {
  return [
    ...new Set([
      input.createdById,
      ...input.announcementPosterIds,
      ...input.channelAdminIds,
      ...input.workspaceAdminIds,
    ]),
  ];
}

/**
 * Whether the viewer may add a reply / thread message in this channel.
 * Standard: any member. Announcement: authorized posters, and only when
 * replies are enabled.
 */
export function canReplyInChannel(
  channel: ChannelPostingContext & { allowReplies: boolean },
  viewer: ChannelViewer,
): boolean {
  if (channel.mode === ChannelMode.STANDARD) return viewer.channelRole !== null;
  return channel.allowReplies && isAuthorizedAnnouncementPoster(channel, viewer);
}
