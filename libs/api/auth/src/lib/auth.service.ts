import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { expiresAt, generateToken, hashToken } from '@org/api-common';
import { PrismaService } from '@org/database';
import {
  ApiErrorCode,
  type CurrentUser,
  type SecurityOverviewDto,
  type TotpSetupResponse,
  type TotpVerifyResponse,
  type UserSessionDto,
  type WebAuthnCredentialDto,
} from '@org/types';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from '@org/validation';
import * as bcrypt from 'bcrypt';
import { TokenService, type IssuedSession } from './token.service.js';
import {
  generateBase32Secret,
  generateRecoveryCodes,
  verifyTotpToken,
} from './totp.util.js';

const BCRYPT_ROUNDS = 12;
const PASSWORD_RESET_TTL = '1h';

/**
 * A well-formed bcrypt digest of a random string, compared against when the
 * email is unknown. It has to be a real digest: `bcrypt.compare` rejects a
 * malformed hash immediately, which would reintroduce the timing difference
 * this exists to hide.
 */
const UNMATCHABLE_HASH =
  '$2b$12$SnhqiqVsf7JjLwjzc0miE.s0qU9XSG/V835wkvgzGd5I5KQ3Ib9QC';

export interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
  ) {}

  async register(
    input: RegisterInput,
    context: SessionContext = {},
  ): Promise<{ user: CurrentUser; session: IssuedSession }> {
    const existing = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException({
        code: ApiErrorCode.CONFLICT,
        message: 'An account with that email already exists.',
        errors: { email: ['An account with that email already exists.'] },
      });
    }

    const user = await this.prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
      },
    });

    const session = await this.tokens.issueSession(user, context);
    return { user: toCurrentUser(user), session };
  }

  async login(
    input: LoginInput,
    context: SessionContext = {},
  ): Promise<{ user: CurrentUser; session: IssuedSession }> {
    const identifier = input.email.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: identifier, mode: 'insensitive' } },
          { email: { startsWith: `${identifier}@`, mode: 'insensitive' } },
          { name: { equals: identifier, mode: 'insensitive' } },
          { displayName: { equals: identifier, mode: 'insensitive' } },
        ],
      },
    });

    // Always run a hash comparison, even when the account is unknown, so the
    // response time does not reveal whether an email is registered.
    const valid = await bcrypt.compare(
      input.password,
      user?.passwordHash ?? UNMATCHABLE_HASH,
    );

    if (!user || !valid) {
      throw new UnauthorizedException({
        code: ApiErrorCode.INVALID_CREDENTIALS,
        message: 'Incorrect email or password.',
      });
    }

    const signedIn = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date(), presence: 'ONLINE' },
    });

    const session = await this.tokens.issueSession(signedIn, context);
    return { user: toCurrentUser(signedIn), session };
  }

  async logout(refreshToken: string | undefined, userId?: string): Promise<void> {
    if (refreshToken) {
      try {
        await this.tokens.revoke(refreshToken);
      } catch {
        // ignore
      }
    }
    if (userId) {
      try {
        await this.prisma.user.update({
          where: { id: userId },
          data: { presence: 'OFFLINE', lastSeenAt: new Date() },
        });
      } catch {
        // ignore
      }
    }
  }

  /** Revokes every refresh token for a user, ending all of their sessions. */
  async logoutAll(userId: string): Promise<void> {
    await this.tokens.revokeAllForUser(userId);
    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: { presence: 'OFFLINE', lastSeenAt: new Date() },
      });
    } catch {
      // ignore
    }
  }

  async refresh(
    refreshToken: string | undefined,
    context: SessionContext = {},
  ): Promise<IssuedSession> {
    if (!refreshToken) {
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHORIZED,
        message: 'No refresh token was provided.',
      });
    }
    try {
      return await this.tokens.rotate(refreshToken, context);
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHORIZED,
        message: 'Invalid or expired session token.',
      });
    }
  }

  async me(userId: string): Promise<CurrentUser> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    // The token verified, but the account behind it is gone — a deleted user
    // holding a still-valid access token. Treat it as no session at all.
    if (!user) {
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHORIZED,
        message: 'Your account is no longer available.',
      });
    }

    return toCurrentUser(user);
  }

  /**
   * Issues a password-reset token.
   *
   * Always resolves successfully, whether or not the address exists — the
   * response must not be an account-existence oracle. The token is returned to
   * the caller only outside production, where there is no mail transport yet.
   */
  async forgotPassword(
    input: ForgotPasswordInput,
  ): Promise<{ devToken?: string }> {
    const identifier = input.email.trim();
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: identifier, mode: 'insensitive' } },
          { email: { startsWith: `${identifier}@`, mode: 'insensitive' } },
          { name: { equals: identifier, mode: 'insensitive' } },
          { displayName: { equals: identifier, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });

    if (!user) return {};

    const token = generateToken(32);
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: expiresAt(PASSWORD_RESET_TTL),
      },
    });

    // TODO(phase-3): hand off to the mail transport instead of logging.
    this.logger.log(`Password reset requested for ${input.email}`);

    return this.config.get('NODE_ENV') === 'production'
      ? {}
      : { devToken: token };
  }

  async resetPassword(input: ResetPasswordInput): Promise<void> {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(input.token) },
    });

    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        code: ApiErrorCode.TOKEN_EXPIRED,
        message: 'This reset link is invalid or has expired.',
      });
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: record.userId },
        data: {
          passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
        },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      // A password change must end every existing session.
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  async changePassword(
    userId: string,
    input: ChangePasswordInput,
  ): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });

    if (!(await bcrypt.compare(input.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException({
        code: ApiErrorCode.INVALID_CREDENTIALS,
        message: 'Your current password is incorrect.',
        errors: { currentPassword: ['Your current password is incorrect.'] },
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS) },
    });
    await this.tokens.revokeAllForUser(userId);
  }

  async getSessions(
    userId: string,
    currentRefreshToken?: string,
    currentSessionId?: string,
  ): Promise<UserSessionDto[]> {
    return this.tokens.listSessionsForUser(userId, currentRefreshToken, currentSessionId);
  }

  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const revoked = await this.tokens.revokeSessionById(userId, sessionId);
    if (!revoked) {
      throw new NotFoundException('Session not found or already revoked.');
    }
  }

  async revokeOtherSessions(
    userId: string,
    currentRefreshToken?: string,
    currentSessionId?: string,
  ): Promise<{ revokedCount: number }> {
    const count = await this.tokens.revokeOtherSessionsForUser(
      userId,
      currentRefreshToken,
      currentSessionId,
    );
    return { revokedCount: count };
  }

  async getSecurityOverview(userId: string): Promise<SecurityOverviewDto> {
    const [user, twoFactor, passkeysCount, activeSessionsCount, ssoConfig] =
      await Promise.all([
        this.prisma.user.findUniqueOrThrow({
          where: { id: userId },
          select: { createdAt: true, updatedAt: true, passwordHash: true },
        }),
        this.prisma.twoFactorAuth.findUnique({
          where: { userId },
        }),
        this.prisma.webAuthnCredential.count({
          where: { userId },
        }),
        this.prisma.refreshToken.count({
          where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
        }),
        this.prisma.sSOConfig.findFirst({
          where: { isActive: true },
        }),
      ]);

    const hasBackupCodes = Boolean(
      twoFactor?.backupCodes &&
        twoFactor.backupCodes !== '[]' &&
        JSON.parse(twoFactor.backupCodes).length > 0,
    );

    return {
      password: {
        hasPassword: Boolean(user.passwordHash),
        strength: 'strong',
        createdAt: user.createdAt.toISOString(),
        lastChangedAt: user.updatedAt.toISOString(),
      },
      twoFactor: {
        isEnabled: Boolean(twoFactor?.isEnabled),
        verifiedAt: twoFactor?.verifiedAt?.toISOString() ?? null,
        hasBackupCodes,
        isEnforced: false,
      },
      sso: {
        isConnected: Boolean(ssoConfig),
        providerType: ssoConfig?.providerType ?? null,
        isOrganizationManaged: Boolean(ssoConfig),
      },
      passkeysCount,
      activeSessionsCount,
    };
  }

  async setupTotp(userId: string): Promise<TotpSetupResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });

    const secret = generateBase32Secret(20);
    const appName = 'OneTab';
    const qrCodeUri = `otpauth://totp/${encodeURIComponent(appName)}:${encodeURIComponent(user.email)}?secret=${secret}&issuer=${encodeURIComponent(appName)}`;

    await this.prisma.twoFactorAuth.upsert({
      where: { userId },
      create: {
        userId,
        secret,
        isEnabled: false,
      },
      update: {
        secret,
        isEnabled: false,
        verifiedAt: null,
      },
    });

    return { secret, qrCodeUri };
  }

  async verifyTotp(userId: string, code: string): Promise<TotpVerifyResponse> {
    const twoFactor = await this.prisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (!twoFactor || !twoFactor.secret) {
      throw new BadRequestException('Two-factor setup has not been initiated.');
    }

    const isValid = verifyTotpToken(twoFactor.secret, code);
    if (!isValid) {
      throw new BadRequestException('Invalid verification code. Please try again.');
    }

    const backupCodes = generateRecoveryCodes(8);
    const hashedCodes = await Promise.all(
      backupCodes.map((c) => bcrypt.hash(c, BCRYPT_ROUNDS)),
    );

    await this.prisma.twoFactorAuth.update({
      where: { userId },
      data: {
        isEnabled: true,
        verifiedAt: new Date(),
        backupCodes: JSON.stringify(hashedCodes),
      },
    });

    return {
      backupCodes,
      message: 'Two-factor authentication has been enabled successfully.',
    };
  }

  async disableTotp(
    userId: string,
    currentPassword?: string,
    code?: string,
  ): Promise<void> {
    const twoFactor = await this.prisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (!twoFactor || !twoFactor.isEnabled) {
      return;
    }

    if (currentPassword) {
      const user = await this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { passwordHash: true },
      });
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        throw new UnauthorizedException('Current password is incorrect.');
      }
    } else if (code) {
      const valid = verifyTotpToken(twoFactor.secret, code);
      if (!valid) {
        throw new BadRequestException('Invalid authentication code.');
      }
    }

    await this.prisma.twoFactorAuth.update({
      where: { userId },
      data: {
        isEnabled: false,
        verifiedAt: null,
        backupCodes: '[]',
      },
    });
  }

  async generateRecoveryCodes(userId: string): Promise<{ codes: string[] }> {
    const twoFactor = await this.prisma.twoFactorAuth.findUnique({
      where: { userId },
    });

    if (!twoFactor || !twoFactor.isEnabled) {
      throw new BadRequestException('Two-factor authentication is not enabled.');
    }

    const plainCodes = generateRecoveryCodes(8);
    const hashedCodes = await Promise.all(
      plainCodes.map((c) => bcrypt.hash(c, BCRYPT_ROUNDS)),
    );

    await this.prisma.twoFactorAuth.update({
      where: { userId },
      data: {
        backupCodes: JSON.stringify(hashedCodes),
      },
    });

    return { codes: plainCodes };
  }

  async getPasskeys(userId: string): Promise<WebAuthnCredentialDto[]> {
    const creds = await this.prisma.webAuthnCredential.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    return creds.map((c) => ({
      id: c.id,
      credentialId: c.credentialId,
      deviceName: c.deviceName,
      createdAt: c.createdAt.toISOString(),
      lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
    }));
  }

  async registerPasskey(
    userId: string,
    input: { credentialId: string; publicKey: string; deviceName?: string; transports?: string[] },
  ): Promise<WebAuthnCredentialDto> {
    const cred = await this.prisma.webAuthnCredential.create({
      data: {
        userId,
        credentialId: input.credentialId,
        publicKey: input.publicKey,
        deviceName: input.deviceName || 'Security Key / Passkey',
        transports: JSON.stringify(input.transports ?? []),
      },
    });

    return {
      id: cred.id,
      credentialId: cred.credentialId,
      deviceName: cred.deviceName,
      createdAt: cred.createdAt.toISOString(),
      lastUsedAt: null,
    };
  }

  async deletePasskey(userId: string, credentialId: string): Promise<void> {
    await this.prisma.webAuthnCredential.deleteMany({
      where: {
        userId,
        OR: [{ id: credentialId }, { credentialId }],
      },
    });
  }
}

/** Strips credentials and normalises dates for transport. */
export function toCurrentUser(user: {
  id: string;
  email: string;
  name: string;
  displayName: string | null;
  avatarUrl: string | null;
  bio: string | null;
  timezone: string;
  systemRole: string;
  presence: string;
  statusText?: string | null;
  statusEmoji?: string | null;
  statusExpiresAt?: Date | null;
  emailVerifiedAt: Date | null;
  lastSeenAt: Date | null;
  createdAt: Date;
}): CurrentUser {
  const isExpired =
    user.statusExpiresAt && new Date(user.statusExpiresAt) < new Date();

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    timezone: user.timezone,
    systemRole: user.systemRole as CurrentUser['systemRole'],
    presence: user.presence as CurrentUser['presence'],
    statusText: isExpired ? null : user.statusText ?? null,
    statusEmoji: isExpired ? null : user.statusEmoji ?? null,
    statusExpiresAt: isExpired
      ? null
      : (user.statusExpiresAt?.toISOString() ?? null),
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
