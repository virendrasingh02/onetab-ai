import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { hashToken } from '@org/api-common';
import type { MailService } from '@org/api-mail';
import type { PrismaService } from '@org/database';
import * as bcrypt from 'bcrypt';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import type { TokenService } from './token.service.js';
import { generateBase32Secret, generateTotpCode } from './totp.util.js';

describe('AuthService - two-factor sign-in', () => {
  const secret = generateBase32Secret();
  const user = {
    id: 'user_2fa',
    email: 'sam@example.com',
    name: 'Sam',
    displayName: null,
    avatarUrl: null,
    passwordHash: bcrypt.hashSync('correct-horse', 4),
    emailVerifiedAt: new Date(),
    presence: 'OFFLINE',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let prisma: any;
  let tokens: any;
  let service: AuthService;
  let twoFactorRow: any;

  const liveChallenge = (overrides: Record<string, unknown> = {}) => ({
    id: 'ch_1',
    userId: user.id,
    method: 'password',
    expiresAt: new Date(Date.now() + 60_000),
    usedAt: null,
    ...overrides,
  });

  beforeEach(() => {
    twoFactorRow = {
      userId: user.id,
      secret,
      isEnabled: true,
      lastTotpStep: null,
      backupCodes: JSON.stringify([bcrypt.hashSync('AB12-CD34', 4)]),
    };
    prisma = {
      user: {
        findFirst: vi.fn().mockResolvedValue(user),
        update: vi
          .fn()
          .mockImplementation(({ data }) => ({ ...user, ...data })),
        findUniqueOrThrow: vi.fn().mockResolvedValue(user),
      },
      twoFactorAuth: {
        findUnique: vi.fn().mockImplementation(() => twoFactorRow),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn(),
      },
      twoFactorChallenge: {
        create: vi.fn().mockResolvedValue({ id: 'ch_1' }),
        findUnique: vi.fn().mockResolvedValue(liveChallenge()),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    tokens = {
      issueSession: vi.fn().mockResolvedValue({
        tokens: { accessToken: 'access', expiresIn: 900, tokenType: 'Bearer' },
        refreshToken: 'refresh',
      }),
    };
    service = new AuthService(
      prisma as unknown as PrismaService,
      tokens as unknown as TokenService,
      { get: () => undefined } as unknown as ConfigService,
      {} as MailService,
    );
  });

  it('answers a correct password with a challenge, not a session', async () => {
    const result = await service.login({
      email: user.email,
      password: 'correct-horse',
    } as never);

    expect('twoFactor' in result).toBe(true);
    if (!('twoFactor' in result)) return;
    expect(result.twoFactor.requiresTwoFactor).toBe(true);
    expect(prisma.twoFactorChallenge.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: user.id,
        method: 'password',
        tokenHash: hashToken(result.twoFactor.challengeToken),
      }),
    });
    expect(tokens.issueSession).not.toHaveBeenCalled();
  });

  it('signs straight in when two-factor is off', async () => {
    twoFactorRow = { ...twoFactorRow, isEnabled: false };
    const result = await service.login({
      email: user.email,
      password: 'correct-horse',
    } as never);

    expect('twoFactor' in result).toBe(false);
    expect(prisma.twoFactorChallenge.create).not.toHaveBeenCalled();
    expect(tokens.issueSession).toHaveBeenCalled();
  });

  it('issues the session for a current authenticator code and burns its time step', async () => {
    const result = await service.completeTwoFactorLogin({
      challengeToken: 'tok',
      code: generateTotpCode(secret),
    });

    expect(result.user.id).toBe(user.id);
    expect(result.usedRecoveryCode).toBe(false);
    expect(prisma.twoFactorAuth.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { lastTotpStep: expect.any(Number) } }),
    );
    expect(prisma.twoFactorChallenge.updateMany).toHaveBeenLastCalledWith({
      where: { id: 'ch_1', usedAt: null, expiresAt: { gt: expect.any(Date) } },
      data: { usedAt: expect.any(Date) },
    });
    expect(tokens.issueSession).toHaveBeenCalled();
  });

  it('refuses a replayed authenticator code', async () => {
    // The conditional "step must be newer" write matches nothing.
    prisma.twoFactorAuth.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.completeTwoFactorLogin({
        challengeToken: 'tok',
        code: generateTotpCode(secret),
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(tokens.issueSession).not.toHaveBeenCalled();
  });

  it('accepts a recovery code once, in any case or spacing, and removes it', async () => {
    const result = await service.completeTwoFactorLogin({
      challengeToken: 'tok',
      code: ' ab12cd34 ',
    });

    expect(result.usedRecoveryCode).toBe(true);
    expect(prisma.twoFactorAuth.updateMany).toHaveBeenCalledWith({
      where: { userId: user.id, backupCodes: twoFactorRow.backupCodes },
      data: { backupCodes: '[]' },
    });
  });

  it('counts a wrong code and does not sign in', async () => {
    await expect(
      service.completeTwoFactorLogin({
        challengeToken: 'tok',
        code: '000000x',
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(prisma.twoFactorChallenge.updateMany).toHaveBeenCalledWith({
      where: { id: 'ch_1', usedAt: null, attempts: { lt: 5 } },
      data: { attempts: { increment: 1 } },
    });
    expect(tokens.issueSession).not.toHaveBeenCalled();
  });

  it('locks the challenge after too many attempts, before checking the code', async () => {
    prisma.twoFactorChallenge.updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(
      service.completeTwoFactorLogin({
        challengeToken: 'tok',
        code: generateTotpCode(secret),
      }),
    ).rejects.toThrow(/Too many incorrect codes/);
    expect(prisma.twoFactorAuth.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a spent or expired challenge', async () => {
    prisma.twoFactorChallenge.findUnique.mockResolvedValueOnce(
      liveChallenge({ usedAt: new Date() }),
    );
    await expect(
      service.completeTwoFactorLogin({ challengeToken: 'tok', code: '123456' }),
    ).rejects.toThrow(UnauthorizedException);

    prisma.twoFactorChallenge.findUnique.mockResolvedValueOnce(
      liveChallenge({ expiresAt: new Date(Date.now() - 1) }),
    );
    await expect(
      service.completeTwoFactorLogin({ challengeToken: 'tok', code: '123456' }),
    ).rejects.toThrow(/timed out/);
  });

  it('will not turn two-factor off without a password or code', async () => {
    await expect(service.disableTotp(user.id, '', undefined)).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.twoFactorAuth.update).not.toHaveBeenCalled();
  });
});
