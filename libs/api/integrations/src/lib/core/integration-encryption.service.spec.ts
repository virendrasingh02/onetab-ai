import { describe, expect, it } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { IntegrationEncryptionService } from './integration-encryption.service.js';

describe('IntegrationEncryptionService', () => {
  const config = {
    get: (key: string) => {
      if (key === 'ENCRYPTION_KEY') return 'test-32-byte-encryption-key-for-unit-test';
      return undefined;
    },
  } as unknown as ConfigService;

  const service = new IntegrationEncryptionService(config);

  it('encrypts and decrypts a secret cleanly with AES-256-GCM', () => {
    const plain = 'ya29.a0AfH6SMD-google-secret-oauth-access-token-12345';
    const encrypted = service.encrypt(plain);

    expect(encrypted).not.toBe(plain);
    expect(encrypted.split(':').length).toBe(3); // iv:authTag:ciphertext

    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(plain);
  });

  it('handles empty input gracefully', () => {
    expect(service.encrypt('')).toBe('');
    expect(service.decrypt('')).toBe('');
  });

  it('throws on tampered ciphertext', () => {
    const plain = 'my-secret-key';
    const encrypted = service.encrypt(plain);
    const [iv, tag, cipher] = encrypted.split(':');
    const tampered = `${iv}:${tag}:ff${cipher.substring(2)}`;

    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('masks secret keys safely for presentation', () => {
    expect(service.maskSecret('sk-1234567890abcdef')).toBe('••••••••••••cdef');
    expect(service.maskSecret('short12')).toBe('••••••••12');
    expect(service.maskSecret('1234')).toBe('••••••••');
    expect(service.maskSecret('')).toBe('');
  });

  it('computes HMAC and verifies signatures with timing safety', () => {
    const data = '{"event":"message.created","id":"123"}';
    const secret = 'webhook-secret-xyz';
    const sig = service.computeHmacSha256(data, secret);

    expect(sig).toBeDefined();
    expect(service.verifySignature(sig, sig)).toBe(true);
    expect(service.verifySignature(sig, 'invalid-signature-hash')).toBe(false);
  });
});
