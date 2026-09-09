import { fetchAuthenticatedMediaBlob } from '@org/hooks';
import type { MediaItem } from './types.js';

/**
 * Forces a save-to-disk for any resolved URL — http(s) or blob: — the same
 * fetch → blob → object URL → synthetic click → revoke pattern the file
 * manager's download mutation already uses (`use-upload.ts`). A bare
 * `<a href download>` is not enough here: it silently opens the file in a new
 * tab instead of saving it for a good few file types/browsers, and it can't
 * be pointed at a blob: URL that's about to be revoked.
 *
 * `fetchAuthenticatedMediaBlob` covers Matrix's authenticated media the same
 * way `AvatarImage` does for on-screen `<img>`s — a plain `fetch(url)` here
 * would 401 on it exactly as a bare `<img src>` would.
 */
export async function downloadMediaItem(
  url: string,
  filename: string,
): Promise<void> {
  const blob = await fetchAuthenticatedMediaBlob(url);
  if (!blob) throw new Error(`Could not download ${filename}`);
  const objectUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

export function resolveDownloadTarget(item: MediaItem, resolvedUrl?: string) {
  return item.downloadUrl ?? item.url ?? resolvedUrl;
}
