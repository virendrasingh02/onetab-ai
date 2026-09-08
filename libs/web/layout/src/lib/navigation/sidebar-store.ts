import type { SidebarActivityConfig } from '@org/ui';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_NAV_ITEMS } from './navigation.config.js';
import {
  defaultDirectionFor,
  type ChannelPriority,
  type ChannelSortDirection,
  type ChannelSortMode,
  type ChannelSortPreference,
  type SidebarSectionDef,
} from './sidebar-sections.js';

export interface SidebarItemPreference {
  visible: boolean;
  order: number;
  group?: string;
}

export type ActivityIndicatorStyle = 'dot' | 'badge' | 'auto';

/**
 * User controls for the sidebar activity dots and badges (brief §2). Persisted
 * with the rest of the sidebar customization and synced to the server, so the
 * choice follows the user between devices.
 */
export interface SidebarActivityPreferences {
  /** Master switch for every dot and badge. */
  enabled: boolean;
  /** Dot, numeric badge, or auto (badge whenever a count is available). */
  style: ActivityIndicatorStyle;
  /** Show unread counts. When off, badges collapse to dots. */
  showCounts: boolean;
  showInMainSidebar: boolean;
  showInWorkspaceSidebar: boolean;
  showForChannelsAndDms: boolean;
  showForNotifications: boolean;
}

export const DEFAULT_ACTIVITY_INDICATORS: SidebarActivityPreferences = {
  enabled: true,
  style: 'auto',
  showCounts: true,
  showInMainSidebar: true,
  showInWorkspaceSidebar: true,
  showForChannelsAndDms: true,
  showForNotifications: true,
};

/** Bridge the stored preference shape to the `@org/ui` indicator config. */
export function toSidebarActivityConfig(
  prefs: SidebarActivityPreferences,
): SidebarActivityConfig {
  return {
    enabled: prefs.enabled,
    style: prefs.style,
    showCounts: prefs.showCounts,
    // Product convention, matched by ActivityDot / NotificationBadge / the
    // Inbox nav badge.
    maxCount: 99,
    surfaces: {
      main: prefs.showInMainSidebar,
      // Resource sections (projects, docs, agents…) live in the main sidebar.
      other: prefs.showInMainSidebar,
      workspace: prefs.showInWorkspaceSidebar,
      channels: prefs.showForChannelsAndDms,
      dms: prefs.showForChannelsAndDms,
      notifications: prefs.showForNotifications,
    },
  };
}

export type SidebarSectionId =
  | 'starred'
  | 'channels'
  | 'dms'
  | 'projects'
  | 'docs'
  | 'agents'
  | 'apps'
  | 'workflows';

export interface SidebarSectionConfig {
  id: SidebarSectionId;
  label: string;
  description: string;
  visible: boolean;
  order: number;
}

export const DEFAULT_SIDEBAR_SECTIONS: readonly SidebarSectionConfig[] = [
  {
    id: 'starred',
    label: 'Starred',
    description: 'Favorited channels, docs, projects, agents & workflows',
    visible: true,
    order: 0,
  },
  {
    id: 'channels',
    label: 'Channels',
    description: 'Joined channels, public channels & creation',
    visible: true,
    order: 1,
  },
  {
    id: 'dms',
    label: 'Direct Messages',
    description: 'Direct 1-on-1 and group conversations',
    visible: true,
    order: 2,
  },
  {
    id: 'projects',
    label: 'Projects',
    description: 'Active project boards and task trees',
    visible: true,
    order: 3,
  },
  {
    id: 'docs',
    label: 'Docs',
    description: 'Workspace document tree and notes',
    visible: true,
    order: 4,
  },
  {
    id: 'agents',
    label: 'AI Agents',
    description: 'Custom and built-in AI agents',
    visible: true,
    order: 5,
  },
  {
    id: 'apps',
    label: 'Apps & Integrations',
    description: 'Connected tools and integrations',
    visible: true,
    order: 6,
  },
  {
    id: 'workflows',
    label: 'Workflows',
    description: 'Automations and triggers',
    visible: true,
    order: 7,
  },
];

