import type { MediaItem } from './types.js';

/**
 * Forces a save-to-disk for any resolved URL — http(s) or blob: — the same
 * fetch → blob → object URL → synthetic click → revoke pattern the file
 * manager's download mutation already uses (`use-upload.ts`). A bare
 * `<a href download>` is not enough here: it silently opens the file in a new
 * tab instead of saving it for a good few file types/browsers, and it can't
 * be pointed at a blob: URL that's about to be revoked.
 */
export async function downloadMediaItem(
  url: string,
  filename: string,
): Promise<void> {
  const response = await fetch(url);
  const blob = await response.blob();
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
