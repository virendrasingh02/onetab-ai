import { act, renderHook, waitFor } from '@testing-library/react';
import type { MatrixClientEvent } from '@org/matrix-client';

const listeners: Array<(event: MatrixClientEvent) => void> = [];
const client = {
  getUnreadMentions: vi.fn(),
  getNotificationCounts: vi.fn(),
  on: vi.fn((listener: (event: MatrixClientEvent) => void) => {
    listeners.push(listener);
    return () => {
      const i = listeners.indexOf(listener);
      if (i >= 0) listeners.splice(i, 1);
    };
  }),
};

vi.mock('./matrix-provider.js', () => ({
  useMatrix: () => ({ client, status: { state: 'connected' }, enabled: true, error: null }),
}));

import {
  selectNextUnreadMention,
  useUnreadMentions,
} from './use-unread-mentions.js';

function emit(event: Partial<MatrixClientEvent> & { type: string }) {
  act(() => {
    for (const listener of [...listeners]) listener(event as MatrixClientEvent);
  });
}

beforeEach(() => {
  listeners.length = 0;
  client.getUnreadMentions.mockReset();
  client.getNotificationCounts.mockReset();
  client.getNotificationCounts.mockReturnValue({ total: 0, highlight: 0 });
});

describe('selectNextUnreadMention', () => {
  const ids = ['a', 'b', 'c'];

  it('starts at the oldest going down, the newest going up', () => {
    expect(selectNextUnreadMention(ids, null, 'down')).toBe('a');
    expect(selectNextUnreadMention(ids, null, 'up')).toBe('c');
  });

  it('steps to the neighbour of the anchor', () => {
    expect(selectNextUnreadMention(ids, 'a', 'down')).toBe('b');
    expect(selectNextUnreadMention(ids, 'b', 'down')).toBe('c');
    expect(selectNextUnreadMention(ids, 'c', 'up')).toBe('b');
  });

  it('clamps at the ends and returns undefined for an empty set', () => {
    expect(selectNextUnreadMention(ids, 'c', 'down')).toBe('c');
    expect(selectNextUnreadMention(ids, 'a', 'up')).toBe('a');
    expect(selectNextUnreadMention([], null, 'down')).toBeUndefined();
  });
});

describe('useUnreadMentions', () => {
  it('projects the client mentions, scoped to the main timeline', async () => {
    client.getUnreadMentions.mockReturnValue([
      { eventId: 'm1', roomId: '!r', timestamp: 1 },
      { eventId: 't1', roomId: '!r', timestamp: 2, threadRootId: '$root' },
    ]);
    client.getNotificationCounts.mockReturnValue({ total: 3, highlight: 2 });

    const { result } = renderHook(() => useUnreadMentions('!r'));

    await waitFor(() => expect(result.current.ids).toEqual(['m1']));
    expect(result.current.count).toBe(2);
    expect(result.current.unloadedCount).toBe(1);
  });

  it('scopes to a thread when asked', async () => {
    client.getUnreadMentions.mockReturnValue([
      { eventId: 'm1', roomId: '!r', timestamp: 1 },
      { eventId: 't1', roomId: '!r', timestamp: 2, threadRootId: '$root' },
    ]);

    const { result } = renderHook(() =>
      useUnreadMentions('!r', { threadRootId: '$root' }),
    );

    await waitFor(() => expect(result.current.ids).toEqual(['t1']));
    expect(result.current.count).toBe(1);
  });

  it('recomputes on a receipt and drains to empty', async () => {
    client.getUnreadMentions.mockReturnValue([
      { eventId: 'm1', roomId: '!r', timestamp: 1 },
    ]);
    client.getNotificationCounts.mockReturnValue({ total: 1, highlight: 1 });

    const { result } = renderHook(() => useUnreadMentions('!r'));
    await waitFor(() => expect(result.current.ids).toEqual(['m1']));

    client.getUnreadMentions.mockReturnValue([]);
    client.getNotificationCounts.mockReturnValue({ total: 0, highlight: 0 });
    emit({ type: 'receipt', roomId: '!r' } as never);

    await waitFor(() => expect(result.current.count).toBe(0));
    expect(result.current.ids).toEqual([]);
  });

  it('is empty and silent without a room', () => {
    const { result } = renderHook(() => useUnreadMentions(undefined));
    expect(result.current.ids).toEqual([]);
    expect(client.getUnreadMentions).not.toHaveBeenCalled();
  });
});
