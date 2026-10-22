import { ForbiddenException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CaptchaGuard } from './captcha.guard';

const ctx = (headers: Record<string, string> = {}) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers, ip: '1.2.3.4' }) }),
  }) as never;

const config = (values: Record<string, string>) =>
  ({ get: (key: string, fallback?: string) => values[key] ?? fallback }) as never;

describe('CaptchaGuard', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is a no-op when no secret is configured', async () => {
    await expect(new CaptchaGuard(config({})).canActivate(ctx())).resolves.toBe(true);
  });

  it('rejects a missing token once enabled', async () => {
    const guard = new CaptchaGuard(config({ CAPTCHA_SECRET_KEY: 's' }));
    await expect(guard.canActivate(ctx())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('accepts a token the provider verifies', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }));
    const guard = new CaptchaGuard(config({ CAPTCHA_SECRET_KEY: 's' }));
    await expect(guard.canActivate(ctx({ 'x-captcha-token': 't' }))).resolves.toBe(true);
  });

  it('rejects a token the provider refuses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: false }) }));
    const guard = new CaptchaGuard(config({ CAPTCHA_SECRET_KEY: 's' }));
    await expect(guard.canActivate(ctx({ 'x-captcha-token': 't' }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('fails closed when the provider is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')));
    const guard = new CaptchaGuard(config({ CAPTCHA_SECRET_KEY: 's' }));
    await expect(guard.canActivate(ctx({ 'x-captcha-token': 't' }))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
