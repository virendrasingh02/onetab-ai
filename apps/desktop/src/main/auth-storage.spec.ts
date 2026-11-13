import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const userData = mkdtempSync(join(tmpdir(), 'onetab-auth-'));
const storage = vi.hoisted(() => ({
  available: true,
  backend: 'gnome_libsecret',
  rotated: false,
}));

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => userData) },
  safeStorage: {
    isAsyncEncryptionAvailable: vi.fn(async () => storage.available),
    getSelectedStorageBackend: vi.fn(() => storage.backend),
    encryptStringAsync: vi.fn(async (str: string) =>
      Buffer.from(`enc:${str}`, 'utf8'),
    ),
    decryptStringAsync: vi.fn(async (buf: Buffer) => ({
      result: buf.toString('utf8').replace(/^enc:/, ''),
      shouldReEncrypt: storage.rotated,
    })),
  },
  shell: { openExternal: vi.fn() },
}));

const { clearSecureSession, loadSecureSession, saveSecureSession } =
  await import('./auth.js');

/** A fresh process: nothing in memory, only what is on disk. */
async function freshModule() {
  vi.resetModules();
  return import('./auth.js');
}

const session = {
  user: { id: 'u1' },
  accessToken: 'access-secret',
  refreshToken: 'refresh-secret',
} as never;

function sessionFile(): string {
  const candidates = ['onetab-auth-session.json'].map((f) => join(userData, f));
  const found = candidates.find((path) => existsSync(path));
  return found ? readFileSync(found, 'utf8') : '';
}

describe('stored desktop session', () => {
  beforeEach(() => {
    storage.available = true;
    storage.backend = 'gnome_libsecret';
    storage.rotated = false;
    clearSecureSession();
  });

  it('never writes a token to disk in the clear when encryption is off', async () => {
    storage.available = false;

    await saveSecureSession(session);

    expect(sessionFile()).not.toContain('access-secret');
    expect(sessionFile()).not.toContain('refresh-secret');
  });

  it('keeps the session in memory so sign-in still works this run', async () => {
    storage.available = false;

    await saveSecureSession(session);

    expect((await loadSecureSession())?.refreshToken).toBe('refresh-secret');
  });

  it('treats the Linux basic_text backend as no encryption', async () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    storage.backend = 'basic_text';

    await saveSecureSession(session);

    expect(sessionFile()).not.toContain('encryptedRefreshToken":"');
    vi.restoreAllMocks();
  });

  it('rewrites a legacy plaintext file on load', async () => {
    writeFileSync(
      join(userData, 'onetab-auth-session.json'),
      JSON.stringify({ user: { id: 'u1' }, plainRefreshToken: 'old-secret' }),
    );

    expect((await loadSecureSession())?.refreshToken).toBe('old-secret');
    await vi.waitFor(() =>
      expect(sessionFile()).not.toContain('plainRefreshToken'),
    );
    expect(sessionFile()).not.toContain('"old-secret"');
  });

  it('round-trips an encrypted session across a restart', async () => {
    await saveSecureSession(session);
    expect(sessionFile()).toContain('encryptedRefreshToken');

    const fresh = await freshModule();
    expect((await fresh.loadSecureSession())?.refreshToken).toBe(
      'refresh-secret',
    );
  });

  it('re-encrypts when the OS key rotated', async () => {
    await saveSecureSession(session);
    const fresh = await freshModule();
    const { safeStorage } = await import('electron');
    vi.mocked(safeStorage.encryptStringAsync).mockClear();
    storage.rotated = true;

    await fresh.loadSecureSession();

    await vi.waitFor(() =>
      expect(safeStorage.encryptStringAsync).toHaveBeenCalled(),
    );
  });

  it('a sign-out during the startup read is not undone by it', async () => {
    await saveSecureSession(session);
    const fresh = await freshModule();

    const loading = fresh.loadSecureSession();
    fresh.clearSecureSession();

    expect(await loading).toBeNull();
    expect(await fresh.loadSecureSession()).toBeNull();
  });
});
