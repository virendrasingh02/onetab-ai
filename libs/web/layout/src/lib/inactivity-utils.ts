import type {
  AIAgent,
  AICoworkerDetail,
  ChannelSummary,
  ExternalIntegration,
  WorkspaceMember,
} from '@org/types';
import type { ActivityIndicator } from '@org/notifications';
import type { GroupDirectMessageSummary } from '@org/web-chat';
import type { ChannelSignalMap } from './navigation/sidebar-sections.js';

/**
 * The sidebar folds a conversation or resource into its section's "Inactive"
 * menu once nothing has happened in it for this long.
 */
export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * An ISO string, epoch-ms number, or nothing → epoch ms. Unknown or unparseable
 * values (and matrix-js-sdk's `MIN_SAFE_INTEGER` "no events" sentinel) → 0.
 */
export function toEpoch(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/**
 * Inactive = a *known* last activity more than 30 days before `now`. An
 * unknown timestamp (0) is never inactive: we only hide what we can date.
 */
export function is30DaysInactive(latestActivityAt: number, now = Date.now()): boolean {
  if (latestActivityAt <= 0) return false;
  return now - latestActivityAt > THIRTY_DAYS_MS;
}

export interface InactivityPartition<T> {
  active: T[];
  inactive: T[];
  /** Epoch ms of each inactive item's last activity, by the item's id. */
  lastActiveAt: Record<string, number>;
}

export interface PartitionOptions {
  now?: number;
  /**
   * Items that must stay in the main list whatever their age — favorites, and
   * whatever the user currently has open (hiding the page you're on would lose
   * your place in the sidebar).
   */
  keepActive?: (id: string) => boolean;
}

/** Anything unread (incl. a manual "Mark unread") keeps a row in the main list. */
function hasUnread(indicator: ActivityIndicator | undefined): boolean {
  if (!indicator) return false;
  return (
    indicator.level !== 'none' ||
    (indicator.count ?? 0) > 0 ||
    (indicator.mentionCount ?? 0) > 0
  );
}

/**
 * The generic split: `latest` returns an item's last-activity epoch ms, or
 * `null` when the item is live right now (unread, etc.) and must stay active.
 */
export function partitionByInactivity<T>(
  items: readonly T[],
  getId: (item: T) => string,
  latest: (item: T) => number | null,
  { now = Date.now(), keepActive }: PartitionOptions = {},
): InactivityPartition<T> {
  const active: T[] = [];
  const inactive: T[] = [];
  const lastActiveAt: Record<string, number> = {};

  for (const item of items) {
    const id = getId(item);
    const at = keepActive?.(id) ? null : latest(item);
    if (at !== null && is30DaysInactive(at, now)) {
      inactive.push(item);
      lastActiveAt[id] = at;
    } else {
      active.push(item);
    }
  }

  // Most recently active first: the likeliest to be reopened.
  inactive.sort((a, b) => lastActiveAt[getId(b)] - lastActiveAt[getId(a)]);
  return { active, inactive, lastActiveAt };
}

/* -------------------------------------------------------------------------- */
/* Channels                                                                   */
/* -------------------------------------------------------------------------- */

export interface ChannelInactivityInput extends PartitionOptions {
  channels: ChannelSummary[];
  signals?: ChannelSignalMap;
  activity?: Record<string, ActivityIndicator | undefined>;
  /** Last message per channel id — the live Matrix room timestamp merged over the feed. */
  lastActivityAt?: Record<string, string | number | undefined>;
  /**
   * Whether activity data has loaded. Until it has, nothing is marked
   * inactive — otherwise busy channels would flash into "Inactive" on load.
   */
  ready?: boolean;
}

export function partitionChannelsByInactivity({
  channels,
  signals,
  activity,
  lastActivityAt = {},
  ready = true,
  now,
  keepActive,
}: ChannelInactivityInput): InactivityPartition<ChannelSummary> {
  if (!ready) return { active: [...channels], inactive: [], lastActiveAt: {} };

  const favoriteIds = new Set(
    channels.filter((c) => c.membership?.isFavorite).map((c) => c.id),
  );

  return partitionByInactivity(
    channels,
    (channel) => channel.id,
    (channel) => {
      const signal = signals?.[channel.id];
      if (
        hasUnread(activity?.[channel.id]) ||
        (signal && (signal.unreadCount > 0 || signal.mentionCount > 0))
      ) {
        return null;
      }
      // `createdAt` floors it: a channel made last week isn't stale yet even
      // if nobody has posted.
      return Math.max(
        signal?.lastActivityAt ?? 0,
        toEpoch(lastActivityAt[channel.id]),
        toEpoch(channel.createdAt),
      );
    },
    {
      now,
      keepActive: (id) => favoriteIds.has(id) || keepActive?.(id) === true,
    },
  );
}

/* -------------------------------------------------------------------------- */
/* Direct messages                                                            */
/* -------------------------------------------------------------------------- */

export interface DmInactivityInput extends PartitionOptions {
  members: WorkspaceMember[];
  /** Unread state per peer user id. */
  activity?: Record<string, ActivityIndicator | undefined>;
  /** Last message in the 1:1 room with each peer, epoch ms, by peer user id. */
  lastMessageAt?: Record<string, number | undefined>;
  /** See {@link ChannelInactivityInput.ready}. */
  ready?: boolean;
}

/**
 * A person row is inactive when your conversation with them is: no message
 * either way for 30 days — or never, for someone who joined over 30 days ago.
 * How recently *they* were online doesn't matter.
 */
export function partitionMembersByInactivity({
  members,
  activity,
  lastMessageAt = {},
  ready = true,
  now,
  keepActive,
}: DmInactivityInput): InactivityPartition<WorkspaceMember> {
  if (!ready) return { active: [...members], inactive: [], lastActiveAt: {} };

  return partitionByInactivity(
    members,
    (member) => member.user.id,
    (member) => {
      if (hasUnread(activity?.[member.user.id])) return null;
      return Math.max(
        toEpoch(lastMessageAt[member.user.id]),
        toEpoch(member.joinedAt),
      );
    },
    { now, keepActive },
  );
}

export function partitionGroupDMsByInactivity(
  groups: GroupDirectMessageSummary[],
  options: PartitionOptions = {},
): InactivityPartition<GroupDirectMessageSummary> {
  return partitionByInactivity(
    groups,
    (group) => group.roomId,
    (group) =>
      group.unreadCount > 0 || group.mentionCount > 0
        ? null
        : toEpoch(group.lastActivityAt),
    options,
  );
}

/* -------------------------------------------------------------------------- */
/* AI agents, AI coworkers, apps                                              */
/* -------------------------------------------------------------------------- */

export function partitionAgentsByInactivity(
  agents: AIAgent[],
  options: PartitionOptions = {},
): InactivityPartition<AIAgent> {
  return partitionByInactivity(
    agents,
    (agent) => agent.id,
    (agent) =>
      Math.max(
        toEpoch(agent.lastActiveAt),
        toEpoch(agent.updatedAt),
        toEpoch(agent.createdAt),
      ),
    options,
  );
}

export function partitionCoworkersByInactivity(
  coworkers: AICoworkerDetail[],
  options: PartitionOptions = {},
): InactivityPartition<AICoworkerDetail> {
  return partitionByInactivity(
    coworkers,
    (coworker) => coworker.id,
    (coworker) =>
      Math.max(
        toEpoch(coworker.lastActiveAt),
        toEpoch(coworker.updatedAt),
        toEpoch(coworker.createdAt),
      ),
    options,
  );
}

/** Apps are keyed by provider — the id the sidebar rows and favorites use. */
export function partitionAppsByInactivity(
  integrations: ExternalIntegration[],
  options: PartitionOptions = {},
): InactivityPartition<ExternalIntegration> {
  return partitionByInactivity(
    integrations,
    (integration) => integration.provider,
    (integration) =>
      Math.max(
        toEpoch(integration.lastSyncAt),
        toEpoch(integration.updatedAt),
        toEpoch(integration.createdAt),
      ),
    options,
  );
}
