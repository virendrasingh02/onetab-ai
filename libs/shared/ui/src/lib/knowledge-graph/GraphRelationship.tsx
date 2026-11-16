import type { GraphEdgeDto } from '@org/types';
import { cn } from '@org/utils';
import { ArrowRight, GitBranch } from 'lucide-react';
import { getEntityIcon } from './GraphEntity.js';

export interface GraphRelationshipProps {
  edge: GraphEdgeDto;
  className?: string;
  onClick?: () => void;
}

export function GraphRelationship({ edge, className, onClick }: GraphRelationshipProps) {
  const SourceIcon = edge.sourceNode ? getEntityIcon(edge.sourceNode.entityType) : GitBranch;
  const TargetIcon = edge.targetNode ? getEntityIcon(edge.targetNode.entityType) : GitBranch;

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        'flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card/60 text-xs text-foreground transition-all hover:bg-muted/40',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      <div className="flex items-center gap-1.5 min-w-0 max-w-[140px] truncate font-medium">
        <SourceIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{edge.sourceNode?.name ?? edge.sourceNodeId}</span>
      </div>

      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-border bg-muted/60 text-[10px] font-mono text-muted-foreground shrink-0">
        <span className="font-semibold text-primary">{edge.relationType}</span>
        <ArrowRight className="size-2.5 text-muted-foreground" />
      </div>

      <div className="flex items-center gap-1.5 min-w-0 max-w-[140px] truncate font-medium">
        <TargetIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">{edge.targetNode?.name ?? edge.targetNodeId}</span>
      </div>

      {edge.confidence < 1.0 && (
        <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
          {(edge.confidence * 100).toFixed(0)}% conf
        </span>
      )}
    </div>
  );
}
