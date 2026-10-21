import { describe, it, expect } from 'vitest';
import {
  deriveSecretKey,
  encryptSecret,
  decryptSecret,
  hashToken,
  verifyTokenHash,
  generateScimToken,
  generateRecoveryCode,
  normalizeCertificatePem,
} from './crypto-secrets.js';

describe('Crypto & Secrets Utilities', () => {
  const masterKey = deriveSecretKey('super-secret-enterprise-encryption-key-32-chars!!');

  describe('AES-256-GCM Encryption / Decryption', () => {
    it('encrypts and decrypts secret data correctly', () => {
      const plaintext = 'client_secret_test_123456789!@#$%^&*()';
      const ciphertext = encryptSecret(plaintext, masterKey);

      expect(ciphertext).toBeDefined();
      expect(ciphertext).not.toBe(plaintext);
      // Format: <iv_base64url>.<authTag_base64url>.<ciphertext_base64url>
      expect(ciphertext.split('.')).toHaveLength(3);

      const decrypted = decryptSecret(ciphertext, masterKey);
      expect(decrypted).toBe(plaintext);
    });

    it('generates different ciphertexts for identical plaintext due to random IV', () => {
      const plaintext = 'same-secret-value';
      const cipher1 = encryptSecret(plaintext, masterKey);
      const cipher2 = encryptSecret(plaintext, masterKey);

      expect(cipher1).not.toBe(cipher2);
      expect(decryptSecret(cipher1, masterKey)).toBe(plaintext);
      expect(decryptSecret(cipher2, masterKey)).toBe(plaintext);
    });

    it('returns null when ciphertext is tampered with', () => {
      const plaintext = 'tamper-test';
      const ciphertext = encryptSecret(plaintext, masterKey);
      const parts = ciphertext.split('.');
      // Tamper with cipher text
      parts[2] = parts[2].slice(0, -2) + 'ff';
      const tampered = parts.join('.');

      expect(decryptSecret(tampered, masterKey)).toBeNull();
    });

    it('returns null when auth tag is tampered with', () => {
      const plaintext = 'tamper-tag-test';
      const ciphertext = encryptSecret(plaintext, masterKey);
      const parts = ciphertext.split('.');
      // Tamper with tag
      parts[1] = parts[1].slice(0, -2) + '00';
      const tampered = parts.join('.');

      expect(decryptSecret(tampered, masterKey)).toBeNull();
    });
  });

  describe('Token Hashing & Constant-Time Verification', () => {
    it('hashes tokens and correctly verifies matches', () => {
      const token = 'scim_token_abc123xyz789';
      const hash = hashToken(token);

      expect(hash).toHaveLength(64); // SHA-256 hex string
      expect(verifyTokenHash(token, hash)).toBe(true);
      expect(verifyTokenHash('scim_token_wrong', hash)).toBe(false);
    });

    it('handles null/empty or malformed hashes safely without throwing', () => {
      expect(verifyTokenHash('token', '')).toBe(false);
      expect(verifyTokenHash('', 'hash')).toBe(false);
      expect(verifyTokenHash('token', 'not-a-valid-length-hash')).toBe(false);
    });
  });

  describe('SCIM Token Generation', () => {
    it('generates secure SCIM tokens with correct prefix and entropy', () => {
      const { rawToken, tokenPrefix, tokenHash } = generateScimToken();

      expect(rawToken.startsWith('scim_live_')).toBe(true);
      expect(tokenPrefix.startsWith('scim_live_')).toBe(true);
      expect(tokenHash).toHaveLength(64);
      expect(verifyTokenHash(rawToken, tokenHash)).toBe(true);
    });
  });

  describe('Emergency Recovery Code Generation', () => {
    it('generates formatted break-glass recovery codes', () => {
      const { rawCode, codeHash } = generateRecoveryCode();

      expect(rawCode.startsWith('mie-recov-')).toBe(true);
      expect(rawCode).toMatch(/^mie-recov-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(codeHash).toHaveLength(64);
      expect(verifyTokenHash(rawCode, codeHash)).toBe(true);
    });
  });

  describe('Certificate PEM Normalization', () => {
    it('adds PEM header and footer if missing and formats 64-character lines', () => {
      const rawBase64 = 'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Y3wV1L4NIDAQAB';
      const pem = normalizeCertificatePem(rawBase64);

      expect(pem.startsWith('-----BEGIN CERTIFICATE-----')).toBe(true);
      expect(pem.trimEnd().endsWith('-----END CERTIFICATE-----')).toBe(true);
    });

    it('preserves existing valid PEM certificate format', () => {
      const existingPem = [
        '-----BEGIN CERTIFICATE-----',
        'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzx',
        '-----END CERTIFICATE-----',
      ].join('\n');

      const pem = normalizeCertificatePem(existingPem);
      expect(pem).toContain('-----BEGIN CERTIFICATE-----');
      expect(pem).toContain('-----END CERTIFICATE-----');
    });
  });
});
