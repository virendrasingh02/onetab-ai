import { describe, expect, it } from 'vitest';
import {
  generateBase32Secret,
  generateTotpCode,
  generateRecoveryCodes,
  verifyTotpToken,
} from './totp.util.js';

describe('totp.util', () => {
  it('generates a valid 20-character base32 secret', () => {
    const secret = generateBase32Secret(20);
    expect(secret).toHaveLength(20);
    expect(/^[A-Z2-7]+$/.test(secret)).toBe(true);
  });

  it('generates and verifies matching TOTP code', () => {
    const secret = generateBase32Secret(20);
    const code = generateTotpCode(secret);
    expect(code).toHaveLength(6);
    expect(/^\d{6}$/.test(code)).toBe(true);

    const isValid = verifyTotpToken(secret, code);
    expect(isValid).toBe(true);
  });

  it('rejects incorrect TOTP codes', () => {
    const secret = generateBase32Secret(20);
    expect(verifyTotpToken(secret, '000000')).toBe(false);
    expect(verifyTotpToken(secret, 'invalid')).toBe(false);
    expect(verifyTotpToken(secret, '123')).toBe(false);
  });

  it('generates standard recovery codes formatted as XXXX-XXXX', () => {
    const codes = generateRecoveryCodes(8);
    expect(codes).toHaveLength(8);
    for (const code of codes) {
      expect(/^[0-9A-F]{4}-[0-9A-F]{4}$/.test(code)).toBe(true);
    }
  });
});
