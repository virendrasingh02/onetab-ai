/** Domains that hand out subdomains to anyone (e.g. `npm run share` tunnels). */
const SHARED_HOST_DOMAINS = new Set(['trycloudflare.com']);

function configuredStudioOrigin(): string | null {
  try {
    const env = (import.meta as unknown as { env?: Record<string, unknown> })
      .env;
    const value = env?.['VITE_STUDIO_APP_URL'];
    return typeof value === 'string' && value ? new URL(value).origin : null;
  } catch {
    return null;
  }
}

/**
 * Resolves a `returnTo` redirect target for the post-login handoff, and
 * decides whether the current access token may ride along to it.
 *
 * `returnTo` is attacker-controllable (it comes straight off the URL), so a
 * same-site check is the actual security boundary here, not a courtesy. A
 * bare `hostname.endsWith(baseDomain)` check (no dot boundary) would treat
 * `evil-onetab.ai` as a suffix match for `onetab.ai` — this requires an exact
 * match or a proper `.` + suffix subdomain match.
 *
 * When the token does ride along, it is returned separately (never appended
 * to the URL's query string) so the caller can carry it in the fragment
 * instead. A query string is sent to the target origin's server/proxy/CDN as
 * part of the request line and shows up in access logs and browser history;
 * a fragment never leaves the browser.
 */
export function resolveSafeHandoff(
  returnTo: string,
  currentOrigin: string,
  currentHostname: string,
  studioOrigin: string | null = configuredStudioOrigin(),
): { url: URL; crossOrigin: boolean } | null {
  let targetUrl: URL;
  try {
    targetUrl = new URL(returnTo, currentOrigin);
  } catch {
    return null;
  }

  const lastTwoLabels = currentHostname.includes('.')
    ? currentHostname.split('.').slice(-2).join('.')
    : null;
  // On a shared tunnel domain every sibling subdomain belongs to a stranger,
  // so only the Studio origin this build was configured with is trusted.
  const baseDomain =
    lastTwoLabels && SHARED_HOST_DOMAINS.has(lastTwoLabels)
      ? null
      : lastTwoLabels;

  const isAllowed =
    targetUrl.origin === currentOrigin ||
    targetUrl.origin === studioOrigin ||
    targetUrl.hostname === 'localhost' ||
    targetUrl.hostname === '127.0.0.1' ||
    (baseDomain !== null &&
      (targetUrl.hostname === baseDomain ||
        targetUrl.hostname.endsWith(`.${baseDomain}`)));

  if (!isAllowed) return null;

  return { url: targetUrl, crossOrigin: targetUrl.origin !== currentOrigin };
}

/** Carries a bearer token to a cross-origin handoff target via the URL fragment. */
export function withHandoffToken(url: URL, token: string): string {
  url.hash = `token=${encodeURIComponent(token)}`;
  return url.toString();
}
