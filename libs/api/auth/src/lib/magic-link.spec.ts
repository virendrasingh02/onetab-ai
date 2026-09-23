import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { hashToken } from '@org/api-common';
import type { PrismaService } from '@org/database';
import type { ConfigService } from '@nestjs/config';
import type { MailService } from '@org/api-mail';
import { AuthService } from './auth.service.js';
import type { TokenService } from './token.service.js';

describe('AuthService - Magic Link', () => {
  let service: AuthService;
  let mockPrisma: any;
  let mockTokens: any;
  let mockConfig: any;
  let mockMail: any;

  const mockUser = {
    id: 'user_ml_1',
    email: 'alex@example.com',
    name: 'Alex Rivera',
    displayName: 'Alex',
    avatarUrl: null,
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
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn().mockImplementation(({ where, data }) => ({
          ...mockUser,
          ...data,
        })),
      },
      magicLinkToken: {
        create: vi.fn().mockResolvedValue({ id: 'ml_token_1' }),
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: 'ml_token_1', usedAt: new Date() }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: vi.fn().mockImplementation((promises) => Promise.all(promises)),
    };

    mockTokens = {
      issueSession: vi.fn().mockResolvedValue({
        tokens: {
          accessToken: 'mock_ml_access_token',
          expiresIn: 900,
          tokenType: 'Bearer',
        },
        refreshToken: 'mock_ml_refresh_token',
        expiresAt: new Date(Date.now() + 30 * 86400000),
      }),
    };

    mockConfig = {
      get: vi.fn((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'APP_URL') return 'http://localhost:4200';
        if (key === 'MAGIC_LINK_TTL') return '15m';
        return undefined;
      }),
    };

    mockMail = {
      send: vi.fn().mockResolvedValue({ delivered: true, transport: 'log' }),
    };

    service = new AuthService(
      mockPrisma as unknown as PrismaService,
      mockTokens as unknown as TokenService,
      mockConfig as unknown as ConfigService,
      mockMail as unknown as MailService,
    );
  });

  describe('requestMagicLink', () => {
    it('returns a generic message when email does not exist without leaking existence', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const res = await service.requestMagicLink({ email: 'unknown@example.com' });

      expect(res.message).toContain('If an account exists');
      expect(mockPrisma.magicLinkToken.create).not.toHaveBeenCalled();
      expect(mockMail.send).not.toHaveBeenCalled();
    });

    it('creates a hashed token, invalidates prior tokens, and sends email when user exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const res = await service.requestMagicLink({ email: 'alex@example.com' });

      expect(res.message).toContain('If an account exists');
      expect(res.devToken).toBeDefined();

      // Check that existing tokens are invalidated
      expect(mockPrisma.magicLinkToken.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id, usedAt: null },
        data: { usedAt: expect.any(Date) },
      });

      // Check token storage (hashed, never raw)
      expect(mockPrisma.magicLinkToken.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          tokenHash: hashToken(res.devToken!),
          expiresAt: expect.any(Date),
        },
      });

      // Check email delivery
      expect(mockMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockUser.email,
          subject: 'Sign in to OneTab AI',
        }),
      );
    });
  });

  describe('verifyMagicLink', () => {
    it('throws UnauthorizedException if token does not exist', async () => {
      mockPrisma.magicLinkToken.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyMagicLink({ token: 'nonexistent-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException if token was already used', async () => {
      mockPrisma.magicLinkToken.findUnique.mockResolvedValue({
        id: 'ml_1',
        userId: mockUser.id,
        user: mockUser,
        usedAt: new Date(Date.now() - 60000),
        expiresAt: new Date(Date.now() + 600000),
      });

      await expect(
        service.verifyMagicLink({ token: 'already-used-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException if token has expired', async () => {
      mockPrisma.magicLinkToken.findUnique.mockResolvedValue({
        id: 'ml_1',
        userId: mockUser.id,
        user: mockUser,
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.verifyMagicLink({ token: 'expired-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('authenticates user, invalidates token, and issues session on valid token', async () => {
      mockPrisma.magicLinkToken.findUnique.mockResolvedValue({
        id: 'ml_1',
        userId: mockUser.id,
        user: mockUser,
        usedAt: null,
        expiresAt: new Date(Date.now() + 900000),
      });

      const result = await service.verifyMagicLink(
        { token: 'valid-token' },
        { ipAddress: '127.0.0.1', userAgent: 'Vitest' },
      );

      expect(result.user.id).toBe(mockUser.id);
      expect(result.session.tokens.accessToken).toBe('mock_ml_access_token');
      expect(mockTokens.issueSession).toHaveBeenCalled();
      expect(mockPrisma.magicLinkToken.update).toHaveBeenCalledWith({
        where: { id: 'ml_1' },
        data: { usedAt: expect.any(Date) },
      });
    });
  });
});
