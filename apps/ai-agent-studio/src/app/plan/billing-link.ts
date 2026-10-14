import { WEB_APP_URL } from '../auth-redirect.js';

/**
 * The active workspace slug, remembered outside React so code that runs
 * outside the session tree (the global mutation error handler) can still build
 * a link to the main app's billing page.
 */
let activeSlug: string | null = null;

export function rememberBillingWorkspace(slug: string | null): void {
  activeSlug = slug;
}

export function buildBillingUrl(slug: string, opts: { returnTo?: string; topUp?: boolean } = {}): string {
  const url = new URL(`${WEB_APP_URL.replace(/\/+$/, '')}/w/${slug}/settings/billing`);
  const back = opts.returnTo ?? (typeof window === 'undefined' ? '' : window.location.href);
  if (back) url.searchParams.set('returnTo', back);
  if (opts.topUp) url.searchParams.set('topup', 'open');
  return url.toString();
}

/** Billing URL for the active workspace, or null before a workspace is known. */
export function activeBillingUrl(opts: { topUp?: boolean } = {}): string | null {
  return activeSlug ? buildBillingUrl(activeSlug, opts) : null;
}
