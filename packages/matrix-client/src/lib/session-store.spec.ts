import {
  LocalStorageSessionStore,
  MemorySessionStore,
} from './session-store.js';
import type { MatrixSession } from './types.js';

const session: MatrixSession = {
  userId: '@alice:example.org',
  deviceId: 'DEVICE1',
  accessToken: 'secret-token',
  homeserverUrl: 'https://example.org',
};

describe('LocalStorageSessionStore', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips a session', async () => {
    const store = new LocalStorageSessionStore();
    await store.save(session);
    await expect(store.load()).resolves.toEqual(session);
  });

  it('returns null when nothing is stored', async () => {
    await expect(new LocalStorageSessionStore().load()).resolves.toBeNull();
  });

  it('rejects a partially written record rather than returning it', async () => {
    // A half-written session produces confusing 401s deep inside the SDK.
    localStorage.setItem(
      'onetab.matrix.session',
      JSON.stringify({ userId: '@a:x' }),
    );
    await expect(new LocalStorageSessionStore().load()).resolves.toBeNull();
  });

  it('returns null on malformed JSON instead of throwing', async () => {
    localStorage.setItem('onetab.matrix.session', 'not json');
    await expect(new LocalStorageSessionStore().load()).resolves.toBeNull();
  });

  it('clears the stored session', async () => {
    const store = new LocalStorageSessionStore();
    await store.save(session);
    await store.clear();
    await expect(store.load()).resolves.toBeNull();
  });
});

describe('MemorySessionStore', () => {
  it('keeps the session only in memory', async () => {
    const store = new MemorySessionStore();
    await expect(store.load()).resolves.toBeNull();

    await store.save(session);
    await expect(store.load()).resolves.toEqual(session);
    // Nothing must reach persistent storage.
    expect(localStorage.getItem('onetab.matrix.session')).toBeNull();

    await store.clear();
    await expect(store.load()).resolves.toBeNull();
  });
});
