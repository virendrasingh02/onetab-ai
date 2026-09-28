import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  assertPublicHttpUrl,
  checkUrlShape,
  createSafeFetch,
  isPrivateOrReservedIp,
  safeFetch,
  UnsafeUrlError,
  type SsrfPolicy,
} from './ssrf.js';

describe('isPrivateOrReservedIp', () => {
  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.5',
    '172.31.255.255',
    '192.168.1.100',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '255.255.255.255',
    '::1',
    '::',
    'fe80::1',
    'fc00::1',
    'fd12:3456::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
    'not-an-ip',
  ])('blocks %s', (ip) => {
    expect(isPrivateOrReservedIp(ip)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '142.250.190.46', '2606:4700:4700::1111'])(
    'allows public %s',
    (ip) => {
      expect(isPrivateOrReservedIp(ip)).toBe(false);
    },
  );
});

describe('checkUrlShape', () => {
  const reasonOf = (raw: string) => {
    try {
      checkUrlShape(raw);
      return null;
    } catch (err) {
      return (err as UnsafeUrlError).reason;
    }
  };

  it('refuses non-http schemes', () => {
    expect(reasonOf('file:///etc/passwd')).toBe('scheme');
    expect(reasonOf('ftp://example.com/x')).toBe('scheme');
    expect(reasonOf('javascript:alert(1)')).toBe('scheme');
  });

  it('refuses unparseable input', () => {
    expect(reasonOf('not a url')).toBe('invalid');
  });

  it('refuses embedded credentials', () => {
    expect(reasonOf('https://user:pass@example.com/')).toBe('credentials');
  });

  it('refuses internal hostnames', () => {
    expect(reasonOf('http://localhost:8080')).toBe('host');
    expect(reasonOf('http://api.localhost/')).toBe('host');
    expect(reasonOf('http://metadata.google.internal/computeMetadata/v1')).toBe('host');
    expect(reasonOf('http://printer.local/')).toBe('host');
  });

  it('refuses private IP literals, including bracketed IPv6', () => {
    expect(reasonOf('http://169.254.169.254/latest/meta-data')).toBe('private');
    expect(reasonOf('http://10.0.0.5/admin')).toBe('private');
    expect(reasonOf('http://[::1]:3000/')).toBe('private');
  });

  it('accepts public URLs', () => {
    expect(reasonOf('https://example.com/path?q=1')).toBeNull();
    expect(reasonOf('http://8.8.8.8/')).toBeNull();
  });
});

describe('assertPublicHttpUrl', () => {
  it('rejects a hostname that does not resolve', async () => {
    await expect(assertPublicHttpUrl('https://no-such-host.invalid-tld-onetab/')).rejects.toMatchObject({
      reason: 'dns',
    });
  });

  it('accepts a public IP literal without a DNS lookup', async () => {
    const url = await assertPublicHttpUrl('http://1.1.1.1/');
    expect(url.hostname).toBe('1.1.1.1');
  });
});

describe('safeFetch', () => {
  it('refuses a private address before connecting', async () => {
    await expect(safeFetch('http://127.0.0.1:9/')).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  describe('against a local server (test policy allows only 127.0.0.1)', () => {
    let server: http.Server;
    let base: string;

    /** Loopback is allowed so the specs can reach their server; 127.0.0.2
     *  stands in for "an internal address" a redirect must not reach. */
    const policy: SsrfPolicy = {
      assertUrl: async (raw) => {
        const url = raw instanceof URL ? raw : new URL(String(raw));
        if (url.hostname !== '127.0.0.1') {
          throw new UnsafeUrlError(`blocked ${url.hostname}`, 'private');
        }
        return url;
      },
      lookup: (hostname, options, callback) =>
        (callback as (e: null, a: string, f: number) => void)(null, '127.0.0.1', 4),
    };
    const fetchLocal = createSafeFetch(policy);

    beforeAll(async () => {
      server = http.createServer((req, res) => {
        if (req.url === '/ok') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ hello: 'world' }));
        } else if (req.url === '/hop') {
          res.writeHead(302, { location: '/ok' });
          res.end();
        } else if (req.url === '/escape') {
          res.writeHead(302, { location: 'http://127.0.0.2/secret' });
          res.end();
        } else if (req.url === '/loop') {
          res.writeHead(302, { location: '/loop' });
          res.end();
        } else if (req.url === '/big') {
          res.writeHead(200);
          res.end('x'.repeat(10_000));
        } else if (req.url === '/echo' && req.method === 'POST') {
          let body = '';
          req.on('data', (c) => (body += c));
          req.on('end', () => {
            res.writeHead(201);
            res.end(body);
          });
        } else {
          res.writeHead(404);
          res.end();
        }
      });
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    });

    afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

    it('returns status, headers and body', async () => {
      const res = await fetchLocal(`${base}/ok`);
      expect(res.ok).toBe(true);
      expect(res.headers['content-type']).toBe('application/json');
      expect(res.json()).toEqual({ hello: 'world' });
    });

    it('follows a redirect that stays allowed', async () => {
      const res = await fetchLocal(`${base}/hop`);
      expect(res.status).toBe(200);
      expect(res.url).toBe(`${base}/ok`);
    });

    it('re-validates each redirect hop and refuses an escape', async () => {
      await expect(fetchLocal(`${base}/escape`)).rejects.toMatchObject({ reason: 'private' });
    });

    it('caps redirect chains', async () => {
      await expect(fetchLocal(`${base}/loop`, { maxRedirects: 3 })).rejects.toMatchObject({
        reason: 'redirect',
      });
    });

    it('truncates oversized bodies instead of buffering them', async () => {
      const res = await fetchLocal(`${base}/big`, { maxBytes: 100 });
      expect(res.truncated).toBe(true);
      expect(res.text()).toHaveLength(100);
    });

    it('sends a request body', async () => {
      const res = await fetchLocal(`${base}/echo`, { method: 'POST', body: 'payload' });
      expect(res.status).toBe(201);
      expect(res.text()).toBe('payload');
    });
  });
});
