import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({ app: { isPackaged: true, getPath: vi.fn(() => '/mock/logs') } }));

const { sanitize, serializeMeta } = await import('./logger.js');

describe('serializeMeta', () => {
  it('keeps what an Error says instead of writing {}', () => {
    const text = serializeMeta(new TypeError('callback was called twice'));
    expect(text).toContain('"name":"TypeError"');
    expect(text).toContain('callback was called twice');
  });

  it('keeps errors nested in an object', () => {
    expect(serializeMeta({ url: '/x', cause: new Error('boom') })).toContain('boom');
  });

  it('does not throw on a circular structure', () => {
    const loop: Record<string, unknown> = {};
    loop['self'] = loop;
    expect(() => serializeMeta(loop)).not.toThrow();
  });
});

describe('sanitize', () => {
  it('redacts the value and keeps the name — never the other way round', () => {
    const line = sanitize('Dispatching deep link: /auth/callback?code=Abc123_-xyz&state=s1');
    expect(line).toBe('Dispatching deep link: /auth/callback?code=[REDACTED]&state=s1');
    expect(line).not.toContain('Abc123');
  });

  it('covers every secret-bearing query key, in any case', () => {
    for (const key of ['token', 'Authorization', 'PASSWORD', 'secret', 'key', 'verifier']) {
      const line = sanitize(`GET /x?${key}=hunter2&ok=1`);
      expect(line).not.toContain('hunter2');
      expect(line).toContain('ok=1');
    }
  });

  it('does not touch a longer word that merely ends in a secret key name', () => {
    expect(sanitize('monkey=banana')).toBe('monkey=banana');
  });

  it('redacts bearer headers and JSON token fields', () => {
    expect(sanitize('Authorization failed for Bearer eyJhbGciOi.abc-def_ghi==')).toBe(
      'Authorization failed for Bearer [REDACTED]',
    );
    const json = sanitize(JSON.stringify({ accessToken: 'a.b.c', refreshToken: 'r', user: 'u' }));
    expect(json).not.toContain('a.b.c');
    expect(json).toContain('"user":"u"');
  });
});
