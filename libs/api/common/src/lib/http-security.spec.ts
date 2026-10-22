import { describe, expect, it, vi } from 'vitest';
import { buildHelmetOptions, httpsRedirect } from './http-security';

function run(req: Record<string, unknown>) {
  const res = {
    redirect: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
  const next = vi.fn();
  httpsRedirect()(req as never, res as never, next);
  return { res, next };
}

describe('httpsRedirect', () => {
  it('passes secure requests through', () => {
    const { next, res } = run({ secure: true, path: '/api/v1/x', method: 'POST' });
    expect(next).toHaveBeenCalled();
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('lets health/ready probes use plain HTTP', () => {
    expect(run({ secure: false, path: '/api/v1/health', method: 'GET' }).next).toHaveBeenCalled();
    expect(run({ secure: false, path: '/api/v1/ready', method: 'GET' }).next).toHaveBeenCalled();
  });

  it('redirects insecure GETs with 308', () => {
    const { res, next } = run({
      secure: false,
      path: '/api/v1/x',
      method: 'GET',
      headers: { host: 'api.example.com' },
      originalUrl: '/api/v1/x?a=1',
    });
    expect(res.redirect).toHaveBeenCalledWith(308, 'https://api.example.com/api/v1/x?a=1');
    expect(next).not.toHaveBeenCalled();
  });

  it('rejects insecure mutating requests with 426', () => {
    const { res, next } = run({
      secure: false,
      path: '/api/v1/auth/login',
      method: 'POST',
      headers: { host: 'api.example.com' },
      originalUrl: '/api/v1/auth/login',
    });
    expect(res.status).toHaveBeenCalledWith(426);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('buildHelmetOptions', () => {
  it('denies framing and enables long-lived HSTS', () => {
    const opts = buildHelmetOptions();
    expect(opts.frameguard).toEqual({ action: 'deny' });
    expect(opts.hsts).toMatchObject({ includeSubDomains: true });
    expect(
      (opts.contentSecurityPolicy as { directives: Record<string, string[]> }).directives['frame-ancestors'],
    ).toEqual(["'none'"]);
  });
});
