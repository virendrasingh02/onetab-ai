import {
  Badge,
  Card,
  UserAvatar,
} from '@org/ui';
import { cn, formatRelative } from '@org/utils';
import {
  CheckCircle2,
  Circle,
  Clock,
  FileText,
  FolderKanban,
  Hash,
  MessagesSquare,
} from 'lucide-react';
import { EntityActions } from './entity-actions.js';
import type { ChatAppEntity, EntityActionHandlers } from './types.js';

export interface EntityItemProps {
  entity: ChatAppEntity;
  handlers?: EntityActionHandlers;
  showChannelBadge?: boolean;
  className?: string;
}

function getPriorityBadge(priority?: string) {
  if (!priority) return null;
  const normalized = priority.toUpperCase();
  switch (normalized) {
    case 'URGENT':
      return (
        <Badge variant="destructive" className="py-0 h-4 text-[9px] font-bold">
          URGENT
        </Badge>
      );
    case 'HIGH':
      return (
        <Badge variant="warning" className="py-0 h-4 text-[9px] font-bold">
          HIGH
        </Badge>
      );
    case 'MEDIUM':
      return (
        <Badge variant="neutral" className="py-0 h-4 text-[9px]">
          MED
        </Badge>
      );
    case 'LOW':
      return (
        <Badge variant="neutral" className="py-0 h-4 text-[9px] opacity-75">
          LOW
        </Badge>
      );
    default:
      return null;
  }
}

function getStatusIcon(status?: string, kind?: string) {
  if (kind === 'document') {
    return <FileText className="size-4 text-info-text shrink-0" />;
  }
  if (kind === 'thread') {
    return <MessagesSquare className="size-4 text-accent-violet shrink-0" />;
  }
  if (kind === 'project') {
    return <FolderKanban className="size-4 text-accent-amber shrink-0" />;
  }
  if (status === 'DONE' || status === 'COMPLETED') {
    return <CheckCircle2 className="size-4 text-success shrink-0" />;
  }
  if (status === 'IN_PROGRESS') {
    return <Clock className="size-4 text-primary shrink-0 animate-pulse" />;
  }
  return <Circle className="size-4 text-muted-foreground shrink-0" />;
}

export function EntityItem({
  entity,
  handlers,
  showChannelBadge = false,
  className,
}: EntityItemProps) {
  const isDone = entity.status === 'DONE' || entity.status === 'COMPLETED';

  return (
    <Card
      className={cn(
        'group p-3 gap-3 flex items-start justify-between bg-surface transition-all duration-150',
        'hover:border-border-strong hover:bg-surface-raised cursor-pointer rounded-xl',
        isDone && 'opacity-75',
        className,
      )}
      onClick={() => {
        if (handlers?.onPreview) {
          handlers.onPreview(entity);
        } else if (handlers?.onOpen) {
          handlers.onOpen(entity);
        }
      }}
    >
      <div className="gap-2.5 min-w-0 flex flex-1 items-start">
        <div className="mt-0.5">{getStatusIcon(entity.status, entity.kind)}</div>

        <div className="min-w-0 flex-1 space-y-1">
          {/* Header Row: Title, Priority, Channel Badge */}
          <div className="gap-1.5 flex flex-wrap items-center">
            <span
              className={cn(
                'text-xs sm:text-sm font-semibold text-foreground truncate',
                isDone && 'line-through text-muted-foreground',
              )}
            >
              {entity.title}
            </span>

            {getPriorityBadge(entity.priority)}

            {showChannelBadge && entity.channelName && (
              <Badge
                variant="outline"
                className="gap-1 py-0 h-4.5 text-[10px] text-muted-foreground font-medium"
              >
                <Hash className="size-2.5" />
                <span>{entity.channelName}</span>
              </Badge>
            )}

            {entity.status && entity.kind !== 'document' && (
              <Badge
                variant={isDone ? 'success' : 'neutral'}
                className="py-0 h-4 text-[9px] font-mono uppercase"
              >
                {entity.status.replace(/_/g, ' ')}
              </Badge>
            )}
          </div>

          {/* Description Snippet */}
          {entity.description && (
            <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed">
              {entity.description}
            </p>
          )}

          {/* Footer Metadata: Assignee / Author & Timestamp */}
          <div className="gap-2 pt-0.5 flex flex-wrap items-center text-[10px] text-muted-foreground">
            {entity.assigneeName ? (
              <div className="gap-1 flex items-center">
                <UserAvatar
                  name={entity.assigneeName}
                  src={entity.assigneeAvatarUrl}
                  seed={entity.assigneeId || entity.assigneeName}
                  size="xs"
                  className="size-4 ring-1 ring-border"
                />
                <span className="font-medium text-foreground">
                  {entity.assigneeName}
                </span>
              </div>
            ) : entity.authorName ? (
              <div className="gap-1 flex items-center">
                <UserAvatar
                  name={entity.authorName}
                  src={entity.authorAvatarUrl}
                  seed={entity.authorName}
                  size="xs"
                  className="size-4 ring-1 ring-border"
                />
                <span>{entity.authorName}</span>
              </div>
            ) : null}

            {entity.updatedAt ? (
              <span>
                · updated{' '}
                {formatRelative(
                  typeof entity.updatedAt === 'number'
                    ? new Date(entity.updatedAt).toISOString()
                    : String(entity.updatedAt),
                )}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <EntityActions entity={entity} handlers={handlers} />
      </div>
    </Card>
  );
}
