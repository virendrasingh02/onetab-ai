import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '@org/database';

/** Keep a spent/expired token around this long before deleting it, so a
 *  support question ("did my reset link work?") can still be answered. */
const SPENT_TOKEN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const REVOKED_SESSION_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Hourly cleanup of dead auth rows.
 *
 * Nothing reads an expired reset token or a revoked refresh token — they only
 * accumulate. Before the scheduler existed there was no place to run this
 * (audit §14: "no cleanup of expired tokens"). Deletes are bounded and
 * best-effort: a failed sweep just runs again next hour.
 */
@Injectable()
export class TokenCleanupService {
  private readonly logger = new Logger(TokenCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'auth-token-cleanup' })
  async sweep(): Promise<void> {
    const now = new Date();
    const spentBefore = new Date(now.getTime() - SPENT_TOKEN_RETENTION_MS);
    const revokedBefore = new Date(now.getTime() - REVOKED_SESSION_RETENTION_MS);

    try {
      const [resets, magicLinks, sessions, challenges] = await this.prisma.$transaction([
        this.prisma.passwordResetToken.deleteMany({
          where: {
            OR: [
              { expiresAt: { lt: now } },
              { usedAt: { not: null, lt: spentBefore } },
            ],
          },
        }),
        // A used link expires minutes after it is spent, so the expiry clause
        // must skip it — otherwise the retention window (and the "last signed
        // in with a link" line on the security page) never applies.
        this.prisma.magicLinkToken.deleteMany({
          where: {
            OR: [
              { usedAt: null, expiresAt: { lt: now } },
              { usedAt: { not: null, lt: spentBefore } },
            ],
          },
        }),
        this.prisma.refreshToken.deleteMany({
          where: {
            OR: [
              // Expired: no longer usable for anything.
              { expiresAt: { lt: now } },
              // Revoked long enough ago that it is no longer useful for
              // "where am I signed in?" history.
              { revokedAt: { not: null, lt: revokedBefore } },
            ],
          },
        }),
        // Two-factor challenges live minutes and are worthless once spent.
        this.prisma.twoFactorChallenge.deleteMany({
          where: { expiresAt: { lt: now } },
        }),
      ]);

      if (resets.count || magicLinks.count || sessions.count || challenges.count) {
        this.logger.log(
          `Token cleanup removed ${resets.count} reset token(s), ${magicLinks.count} magic link token(s), ${challenges.count} two-factor challenge(s), and ${sessions.count} stale session(s).`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Token cleanup sweep failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
