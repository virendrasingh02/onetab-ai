import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_NAV_ITEMS } from './navigation.config.js';

export interface SidebarItemPreference {
  visible: boolean;
  order: number;
  group?: string;
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
  /** Whether customization dialog/modal is open */
  customizerOpen: boolean;

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
  setCustomizerOpen: (open: boolean) => void;
  resetToDefaultOrder: () => void;
  resetAllVisibility: () => void;
  resetAllPreferences: () => void;
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
      customizerOpen: false,

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

      setCustomizerOpen: (open: boolean) =>
        set(() => ({ customizerOpen: open })),

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
      }),
    },
  ),
);
