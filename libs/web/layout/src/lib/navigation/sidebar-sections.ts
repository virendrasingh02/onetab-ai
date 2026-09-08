/**
 * Smart sidebar sections and channel sorting — pure logic (brief §1.1 / §1.2).
 *
 * Everything here is a pure function over data the sidebar already has in
 * memory (the channel list, the per-channel activity indicators the notification
 * feed produces, and a small per-workspace preference blob). No network, no
 * store access — so it is trivially unit-testable and safe to run inside a
 * `useMemo` that recomputes whenever realtime activity moves.
 *
 * Persistence: the section definitions, per-channel metadata, visit tallies and
 * the chosen sort all live inside `SidebarPreference.data` (see `sidebar-store`
 * + `use-sidebar-sync`), keyed by workspace id, so a user's organisation of
 * Workspace A never touches Workspace B and the whole thing follows them to
 * another device without a new table or endpoint.
 */

import type { ChannelSummary } from '@org/types';

/* -------------------------------------------------------------------------- */
/* Channel sorting (§1.2)                                                      */
/* -------------------------------------------------------------------------- */

export type ChannelSortMode =
  /** `#general` first, then A→Z — the historical sidebar order. */
  | 'default'
  | 'alphabetical'
  /** Most recent message / activity first. */
  | 'recentActivity'
  | 'unreadCount'
  | 'mentions'
  /** Most frequently opened first. */
  | 'frequency'
  | 'priority'
  /** The user's explicit drag order (`channelOrders`). */
  | 'manual';

export type ChannelSortDirection = 'asc' | 'desc';

export interface ChannelSortPreference {
  mode: ChannelSortMode;
  direction: ChannelSortDirection;
}

export const CHANNEL_SORT_MODES: readonly {
  value: ChannelSortMode;
  label: string;
  /** Copy for the ascending / descending toggle in this mode. */
  asc: string;
  desc: string;
}[] = [
  { value: 'default', label: 'Default', asc: 'A → Z', desc: 'Z → A' },
  { value: 'alphabetical', label: 'Name', asc: 'A → Z', desc: 'Z → A' },
  {
    value: 'recentActivity',
    label: 'Recent activity',
    asc: 'Oldest first',
    desc: 'Newest first',
  },
  {
    value: 'unreadCount',
    label: 'Unread count',
    asc: 'Fewest first',
    desc: 'Most first',
  },
  {
    value: 'mentions',
    label: 'Mentions',
    asc: 'Fewest first',
    desc: 'Most first',
  },
  {
    value: 'frequency',
    label: 'Frequency of use',
    asc: 'Least used first',
    desc: 'Most used first',
  },
  {
    value: 'priority',
    label: 'Priority',
    asc: 'Lowest first',
    desc: 'Highest first',
  },
  { value: 'manual', label: 'Custom (drag)', asc: '', desc: '' },
];

export const DEFAULT_CHANNEL_SORT: ChannelSortPreference = {
  mode: 'default',
  direction: 'asc',
};

/** The direction that reads as "natural" the moment a user picks a mode. */
export function defaultDirectionFor(
  mode: ChannelSortMode,
): ChannelSortDirection {
  return mode === 'alphabetical' || mode === 'default' ? 'asc' : 'desc';
}

/* -------------------------------------------------------------------------- */
/* Smart section rules (§1.1)                                                  */
/* -------------------------------------------------------------------------- */

export type SmartRule =
  | { type: 'unread' }
  | { type: 'mentions' }
  | { type: 'recent'; withinHours: number }
  | { type: 'frequent'; top: number }
  | { type: 'favorites' }
  | { type: 'priority'; min: 1 | 2 | 3 }
  | { type: 'keyword'; value: string }
  | { type: 'unresolvedNotifications' }
  | { type: 'project' };

export type SmartRuleType = SmartRule['type'];

export const SMART_RULES: readonly {
  type: SmartRuleType;
  label: string;
  description: string;
}[] = [
  {
    type: 'unread',
    label: 'Unread',
    description: 'Channels with unread messages.',
  },
  {
    type: 'mentions',
    label: 'Mentions',
    description: 'Channels where you were mentioned.',
  },
  {
    type: 'recent',
    label: 'Recently active',
    description: 'Channels with a message in the last 48 hours.',
  },
  {
    type: 'frequent',
    label: 'Frequently visited',
    description: 'The channels you open most often.',
  },
  {
    type: 'favorites',
    label: 'Favorites',
    description: 'Channels you have starred.',
  },
  {
    type: 'priority',
    label: 'High priority',
    description: 'Channels you marked medium priority or higher.',
  },
  {
    type: 'keyword',
    label: 'Matches a keyword',
    description: 'Channels whose name or topic contains a word you choose.',
  },
  {
    type: 'unresolvedNotifications',
    label: 'Needs attention',
    description: 'Channels with an unread mention or notification.',
  },
  {
    type: 'project',
    label: 'Project channels',
    description: 'Channels whose name matches one of your projects.',
  },
];

