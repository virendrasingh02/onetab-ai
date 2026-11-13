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

export function AICitationViewer({
  citations,
  inline: _inline = false,
  className,
  ...props
}: AICitationViewerProps) {
  if (citations.length === 0) return null;

  return (
    <div
      className={cn('gap-1.5 flex flex-wrap items-center', className)}
      {...props}
    >
      <span className="font-medium mr-1 gap-1 flex items-center text-meta text-subtle">
        <Link2 className="size-3" />
        Sources:
      </span>
      {citations.map((c, idx) => (
        <Popover key={c.id}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className={cn(
                'gap-1 px-1.5 py-0.5 inline-flex cursor-pointer items-center rounded-btn border border-border bg-surface font-mono text-2xs text-muted-foreground shadow-xs',
                'transition-all duration-(--duration-fast) outline-none hover:border-brand/50 hover:bg-selected hover:text-foreground',
              )}
            >
              {c.url ? (
                <Globe className="size-2.5 text-brand-text" />
              ) : (
                <FileText className="size-2.5 text-info" />
              )}
              <span className="font-semibold text-foreground">[{idx + 1}]</span>
              <span className="max-w-24 truncate">
                {c.sourceName ?? c.title}
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent
            className="w-80 p-3 text-xs shadow-overlay"
            align="start"
          >
            <div className="gap-2 pb-2 flex items-start justify-between border-b border-border">
              <div className="font-semibold line-clamp-1 text-foreground">
                {c.title}
              </div>
              {c.relevanceScore !== undefined && (
                <Badge variant="secondary" className="h-4 font-mono text-3xs">
                  {Math.round(c.relevanceScore * 100)}% match
                </Badge>
              )}
            </div>

            {c.snippet && (
              <div className="mt-2 p-2 leading-relaxed gap-1.5 flex items-start rounded-sm border-l-2 border-brand bg-surface-raised text-meta text-muted-foreground italic">
                <Quote className="size-3 mt-0.5 shrink-0 text-brand-text" />
                <span>&ldquo;{c.snippet}&rdquo;</span>
              </div>
            )}

            <div className="mt-2.5 pt-1 flex items-center justify-between text-meta text-subtle">
              <span>{c.sourceName ?? 'Document / Web'}</span>
              {c.url && (
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="gap-1 font-medium inline-flex items-center text-brand-text hover:underline"
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
