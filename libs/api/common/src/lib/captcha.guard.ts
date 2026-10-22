import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

export const CAPTCHA_HEADER = 'x-captcha-token';

/** siteverify endpoints; all three providers share the same request shape. */
const VERIFY_URLS = {
  turnstile: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
  hcaptcha: 'https://api.hcaptcha.com/siteverify',
  recaptcha: 'https://www.google.com/recaptcha/api/siteverify',
} as const;

type Provider = keyof typeof VERIFY_URLS;

/**
 * Bot protection for public, abuse-prone routes (sign-up, sign-in, password
 * reset, magic links). Apply with `@UseGuards(CaptchaGuard)`.
 *
 * Enabled by setting `CAPTCHA_SECRET_KEY` (+ optional `CAPTCHA_PROVIDER`,
 * default Cloudflare Turnstile). With no secret the guard is a no-op so local
 * dev and e2e keep working; production logs a warning once. Once enabled it
 * fails closed: a missing, invalid or unverifiable token is rejected.
 */
@Injectable()
export class CaptchaGuard implements CanActivate {
  private readonly logger = new Logger(CaptchaGuard.name);
  private warned = false;

  constructor(private readonly config: ConfigService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const secret = this.config.get<string>('CAPTCHA_SECRET_KEY');
    if (!secret) {
      if (!this.warned && this.config.get('NODE_ENV') === 'production') {
        this.warned = true;
        this.logger.warn(
          'CAPTCHA_SECRET_KEY is not set: public auth routes are not bot-protected.',
        );
      }
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers[CAPTCHA_HEADER];
    const token = Array.isArray(header) ? header[0] : header;
    if (!token || token.length > 4096) {
      throw new ForbiddenException('CAPTCHA verification is required.');
    }

    const provider = this.provider();
    const body = new URLSearchParams({ secret, response: token });
    if (request.ip) body.set('remoteip', request.ip);

    let success = false;
    try {
      const res = await fetch(VERIFY_URLS[provider], {
        method: 'POST',
        body,
        signal: AbortSignal.timeout(5_000),
      });
      const data = (await res.json()) as { success?: boolean };
      success = res.ok && data.success === true;
    } catch (error) {
      this.logger.error(
        `CAPTCHA verification unavailable: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }

    if (!success) throw new ForbiddenException('CAPTCHA verification failed.');
    return true;
  }

  private provider(): Provider {
    const value = this.config.get<string>('CAPTCHA_PROVIDER', 'turnstile');
    return value in VERIFY_URLS ? (value as Provider) : 'turnstile';
  }
}
