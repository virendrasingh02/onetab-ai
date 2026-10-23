import { toast } from '@org/ui';
import {
  normalizeFavorites,
  useWorkspaceFavorites,
  type FavoriteType,
} from '@org/web-workspace';
import { useEffect } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type { FavoriteType };

export const DEFAULT_PINNED_NAV_PATHS: string[] = [];

interface SidebarFavoritesState {
  /** Stars saved before they moved to the server; read once for the import. */
  favoritesByWorkspace: Record<string, Partial<Record<FavoriteType, string[]>>>;
  pinnedNavByWorkspace: Record<string, string[]>;
  isNavPinned: (workspaceId: string, path: string) => boolean;
  toggleNavPinned: (workspaceId: string, path: string) => void;
  getPinnedNavPaths: (workspaceId: string) => string[];
}

export const useSidebarFavoritesStore = create<SidebarFavoritesState>()(
  persist(
    (set, get) => ({
      favoritesByWorkspace: {},
      pinnedNavByWorkspace: {},
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

/**
 * Sidebar stars. Favorites live in the member's server-side workspace
 * preferences (`useWorkspaceFavorites`), so they follow the member across
 * devices; the persisted store above only still holds pinned nav paths and the
 * stars saved before that move, which are uploaded once and then cleared.
 */
export function useSidebarFavorites(workspaceId: string | undefined) {
  const isNavPinned = useSidebarFavoritesStore((s) => s.isNavPinned);
  const toggleNavPinned = useSidebarFavoritesStore((s) => s.toggleNavPinned);
  const pinnedNavByWorkspace = useSidebarFavoritesStore(
    (s) => s.pinnedNavByWorkspace,
  );
  const legacyFavorites = useSidebarFavoritesStore(
    (s) => (workspaceId ? s.favoritesByWorkspace[workspaceId] : undefined),
  );
  const { favorites, isFavorite, toggleFavorite, mergeFavorites, isLoaded } =
    useWorkspaceFavorites(workspaceId);

  useEffect(() => {
    if (!workspaceId || !isLoaded || !legacyFavorites) return;
    // Several sidebar sections mount this hook; only the first one imports.
    if (!useSidebarFavoritesStore.getState().favoritesByWorkspace[workspaceId]) return;
    const legacy = normalizeFavorites(legacyFavorites);
    if (Object.values(legacy).some((ids) => ids.length > 0)) {
      mergeFavorites(legacy);
    }
    useSidebarFavoritesStore.setState((state) => {
      const rest = { ...state.favoritesByWorkspace };
      delete rest[workspaceId];
      return { favoritesByWorkspace: rest };
    });
  }, [workspaceId, isLoaded, legacyFavorites, mergeFavorites]);

  const activeWorkspaceId = workspaceId ?? '';
  const pinnedNavPaths =
    pinnedNavByWorkspace[activeWorkspaceId] ?? DEFAULT_PINNED_NAV_PATHS;

  return {
    isFavorite,
    toggleFavorite,
    favoriteProjectIds: favorites.project,
    favoriteDocIds: favorites.doc,
    favoriteCoworkerIds: favorites.coworker,
    favoriteAgentIds: favorites.agent,
    favoriteAppIds: favorites.app,
    favoriteWorkflowIds: favorites.workflow,
    isNavPinned: (path: string) => isNavPinned(activeWorkspaceId, path),
    toggleNavPinned: (path: string) => toggleNavPinned(activeWorkspaceId, path),
    pinnedNavPaths,
  };
}
