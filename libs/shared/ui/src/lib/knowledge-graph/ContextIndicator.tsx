import { useState } from 'react';
import type { ContextSourceItem } from '@org/types';
import { cn } from '@org/utils';
import { ChevronDown, ChevronRight, ExternalLink, Sparkles } from 'lucide-react';
import { getEntityIcon, getEntityTypeBadgeColor } from './GraphEntity.js';

export interface ContextIndicatorProps {
  sources?: ContextSourceItem[];
  tokensSaved?: number;
  tokensUsed?: number;
  className?: string;
}

export function ContextIndicator({
  sources = [],
  tokensSaved,
  tokensUsed,
  className,
}: ContextIndicatorProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (sources.length === 0) return null;

  return (
    <div
      className={cn(
        'my-2 rounded-lg border border-primary/20 bg-primary/5 text-xs text-foreground transition-all',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2 text-left hover:bg-primary/10 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-1.5 font-medium text-primary">
          <Sparkles className="size-3.5" />
          <span>Using workspace context</span>
          <span className="text-[11px] text-muted-foreground font-normal">
            ({sources.length} {sources.length === 1 ? 'source' : 'sources'}
            {typeof tokensSaved === 'number' && tokensSaved > 0 ? `, ~${tokensSaved} tokens saved` : ''})
          </span>
        </div>

        <div className="text-muted-foreground">
          {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </div>
      </button>

      {isExpanded && (
        <div className="p-3 pt-1 border-t border-primary/10 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sources.map((source) => {
              const Icon = getEntityIcon(source.entityType);
              const badgeColor = getEntityTypeBadgeColor(source.entityType);
              return (
                <div
                  key={source.id}
                  className="p-2 rounded border border-border bg-card/80 flex items-start gap-2 text-left"
                >
                  <div className={cn('p-1 rounded shrink-0 border', badgeColor)}>
                    <Icon className="size-3" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-foreground truncate max-w-[150px]">
                        {source.title}
                      </span>
                      {source.link && (
                        <a
                          href={source.link.startsWith('http') ? source.link : `#/${source.link}`}
                          target={source.link.startsWith('http') ? '_blank' : '_self'}
                          rel="noreferrer"
                          className="text-muted-foreground hover:text-primary"
                        >
                          <ExternalLink className="size-2.5" />
                        </a>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">
                      {source.snippet}
                    </p>
                    {source.connectedEntities && source.connectedEntities.length > 0 && (
                      <div className="text-[9px] text-primary/80 truncate">
                        Linked: {source.connectedEntities.map((c) => c.name).join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {typeof tokensUsed === 'number' && (
            <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1 border-t border-border/50">
              <span>Token budget used: {tokensUsed} tokens</span>
              <span>Context Engine: Compact Subgraph</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
