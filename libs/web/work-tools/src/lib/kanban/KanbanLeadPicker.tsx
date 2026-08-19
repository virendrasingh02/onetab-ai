import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  UserAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import { Check, Send } from 'lucide-react';
import React, { useEffect } from 'react';
import { UnassignedLeadIcon } from './kanban-icons.js';
import type { BoardMember } from './types.js';

export interface KanbanLeadPickerProps {
  currentMemberId?: string;
  members: BoardMember[];
  onSelectMember: (memberId: string | null) => void;
  onInvite?: () => void;
  trigger?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
}

export function KanbanLeadPicker({
  currentMemberId,
  members,
  onSelectMember,
  onInvite,
  trigger,
  align = 'end',
}: KanbanLeadPickerProps) {
  const [open, setOpen] = React.useState(false);

  // Keyboard shortcut listener when open (0 for No lead)
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === '0') {
        e.preventDefault();
        onSelectMember(null);
        setOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onSelectMember]);

  const assignedMember = members.find((m) => m.id === currentMemberId);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {trigger ?? (
          <button
            type="button"
            className="flex items-center justify-center size-5.5 rounded-full hover:ring-2 hover:ring-primary/40 transition-all cursor-pointer"
            aria-label="Change assignee"
          >
            {assignedMember ? (
              <UserAvatar
                name={assignedMember.name}
                seed={assignedMember.id}
                src={assignedMember.avatarUrl}
                size="xs"
                className="size-5 text-[9px] font-bold ring-1 ring-surface"
              />
            ) : (
              <div className="size-5 rounded-full border border-dashed border-muted-foreground/50 flex items-center justify-center bg-muted/20">
                <UnassignedLeadIcon className="size-3 text-muted-foreground" />
              </div>
            )}
          </button>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={align}
        className="w-52 p-1.5 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl animate-in fade-in zoom-in-95"
      >
        <div className="space-y-0.5">
          {/* No lead option */}
          <DropdownMenuItem
            onSelect={() => onSelectMember(null)}
            className={cn(
              'flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer font-medium transition-colors',
              !currentMemberId
                ? 'bg-accent text-foreground'
                : 'text-foreground/85 hover:bg-accent/60',
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <UnassignedLeadIcon className="size-4" />
              <span className="truncate">No lead</span>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground/80">
              {!currentMemberId && (
                <Check className="size-3.5 text-foreground shrink-0 stroke-[2.5]" />
              )}
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground/70">
                0
              </span>
            </div>
          </DropdownMenuItem>

          {/* Members list */}
          {members.map((member) => {
            const isSelected = member.id === currentMemberId;
            return (
              <DropdownMenuItem
                key={member.id}
                onSelect={() => onSelectMember(member.id)}
                className={cn(
                  'flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer font-medium transition-colors',
                  isSelected
                    ? 'bg-accent text-foreground'
                    : 'text-foreground/85 hover:bg-accent/60',
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <UserAvatar
                    name={member.name}
                    seed={member.id}
                    src={member.avatarUrl}
                    size="xs"
                    className="size-5 text-[9px] font-bold shrink-0"
                  />
                  <span className="truncate">{member.name}</span>
                </div>

                {isSelected && (
                  <Check className="size-3.5 text-foreground shrink-0 stroke-[2.5]" />
                )}
              </DropdownMenuItem>
            );
          })}
        </div>

        {/* New user section */}
        <DropdownMenuSeparator className="my-1.5" />
        <div className="px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          New user
        </div>

        <DropdownMenuItem
          onSelect={() => onInvite?.()}
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs cursor-pointer text-foreground/85 hover:bg-accent/60 font-medium"
        >
          <Send className="size-3.5 text-muted-foreground shrink-0" />
          <span>Invite and add...</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
