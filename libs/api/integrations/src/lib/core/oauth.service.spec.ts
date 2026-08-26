import { describe, expect, it } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationEncryptionService } from './integration-encryption.service.js';
import { OAuthService } from './oauth.service.js';

describe('OAuthService', () => {
  const config = {
    get: (key: string) => {
      if (key === 'ENCRYPTION_KEY') return 'test-32-byte-encryption-key-for-oauth';
      return undefined;
    },
  } as unknown as ConfigService;

  const encryption = new IntegrationEncryptionService(config);
  const service = new OAuthService(encryption);

  it('generates signed OAuth state and validates it successfully', () => {
    const state = service.generateState({
      provider: 'GMAIL',
      workspaceId: 'ws-100',
      userId: 'user-200',
      scopeType: 'USER',
      redirectUrl: 'http://localhost:3000/app',
    });

    expect(state).toContain('.');
    const unpacked = service.verifyState(state);

    expect(unpacked.provider).toBe('GMAIL');
    expect(unpacked.workspaceId).toBe('ws-100');
    expect(unpacked.userId).toBe('user-200');
    expect(unpacked.scopeType).toBe('USER');
    expect(unpacked.redirectUrl).toBe('http://localhost:3000/app');
  });

  it('rejects tampered OAuth state signatures', () => {
    const state = service.generateState({
      provider: 'GMAIL',
      workspaceId: 'ws-100',
      userId: 'user-200',
      scopeType: 'USER',
    });

    const [b64] = state.split('.');
    const tampered = `${b64}.badsignature1234567890`;

    expect(() => service.verifyState(tampered)).toThrow(BadRequestException);
  });

  it('generates cryptographic PKCE verifier and challenge pairs', () => {
    const { codeVerifier, codeChallenge } = service.generatePkcePair();

    expect(codeVerifier).toBeDefined();
    expect(codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(codeChallenge).toBeDefined();
    expect(codeChallenge).not.toBe(codeVerifier);
  });
});
