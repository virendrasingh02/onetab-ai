import { ApiError } from '@org/api-client';
import { ApiErrorCode } from '@org/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OfflineActionQueue } from './offline-queue.js';

const WS = 'ws_1';

/** An in-memory persistence stub so tests do not touch real localStorage. */
function memoryPersistence() {
  const store = new Map<string, unknown[]>();
  return {
    read: (wsId: string) => (store.get(wsId) ?? []) as never,
    write: (wsId: string, actions: unknown[]) => {
      if (actions.length === 0) store.delete(wsId);
      else store.set(wsId, actions);
    },
    _store: store,
  };
}

function apiError(status: number): ApiError {
  return new ApiError({
    statusCode: status,
    code: ApiErrorCode.INTERNAL,
    message: 'x',
    path: '/x',
    timestamp: new Date().toISOString(),
  });
}

describe('OfflineActionQueue', () => {
  let queue: OfflineActionQueue;
  let onChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onChange = vi.fn();
    queue = new OfflineActionQueue(memoryPersistence(), onChange);
  });

  it('enqueues, dedupes by key, and reports pending count', () => {
    queue.enqueue({ kind: 'mark', workspaceId: WS, dedupeKey: 'n1', payload: { v: 1 } });
    queue.enqueue({ kind: 'mark', workspaceId: WS, dedupeKey: 'n2', payload: { v: 1 } });
    queue.enqueue({ kind: 'mark', workspaceId: WS, dedupeKey: 'n1', payload: { v: 2 } });
    expect(queue.pending(WS)).toBe(2);
    expect(onChange).toHaveBeenLastCalledWith(WS, 2);
  });

  it('replays entries in order and clears the queue on success', async () => {
    const seen: unknown[] = [];
    queue.registerExecutor('mark', async (payload) => {
      seen.push(payload);
    });
    queue.enqueue({ kind: 'mark', workspaceId: WS, dedupeKey: 'a', payload: 1 });
    queue.enqueue({ kind: 'mark', workspaceId: WS, dedupeKey: 'b', payload: 2 });

    await queue.replay(WS);
    expect(seen).toEqual([1, 2]);
    expect(queue.pending(WS)).toBe(0);
  });

  it('drops an entry on a terminal error and continues with the rest', async () => {
    const seen: unknown[] = [];
    queue.registerExecutor('mark', async (payload) => {
      if (payload === 'bad') throw apiError(409); // conflict → terminal
      seen.push(payload);
    });
    queue.enqueue({ kind: 'mark', workspaceId: WS, dedupeKey: 'a', payload: 'bad' });
    queue.enqueue({ kind: 'mark', workspaceId: WS, dedupeKey: 'b', payload: 'ok' });

    await queue.replay(WS);
    expect(seen).toEqual(['ok']);
    expect(queue.pending(WS)).toBe(0);
  });

  it('keeps a transiently-failing entry and preserves order across reconnects', async () => {
    let failNext = true;
    const seen: unknown[] = [];
    queue.registerExecutor('mark', async (payload) => {
      if (payload === 'first' && failNext) throw apiError(0); // network → retry
      seen.push(payload);
    });
    queue.enqueue({ kind: 'mark', workspaceId: WS, dedupeKey: 'a', payload: 'first' });
    queue.enqueue({ kind: 'mark', workspaceId: WS, dedupeKey: 'b', payload: 'second' });

    await queue.replay(WS);
    // Stopped at the first entry — nothing applied, both still queued.
    expect(seen).toEqual([]);
    expect(queue.pending(WS)).toBe(2);

    failNext = false;
    await queue.replay(WS);
    expect(seen).toEqual(['first', 'second']);
    expect(queue.pending(WS)).toBe(0);
  });

  it('drops an entry whose kind has no registered executor', async () => {
    queue.enqueue({ kind: 'gone', workspaceId: WS, dedupeKey: 'a', payload: 1 });
    await queue.replay(WS);
    expect(queue.pending(WS)).toBe(0);
  });

  it('keeps queues for different workspaces isolated', () => {
    queue.enqueue({ kind: 'mark', workspaceId: 'ws_a', dedupeKey: 'x', payload: 1 });
    queue.enqueue({ kind: 'mark', workspaceId: 'ws_b', dedupeKey: 'x', payload: 1 });
    expect(queue.pending('ws_a')).toBe(1);
    expect(queue.pending('ws_b')).toBe(1);
    queue.clear('ws_a');
    expect(queue.pending('ws_a')).toBe(0);
    expect(queue.pending('ws_b')).toBe(1);
  });
});
