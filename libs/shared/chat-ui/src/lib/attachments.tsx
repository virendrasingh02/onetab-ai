import type { Attachment } from '@org/types';
import { Button, Skeleton } from '@org/ui';
import { cn, formatBytes } from '@org/utils';
import {
  Download,
  File as FileIcon,
  FileText,
  Film,
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
  className?: string;
}

/** Non-media attachment row: icon, name, size, download. */
export function AttachmentCard({ attachment, className }: AttachmentCardProps) {
  const Icon = iconFor(attachment.mimeType);

  return (
    <a
      href={attachment.url}
      download={attachment.name}
      target="_blank"
      rel="noreferrer noopener"
      className={cn(
        'group/attachment mt-1 max-w-sm gap-3 p-2.5 flex items-center rounded-lg border transition-colors',
        'hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none',
        className,
      )}
    >
      <span className="size-9 flex shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-sm font-medium block truncate">
          {attachment.name}
        </span>
        <span className="text-xs block text-muted-foreground">
          {attachment.size ? formatBytes(attachment.size) : attachment.mimeType}
        </span>
      </span>
      <Download className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover/attachment:opacity-100" />
    </a>
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
    return <AttachmentCard attachment={attachment} />;
  }

  return (
    <button
      onClick={onOpen}
      className="mt-1 max-w-sm block overflow-hidden rounded-lg border focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
      aria-label={`Open image ${attachment.name}`}
    >
      <span className="relative block" style={{ aspectRatio: ratio }}>
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
            'size-full object-cover transition-opacity',
            loaded ? 'opacity-100' : 'opacity-0',
          )}
        />
      </span>
    </button>
  );
}

export function VideoPreview({ attachment }: { attachment: Attachment }) {
  return (
    <video
      controls
      preload="metadata"
      poster={attachment.thumbnailUrl}
      className="mt-1 max-w-sm rounded-lg border"
      aria-label={attachment.name}
    >
      <source src={attachment.url} type={attachment.mimeType} />
      Your browser cannot play this video.
    </video>
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
    <div className="mt-1 max-w-sm gap-3 p-2.5 flex items-center rounded-lg border">
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

/** Picks the right renderer for a message's attachment. */
export function AttachmentRenderer({
  attachment,
  kind,
  onOpenImage,
}: {
  attachment: Attachment;
  kind: string;
  onOpenImage?: () => void;
}) {
  switch (kind) {
    case 'image':
      return <ImagePreview attachment={attachment} onOpen={onOpenImage} />;
    case 'video':
      return <VideoPreview attachment={attachment} />;
    case 'voice':
      return <VoiceMessage attachment={attachment} />;
    default:
      return <AttachmentCard attachment={attachment} />;
  }
}
