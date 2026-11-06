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
import { useMenuSearchField } from './menu-search-field.js';

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
  const searchField = useMenuSearchField();
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
      className="p-0.5 flex cursor-pointer items-center justify-center rounded-full transition-all hover:ring-2 hover:ring-primary/40"
      aria-label="Change assignee"
    >
      {assignedMembers.length > 1 ? (
        <UserAvatarGroup users={assignedMembers} size="xs" />
      ) : assignedMembers.length === 1 ? (
        <UserAvatar
          name={assignedMembers[0].name}
          seed={assignedMembers[0].id}
          src={assignedMembers[0].avatarUrl}
          presence={assignedMembers[0].presence}
          statusEmoji={assignedMembers[0].statusEmoji}
          statusText={assignedMembers[0].statusText}
          size="xs"
          className="size-5 font-bold text-[9px] ring-1 ring-surface"
        />
      ) : (
        <div className="size-5 flex items-center justify-center rounded-full border border-dashed border-muted-foreground/50 bg-muted/20">
          <UnassignedLeadIcon className="size-3 text-muted-foreground" />
        </div>
      )}
    </button>
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {trigger ?? defaultTrigger}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        {...searchField.contentProps}
        align={align}
        className="w-56 p-1.5 shadow-xl rounded-xl border border-border bg-popover text-popover-foreground"
      >
        {/* Search Input Box */}
        <div className="px-2 py-1 mb-1 relative flex items-center border-b border-border/60">
          <Search className="size-3.5 mr-2 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users..."
            className="text-xs p-0 w-full border-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground focus:ring-0"
            {...searchField.inputProps}
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
              'px-2.5 py-1.5 text-xs font-medium flex cursor-pointer items-center justify-between rounded-lg transition-colors',
              activeIds.length === 0
                ? 'bg-accent text-foreground'
                : 'text-foreground/85 hover:bg-accent/60',
            )}
          >
            <div className="gap-2.5 min-w-0 flex items-center">
              <UnassignedLeadIcon className="size-4" />
              <span className="truncate">No lead</span>
            </div>

            <div className="gap-2 flex items-center text-muted-foreground/80">
              {activeIds.length === 0 && (
                <Check className="size-3.5 shrink-0 stroke-[2.5] text-foreground" />
              )}
              <span className="font-mono text-[11px] text-muted-foreground/70 tabular-nums">
                0
              </span>
            </div>
          </DropdownMenuItem>

          {/* Members list */}
          <div className="max-h-48 space-y-0.5 overflow-y-auto">
            {filteredMembers.length === 0 ? (
              <div className="px-3 py-3 text-xs text-center text-muted-foreground">
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
                      'px-3 py-2 text-xs flex cursor-pointer items-center justify-between rounded-xl transition-colors duration-150',
                      isSelected
                        ? 'bg-accent/40 text-foreground hover:bg-accent/70'
                        : 'text-foreground/90 hover:bg-accent/60',
                    )}
                  >
                    <div className="gap-3 min-w-0 flex flex-1 items-center">
                      <UserAvatar
                        name={member.displayName ?? member.name}
                        seed={member.id}
                        src={member.avatarUrl}
                        presence={member.presence}
                        statusEmoji={member.statusEmoji}
                        statusText={member.statusText}
                        size="sm"
                        className="size-7 font-bold shrink-0 rounded-full text-[10px]"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold leading-tight block truncate text-foreground">
                          {member.displayName ?? member.name}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <Check className="size-4 ml-2 shrink-0 stroke-[2.5] text-foreground" />
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
            <div className="px-2.5 py-1 font-medium text-[11px] text-muted-foreground">
              New user
            </div>

            <DropdownMenuItem
              onSelect={() => onInvite?.()}
              className="gap-2.5 px-2.5 py-1.5 text-xs font-medium flex cursor-pointer items-center rounded-lg text-foreground/85 hover:bg-accent/60"
            >
              <Send className="size-3.5 shrink-0 text-muted-foreground" />
              <span>Invite and add...</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
