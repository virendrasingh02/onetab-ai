import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { AIEncryptionService } from './ai-encryption.service.js';

describe('AIEncryptionService', () => {
  let service: AIEncryptionService;

  beforeEach(() => {
    const configService = {
      get: vi.fn((key: string) => {
        if (key === 'ENCRYPTION_KEY') return 'test-encryption-key-for-unit-testing-32b';
        return undefined;
      }),
    } as unknown as ConfigService;

    service = new AIEncryptionService(configService);
  });

  describe('encrypt & decrypt', () => {
    it('encrypts plaintext and decrypts back to the exact original string', () => {
      const original = 'nvapi-1234567890abcdefghijklmnopqrstuvwxyz';
      const encrypted = service.encrypt(original);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(original);
      expect(encrypted.split(':').length).toBe(3); // iv:authTag:encrypted

      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(original);
    });

    it('returns empty string when given empty input', () => {
      expect(service.encrypt('')).toBe('');
      expect(service.decrypt('')).toBe('');
    });

    it('throws error when tampering with ciphertext or auth tag', () => {
      const original = 'sk-ant-test-secret-key-12345';
      const encrypted = service.encrypt(original);
      const parts = encrypted.split(':');

      // Tamper with the encrypted body
      const tamperedBody = parts[0] + ':' + parts[1] + ':' + 'ff' + parts[2].slice(2);
      expect(() => service.decrypt(tamperedBody)).toThrow('Credential decryption failed');

      // Tamper with the auth tag
      const tamperedTag = parts[0] + ':' + 'ff'.repeat(16) + ':' + parts[2];
      expect(() => service.decrypt(tamperedTag)).toThrow('Credential decryption failed');
    });
  });

  describe('maskApiKey', () => {
    it('masks long API keys keeping only the last 4 characters', () => {
      const key = 'sk-proj-1234567890abcdef9876';
      expect(service.maskApiKey(key)).toBe('••••••••••••9876');
    });

    it('masks medium length keys keeping only the last 2 characters', () => {
      const key = 'abc12345';
      expect(service.maskApiKey(key)).toBe('••••••••45');
    });

    it('fully masks very short keys without revealing characters', () => {
      const key = 'test';
      expect(service.maskApiKey(key)).toBe('••••••••');
    });

    it('returns empty string for blank input', () => {
      expect(service.maskApiKey('')).toBe('');
    });
  });
});
