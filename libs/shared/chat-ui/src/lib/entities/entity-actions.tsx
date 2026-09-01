import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@org/ui';
import {
  CheckSquare,
  Copy,
  ExternalLink,
  Eye,
  MoreHorizontal,
  Pencil,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { useState } from 'react';
import type { ChatAppEntity, EntityActionHandlers } from './types.js';

export interface EntityActionsProps {
  entity: ChatAppEntity;
  handlers?: EntityActionHandlers;
  align?: 'start' | 'end';
}

export function EntityActions({
  entity,
  handlers,
  align = 'end',
}: EntityActionsProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Entity options"
          className="size-7 text-muted-foreground hover:text-foreground shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        side="bottom"
        sideOffset={4}
        collisionPadding={8}
        className="w-52 text-xs border-border bg-popover text-popover-foreground z-50 shadow-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        {handlers?.onPreview && (
          <DropdownMenuItem
            onSelect={() => {
              setIsOpen(false);
              handlers.onPreview?.(entity);
            }}
            className="gap-2"
          >
            <Eye className="size-3.5 text-muted-foreground" />
            <span>Quick Preview</span>
          </DropdownMenuItem>
        )}

        {handlers?.onOpen && (
          <DropdownMenuItem
            onSelect={() => {
              setIsOpen(false);
              handlers.onOpen?.(entity);
            }}
            className="gap-2"
          >
            <ExternalLink className="size-3.5 text-muted-foreground" />
            <span>Open in Full View</span>
          </DropdownMenuItem>
        )}

        {handlers?.onEdit && (
          <DropdownMenuItem
            onSelect={() => {
              setIsOpen(false);
              handlers.onEdit?.(entity);
            }}
            className="gap-2"
          >
            <Pencil className="size-3.5 text-muted-foreground" />
            <span>Edit {entity.kind === 'document' ? 'Document' : 'Task'}</span>
          </DropdownMenuItem>
        )}

        {entity.kind === 'task' || entity.kind === 'card' ? (
          <>
            <DropdownMenuSeparator />
            {handlers?.onAssignToMe && (
              <DropdownMenuItem
                onSelect={() => {
                  setIsOpen(false);
                  handlers.onAssignToMe?.(entity);
                }}
                className="gap-2"
              >
                <UserCheck className="size-3.5 text-primary" />
                <span>Assign to Me</span>
              </DropdownMenuItem>
            )}
            {handlers?.onStatusChange && (
              <DropdownMenuItem
                onSelect={() => {
                  setIsOpen(false);
                  const nextStatus =
                    entity.status === 'DONE' ? 'TODO' : 'DONE';
                  handlers.onStatusChange?.(entity, nextStatus);
                }}
                className="gap-2"
              >
                <CheckSquare className="size-3.5 text-success" />
                <span>
                  {entity.status === 'DONE' ? 'Mark as Incomplete' : 'Mark as Done'}
                </span>
              </DropdownMenuItem>
            )}
          </>
        ) : null}

        <DropdownMenuSeparator />

        {handlers?.onCopyLink && (
          <DropdownMenuItem
            onSelect={() => {
              setIsOpen(false);
              handlers.onCopyLink?.(entity);
            }}
            className="gap-2"
          >
            <Copy className="size-3.5 text-muted-foreground" />
            <span>Copy Link</span>
          </DropdownMenuItem>
        )}

        {handlers?.onDelete && (
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => {
              setIsOpen(false);
              handlers.onDelete?.(entity);
            }}
            className="gap-2 text-destructive focus:bg-destructive/10"
          >
            <Trash2 className="size-3.5" />
            <span>Delete</span>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
