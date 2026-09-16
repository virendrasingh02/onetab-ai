import { useAuthenticatedMediaSrc } from '@org/hooks';
import { downloadMediaItem } from '@org/media-preview';
import type { Attachment } from '@org/types';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Hint,
  Skeleton,
  toast,
} from '@org/ui';
import { cn, formatBytes } from '@org/utils';
import {
  ChevronDown,
  CloudDownload,
  Copy,
  Download,
  ExternalLink,
  File as FileIcon,
  FileText,
  Film,
  Loader2,
  Maximize2,
  Music,
  Pause,
  Play,
} from 'lucide-react';
import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';
import { WaveformBars } from './waveform-bars.js';

export interface AttachmentFileHeaderProps {
  attachment: Attachment;
  onOpen?: () => void;
  onDownload?: () => void;
  className?: string;
}

/** Slack-style single-attachment filename header with dropdown actions */
export function AttachmentFileHeader({
  attachment,
  onOpen,
  onDownload,
  className,
}: AttachmentFileHeaderProps) {
  const handleDownload = async () => {
    if (onDownload) {
      onDownload();
    } else {
      await downloadAttachment(attachment);
    }
  };

  const handleCopyLink = async () => {
    if (!attachment.url) return;
    try {
      await navigator.clipboard.writeText(attachment.url);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  return (
    <div className={cn('flex items-center gap-1.5 text-xs', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group/file-hdr inline-flex items-center gap-1 py-0.5 px-1 -ml-1 text-xs font-semibold text-foreground/90 hover:text-foreground transition-colors rounded hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <span className="truncate max-w-[240px] sm:max-w-xs text-[13px] font-semibold text-foreground/95">
              {attachment.name}
            </span>
            {attachment.size ? (
              <span className="text-[11px] text-muted-foreground font-normal ml-0.5">
                {formatBytes(attachment.size)}
              </span>
            ) : null}
            <ChevronDown className="size-3 text-muted-foreground transition-transform duration-150 group-data-[state=open]/file-hdr:rotate-180 shrink-0" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {onOpen ? (
            <DropdownMenuItem onClick={onOpen} className="gap-2 text-xs cursor-pointer">
              <ExternalLink className="size-3.5" />
              <span>Open preview</span>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onClick={handleDownload} className="gap-2 text-xs cursor-pointer">
            <Download className="size-3.5" />
            <span>Download</span>
          </DropdownMenuItem>
          {attachment.url ? (
            <DropdownMenuItem onClick={handleCopyLink} className="gap-2 text-xs cursor-pointer">
              <Copy className="size-3.5" />
              <span>Copy link</span>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Enter/Space activates a `div[role=button]` the way a native `<button>`
 *  would — shared by every tile below that can't be a real `<button>`
 *  itself (it hosts a real `<button>` download control, and nested buttons
 *  are invalid HTML). */
function handleOpenKeyDown(onOpen?: () => void) {
  return (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onOpen) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onOpen();
    }
  };
}

/** Saves one attachment to disk, with a toast on failure. Shared by the
 *  per-image download button and the grid's "download all". */
async function downloadAttachment(attachment: Attachment): Promise<boolean> {
  try {
    await downloadMediaItem(attachment.url, attachment.name);
    return true;
  } catch {
    toast.error(`Could not download ${attachment.name}`);
    return false;
  }
}

function iconFor(mimeType: string) {
  if (mimeType.startsWith('video/')) return Film;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.startsWith('text/') || mimeType.includes('pdf')) return FileText;
  return FileIcon;
}

export interface AttachmentCardProps {
  attachment: Attachment;
  onOpen?: () => void;
  className?: string;
}

/** Rich Slack-style PDF document card with preview header, filename, size, Open, and Download. */
export function PdfPreviewCard({
  attachment,
  onOpen,
  className,
}: AttachmentCardProps) {
  return (
    <div
      className={cn(
        'mt-1.5 max-w-sm rounded-xl border border-border bg-surface overflow-hidden shadow-xs transition-colors hover:border-primary/40',
        className,
      )}
    >
      {/* Top document banner */}
      <div
        onClick={onOpen}
        className="h-24 bg-gradient-to-br from-destructive/10 via-destructive/5 to-surface-raised p-3 flex flex-col items-center justify-center cursor-pointer border-b border-border/50 transition-opacity hover:opacity-90"
      >
        <span className="size-9 flex items-center justify-center rounded-lg bg-destructive/15 text-destructive-text mb-1 shadow-xs">
          <FileText className="size-4.5" />
        </span>
        <span className="text-xs font-semibold text-foreground/90 tracking-wide">
          Document Preview
        </span>
        <span className="text-[10px] text-muted-foreground font-medium">PDF</span>
      </div>

      {/* Info & action footer */}
      <div className="p-2.5 flex items-center justify-between gap-2 bg-surface-raised/70">
        <div className="min-w-0 flex-1">
          <p
            onClick={onOpen}
            className="text-xs font-semibold text-foreground truncate cursor-pointer hover:underline"
            title={attachment.name}
          >
            {attachment.name}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {attachment.size ? formatBytes(attachment.size) : 'PDF Document'}
          </p>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {onOpen ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={onOpen}
              className="h-7 px-2.5 text-xs font-medium gap-1"
            >
              <ExternalLink className="size-3" />
              <span>Open</span>
            </Button>
          ) : null}
          <a
            href={attachment.url}
            download={attachment.name}
            target="_blank"
            rel="noreferrer noopener"
            className="size-7 flex items-center justify-center rounded-md border border-border bg-surface text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            title={`Download ${attachment.name}`}
            aria-label={`Download ${attachment.name}`}
          >
            <Download className="size-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

/** Non-media attachment row: icon, name, size, open/download. */
export function AttachmentCard({
  attachment,
  onOpen,
  className,
}: AttachmentCardProps) {
  const Icon = iconFor(attachment.mimeType);

  return (
    <div
      className={cn(
        'group/attachment mt-1 max-w-sm gap-3 p-2.5 flex items-center rounded-lg border border-border bg-surface transition-colors hover:bg-muted/40',
        className,
      )}
    >
      <span
        onClick={onOpen}
        className="size-9 flex shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground cursor-pointer"
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1 cursor-pointer" onClick={onOpen}>
        <span className="text-sm font-medium block truncate text-foreground hover:underline">
          {attachment.name}
        </span>
        <span className="text-xs block text-muted-foreground">
          {attachment.size ? formatBytes(attachment.size) : attachment.mimeType}
        </span>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onOpen ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpen}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            Open
          </Button>
        ) : null}
        <a
          href={attachment.url}
          download={attachment.name}
          target="_blank"
          rel="noreferrer noopener"
          className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title={`Download ${attachment.name}`}
          aria-label={`Download ${attachment.name}`}
        >
          <Download className="size-4" />
        </a>
      </div>
    </div>
  );
}

export interface ImagePreviewProps {
  attachment: Attachment;
  onOpen?: () => void;
  className?: string;
  showHeader?: boolean;
}

/**
 * Inline image.
 *
 * The intrinsic width/height are applied as an aspect ratio so the timeline
 * does not reflow when the image loads — the single biggest cause of a jumping
 * scroll position in a message list.
 */
export function ImagePreview({
  attachment,
  onOpen,
  className,
  showHeader = true,
}: ImagePreviewProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  // The original bytes, not `attachment.thumbnailUrl` — that's the
  // homeserver's own generated thumbnail, a fixed, fairly aggressive JPEG
  // recompression we don't control (see `resolveMediaUrl` in
  // `matrix-client`'s mappers), and it visibly softened inline images. The
  // original is what `sendFile` actually uploaded, so this is the same
  // bytes a full-quality preview needs anyway.
  //
  // Matrix's thumbnail/download URLs require an auth header a plain <img>
  // can't attach — this fetches and swaps in a blob: URL when that's the
  // case, and is a no-op for any other kind of attachment URL.
  const imageSrc = useAuthenticatedMediaSrc(attachment.url);

  const ratio =
    attachment.width && attachment.height
      ? attachment.width / attachment.height
      : 4 / 3;

  if (failed) {
    return <AttachmentCard attachment={attachment} onOpen={onOpen} />;
  }

  const handleDownload = async (event: MouseEvent) => {
    event.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    await downloadAttachment(attachment);
    setDownloading(false);
  };

  return (
    <div className={cn('mt-1 max-w-sm space-y-1', className)}>
      {showHeader ? (
        <AttachmentFileHeader
          attachment={attachment}
          onOpen={onOpen}
          onDownload={() => downloadAttachment(attachment)}
        />
      ) : null}
      {/* A `div`, not a `<button>` — it hosts a real download `<button>`, and
          nested buttons are invalid HTML (and silently break the browser's
          click handling for one of them). */}
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={handleOpenKeyDown(onOpen)}
        className="block overflow-hidden rounded-xl border border-border bg-surface focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none cursor-pointer group shadow-xs"
        aria-label={`Open image ${attachment.name}`}
      >
        <span className="relative block overflow-hidden" style={{ aspectRatio: ratio }}>
          {!loaded ? (
            <Skeleton className="inset-0 absolute size-full rounded-none" />
          ) : null}
          <img
            src={imageSrc ?? undefined}
            alt={attachment.name}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={cn(
              'size-full object-cover transition-transform group-hover:scale-102 duration-200',
              loaded ? 'opacity-100' : 'opacity-0',
            )}
          />

          <Hint label="Download">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              aria-label={`Download ${attachment.name}`}
              className={cn(
                'absolute top-2 right-2 size-7 flex items-center justify-center rounded-md bg-black/50 text-white transition-opacity hover:bg-black/70',
                'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 focus-visible:opacity-100',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
              )}
            >
              {downloading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
            </button>
          </Hint>
        </span>
      </div>
    </div>
  );
}

export interface VideoPreviewProps {
  attachment: Attachment;
  onOpen?: () => void;
  className?: string;
  showHeader?: boolean;
}

export function VideoPreview({
  attachment,
  onOpen,
  className,
  showHeader = true,
}: VideoPreviewProps) {
  // Same authenticated-media problem as images: a <video>/poster can't
  // attach the header Matrix's media repo requires either.
  const poster = useAuthenticatedMediaSrc(attachment.thumbnailUrl);
  const videoSrc = useAuthenticatedMediaSrc(attachment.url);

  return (
    <div className={cn('mt-1 max-w-sm space-y-1', className)}>
      {showHeader ? (
        <AttachmentFileHeader
          attachment={attachment}
          onOpen={onOpen}
          onDownload={() => downloadAttachment(attachment)}
        />
      ) : null}
      <div className="relative rounded-xl border border-border bg-surface overflow-hidden shadow-xs">
        <video
          controls
          preload="metadata"
          poster={poster ?? undefined}
          className="w-full max-h-64 object-contain bg-surface-inset"
          aria-label={attachment.name}
        >
          {videoSrc ? <source src={videoSrc} type={attachment.mimeType} /> : null}
          Your browser cannot play this video.
        </video>
        {onOpen ? (
          <button
            type="button"
            onClick={onOpen}
            className="absolute top-2 right-2 size-7 flex items-center justify-center rounded-md bg-black/50 text-white hover:bg-black/70 transition-colors"
            aria-label={`Open ${attachment.name}`}
            title="Open in full view"
          >
            <Maximize2 className="size-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export interface VoiceMessageProps {
  attachment: Attachment;
}

/** Cycled by the speed toggle, fastest last so a repeated tap sweeps
 *  1× → 1.5× → 2× → back to 1×. */
const PLAYBACK_SPEEDS = [1, 1.5, 2] as const;

/**
 * Voice note with a waveform scrubber.
 *
 * Falls back to a flat bar when the sender's client did not include waveform
 * data, so the control never collapses to nothing.
 */
export function VoiceMessage({ attachment }: VoiceMessageProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speedIndex, setSpeedIndex] = useState(0);
  const audioSrc = useAuthenticatedMediaSrc(attachment.url);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      void audio.play();
    }
    setPlaying(!playing);
  };

  const cycleSpeed = () => {
    const next = (speedIndex + 1) % PLAYBACK_SPEEDS.length;
    setSpeedIndex(next);
    if (audioRef.current) audioRef.current.playbackRate = PLAYBACK_SPEEDS[next];
  };

  const durationSeconds = attachment.duration
    ? Math.round(attachment.duration / 1000)
    : 0;

  return (
    <div className="mt-1 max-w-sm gap-2 p-2.5 flex items-center rounded-lg border border-border bg-surface">
      <Button
        variant="secondary"
        size="icon-sm"
        onClick={toggle}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
      >
        {playing ? <Pause /> : <Play />}
      </Button>

      <WaveformBars
        samples={attachment.waveform ?? []}
        progress={progress}
        aria-label={`Voice message, ${durationSeconds} seconds`}
      />

      <span className="w-9 text-xs text-right text-muted-foreground tabular-nums">
        {Math.floor(durationSeconds / 60)}:
        {String(durationSeconds % 60).padStart(2, '0')}
      </span>

      <Hint label="Playback speed">
        <button
          type="button"
          onClick={cycleSpeed}
          aria-label={`Playback speed, ${PLAYBACK_SPEEDS[speedIndex]}×. Tap to change.`}
          className="h-6 min-w-8 px-1 text-[11px] font-semibold shrink-0 flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          {PLAYBACK_SPEEDS[speedIndex]}×
        </button>
      </Hint>

      {audioSrc ? (
        <Hint label="Download voice message">
          <a
            href={audioSrc}
            download={attachment.name || 'voice-message'}
            aria-label="Download voice message"
            className="size-7 shrink-0 flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <Download className="size-3.5" />
          </a>
        </Hint>
      ) : null}

      <audio
        ref={audioRef}
        src={audioSrc ?? undefined}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          if (audio.duration) setProgress(audio.currentTime / audio.duration);
        }}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        className="hidden"
      />
    </div>
  );
}

export interface MediaPreviewProps {
  attachment: Attachment;
  kind?: string;
  onOpen?: () => void;
  className?: string;
  showHeader?: boolean;
}

/** Unified Slack-style media preview component handling images, videos, audio, PDFs, and files. */
export function MediaPreview({
  attachment,
  kind,
  onOpen,
  className,
  showHeader = true,
}: MediaPreviewProps) {
  const isPdf =
    attachment.mimeType?.includes('pdf') ||
    attachment.name?.toLowerCase().endsWith('.pdf');

  if (kind === 'image' || attachment.mimeType?.startsWith('image/')) {
    return (
      <ImagePreview
        attachment={attachment}
        onOpen={onOpen}
        className={className}
        showHeader={showHeader}
      />
    );
  }
  if (kind === 'video' || attachment.mimeType?.startsWith('video/')) {
    return (
      <VideoPreview
        attachment={attachment}
        onOpen={onOpen}
        className={className}
        showHeader={showHeader}
      />
    );
  }
  if (kind === 'voice' || attachment.mimeType?.startsWith('audio/')) {
    return <VoiceMessage attachment={attachment} />;
  }
  if (isPdf) {
    return (
      <PdfPreviewCard
        attachment={attachment}
        onOpen={onOpen}
        className={className}
      />
    );
  }
  return (
    <AttachmentCard
      attachment={attachment}
      onOpen={onOpen}
      className={className}
    />
  );
}

export interface AttachmentGridItem {
  attachment: Attachment;
  kind?: string;
  onOpen?: () => void;
}

/** Media tiles beyond this many collapse into a "+N" overlay on the last one. */
const GRID_MEDIA_LIMIT = 4;

function isMediaItem(item: AttachmentGridItem) {
  return (
    item.kind === 'image' ||
    item.kind === 'video' ||
    item.attachment.mimeType?.startsWith('image/') ||
    item.attachment.mimeType?.startsWith('video/')
  );
}

/** One tile inside an {@link AttachmentGrid}. */
function AttachmentGridTile({
  item,
  overflowCount,
  className,
  style,
}: {
  item: AttachmentGridItem;
  overflowCount: number;
  className?: string;
  style?: CSSProperties;
}) {
  const { attachment, kind, onOpen } = item;
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const isVideo = kind === 'video' || attachment.mimeType?.startsWith('video/');
  // Images: the original bytes, for the same full-quality reason as
  // `ImagePreview`. Videos: the sender's poster thumbnail, if any — the tile
  // can't play the video file itself, so there is no "original" fallback.
  const imageSrc = useAuthenticatedMediaSrc(
    isVideo ? attachment.thumbnailUrl : attachment.url,
  );

  if (failed) {
    return (
      <button
        type="button"
        onClick={onOpen}
        style={style}
        className={cn(
          'flex flex-col items-center justify-center gap-1 bg-surface-inset text-muted-foreground',
          className ?? 'aspect-square',
        )}
        aria-label={`Open ${attachment.name}`}
      >
        <FileIcon className="size-5" />
        <span className="max-w-[85%] truncate text-[10px]">{attachment.name}</span>
      </button>
    );
  }

  const handleDownload = async (event: MouseEvent) => {
    event.stopPropagation();
    if (downloading) return;
    setDownloading(true);
    await downloadAttachment(attachment);
    setDownloading(false);
  };

  // Suppressed once this tile is standing in for "N more" — its own name,
  // size and download button would just clutter a control whose entire job
  // is "open the lightbox to see the rest".
  const showTileControls = !overflowCount;

  return (
    // A `div`, not a `<button>` — see `ImagePreview` for why.
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={handleOpenKeyDown(onOpen)}
      style={style}
      className={cn(
        'relative block overflow-hidden bg-surface-inset focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none cursor-pointer group',
        className ?? 'aspect-square',
      )}
      aria-label={`Open ${attachment.name}`}
    >
      {!loaded ? (
        <Skeleton className="inset-0 absolute size-full rounded-none" />
      ) : null}
      <img
        src={imageSrc ?? undefined}
        alt={attachment.name}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={cn(
          'size-full object-cover transition-transform group-hover:scale-105 duration-200',
          loaded ? 'opacity-100' : 'opacity-0',
        )}
      />
      {isVideo && !overflowCount ? (
        <span className="absolute inset-0 flex items-center justify-center bg-black/15">
          <span className="size-8 flex items-center justify-center rounded-full bg-black/60 text-white">
            <Play className="size-3.5 fill-current translate-x-px" />
          </span>
        </span>
      ) : null}

      {showTileControls ? (
        <>
          {/* Filename + size, revealed on hover/focus. */}
          <span
            className={cn(
              'absolute inset-x-0 bottom-0 flex flex-col gap-0 px-1.5 py-1',
              'bg-gradient-to-t from-black/70 to-transparent text-white',
              'opacity-0 transition-opacity duration-150 pointer-events-none',
              'group-hover:opacity-100 group-focus-visible:opacity-100',
            )}
          >
            <span className="truncate text-[10px] font-medium leading-tight">
              {attachment.name}
            </span>
            {attachment.size ? (
              <span className="text-[9px] leading-tight text-white/80">
                {formatBytes(attachment.size)}
              </span>
            ) : null}
          </span>

          <Hint label="Download">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              aria-label={`Download ${attachment.name}`}
              className={cn(
                'absolute top-1.5 right-1.5 size-6 flex items-center justify-center rounded-md bg-black/50 text-white transition-opacity hover:bg-black/70',
                'opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 focus-visible:opacity-100',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70',
              )}
            >
              {downloading ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Download className="size-3" />
              )}
            </button>
          </Hint>
        </>
      ) : null}

      {overflowCount > 0 ? (
        <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-base font-bold text-white">
          +{overflowCount}
        </span>
      ) : null}
    </div>
  );
}

export interface AttachmentGridProps {
  /** The files sent together in one upload, oldest first. */
  items: AttachmentGridItem[];
}

/**
 * Renders a burst of attachments sent as one upload — a Slack/Discord-style
 * grid instead of a stacked row per file. Images and videos tile up to
 * {@link GRID_MEDIA_LIMIT} squares (extra files collapse into a "+N" overlay
 * on the last tile); anything else (voice notes, PDFs, generic files) falls
 * back to the regular full-width card, stacked beneath the grid.
 *
 * A single item skips the grid entirely and renders exactly like a lone
 * attachment always has.
 */
export function AttachmentGrid({ items }: AttachmentGridProps) {
  const [downloadingAll, setDownloadingAll] = useState(false);

  if (items.length === 0) return null;
  if (items.length === 1) {
    const [only] = items;
    return (
      <MediaPreview
        attachment={only.attachment}
        kind={only.kind}
        onOpen={only.onOpen}
      />
    );
  }

  const media = items.filter(isMediaItem);
  const other = items.filter((item) => !isMediaItem(item));
  const visibleMedia = media.slice(0, GRID_MEDIA_LIMIT);
  const overflow = media.length - visibleMedia.length;

  // A 2-up grid uses a wide flex container so the natural aspect ratios
  // of both files (e.g. desktop widescreen + mobile portrait) are preserved
  // side-by-side with full fidelity, matching modern chat designs.
  const gridWidthClass = visibleMedia.length === 2 ? 'max-w-2xl' : 'max-w-lg';

  const downloadAll = async () => {
    if (downloadingAll) return;
    setDownloadingAll(true);
    // One at a time, not `Promise.all` — several browsers treat a burst of
    // simultaneous `<a download>` clicks as a popup flood and silently block
    // all but the first.
    let failures = 0;
    for (const item of items) {
      const ok = await downloadAttachment(item.attachment);
      if (!ok) failures += 1;
    }
    setDownloadingAll(false);
    if (failures === 0) {
      toast.success(`Downloaded ${items.length} files`);
    } else if (failures < items.length) {
      toast.error(`Downloaded ${items.length - failures} of ${items.length} files`);
    }
    // A failure on every file already surfaced one toast per file above.
  };

  return (
    <div
      className={cn(
        'group/attachments relative mt-1.5 space-y-1.5',
        gridWidthClass,
      )}
    >
      {/* Slack-style multi-attachment header: "N files ▼ | ☁ Download all" */}
      <div className="flex items-center gap-2 pb-0.5 text-xs">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="group/grid-hdr inline-flex items-center gap-1 py-0.5 px-1 -ml-1 text-xs font-semibold text-foreground/90 hover:text-foreground transition-colors rounded hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <span>{items.length} files</span>
              <ChevronDown className="size-3 text-muted-foreground transition-transform duration-150 group-data-[state=open]/grid-hdr:rotate-180 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            {items.map((it, idx) => {
              const Icon = iconFor(it.attachment.mimeType ?? '');
              return (
                <DropdownMenuItem
                  key={`${it.attachment.url}-${idx}`}
                  onClick={it.onOpen ?? (() => downloadAttachment(it.attachment))}
                  className="flex items-center justify-between gap-2 text-xs py-1.5 cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{it.attachment.name}</span>
                  </div>
                  {it.attachment.size ? (
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {formatBytes(it.attachment.size)}
                    </span>
                  ) : null}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={downloadAll} className="gap-2 text-xs cursor-pointer">
              <CloudDownload className="size-3.5" />
              <span>Download all</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="text-border text-xs select-none">|</span>

        <Hint label={`Download all ${items.length} files`}>
          <button
            type="button"
            onClick={downloadAll}
            disabled={downloadingAll}
            aria-label={`Download all ${items.length} files`}
            className={cn(
              'inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded py-0.5 px-1',
              'disabled:opacity-50 disabled:cursor-wait',
            )}
          >
            {downloadingAll ? (
              <Loader2 className="size-3.5 animate-spin text-primary" />
            ) : (
              <CloudDownload className="size-3.5" />
            )}
            <span>Download all</span>
          </button>
        </Hint>
      </div>

      {media.length === 1 ? (
        <MediaPreview
          attachment={media[0].attachment}
          kind={media[0].kind}
          onOpen={media[0].onOpen}
          showHeader={false}
        />
      ) : visibleMedia.length === 2 ? (
        <div className="flex items-stretch gap-1.5 overflow-hidden rounded-xl border border-border/80 bg-surface-inset/30 h-[260px] sm:h-[320px] shadow-xs">
          {visibleMedia.map((item, index) => {
            const ratio =
              item.attachment.width && item.attachment.height
                ? item.attachment.width / item.attachment.height
                : index === 0
                ? 1.4
                : 0.9;
            return (
              <AttachmentGridTile
                key={`${item.attachment.url}-${index}`}
                item={item}
                overflowCount={
                  index === visibleMedia.length - 1 ? overflow : 0
                }
                className="h-full min-w-0"
                style={{ flex: `${ratio} ${ratio} 0px` }}
              />
            );
          })}
        </div>
      ) : media.length > 1 ? (
        <div
          className={cn(
            'grid gap-1 overflow-hidden rounded-xl border border-border/80 shadow-xs',
            visibleMedia.length === 3 && 'grid-cols-3',
            visibleMedia.length >= 4 && 'grid-cols-2',
          )}
        >
          {visibleMedia.map((item, index) => (
            <AttachmentGridTile
              key={`${item.attachment.url}-${index}`}
              item={item}
              overflowCount={
                index === visibleMedia.length - 1 ? overflow : 0
              }
            />
          ))}
        </div>
      ) : null}

      {other.map((item, index) => (
        <MediaPreview
          key={`${item.attachment.url}-${index}`}
          attachment={item.attachment}
          kind={item.kind}
          onOpen={item.onOpen}
          className="mt-1"
          showHeader={false}
        />
      ))}
    </div>
  );
}

/** Picks the right renderer for a message's attachment. */
export function AttachmentRenderer({
  attachment,
  kind,
  onOpen,
  onOpenImage,
}: {
  attachment: Attachment;
  kind: string;
  onOpen?: () => void;
  onOpenImage?: () => void;
}) {
  const handleOpen = onOpen ?? onOpenImage;
  return (
    <MediaPreview
      attachment={attachment}
      kind={kind}
      onOpen={handleOpen}
    />
  );
}