export function defaultRuleFor(type: SmartRuleType): SmartRule {
  switch (type) {
    case 'recent':
      return { type: 'recent', withinHours: 48 };
    case 'frequent':
      return { type: 'frequent', top: 8 };
    case 'priority':
      return { type: 'priority', min: 2 };
    case 'keyword':
      return { type: 'keyword', value: '' };
    default:
      return { type } as SmartRule;
  }
}

export function describeRule(rule: SmartRule): string {
  switch (rule.type) {
    case 'recent':
      return `Active in the last ${rule.withinHours}h`;
    case 'frequent':
      return `Top ${rule.top} most opened`;
    case 'priority':
      return `Priority ≥ ${['', 'low', 'medium', 'high'][rule.min]}`;
    case 'keyword':
      return rule.value ? `Contains “${rule.value}”` : 'Contains a keyword';
    default:
      return SMART_RULES.find((r) => r.type === rule.type)?.label ?? rule.type;
  }
}

/* -------------------------------------------------------------------------- */
/* Section definitions                                                        */
/* -------------------------------------------------------------------------- */

export type SidebarSectionKind = 'manual' | 'smart';

export interface SidebarSectionDef {
  id: string;
  label: string;
  kind: SidebarSectionKind;
  order: number;
  collapsed: boolean;
  /** Manual sections only — explicit channel membership, in display order. */
  channelIds?: string[];
  /** Smart sections only. */
  rule?: SmartRule;
  /** Hide the section entirely while it resolves to nothing. */
  hideWhenEmpty: boolean;
}

