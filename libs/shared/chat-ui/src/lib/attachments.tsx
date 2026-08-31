import type { Attachment } from '@org/types';
import { Button, Skeleton } from '@org/ui';
import { cn, formatBytes } from '@org/utils';
import {
  Download,
  ExternalLink,
  File as FileIcon,
  FileText,
  Film,
  Maximize2,
  Music,
  Pause,
  Play,
} from 'lucide-react';
import { useRef, useState } from 'react';

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
}

/**
 * Inline image.
 *
 * The intrinsic width/height are applied as an aspect ratio so the timeline
 * does not reflow when the image loads — the single biggest cause of a jumping
 * scroll position in a message list.
 */
export function ImagePreview({ attachment, onOpen }: ImagePreviewProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const ratio =
    attachment.width && attachment.height
      ? attachment.width / attachment.height
      : 4 / 3;

  if (failed) {
    return <AttachmentCard attachment={attachment} onOpen={onOpen} />;
  }

  return (
    <button
      onClick={onOpen}
      className="mt-1 max-w-sm block overflow-hidden rounded-lg border border-border bg-surface focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none cursor-pointer group"
      aria-label={`Open image ${attachment.name}`}
    >
      <span className="relative block overflow-hidden" style={{ aspectRatio: ratio }}>
        {!loaded ? (
          <Skeleton className="inset-0 absolute size-full rounded-none" />
        ) : null}
        <img
          src={attachment.thumbnailUrl ?? attachment.url}
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
      </span>
    </button>
  );
}

export function VideoPreview({
  attachment,
  onOpen,
}: {
  attachment: Attachment;
  onOpen?: () => void;
}) {
  return (
    <div className="relative mt-1 max-w-sm rounded-lg border border-border bg-surface overflow-hidden">
      <video
        controls
        preload="metadata"
        poster={attachment.thumbnailUrl}
        className="w-full max-h-64 object-contain bg-surface-inset"
        aria-label={attachment.name}
      >
        <source src={attachment.url} type={attachment.mimeType} />
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
  );
}

export interface VoiceMessageProps {
  attachment: Attachment;
}

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

  const samples =
    attachment.waveform?.length && attachment.waveform.length > 1
      ? attachment.waveform
      : Array.from({ length: 32 }, () => 0.35);

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

  const durationSeconds = attachment.duration
    ? Math.round(attachment.duration / 1000)
    : 0;

  return (
    <div className="mt-1 max-w-sm gap-3 p-2.5 flex items-center rounded-lg border border-border bg-surface">
      <Button
        variant="secondary"
        size="icon-sm"
        onClick={toggle}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
      >
        {playing ? <Pause /> : <Play />}
      </Button>

      <div
        className="h-8 flex flex-1 items-center gap-px"
        role="img"
        aria-label={`Voice message, ${durationSeconds} seconds`}
      >
        {samples.map((sample, index) => {
          const played = index / samples.length <= progress;
          return (
            <span
              key={index}
              className={cn(
                'flex-1 rounded-full',
                played ? 'bg-primary' : 'bg-muted-foreground/30',
              )}
              style={{ height: `${Math.max(10, sample * 100)}%` }}
            />
          );
        })}
      </div>

      <span className="w-9 text-xs text-right text-muted-foreground tabular-nums">
        {Math.floor(durationSeconds / 60)}:
        {String(durationSeconds % 60).padStart(2, '0')}
      </span>

      <audio
        ref={audioRef}
        src={attachment.url}
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
}

/** Unified Slack-style media preview component handling images, videos, audio, PDFs, and files. */
export function MediaPreview({
  attachment,
  kind,
  onOpen,
  className,
}: MediaPreviewProps) {
  const isPdf =
    attachment.mimeType?.includes('pdf') ||
    attachment.name?.toLowerCase().endsWith('.pdf');

  if (kind === 'image' || attachment.mimeType?.startsWith('image/')) {
    return <ImagePreview attachment={attachment} onOpen={onOpen} />;
  }
  if (kind === 'video' || attachment.mimeType?.startsWith('video/')) {
    return <VideoPreview attachment={attachment} onOpen={onOpen} />;
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
