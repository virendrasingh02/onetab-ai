import {
  DEFAULT_NAV_GROUPS,
  DEFAULT_NAV_ITEMS,
  type NavGroupConfig,
  type NavItemConfig,
} from './navigation.config.js';
import type { SidebarItemPreference } from './sidebar-store.js';

export interface ResolvedNavItem extends NavItemConfig {
  /** Full route path inside the workspace */
  fullPath: string;
  /** Resolved visibility */
  isVisible: boolean;
  /** Effective sort order */
  effectiveOrder: number;
}

export interface ResolvedNavGroup extends NavGroupConfig {
  items: ResolvedNavItem[];
}

export interface NavigationResolutionContext {
  workspaceSlug: string;
  inboxUnread?: number;
  permissions?: string[];
  featureFlags?: Record<string, boolean>;
}

/**
 * Normalization layer combining:
 * 1. Default navigation definition
 * 2. User preferences (visibility & custom order)
 * 3. Dynamic context (unread badges, permissions, feature flags)
 *
 * Guaranteed Safe: When new platform navigation items are introduced, they
 * are smoothly merged using their default group & order without overwriting
 * existing user preferences.
 */
export function resolveNavigation(
  userPreferences: Record<string, SidebarItemPreference> | undefined,
  context: NavigationResolutionContext,
): {
  groups: ResolvedNavGroup[];
  allItems: ResolvedNavItem[];
  visibleItems: ResolvedNavItem[];
  coreItems: ResolvedNavItem[];
} {
  const { workspaceSlug, inboxUnread = 0, permissions = [], featureFlags = {} } = context;

  // 1. Resolve every configured item
  const allItems: ResolvedNavItem[] = DEFAULT_NAV_ITEMS.map((item, defaultIndex) => {
    const userPref = userPreferences?.[item.id];

    // Visibility: user pref if defined, else item default
    const isVisible = userPref?.visible !== undefined ? userPref.visible : item.visible;

    // Order: user pref order if defined, else default index
    const effectiveOrder = userPref?.order !== undefined ? userPref.order : defaultIndex;

    // Dynamic badge resolution
    let badge = item.badge;
    if (item.id === 'inbox' && inboxUnread > 0) {
      badge = inboxUnread > 99 ? '99+' : inboxUnread;
    }

    // Permission & feature flag check
    const isPermitted =
      item.permissions && item.permissions.length > 0
        ? item.permissions.some((p) => permissions.includes(p))
        : true;

    const isFeatureEnabled =
      featureFlags[item.id] !== undefined ? featureFlags[item.id] : !item.disabled;

    const fullPath = item.href ? `/w/${workspaceSlug}/${item.href}` : `/w/${workspaceSlug}`;

    return {
      ...item,
      fullPath,
      badge,
      isVisible: isVisible && isPermitted && isFeatureEnabled,
      effectiveOrder,
    };
  });

  // 2. Sort all items by effective order
  allItems.sort((a, b) => a.effectiveOrder - b.effectiveOrder);

  // 3. Filter visible and core items
  const visibleItems = allItems.filter((item) => item.isVisible);
  const coreItems = allItems.filter((item) => item.isCore);

  // 4. Assemble into groups
  const groups: ResolvedNavGroup[] = DEFAULT_NAV_GROUPS.map((group) => {
    const groupItems = visibleItems.filter((item) => item.group === group.id);
    return {
      ...group,
      items: groupItems,
    };
  }).filter((group) => group.items.length > 0);

  return {
    groups,
    allItems,
    visibleItems,
    coreItems,
  };
}
