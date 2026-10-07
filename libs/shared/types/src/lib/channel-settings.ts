/**
 * Channel settings policy — the tab strip, visibility changes and deletion.
 *
 * Pure functions only, shared by the API (which enforces them) and the web
 * client (which uses them to decide what to offer), the same arrangement as
 * `channel-policy.ts`.
 */

import { canManageChannelMembers } from './composer-policy.js';
import {
  ChannelTabPolicy,
  ChannelVisibility,
  WorkspaceRole,
  hasWorkspaceRole,
} from './enums.js';
import type { ChannelViewer } from './channel-policy.js';

/**
 * The channel tabs that can be reordered or hidden, in their default order.
 * "Messages" is not one of them — it is always first and always shown.
 */
export const CHANNEL_TAB_IDS = ['files-media', 'bookmarks', 'pins'] as const;
export type ChannelTabId = (typeof CHANNEL_TAB_IDS)[number];

export function isChannelTabId(id: string): id is ChannelTabId {
  return (CHANNEL_TAB_IDS as readonly string[]).includes(id);
}

export interface ResolvedChannelTab {
  id: ChannelTabId;
  hidden: boolean;
}

/**
 * The full tab strip for a stored layout: `order` first (unknown and repeated
 * ids dropped), then any tab it doesn't mention in default order — so a tab
 * shipped after a channel saved its layout still appears.
 */
export function resolveChannelTabs(
  order: readonly string[] = [],
  hidden: readonly string[] = [],
): ResolvedChannelTab[] {
  const hiddenSet = new Set(hidden);
  const seen = new Set<ChannelTabId>();
  const ids: ChannelTabId[] = [];
  for (const id of [...order, ...CHANNEL_TAB_IDS]) {
    if (!isChannelTabId(id) || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids.map((id) => ({ id, hidden: hiddenSet.has(id) }));
}

/** Canonical form of a submitted layout, as the API stores it. */
export function normalizeChannelTabLayout(
  order: readonly string[],
  hidden: readonly string[],
): { tabOrder: ChannelTabId[]; hiddenTabs: ChannelTabId[] } {
  const tabs = resolveChannelTabs(order, hidden);
  return {
    tabOrder: tabs.map((tab) => tab.id),
    hiddenTabs: tabs.filter((tab) => tab.hidden).map((tab) => tab.id),
  };
}

type SettingsViewer = Pick<ChannelViewer, 'channelRole' | 'workspaceRole'>;

function isWorkspaceAdmin(viewer: SettingsViewer): boolean {
  return (
    viewer.workspaceRole !== null &&
    hasWorkspaceRole(viewer.workspaceRole, WorkspaceRole.ADMIN)
  );
}

/**
 * Whether `viewer` may add, remove or reorder the channel's tabs. EVERYONE
 * still means everyone *in the channel* — previewing a public channel you
 * haven't joined doesn't let you rearrange it for its members.
 */
export function canManageChannelTabs(
  policy: ChannelTabPolicy,
  viewer: SettingsViewer,
): boolean {
  if (canManageChannelMembers(viewer)) return true;
  return policy === ChannelTabPolicy.EVERYONE && viewer.channelRole !== null;
}

/**
 * Public → private is a channel manager's call. Private → public is reserved
 * for workspace admins and owners: it hands the channel's whole history to
 * everyone in the workspace, including people who were deliberately left out.
 */
export function canChangeChannelVisibility(
  to: ChannelVisibility,
  viewer: SettingsViewer,
): boolean {
  return to === ChannelVisibility.PUBLIC
    ? isWorkspaceAdmin(viewer)
    : canManageChannelMembers(viewer);
}

/** Permanently deleting a channel is a workspace admin/owner action. */
export function canDeleteChannel(viewer: SettingsViewer): boolean {
  return isWorkspaceAdmin(viewer);
}

/**
 * #general is everyone's channel: the API refuses to archive, delete, make
 * private or leave it, so the UI hides those actions rather than offer them.
 */
export function isGeneralChannel(channel: { slug: string }): boolean {
  return channel.slug === 'general';
}
