import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/mock/userData') },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((str: string) => Buffer.from(str, 'utf8')),
    decryptString: vi.fn((buf: Buffer) => buf.toString('utf8')),
  },
  shell: { openExternal: vi.fn() },
}));

const { generatePKCE } = await import('./auth.js');

describe('Desktop PKCE Auth', () => {
  it('generates a valid PKCE code_verifier, code_challenge, and state', () => {
    const pkce = generatePKCE();

    expect(pkce.verifier).toBeDefined();
    expect(pkce.challenge).toBeDefined();
    expect(pkce.state).toBeDefined();

    expect(pkce.verifier.length).toBeGreaterThanOrEqual(43);
    expect(pkce.state.length).toBeGreaterThanOrEqual(16);

    // Verify S256 challenge creation formula
    const computedChallenge = createHash('sha256')
      .update(pkce.verifier)
      .digest('base64url');

    expect(pkce.challenge).toBe(computedChallenge);
  });
});
