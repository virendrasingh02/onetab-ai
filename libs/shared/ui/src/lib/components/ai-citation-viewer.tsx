import { cn } from '@org/utils';
import { ExternalLink, FileText, Globe, Link2, Quote } from 'lucide-react';
import type { ComponentProps } from 'react';

import { Badge } from './badge.js';
import { Popover, PopoverContent, PopoverTrigger } from './popover.js';

export interface AICitation {
  id: string | number;
  title: string;
  url?: string;
  sourceName?: string;
  snippet?: string;
  relevanceScore?: number; // 0 to 1
  pageNumber?: number;
}

export interface AICitationViewerProps extends ComponentProps<'div'> {
  citations: AICitation[];
  inline?: boolean;
}

export function AICitationViewer({ citations, inline: _inline = false, className, ...props }: AICitationViewerProps) {
  if (citations.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)} {...props}>
      <span className="text-[11px] font-medium text-subtle mr-1 flex items-center gap-1">
        <Link2 className="size-3" />
        Sources:
      </span>
      {citations.map((c, idx) => (
        <Popover key={c.id}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'inline-flex items-center gap-1 rounded-btn border border-border bg-surface px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground shadow-xs cursor-pointer',
                'transition-all duration-(--duration-fast) hover:border-primary/50 hover:bg-selected hover:text-foreground outline-none',
              )}
            >
              {c.url ? <Globe className="size-2.5 text-primary" /> : <FileText className="size-2.5 text-info" />}
              <span className="font-semibold text-foreground">[{idx + 1}]</span>
              <span className="max-w-24 truncate">{c.sourceName ?? c.title}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3 text-xs shadow-overlay" align="start">
            <div className="flex items-start justify-between gap-2 border-b border-border pb-2">
              <div className="font-semibold text-foreground line-clamp-1">{c.title}</div>
              {c.relevanceScore !== undefined && (
                <Badge variant="secondary" className="font-mono text-[9px] h-4">
                  {Math.round(c.relevanceScore * 100)}% match
                </Badge>
              )}
            </div>

            {c.snippet && (
              <div className="mt-2 rounded-sm bg-surface-raised p-2 text-[11px] text-muted-foreground italic leading-relaxed border-l-2 border-primary flex items-start gap-1.5">
                <Quote className="size-3 shrink-0 text-primary mt-0.5" />
                <span>&ldquo;{c.snippet}&rdquo;</span>
              </div>
            )}

            <div className="mt-2.5 flex items-center justify-between text-[11px] pt-1 text-subtle">
              <span>{c.sourceName ?? 'Document / Web'}</span>
              {c.url && (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                >
                  Visit source
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
}
