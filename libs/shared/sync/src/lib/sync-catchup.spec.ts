import { ApiError } from '@org/api-client';
import { ApiErrorCode, type SyncChangesDigest } from '@org/types';
import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyDigest,
  readCursor,
  runCatchup,
  writeCursor,
} from './sync-catchup.js';

const { changes } = vi.hoisted(() => ({ changes: vi.fn() }));

vi.mock('@org/api-client', async (importActual) => {
  const actual = await importActual<Record<string, unknown>>();
  return { ...actual, syncApi: { changes } };
});

const WS = 'ws_1';

function digest(partial: Partial<SyncChangesDigest> = {}): SyncChangesDigest {
  return {
    workspaceId: WS,
    since: '2020-01-01T00:00:00.000Z',
    serverTime: '2020-01-01T00:05:00.000Z',
    hasMore: false,
    changed: {
      channels: [],
      members: [],
      notifications: [],
      tasks: [],
      projects: [],
      meetings: [],
    },
    unreadCount: 0,
    ...partial,
  };
}

function ctx() {
  const qc = new QueryClient();
  const invalidate = vi
    .spyOn(qc, 'invalidateQueries')
    .mockImplementation(() => undefined as never);
  return { qc, invalidate };
}

function keyStrings(invalidate: ReturnType<typeof vi.fn>): string[] {
  return invalidate.mock.calls.map((c) =>
    JSON.stringify((c[0] as { queryKey: unknown[] }).queryKey),
  );
}

describe('applyDigest', () => {
  it('invalidates only the categories that changed', () => {
    const { qc, invalidate } = ctx();
    const n = applyDigest(
      WS,
      digest({
        changed: {
          channels: [{ id: 'c1', updatedAt: 'x' }],
          members: [],
          notifications: [{ id: 'n1', updatedAt: 'x' }],
          tasks: [],
          projects: [],
          meetings: [],
        },
      }),
      qc,
    );
    const flat = keyStrings(invalidate);
    expect(flat).toContain(JSON.stringify(['channels', WS]));
    expect(flat).toContain(JSON.stringify(['notifications', WS, 'unread-count']));
    expect(flat).not.toContain(JSON.stringify(['members', WS]));
    expect(n).toBeGreaterThan(0);
  });

  it('widens to a full per-domain refresh when hasMore is set', () => {
    const { qc, invalidate } = ctx();
    applyDigest(WS, digest({ hasMore: true }), qc);
    const flat = keyStrings(invalidate);
    expect(flat).toContain(JSON.stringify(['work-tools', WS]));
    expect(flat).toContain(JSON.stringify(['channels', WS]));
  });

  it('ignores a digest for a different workspace', () => {
    const { qc, invalidate } = ctx();
    expect(applyDigest(WS, digest({ workspaceId: 'ws_other' }), qc)).toBe(0);
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe('cursor persistence', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips the last-synced cursor per workspace', () => {
    expect(readCursor(WS)).toBeNull();
    writeCursor(WS, '2021-06-01T00:00:00.000Z');
    expect(readCursor(WS)).toBe('2021-06-01T00:00:00.000Z');
    expect(readCursor('ws_other')).toBeNull();
  });
});

describe('runCatchup', () => {
  beforeEach(() => {
    changes.mockReset();
    localStorage.clear();
  });

  it('applies the digest and advances the cursor to serverTime', async () => {
    changes.mockResolvedValue(
      digest({
        serverTime: '2022-02-02T02:02:02.000Z',
        changed: {
          channels: [{ id: 'c', updatedAt: 'x' }],
          members: [],
          notifications: [],
          tasks: [],
          projects: [],
          meetings: [],
        },
      }),
    );
    const { qc } = ctx();
    const result = await runCatchup(WS, {
      queryClient: qc,
      fallbackRefresh: () => 0,
    });
    expect(result.fellBack).toBe(false);
    expect(result.applied).toBeGreaterThan(0);
    expect(readCursor(WS)).toBe('2022-02-02T02:02:02.000Z');
  });

  it('falls back to a broad refresh when the endpoint 404s', async () => {
    changes.mockRejectedValue(
      new ApiError({
        statusCode: 404,
        code: ApiErrorCode.NOT_FOUND,
        message: 'nope',
        path: '/x',
        timestamp: new Date().toISOString(),
      }),
    );
    const fallbackRefresh = vi.fn(() => 3);
    const { qc } = ctx();
    const result = await runCatchup(WS, { queryClient: qc, fallbackRefresh });
    expect(result.fellBack).toBe(true);
    expect(result.applied).toBe(3);
    expect(fallbackRefresh).toHaveBeenCalledTimes(1);
  });

  it('rethrows a non-404 failure', async () => {
    changes.mockRejectedValue(
      new ApiError({
        statusCode: 500,
        code: ApiErrorCode.INTERNAL,
        message: 'boom',
        path: '/x',
        timestamp: new Date().toISOString(),
      }),
    );
    const { qc } = ctx();
    await expect(
      runCatchup(WS, { queryClient: qc, fallbackRefresh: () => 0 }),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
