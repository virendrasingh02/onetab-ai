import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
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
  let nodeEnv: string;

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

  const liveRecord = (overrides: Record<string, unknown> = {}) => ({
    id: 'ml_1',
    userId: mockUser.id,
    usedAt: null,
    expiresAt: new Date(Date.now() + 900_000),
    user: { emailVerifiedAt: mockUser.emailVerifiedAt },
    ...overrides,
  });

  beforeEach(() => {
    nodeEnv = 'development';
    mockPrisma = {
      user: {
        findFirst: vi.fn(),
        update: vi.fn().mockImplementation(({ data }) => ({
          ...mockUser,
          ...data,
        })),
      },
      magicLinkToken: {
        create: vi.fn().mockResolvedValue({ id: 'ml_token_1' }),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      // No two-factor on this account: the link alone signs in.
      twoFactorAuth: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi
        .fn()
        .mockImplementation((operations) => Promise.all(operations)),
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
        if (key === 'NODE_ENV') return nodeEnv;
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
    it('answers generically for an unknown address and sends nothing', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const res = await service.requestMagicLink({ email: 'unknown@example.com' });

      expect(res.message).toContain('If an account exists');
      expect(res.expiresInMinutes).toBe(15);
      expect(res.devToken).toBeUndefined();
      expect(mockPrisma.magicLinkToken.create).not.toHaveBeenCalled();
      expect(mockMail.send).not.toHaveBeenCalled();
    });

    it('matches the address exactly — never a prefix of another account', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await service.requestMagicLink({ email: 'alex@example.com' });

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { email: { equals: 'alex@example.com', mode: 'insensitive' } },
        select: { id: true, email: true },
      });
    });

    it('stores only the hash, supersedes older links, and emails the new one', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const res = await service.requestMagicLink({ email: 'alex@example.com' });

      expect(res.message).toContain('If an account exists');
      expect(res.devToken).toBeDefined();

      // Older live links are expired (not marked used) so they read "expired".
      expect(mockPrisma.magicLinkToken.updateMany).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          usedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
        data: { expiresAt: expect.any(Date) },
      });

      expect(mockPrisma.magicLinkToken.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          tokenHash: hashToken(res.devToken as string),
          expiresAt: expect.any(Date),
        },
      });

      expect(mockMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: mockUser.email,
          subject: 'Sign in to OneTab AI',
        }),
      );
    });

    it('sends nothing inside the per-account cooldown but answers the same', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.magicLinkToken.findFirst.mockResolvedValue({ id: 'recent' });

      const res = await service.requestMagicLink({ email: 'alex@example.com' });

      expect(res.message).toContain('If an account exists');
      expect(res.expiresInMinutes).toBe(15);
      expect(mockPrisma.magicLinkToken.create).not.toHaveBeenCalled();
      expect(mockMail.send).not.toHaveBeenCalled();
    });

    it('never returns the raw token in production', async () => {
      nodeEnv = 'production';
      mockPrisma.user.findFirst.mockResolvedValue(mockUser);

      const res = await service.requestMagicLink({ email: 'alex@example.com' });

      expect(res.devToken).toBeUndefined();
      expect(mockMail.send).toHaveBeenCalled();
    });
  });

  describe('verifyMagicLink', () => {
    it('rejects an unknown token', async () => {
      mockPrisma.magicLinkToken.findUnique.mockResolvedValue(null);

      await expect(
        service.verifyMagicLink({ token: 'nonexistent-token' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a token that was already used with a conflict', async () => {
      mockPrisma.magicLinkToken.findUnique.mockResolvedValue(
        liveRecord({ usedAt: new Date(Date.now() - 60_000) }),
      );

      await expect(
        service.verifyMagicLink({ token: 'already-used-token' }),
      ).rejects.toThrow(ConflictException);
      expect(mockTokens.issueSession).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      mockPrisma.magicLinkToken.findUnique.mockResolvedValue(
        liveRecord({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(
        service.verifyMagicLink({ token: 'expired-token' }),
      ).rejects.toThrow(UnauthorizedException);
      expect(mockTokens.issueSession).not.toHaveBeenCalled();
    });

    it('issues no session when a concurrent request claimed the token first', async () => {
      mockPrisma.magicLinkToken.findUnique.mockResolvedValue(liveRecord());
      mockPrisma.magicLinkToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.verifyMagicLink({ token: 'raced-token' }),
      ).rejects.toThrow(ConflictException);
      expect(mockTokens.issueSession).not.toHaveBeenCalled();
    });

    it('claims the token atomically and issues a session', async () => {
      mockPrisma.magicLinkToken.findUnique.mockResolvedValue(liveRecord());

      const result = await service.verifyMagicLink(
        { token: 'valid-token' },
        { ipAddress: '127.0.0.1', userAgent: 'Vitest' },
      );

      expect(mockPrisma.magicLinkToken.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { tokenHash: hashToken('valid-token') } }),
      );
      expect(mockPrisma.magicLinkToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'ml_1', usedAt: null, expiresAt: { gt: expect.any(Date) } },
        data: { usedAt: expect.any(Date) },
      });
      if ('twoFactor' in result) throw new Error('expected a session');
      expect(result.user.id).toBe(mockUser.id);
      expect(result.session.tokens.accessToken).toBe('mock_ml_access_token');
      expect(mockTokens.issueSession).toHaveBeenCalled();
    });

    it('marks an unverified email as verified — the link proves the inbox', async () => {
      mockPrisma.magicLinkToken.findUnique.mockResolvedValue(
        liveRecord({ user: { emailVerifiedAt: null } }),
      );

      await service.verifyMagicLink({ token: 'valid-token' });

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: expect.objectContaining({ emailVerifiedAt: expect.any(Date) }),
      });
    });
  });
});
