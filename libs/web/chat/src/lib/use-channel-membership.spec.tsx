import { act, renderHook, waitFor } from '@testing-library/react';
import type { MatrixClientEvent } from '@org/matrix-client';

const listeners: Array<(event: MatrixClientEvent) => void> = [];
let membership: string | null = 'invite';

const client = {
  getRoom: vi.fn((id: string) =>
    membership ? { id, myMembership: membership } : null,
  ),
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

const { matrixApi } = vi.hoisted(() => ({
  matrixApi: { joinChannelRoom: vi.fn() },
}));
vi.mock('@org/api-client', () => ({ matrixApi }));

import { useChannelMembership } from './use-channel-membership.js';

function joinOnSync() {
  membership = 'join';
  for (const listener of [...listeners]) {
    listener({ type: 'room.upserted', room: { id: '!r:hs' } } as never);
  }
}

describe('useChannelMembership', () => {
  beforeEach(() => {
    listeners.length = 0;
    membership = 'invite';
    matrixApi.joinChannelRoom.mockReset();
  });

  it('reports joined and never calls the server for a joined member', () => {
    membership = 'join';
    const { result } = renderHook(() => useChannelMembership('c1', '!r:hs'));

    expect(result.current.state).toBe('joined');
    expect(matrixApi.joinChannelRoom).not.toHaveBeenCalled();
  });

  it('heals an invited-only member and clears once the join syncs', async () => {
    matrixApi.joinChannelRoom.mockResolvedValue({ joined: true });
    const { result } = renderHook(() => useChannelMembership('c1', '!r:hs'));

    expect(result.current.state).toBe('joining');
    expect(matrixApi.joinChannelRoom).toHaveBeenCalledWith('c1');

    act(joinOnSync);
    expect(result.current.state).toBe('joined');
  });

  it('heals a member missing from the room entirely', () => {
    membership = null;
    matrixApi.joinChannelRoom.mockResolvedValue({ joined: true });
    renderHook(() => useChannelMembership('c1', '!r:hs'));

    expect(matrixApi.joinChannelRoom).toHaveBeenCalledTimes(1);
  });

  it('surfaces a failed heal and retries on demand', async () => {
    matrixApi.joinChannelRoom.mockRejectedValueOnce(new Error('404'));
    const { result } = renderHook(() => useChannelMembership('c1', '!r:hs'));

    await waitFor(() => expect(result.current.state).toBe('failed'));

    matrixApi.joinChannelRoom.mockResolvedValue({ joined: true });
    act(() => result.current.retry());
    expect(result.current.state).toBe('joining');
    expect(matrixApi.joinChannelRoom).toHaveBeenCalledTimes(2);
  });

  it('says nothing until there is a room', () => {
    const { result } = renderHook(() => useChannelMembership('c1', null));

    expect(result.current.state).toBe('unknown');
    expect(matrixApi.joinChannelRoom).not.toHaveBeenCalled();
  });
});
