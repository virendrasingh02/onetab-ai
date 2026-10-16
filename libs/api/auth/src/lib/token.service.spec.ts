import { UnauthorizedException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TokenService } from './token.service.js';

function build(revokedAgoMs: number | null) {
  const revokedAt = revokedAgoMs === null ? null : new Date(Date.now() - revokedAgoMs);
  const prisma = {
    refreshToken: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'rt1',
        userId: 'u1',
        revokedAt,
        expiresAt: new Date(Date.now() + 60_000),
        user: { id: 'u1', email: 'a@b.test' },
      }),
      create: vi.fn().mockResolvedValue({ id: 'rt2' }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const jwt = { signAsync: vi.fn().mockResolvedValue('access') };
  const config = {
    get: vi.fn((_k: string, d: string) => d),
    getOrThrow: vi.fn(() => 'secret'),
  };
  const service = new TokenService(jwt as never, config as never, prisma as never);
  return { service, prisma };
}

describe('TokenService.rotate reuse grace', () => {
  afterEach(() => vi.restoreAllMocks());

  it('issues a session for a token rotated moments ago, without revoking others', async () => {
    const { service, prisma } = build(2_000);
    const session = await service.rotate('tok');
    expect(session.tokens.accessToken).toBe('access');
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('revokes all sessions when a stale revoked token is replayed', async () => {
    const { service, prisma } = build(60_000);
    await expect(service.rotate('tok')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'u1' }) }),
    );
  });
});
