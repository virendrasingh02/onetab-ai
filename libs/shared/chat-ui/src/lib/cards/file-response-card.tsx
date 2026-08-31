import { generatedFileToMediaItem, useMediaPreview } from '@org/media-preview';
import type { FileMessageContent, GeneratedFile, Message } from '@org/types';
import { Button } from '@org/ui';
import { cn } from '@org/utils';
import {
  Download,
  Eye,
  FileCode,
  FileSpreadsheet,
  FileText,
  ImageIcon,
} from 'lucide-react';

export interface FileResponseCardProps {
  message: Message;
  event: FileMessageContent;
  isHighlighted?: boolean;
}

export function FileResponseCard({
  message,
  event,
  isHighlighted = false,
}: FileResponseCardProps) {
  const { openPreview } = useMediaPreview();

  const getFileIcon = (file: GeneratedFile) => {
    if (file.mimeType.startsWith('image/')) return <ImageIcon className="size-4 text-success" />;
    if (file.mimeType.includes('csv') || file.mimeType.includes('spreadsheet') || file.name.endsWith('.xlsx') || file.name.endsWith('.csv')) {
      return <FileSpreadsheet className="size-4 text-success" />;
    }
    if (file.codeSnippet || file.name.endsWith('.ts') || file.name.endsWith('.js') || file.name.endsWith('.py')) {
      return <FileCode className="size-4 text-info-text" />;
    }
    return <FileText className="size-4 text-primary" />;
  };

  return (
    <article
      data-message-id={message.id}
      className={cn(
        'group/file-card relative my-2 rounded-2xl border border-border/80 bg-surface/95 backdrop-blur-sm p-4 transition-all duration-200 shadow-xs hover:shadow-md max-w-lg',
        isHighlighted && 'ring-2 ring-primary/60',
      )}
    >
      <header className="border-b border-border/60 pb-2.5">
        <h3 className="text-sm font-bold text-foreground">{event.title || 'Generated Outputs & Files'}</h3>
        {event.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
        )}
      </header>

      <div className="mt-3 space-y-2">
        {event.files.map((file, idx) => (
          <div
            key={idx}
            className="p-3 rounded-xl border border-border bg-surface-raised flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="size-9 rounded-lg bg-surface flex items-center justify-center shrink-0 border border-border/60">
                {getFileIcon(file)}
              </div>
              <div className="min-w-0">
                <span className="font-bold text-foreground truncate block">{file.name}</span>
                <span className="text-[10px] text-muted-foreground block">
                  {file.mimeType} {file.size ? `· ${(file.size / 1024).toFixed(1)} KB` : ''}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  openPreview(event.files.map(generatedFileToMediaItem), idx)
                }
                className="h-7 text-xs px-2"
              >
                <Eye className="size-3.5 mr-1" />
                <span>Preview</span>
              </Button>
              <a
                href={file.url}
                download={file.name}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-surface text-xs font-semibold text-foreground hover:bg-accent transition-colors shadow-2xs"
              >
                <Download className="size-3" />
                <span>Download</span>
              </a>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
