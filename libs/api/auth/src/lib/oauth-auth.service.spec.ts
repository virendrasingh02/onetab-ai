import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import axios from 'axios';
import { OAuthAuthService } from './oauth-auth.service.js';
import type { DesktopAuthService } from './desktop-auth.service.js';
import type { TokenService } from './token.service.js';

vi.mock('axios');

describe('OAuthAuthService', () => {
  let service: OAuthAuthService;
  let mockPrisma: any;
  let mockConfig: any;
  let mockTokens: any;
  let mockDesktopAuth: any;
  let mockResponse: Partial<Response>;

  const mockUser = {
    id: 'user_oauth_1',
    email: 'alex@example.com',
    name: 'Alex Mercer',
    displayName: null,
    avatarUrl: 'https://example.com/avatar.png',
    bio: null,
    timezone: 'UTC',
    preferredLanguage: 'en',
    systemRole: 'USER',
    presence: 'OFFLINE',
    statusText: null,
    statusEmoji: null,
    statusExpiresAt: null,
    emailVerifiedAt: new Date(),
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    passwordHash: '$2b$12$somehashedpassword',
    identities: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = {
      user: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      userIdentity: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
        delete: vi.fn(),
      },
    };

    mockConfig = {
      get: vi.fn((key: string, defaultValue?: any) => {
        const configMap: Record<string, string> = {
          NODE_ENV: 'test',
          WEB_APP_URL: 'http://localhost:4200',
          API_URL: 'http://localhost:3000/api/v1',
          GOOGLE_CLIENT_ID: 'test-google-client-id',
          GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
          GOOGLE_AUTH_REDIRECT_URI: 'http://localhost:3000/api/v1/auth/google/callback',
          APPLE_CLIENT_ID: 'com.onetab.ai.web',
          APPLE_TEAM_ID: 'TESTTEAM12',
          APPLE_KEY_ID: 'TESTKEY123',
          APPLE_AUTH_REDIRECT_URI: 'http://localhost:3000/api/v1/auth/apple/callback',
          JWT_ACCESS_SECRET: 'super-secret-test-key-for-state-signing',
        };
        return configMap[key] ?? defaultValue;
      }),
    } as unknown as ConfigService;

    mockTokens = {
      issueSession: vi.fn().mockResolvedValue({
        tokens: {
          accessToken: 'test-access-token',
          expiresIn: 900,
          tokenType: 'Bearer',
        },
        refreshToken: 'test-refresh-token',
        refreshExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }),
    } as unknown as TokenService;

    mockDesktopAuth = {
      generateCode: vi.fn().mockResolvedValue({
        code: 'desktop-one-time-code-123',
        state: 'desktop-state-123',
      }),
    } as unknown as DesktopAuthService;

    mockResponse = {
      redirect: vi.fn() as any,
      cookie: vi.fn() as any,
    };

    service = new OAuthAuthService(
      mockPrisma,
      mockConfig,
      mockTokens,
      mockDesktopAuth,
    );
  });

  describe('State Generation & Verification', () => {
    it('generates a signed state token and verifies it successfully', () => {
      const { state, nonce } = service.generateState({
        provider: 'google',
        returnTo: '/dashboard',
      });

      expect(state).toContain('.');
      const unpacked = service.verifyState(state, 'google');
      expect(unpacked.provider).toBe('google');
      expect(unpacked.returnTo).toBe('/dashboard');
      expect(unpacked.nonce).toBe(nonce);
    });

    it('rejects tampered state tokens', () => {
      const { state } = service.generateState({
        provider: 'google',
      });

      const tampered = `${state}tampered`;
      expect(() => service.verifyState(tampered, 'google')).toThrow(BadRequestException);
    });

    it('prevents state replay attacks', () => {
      const { state } = service.generateState({
        provider: 'google',
      });

      const firstPass = service.verifyState(state, 'google');
      expect(firstPass.provider).toBe('google');

      // Second attempt with same state string must be rejected
      expect(() => service.verifyState(state, 'google')).toThrow(BadRequestException);
    });

    it('rejects provider mismatch in state', () => {
      const { state } = service.generateState({
        provider: 'apple',
      });

      expect(() => service.verifyState(state, 'google')).toThrow(BadRequestException);
    });
  });

  describe('Google OAuth Flow', () => {
    it('generates Google authorization URL with PKCE and state', async () => {
      const { url } = await service.getGoogleAuthUrl({
        returnTo: '/projects/123',
      });

      expect(url).toContain('https://accounts.google.com/o/oauth2/v2/auth');
      expect(url).toContain('client_id=test-google-client-id');
      expect(url).toContain('redirect_uri=');
      expect(url).toContain('code_challenge=');
      expect(url).toContain('code_challenge_method=S256');
      expect(url).toContain('state=');
    });

    it('handles Google user cancellation cleanly', async () => {
      await service.handleGoogleCallback(
        { error: 'access_denied' },
        {},
        mockResponse as Response,
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'http://localhost:4200/login?error=oauth_cancelled',
      );
    });

    it('successfully signs in an existing user with linked Google identity', async () => {
      const { state } = service.generateState({
        provider: 'google',
        returnTo: '/pulse',
      });

      (axios.post as any).mockResolvedValueOnce({
        data: { access_token: 'google_access_token_123', id_token: 'google_id_token' },
      });

      (axios.get as any).mockResolvedValueOnce({
        data: {
          sub: 'google_sub_123',
          email: 'alex@example.com',
          email_verified: true,
          name: 'Alex Mercer',
          picture: 'https://example.com/avatar.png',
        },
      });

      mockPrisma.user.findFirst.mockResolvedValueOnce({
        ...mockUser,
      });

      await service.handleGoogleCallback(
        { code: 'valid_google_code', state },
        { ipAddress: '127.0.0.1' },
        mockResponse as Response,
      );

      expect(mockTokens.issueSession).toHaveBeenCalled();
      expect(mockResponse.cookie).toHaveBeenCalled();
      expect(mockResponse.redirect).toHaveBeenCalledWith('http://localhost:4200/pulse');
    });

    it('creates a new user when email does not exist yet', async () => {
      const { state } = service.generateState({
        provider: 'google',
        returnTo: '/',
      });

      (axios.post as any).mockResolvedValueOnce({
        data: { access_token: 'google_access_token_456' },
      });

      (axios.get as any).mockResolvedValueOnce({
        data: {
          sub: 'google_sub_new_user',
          email: 'newuser@company.com',
          email_verified: true,
          name: 'New Colleague',
          picture: 'https://example.com/new.png',
        },
      });

      // No identity found
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      // No existing user with that email
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);

      const createdUser = {
        id: 'new_user_id',
        email: 'newuser@company.com',
        name: 'New Colleague',
      };
      mockPrisma.user.create.mockResolvedValueOnce(createdUser);

      await service.handleGoogleCallback(
        { code: 'valid_google_code', state },
        {},
        mockResponse as Response,
      );

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'newuser@company.com',
            name: 'New Colleague',
            passwordHash: null,
          }),
        }),
      );
      expect(mockTokens.issueSession).toHaveBeenCalledWith(createdUser, {});
      expect(mockResponse.redirect).toHaveBeenCalledWith('http://localhost:4200/');
    });

    it('links Google to existing account when email matches', async () => {
      const { state } = service.generateState({
        provider: 'google',
      });

      (axios.post as any).mockResolvedValueOnce({
        data: { access_token: 'google_access_token_789' },
      });

      (axios.get as any).mockResolvedValueOnce({
        data: {
          sub: 'google_sub_link_me',
          email: 'alex@example.com',
          email_verified: true,
          name: 'Alex Mercer',
        },
      });

      // 1. Identity lookup by provider & providerUserId -> null
      mockPrisma.user.findFirst.mockResolvedValueOnce(null);
      // 2. Existing user lookup by email -> found mockUser
      mockPrisma.user.findFirst.mockResolvedValueOnce(mockUser);
      mockPrisma.userIdentity.create.mockResolvedValueOnce({ id: 'ident_1' });
      mockPrisma.user.update.mockResolvedValueOnce(mockUser);

      await service.handleGoogleCallback(
        { code: 'valid_code', state },
        {},
        mockResponse as Response,
      );

      expect(mockPrisma.userIdentity.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          provider: 'google',
          providerUserId: 'google_sub_link_me',
          email: 'alex@example.com',
        },
      });
      expect(mockResponse.redirect).toHaveBeenCalledWith('http://localhost:4200/');
    });

    it('rejects Google account when email is not verified', async () => {
      const { state } = service.generateState({
        provider: 'google',
      });

      (axios.post as any).mockResolvedValueOnce({
        data: { access_token: 'google_access_token_unverified' },
      });

      (axios.get as any).mockResolvedValueOnce({
        data: {
          sub: 'google_sub_unverified',
          email: 'unverified@example.com',
          email_verified: false,
        },
      });

      await service.handleGoogleCallback(
        { code: 'valid_code', state },
        {},
        mockResponse as Response,
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'http://localhost:4200/login?error=oauth_email_unverified',
      );
    });

    it('handles desktop handoff PKCE redirect correctly', async () => {
      const { state } = service.generateState({
        provider: 'google',
        desktop: true,
        handoffState: 'desktop_handoff_state_xyz',
        handoffChallenge: 'desktop_pkce_challenge_123',
      });

      (axios.post as any).mockResolvedValueOnce({
        data: { access_token: 'google_access_token' },
      });

      (axios.get as any).mockResolvedValueOnce({
        data: {
          sub: 'google_sub_123',
          email: 'alex@example.com',
          email_verified: true,
        },
      });

      mockPrisma.user.findFirst.mockResolvedValueOnce(mockUser);

      await service.handleGoogleCallback(
        { code: 'valid_code', state },
        {},
        mockResponse as Response,
      );

      expect(mockDesktopAuth.generateCode).toHaveBeenCalledWith(
        mockUser.id,
        {
          state: 'desktop_handoff_state_xyz',
          codeChallenge: 'desktop_pkce_challenge_123',
        },
      );
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining('http://localhost:4200/auth/callback?code=desktop-one-time-code-123'),
      );
    });
  });

  describe('Apple OAuth Flow', () => {
    it('generates Apple authorization URL with form_post response mode', async () => {
      const { url } = await service.getAppleAuthUrl({
        returnTo: '/channels',
      });

      expect(url).toContain('https://appleid.apple.com/auth/authorize');
      expect(url).toContain('client_id=com.onetab.ai.web');
      expect(url).toContain('response_mode=form_post');
      expect(url).toContain('response_type=code+id_token');
      expect(url).toContain('state=');
      expect(url).toContain('nonce=');
    });

    it('handles Apple user cancellation cleanly', async () => {
      await service.handleAppleCallback(
        { error: 'user_cancelled_authorize' },
        {},
        mockResponse as Response,
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'http://localhost:4200/login?error=oauth_cancelled',
      );
    });

    it('handles first-time Apple login profile name and private relay email', async () => {
      const { state, nonce } = service.generateState({
        provider: 'apple',
      });

      // Construct a mock unverified/test id_token
      const header = Buffer.from(JSON.stringify({ alg: 'none', kid: 'test_kid' })).toString('base64url');
      const payload = Buffer.from(
        JSON.stringify({
          iss: 'https://appleid.apple.com',
          aud: 'com.onetab.ai.web',
          exp: Math.floor(Date.now() / 1000) + 3600,
          sub: 'apple_sub_private_relay',
          email: 'privaterelay123@privaterelay.appleid.com',
          nonce,
        }),
      ).toString('base64url');
      const mockIdToken = `${header}.${payload}.sig`;

      // Apple returns user JSON on first login
      const appleUserJson = JSON.stringify({
        name: { firstName: 'Taylor', lastName: 'Swift' },
      });

      mockPrisma.user.findFirst.mockResolvedValueOnce(null); // identity check
      mockPrisma.user.findFirst.mockResolvedValueOnce(null); // email check
      const createdUser = {
        id: 'user_apple_1',
        email: 'privaterelay123@privaterelay.appleid.com',
        name: 'Taylor Swift',
      };
      mockPrisma.user.create.mockResolvedValueOnce(createdUser);

      await service.handleAppleCallback(
        {
          state,
          id_token: mockIdToken,
          user: appleUserJson,
        },
        {},
        mockResponse as Response,
      );

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: 'privaterelay123@privaterelay.appleid.com',
            name: 'Taylor Swift',
          }),
        }),
      );
      expect(mockResponse.redirect).toHaveBeenCalledWith('http://localhost:4200/');
    });
  });

  describe('Account Linking in Settings', () => {
    it('links provider to authenticated user when linkUserId is present', async () => {
      const { state } = service.generateState({
        provider: 'google',
        linkUserId: mockUser.id,
        returnTo: '/w/test/settings/security',
      });

      (axios.post as any).mockResolvedValueOnce({
        data: { access_token: 'google_token' },
      });

      (axios.get as any).mockResolvedValueOnce({
        data: {
          sub: 'google_new_sub_link',
          email: 'alex@example.com',
          email_verified: true,
        },
      });

      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);
      mockPrisma.userIdentity.findUnique.mockResolvedValueOnce(null);
      mockPrisma.userIdentity.create.mockResolvedValueOnce({ id: 'ident_new' });

      await service.handleGoogleCallback(
        { code: 'valid_code', state },
        {},
        mockResponse as Response,
      );

      expect(mockPrisma.userIdentity.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          provider: 'google',
          providerUserId: 'google_new_sub_link',
          email: 'alex@example.com',
        },
      });
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'http://localhost:4200/w/test/settings/security?linked=google',
      );
    });

    it('rejects linking if provider account is already linked to another user', async () => {
      const { state } = service.generateState({
        provider: 'google',
        linkUserId: mockUser.id,
      });

      (axios.post as any).mockResolvedValueOnce({
        data: { access_token: 'google_token' },
      });

      (axios.get as any).mockResolvedValueOnce({
        data: {
          sub: 'google_already_taken_sub',
          email: 'other@example.com',
          email_verified: true,
        },
      });

      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);
      // Already linked to someone else
      mockPrisma.userIdentity.findUnique.mockResolvedValueOnce({
        id: 'other_ident',
        userId: 'other_different_user_id',
      });

      await service.handleGoogleCallback(
        { code: 'valid_code', state },
        {},
        mockResponse as Response,
      );

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        'http://localhost:4200/settings/security?error=oauth_account_linked_to_other',
      );
    });
  });

  describe('Disconnecting Identity', () => {
    it('successfully disconnects provider if user has password', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user_1',
        passwordHash: '$2b$12$passwordhash',
        identities: [
          { id: 'id_google', provider: 'google' },
        ],
      });
      mockPrisma.userIdentity.delete.mockResolvedValueOnce({});

      const result = await service.disconnectIdentity('user_1', 'google');
      expect(result.success).toBe(true);
      expect(mockPrisma.userIdentity.delete).toHaveBeenCalledWith({
        where: { id: 'id_google' },
      });
    });

    it('successfully disconnects provider if user has another identity', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user_1',
        passwordHash: null, // no password
        identities: [
          { id: 'id_google', provider: 'google' },
          { id: 'id_apple', provider: 'apple' },
        ],
      });
      mockPrisma.userIdentity.delete.mockResolvedValueOnce({});

      const result = await service.disconnectIdentity('user_1', 'google');
      expect(result.success).toBe(true);
    });

    it('prevents disconnecting the only usable sign-in method', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user_1',
        passwordHash: null, // no password
        identities: [
          { id: 'id_google', provider: 'google' },
          // no other identities
        ],
      });

      await expect(service.disconnectIdentity('user_1', 'google')).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrisma.userIdentity.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if identity does not exist on user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'user_1',
        passwordHash: 'hash',
        identities: [],
      });

      await expect(service.disconnectIdentity('user_1', 'google')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