export interface SidebarState {
  /** Customization per item id: visibility and sort order */
  items: Record<string, SidebarItemPreference>;
  /** Customization per major section id: visibility and sort order */
  sections: Record<SidebarSectionId, { visible: boolean; order: number }>;
  /** Custom channel ordering per workspaceId (legacy alias) */
  channelOrders: Record<string, string[]>;
  /** Generic per-section custom item ordering: workspaceId -> sectionKey -> itemIds[] */
  resourceOrders: Record<string, Record<string, string[]>>;
  /** Collapsed status for grouped sections */
  collapsedGroups: Record<string, boolean>;
  /** Desktop sidebar collapsed (icon-only mode with tooltips) */
  sidebarCollapsed: boolean;
  /** Activity-indicator (dot/badge) preferences — brief §2. */
  activityIndicators: SidebarActivityPreferences;

  /* --- Smart sidebar & channel sorting (brief §1.1 / §1.2) -------------
   * All three maps are keyed by workspaceId so a user's organisation of one
   * workspace never leaks into another, and all three ride the same
   * `SidebarPreference` server sync as the rest of this store. */

  /** Chosen channel sort per workspace. Absent ⇒ `DEFAULT_CHANNEL_SORT`. */
  channelSort: Record<string, ChannelSortPreference>;
  /** User-created (manual) + rule-driven (smart) channel sections per workspace. */
  sectionDefs: Record<string, SidebarSectionDef[]>;
  /** Lightweight per-channel metadata (priority) per workspace. */
  channelMeta: Record<string, Record<string, { priority?: ChannelPriority }>>;
  /** Per-channel open tally per workspace — powers "frequently visited". */
  channelVisits: Record<
    string,
    Record<string, { count: number; lastAt: string }>
  >;

  // Actions for Navigation Items
  setItemVisibility: (id: string, visible: boolean) => void;
  reorderItems: (orderedIds: string[]) => void;
  moveItem: (activeId: string, overId: string) => void;

  // Actions for Sidebar Sections
  setSectionVisibility: (id: SidebarSectionId, visible: boolean) => void;
  reorderSections: (orderedIds: SidebarSectionId[]) => void;
  moveSection: (activeId: SidebarSectionId, overId: SidebarSectionId) => void;
  resetSections: () => void;

  // Actions for Custom Item Reordering Inside Any Section (channels, dms, projects, docs, agents, apps, workflows, starred)
  reorderResourceItems: (
    workspaceId: string,
    sectionKey: string,
    itemIds: string[],
  ) => void;
  moveResourceItem: (
    workspaceId: string,
    sectionKey: string,
    activeId: string,
    overId: string,
    currentIds: string[],
  ) => void;
  resetResourceOrder: (workspaceId: string, sectionKey?: string) => void;

  // Channel Order Actions (Aliased to resourceOrders)
  reorderChannels: (workspaceId: string, channelIds: string[]) => void;
  moveChannel: (
    workspaceId: string,
    activeId: string,
    overId: string,
    currentIds: string[],
  ) => void;
  resetChannelOrder: (workspaceId: string) => void;

  // Group and View Toggles
  toggleGroupCollapsed: (groupId: string) => void;
  setGroupCollapsed: (groupId: string, collapsed: boolean) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebarCollapsed: () => void;
  setActivityIndicator: <K extends keyof SidebarActivityPreferences>(
    key: K,
    value: SidebarActivityPreferences[K],
  ) => void;
  resetActivityIndicators: () => void;
  resetToDefaultOrder: () => void;
  resetAllVisibility: () => void;
  resetAllPreferences: () => void;

