import { describe, expect, it, vi } from 'vitest';
import { MatrixError, type MatrixEvent, type SyncResponse } from './matrix';
import {
  applyRoomSync,
  backoffMs,
  INITIAL_ROOM_TIMELINE,
  RoomTimeline,
  roomSyncFilter,
  type RoomTimelineClient,
} from './room-timeline';

const ROOM = '!room:example';

const ev = (id: string, ts: number, type = 'm.room.message'): MatrixEvent => ({
  event_id: id,
  type,
  sender: '@ana:example',
  origin_server_ts: ts,
  content: { msgtype: 'm.text', body: id },
});

const batch = (
  next: string,
  events: MatrixEvent[],
  extra: { limited?: boolean; prev_batch?: string; state?: MatrixEvent[] } = {},
): SyncResponse => ({
  next_batch: next,
  rooms: {
    join: {
      [ROOM]: {
        timeline: {
          events,
          limited: extra.limited,
          prev_batch: extra.prev_batch,
        },
        state: { events: extra.state ?? [] },
      },
    },
  },
});

describe('roomSyncFilter', () => {
  it('scopes the sync to the one room and skips presence/account data', () => {
    expect(roomSyncFilter(ROOM, 20)).toMatchObject({
      room: { rooms: [ROOM], timeline: { limit: 20 } },
      presence: { types: [] },
      account_data: { types: [] },
    });
  });
});

describe('applyRoomSync', () => {
  it('uses the first sync as the initial page', () => {
    const state = applyRoomSync(
      INITIAL_ROOM_TIMELINE,
      batch('s1', [ev('$1', 1)], {
        prev_batch: 'p0',
        state: [{ ...ev('$enc', 0, 'm.room.encryption'), state_key: '' }],
      }),
      ROOM,
    );
    expect(state).toMatchObject({
      since: 's1',
      ready: true,
      prevBatch: 'p0',
      encrypted: true,
      resets: 0,
    });
    expect(state.events.map((e) => e.event_id)).toEqual(['$1']);
  });

  it('appends later batches without duplicates', () => {
    let state = applyRoomSync(
      INITIAL_ROOM_TIMELINE,
      batch('s1', [ev('$1', 1)], { prev_batch: 'p0' }),
      ROOM,
    );
    state = applyRoomSync(state, batch('s2', [ev('$1', 1), ev('$2', 2)]), ROOM);
    expect(state.events.map((e) => e.event_id)).toEqual(['$1', '$2']);
    expect(state.since).toBe('s2');
    expect(state.prevBatch).toBe('p0');
  });

  it('replaces the window on a limited (gappy) batch', () => {
    let state = applyRoomSync(
      INITIAL_ROOM_TIMELINE,
      batch('s1', [ev('$1', 1)], { prev_batch: 'p0' }),
      ROOM,
    );
    state = applyRoomSync(
      state,
      batch('s2', [ev('$9', 9)], { limited: true, prev_batch: 'p8' }),
      ROOM,
    );
    expect(state.events.map((e) => e.event_id)).toEqual(['$9']);
    expect(state).toMatchObject({ prevBatch: 'p8', resets: 1 });
  });

  it('only advances the token when the room is not in the batch', () => {
    const before = applyRoomSync(
      INITIAL_ROOM_TIMELINE,
      batch('s1', [ev('$1', 1)]),
      ROOM,
    );
    const after = applyRoomSync(before, { next_batch: 's2' }, ROOM);
    expect(after.since).toBe('s2');
    expect(after.events).toBe(before.events);
  });
});

describe('backoffMs', () => {
  it('doubles up to 30 s', () => {
    expect([1, 2, 3, 10].map(backoffMs)).toEqual([1000, 2000, 4000, 30000]);
  });
});

function fakeClient(responses: Array<SyncResponse | Error>) {
  const queue = [...responses];
  const sync = vi.fn(
    async (options: { signal?: AbortSignal }): Promise<SyncResponse> => {
      const next = queue.shift();
      if (next instanceof Error) throw next;
      if (next) return next;
      // Nothing queued: hang like a long-poll until aborted.
      return new Promise((_, reject) => {
        options.signal?.addEventListener('abort', () =>
          reject(new Error('aborted')),
        );
      });
    },
  );
  const client = {
    sync,
    join: vi.fn(async () => ({ room_id: ROOM })),
    messages: vi.fn(async () => ({ chunk: [ev('$0', 0)], end: undefined })),
  };
  return client as typeof client & RoomTimelineClient;
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('RoomTimeline', () => {
  it('syncs, then long-polls from the returned token', async () => {
    const client = fakeClient([
      batch('s1', [ev('$1', 1)], { prev_batch: 'p0' }),
      batch('s2', [ev('$2', 2)]),
    ]);
    const timeline = new RoomTimeline(client, ROOM, { timeoutMs: 25000 });
    const listener = vi.fn();
    timeline.subscribe(listener);

    timeline.start();
    await settle();

    expect(timeline.getState().events.map((e) => e.event_id)).toEqual([
      '$1',
      '$2',
    ]);
    expect(listener).toHaveBeenCalled();
    expect(client.sync.mock.calls[0][0]).toMatchObject({ timeoutMs: 0 });
    expect(client.sync.mock.calls[1][0]).toMatchObject({
      since: 's1',
      timeoutMs: 25000,
    });
    expect(client.sync.mock.calls[2][0]).toMatchObject({ since: 's2' });

    timeline.stop();
    expect(timeline.running).toBe(false);
  });

  it('joins a room it is not in yet, then retries the first sync', async () => {
    const client = fakeClient([
      { next_batch: 's0' },
      batch('s1', [ev('$1', 1)]),
    ]);
    const timeline = new RoomTimeline(client, ROOM);
    timeline.start();
    await settle();
    timeline.stop();

    expect(client.join).toHaveBeenCalledWith(ROOM);
    expect(timeline.getState().ready).toBe(true);
  });

  it('stops for good on a revoked token and reports it', async () => {
    const onFatalError = vi.fn();
    const client = fakeClient([
      new MatrixError(401, 'M_UNKNOWN_TOKEN', 'gone'),
    ]);
    const timeline = new RoomTimeline(client, ROOM, { onFatalError });
    timeline.start();
    await settle();

    expect(onFatalError).toHaveBeenCalledTimes(1);
    expect(timeline.getState().fatal).toBe(true);
    expect(timeline.running).toBe(false);
    expect(client.sync).toHaveBeenCalledTimes(1);
  });

  it('retries transient failures after a backoff', async () => {
    vi.useFakeTimers();
    try {
      const client = fakeClient([
        new Error('network'),
        batch('s1', [ev('$1', 1)]),
      ]);
      const timeline = new RoomTimeline(client, ROOM);
      timeline.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(timeline.getState().error).toBeInstanceOf(Error);

      await vi.advanceTimersByTimeAsync(1000);
      expect(timeline.getState()).toMatchObject({ ready: true, error: null });
      timeline.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('pages older history from prev_batch', async () => {
    const client = fakeClient([
      batch('s1', [ev('$1', 1)], { prev_batch: 'p0' }),
    ]);
    const timeline = new RoomTimeline(client, ROOM);
    timeline.start();
    await settle();

    await timeline.loadOlder();
    timeline.stop();

    expect(client.messages).toHaveBeenCalledWith(ROOM, 'p0');
    expect(timeline.getState().events.map((e) => e.event_id)).toEqual([
      '$1',
      '$0',
    ]);
    expect(timeline.getState().prevBatch).toBeNull();
  });
});
