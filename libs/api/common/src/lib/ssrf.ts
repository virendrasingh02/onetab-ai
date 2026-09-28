/**
 * The one server-side request forgery guard.
 *
 * Any URL a workspace member, an integration config, or a model's tool call
 * can influence must be fetched through here: `http://169.254.169.254/…`
 * (cloud metadata), `http://localhost:5432` (the database) or
 * `http://10.0.0.5/admin` (an internal service) are otherwise one request
 * away. There used to be three separate guards (automations' literal-only
 * check, integrations' `SSRFGuardService`, link preview's own) with different
 * blocklists and different redirect handling; they now all share this.
 *
 * Three layers, each closing a gap the previous one leaves:
 *  1. `checkUrlShape` — scheme, embedded credentials, internal hostnames and
 *     private IP literals, synchronously.
 *  2. `assertPublicHttpUrl` — resolves the hostname and refuses it if *any*
 *     address it resolves to is private.
 *  3. `publicOnlyLookup` / `safeFetch` — re-checks the address at connect
 *     time, so a DNS answer that changes between (2) and the socket opening
 *     (rebinding) cannot reach a private address, and re-validates every
 *     redirect hop instead of letting the HTTP client follow them blindly.
 */

import * as dns from 'node:dns';
import * as http from 'node:http';
import * as https from 'node:https';
import * as net from 'node:net';

export type UnsafeUrlReason =
  | 'invalid'
  | 'scheme'
  | 'credentials'
  | 'host'
  | 'private'
  | 'dns'
  | 'redirect';

/** Thrown for any URL the guard refuses. Callers map it to their own HTTP error. */
export class UnsafeUrlError extends Error {
  constructor(
    message: string,
    readonly reason: UnsafeUrlReason,
  ) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
]);

/** Suffixes that only ever name hosts on a private network. */
const BLOCKED_HOST_SUFFIXES = [
  '.localhost',
  '.local',
  '.internal',
  '.lan',
  '.home.arpa',
  '.corp',
];

/* ------------------------------------------------------------ addresses ---- */

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) {
    return true;
  }
  const [a, b, c] = parts as [number, number, number, number];

  if (a === 0) return true; // 0.0.0.0/8 "this" network
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 0 && c === 0) return true; // IETF protocol assignments
  if (a === 192 && b === 0 && c === 2) return true; // TEST-NET-1
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a === 198 && b === 51 && c === 100) return true; // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true; // TEST-NET-3
  if (a >= 224) return true; // multicast, reserved, broadcast
  return false;
}

function isPrivateOrReservedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, '');

  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
  if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true;

  // IPv4-mapped (::ffff:a.b.c.d) — judge by the embedded v4 address.
  if (normalized.startsWith('::ffff:')) {
    const v4 = normalized.slice(7);
    if (net.isIPv4(v4)) return isPrivateOrReservedIpv4(v4);
  }

  // fe80::/10 link-local
  if (/^fe[89ab]/.test(normalized)) return true;
  // fc00::/7 unique local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  // ff00::/8 multicast
  if (normalized.startsWith('ff')) return true;

  return false;
}

/**
 * Whether `ip` is loopback, private, link-local, CGNAT, multicast or otherwise
 * not a public unicast address. Anything that is not a well-formed IP fails
 * closed.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  const version = net.isIP(ip.replace(/^\[|\]$/g, ''));
  if (version === 4) return isPrivateOrReservedIpv4(ip);
  if (version === 6) return isPrivateOrReservedIpv6(ip);
  return true;
}

/* ----------------------------------------------------------------- URLs ---- */

/**
 * The synchronous half of the check: parses `raw` and refuses non-HTTP
 * schemes, embedded credentials, internal hostnames and private IP literals.
 * Does not resolve DNS — use `assertPublicHttpUrl` before any request.
 */
