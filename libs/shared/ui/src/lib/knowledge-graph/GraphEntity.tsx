import type { ComponentType } from 'react';
import type { GraphEntityType, GraphNodeDto } from '@org/types';
import { cn } from '@org/utils';
import {
  Bot,
  Boxes,
  CheckSquare,
  Code2,
  Cpu,
  Database,
  ExternalLink,
  FileText,
  FolderKanban,
  Globe,
  Layers,
  Plug,
  Sparkles,
  Users,
  Workflow,
} from 'lucide-react';

export function getEntityIcon(type: GraphEntityType): ComponentType<{ className?: string }> {
  switch (type) {
    case 'Project':
      return FolderKanban;
    case 'Task':
    case 'Subtask':
      return CheckSquare;
    case 'Document':
    case 'File':
      return FileText;
    case 'SourceFile':
      return Code2;
    case 'Component':
      return Boxes;
    case 'Function':
      return Cpu;
    case 'Hook':
      return Sparkles;
    case 'API':
    case 'Endpoint':
      return Globe;
    case 'Database':
      return Database;
    case 'Integration':
    case 'Tool':
      return Plug;
    case 'User':
    case 'Team':
      return Users;
    case 'AIAgent':
      return Bot;
    case 'Workflow':
    case 'WorkflowNode':
      return Workflow;
    default:
      return Layers;
  }
}

export function getEntityTypeBadgeColor(type: GraphEntityType): string {
  switch (type) {
    case 'Project':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    case 'Task':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'Document':
      return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    case 'SourceFile':
    case 'Component':
      return 'bg-violet-500/10 text-violet-600 border-violet-500/20';
    case 'Function':
    case 'Hook':
      return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20';
    case 'Endpoint':
    case 'API':
      return 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20';
    case 'Database':
      return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

export interface GraphEntityProps {
  node: GraphNodeDto;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
  showDetails?: boolean;
}

export function GraphEntity({
  node,
  isSelected,
  onClick,
  className,
  showDetails = false,
}: GraphEntityProps) {
  const Icon = getEntityIcon(node.entityType);
  const badgeColor = getEntityTypeBadgeColor(node.entityType);

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        'group relative flex items-start gap-3 p-3 rounded-lg border text-left transition-all',
        isSelected
          ? 'bg-primary/5 border-primary shadow-sm'
          : 'bg-card border-border hover:border-primary/40 hover:bg-muted/40',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      <div className={cn('p-2 rounded-md border shrink-0', badgeColor)}>
        <Icon className="size-4" />
      </div>

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-semibold text-xs text-foreground truncate max-w-[200px]">
            {node.name}
          </span>
          <span
            className={cn(
              'px-1.5 py-0.2 rounded text-[10px] font-medium border uppercase tracking-wider',
              badgeColor,
            )}
          >
            {node.entityType}
          </span>
          {node.identifier && (
            <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">
              {node.identifier}
            </span>
          )}
        </div>

        {node.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {node.description}
          </p>
        )}

        {showDetails && node.properties && Object.keys(node.properties).length > 0 && (
          <div className="pt-1.5 flex flex-wrap gap-1">
            {Object.entries(node.properties).slice(0, 4).map(([k, v]) => (
              <span
                key={k}
                className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
              >
                {k}: {String(v)}
              </span>
            ))}
          </div>
        )}
      </div>

      {node.sourceUri && (
        <a
          href={node.sourceUri.startsWith('http') ? node.sourceUri : `#/${node.sourceUri}`}
          target={node.sourceUri.startsWith('http') ? '_blank' : '_self'}
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-muted-foreground hover:text-foreground p-1 rounded hover:bg-muted shrink-0"
          title={`Open ${node.sourceUri}`}
        >
          <ExternalLink className="size-3.5" />
        </a>
      )}
    </div>
  );
}
