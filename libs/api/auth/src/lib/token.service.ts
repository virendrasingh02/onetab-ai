import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { expiresAt, generateToken, hashToken, parseDuration } from '@org/api-common';
import { PrismaService } from '@org/database';
import type { AuthTokens } from '@org/types';

export interface AccessTokenPayload {
  /** Subject — the user id. */
  sub: string;
  email: string;
}

export interface IssuedSession {
  tokens: AuthTokens;
  /** Opaque refresh token; goes into an httpOnly cookie, never a JSON body. */
  refreshToken: string;
  refreshExpiresAt: Date;
}

interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}

/**
 * Issues and rotates the token pair.
 *
 * Access tokens are stateless JWTs kept deliberately short-lived. Refresh
 * tokens are opaque, stored only as a SHA-256 digest, and rotated on every
 * use — presenting a token that was already exchanged means it leaked, so the
 * whole session family is revoked.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private get accessTtl(): string {
    return this.config.get<string>('JWT_ACCESS_TTL', '15m');
  }

  private get refreshTtl(): string {
    return this.config.get<string>('JWT_REFRESH_TTL', '7d');
  }

  async issueSession(
    user: { id: string; email: string },
    context: SessionContext = {},
  ): Promise<IssuedSession> {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email };

    // Seconds rather than the duration string: `expiresIn` is typed against
    // the `ms` package's template-literal union, which a plain `string` from
    // config does not satisfy.
    const expiresInSeconds = Math.floor(parseDuration(this.accessTtl) / 1000);

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: expiresInSeconds,
    });

    const refreshToken = generateToken();
    const refreshExpiresAt = expiresAt(this.refreshTtl);

    // Not best-effort: a refresh token with no row behind it is indistinguishable
    // from a forged one, so the session would die at the first rotation. Fail the
    // sign-in instead of handing back a cookie that cannot work.
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshExpiresAt,
        userAgent: context.userAgent?.slice(0, 255),
        ipAddress: context.ipAddress?.slice(0, 45),
      },
    });

    return {
      tokens: {
        accessToken,
        expiresIn: expiresInSeconds,
        tokenType: 'Bearer',
      },
      refreshToken,
      refreshExpiresAt,
    };
  }

  /** Exchanges a refresh token for a new pair, invalidating the old one. */
  async rotate(
    refreshToken: string,
    context: SessionContext = {},
  ): Promise<IssuedSession> {
    const existing = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!existing) {
      throw new UnauthorizedException('Invalid refresh token.');
    }

    if (existing.revokedAt) {
      // A revoked token being replayed means it was captured after rotation.
      // Drop every session for this user rather than just this one.
      await this.revokeAllForUser(existing.userId);
      throw new UnauthorizedException(
        'Refresh token has already been used. All sessions were revoked.',
      );
    }

    if (existing.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token has expired.');
    }

    await this.prisma.refreshToken.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    return this.issueSession(existing.user, context);
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: hashToken(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Housekeeping for expired/revoked rows; safe to run on a schedule. */
  async pruneExpired(): Promise<number> {
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return count;
  }
}