  // --- Smart sidebar & channel sorting ---
  setChannelSort: (
    workspaceId: string,
    mode: ChannelSortMode,
    direction?: ChannelSortDirection,
  ) => void;
  addSectionDef: (workspaceId: string, def: SidebarSectionDef) => void;
  updateSectionDef: (
    workspaceId: string,
    id: string,
    patch: Partial<Omit<SidebarSectionDef, 'id'>>,
  ) => void;
  removeSectionDef: (workspaceId: string, id: string) => void;
  reorderSectionDefs: (workspaceId: string, orderedIds: string[]) => void;
  toggleSectionDefCollapsed: (workspaceId: string, id: string) => void;
  /** Add a channel to a manual section (removing it from any other manual one). */
  assignChannelToSection: (
    workspaceId: string,
    sectionId: string,
    channelId: string,
  ) => void;
  removeChannelFromSection: (
    workspaceId: string,
    sectionId: string,
    channelId: string,
  ) => void;
  setChannelPriority: (
    workspaceId: string,
    channelId: string,
    priority: ChannelPriority,
  ) => void;
  recordChannelVisit: (workspaceId: string, channelId: string) => void;
  resetChannelOrganization: (workspaceId: string) => void;
}

/** Keep the visit tally bounded so the synced blob can't grow without limit. */
const MAX_TRACKED_VISITS = 120;

function pruneVisits(
  entries: Record<string, { count: number; lastAt: string }>,
): Record<string, { count: number; lastAt: string }> {
  const ids = Object.keys(entries);
  if (ids.length <= MAX_TRACKED_VISITS) return entries;
  const kept = ids
    .sort((a, b) => Date.parse(entries[b].lastAt) - Date.parse(entries[a].lastAt))
    .slice(0, MAX_TRACKED_VISITS);
  const next: Record<string, { count: number; lastAt: string }> = {};
  for (const id of kept) next[id] = entries[id];
  return next;
}

function getDefaultItemPreferences(): Record<string, SidebarItemPreference> {
  const prefs: Record<string, SidebarItemPreference> = {};
  DEFAULT_NAV_ITEMS.forEach((item, index) => {
    prefs[item.id] = {
      visible: item.visible,
      order: index,
      group: item.group,
    };
  });
  return prefs;
}

function getDefaultSectionPreferences(): Record<
  SidebarSectionId,
  { visible: boolean; order: number }
