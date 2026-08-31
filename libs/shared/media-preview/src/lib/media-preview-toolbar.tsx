import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Hint,
  IconButton,
  toast,
  UserAvatar,
} from '@org/ui';
import { cn, formatBytes, formatRelative } from '@org/utils';
import {
  Copy,
  Download,
  ExternalLink,
  Lock,
  MoreHorizontal,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { MediaItem } from './types.js';

export interface MediaPreviewToolbarProps {
  item: MediaItem;
  index: number;
  count: number;
  resolvedUrl?: string;
  isResolving?: boolean;
  onDownload: () => void;
  onClose: () => void;
  /** Category-specific actions (PDF's Print, Search toggle, ...), rendered
   * before the generic Download/More/Close group. */
  extraActions?: ReactNode;
  className?: string;
}

/** Plain file heading, shown when there is no uploader to introduce. */
function describeItem(item: MediaItem): string {
  const parts = [item.mimeType.split('/')[1]?.toUpperCase() || item.category];
  if (item.size) parts.push(formatBytes(item.size));
  return parts.join(' • ');
}

export function MediaPreviewToolbar({
  item,
  index,
  count,
  resolvedUrl,
  isResolving,
  onDownload,
  onClose,
  extraActions,
  className,
}: MediaPreviewToolbarProps) {
  const openUrl = item.url ?? resolvedUrl;
  const isHttpUrl = !!openUrl && /^https?:\/\//i.test(openUrl);

  const uploaderName =
    item.senderName ||
    (typeof item.metadata?.uploader === 'string' ? item.metadata.uploader : undefined) ||
    (typeof item.metadata?.author === 'string' ? item.metadata.author : undefined);

  const uploaderAvatar =
    item.senderAvatarUrl ||
    (typeof item.metadata?.avatarUrl === 'string' ? item.metadata.avatarUrl : undefined);

  const uploaderId =
    item.senderId ||
    (typeof item.metadata?.uploaderId === 'string' ? item.metadata.uploaderId : undefined) ||
    uploaderName;

  const channelName =
    item.channelName ||
    (typeof item.metadata?.channelName === 'string' ? item.metadata.channelName : undefined);

  const rawTimestamp = item.timestamp ?? item.metadata?.createdAt;
  const parsedTime = rawTimestamp != null ? new Date(rawTimestamp) : null;
  const relativeTime =
    parsedTime && !Number.isNaN(parsedTime.getTime())
      ? formatRelative(parsedTime)
      : null;

  const copyLink = async () => {
    if (!openUrl) return;
    try {
      await navigator.clipboard.writeText(openUrl);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy link');
    }
  };

  return (
    <div
      className={cn(
        'gap-3 px-3 sm:px-4 h-16 flex shrink-0 items-center justify-between border-b border-border/60 bg-popover text-popover-foreground',
        className,
      )}
    >
      {uploaderName ? (
        /* Uploader profile & file context */
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <UserAvatar
            name={uploaderName}
            src={uploaderAvatar}
            seed={uploaderId}
            presence={item.senderPresence}
            statusEmoji={item.senderStatusEmoji}
            statusText={item.senderStatusText}
            size="md"
            className="size-9 shrink-0 ring-1 ring-border/50"
          />

          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-semibold leading-tight text-foreground">
                {uploaderName}
              </span>
              {count > 1 ? (
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                  {index + 1} / {count}
                </span>
              ) : null}
            </div>

            <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] leading-none text-muted-foreground">
              {relativeTime ? <span className="shrink-0">{relativeTime}</span> : null}

              {channelName ? (
                <span className="flex shrink-0 items-center gap-1">
                  <span>in</span>
                  {item.isEncrypted ? (
                    <Lock
                      className="size-2.5 text-muted-foreground/80"
                      aria-label="Encrypted"
                    />
                  ) : null}
                  <span className="font-medium text-foreground/90">{channelName}</span>
                </span>
              ) : null}

              {relativeTime || channelName ? (
                <span aria-hidden className="text-muted-foreground/40">
                  •
                </span>
              ) : null}

              <span className="truncate font-medium text-foreground/90">{item.name}</span>

              {item.size ? (
                <>
                  <span aria-hidden className="hidden text-muted-foreground/40 sm:inline">
                    •
                  </span>
                  <span className="hidden shrink-0 sm:inline">{formatBytes(item.size)}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
            <p className="hidden text-[11px] text-muted-foreground sm:block">
              {describeItem(item)}
              {count > 1 ? ` • ${index + 1} / ${count}` : ''}
            </p>
          </div>

          {count > 1 ? (
            <span className="shrink-0 text-xs text-muted-foreground sm:hidden">
              {index + 1} / {count}
            </span>
          ) : null}
        </>
      )}

      <div className="gap-1 flex shrink-0 items-center">
        {extraActions}

        <Hint label="Download" shortcut="D">
          <IconButton
            variant="ghost"
            size="icon-sm"
            aria-label="Download"
            onClick={onDownload}
            disabled={isResolving || (!item.url && !resolvedUrl)}
          >
            <Download />
          </IconButton>
        </Hint>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton variant="ghost" size="icon-sm" aria-label="More actions">
              <MoreHorizontal />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {isHttpUrl ? (
              <DropdownMenuItem asChild>
                <a href={openUrl} target="_blank" rel="noreferrer noopener">
                  <ExternalLink /> Open in new tab
                </a>
              </DropdownMenuItem>
            ) : null}
            {isHttpUrl ? (
              <DropdownMenuItem onSelect={copyLink}>
                <Copy /> Copy link
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              onSelect={onDownload}
              disabled={isResolving || (!item.url && !resolvedUrl)}
            >
              <Download /> Download
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Hint label="Close" shortcut="Esc">
          <IconButton variant="ghost" size="icon-sm" aria-label="Close preview" onClick={onClose}>
            <X />
          </IconButton>
        </Hint>
      </div>
    </div>
  );
}
