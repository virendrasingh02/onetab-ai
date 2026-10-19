import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { expiresAt, generateToken, hashToken, parseDuration } from '@org/api-common';
import { PrismaService } from '@org/database';
import type { AuthTokens, UserSessionDto } from '@org/types';

export interface AccessTokenPayload {
  /** Subject — the user id. */
  sub: string;
  email: string;
  sid?: string;
}

export interface IssuedSession {
  tokens: AuthTokens;
  /** Opaque refresh token; goes into an httpOnly cookie, never a JSON body. */
  refreshToken: string;
  refreshExpiresAt: Date;
  sessionId?: string;
}

interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}

export function parseUserAgent(uaString?: string | null): {
  browser: string;
  os: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
} {
  if (!uaString) {
    return { browser: 'Web Browser', os: 'Unknown OS', deviceType: 'desktop' };
  }

  const ua = uaString.toLowerCase();

  // Device Type
  let deviceType: 'desktop' | 'mobile' | 'tablet' = 'desktop';
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) {
    deviceType = 'tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|iemobile|opera mini/i.test(ua)) {
    deviceType = 'mobile';
  }

  // OS
  let os = 'Unknown OS';
  if (/macintosh|mac os x/i.test(ua)) {
    os = 'macOS';
  } else if (/windows|win32|win64/i.test(ua)) {
    os = 'Windows';
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = 'iOS';
  } else if (/android/i.test(ua)) {
    os = 'Android';
  } else if (/cros/i.test(ua)) {
    os = 'ChromeOS';
  } else if (/linux/i.test(ua)) {
    os = 'Linux';
  }

  // Browser
  let browser = 'Browser';
  if (/edg\//i.test(ua)) {
    browser = 'Microsoft Edge';
  } else if (/opr\/|opera/i.test(ua)) {
    browser = 'Opera';
  } else if (/arc\//i.test(ua)) {
    browser = 'Arc';
  } else if (/brave/i.test(ua)) {
    browser = 'Brave';
  } else if (/chrome|crios/i.test(ua)) {
    browser = 'Chrome';
  } else if (/firefox|fxios/i.test(ua)) {
    browser = 'Firefox';
  } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
    browser = 'Safari';
  } else if (/electron/i.test(ua)) {
    browser = 'Desktop App';
  }

  return { browser, os, deviceType };
}

export function parseLocation(ip?: string | null): string {
  if (!ip) return 'Unknown Location';
  const cleanIp = ip.replace('::ffff:', '');
  if (
    cleanIp === '127.0.0.1' ||
    cleanIp === '::1' ||
    cleanIp.startsWith('192.168.') ||
    cleanIp.startsWith('10.') ||
    cleanIp === 'localhost'
  ) {
    return 'Local Network';
  }
  return 'Active Region';
}

/**
 * Issues and rotates the token pair.
 *
 * Access tokens are stateless JWTs kept deliberately short-lived. Refresh
 * tokens are opaque, stored only as a SHA-256 digest, and rotated on every
 * use — presenting a token that was already exchanged means it leaked, so the
 * whole session family is revoked.
 */
