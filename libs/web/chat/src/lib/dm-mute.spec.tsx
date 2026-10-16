import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { MatrixClientEvent } from '@org/matrix-client';
import type { ReactNode } from 'react';

const listeners: Array<(event: MatrixClientEvent) => void> = [];
const muted = new Set<string>();
let rooms: Array<{ id: string; kind: string; directUserId?: string }> = [];
let directMap: Record<string, string[]> = {};

const client = {
  getRooms: vi.fn(() => rooms),
  getDirectRoomIds: vi.fn(() => directMap),
  isRoomMuted: vi.fn((roomId: string) => muted.has(roomId)),
  setRoomMuted: vi.fn(async (roomId: string, value: boolean) => {
    if (value) muted.add(roomId);
    else muted.delete(roomId);
    emit({ type: 'pushrules.updated' });
  }),
  on: vi.fn((listener: (event: MatrixClientEvent) => void) => {
    listeners.push(listener);
    return () => {
      const i = listeners.indexOf(listener);
      if (i >= 0) listeners.splice(i, 1);
    };
  }),
};

vi.mock('./matrix-provider.js', () => ({
  useMatrix: () => ({ client, status: { state: 'connected' }, enabled: true }),
}));

// Peer ids in these tests are already workspace ids; keep the mapping identity.
vi.mock('@org/design-system', () => ({
  normalizeAvatarSeed: (id: string) => id.replace(/^@|:.*$/g, ''),
}));

const { toast, workspaceApi, prefs } = vi.hoisted(() => {
  const prefs: { stored: Record<string, unknown> } = { stored: {} };
  return {
    prefs,
    toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
    workspaceApi: {
      getMemberPreferences: vi.fn(async () => ({ ...prefs.stored })),
      saveMemberPreferences: vi.fn(
        async (_ws: string, patch: Record<string, unknown>) => {
          prefs.stored = { ...prefs.stored, ...patch };
          return { ...prefs.stored };
        },
      ),
    },
  };
});
vi.mock('@org/ui', () => ({ toast }));
vi.mock('@org/api-client', () => ({
  workspaceApi,
  queryKeys: {
    workspaces: {
      memberPreferences: (id: string) => ['workspaces', id, 'member-preferences'],
    },
  },
}));

import { useDirectRoomIndex } from './dm-room-index.js';
import { useDirectMessageMuteSync } from './use-dm-mute-sync.js';
import { useDirectMessagePreferences } from './use-dm-preferences.js';

function emit(event: Partial<MatrixClientEvent> & { type: string }) {
  act(() => {
    for (const listener of [...listeners]) listener(event as MatrixClientEvent);
  });
}

function wrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  listeners.length = 0;
  muted.clear();
  prefs.stored = {};
  rooms = [
    // Peer joined: found through directUserId.
    { id: '!joined:hs', kind: 'direct', directUserId: '@alice:hs' },
    // Peer only invited: no directUserId, only m.direct knows it.
    { id: '!invited:hs', kind: 'direct' },
    { id: '!group:hs', kind: 'group' },
  ];
  directMap = {
    '@bob:hs': ['!invited:hs', '!group:hs'],
    '@carol:hs': ['!group:hs'],
  };
  vi.clearAllMocks();
  localStorage.clear();
});

describe('useDirectRoomIndex', () => {
  it('resolves joined, invite-only and group DMs, never a group for a peer', () => {
    const { result } = renderHook(() => useDirectRoomIndex());
    expect(result.current.roomFor('alice')).toBe('!joined:hs');
    expect(result.current.roomFor('bob')).toBe('!invited:hs');
    expect(result.current.roomFor('carol')).toBeUndefined();
    expect(result.current.roomFor('!group:hs')).toBe('!group:hs');
    expect(result.current.roomFor('dave')).toBeUndefined();
  });

  it('reports muted rooms under both the room id and the peer id, live', () => {
    const { result } = renderHook(() => useDirectRoomIndex());
    expect(result.current.mutedIds).toEqual([]);
    muted.add('!invited:hs');
    emit({ type: 'pushrules.updated' });
    expect(result.current.mutedIds).toEqual(['!invited:hs', 'bob']);
  });
});

describe('useDirectMessagePreferences mute', () => {
  it('mutes an existing conversation on Matrix, not in the workspace blob', async () => {
    const { result } = renderHook(() => useDirectMessagePreferences('ws1'), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(workspaceApi.getMemberPreferences).toHaveBeenCalled());

    act(() => result.current.toggleMuted('alice'));
    await waitFor(() => expect(result.current.isMuted('alice')).toBe(true));
    expect(client.setRoomMuted).toHaveBeenCalledWith('!joined:hs', true);
    expect(workspaceApi.saveMemberPreferences).not.toHaveBeenCalled();

    act(() => result.current.toggleMuted('alice'));
    await waitFor(() => expect(result.current.isMuted('alice')).toBe(false));
    expect(client.setRoomMuted).toHaveBeenLastCalledWith('!joined:hs', false);
  });

  it('keeps a mute for someone with no conversation as pending in the workspace', async () => {
    const { result } = renderHook(() => useDirectMessagePreferences('ws1'), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(workspaceApi.getMemberPreferences).toHaveBeenCalled());

    act(() => result.current.toggleMuted('dave'));
    await waitFor(() => expect(result.current.isMuted('dave')).toBe(true));
    expect(client.setRoomMuted).not.toHaveBeenCalled();
    expect(workspaceApi.saveMemberPreferences).toHaveBeenCalledWith('ws1', {
      dmMuted: ['dave'],
    });
  });
});

describe('useDirectMessageMuteSync', () => {
  it('moves a pending mute onto the room once it exists, then clears it', async () => {
    prefs.stored = { dmMuted: ['dave', 'erin'] };
    renderHook(() => useDirectMessageMuteSync('ws1'), { wrapper: wrapper() });
    await waitFor(() => expect(workspaceApi.getMemberPreferences).toHaveBeenCalled());
    // No room for either yet: nothing to write.
    expect(client.setRoomMuted).not.toHaveBeenCalled();

    // Dave's DM gets created (e.g. he messages first).
    rooms = [...rooms, { id: '!dave:hs', kind: 'direct', directUserId: '@dave:hs' }];
    emit({ type: 'room.upserted' });

    await waitFor(() =>
      expect(client.setRoomMuted).toHaveBeenCalledWith('!dave:hs', true),
    );
    await waitFor(() =>
      expect(workspaceApi.saveMemberPreferences).toHaveBeenCalledWith('ws1', {
        dmMuted: ['erin'],
      }),
    );
    expect(muted.has('!dave:hs')).toBe(true);
  });
});
