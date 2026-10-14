/**
 * "Take me back to where I was" for upgrades started elsewhere (e.g. AI Agent
 * Studio hits a plan limit and sends the user to billing with `returnTo`).
 *
 * `returnTo` comes off the URL, so it is untrusted: only same-site targets are
 * honoured (exact host, localhost, or a sibling subdomain of the same parent
 * domain, matched on a dot boundary). Anything else is dropped, not followed.
 */
const KEY = 'onetab_billing_return_to';

export function isSafeReturnTo(raw: string, currentHost: string = window.location.hostname): URL | null {
  let url: URL;
  try {
    url = new URL(raw, window.location.origin);
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  const parent = currentHost.includes('.') ? currentHost.split('.').slice(-2).join('.') : null;
  const ok =
    url.hostname === currentHost ||
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    (parent !== null && (url.hostname === parent || url.hostname.endsWith(`.${parent}`)));
  return ok ? url : null;
}

/** Remembers a valid `returnTo` for the rest of this browser tab (it survives the provider redirect). */
export function rememberReturnTo(raw: string | null): void {
  if (!raw) return;
  const safe = isSafeReturnTo(raw);
  if (!safe) return;
  try {
    sessionStorage.setItem(KEY, safe.toString());
  } catch {
    /* storage blocked — the link simply won't persist */
  }
}

export function readReturnTo(): { href: string; label: string } | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    const safe = raw ? isSafeReturnTo(raw) : null;
    if (!safe) return null;
    const isStudio = /studio|:4202|\/agents|\/create|\/settings/.test(safe.toString()) && safe.origin !== window.location.origin;
    return { href: safe.toString(), label: isStudio ? 'Back to AI Agent Studio' : 'Back' };
  } catch {
    return null;
  }
}

export function clearReturnTo(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
