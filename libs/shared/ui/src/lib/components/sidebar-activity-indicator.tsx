import { cn } from '@org/utils';
import { createContext, useContext, type ReactNode } from 'react';
import type { ActivityLevel } from './activity-dot.js';
import { Badge } from './badge.js';

/* -------------------------------------------------------------------------- */
/*  Activity-state model                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Which sidebar an item lives in. A preference can silence a whole surface, so
 * every indicator has to say where it is being rendered.
 */
export type SidebarActivitySurface =
  'main' | 'workspace' | 'channels' | 'dms' | 'notifications' | 'other';

/** A dot, a numeric badge, or "let the count decide". */
export type ActivityIndicatorType = 'dot' | 'badge' | 'auto';

/**
 * The reusable per-item activity model. Every sidebar row builds one of these
 * from whatever unread/notification data it already has — no row hard-codes a
 * dot or a badge (brief §4).
 */
export interface SidebarActivityState {
  /** Ambient "something happened here" with no useful count. */
  hasActivity?: boolean;
  /** Unread items. `0` (or absent) means there is nothing to count. */
  unreadCount?: number;
  /** `mention` is addressed to you and always outranks ambient activity. */
  activityType?: ActivityLevel;
  /** Force this one row to a style, overriding the user's global preference. */
  indicatorType?: ActivityIndicatorType;
  /** `high` renders like a mention even without an explicit `activityType`. */
  priority?: 'low' | 'normal' | 'high';
  /** Muted rows keep a mention dot but drop ambient activity (Slack's rule). */
  isMuted?: boolean;
  /** The row is the active route. Carried for callers; does not change the mark. */
  isSelected?: boolean;
  /** Hidden / disabled / permission-gated rows never show an indicator. */
  disabled?: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Preference config + context                                                */
/* -------------------------------------------------------------------------- */

/**
 * The resolved user preferences that gate every indicator in the app. Supplied
 * once, high in the tree, by {@link SidebarActivityConfigProvider}; read from
 * context by every indicator so call sites never thread it through.
 */
export interface SidebarActivityConfig {
  /** Master switch for every dot and badge. */
  enabled: boolean;
  /** Global style when a row does not override it. */
  style: ActivityIndicatorType;
  /** When false, `auto`/`badge` degrade to a dot. */
  showCounts: boolean;
  /** Per-surface opt-out. */
  surfaces: Record<SidebarActivitySurface, boolean>;
  /** Count at which a badge switches to `"N+"` (product convention: 99). */
  maxCount: number;
}

export const DEFAULT_SIDEBAR_ACTIVITY_CONFIG: SidebarActivityConfig = {
  enabled: true,
  style: 'auto',
  showCounts: true,
  surfaces: {
    main: true,
    workspace: true,
    channels: true,
    dms: true,
    notifications: true,
    other: true,
  },
  maxCount: 99,
};

const SidebarActivityConfigContext = createContext<SidebarActivityConfig>(
  DEFAULT_SIDEBAR_ACTIVITY_CONFIG,
);

export function SidebarActivityConfigProvider({
  value,
  children,
}: {
  value: SidebarActivityConfig;
  children: ReactNode;
}) {
  return (
    <SidebarActivityConfigContext.Provider value={value}>
      {children}
    </SidebarActivityConfigContext.Provider>
  );
}

/**
 * The active indicator preferences. Falls back to "everything on, auto style"
 * when no provider is mounted, so the components stay usable in isolation
 * (tests, storybook, one-off screens).
 */
export function useSidebarActivityConfig(): SidebarActivityConfig {
  return useContext(SidebarActivityConfigContext);
}

/* -------------------------------------------------------------------------- */
/*  Resolver                                                                   */
/* -------------------------------------------------------------------------- */

export interface ResolvedSidebarActivity {
  render: 'none' | 'dot' | 'badge';
  tone: 'activity' | 'mention';
  /** Raw unread count (may be 0). */
  count: number;
  /** Clamped for display, e.g. `"99+"`. */
  display: string;
  /** Screen-reader sentence, e.g. `"3 unread messages in #general"`. */
  label: string;
}

const NONE: ResolvedSidebarActivity = {
  render: 'none',
  tone: 'activity',
  count: 0,
  display: '0',
  label: '',
};

function clampCount(count: number, maxCount: number): string {
  return count > maxCount ? `${maxCount}+` : String(count);
}

/**
 * Turns an item's {@link SidebarActivityState} plus the user's
 * {@link SidebarActivityConfig} into a concrete instruction — show nothing, a
 * dot, or a count badge — and the label to read aloud.
 *
 * Pure and side-effect free, so it can be unit-tested and reused for the
 * "does this row read as unread" decision ({@link hasSidebarActivity}).
 */
export function resolveSidebarActivity(
  state: SidebarActivityState | undefined,
  config: SidebarActivityConfig,
  surface: SidebarActivitySurface,
  opts: { itemLabel?: string } = {},
): ResolvedSidebarActivity {
  if (!state || state.disabled) return NONE;
  if (!config.enabled || !config.surfaces[surface]) return NONE;

  const count = Math.max(0, Math.trunc(state.unreadCount ?? 0));
  const isMention =
    state.activityType === 'mention' || state.priority === 'high';
  const hasAmbient =
    state.hasActivity === true ||
    count > 0 ||
    state.activityType === 'activity';

  // Muted: a mention still gets through, ambient chatter does not.
  if (state.isMuted && !isMention) return NONE;
  if (!isMention && !hasAmbient) return NONE;

  const tone: 'activity' | 'mention' = isMention ? 'mention' : 'activity';

  // Dot vs badge. `auto` and `badge` both need a real count and the
  // show-counts preference; without either they fall back to a dot.
  const requested = state.indicatorType ?? config.style;
  const render: 'dot' | 'badge' =
    requested !== 'dot' && config.showCounts && count > 0 ? 'badge' : 'dot';

  const display = clampCount(count, config.maxCount);
  const noun =
    surface === 'dms' || surface === 'channels'
      ? 'unread message'
      : 'unread item';

  let label: string;
  if (isMention) {
    label = opts.itemLabel
      ? `You were mentioned in ${opts.itemLabel}`
      : 'You were mentioned';
    if (render === 'badge') label += ` (${display})`;
  } else if (render === 'badge') {
    label = `${display} ${noun}${count === 1 ? '' : 's'}`;
    if (opts.itemLabel) label += ` in ${opts.itemLabel}`;
  } else {
    label = opts.itemLabel
      ? `Unread activity in ${opts.itemLabel}`
      : 'Unread activity';
  }

  return { render, tone, count, display, label };
}

/**
 * Whether this row should read as "unread" — used to bold the label
 * independently of whether the dot/badge itself is being drawn.
 */
export function hasSidebarActivity(
  state: SidebarActivityState | undefined,
  config: SidebarActivityConfig,
  surface: SidebarActivitySurface,
): boolean {
  return resolveSidebarActivity(state, config, surface).render !== 'none';
}

/* -------------------------------------------------------------------------- */
/*  Components                                                                 */
/* -------------------------------------------------------------------------- */

export interface SidebarBadgeProps {
  /** Pre-clamped text, e.g. `"5"` or `"99+"`. */
  children: ReactNode;
  tone?: 'activity' | 'mention';
  /** Read aloud — the digits alone are not descriptive. */
  label?: string;
  className?: string;
}

/**
 * The numeric count pill shared by every sidebar. A `mention` reuses
 * {@link ActivityDot}'s solid destructive treatment; ambient activity gets a
 * quiet tinted pill so a busy sidebar does not turn into a wall of red.
 */
export function SidebarBadge({
  children,
  tone = 'activity',
  label,
  className,
}: SidebarBadgeProps) {
  return (
    <Badge
      variant={tone === 'mention' ? 'count' : 'neutral'}
      role="img"
      aria-label={label}
      className={cn(
        'h-4 min-w-4 px-1 py-0 shrink-0 justify-center font-mono text-[10px] leading-none tabular-nums',
        tone === 'mention'
          ? 'border-transparent'
          : 'border-transparent bg-primary/15 text-primary-text',
        className,
      )}
    >
      {children}
    </Badge>
  );
}

export interface SidebarActivityIndicatorProps {
  state: SidebarActivityState | undefined;
  surface: SidebarActivitySurface;
  /** Row name, woven into the accessible label ("3 unread messages in #general"). */
  itemLabel?: string;
  /** Collapsed rail: overlay the icon and add a ring so it reads off the glyph. */
  collapsed?: boolean;
  className?: string;
}

/**
 * The one activity mark for every sidebar — main nav, workspace switcher,
 * channels, DMs, notifications, resource sections. Reads the active
 * {@link SidebarActivityConfig} from context, so user preferences (off / dot /
 * badge / per-surface) apply everywhere without the call site knowing.
 *
 * Renders `null` when there is nothing to show, so callers drop it in
 * unconditionally and never branch on it.
 */
export function SidebarActivityIndicator({
  state,
  surface,
  itemLabel,
  collapsed = false,
  className,
}: SidebarActivityIndicatorProps) {
  const config = useSidebarActivityConfig();
  const resolved = resolveSidebarActivity(state, config, surface, {
    itemLabel,
  });

  if (resolved.render === 'none') return null;

  if (resolved.render === 'badge') {
    return (
      <SidebarBadge
        tone={resolved.tone}
        label={resolved.label}
        className={cn(
          collapsed && '-right-1 -top-1 absolute ring-2 ring-background',
          className,
        )}
      >
        {resolved.display}
      </SidebarBadge>
    );
  }

  return (
    /* `role="img"`, not `role="status"`: a sidebar full of live regions would
       announce every row as its dot changed. The label is read when the row it
       sits in is read, which is when it matters. */
    <span
      role="img"
      aria-label={resolved.label}
      className={cn(
        'size-2 block shrink-0 rounded-full',
        resolved.tone === 'mention' ? 'bg-destructive' : 'bg-primary',
        collapsed && 'right-1 top-1 absolute ring-2 ring-background',
        className,
      )}
    />
  );
}

export interface WorkspaceActivityIndicatorProps {
  state: SidebarActivityState | undefined;
  itemLabel?: string;
  /** Positioned over a workspace avatar — adds a ring to separate it. */
  overlay?: boolean;
  className?: string;
}

/**
 * Workspace-level indicator — the switcher trigger and each workspace row. Same
 * engine as {@link SidebarActivityIndicator}, pinned to the `workspace` surface
 * and a hair larger so workspace activity is not mistaken for a single
 * channel's (brief §3 visual hierarchy).
 */
export function WorkspaceActivityIndicator({
  state,
  itemLabel,
  overlay = false,
  className,
}: WorkspaceActivityIndicatorProps) {
  const config = useSidebarActivityConfig();
  const resolved = resolveSidebarActivity(state, config, 'workspace', {
    itemLabel,
  });

  if (resolved.render === 'none') return null;

  if (resolved.render === 'badge') {
    return (
      <SidebarBadge
        tone={resolved.tone}
        label={resolved.label}
        className={cn(overlay && 'ring-2 ring-background', className)}
      >
        {resolved.display}
      </SidebarBadge>
    );
  }

  return (
    <span
      role="img"
      aria-label={resolved.label}
      className={cn(
        'size-2.5 block shrink-0 rounded-full',
        resolved.tone === 'mention' ? 'bg-destructive' : 'bg-primary',
        overlay && 'ring-2 ring-background',
        className,
      )}
    />
  );
}
