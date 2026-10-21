import { describe, it, expect } from 'vitest';
import * as crypto from 'node:crypto';
import { OidcSsoService } from './oidc-sso.service.js';

describe('OidcSsoService', () => {
  const oidcService = new OidcSsoService();

  describe('buildAuthorizationUrl', () => {
    it('creates a standard OIDC authorization URL with PKCE (S256 code challenge)', async () => {
      const authEndpoint = 'https://login.microsoftonline.com/tenant-123/oauth2/v2.0/authorize';
      const clientId = 'client-id-abc';
      const redirectUri = 'https://app.mie.ai/api/v1/auth/sso/oidc/callback';
      const scopes = ['openid', 'profile', 'email', 'groups'];

      const result = await oidcService.buildAuthorizationUrl({
        issuer: 'https://login.microsoftonline.com/tenant-123/v2.0',
        authorizationEndpoint: authEndpoint,
        clientId,
        redirectUri,
        scopes,
        state: 'random-state-123',
        nonce: 'random-nonce-456',
      });

      expect(result.url).toBeDefined();
      expect(result.codeVerifier).toBeDefined();

      const url = new URL(result.url);
      expect(url.origin + url.pathname).toBe(authEndpoint);
      expect(url.searchParams.get('client_id')).toBe(clientId);
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('redirect_uri')).toBe(redirectUri);
      expect(url.searchParams.get('scope')).toBe('openid profile email groups');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
      expect(url.searchParams.get('state')).toBe('random-state-123');
      expect(url.searchParams.get('nonce')).toBe('random-nonce-456');

      // Verify that code_challenge correctly matches the SHA-256 base64url of codeVerifier
      const computedChallenge = crypto
        .createHash('sha256')
        .update(result.codeVerifier)
        .digest('base64url');
      expect(url.searchParams.get('code_challenge')).toBe(computedChallenge);
    });
  });
});
