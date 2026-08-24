import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, Public, zodBody } from '@org/api-common';
import type { AuthenticatedUser } from '@org/api-common';
import {
  approveDeviceAuthSchema,
  changePasswordSchema,
  createDeviceAuthSchema,
  desktopAuthorizeSchema,
  desktopExchangeSchema,
  exchangeDeviceAuthSchema,
  forgotPasswordSchema,
  loginSchema,
  pollDeviceAuthSchema,
  registerSchema,
  rejectDeviceAuthSchema,
  resetPasswordSchema,
  type ApproveDeviceAuthInput,
  type ChangePasswordInput,
  type CreateDeviceAuthInput,
  type DesktopAuthorizeInput,
  type DesktopExchangeInput,
  type ExchangeDeviceAuthInput,
  type ForgotPasswordInput,
  type LoginInput,
  type PollDeviceAuthInput,
  type RegisterInput,
  type RejectDeviceAuthInput,
  type ResetPasswordInput,
} from '@org/validation';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { DesktopAuthService } from './desktop-auth.service.js';
import { DeviceAuthService } from './device-auth.service.js';
import type { IssuedSession } from './token.service.js';

const REFRESH_COOKIE = 'onetab_rt';

@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly desktopAuth: DesktopAuthService,
    private readonly deviceAuth: DeviceAuthService,
    private readonly config: ConfigService,
  ) {}

  private contextOf(request: Request) {
    return {
      ipAddress: request.ip ?? request.socket?.remoteAddress,
      userAgent: request.headers['user-agent'],
    };
  }

  private setRefreshCookie(response: Response, session: IssuedSession): void {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';

    response.cookie(REFRESH_COOKIE, session.refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/api/v1/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  private clearRefreshCookie(response: Response): void {
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';

    response.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/api/v1/auth',
    });
  }

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
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
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = request.cookies?.[REFRESH_COOKIE];
    const session = await this.auth.refresh(token, this.contextOf(request));
    this.setRefreshCookie(response, session);
    return session.tokens;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const token = request.cookies?.[REFRESH_COOKIE];
    await this.auth.logout(token);
    this.clearRefreshCookie(response);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logoutAll(userId);
    this.clearRefreshCookie(response);
  }

  @Get('me')
  async me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user.id);
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async forgotPassword(
    @Body(zodBody(forgotPasswordSchema)) body: ForgotPasswordInput,
  ) {
    const result = await this.auth.forgotPassword(body);
    return {
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
    this.clearRefreshCookie(response);
  }

  /**
   * Browser-based PKCE authorization initiation for desktop app.
   */
  @Post('desktop/authorize')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async desktopAuthorize(
    @CurrentUser('id') userId: string,
    @Body(zodBody(desktopAuthorizeSchema)) body: DesktopAuthorizeInput,
  ) {
    return this.desktopAuth.generateCode(userId, body);
  }

  /**
   * Authorization code exchange for desktop app using PKCE S256 verification.
   */
  @Public()
  @Post('desktop/exchange')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  async desktopExchange(
    @Body(zodBody(desktopExchangeSchema)) body: DesktopExchangeInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { user, session } = await this.desktopAuth.exchangeCode(
      body,
      this.contextOf(request),
    );
    this.setRefreshCookie(response, session);
    return { user, ...session.tokens, refreshToken: session.refreshToken };
  }

  /* --- mobile device authorization endpoints ----------------------------- */

  /**
   * Desktop client creates a device authorization request (QR & Pairing Code).
   */
  @Public()
  @Post('device/create')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async createDeviceRequest(
    @Body(zodBody(createDeviceAuthSchema)) body: CreateDeviceAuthInput,
    @Req() request: Request,
  ) {
    const webAppUrl =
      this.config.get<string>('WEB_APP_URL') ||
      this.config.get<string>('VITE_WEB_APP_URL') ||
      'http://localhost:4200';
    return this.deviceAuth.createRequest(body, this.contextOf(request), webAppUrl);
  }

  /**
   * Public endpoint to get sanitized device info by requestId or userCode.
   */
  @Public()
  @Get('device/info')
  @HttpCode(HttpStatus.OK)
  async getDeviceInfo(
    @Query('requestId') requestId?: string,
    @Query('code') code?: string,
  ) {
    return this.deviceAuth.getInfo(requestId, code);
  }

  /**
   * Authenticated mobile user approves the device authorization request.
   */
  @Post('device/approve')
  @HttpCode(HttpStatus.OK)
  async approveDevice(
    @CurrentUser() user: AuthenticatedUser,
    @Body(zodBody(approveDeviceAuthSchema)) body: ApproveDeviceAuthInput,
  ) {
    const fullUser = await this.auth.me(user.id);
    return this.deviceAuth.approve(fullUser, body.requestId, body.code);
  }

  /**
   * Mobile user rejects/cancels the device authorization request.
   */
  @Public()
  @Post('device/reject')
  @HttpCode(HttpStatus.OK)
  async rejectDevice(
    @Body(zodBody(rejectDeviceAuthSchema)) body: RejectDeviceAuthInput,
  ) {
    return this.deviceAuth.reject(body.requestId, body.code);
  }

  /**
   * Desktop client polls the status of its active request.
   */
  @Public()
  @Post('device/status')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  async pollDeviceStatus(
    @Body(zodBody(pollDeviceAuthSchema)) body: PollDeviceAuthInput,
  ) {
    return this.deviceAuth.pollStatus(body);
  }

  /**
   * Desktop client exchanges approved request + secretToken for session tokens.
   */
  @Public()
  @Post('device/exchange')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  async exchangeDevice(
    @Body(zodBody(exchangeDeviceAuthSchema)) body: ExchangeDeviceAuthInput,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { user, session } = await this.deviceAuth.exchange(
      body,
      this.contextOf(request),
    );
    this.setRefreshCookie(response, session);
    return { user, ...session.tokens, refreshToken: session.refreshToken };
  }
}
