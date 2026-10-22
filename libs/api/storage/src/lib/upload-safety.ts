/**
 * Rules for user-supplied files. Anything the browser can execute or render as
 * a document must never be served inline from the API origin, where the
 * session cookies live.
 */

/** Strips parameters (`; charset=…`) and lowercases. */
export function normalizeMime(mimeType: string | undefined | null): string {
  const base = (mimeType ?? '').split(';')[0].trim().toLowerCase();
  return /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(base)
    ? base
    : 'application/octet-stream';
}

const ACTIVE_CONTENT = new Set([
  'text/html',
  'application/xhtml+xml',
  'image/svg+xml',
  'text/xml',
  'application/xml',
  'text/javascript',
  'application/javascript',
  'application/x-javascript',
  'text/ecmascript',
  'application/ecmascript',
  'text/css',
  'application/wasm',
]);

/** True for types a browser may execute or render as a page. */
export function isActiveContent(mimeType: string): boolean {
  const type = normalizeMime(mimeType);
  return ACTIVE_CONTENT.has(type) || type.endsWith('+xml');
}

const SAFE_INLINE = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'application/pdf',
  'text/plain',
  'video/mp4',
  'video/webm',
  'audio/mpeg',
  'audio/mp4',
  'audio/ogg',
  'audio/webm',
  'audio/wav',
]);

export interface ServeHeaders {
  contentType: string;
  disposition: 'inline' | 'attachment';
}

/**
 * Picks the Content-Type and disposition for delivery. Only a short list of
 * inert types may render inline; everything else is a forced download, and
 * active content is additionally relabelled as opaque bytes.
 */
export function resolveServeHeaders(
  storedMime: string,
  wantsDownload: boolean,
): ServeHeaders {
  const type = normalizeMime(storedMime);
  if (isActiveContent(type)) {
    return { contentType: 'application/octet-stream', disposition: 'attachment' };
  }
  const inline = !wantsDownload && SAFE_INLINE.has(type);
  return { contentType: type, disposition: inline ? 'inline' : 'attachment' };
}

/** Defence in depth if a response is ever rendered anyway. */
export const SANDBOX_CSP = "sandbox; default-src 'none'; style-src 'unsafe-inline'";

/** Storage-key extension: short and strictly alphanumeric, else none. */
export function safeExtension(filename: string): string {
  const match = /(\.[A-Za-z0-9]{1,10})$/.exec(filename.replace(/[\\/]/g, '_'));
  return match ? match[1] : '';
}
