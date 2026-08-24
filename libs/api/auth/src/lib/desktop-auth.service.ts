import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
import { generateToken } from '@org/api-common';
import { PrismaService } from '@org/database';
import { ApiErrorCode, type CurrentUser } from '@org/types';
import type { DesktopAuthorizeInput, DesktopExchangeInput } from '@org/validation';
import { toCurrentUser, type SessionContext } from './auth.service.js';
import { TokenService, type IssuedSession } from './token.service.js';

interface PendingDesktopAuth {
  userId: string;
  codeChallenge: string;
  state: string;
  expiresAt: number;
}

const AUTH_CODE_TTL_MS = 60_000; // 60 seconds

@Injectable()
export class DesktopAuthService {
  private readonly logger = new Logger(DesktopAuthService.name);
  private readonly pendingCodes = new Map<string, PendingDesktopAuth>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {
    // Periodically prune expired codes
    setInterval(() => this.pruneExpired(), 30_000).unref();
  }

  /**
   * Generates a one-time short-lived authorization code tied to the authenticated user and PKCE challenge.
   */
  async generateCode(
    userId: string,
    input: DesktopAuthorizeInput,
  ): Promise<{ code: string; state: string }> {
    const code = generateToken(32);
    const expiresAt = Date.now() + AUTH_CODE_TTL_MS;

    this.pendingCodes.set(code, {
      userId,
      codeChallenge: input.codeChallenge,
      state: input.state,
      expiresAt,
    });

    this.logger.debug(`Generated desktop auth code for user ${userId}`);
    return { code, state: input.state };
  }

  /**
   * Exchanges authorization code and PKCE code_verifier for an authenticated desktop session.
   */
  async exchangeCode(
    input: DesktopExchangeInput,
    context: SessionContext = {},
  ): Promise<{ user: CurrentUser; session: IssuedSession }> {
    const pending = this.pendingCodes.get(input.code);

    if (!pending) {
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHORIZED,
        message: 'Invalid, already used, or expired authorization code.',
      });
    }

    // One-time use: remove immediately to prevent replay
    this.pendingCodes.delete(input.code);

    if (Date.now() > pending.expiresAt) {
      throw new UnauthorizedException({
        code: ApiErrorCode.TOKEN_EXPIRED,
        message: 'Authorization code has expired. Please sign in again.',
      });
    }

    if (pending.state !== input.state) {
      throw new BadRequestException({
        code: ApiErrorCode.VALIDATION_ERROR,
        message: 'State mismatch in desktop authentication callback.',
      });
    }

    // Verify PKCE code_verifier against code_challenge (RFC 7636 S256)
    const computedChallenge = createHash('sha256')
      .update(input.codeVerifier)
      .digest('base64url');

    const expectedBuffer = Buffer.from(pending.codeChallenge);
    const computedBuffer = Buffer.from(computedChallenge);

    const matches =
      expectedBuffer.length === computedBuffer.length &&
      timingSafeEqual(expectedBuffer, computedBuffer);

    if (!matches) {
      this.logger.warn(`PKCE challenge verification failed for desktop exchange`);
      throw new UnauthorizedException({
        code: ApiErrorCode.INVALID_CREDENTIALS,
        message: 'PKCE challenge verification failed.',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: pending.userId },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: ApiErrorCode.UNAUTHORIZED,
        message: 'User account no longer exists.',
      });
    }

    const signedIn = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastSeenAt: new Date(), presence: 'ONLINE' },
    });

    const session = await this.tokens.issueSession(signedIn, {
      ...context,
      userAgent: context.userAgent ? `Desktop-Shell ${context.userAgent}` : 'Desktop-Shell',
    });

    this.logger.log(`Desktop auth code exchanged successfully for user ${user.id}`);
    return { user: toCurrentUser(signedIn), session };
  }

  private pruneExpired(): void {
    const now = Date.now();
    for (const [code, entry] of this.pendingCodes.entries()) {
      if (now > entry.expiresAt) {
        this.pendingCodes.delete(code);
      }
    }
  }
}
