import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_NAV_ITEMS } from './navigation.config.js';

export interface SidebarItemPreference {
  visible: boolean;
  order: number;
  group?: string;
}

export interface SidebarState {
  /** Customization per item id: visibility and sort order */
  items: Record<string, SidebarItemPreference>;
  /** Collapsed status for grouped sections */
  collapsedGroups: Record<string, boolean>;
  /** Desktop sidebar collapsed (icon-only mode with tooltips) */
  sidebarCollapsed: boolean;
  /** Whether customization dialog/modal is open */
  customizerOpen: boolean;

  // Actions
  setItemVisibility: (id: string, visible: boolean) => void;
  reorderItems: (orderedIds: string[]) => void;
  moveItem: (activeId: string, overId: string) => void;
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

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      items: getDefaultItemPreferences(),
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
            (a, b) => (currentItems[a]?.order ?? 0) - (currentItems[b]?.order ?? 0),
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
          collapsedGroups: {},
          sidebarCollapsed: false,
        })),
    }),
    {
      name: 'onetab:sidebar_preferences',
      partialize: (state) => ({
        items: state.items,
        collapsedGroups: state.collapsedGroups,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
);
