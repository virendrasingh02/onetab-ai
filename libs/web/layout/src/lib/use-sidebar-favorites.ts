import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FavoriteType = 'project' | 'doc' | 'agent' | 'app' | 'workflow';

interface SidebarFavoritesState {
  favoritesByWorkspace: Record<string, Record<FavoriteType, string[]>>;
  isFavorite: (workspaceId: string, type: FavoriteType, id: string) => boolean;
  toggleFavorite: (workspaceId: string, type: FavoriteType, id: string) => void;
  getFavorites: (workspaceId: string, type: FavoriteType) => string[];
}

export const useSidebarFavoritesStore = create<SidebarFavoritesState>()(
  persist(
    (set, get) => ({
      favoritesByWorkspace: {},
      isFavorite: (workspaceId: string, type: FavoriteType, id: string) => {
        if (!workspaceId) return false;
        const workspaceFavs = get().favoritesByWorkspace[workspaceId];
        return workspaceFavs?.[type]?.includes(id) ?? false;
      },
      toggleFavorite: (workspaceId: string, type: FavoriteType, id: string) => {
        if (!workspaceId) return;
        set((state) => {
          const currentWorkspace = state.favoritesByWorkspace[workspaceId] ?? {
            project: [],
            doc: [],
            agent: [],
            app: [],
            workflow: [],
          };
          const currentList = currentWorkspace[type] ?? [];
          const exists = currentList.includes(id);
          const nextList = exists
            ? currentList.filter((item) => item !== id)
            : [...currentList, id];

          return {
            favoritesByWorkspace: {
              ...state.favoritesByWorkspace,
              [workspaceId]: {
                ...currentWorkspace,
                [type]: nextList,
              },
            },
          };
        });
      },
      getFavorites: (workspaceId: string, type: FavoriteType) => {
        if (!workspaceId) return [];
        return get().favoritesByWorkspace[workspaceId]?.[type] ?? [];
      },
    }),
    {
      name: 'onetab-sidebar-favorites',
    },
  ),
);

export function useSidebarFavorites(workspaceId: string | undefined) {
  const isFavorite = useSidebarFavoritesStore((s) => s.isFavorite);
  const toggleFavorite = useSidebarFavoritesStore((s) => s.toggleFavorite);
  const favoritesByWorkspace = useSidebarFavoritesStore(
    (s) => s.favoritesByWorkspace,
  );

  const activeWorkspaceId = workspaceId ?? '';
  const workspaceFavs = favoritesByWorkspace[activeWorkspaceId] ?? {
    project: [],
    doc: [],
    agent: [],
    app: [],
    workflow: [],
  };

  return {
    isFavorite: (type: FavoriteType, id: string) =>
      isFavorite(activeWorkspaceId, type, id),
    toggleFavorite: (type: FavoriteType, id: string) =>
      toggleFavorite(activeWorkspaceId, type, id),
    favoriteProjectIds: workspaceFavs.project ?? [],
    favoriteDocIds: workspaceFavs.doc ?? [],
    favoriteAgentIds: workspaceFavs.agent ?? [],
    favoriteAppIds: workspaceFavs.app ?? [],
    favoriteWorkflowIds: workspaceFavs.workflow ?? [],
  };
}
