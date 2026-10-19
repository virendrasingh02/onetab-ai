import { Button, UserAvatar } from '@org/ui';
import { cn, formatBytes } from '@org/utils';
import {
  AlertCircle,
  Check,
  File as FileIcon,
  Loader2,
  RotateCcw,
  X,
} from 'lucide-react';
import { useState, type CSSProperties } from 'react';
import { MediaMosaic } from './media-mosaic.js';

export interface PendingUploadMessageFile {
  name: string;
  mimeType: string;
  size: number;
  /** Local object URL — shown instantly, before anything reaches the server. */
  previewUrl?: string;
  /** 0..100. */
  progress: number;
  status: 'uploading' | 'uploaded' | 'failed';
}

export interface PendingUploadMessageProps {
  senderId: string;
  senderName: string;
  senderAvatarUrl?: string;
  files: readonly PendingUploadMessageFile[];
  /** `sending`: every file is uploaded and the message is going out. */
  status: 'uploading' | 'sending' | 'failed';
  error?: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  compact?: boolean;
}

function isMedia(file: PendingUploadMessageFile) {
  return file.mimeType.startsWith('image/') || file.mimeType.startsWith('video/');
}

/** A thin determinate bar. */
function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className={cn('h-1 w-full overflow-hidden rounded-full bg-foreground/10', className)}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-200 ease-out"
        style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/** One image/video tile, previewed from the local file while it uploads. */
function UploadingTile({
  file,
  overflowCount,
  className,
  style,
  onNaturalRatio,
}: {
  file: PendingUploadMessageFile;
  overflowCount: number;
  className: string;
  style: CSSProperties;
  onNaturalRatio: (ratio: number) => void;
}) {
  const isVideo = file.mimeType.startsWith('video/');
  return (
    <div
      style={style}
      className={cn('relative overflow-hidden bg-surface-inset', className)}
      aria-label={`${file.name}, ${
        file.status === 'failed'
          ? 'failed'
          : file.status === 'uploaded'
            ? 'uploaded'
            : `${file.progress}% uploaded`
      }`}
    >
      {file.previewUrl ? (
        isVideo ? (
          <video
            src={file.previewUrl}
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={(event) => {
              const { videoWidth, videoHeight } = event.currentTarget;
              if (videoWidth && videoHeight) onNaturalRatio(videoWidth / videoHeight);
            }}
            className="size-full object-cover"
          />
        ) : (
          <img
            src={file.previewUrl}
            alt=""
            onLoad={(event) => {
              const { naturalWidth, naturalHeight } = event.currentTarget;
              if (naturalWidth && naturalHeight) {
                onNaturalRatio(naturalWidth / naturalHeight);
              }
            }}
            className="size-full object-cover"
          />
        )
      ) : (
        <span className="flex size-full items-center justify-center text-muted-foreground">
          <FileIcon className="size-5" />
        </span>
      )}

      {/* Dimmed until it lands, so "still uploading" reads at a glance. */}
      <span
        className={cn(
          'absolute inset-0 transition-colors duration-300',
          file.status === 'uploaded'
            ? 'bg-transparent'
            : file.status === 'failed'
              ? 'bg-destructive/40'
              : 'bg-black/35',
        )}
      />

      {overflowCount > 0 ? (
        <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-base font-bold text-white">
          +{overflowCount}
        </span>
      ) : file.status === 'failed' ? (
        <span className="absolute inset-0 flex items-center justify-center text-white">
          <AlertCircle className="size-6 drop-shadow" />
        </span>
      ) : file.status === 'uploaded' ? (
        <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-black/55 text-white">
          <Check className="size-3" />
        </span>
      ) : (
        <span className="absolute inset-x-2 bottom-2 flex flex-col gap-1">
          <span className="self-end rounded bg-black/55 px-1 text-2xs font-medium tabular-nums text-white">
            {file.progress}%
          </span>
          <ProgressBar value={file.progress} className="bg-white/30" />
        </span>
      )}
    </div>
  );
}

