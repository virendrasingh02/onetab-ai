/**
 * The one shape every viewer renders. Every attachment surface in the app
 * (chat, AI-generated files, app cards, the file manager, search) speaks its
 * own domain type — `Attachment`, `GeneratedFile`, `Upload`, ... — so callers
 * adapt into this before calling `openPreview()`. See `adapters.ts` for the
 * two shapes this library knows how to convert directly; anything else
 * (`Upload`, which has no direct URL) is built at the call site instead.
 */
export type MediaCategory =
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'text'
  | 'office'
  | 'archive'
  | 'unknown';

export interface MediaItem {
  /** Stable within one `openPreview()` call — used as the React key and as
   * the cache key for `resolveUrl()`/blob-URL bookkeeping. */
  id: string;
  name: string;
  mimeType: string;
  category: MediaCategory;
  size?: number;
  /** Ready-to-use URL (http(s) or blob:). Omit when the caller can only
   * resolve one lazily via `resolveUrl`. */
  url?: string;
  /**
   * Lazily resolves an authorized URL — e.g. an authenticated blob download.
   * Called once per open and cached; any blob URL it returns is revoked by
   * the store when the item leaves the preview, never `url` itself (that one
   * came from the caller and may still be in use elsewhere).
   */
  resolveUrl?: () => Promise<string>;
  /** Explicit download target, when it should differ from `url`/`resolveUrl`. */
  downloadUrl?: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  /** Seconds, for audio/video. */
  duration?: number;
  /** Normalised 0..1 samples for a voice-message-style waveform. */
  waveform?: number[];
  /** Renders instantly with no fetch — used for AI-generated code snippets. */
  inlineText?: string;
  /** Prism grammar name for the text viewer, when known ahead of time. */
  language?: string;
  /** Rendered as a unified diff (+/- line prefixes) instead of plain code. */
  isDiff?: boolean;
  /** Freeform, shown in the details/metadata area — uploader, location, etc. */
  metadata?: Record<string, string | number | undefined>;
}

export interface MediaPreviewState {
  items: MediaItem[];
  activeIndex: number;
  isOpen: boolean;
}
