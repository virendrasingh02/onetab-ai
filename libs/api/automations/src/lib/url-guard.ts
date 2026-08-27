/**
 * SSRF guard for workflow `API_CALL` / `WEBHOOK` steps.
 *
 * A workflow node's URL is authored by a workspace member, so an unguarded
 * `fetch` is a request forgery primitive: `http://169.254.169.254/…` (cloud
 * metadata), `http://localhost:5432` (the database), `http://10.0.0.5/admin`
 * (internal services). This blocks non-HTTP schemes and any host that resolves
 * to a private, loopback, link-local or otherwise non-public address by its
 * literal form. It is deliberately conservative — DNS-rebinding is not covered
 * here and would need a resolve-then-pin fetch.
 *
 * Returns a reason string when the URL must be refused, or `null` when it is
 * allowed.
 */
export function isBlockedRequestUrl(raw: string): string | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return 'not a valid absolute URL';
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return `scheme '${url.protocol}' is not allowed (http/https only)`;
  }

  const host = url.hostname.toLowerCase();

  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host.endsWith('.localhost') ||
    host.endsWith('.internal') ||
    host.endsWith('.local')
  ) {
    return `host '${host}' is internal`;
  }

  if (isPrivateIpv4(host) || isPrivateIpv6(host)) {
    return `host '${host}' resolves to a private address`;
  }

  return null;
}

function isPrivateIpv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([a, Number(m[3]), Number(m[4])].some((n) => n > 255)) return true;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // "this" network
  if (a === 169 && b === 254) return true; // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a >= 224) return true; // multicast / reserved
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '');
  if (h === '::1' || h === '::') return true;
  if (h.startsWith('fe80:') || h.startsWith('fe80::')) return true; // link-local
  if (/^f[cd][0-9a-f]{2}:/i.test(h)) return true; // unique local fc00::/7
  if (h.startsWith('::ffff:')) return isPrivateIpv4(h.slice(7)); // v4-mapped
  return false;
}
