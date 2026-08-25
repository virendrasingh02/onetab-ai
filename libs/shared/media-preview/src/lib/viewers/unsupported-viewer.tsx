import { Button } from '@org/ui';
import { formatBytes } from '@org/utils';
import {
  Download,
  ExternalLink,
  File as FileIcon,
  FileArchive,
  FileText,
} from 'lucide-react';
import type { MediaCategory, MediaItem } from '../types.js';

const CATEGORY_ICON: Partial<Record<MediaCategory, typeof FileIcon>> = {
  office: FileText,
  archive: FileArchive,
};

const CATEGORY_LABEL: Partial<Record<MediaCategory, string>> = {
  office: 'Office document',
  archive: 'Archive',
};

export interface UnsupportedViewerProps {
  item: MediaItem;
  isLoading?: boolean;
  onDownload: () => void;
}

/** Office documents (no conversion backend exists) and anything else this
 * browser can't safely render — never a blank or broken preview. */
export function UnsupportedViewer({ item, isLoading, onDownload }: UnsupportedViewerProps) {
  const isHttpUrl = !!item.url && /^https?:\/\//i.test(item.url);
  const Icon = CATEGORY_ICON[item.category] ?? FileIcon;
  const label = CATEGORY_LABEL[item.category] ?? item.mimeType;

  return (
    <div className="gap-4 h-full flex flex-col items-center justify-center p-8 text-center text-popover-foreground">
      <span className="size-16 flex items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="size-8" />
      </span>

      <div>
        <p className="text-sm font-semibold">{item.name}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {label}
          {item.size ? ` • ${formatBytes(item.size)}` : ''}
        </p>
      </div>

      <p className="max-w-sm text-sm text-muted-foreground">
        This file cannot be previewed here.
      </p>

      <div className="gap-2 flex items-center">
        <Button onClick={onDownload} loading={isLoading} leadingIcon={<Download />}>
          Download File
        </Button>
        {isHttpUrl ? (
          <Button variant="outline" asChild>
            <a href={item.url} target="_blank" rel="noreferrer noopener">
              <ExternalLink /> Open externally
            </a>
          </Button>
        ) : null}
      </div>
    </div>
  );
}
