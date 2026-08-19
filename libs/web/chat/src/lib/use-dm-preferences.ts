import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Per-person conversation preferences: favorite and mute.
 *
 * A channel keeps these on its membership row (`useChannelPreferences`), but a
 * DM has no membership to hang them off — the "roster" is the workspace member
 * list, and there is no direct-message record on the server yet. So they live
 * here, persisted per browser and keyed by workspace, which is enough for the
 * header controls and the sidebar ordering to agree with each other.
 *
 * When DMs grow a server-side record, this store is the single place that has
 * to be swapped for a mutation.
 */
interface DirectMessagePreferencesState {
  byWorkspace: Record<string, { favorites: string[]; muted: string[] }>;
  toggleFavorite: (workspaceId: string, peerId: string) => void;
  toggleMuted: (workspaceId: string, peerId: string) => void;
}

/* Shared so a workspace with no preferences yet hands back the *same* arrays on
   every render — a fresh `[]` per call would invalidate every `useMemo` keyed
   on them. */
const NO_IDS: string[] = [];
const EMPTY = { favorites: NO_IDS, muted: NO_IDS };

const toggle = (ids: string[], id: string) =>
  ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id];

export const useDirectMessagePreferencesStore =
  create<DirectMessagePreferencesState>()(
    persist(
      (set) => ({
        byWorkspace: {},
        toggleFavorite: (workspaceId, peerId) => {
          if (!workspaceId || !peerId) return;
          set((state) => {
            const current = state.byWorkspace[workspaceId] ?? EMPTY;
            return {
              byWorkspace: {
                ...state.byWorkspace,
                [workspaceId]: {
                  favorites: toggle(current.favorites, peerId),
                  muted: current.muted,
                },
              },
            };
          });
        },
        toggleMuted: (workspaceId, peerId) => {
          if (!workspaceId || !peerId) return;
          set((state) => {
            const current = state.byWorkspace[workspaceId] ?? EMPTY;
            return {
              byWorkspace: {
                ...state.byWorkspace,
                [workspaceId]: {
                  favorites: current.favorites,
                  muted: toggle(current.muted, peerId),
                },
              },
            };
          });
        },
      }),
      { name: 'onetab-dm-preferences' },
    ),
  );

export interface DirectMessagePreferences {
  favoriteIds: string[];
  mutedIds: string[];
  isFavorite: (peerId: string) => boolean;
  isMuted: (peerId: string) => boolean;
  toggleFavorite: (peerId: string) => void;
  toggleMuted: (peerId: string) => void;
}

export function useDirectMessagePreferences(
  workspaceId: string | undefined,
): DirectMessagePreferences {
  // The raw slice is selected, not a derived object: a selector that builds a
  // new object on every call re-renders forever under zustand v5.
  const byWorkspace = useDirectMessagePreferencesStore((s) => s.byWorkspace);
  const toggleFavorite = useDirectMessagePreferencesStore(
    (s) => s.toggleFavorite,
  );
  const toggleMuted = useDirectMessagePreferencesStore((s) => s.toggleMuted);

  const activeWorkspaceId = workspaceId ?? '';
  const entry = byWorkspace[activeWorkspaceId];
  const favoriteIds = entry?.favorites ?? NO_IDS;
  const mutedIds = entry?.muted ?? NO_IDS;

  return {
    favoriteIds,
    mutedIds,
    isFavorite: (peerId: string) => favoriteIds.includes(peerId),
    isMuted: (peerId: string) => mutedIds.includes(peerId),
    toggleFavorite: (peerId: string) =>
      toggleFavorite(activeWorkspaceId, peerId),
    toggleMuted: (peerId: string) => toggleMuted(activeWorkspaceId, peerId),
  };
}
