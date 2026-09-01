import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  UserAvatar,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import {
  Calendar,
  CheckCircle2,
  ExternalLink,
  Hash,
  Pencil,
  User,
  UserCheck,
} from 'lucide-react';
import type { ChatAppEntity, EntityActionHandlers } from './types.js';

export interface EntityPreviewDrawerProps {
  entity: ChatAppEntity | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  handlers?: EntityActionHandlers;
}

export function EntityPreviewDrawer({
  entity,
  open,
  onOpenChange,
  handlers,
}: EntityPreviewDrawerProps) {
  if (!entity) return null;

  const isDone = entity.status === 'DONE' || entity.status === 'COMPLETED';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl p-0 overflow-hidden bg-card text-card-foreground border border-border shadow-2xl rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-4 sm:p-5 border-b border-border/70 bg-surface/50">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="primary" className="uppercase font-bold text-[9px] py-0 h-4.5">
                {entity.kind}
              </Badge>
              {entity.channelName && (
                <Badge variant="outline" className="gap-1 text-[10px] py-0 h-4.5 font-medium">
                  <Hash className="size-2.5" />
                  <span>{entity.channelName}</span>
                </Badge>
              )}
              {entity.priority && (
                <Badge variant="neutral" className="text-[9px] py-0 h-4.5 font-mono">
                  {entity.priority}
                </Badge>
              )}
            </div>

            {entity.status && (
              <Badge
                variant={isDone ? 'success' : 'neutral'}
                className="py-0 h-4.5 text-[10px] font-mono uppercase"
              >
                {entity.status.replace(/_/g, ' ')}
              </Badge>
            )}
          </div>

          <DialogTitle className="text-lg sm:text-xl font-bold text-foreground">
            {entity.title}
          </DialogTitle>
          {entity.subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{entity.subtitle}</p>
          )}
        </DialogHeader>

        {/* Content Body */}
        <div className="p-4 sm:p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-surface-raised border border-border/60 text-xs">
            {entity.assigneeName ? (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <User className="size-3" /> Assignee
                </span>
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <UserAvatar
                    name={entity.assigneeName}
                    src={entity.assigneeAvatarUrl}
                    seed={entity.assigneeId || entity.assigneeName}
                    size="xs"
                    className="size-4"
                  />
                  <span>{entity.assigneeName}</span>
                </div>
              </div>
            ) : entity.authorName ? (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <User className="size-3" /> Author
                </span>
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <UserAvatar
                    name={entity.authorName}
                    src={entity.authorAvatarUrl}
                    seed={entity.authorName}
                    size="xs"
                    className="size-4"
                  />
                  <span>{entity.authorName}</span>
                </div>
              </div>
            ) : null}

            {entity.updatedAt ? (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <Calendar className="size-3" /> Last Updated
                </span>
                <span className="text-muted-foreground block font-mono text-[11px]">
                  {formatRelative(
                    typeof entity.updatedAt === 'number'
                      ? new Date(entity.updatedAt).toISOString()
                      : String(entity.updatedAt),
                  )}
                </span>
              </div>
            ) : null}
          </div>

          {/* Description Section */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-foreground block uppercase tracking-wider">
              {entity.kind === 'document' ? 'Document Content' : 'Description'}
            </span>
            <div className="p-3.5 rounded-xl border border-border bg-surface text-xs leading-relaxed text-foreground whitespace-pre-wrap">
              {entity.description || (
                <span className="italic text-muted-foreground">
                  No description provided for this {entity.kind}.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 sm:p-4 border-t border-border bg-surface/50 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {(entity.kind === 'task' || entity.kind === 'card') && handlers?.onStatusChange && (
              <Button
                size="sm"
                variant={isDone ? 'outline' : 'primary'}
                onClick={() => {
                  const nextStatus = isDone ? 'TODO' : 'DONE';
                  handlers.onStatusChange?.(entity, nextStatus);
                  onOpenChange(false);
                }}
                className="gap-1.5 text-xs h-8"
              >
                <CheckCircle2 className="size-3.5" />
                <span>{isDone ? 'Mark as Todo' : 'Mark as Done'}</span>
              </Button>
            )}

            {(entity.kind === 'task' || entity.kind === 'card') && handlers?.onAssignToMe && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  handlers.onAssignToMe?.(entity);
                  onOpenChange(false);
                }}
                className="gap-1.5 text-xs h-8"
              >
                <UserCheck className="size-3.5 text-primary" />
                <span>Assign to me</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {handlers?.onEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  onOpenChange(false);
                  handlers.onEdit?.(entity);
                }}
                className="gap-1.5 text-xs h-8"
              >
                <Pencil className="size-3.5" />
                <span>Edit</span>
              </Button>
            )}

            {handlers?.onOpen && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  onOpenChange(false);
                  handlers.onOpen?.(entity);
                }}
                className="gap-1.5 text-xs h-8"
              >
                <ExternalLink className="size-3.5" />
                <span>Open Full View</span>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