export function checkUrlShape(raw: string | URL): URL {
  let url: URL;
  try {
    url = raw instanceof URL ? raw : new URL(String(raw).trim());
  } catch {
    throw new UnsafeUrlError('Not a valid absolute URL.', 'invalid');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new UnsafeUrlError(
      `Protocol '${url.protocol}' is not allowed. Only http and https are.`,
      'scheme',
    );
  }

  if (url.username || url.password) {
    throw new UnsafeUrlError('URLs with embedded credentials are not allowed.', 'credentials');
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (!host) throw new UnsafeUrlError('URL has no hostname.', 'invalid');

  if (BLOCKED_HOSTNAMES.has(host) || BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new UnsafeUrlError(`Host '${host}' is internal.`, 'host');
  }

  if (net.isIP(host) && isPrivateOrReservedIp(host)) {
    throw new UnsafeUrlError(`Address '${host}' is private or reserved.`, 'private');
  }

  return url;
}

/**
 * Full pre-flight check: the URL's shape, then every address its hostname
 * resolves to. Resolves to the parsed URL when it is safe to request.
 */
export async function assertPublicHttpUrl(raw: string | URL): Promise<URL> {
  const url = checkUrlShape(raw);
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) return url;

  let records: dns.LookupAddress[];
  try {
    records = await dns.promises.lookup(host, { all: true });
  } catch (err) {
    throw new UnsafeUrlError(
      `Could not resolve '${host}': ${err instanceof Error ? err.message : String(err)}`,
      'dns',
    );
  }
  if (records.length === 0) {
    throw new UnsafeUrlError(`Could not resolve '${host}'.`, 'dns');
  }
  const blocked = records.find((r) => isPrivateOrReservedIp(r.address));
  if (blocked) {
    throw new UnsafeUrlError(
      `Host '${host}' resolves to private address '${blocked.address}'.`,
      'private',
    );
  }
  return url;
}

/**
 * A `lookup` for `http.Agent`/`https.Agent` (and axios' `httpAgent`) that
 * refuses to connect to a private address. This is what defeats DNS
 * rebinding: the address is checked at the moment the socket is opened, not
 * only when the URL was first validated.
 */
export const publicOnlyLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) {
      (callback as (e: NodeJS.ErrnoException | null, a: string, f: number) => void)(err, '', 0);
      return;
    }
    const list = addresses as unknown as dns.LookupAddress[];
    const blocked = list.find((a) => isPrivateOrReservedIp(a.address));
    if (blocked || list.length === 0) {
      const error = new UnsafeUrlError(
        blocked
          ? `Connection to private address '${blocked.address}' refused.`
          : `Could not resolve '${hostname}'.`,
        blocked ? 'private' : 'dns',
      ) as UnsafeUrlError & NodeJS.ErrnoException;
      (callback as (e: NodeJS.ErrnoException | null, a: string, f: number) => void)(error, '', 0);
      return;
    }
    if ((options as dns.LookupOptions)?.all) {
      (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, list);
    } else {
      const first = list[0]!;
      (callback as (e: null, a: string, f: number) => void)(null, first.address, first.family);
    }
  });
};

/** Agents whose every connection goes through `publicOnlyLookup`. */
export function createPublicOnlyAgents(): { httpAgent: http.Agent; httpsAgent: https.Agent } {
  return {
    httpAgent: new http.Agent({ keepAlive: false, lookup: publicOnlyLookup }),
    httpsAgent: new https.Agent({ keepAlive: false, lookup: publicOnlyLookup }),
  };
}

/* ---------------------------------------------------------------- fetch ---- */

export interface SafeFetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
  /** Whole-request budget, redirects included. Default 15s. */
  timeoutMs?: number;
  /** Response bytes kept; the rest is dropped and `truncated` set. Default 5 MB. */
  maxBytes?: number;
  /** Each hop is re-validated. Default 5. */
  maxRedirects?: number;
}

