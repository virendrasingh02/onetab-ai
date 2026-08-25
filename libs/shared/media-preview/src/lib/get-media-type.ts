import type { MediaCategory } from './types.js';

const OFFICE_EXTENSIONS = new Set([
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'odt',
  'odp',
  'ods',
  'rtf',
]);

const ARCHIVE_EXTENSIONS = new Set(['zip', 'tar', 'gz', 'rar', '7z']);

const TEXT_EXTENSIONS = new Set([
  'txt',
  'md',
  'markdown',
  'csv',
  'json',
  'yaml',
  'yml',
  'xml',
  'log',
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'c',
  'cpp',
  'h',
  'hpp',
  'cs',
  'php',
  'sh',
  'bash',
  'sql',
  'css',
  'scss',
  'html',
  'diff',
  'patch',
]);

function extensionOf(filename?: string): string | undefined {
  if (!filename) return undefined;
  const dot = filename.lastIndexOf('.');
  if (dot === -1 || dot === filename.length - 1) return undefined;
  return filename.slice(dot + 1).toLowerCase();
}

/**
 * Central file-type classification. MIME type is authoritative when present
 * and specific enough; the extension is only a fallback (a browser upload's
 * MIME can be blank, and `application/octet-stream` tells us nothing).
 *
 * Every place in the app that used to sniff `mimeType.startsWith('image/')`
 * or similar ad hoc should call this instead.
 */
export function getMediaType(
  mimeType: string | undefined,
  filename?: string,
): MediaCategory {
  const mime = (mimeType ?? '').toLowerCase();
  const ext = extensionOf(filename);

  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'pdf';
  if (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    mime === 'application/xml' ||
    mime === 'application/x-yaml'
  ) {
    return 'text';
  }
  if (
    mime.includes('officedocument') ||
    mime === 'application/msword' ||
    mime === 'application/vnd.ms-excel' ||
    mime === 'application/vnd.ms-powerpoint' ||
    mime.startsWith('application/vnd.oasis.opendocument')
  ) {
    return 'office';
  }
  if (
    mime === 'application/zip' ||
    mime === 'application/x-tar' ||
    mime === 'application/gzip' ||
    mime === 'application/x-7z-compressed' ||
    mime === 'application/x-rar-compressed'
  ) {
    return 'archive';
  }

  // MIME was missing, generic, or unrecognised — fall back to the extension.
  if (ext) {
    if (ext === 'pdf') return 'pdf';
    if (OFFICE_EXTENSIONS.has(ext)) return 'office';
    if (ARCHIVE_EXTENSIONS.has(ext)) return 'archive';
    if (TEXT_EXTENSIONS.has(ext)) return 'text';
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'avif', 'bmp'].includes(ext)) {
      return 'image';
    }
    if (['mp4', 'webm', 'mov', 'mkv', 'avi'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'ogg', 'm4a', 'flac'].includes(ext)) return 'audio';
  }

  return 'unknown';
}

/** Whether this library has a real viewer for the category (vs. the
 * download/unsupported fallback). Office is intentionally excluded — no
 * conversion backend exists, so it always falls back to download. */
export function canRenderPreview(category: MediaCategory): boolean {
  return (
    category === 'image' ||
    category === 'video' ||
    category === 'audio' ||
    category === 'pdf' ||
    category === 'text'
  );
}

export function extensionFromName(filename: string): string {
  return extensionOf(filename) ?? '';
}
