import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
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
  logoutSchema,
  pollDeviceAuthSchema,
  refreshSchema,
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
  type LogoutInput,
  type PollDeviceAuthInput,
  type RefreshInput,
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
    // `refreshToken` in the body as well as the cookie: a browser adding this as
    // a second account cannot keep a cookie for it (only one per browser), so it
    // stores the token itself. Harmless for the plain path — the cookie is what
    // that one reads.
    return { user, ...session.tokens, refreshToken: session.refreshToken };
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
    // See `register` — the body copy is for a browser holding this as a
    // background account alongside another.
    return { user, ...session.tokens, refreshToken: session.refreshToken };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body(zodBody(refreshSchema)) body: RefreshInput,
  ) {
    // An explicit body token wins: a multi-account client sends it to refresh
    // (and switch to) a specific account regardless of which one the browser's
    // single refresh cookie currently holds. Everyone else falls back to that
    // cookie. Either way the rotated token replaces the cookie, so it always
    // tracks the account that was just refreshed — the one becoming active.
    const token = body.refreshToken ?? request.cookies?.[REFRESH_COOKIE];
    const session = await this.auth.refresh(token, this.contextOf(request));
    this.setRefreshCookie(response, session);
    return { ...session.tokens, refreshToken: session.refreshToken };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
    @Body(zodBody(logoutSchema)) body: LogoutInput,
  ): Promise<void> {
    // A specific token in the body means "drop this background account" — revoke
    // it server-side but leave the active account's cookie in place.
    if (body.refreshToken) {
      await this.auth.logout(body.refreshToken);
      return;
    }
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

  @Get('sessions')
  async getSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const refreshToken = request.cookies?.[REFRESH_COOKIE];
    return this.auth.getSessions(user.id, refreshToken, user.sid);
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') sessionId: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.revokeSession(user.id, sessionId);
    if (user.sid === sessionId) {
      this.clearRefreshCookie(response);
    }
  }

  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.OK)
  async revokeOtherSessions(
    @CurrentUser() user: AuthenticatedUser,
    @Req() request: Request,
  ) {
    const refreshToken = request.cookies?.[REFRESH_COOKIE];
    return this.auth.revokeOtherSessions(user.id, refreshToken, user.sid);
  }

  @Get('security-overview')
  async getSecurityOverview(@CurrentUser('id') userId: string) {
    return this.auth.getSecurityOverview(userId);
  }

  @Post('2fa/totp/setup')
  @HttpCode(HttpStatus.OK)
  async setupTotp(@CurrentUser('id') userId: string) {
    return this.auth.setupTotp(userId);
  }

  @Post('2fa/totp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyTotp(
    @CurrentUser('id') userId: string,
    @Body() body: { code: string },
  ) {
    return this.auth.verifyTotp(userId, body.code);
  }

  @Post('2fa/totp/disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disableTotp(
    @CurrentUser('id') userId: string,
    @Body() body: { currentPassword?: string; code?: string },
  ): Promise<void> {
    await this.auth.disableTotp(userId, body.currentPassword, body.code);
  }

  @Post('2fa/recovery-codes/regenerate')
  @HttpCode(HttpStatus.OK)
  async regenerateRecoveryCodes(@CurrentUser('id') userId: string) {
    return this.auth.generateRecoveryCodes(userId);
  }

  @Get('webauthn/credentials')
  async getWebAuthnCredentials(@CurrentUser('id') userId: string) {
    return this.auth.getPasskeys(userId);
  }

  @Post('webauthn/register')
  @HttpCode(HttpStatus.OK)
  async registerWebAuthn(
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      credentialId: string;
      publicKey: string;
      deviceName?: string;
      transports?: string[];
    },
  ) {
    return this.auth.registerPasskey(userId, body);
  }

  @Delete('webauthn/credentials/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteWebAuthn(
    @CurrentUser('id') userId: string,
    @Param('id') credentialId: string,
  ): Promise<void> {
    await this.auth.deletePasskey(userId, credentialId);
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