export interface SafeFetchResponse {
  status: number;
  ok: boolean;
  /** The URL that finally answered, after redirects. */
  url: string;
  headers: Record<string, string>;
  truncated: boolean;
  text(): string;
  json<T = unknown>(): T;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 5;

/** What decides whether a hop may be requested and an address connected to. */
export interface SsrfPolicy {
  assertUrl(url: string | URL): Promise<URL>;
  lookup: net.LookupFunction;
}

const DEFAULT_POLICY: SsrfPolicy = {
  assertUrl: assertPublicHttpUrl,
  lookup: publicOnlyLookup,
};

/**
 * Builds a `safeFetch` bound to `policy`. Only the specs pass a policy — they
 * need a local server to be reachable; production code uses `safeFetch`.
 */
export function createSafeFetch(policy: SsrfPolicy) {
  return async function safeFetchWith(
    input: string | URL,
    init: SafeFetchInit = {},
  ): Promise<SafeFetchResponse> {
    const timeoutMs = init.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxBytes = init.maxBytes ?? DEFAULT_MAX_BYTES;
    const maxRedirects = init.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
    const deadline = Date.now() + timeoutMs;

    let url = await policy.assertUrl(input);
    let method = (init.method ?? 'GET').toUpperCase();
    let body = init.body;

    for (let hop = 0; ; hop++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new Error(`Request to ${url.host} timed out.`);

      const res = await requestOnce(url, { method, headers: init.headers, body }, policy, remaining, maxBytes);

      if (res.status >= 300 && res.status < 400 && res.headers['location']) {
        if (hop >= maxRedirects) {
          throw new UnsafeUrlError('Too many redirects.', 'redirect');
        }
        let next: URL;
        try {
          next = new URL(res.headers['location'], url);
        } catch {
          throw new UnsafeUrlError(`Invalid redirect to '${res.headers['location']}'.`, 'redirect');
        }
        url = await policy.assertUrl(next);
        // 301/302/303 become a bodiless GET, as browsers do; 307/308 replay.
        if (res.status !== 307 && res.status !== 308) {
          method = 'GET';
          body = undefined;
        }
        continue;
      }

      const buffer = res.body;
      return {
        status: res.status,
        ok: res.status >= 200 && res.status < 300,
        url: url.toString(),
        headers: res.headers,
        truncated: res.truncated,
        text: () => buffer.toString('utf8'),
        json: <T>() => JSON.parse(buffer.toString('utf8')) as T,
      };
    }
  };
}

/** Fetches `input` with SSRF protection. See the module comment. */
export const safeFetch = createSafeFetch(DEFAULT_POLICY);

function requestOnce(
  url: URL,
  init: { method: string; headers?: Record<string, string>; body?: string | Buffer },
  policy: SsrfPolicy,
  timeoutMs: number,
  maxBytes: number,
): Promise<{ status: number; headers: Record<string, string>; body: Buffer; truncated: boolean }> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const agent = new transport.Agent({ keepAlive: false, lookup: policy.lookup });
    const req = transport.request(
      url,
      {
        method: init.method,
        headers: {
          'User-Agent': 'OneTabBot/1.0 (+https://onetab.ai/bot)',
          ...(init.headers ?? {}),
        },
        agent,
        timeout: timeoutMs,
      },
      (res) => {
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(res.headers)) {
          if (value !== undefined) headers[key] = Array.isArray(value) ? value.join(', ') : String(value);
        }
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;
        res.on('data', (chunk: Buffer) => {
          if (truncated) return;
          if (size + chunk.length > maxBytes) {
            chunks.push(chunk.subarray(0, maxBytes - size));
            size = maxBytes;
            truncated = true;
            res.destroy();
            resolve({ status: res.statusCode ?? 0, headers, body: Buffer.concat(chunks), truncated });
            return;
          }
          chunks.push(chunk);
          size += chunk.length;
        });
        res.on('end', () =>
          resolve({ status: res.statusCode ?? 0, headers, body: Buffer.concat(chunks), truncated }),
        );
        res.on('error', (err) => {
          if (!truncated) reject(err);
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error(`Request to ${url.host} timed out.`)));
    req.on('error', reject);
    if (init.body !== undefined) req.write(init.body);
    req.end();
  });
}
