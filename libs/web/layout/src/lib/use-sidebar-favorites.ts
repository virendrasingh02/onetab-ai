import { toast } from '@org/ui';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FavoriteType = 'project' | 'doc' | 'agent' | 'app' | 'workflow';

export const DEFAULT_PINNED_NAV_PATHS: string[] = [];

interface SidebarFavoritesState {
  favoritesByWorkspace: Record<string, Record<FavoriteType, string[]>>;
  pinnedNavByWorkspace: Record<string, string[]>;
  isFavorite: (workspaceId: string, type: FavoriteType, id: string) => boolean;
  toggleFavorite: (workspaceId: string, type: FavoriteType, id: string) => void;
  getFavorites: (workspaceId: string, type: FavoriteType) => string[];
  isNavPinned: (workspaceId: string, path: string) => boolean;
  toggleNavPinned: (workspaceId: string, path: string) => void;
  getPinnedNavPaths: (workspaceId: string) => string[];
}

export const useSidebarFavoritesStore = create<SidebarFavoritesState>()(
  persist(
    (set, get) => ({
      favoritesByWorkspace: {},
      pinnedNavByWorkspace: {},
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

          const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
          if (exists) {
            toast.info(`Removed ${typeLabel} from favorites`);
          } else {
            toast.success(`Added ${typeLabel} to favorites`);
          }

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
      isNavPinned: (workspaceId: string, path: string) => {
        if (!workspaceId) return DEFAULT_PINNED_NAV_PATHS.includes(path);
        const pinned =
          get().pinnedNavByWorkspace[workspaceId] ?? DEFAULT_PINNED_NAV_PATHS;
        return pinned.includes(path);
      },
      toggleNavPinned: (workspaceId: string, path: string) => {
        if (!workspaceId) return;
        set((state) => {
          const currentPinned =
            state.pinnedNavByWorkspace[workspaceId] ?? DEFAULT_PINNED_NAV_PATHS;
          const exists = currentPinned.includes(path);
          const nextPinned = exists
            ? currentPinned.filter((p) => p !== path)
            : [...currentPinned, path];

          if (exists) {
            toast.info('Item unpinned from sidebar');
          } else {
            toast.success('Item pinned to sidebar');
          }

          return {
            pinnedNavByWorkspace: {
              ...state.pinnedNavByWorkspace,
              [workspaceId]: nextPinned,
            },
          };
        });
      },
      getPinnedNavPaths: (workspaceId: string) => {
        if (!workspaceId) return DEFAULT_PINNED_NAV_PATHS;
        return (
          get().pinnedNavByWorkspace[workspaceId] ?? DEFAULT_PINNED_NAV_PATHS
        );
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
  const isNavPinned = useSidebarFavoritesStore((s) => s.isNavPinned);
  const toggleNavPinned = useSidebarFavoritesStore((s) => s.toggleNavPinned);
  const favoritesByWorkspace = useSidebarFavoritesStore(
    (s) => s.favoritesByWorkspace,
  );
  const pinnedNavByWorkspace = useSidebarFavoritesStore(
    (s) => s.pinnedNavByWorkspace,
  );

  const activeWorkspaceId = workspaceId ?? '';
  const workspaceFavs = favoritesByWorkspace[activeWorkspaceId] ?? {
    project: [],
    doc: [],
    agent: [],
    app: [],
    workflow: [],
  };

  const pinnedNavPaths =
    pinnedNavByWorkspace[activeWorkspaceId] ?? DEFAULT_PINNED_NAV_PATHS;

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
    isNavPinned: (path: string) => isNavPinned(activeWorkspaceId, path),
    toggleNavPinned: (path: string) => toggleNavPinned(activeWorkspaceId, path),
    pinnedNavPaths,
  };
}
