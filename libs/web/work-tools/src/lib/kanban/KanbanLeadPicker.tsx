import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  UserAvatar,
  UserAvatarGroup,
} from '@org/ui';
import { cn } from '@org/utils';
import { Check, Search, Send, X } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { UnassignedLeadIcon } from './kanban-icons.js';
import type { BoardMember } from './types.js';

export interface KanbanLeadPickerProps {
  currentMemberId?: string | null;
  selectedMemberIds?: string[];
  members: BoardMember[];
  onSelectMember?: (memberId: string | null) => void;
  onSelectMembers?: (memberIds: string[]) => void;
  onInvite?: () => void;
  trigger?: React.ReactNode;
  align?: 'start' | 'center' | 'end';
  multiple?: boolean;
}

export function KanbanLeadPicker({
  currentMemberId,
  selectedMemberIds,
  members,
  onSelectMember,
  onSelectMembers,
  onInvite,
  trigger,
  align = 'end',
  multiple = false,
}: KanbanLeadPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const activeIds = useMemo<string[]>(() => {
    if (selectedMemberIds !== undefined) return selectedMemberIds;
    if (currentMemberId) return [currentMemberId];
    return [];
  }, [selectedMemberIds, currentMemberId]);

  const assignedMembers = useMemo(() => {
    const memberMap = new Map(members.map((m) => [m.id, m]));
    return activeIds
      .map((id) => memberMap.get(id))
      .filter((m): m is BoardMember => Boolean(m));
  }, [members, activeIds]);

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) => {
      const name = (m.displayName ?? m.name).toLowerCase();
      const rawName = m.name.toLowerCase();
      const email = (m.email ?? '').toLowerCase();
      return name.includes(q) || rawName.includes(q) || email.includes(q);
    });
  }, [members, query]);

  // Keyboard shortcut listener when open (0 for No lead / clear)
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === '0') {
        e.preventDefault();
        onSelectMember?.(null);
        onSelectMembers?.([]);
        setOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onSelectMember, onSelectMembers]);

  const toggleMember = (memberId: string) => {
    if (multiple || onSelectMembers) {
      const next = activeIds.includes(memberId)
        ? activeIds.filter((id) => id !== memberId)
        : [...activeIds, memberId];
      onSelectMembers?.(next);
      onSelectMember?.(next[0] ?? null);
    } else {
      // Single-select branch: this path is only reached when `onSelectMembers`
      // is undefined (see the guard above), so only the single callback fires.
      const isSelected = activeIds.includes(memberId);
      const nextId = isSelected ? null : memberId;
      onSelectMember?.(nextId);
      setOpen(false);
    }
  };

  const handleClear = () => {
    onSelectMember?.(null);
    onSelectMembers?.([]);
    if (!multiple) setOpen(false);
  };

  const defaultTrigger = (
    <button
      type="button"
      className="flex items-center justify-center rounded-full hover:ring-2 hover:ring-primary/40 transition-all cursor-pointer p-0.5"
      aria-label="Change assignee"
    >
      {assignedMembers.length > 1 ? (
        <UserAvatarGroup users={assignedMembers} size="xs" />
      ) : assignedMembers.length === 1 ? (
        <UserAvatar
          name={assignedMembers[0].name}
          seed={assignedMembers[0].id}
          src={assignedMembers[0].avatarUrl}
          size="xs"
          className="size-5 text-[9px] font-bold ring-1 ring-surface"
        />
      ) : (
        <div className="size-5 rounded-full border border-dashed border-muted-foreground/50 flex items-center justify-center bg-muted/20">
          <UnassignedLeadIcon className="size-3 text-muted-foreground" />
        </div>
      )}
    </button>
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{trigger ?? defaultTrigger}</DropdownMenuTrigger>

      <DropdownMenuContent
        align={align}
        className="w-56 p-1.5 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl animate-in fade-in zoom-in-95"
      >
        {/* Search Input Box */}
        <div className="relative flex items-center px-2 py-1 border-b border-border/60 mb-1">
          <Search className="size-3.5 text-muted-foreground shrink-0 mr-2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users..."
            className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none border-none p-0 focus:ring-0"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        <div className="space-y-0.5">
          {/* No lead / Clear option */}
          <DropdownMenuItem
            onSelect={handleClear}
            className={cn(
              'flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs cursor-pointer font-medium transition-colors',
              activeIds.length === 0
                ? 'bg-accent text-foreground'
                : 'text-foreground/85 hover:bg-accent/60',
            )}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <UnassignedLeadIcon className="size-4" />
              <span className="truncate">No lead</span>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground/80">
              {activeIds.length === 0 && (
                <Check className="size-3.5 text-foreground shrink-0 stroke-[2.5]" />
              )}
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground/70">
                0
              </span>
            </div>
          </DropdownMenuItem>

          {/* Members list */}
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {filteredMembers.length === 0 ? (
              <div className="px-3 py-3 text-center text-xs text-muted-foreground">
                No users found
              </div>
            ) : (
              filteredMembers.map((member) => {
                const isSelected = activeIds.includes(member.id);
                return (
                  <DropdownMenuItem
                    key={member.id}
                    onSelect={(e) => {
                      if (multiple || onSelectMembers) {
                        e.preventDefault();
                      }
                      toggleMember(member.id);
                    }}
                    className={cn(
                      'flex items-center justify-between px-3 py-2 rounded-xl text-xs cursor-pointer transition-colors duration-150',
                      isSelected
                        ? 'bg-accent/40 text-foreground hover:bg-accent/70'
                        : 'text-foreground/90 hover:bg-accent/60',
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <UserAvatar
                        name={member.displayName ?? member.name}
                        seed={member.id}
                        src={member.avatarUrl}
                        size="sm"
                        className="size-7 text-[10px] font-bold shrink-0 rounded-full"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-semibold text-foreground leading-tight">
                          {member.displayName ?? member.name}
                        </span>
                        {member.email && (
                          <span className="block truncate text-[11px] text-muted-foreground mt-0.5 leading-tight font-normal">
                            {member.email}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="size-4 text-foreground shrink-0 stroke-[2.5] ml-2" />
                    )}
                  </DropdownMenuItem>
                );
              })
            )}
          </div>
        </div>

        {/* New user section */}
        {onInvite && (
          <>
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
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