/** A non-media file (PDF, doc, zip…) uploading, as a slim card. */
function UploadingFileCard({ file }: { file: PendingUploadMessageFile }) {
  return (
    <div className="flex w-full max-w-sm items-center gap-3 rounded-lg border border-border/80 bg-surface-raised px-3 py-2">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-inset text-muted-foreground">
        {file.status === 'failed' ? (
          <AlertCircle className="size-4 text-destructive" />
        ) : file.status === 'uploaded' ? (
          <Check className="size-4 text-success" />
        ) : (
          <FileIcon className="size-4" />
        )}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">{file.name}</span>
          <span className="shrink-0 text-2xs tabular-nums text-muted-foreground">
            {file.status === 'uploading'
              ? `${file.progress}%`
              : formatBytes(file.size)}
          </span>
        </div>
        {file.status === 'uploading' ? <ProgressBar value={file.progress} /> : null}
      </div>
    </div>
  );
}

/**
 * The sender's own upload while it is still going out: one message holding
 * every file, each previewed locally with its own progress. The real message
 * replaces it once the files are sent; a failure stays here with Retry.
 */
export function PendingUploadMessage({
  senderId,
  senderName,
  senderAvatarUrl,
  files,
  status,
  error,
  onRetry,
  onDismiss,
  compact = false,
}: PendingUploadMessageProps) {
  const [ratios, setRatios] = useState<Record<number, number>>({});
  const media = files.flatMap((file, index) => (isMedia(file) ? [{ file, index }] : []));
  const others = files.filter((file) => !isMedia(file));

  const totalBytes = files.reduce((acc, file) => acc + (file.size || 1), 0);
  const sentBytes = files.reduce(
    (acc, file) => acc + ((file.size || 1) * file.progress) / 100,
    0,
  );
  const overall = totalBytes ? Math.round((sentBytes / totalBytes) * 100) : 0;
  const done = files.filter((file) => file.status === 'uploaded').length;
  const noun = files.length === 1 ? 'file' : 'files';

  return (
    <article
      aria-label={`${senderName} is uploading ${files.length} ${noun}`}
      aria-busy={status !== 'failed'}
      className={cn(
        'relative flex gap-x-4 px-4 pb-0.5 pt-2.5',
        compact && 'gap-x-2.5 px-3 pt-1',
        status === 'failed' && 'bg-destructive/5',
      )}
    >
      <UserAvatar
        name={senderName}
        src={senderAvatarUrl}
        seed={senderId}
        size={compact ? 'sm' : 'md'}
        className={cn('shrink-0', compact ? 'size-8' : 'size-10')}
        indicator={false}
      />

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-semibold">{senderName}</span>
          <span
            className={cn(
              'inline-flex items-center gap-1 text-xs',
              status === 'failed' ? 'text-destructive' : 'text-muted-foreground',
            )}
            aria-live="polite"
          >
            {status === 'failed' ? (
              <>
                <AlertCircle className="size-3" />
                {error ?? 'Upload failed.'}
              </>
            ) : status === 'sending' ? (
              <>
                <Loader2 className="size-3 animate-spin" />
                Sending {files.length} {noun}…
              </>
            ) : (
              <>
                <Loader2 className="size-3 animate-spin" />
                Uploading {files.length > 1 ? `${done} of ${files.length} ${noun}` : firstFileName(files)}
                {' · '}
                <span className="tabular-nums">{overall}%</span>
              </>
            )}
          </span>
        </div>

        {media.length > 0 ? (
          <div className="w-full max-w-xl">
            <MediaMosaic
              items={media.map(({ file, index }) => ({
                key: `${index}-${file.name}`,
                ratio: ratios[index],
                render: (box) => (
                  <UploadingTile
                    file={file}
                    overflowCount={box.overflowCount}
                    className={box.className}
                    style={box.style}
                    onNaturalRatio={(ratio) =>
                      setRatios((current) =>
                        current[index] === ratio ? current : { ...current, [index]: ratio },
                      )
                    }
                  />
                ),
              }))}
            />
          </div>
        ) : null}

        {others.length > 0 ? (
          <div className="space-y-1">
            {others.map((file, index) => (
              <UploadingFileCard key={`${index}-${file.name}`} file={file} />
            ))}
          </div>
        ) : null}

        {status === 'failed' && (onRetry || onDismiss) ? (
          <div className="flex items-center gap-2 pt-0.5">
            {onRetry ? (
              <Button size="sm" variant="outline" onClick={onRetry} className="gap-1.5">
                <RotateCcw className="size-3.5" />
                Retry
              </Button>
            ) : null}
            {onDismiss ? (
              <Button size="sm" variant="ghost" onClick={onDismiss} className="gap-1.5">
                <X className="size-3.5" />
                Dismiss
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function firstFileName(files: readonly PendingUploadMessageFile[]) {
  return files[0]?.name ?? 'file';
}