> {
  const prefs: Record<SidebarSectionId, { visible: boolean; order: number }> =
    {} as Record<SidebarSectionId, { visible: boolean; order: number }>;
  DEFAULT_SIDEBAR_SECTIONS.forEach((sec) => {
    prefs[sec.id] = {
      visible: sec.visible,
      order: sec.order,
    };
  });
  return prefs;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      items: getDefaultItemPreferences(),
      sections: getDefaultSectionPreferences(),
      channelOrders: {},
      resourceOrders: {},
      collapsedGroups: {},
      sidebarCollapsed: false,
      activityIndicators: { ...DEFAULT_ACTIVITY_INDICATORS },
      channelSort: {},
      sectionDefs: {},
      channelMeta: {},
      channelVisits: {},

      setItemVisibility: (id: string, visible: boolean) =>
        set((state) => ({
          items: {
            ...state.items,
            [id]: {
              ...(state.items[id] ?? {
                order: DEFAULT_NAV_ITEMS.findIndex((i) => i.id === id) || 0,
              }),
              visible,
            },
          },
        })),

      reorderItems: (orderedIds: string[]) =>
        set((state) => {
          const nextItems = { ...state.items };
          orderedIds.forEach((id, index) => {
            if (nextItems[id]) {
              nextItems[id] = { ...nextItems[id], order: index };
            } else {
              nextItems[id] = { visible: true, order: index };
            }
          });
          return { items: nextItems };
        }),

      moveItem: (activeId: string, overId: string) =>
        set((state) => {
          const currentItems = { ...state.items };
          const keys = Object.keys(currentItems).sort(
            (a, b) =>
              (currentItems[a]?.order ?? 0) - (currentItems[b]?.order ?? 0),
          );

          const oldIndex = keys.indexOf(activeId);
          const newIndex = keys.indexOf(overId);

          if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
            return state;
          }

          const reordered = [...keys];
          const [removed] = reordered.splice(oldIndex, 1);
          reordered.splice(newIndex, 0, removed);

          const nextItems: Record<string, SidebarItemPreference> = {};
          reordered.forEach((id, idx) => {
            nextItems[id] = {
              ...(currentItems[id] ?? { visible: true }),
              order: idx,
            };
          });

          return { items: nextItems };
        }),

      // Section Actions
      setSectionVisibility: (id: SidebarSectionId, visible: boolean) =>
        set((state) => ({
          sections: {
            ...state.sections,
            [id]: {
              ...(state.sections[id] ?? {
                order:
                  DEFAULT_SIDEBAR_SECTIONS.findIndex((s) => s.id === id) || 0,
              }),
              visible,
            },
          },
        })),

      reorderSections: (orderedIds: SidebarSectionId[]) =>
        set((state) => {
          const nextSections = { ...state.sections };
          orderedIds.forEach((id, index) => {
            if (nextSections[id]) {
              nextSections[id] = { ...nextSections[id], order: index };
            } else {
              nextSections[id] = { visible: true, order: index };
            }
          });
          return { sections: nextSections };
        }),

      moveSection: (activeId: SidebarSectionId, overId: SidebarSectionId) =>
        set((state) => {
          const currentSections = {
            ...getDefaultSectionPreferences(),
            ...state.sections,
          };
          const keys = (
            Object.keys(currentSections) as SidebarSectionId[]
          ).sort(
            (a, b) =>
              (currentSections[a]?.order ?? 0) -
              (currentSections[b]?.order ?? 0),
          );

          const oldIndex = keys.indexOf(activeId);
          const newIndex = keys.indexOf(overId);

          if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
            return state;
          }

          const reordered = [...keys];
          const [removed] = reordered.splice(oldIndex, 1);
          reordered.splice(newIndex, 0, removed);

          const nextSections: Record<
            SidebarSectionId,
            { visible: boolean; order: number }
          > = {} as Record<
            SidebarSectionId,
            { visible: boolean; order: number }
          >;
          reordered.forEach((id, idx) => {
            nextSections[id] = {
              ...(currentSections[id] ?? { visible: true }),
              order: idx,
            };
          });

          return { sections: nextSections };
        }),

      resetSections: () =>
        set(() => ({
          sections: getDefaultSectionPreferences(),
        })),

      // Resource Item Ordering inside Any Section
      reorderResourceItems: (
        workspaceId: string,
        sectionKey: string,
        itemIds: string[],
      ) =>
        set((state) => ({
          resourceOrders: {
            ...state.resourceOrders,
            [workspaceId]: {
              ...(state.resourceOrders[workspaceId] ?? {}),
              [sectionKey]: itemIds,
            },
          },
          ...(sectionKey === 'channels'
            ? {
                channelOrders: {
                  ...state.channelOrders,
                  [workspaceId]: itemIds,
                },
              }
            : {}),
        })),

      moveResourceItem: (
        workspaceId: string,
        sectionKey: string,
        activeId: string,
        overId: string,
        currentIds: string[],
      ) =>
        set((state) => {
          const existingList =
            state.resourceOrders[workspaceId]?.[sectionKey] ??
            (sectionKey === 'channels'
              ? state.channelOrders[workspaceId]
              : undefined) ??
            currentIds;
          const oldIndex = existingList.indexOf(activeId);
          const newIndex = existingList.indexOf(overId);

          if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
            return state;
          }

          const reordered = [...existingList];
          const [removed] = reordered.splice(oldIndex, 1);
          reordered.splice(newIndex, 0, removed);

          return {
            resourceOrders: {
              ...state.resourceOrders,
              [workspaceId]: {
                ...(state.resourceOrders[workspaceId] ?? {}),
                [sectionKey]: reordered,
              },
            },
            ...(sectionKey === 'channels'
              ? {
                  channelOrders: {
                    ...state.channelOrders,
                    [workspaceId]: reordered,
                  },
                }
              : {}),
          };
        }),

      resetResourceOrder: (workspaceId: string, sectionKey?: string) =>
        set((state) => {
          const next = { ...state.resourceOrders };
          if (next[workspaceId]) {
            if (sectionKey) {
              const updatedWs = { ...next[workspaceId] };
              delete updatedWs[sectionKey];
              next[workspaceId] = updatedWs;
            } else {
              delete next[workspaceId];
            }
          }
          return { resourceOrders: next };
        }),

      // Aliased Channel Methods
      reorderChannels: (workspaceId: string, channelIds: string[]) =>
        get().reorderResourceItems(workspaceId, 'channels', channelIds),

      moveChannel: (
        workspaceId: string,
        activeId: string,
        overId: string,
        currentIds: string[],
      ) =>
        get().moveResourceItem(
          workspaceId,
          'channels',
          activeId,
          overId,
          currentIds,
        ),

      resetChannelOrder: (workspaceId: string) =>
        get().resetResourceOrder(workspaceId, 'channels'),

      toggleGroupCollapsed: (groupId: string) =>
        set((state) => ({
          collapsedGroups: {
            ...state.collapsedGroups,
            [groupId]: !state.collapsedGroups[groupId],
          },
        })),

      setGroupCollapsed: (groupId: string, collapsed: boolean) =>
        set((state) => ({
          collapsedGroups: {
            ...state.collapsedGroups,
            [groupId]: collapsed,
          },
        })),

      setSidebarCollapsed: (collapsed: boolean) =>
        set(() => ({ sidebarCollapsed: collapsed })),

      toggleSidebarCollapsed: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setActivityIndicator: (key, value) =>
        set((state) => ({
          activityIndicators: { ...state.activityIndicators, [key]: value },
        })),

      resetActivityIndicators: () =>
        set(() => ({
          activityIndicators: { ...DEFAULT_ACTIVITY_INDICATORS },
        })),

      // --- Smart sidebar & channel sorting --------------------------------

      setChannelSort: (workspaceId, mode, direction) =>
        set((state) => ({
          channelSort: {
            ...state.channelSort,
            [workspaceId]: {
              mode,
              direction: direction ?? defaultDirectionFor(mode),
            },
          },
        })),

      addSectionDef: (workspaceId, def) =>
        set((state) => {
          const existing = state.sectionDefs[workspaceId] ?? [];
          return {
            sectionDefs: {
              ...state.sectionDefs,
              [workspaceId]: [
                ...existing,
                { ...def, order: existing.length },
              ],
            },
          };
        }),

      updateSectionDef: (workspaceId, id, patch) =>
        set((state) => ({
          sectionDefs: {
            ...state.sectionDefs,
            [workspaceId]: (state.sectionDefs[workspaceId] ?? []).map((s) =>
              s.id === id ? ({ ...s, ...patch, id: s.id } as SidebarSectionDef) : s,
            ),
          },
        })),

      removeSectionDef: (workspaceId, id) =>
        set((state) => ({
          sectionDefs: {
            ...state.sectionDefs,
            [workspaceId]: (state.sectionDefs[workspaceId] ?? [])
              .filter((s) => s.id !== id)
              .map((s, index) => ({ ...s, order: index })),
          },
        })),

      reorderSectionDefs: (workspaceId, orderedIds) =>
        set((state) => {
          const bySection = new Map(
            (state.sectionDefs[workspaceId] ?? []).map((s) => [s.id, s]),
          );
          const next: SidebarSectionDef[] = [];
          orderedIds.forEach((id, index) => {
            const s = bySection.get(id);
            if (s) {
              next.push({ ...s, order: index });
              bySection.delete(id);
            }
          });
          // Anything not named keeps its relative order at the end.
          for (const s of bySection.values()) {
            next.push({ ...s, order: next.length });
          }
          return {
            sectionDefs: { ...state.sectionDefs, [workspaceId]: next },
          };
        }),

      toggleSectionDefCollapsed: (workspaceId, id) =>
        set((state) => ({
          sectionDefs: {
            ...state.sectionDefs,
            [workspaceId]: (state.sectionDefs[workspaceId] ?? []).map((s) =>
              s.id === id ? { ...s, collapsed: !s.collapsed } : s,
            ),
          },
        })),

      assignChannelToSection: (workspaceId, sectionId, channelId) =>
        set((state) => ({
          sectionDefs: {
            ...state.sectionDefs,
            [workspaceId]: (state.sectionDefs[workspaceId] ?? []).map((s) => {
              if (s.kind !== 'manual') return s;
              const without = (s.channelIds ?? []).filter(
                (id) => id !== channelId,
              );
              return s.id === sectionId
                ? { ...s, channelIds: [...without, channelId] }
                : { ...s, channelIds: without };
            }),
          },
        })),

      removeChannelFromSection: (workspaceId, sectionId, channelId) =>
        set((state) => ({
          sectionDefs: {
            ...state.sectionDefs,
            [workspaceId]: (state.sectionDefs[workspaceId] ?? []).map((s) =>
              s.id === sectionId && s.kind === 'manual'
                ? {
                    ...s,
                    channelIds: (s.channelIds ?? []).filter(
                      (id) => id !== channelId,
                    ),
                  }
                : s,
            ),
          },
        })),

      setChannelPriority: (workspaceId, channelId, priority) =>
        set((state) => {
          const wsMeta = { ...(state.channelMeta[workspaceId] ?? {}) };
          if (priority === 0) delete wsMeta[channelId];
          else wsMeta[channelId] = { ...wsMeta[channelId], priority };
          return {
            channelMeta: { ...state.channelMeta, [workspaceId]: wsMeta },
          };
        }),

      recordChannelVisit: (workspaceId, channelId) =>
        set((state) => {
          const wsVisits = state.channelVisits[workspaceId] ?? {};
          const current = wsVisits[channelId];
          const next = {
            ...wsVisits,
            [channelId]: {
              count: (current?.count ?? 0) + 1,
              lastAt: new Date().toISOString(),
            },
          };
          return {
            channelVisits: {
              ...state.channelVisits,
              [workspaceId]: pruneVisits(next),
            },
          };
        }),

      resetChannelOrganization: (workspaceId) =>
        set((state) => {
          const channelSort = { ...state.channelSort };
          const sectionDefs = { ...state.sectionDefs };
          const channelMeta = { ...state.channelMeta };
          const channelVisits = { ...state.channelVisits };
          delete channelSort[workspaceId];
          delete sectionDefs[workspaceId];
          delete channelMeta[workspaceId];
          delete channelVisits[workspaceId];
          return { channelSort, sectionDefs, channelMeta, channelVisits };
        }),

      resetToDefaultOrder: () =>
        set((state) => {
          const defaultPrefs = getDefaultItemPreferences();
          const nextItems: Record<string, SidebarItemPreference> = {};
          Object.keys(defaultPrefs).forEach((id) => {
            nextItems[id] = {
              order: defaultPrefs[id].order,
              visible: state.items[id]?.visible ?? defaultPrefs[id].visible,
              group: defaultPrefs[id].group,
            };
          });
          return { items: nextItems };
        }),

      resetAllVisibility: () =>
        set((state) => {
          const nextItems = { ...state.items };
          Object.keys(nextItems).forEach((id) => {
            nextItems[id] = { ...nextItems[id], visible: true };
          });
          return { items: nextItems };
        }),

      resetAllPreferences: () =>
        set(() => ({
          items: getDefaultItemPreferences(),
          sections: getDefaultSectionPreferences(),
          channelOrders: {},
          resourceOrders: {},
          collapsedGroups: {},
          sidebarCollapsed: false,
          activityIndicators: { ...DEFAULT_ACTIVITY_INDICATORS },
          channelSort: {},
          sectionDefs: {},
          channelMeta: {},
          channelVisits: {},
        })),
    }),
    {
      name: 'onetab:sidebar_preferences',
      partialize: (state) => ({
        items: state.items,
        sections: state.sections,
        channelOrders: state.channelOrders,
        resourceOrders: state.resourceOrders,
        collapsedGroups: state.collapsedGroups,
        sidebarCollapsed: state.sidebarCollapsed,
        activityIndicators: state.activityIndicators,
        channelSort: state.channelSort,
        sectionDefs: state.sectionDefs,
        channelMeta: state.channelMeta,
        channelVisits: state.channelVisits,
      }),
    },
  ),
);