/** How long a just-rotated refresh token may still be exchanged (concurrent cross-app refresh). */
const REFRESH_REUSE_GRACE_MS = 10_000;
/** A rotation writes its successor within this long of revoking the old row. */
const ROTATION_SUCCESSOR_WINDOW_MS = 5_000;

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
    // Rotation on use slides this forward, so it bounds idle time rather than
    // session length: an app opened inside the window never asks for a password.
    return this.config.get<string>('JWT_REFRESH_TTL', '30d');
  }

  async issueSession(
    user: { id: string; email: string },
    context: SessionContext = {},
  ): Promise<IssuedSession> {
    const refreshToken = generateToken();
    const refreshExpiresAt = expiresAt(this.refreshTtl);

    // Create the DB refresh token row first so we have the stable session ID
    const sessionRow = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: refreshExpiresAt,
        userAgent: context.userAgent?.slice(0, 255),
        ipAddress: context.ipAddress?.slice(0, 45),
      },
    });

    const payload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      sid: sessionRow.id,
    };

    const expiresInSeconds = Math.floor(parseDuration(this.accessTtl) / 1000);

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: expiresInSeconds,
    });

    return {
      tokens: {
        accessToken,
        expiresIn: expiresInSeconds,
        tokenType: 'Bearer',
      },
      refreshToken,
      refreshExpiresAt,
      sessionId: sessionRow.id,
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
      // Two apps sharing the refresh cookie (web :4200, Studio :4202) can
      // present the same token a moment apart; they have separate Web Lock
      // scopes, so the loser is a benign race, not a replay. Within a short
      // grace window, treat it as a rotation instead of a theft.
      if (Date.now() - existing.revokedAt.getTime() <= REFRESH_REUSE_GRACE_MS) {
        // Only a *rotated* token earns the grace. One revoked by sign-out or
        // "end session" has no successor, and must stay dead — otherwise a
        // token captured before sign-out could mint a fresh session for the
        // next few seconds. Rejecting it is enough: the session is already over.
        if (await this.hasRotationSuccessor(existing.userId, existing.id, existing.revokedAt)) {
          return this.issueSession(existing.user, context);
        }
        throw new UnauthorizedException('Refresh token has been revoked.');
      }
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

  /**
   * Whether `revokedAt` was a rotation: `rotate` revokes the old row and then
   * immediately issues its successor, so a rotation leaves a newer row for the
   * same user created right after. Explicit revocations never create one.
   */
  private async hasRotationSuccessor(
    userId: string,
    revokedId: string,
    revokedAt: Date,
  ): Promise<boolean> {
    const successor = await this.prisma.refreshToken.findFirst({
      where: {
        userId,
        id: { not: revokedId },
        createdAt: {
          gte: revokedAt,
          lte: new Date(revokedAt.getTime() + ROTATION_SUCCESSOR_WINDOW_MS),
        },
      },
      select: { id: true },
    });
    return successor !== null;
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

  /**
   * List all active non-revoked sessions for the given user, indicating the current session.
   */
  async listSessionsForUser(
    userId: string,
    currentRefreshToken?: string,
    currentSessionId?: string,
  ): Promise<UserSessionDto[]> {
    const rows = await this.prisma.refreshToken.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    const currentHash = currentRefreshToken ? hashToken(currentRefreshToken) : null;

    let hasCurrent = false;
    const sessions = rows.map((row) => {
      const isCurr = Boolean(
        (currentHash && row.tokenHash === currentHash) ||
          (currentSessionId && row.id === currentSessionId),
      );
      if (isCurr) hasCurrent = true;

      const ua = parseUserAgent(row.userAgent);
      return {
        id: row.id,
        userAgent: row.userAgent,
        browser: ua.browser,
        os: ua.os,
        deviceType: ua.deviceType,
        ipAddress: row.ipAddress ? row.ipAddress.replace('::ffff:', '') : null,
        location: parseLocation(row.ipAddress),
        createdAt: row.createdAt.toISOString(),
        lastActiveAt: row.createdAt.toISOString(),
        isCurrent: isCurr,
      };
    });

    // If no explicit token matched (e.g. Bearer auth without cookie), mark first as current
    if (!hasCurrent && sessions.length > 0) {
      sessions[0].isCurrent = true;
    }

    return sessions;
  }

  /**
   * Revoke an individual session by its session ID.
   */
  async revokeSessionById(userId: string, sessionId: string): Promise<boolean> {
    const res = await this.prisma.refreshToken.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return res.count > 0;
  }

  /**
   * Revoke all other active sessions for this user, preserving the current session.
   */
  async revokeOtherSessionsForUser(
    userId: string,
    currentRefreshToken?: string,
    currentSessionId?: string,
  ): Promise<number> {
    let keepSessionId = currentSessionId;
    if (!keepSessionId && currentRefreshToken) {
      const match = await this.prisma.refreshToken.findUnique({
        where: { tokenHash: hashToken(currentRefreshToken) },
      });
      keepSessionId = match?.id;
    }

    if (!keepSessionId) {
      // Find latest session
      const latest = await this.prisma.refreshToken.findFirst({
        where: { userId, revokedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      keepSessionId = latest?.id;
    }

    const res = await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        ...(keepSessionId ? { id: { not: keepSessionId } } : {}),
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return res.count;
  }

  /** Housekeeping for expired/revoked rows; safe to run on a schedule. */
  async pruneExpired(): Promise<number> {
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return count;
  }
}
