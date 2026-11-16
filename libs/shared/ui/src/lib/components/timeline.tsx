import { cn } from '@org/utils';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Info,
  Loader2,
} from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Badge } from './badge.js';

export type TimelineEventStatus =
  'completed' | 'in_progress' | 'pending' | 'failed' | 'info';

export interface TimelineItem {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  status?: TimelineEventStatus;
  actor?: {
    name: string;
    avatarUrl?: string;
    isBot?: boolean;
  };
  details?: ReactNode;
  tags?: string[];
  duration?: string;
}

export interface TimelineProps {
  items: TimelineItem[];
  className?: string;
  emptyText?: string;
}

export function Timeline({
  items,
  className,
  emptyText = 'No activity recorded',
}: TimelineProps) {
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(
    new Set(),
  );

  const toggleExpand = (id: string) => {
    const next = new Set(expandedItemIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedItemIds(next);
  };

  const getStatusIcon = (status: TimelineEventStatus = 'completed') => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="size-4 text-success" />;
      case 'in_progress':
        return <Loader2 className="size-4 animate-spin text-primary" />;
      case 'failed':
        return <AlertCircle className="size-4 text-destructive" />;
      case 'pending':
        return <Clock className="size-4 text-muted-foreground" />;
      case 'info':
      default:
        return <Info className="size-4 text-info" />;
    }
  };

  if (items.length === 0) {
    return (
      <div className="py-8 text-xs text-center text-subtle select-none">
        {emptyText}
      </div>
    );
  }

  return (
    <div
      className={cn('space-y-4 pl-6 text-xs relative flex flex-col', className)}
    >
      {/* Vertical spine */}
      <div className="bottom-2 top-2 absolute left-[11px] w-[2px] bg-border" />

      {items.map((item) => {
        const isExpanded = expandedItemIds.has(item.id);
        const hasDetails = Boolean(item.details);

        return (
          <div key={item.id} className="gap-3 relative flex items-start">
            {/* Status node */}
            <div className="-left-6 size-6 absolute flex items-center justify-center rounded-full border border-border bg-surface shadow-xs">
              {getStatusIcon(item.status)}
            </div>

            {/* Event card */}
            <div className="p-3 flex-1 rounded-card border border-border bg-surface shadow-xs">
              <div className="gap-2 flex flex-wrap items-center justify-between">
                <div className="gap-2 flex items-center">
                  {item.actor && (
                    <span className="font-semibold text-foreground">
                      {item.actor.name}
                    </span>
                  )}
                  <span className="font-medium text-foreground">
                    {item.title}
                  </span>
                  {item.duration && (
                    <Badge
                      variant="secondary"
                      className="h-4 px-1.5 font-mono text-2xs"
                    >
                      {item.duration}
                    </Badge>
                  )}
                </div>

                <span className="font-mono text-meta text-subtle">
                  {item.timestamp}
                </span>
              </div>

              {item.description && (
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              )}

              {item.tags && item.tags.length > 0 && (
                <div className="mt-2 gap-1 flex flex-wrap">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-1.5 py-0.5 rounded-xs bg-surface-raised font-mono text-2xs text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {hasDetails && (
                <div className="mt-2.5 pt-2 border-t border-border/80">
                  <button
                    type="button"
                    onClick={() => toggleExpand(item.id)}
                    className="gap-1 font-medium flex items-center text-meta text-muted-foreground outline-none hover:text-foreground"
                  >
                    {isExpanded ? (
                      <ChevronDown className="size-3.5" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )}
                    <span>{isExpanded ? 'Hide details' : 'Show details'}</span>
                  </button>

                  {isExpanded && (
                    <div className="mt-2 p-2.5 overflow-x-auto rounded-btn bg-surface-raised font-mono text-meta text-foreground/90">
                      {item.details}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
