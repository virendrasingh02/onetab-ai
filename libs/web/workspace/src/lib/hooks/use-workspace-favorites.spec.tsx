import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { workspaceApi } from '@org/api-client';
import {
  normalizeFavorites,
  useWorkspaceFavorites,
  WORKSPACE_FAVORITES_KEY,
} from './use-workspace-favorites.js';

vi.mock('@org/api-client', () => ({
  workspaceApi: {
    getMemberPreferences: vi.fn(),
    saveMemberPreferences: vi.fn(),
  },
  queryKeys: {
    workspaces: {
      memberPreferences: (id: string) => ['workspaces', id, 'member-preferences'],
    },
  },
}));

vi.mock('@org/ui', () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

describe('useWorkspaceFavorites', () => {
  let queryClient: QueryClient;
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    vi.clearAllMocks();
    (workspaceApi.saveMemberPreferences as ReturnType<typeof vi.fn>).mockImplementation(
      async (_ws: string, patch: Record<string, unknown>) => patch,
    );
  });

  it('reads stars from the member preference blob', async () => {
    (workspaceApi.getMemberPreferences as ReturnType<typeof vi.fn>).mockResolvedValue({
      [WORKSPACE_FAVORITES_KEY]: { coworker: ['cw1'], doc: ['d1'] },
    });
    const { result } = renderHook(() => useWorkspaceFavorites('ws1'), { wrapper });
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    expect(result.current.isFavorite('coworker', 'cw1')).toBe(true);
    expect(result.current.isFavorite('doc', 'd1')).toBe(true);
    expect(result.current.isFavorite('project', 'd1')).toBe(false);
  });

  it('saves each toggle to the server and builds rapid toggles on each other', async () => {
    (workspaceApi.getMemberPreferences as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const { result } = renderHook(() => useWorkspaceFavorites('ws1'), { wrapper });
    await waitFor(() => expect(result.current.isLoaded).toBe(true));

    act(() => {
      result.current.toggleFavorite('coworker', 'cw1');
      result.current.toggleFavorite('project', 'p1');
    });

    await waitFor(() => expect(workspaceApi.saveMemberPreferences).toHaveBeenCalledTimes(2));
    const last = (workspaceApi.saveMemberPreferences as ReturnType<typeof vi.fn>).mock.calls[1];
    expect(last[0]).toBe('ws1');
    expect(last[1][WORKSPACE_FAVORITES_KEY]).toMatchObject({ coworker: ['cw1'], project: ['p1'] });
    expect(result.current.isFavorite('coworker', 'cw1')).toBe(true);

    act(() => result.current.toggleFavorite('coworker', 'cw1'));
    await waitFor(() => expect(result.current.isFavorite('coworker', 'cw1')).toBe(false));
  });

  it('mergeFavorites unions ids without duplicates', async () => {
    (workspaceApi.getMemberPreferences as ReturnType<typeof vi.fn>).mockResolvedValue({
      [WORKSPACE_FAVORITES_KEY]: { coworker: ['cw1'] },
    });
    const { result } = renderHook(() => useWorkspaceFavorites('ws1'), { wrapper });
    await waitFor(() => expect(result.current.isLoaded).toBe(true));
    act(() => result.current.mergeFavorites({ coworker: ['cw1', 'cw2'], app: ['a1'] }));
    await waitFor(() => expect(workspaceApi.saveMemberPreferences).toHaveBeenCalled());
    const saved = (workspaceApi.saveMemberPreferences as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(saved[WORKSPACE_FAVORITES_KEY]).toMatchObject({ coworker: ['cw1', 'cw2'], app: ['a1'] });
  });
});

describe('normalizeFavorites', () => {
  it('drops unknown types, non-string ids and duplicates', () => {
    expect(
      normalizeFavorites({ coworker: ['a', 'a', 3, ''], bogus: ['x'], doc: 'nope' }),
    ).toEqual({ project: [], doc: [], coworker: ['a'], agent: [], app: [], workflow: [] });
    expect(normalizeFavorites(null).coworker).toEqual([]);
  });
});
