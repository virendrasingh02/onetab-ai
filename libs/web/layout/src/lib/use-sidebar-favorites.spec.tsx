import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mergeFavorites = vi.fn();
const toggleFavorite = vi.fn();

vi.mock('@org/web-workspace', () => ({
  normalizeFavorites: (raw: Record<string, string[] | undefined>) => ({
    project: raw?.project ?? [],
    doc: raw?.doc ?? [],
    coworker: raw?.coworker ?? [],
    agent: raw?.agent ?? [],
    app: raw?.app ?? [],
    workflow: raw?.workflow ?? [],
  }),
  useWorkspaceFavorites: () => ({
    favorites: { project: [], doc: [], coworker: ['cw-server'], agent: [], app: [], workflow: [] },
    isFavorite: (type: string, id: string) => type === 'coworker' && id === 'cw-server',
    toggleFavorite,
    mergeFavorites,
    isLoaded: true,
  }),
}));

vi.mock('@org/ui', () => ({ toast: { success: vi.fn(), info: vi.fn() } }));

import { useSidebarFavorites, useSidebarFavoritesStore } from './use-sidebar-favorites.js';

describe('useSidebarFavorites', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSidebarFavoritesStore.setState({ favoritesByWorkspace: {}, pinnedNavByWorkspace: {} });
  });

  it('serves favorites from the server-backed hook', () => {
    const { result } = renderHook(() => useSidebarFavorites('ws1'));
    expect(result.current.favoriteCoworkerIds).toEqual(['cw-server']);
    result.current.toggleFavorite('doc', 'd1');
    expect(toggleFavorite).toHaveBeenCalledWith('doc', 'd1');
  });

  it('uploads stars saved in this browser once, then clears them', async () => {
    useSidebarFavoritesStore.setState({
      favoritesByWorkspace: { ws1: { coworker: ['cw-local'], doc: [] }, ws2: { doc: ['other'] } },
    });
    // Two sidebar sections mounting at once must import only once.
    renderHook(() => {
      useSidebarFavorites('ws1');
      useSidebarFavorites('ws1');
    });
    await waitFor(() => expect(mergeFavorites).toHaveBeenCalledTimes(1));
    expect(mergeFavorites.mock.calls[0][0]).toMatchObject({ coworker: ['cw-local'] });
    const left = useSidebarFavoritesStore.getState().favoritesByWorkspace;
    expect(left['ws1']).toBeUndefined();
    expect(left['ws2']).toEqual({ doc: ['other'] });
  });

  it('does nothing when there is no legacy data', () => {
    renderHook(() => useSidebarFavorites('ws1'));
    expect(mergeFavorites).not.toHaveBeenCalled();
  });
});
