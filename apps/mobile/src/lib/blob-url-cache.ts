/**
 * Object URLs for media that needs an auth header. A browser `<img>` cannot
 * send `Authorization` (react-native-web's `Image` drops `source.headers`), so
 * on web the bytes are fetched with the header and shown from a `blob:` URL —
 * the same approach as the web app's `useAuthenticatedMediaSrc`.
 *
 * One fetch per URL however many components show it; failures are not cached,
 * so a later render can retry. Platform-free (fetch and URL are injected).
 */
type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface BlobUrlCache {
  get(url: string, headers: Record<string, string>): Promise<string>;
  peek(url: string): string | undefined;
}

export function createBlobUrlCache(
  fetchImpl: FetchLike,
  urls: { createObjectURL(blob: Blob): string },
): BlobUrlCache {
  const ready = new Map<string, string>();
  const pending = new Map<string, Promise<string>>();

  return {
    peek: (url) => ready.get(url),
    get(url, headers) {
      const done = ready.get(url);
      if (done) return Promise.resolve(done);
      let inFlight = pending.get(url);
      if (!inFlight) {
        inFlight = fetchImpl(url, { headers })
          .then(async (response) => {
            if (!response.ok)
              throw new Error(`Media request failed (${response.status}).`);
            const objectUrl = urls.createObjectURL(await response.blob());
            ready.set(url, objectUrl);
            return objectUrl;
          })
          .finally(() => pending.delete(url));
        pending.set(url, inFlight);
      }
      return inFlight;
    },
  };
}
