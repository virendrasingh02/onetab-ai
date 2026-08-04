import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Public, zodBody } from '@org/api-common';
import type { AuthenticatedUser } from '@org/api-common';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type ChangePasswordInput,
  type ForgotPasswordInput,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
} from '@org/validation';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import type { IssuedSession } from './token.service.js';

const REFRESH_COOKIE = 'onetab_rt';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  /**
   * The refresh token is set as an httpOnly cookie and never returned in a
   * body, so XSS cannot read it. The short-lived access token stays in memory
   * on the client.
   */
  private setRefreshCookie(response: Response, session: IssuedSession): void {
    const isProduction = this.config.get('NODE_ENV') === 'production';
    response.cookie(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      expires: session.refreshExpiresAt,
      path: '/api/v1/auth',
    });
  }

  private clearRefreshCookie(response: Response): void {
    response.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
  }

  private contextOf(request: Request) {
    return {
      userAgent: request.get('user-agent') ?? undefined,
      ipAddress: request.ip,
    };
  }

  @Public()
  @Post('register')
  // 10/min per IP: enough headroom for a shared corporate NAT (and for the e2e
  // suite) while still throttling automated signup abuse.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async register(
    @Body(zodBody(registerSchema)) body: RegisterInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { user, session } = await this.auth.register(
      body,
      this.contextOf(request),
    );
    this.setRefreshCookie(response, session);
    return { user, ...session.tokens };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(
    @Body(zodBody(loginSchema)) body: LoginInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { user, session } = await this.auth.login(
      body,
      this.contextOf(request),
    );
    this.setRefreshCookie(response, session);
    return { user, ...session.tokens };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const session = await this.auth.refresh(
      request.cookies?.[REFRESH_COOKIE],
      this.contextOf(request),
    );
    this.setRefreshCookie(response, session);
    return session.tokens;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser('id') userId: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(request.cookies?.[REFRESH_COOKIE], userId);
    this.clearRefreshCookie(response);
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: 300_000 } })
  async forgotPassword(
    @Body(zodBody(forgotPasswordSchema)) body: ForgotPasswordInput,
  ) {
    const result = await this.auth.forgotPassword(body);
    return {
      // Deliberately identical whether or not the account exists.
      message:
        'If an account exists for that address, a reset link is on its way.',
      ...result,
    };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 5, ttl: 300_000 } })
  async resetPassword(
    @Body(zodBody(resetPasswordSchema)) body: ResetPasswordInput,
  ): Promise<void> {
    await this.auth.resetPassword(body);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body(zodBody(changePasswordSchema)) body: ChangePasswordInput,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.changePassword(userId, body);
    // Every session was revoked, so the current cookie is now dead too.
    this.clearRefreshCookie(response);
  }
}
