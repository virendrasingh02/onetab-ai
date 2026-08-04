import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { expiresAt, generateToken, hashToken } from '@org/api-common';
import { PrismaService } from '@org/database';
import { ApiErrorCode, type CurrentUser } from '@org/types';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from '@org/validation';
import * as bcrypt from 'bcrypt';
import { TokenService, type IssuedSession } from './token.service.js';

const BCRYPT_ROUNDS = 12;
const PASSWORD_RESET_TTL = '1h';

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
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
    });

    // Always run a hash comparison, even when the account is unknown, so the
    // response time does not reveal whether an email is registered.
    const passwordHash =
      user?.passwordHash ?? '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidin';
    const valid = await bcrypt.compare(input.password, passwordHash);

    if (!user || !valid) {
      throw new UnauthorizedException({
        code: ApiErrorCode.INVALID_CREDENTIALS,
        message: 'Incorrect email or password.',
      });
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date(), presence: 'ONLINE' },
    });

    const session = await this.tokens.issueSession(user, context);
    return { user: toCurrentUser(user), session };
  }

  async logout(refreshToken: string | undefined, userId?: string): Promise<void> {
    if (refreshToken) await this.tokens.revoke(refreshToken);
    if (userId) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { presence: 'OFFLINE', lastSeenAt: new Date() },
      });
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
    return this.tokens.rotate(refreshToken, context);
  }

  async me(userId: string): Promise<CurrentUser> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
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
    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
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
  emailVerifiedAt: Date | null;
  lastSeenAt: Date | null;
  createdAt: Date;
}): CurrentUser {
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
    emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
    lastSeenAt: user.lastSeenAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}
