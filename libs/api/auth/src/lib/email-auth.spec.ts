import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { MailService } from '@org/api-mail';
import { AuthService } from './auth.service.js';
import type { TokenService } from './token.service.js';

describe('AuthService - Transactional Email Authentication', () => {
  let service: AuthService;
  let mockPrisma: any;
  let mockTokens: any;
  let mockConfig: any;
  let mockMail: any;

  const mockUser = {
    id: 'user_email_1',
    email: 'sarah@example.com',
    name: 'Sarah Connor',
    displayName: 'Sarah',
    avatarUrl: null,
    bio: null,
    timezone: 'UTC',
    preferredLanguage: 'en',
    systemRole: 'USER',
    presence: 'OFFLINE',
    statusText: null,
    statusEmoji: null,
    statusExpiresAt: null,
    emailVerifiedAt: null,
    lastSeenAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockPrisma = {
      user: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn().mockImplementation(({ data }) => ({
          ...mockUser,
          ...data,
        })),
      },
      passwordResetToken: {
        create: vi.fn().mockResolvedValue({ id: 'pr_token_1' }),
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
      emailVerificationToken: {
        create: vi.fn().mockResolvedValue({ id: 'ev_token_1' }),
        findUnique: vi.fn(),
        update: vi.fn().mockResolvedValue({}),
      },
      refreshToken: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: vi.fn().mockImplementation((promises) => Promise.all(promises)),
    };

    mockTokens = {
      issueSession: vi.fn(),
    } as unknown as TokenService;

    mockConfig = {
      get: vi.fn((key: string) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'APP_URL') return 'https://askmie.ai';
        if (key === 'APP_NAME') return 'Mie';
        return undefined;
      }),
    } as unknown as ConfigService;

    mockMail = {
      send: vi.fn().mockResolvedValue({ delivered: true, transport: 'http', id: 're_123' }),
    } as unknown as MailService;

    service = new AuthService(mockPrisma, mockTokens, mockConfig, mockMail);
  });

  describe('forgotPassword', () => {
    it('answers generically for an unknown address and sends no email', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'unknown@example.com' });
      expect(result).toEqual({});
      expect(mockMail.send).not.toHaveBeenCalled();
    });

    it('sends password reset email with idempotency key when user exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: mockUser.id });

      const result = await service.forgotPassword({ email: mockUser.email });
      expect(result.devToken).toBeDefined();
      expect(mockPrisma.passwordResetToken.create).toHaveBeenCalledOnce();
      expect(mockMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PASSWORD_RESET',
          to: mockUser.email,
          userId: mockUser.id,
          idempotencyKey: 'password-reset:pr_token_1',
        }),
      );
    });
  });

  describe('verifyResetToken', () => {
    it('returns valid: true for active reset token', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'pr_1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });

      const result = await service.verifyResetToken('raw_token');
      expect(result).toEqual({ valid: true });
    });

    it('throws UnauthorizedException for expired reset token', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'pr_1',
        usedAt: null,
        expiresAt: new Date(Date.now() - 60_000),
      });

      await expect(service.verifyResetToken('expired_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('resetPassword', () => {
    it('updates password, invalidates sessions, and sends security alert', async () => {
      mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
        id: 'pr_1',
        userId: mockUser.id,
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      });
      mockPrisma.user.findUnique.mockResolvedValue({ email: mockUser.email });

      await service.resetPassword({
        token: 'valid_token',
        password: 'NewStrongPassword123!',
        confirmPassword: 'NewStrongPassword123!',
      });

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
        }),
      );
      expect(mockPrisma.passwordResetToken.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pr_1' },
          data: { usedAt: expect.any(Date) },
        }),
      );
      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: mockUser.id, revokedAt: null },
        }),
      );
      expect(mockMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PASSWORD_CHANGED',
          to: mockUser.email,
        }),
      );
    });
  });

  describe('Email Verification', () => {
    it('creates verification token and sends email verification', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.sendEmailVerification(mockUser.id);
      expect(result.message).toBe('Verification email sent.');
      expect(result.devToken).toBeDefined();

      expect(mockPrisma.emailVerificationToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: mockUser.id,
            email: mockUser.email,
          }),
        }),
      );
      expect(mockMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'EMAIL_VERIFICATION',
          to: mockUser.email,
          idempotencyKey: 'email-verification:ev_token_1',
        }),
      );
    });

    it('verifies email and updates user emailVerifiedAt', async () => {
      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue({
        id: 'ev_1',
        userId: mockUser.id,
        email: mockUser.email,
        usedAt: null,
        expiresAt: new Date(Date.now() + 3600_000),
      });

      const result = await service.verifyEmail('valid_verification_token');
      expect(result).toEqual({ verified: true });

      expect(mockPrisma.emailVerificationToken.update).toHaveBeenCalledWith({
        where: { id: 'ev_1' },
        data: { usedAt: expect.any(Date) },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { emailVerifiedAt: expect.any(Date) },
      });
    });

    it('rejects expired verification token', async () => {
      mockPrisma.emailVerificationToken.findUnique.mockResolvedValue({
        id: 'ev_1',
        userId: mockUser.id,
        email: mockUser.email,
        usedAt: null,
        expiresAt: new Date(Date.now() - 3600_000),
      });

      await expect(service.verifyEmail('expired_token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
