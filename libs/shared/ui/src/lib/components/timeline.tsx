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
import {
  useState,
  type ReactNode,
} from 'react';
import { Badge } from './badge.js';

export type TimelineEventStatus = 'completed' | 'in_progress' | 'pending' | 'failed' | 'info';

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

export function Timeline({ items, className, emptyText = 'No activity recorded' }: TimelineProps) {
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());

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
        return <Loader2 className="size-4 text-primary animate-spin" />;
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
      <div className="py-8 text-center text-xs text-subtle select-none">
        {emptyText}
      </div>
    );
  }

  return (
    <div className={cn('relative flex flex-col space-y-4 pl-6 text-xs', className)}>
      {/* Vertical spine */}
      <div className="absolute bottom-2 left-[11px] top-2 w-[2px] bg-border" />

      {items.map((item) => {
        const isExpanded = expandedItemIds.has(item.id);
        const hasDetails = Boolean(item.details);

        return (
          <div key={item.id} className="relative flex items-start gap-3">
            {/* Status node */}
            <div className="absolute -left-6 flex size-6 items-center justify-center rounded-full bg-surface border border-border shadow-xs">
              {getStatusIcon(item.status)}
            </div>

            {/* Event card */}
            <div className="flex-1 rounded-card border border-border bg-surface p-3 shadow-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  {item.actor && (
                    <span className="font-semibold text-foreground">
                      {item.actor.name}
                    </span>
                  )}
                  <span className="font-medium text-foreground">{item.title}</span>
                  {item.duration && (
                    <Badge variant="secondary" className="font-mono text-[10px] h-4 px-1.5">
                      {item.duration}
                    </Badge>
                  )}
                </div>

                <span className="text-[11px] text-subtle font-mono">{item.timestamp}</span>
              </div>

              {item.description && (
                <p className="mt-1 text-muted-foreground leading-relaxed">
                  {item.description}
                </p>
              )}

              {item.tags && item.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {item.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-xs bg-surface-raised px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
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
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground font-medium outline-none"
                  >
                    {isExpanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                    <span>{isExpanded ? 'Hide details' : 'Show details'}</span>
                  </button>

                  {isExpanded && (
                    <div className="mt-2 rounded-btn bg-surface-raised p-2.5 font-mono text-[11px] text-foreground/90 overflow-x-auto">
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