export function createSectionId(): string {
  return `sec-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export const CHANNEL_PRIORITY_LABELS = ['None', 'Low', 'Medium', 'High'] as const;
export type ChannelPriority = 0 | 1 | 2 | 3;

/* -------------------------------------------------------------------------- */
/* Per-channel signals                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Everything a rule or a sort comparator can ask about one channel, already
 * distilled from the activity feed, the live Matrix room counts and the
 * per-workspace preference blob.
 */
export interface ChannelSignal {
  unreadCount: number;
  mentionCount: number;
  /** Epoch ms of the last known activity; 0 when unknown. */
  lastActivityAt: number;
  visitCount: number;
  lastVisitAt: number;
  priority: ChannelPriority;
  isFavorite: boolean;
  /** Id of the project whose name this channel's name matches, if any. */
  matchedProjectId: string | null;
}

export const EMPTY_SIGNAL: ChannelSignal = {
  unreadCount: 0,
  mentionCount: 0,
  lastActivityAt: 0,
  visitCount: 0,
  lastVisitAt: 0,
  priority: 0,
  isFavorite: false,
  matchedProjectId: null,
};

export type ChannelSignalMap = Record<string, ChannelSignal>;

function signalOf(map: ChannelSignalMap, id: string): ChannelSignal {
  return map[id] ?? EMPTY_SIGNAL;
}

/* -------------------------------------------------------------------------- */
/* Sorting                                                                    */
/* -------------------------------------------------------------------------- */

function isGeneral(channel: ChannelSummary): boolean {
  return channel.slug === 'general' || channel.name === 'general';
}

/** Direction-independent tiebreak: `#general`, then case-insensitive name. */
export function generalFirstThenName(
  a: ChannelSummary,
  b: ChannelSummary,
): number {
  if (isGeneral(a) && !isGeneral(b)) return -1;
  if (!isGeneral(a) && isGeneral(b)) return 1;
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

function primaryCompare(
  mode: ChannelSortMode,
  a: ChannelSummary,
  b: ChannelSummary,
  sa: ChannelSignal,
  sb: ChannelSignal,
): number {
  switch (mode) {
    case 'alphabetical':
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    case 'recentActivity':
      return sa.lastActivityAt - sb.lastActivityAt;
    case 'unreadCount':
      return sa.unreadCount - sb.unreadCount;
    case 'mentions':
      return sa.mentionCount - sb.mentionCount;
    case 'frequency':
      return sa.visitCount - sb.visitCount;
    case 'priority':
      return sa.priority - sb.priority;
    case 'default':
    case 'manual':
      return 0;
  }
}

/**
 * Orders a channel list by the user's chosen sort.
 *
 * `manual` is returned untouched — the caller keeps applying its own
 * `channelOrders` drag order. Every other mode sorts ascending by the mode's
 * key, flips for `desc`, and always falls back to `generalFirstThenName` so
 * equal keys keep a stable, familiar order.
 */
export function sortChannels(
  channels: ChannelSummary[],
  signals: ChannelSignalMap,
  { mode, direction }: ChannelSortPreference,
): ChannelSummary[] {
  if (mode === 'manual') return channels;

  const sorted = [...channels];
  sorted.sort((a, b) => {
    const primary = primaryCompare(
      mode,
      a,
      b,
      signalOf(signals, a.id),
      signalOf(signals, b.id),
    );
    if (primary !== 0) return direction === 'desc' ? -primary : primary;
    return generalFirstThenName(a, b);
  });
  return sorted;
}

/* -------------------------------------------------------------------------- */
/* Rule evaluation                                                            */
/* -------------------------------------------------------------------------- */

function matchesKeyword(channel: ChannelSummary, raw: string): boolean {
  const needle = raw.trim().toLowerCase();
  if (!needle) return false;
  return [channel.name, channel.slug, channel.topic, channel.description]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .some((v) => v.toLowerCase().includes(needle));
}

/**
 * The channels a smart section shows, already ordered the way that rule reads
 * best (unread by count, recent by recency, keyword by name, …).
 */
export function resolveSmartSection(
  rule: SmartRule,
  channels: ChannelSummary[],
  signals: ChannelSignalMap,
  now: number = Date.now(),
): ChannelSummary[] {
  const withSignal = channels.map((c) => ({ c, s: signalOf(signals, c.id) }));

  const pick = (
    predicate: (e: { c: ChannelSummary; s: ChannelSignal }) => boolean,
    compare: (
      a: { c: ChannelSummary; s: ChannelSignal },
      b: { c: ChannelSummary; s: ChannelSignal },
    ) => number,
    limit?: number,
  ): ChannelSummary[] => {
    const out = withSignal
      .filter(predicate)
      .sort((a, b) => {
        const primary = compare(a, b);
        return primary !== 0 ? primary : generalFirstThenName(a.c, b.c);
      })
      .map((e) => e.c);
    return typeof limit === 'number' ? out.slice(0, limit) : out;
  };

  switch (rule.type) {
    case 'unread':
      return pick(
        (e) => e.s.unreadCount > 0 || e.s.mentionCount > 0,
        (a, b) => b.s.unreadCount - a.s.unreadCount,
      );
    case 'mentions':
      return pick(
        (e) => e.s.mentionCount > 0,
        (a, b) => b.s.mentionCount - a.s.mentionCount,
      );
    case 'recent': {
      const floor = now - rule.withinHours * 3_600_000;
      return pick(
        (e) => e.s.lastActivityAt >= floor && e.s.lastActivityAt > 0,
        (a, b) => b.s.lastActivityAt - a.s.lastActivityAt,
      );
    }
    case 'frequent':
      return pick(
        (e) => e.s.visitCount > 0,
        (a, b) => b.s.visitCount - a.s.visitCount,
        Math.max(1, rule.top),
      );
    case 'favorites':
      return pick(
        (e) => e.s.isFavorite || e.c.membership?.isFavorite === true,
        () => 0,
      );
    case 'priority':
      return pick(
        (e) => e.s.priority >= rule.min,
        (a, b) => b.s.priority - a.s.priority,
      );
    case 'keyword':
      return pick((e) => matchesKeyword(e.c, rule.value), () => 0);
    case 'unresolvedNotifications':
      return pick(
        (e) => e.s.mentionCount > 0 || e.s.unreadCount > 0,
        (a, b) => b.s.lastActivityAt - a.s.lastActivityAt,
      );
    case 'project':
      return pick(
        (e) => e.s.matchedProjectId !== null,
        (a, b) =>
          (a.s.matchedProjectId ?? '').localeCompare(
            b.s.matchedProjectId ?? '',
          ),
      );
  }
}

/* -------------------------------------------------------------------------- */
/* Layout resolution                                                          */
/* -------------------------------------------------------------------------- */

export interface ResolvedSidebarSection {
  def: SidebarSectionDef;
  channels: ChannelSummary[];
}

export interface ResolvedSidebarLayout {
  /** Custom + smart sections, in `order`, ready to render above "Channels". */
  sections: ResolvedSidebarSection[];
  /**
   * Channels not claimed by any *manual* section — the list the built-in
   * "Channels" section renders (still subject to the chosen sort). Smart
   * sections mirror channels without removing them from here.
   */
  unsectioned: ChannelSummary[];
}

/**
 * Splits `channels` across the user's section definitions.
 *
 * - **Manual** sections take exactly their listed channels (stale ids dropped)
 *   and *remove* them from `unsectioned` — a channel lives in one manual
 *   section at a time, Slack-style.
 * - **Smart** sections are a computed view: they show matching channels but do
 *   not claim them, so the same channel can appear under "Unread" and still be
 *   in "Channels" below.
 *
 * Purely a function of its inputs, so a `useMemo` keyed on the channel list +
 * signals + defs recomputes it the instant realtime activity changes — no
 * refetch, no page reload (§1.1).
 */
export function resolveSidebarLayout(input: {
  channels: ChannelSummary[];
  defs: SidebarSectionDef[];
  signals: ChannelSignalMap;
  now?: number;
}): ResolvedSidebarLayout {
  const { channels, defs, signals, now = Date.now() } = input;
  const byId = new Map(channels.map((c) => [c.id, c]));
  const claimed = new Set<string>();

  const ordered = [...defs].sort((a, b) => a.order - b.order);
  const sections: ResolvedSidebarSection[] = [];

  for (const def of ordered) {
    let resolved: ChannelSummary[];

    if (def.kind === 'manual') {
      resolved = (def.channelIds ?? [])
        .map((id) => byId.get(id))
        .filter((c): c is ChannelSummary => !!c);
      for (const c of resolved) claimed.add(c.id);
    } else if (def.rule) {
      resolved = resolveSmartSection(def.rule, channels, signals, now);
    } else {
      resolved = [];
    }

    sections.push({ def, channels: resolved });
  }

  return {
    sections,
    unsectioned: channels.filter((c) => !claimed.has(c.id)),
  };
}

/* -------------------------------------------------------------------------- */
/* Signal derivation helpers                                                  */
/* -------------------------------------------------------------------------- */

export interface ChannelActivityLike {
  count?: number;
  mentionCount?: number;
}

export interface ChannelVisitEntry {
  count: number;
  lastAt: string;
}

export interface ChannelMetaEntry {
  priority?: ChannelPriority;
}

/**
 * Builds the {@link ChannelSignalMap} the sort + rules run on.
 *
 * Everything is already in the sidebar's hands: `activity` is the same
 * per-channel indicator the rows render, `lastActivityAt` comes from the
 * notification feed, `visits` / `meta` are the per-workspace preference blob,
 * and `projectNames` lets a channel be tagged to a project by name match.
 */
export function buildChannelSignals(input: {
  channels: ChannelSummary[];
  activity: Record<string, ChannelActivityLike | undefined>;
  lastActivityAt: Record<string, string | number | undefined>;
  visits: Record<string, ChannelVisitEntry | undefined>;
  meta: Record<string, ChannelMetaEntry | undefined>;
  projects: readonly { id: string; name: string }[];
}): ChannelSignalMap {
  const { channels, activity, lastActivityAt, visits, meta, projects } = input;

  const projectByNormalizedName = new Map<string, string>();
  for (const p of projects) {
    const key = p.name.trim().toLowerCase();
    if (key) projectByNormalizedName.set(key, p.id);
  }

  const toEpoch = (v: string | number | undefined): number => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (typeof v === 'string') {
      const parsed = Date.parse(v);
      return Number.isNaN(parsed) ? 0 : parsed;
    }
    return 0;
  };

  const map: ChannelSignalMap = {};
  for (const channel of channels) {
    const act = activity[channel.id];
    const visit = visits[channel.id];
    const normName = channel.name.trim().toLowerCase();

    map[channel.id] = {
      unreadCount: Math.max(0, act?.count ?? 0),
      mentionCount: Math.max(0, act?.mentionCount ?? 0),
      lastActivityAt: Math.max(
        toEpoch(lastActivityAt[channel.id]),
        toEpoch(channel.updatedAt),
      ),
      visitCount: Math.max(0, visit?.count ?? 0),
      lastVisitAt: toEpoch(visit?.lastAt),
      priority: (meta[channel.id]?.priority ?? 0) as ChannelPriority,
      isFavorite: channel.membership?.isFavorite === true,
      matchedProjectId: projectByNormalizedName.get(normName) ?? null,
    };
  }
  return map;
}
