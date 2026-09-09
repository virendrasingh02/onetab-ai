import { useEffect, useState } from 'react';

/**
 * Resolves Matrix's *authenticated* media URLs into something a plain
 * `<img>`/`<video>`/`<audio>` tag can actually load.
 *
 * Matrix's media repo (MSC3916) requires an `Authorization: Bearer <token>`
 * header on every request once a homeserver enforces authenticated media —
 * which current Synapse deployments do by default. `packages/matrix-client`
 * still resolves every `mxc://` URL through `mxcUrlToHttp(..., true)`
 * (`resolveMediaUrl` in `mappers.ts`) because that is the correct/only
 * resolution Matrix offers; the piece that was missing was ever attaching
 * that header. A bare `<img src>` cannot, so this fetches the bytes itself
 * (with the token the app's already-connected Matrix client is using) and
 * hands back a `blob:` URL instead.
 *
 * `@org/hooks` cannot depend on `@org/matrix-client` or `@org/web-chat`
 * (this is a leaf util package with no app/data dependencies) — the same
 * boundary `@org/ui`'s `AvatarPresenceProvider` seam works around for live
 * presence. The app supplies the actual fetcher once, near the root, via
 * `configureAuthenticatedMediaFetcher`; unconfigured, authenticated media
 * simply never resolves and every caller falls back to its normal
 * loading/broken-image/initials state.
 */

export type AuthenticatedMediaFetcher = (url: string) => Promise<Response>;

let fetchAuthenticated: AuthenticatedMediaFetcher | null = null;

/**
 * Wires the fetcher that knows how to attach the current Matrix bearer
 * token. Called once by the app (see `AuthenticatedMediaBridge` in
 * `@org/web-chat`); pass `null` to tear it down (e.g. on sign-out) so
 * in-flight callers stop resolving against a dead session.
 */
export function configureAuthenticatedMediaFetcher(
  fetcher: AuthenticatedMediaFetcher | null,
): void {
  fetchAuthenticated = fetcher;
}

// Matches both the download and thumbnail authenticated-media routes, on any
// homeserver's own origin (the URL `mxcUrlToHttp` builds is cross-origin from
// the app itself), across the versioned `/client/vN/media/` prefix.
const AUTHENTICATED_MEDIA_PATTERN = /\/_matrix\/client\/v\d+\/media\//;

/** Whether `url` is one only `useAuthenticatedMediaSrc` (or the fetcher it's
 * configured with) can load — everything else passes through untouched. */
export function isAuthenticatedMediaUrl(url: string): boolean {
  return AUTHENTICATED_MEDIA_PATTERN.test(url);
}

// Blob URLs are cached across every consumer — the same room avatar renders
// in the sidebar, the message list and the member panel at once, and each
// should reuse one fetch/blob rather than tripling the work. Insertion order
// doubles as recency for the eviction below since every cache hit re-fetches
// nothing (a get never re-inserts), which is close enough to LRU for an
// avatar/thumbnail cache without the bookkeeping of a real one.
const MAX_CACHED_BLOBS = 400;
const blobCache = new Map<string, string>();
const inFlight = new Map<string, Promise<string | null>>();

function remember(url: string, blobUrl: string): void {
  blobCache.set(url, blobUrl);
  if (blobCache.size <= MAX_CACHED_BLOBS) return;
  const oldest = blobCache.keys().next().value;
  if (oldest === undefined) return;
  const stale = blobCache.get(oldest);
  blobCache.delete(oldest);
  if (stale) URL.revokeObjectURL(stale);
}

async function resolve(url: string): Promise<string | null> {
  const cached = blobCache.get(url);
  if (cached) return cached;

  const pending = inFlight.get(url);
  if (pending) return pending;

  const fetcher = fetchAuthenticated;
  if (!fetcher) return null;

  const promise = (async () => {
    try {
      const response = await fetcher(url);
      if (!response.ok) return null;
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      remember(url, blobUrl);
      return blobUrl;
    } catch {
      return null;
    } finally {
      inFlight.delete(url);
    }
  })();

  inFlight.set(url, promise);
  return promise;
}

/**
 * Resolves `src` for direct use in `<img src>` / `<video src>` / `<audio
 * src>`. Any URL that isn't Matrix's authenticated media (the app's own
 * uploads, `data:`/`blob:` URIs, unauthenticated media) passes straight
 * through with no extra work.
 *
 * Returns `undefined` while a `blob:` URL is being fetched, and also on
 * failure (no fetcher configured, network error, non-2xx) — callers should
 * already treat "no src yet" as their loading/fallback state, so a failed
 * authenticated fetch degrades to exactly that rather than a URL the browser
 * would 401 on.
 */
export function useAuthenticatedMediaSrc(
  src: string | null | undefined,
): string | null | undefined {
  const needsAuth = !!src && isAuthenticatedMediaUrl(src);
  const [resolved, setResolved] = useState<string | null | undefined>(() =>
    needsAuth ? blobCache.get(src as string) : src,
  );

  useEffect(() => {
    if (!needsAuth) {
      setResolved(src);
      return;
    }

    const cached = blobCache.get(src as string);
    if (cached) {
      setResolved(cached);
      return;
    }

    let cancelled = false;
    setResolved(undefined);
    void resolve(src as string).then((blobUrl) => {
      if (!cancelled) setResolved(blobUrl ?? undefined);
    });
    return () => {
      cancelled = true;
    };
    // `needsAuth` is derived from `src`; re-running on `src` alone is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  return resolved;
}

/**
 * The non-hook counterpart, for plain async code that needs the bytes rather
 * than something to put in a `src` attribute — e.g. a "download" action that
 * otherwise `fetch()`es the URL directly and would 401 the same way an
 * `<img>` would. Returns `null` under the same conditions
 * `useAuthenticatedMediaSrc` resolves to `undefined`.
 */
export async function fetchAuthenticatedMediaBlob(
  url: string,
): Promise<Blob | null> {
  if (!isAuthenticatedMediaUrl(url)) {
    try {
      const response = await fetch(url);
      return response.ok ? await response.blob() : null;
    } catch {
      return null;
    }
  }

  const blobUrl = await resolve(url);
  if (!blobUrl) return null;
  const cachedResponse = await fetch(blobUrl);
  return cachedResponse.blob();
}
