import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const userData = mkdtempSync(join(tmpdir(), 'onetab-auth-'));
const storage = vi.hoisted(() => ({
  available: true,
  backend: 'gnome_libsecret',
}));

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => userData) },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => storage.available),
    getSelectedStorageBackend: vi.fn(() => storage.backend),
    encryptString: vi.fn((str: string) => Buffer.from(`enc:${str}`, 'utf8')),
    decryptString: vi.fn((buf: Buffer) =>
      buf.toString('utf8').replace(/^enc:/, ''),
    ),
  },
  shell: { openExternal: vi.fn() },
}));

const { clearSecureSession, loadSecureSession, saveSecureSession } =
  await import('./auth.js');

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
    clearSecureSession();
  });

  it('never writes a token to disk in the clear when encryption is off', () => {
    storage.available = false;

    saveSecureSession(session);

    expect(sessionFile()).not.toContain('access-secret');
    expect(sessionFile()).not.toContain('refresh-secret');
  });

  it('keeps the session in memory so sign-in still works this run', () => {
    storage.available = false;

    saveSecureSession(session);

    expect(loadSecureSession()?.refreshToken).toBe('refresh-secret');
  });

  it('treats the Linux basic_text backend as no encryption', () => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
    storage.backend = 'basic_text';

    saveSecureSession(session);

    expect(sessionFile()).not.toContain('encryptedRefreshToken":"');
    vi.restoreAllMocks();
  });

  it('rewrites a legacy plaintext file on load', () => {
    writeFileSync(
      join(userData, 'onetab-auth-session.json'),
      JSON.stringify({ user: { id: 'u1' }, plainRefreshToken: 'old-secret' }),
    );

    expect(loadSecureSession()?.refreshToken).toBe('old-secret');
    expect(sessionFile()).not.toContain('plainRefreshToken');
    expect(sessionFile()).not.toContain('old-secret');
  });
});
