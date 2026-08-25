import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Hint,
  IconButton,
  toast,
} from '@org/ui';
import { cn, formatBytes } from '@org/utils';
import {
  Copy,
  Download,
  ExternalLink,
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
        'gap-3 px-3 sm:px-4 h-14 flex shrink-0 items-center justify-between border-b border-border/60 bg-popover text-popover-foreground',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate text-foreground">{item.name}</p>
        <p className="text-[11px] hidden text-muted-foreground sm:block">
          {describeItem(item)}
          {count > 1 ? ` • ${index + 1} / ${count}` : ''}
        </p>
      </div>

      {count > 1 ? (
        <span className="text-xs text-muted-foreground shrink-0 sm:hidden">
          {index + 1} / {count}
        </span>
      ) : null}

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
