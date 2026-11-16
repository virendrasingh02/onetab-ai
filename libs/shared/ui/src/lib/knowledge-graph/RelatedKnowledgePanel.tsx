import type { GraphEntityType } from '@org/types';
import { cn } from '@org/utils';
import { ExternalLink, Network } from 'lucide-react';
import { getEntityIcon, getEntityTypeBadgeColor } from './GraphEntity.js';

export interface RelatedKnowledgeItem {
  id: string;
  name: string;
  entityType: GraphEntityType;
  identifier?: string;
  link?: string;
  relation?: string;
}

export interface RelatedKnowledgePanelProps {
  title?: string;
  items: RelatedKnowledgeItem[];
  isLoading?: boolean;
  onItemClick?: (item: RelatedKnowledgeItem) => void;
  className?: string;
}

export function RelatedKnowledgePanel({
  title = 'Related Knowledge',
  items,
  isLoading = false,
  onItemClick,
  className,
}: RelatedKnowledgePanelProps) {
  if (isLoading) {
    return (
      <div className={cn('p-4 rounded-xl border border-border bg-card animate-pulse space-y-2', className)}>
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="h-10 bg-muted rounded" />
      </div>
    );
  }

  // Count items by category
  const counts: Record<string, number> = {};
  for (const item of items) {
    counts[item.entityType] = (counts[item.entityType] ?? 0) + 1;
  }

  return (
    <div className={cn('rounded-xl border border-border bg-card p-4 space-y-3.5 shadow-sm', className)}>
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <div className="flex items-center gap-2">
          <Network className="size-4 text-primary" />
          <h4 className="text-xs font-semibold text-foreground tracking-wide uppercase">
            {title}
          </h4>
        </div>

        <span className="text-[11px] font-mono text-muted-foreground">
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      {/* Summary Chips */}
      {items.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(counts).map(([type, count]) => {
            const Icon = getEntityIcon(type as GraphEntityType);
            const badgeColor = getEntityTypeBadgeColor(type as GraphEntityType);
            return (
              <span
                key={type}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border',
                  badgeColor,
                )}
              >
                <Icon className="size-2.5" />
                <span>
                  {count} {type}
                  {count > 1 ? 's' : ''}
                </span>
              </span>
            );
          })}
        </div>
      )}

      {/* Item List */}
      <div className="space-y-1.5 max-h-60 overflow-y-auto scrollbar-thin">
        {items.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No related knowledge items connected yet.
          </div>
        ) : (
          items.map((item) => {
            const Icon = getEntityIcon(item.entityType);
            const badgeColor = getEntityTypeBadgeColor(item.entityType);
            return (
              <div
                key={item.id}
                onClick={() => onItemClick?.(item)}
                role={onItemClick ? 'button' : undefined}
                className={cn(
                  'flex items-center justify-between p-2 rounded-lg border border-border bg-card/60 text-xs transition-colors hover:bg-muted/40 text-left',
                  onItemClick && 'cursor-pointer',
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn('p-1 rounded shrink-0 border', badgeColor)}>
                    <Icon className="size-3" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{item.name}</p>
                    {item.relation && (
                      <p className="text-[10px] text-muted-foreground truncate">
                        {item.relation}
                      </p>
                    )}
                  </div>
                </div>

                {item.link && (
                  <a
                    href={item.link.startsWith('http') ? item.link : `#/${item.link}`}
                    target={item.link.startsWith('http') ? '_blank' : '_self'}
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="p-1 rounded text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
