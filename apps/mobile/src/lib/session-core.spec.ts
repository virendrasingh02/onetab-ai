import { describe, expect, it, vi } from 'vitest';
import {
  clearSessionStorage,
  hasStoredSession,
  persistTokens,
  createRefreshProvider,
  isAuthRejection,
  RefreshRejected,
  STORAGE_KEYS,
  type KeyValueStore,
} from './session-core';

function memoryStore(
  initial: Record<string, string> = {},
): KeyValueStore & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => {
      data.set(key, value);
    },
    remove: async (key) => {
      data.delete(key);
    },
  };
}

const deps = (store: KeyValueStore, refresh: (rt: string) => Promise<any>) => ({
  store,
  refresh,
  isRejection: isAuthRejection,
  toRejection: (message: string) => new RefreshRejected(message),
});

describe('createRefreshProvider', () => {
  it('presents the stored refresh token and persists the rotated one first', async () => {
    const store = memoryStore({ [STORAGE_KEYS.refreshToken]: 'rt_old' });
    const refresh = vi
      .fn()
      .mockResolvedValue({ accessToken: 'at_new', refreshToken: 'rt_new' });

    const token = await createRefreshProvider(deps(store, refresh))();

    expect(refresh).toHaveBeenCalledWith('rt_old');
    expect(token).toBe('at_new');
    expect(store.data.get(STORAGE_KEYS.refreshToken)).toBe('rt_new');
  });

  it('rejects without calling the API when nothing is stored', async () => {
    const refresh = vi.fn();
    await expect(
      createRefreshProvider(deps(memoryStore(), refresh))(),
    ).rejects.toBeInstanceOf(RefreshRejected);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('drops the stored token when the API refuses it', async () => {
    const store = memoryStore({ [STORAGE_KEYS.refreshToken]: 'rt_revoked' });
    const refresh = vi.fn().mockRejectedValue({ status: 401 });

    await expect(
      createRefreshProvider(deps(store, refresh))(),
    ).rejects.toBeInstanceOf(RefreshRejected);
    expect(store.data.has(STORAGE_KEYS.refreshToken)).toBe(false);
  });

  it('keeps the session through a network failure', async () => {
    const store = memoryStore({ [STORAGE_KEYS.refreshToken]: 'rt_ok' });
    const outage = new Error('Network Error');
    const refresh = vi.fn().mockRejectedValue(outage);

    await expect(createRefreshProvider(deps(store, refresh))()).rejects.toBe(
      outage,
    );
    expect(store.data.get(STORAGE_KEYS.refreshToken)).toBe('rt_ok');
  });
});

describe('clearSessionStorage', () => {
  it('forgets the session but keeps the per-device biometric choice', async () => {
    const store = memoryStore({
      [STORAGE_KEYS.refreshToken]: 'rt',
      [STORAGE_KEYS.cookieSession]: '1',
      [STORAGE_KEYS.workspaceId]: 'ws',
      [STORAGE_KEYS.matrixSession]: '{}',
      [STORAGE_KEYS.biometricLock]: 'on',
    });
    await clearSessionStorage(store);
    expect([...store.data.keys()]).toEqual([STORAGE_KEYS.biometricLock]);
  });
});

describe('persistTokens', () => {
  it('stores the refresh token in token mode', async () => {
    const store = memoryStore({});
    await persistTokens(store, { accessToken: 'at', refreshToken: 'rt' });
    expect(store.data.get(STORAGE_KEYS.refreshToken)).toBe('rt');
    await expect(hasStoredSession(store, 'token')).resolves.toBe(true);
  });

  it('never stores the refresh token in cookie mode (web)', async () => {
    const store = memoryStore({});
    await persistTokens(
      store,
      { accessToken: 'at', refreshToken: 'rt' },
      'cookie',
    );
    expect(store.data.has(STORAGE_KEYS.refreshToken)).toBe(false);
    expect([...store.data.values()]).not.toContain('rt');
    await expect(hasStoredSession(store, 'cookie')).resolves.toBe(true);
    await expect(hasStoredSession(store, 'token')).resolves.toBe(false);
  });
});

describe('isAuthRejection', () => {
  it('reads ApiError and axios error shapes', () => {
    expect(isAuthRejection({ status: 401 })).toBe(true);
    expect(isAuthRejection({ response: { status: 403 } })).toBe(true);
    expect(isAuthRejection({ status: 500 })).toBe(false);
    expect(isAuthRejection(new Error('offline'))).toBe(false);
  });
});
