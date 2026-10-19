import { useEffect, useState } from 'react';
import { Platform, type ImageSourcePropType } from 'react-native';
import { createBlobUrlCache, type BlobUrlCache } from './blob-url-cache';

let shared: BlobUrlCache | null = null;
const webCache = () => (shared ??= createBlobUrlCache(fetch, URL));

/**
 * An `Image` source for a URL that needs auth headers. Native passes the
 * headers through; web resolves to a cached `blob:` URL (null while loading
 * or if it failed, so callers show their placeholder).
 */
export function useAuthedImageSource(
  uri: string | null | undefined,
  headers: Record<string, string> | undefined,
): ImageSourcePropType | null {
  const web = Platform.OS === 'web';
  const needsFetch = web && Boolean(uri && headers);
  const [objectUrl, setObjectUrl] = useState<string | undefined>(() =>
    uri && needsFetch ? webCache().peek(uri) : undefined,
  );
  const headerKey = headers ? JSON.stringify(headers) : '';

  useEffect(() => {
    if (!uri || !needsFetch || !headerKey) return;
    let live = true;
    const cache = webCache();
    setObjectUrl(cache.peek(uri));
    cache
      .get(uri, JSON.parse(headerKey) as Record<string, string>)
      .then((value) => {
        if (live) setObjectUrl(value);
      })
      .catch(() => {
        if (live) setObjectUrl(undefined);
      });
    return () => {
      live = false;
    };
  }, [uri, needsFetch, headerKey]);

  if (!uri) return null;
  if (!needsFetch) return { uri, headers };
  return objectUrl ? { uri: objectUrl } : null;
}
