import { cn } from '@org/utils';
import { Check, Search, Send, UserX, X } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { UserAvatarGroup } from './avatar-group.js';
import { UserAvatar } from './avatar.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './dropdown-menu.js';

export interface UserSelectorMember {
  id: string;
  name: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
}

export interface UserSelectorProps {
  /** Array of workspace or project members to choose from. */
  members: UserSelectorMember[];
  /** Currently selected user IDs. */
  selectedIds?: string[];
  /** Single selected user ID (for single mode). */
  selectedId?: string | null;
  /** Callback when selection changes. */
  onChange?: (selectedIds: string[]) => void;
  /** Single selection change callback. */
  onSelectMember?: (memberId: string | null) => void;
  /** Whether to allow multiple assigned users. Default: true. */
  multiple?: boolean;
  /** Optional custom trigger node. */
  trigger?: React.ReactNode;
  /** Alignment of the popover content. */
  align?: 'start' | 'center' | 'end';
  /** Placeholder text for the search input. */
  searchPlaceholder?: string;
  /** Label for the trigger or accessibility aria-label. */
  label?: string;
  /** Optional callback when "Invite and add..." is clicked. */
  onInvite?: () => void;
  /** Disabled state. */
  disabled?: boolean;
  className?: string;
}

/**
 * Universal user search and selector component supporting both single and
 * multi-user assignment with fast search, keyboard navigation, and consistent avatars.
 */
export function UserSelector({
  members,
  selectedIds,
  selectedId,
  onChange,
  onSelectMember,
  multiple = true,
  trigger,
  align = 'end',
  searchPlaceholder = 'Search users...',
  label = 'Change assignees',
  onInvite,
  disabled = false,
  className,
}: UserSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Normalize selected IDs
  const activeSelectedIds = useMemo<string[]>(() => {
    if (selectedIds !== undefined) return selectedIds;
    if (selectedId !== undefined && selectedId !== null) return [selectedId];
    return [];
  }, [selectedIds, selectedId]);

  const selectedMembers = useMemo(() => {
    const map = new Map(members.map((m) => [m.id, m]));
    return activeSelectedIds
      .map((id) => map.get(id))
      .filter((m): m is UserSelectorMember => Boolean(m));
  }, [members, activeSelectedIds]);

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

  const toggleUser = (userId: string) => {
    if (multiple) {
      const next = activeSelectedIds.includes(userId)
        ? activeSelectedIds.filter((id) => id !== userId)
        : [...activeSelectedIds, userId];
      onChange?.(next);
      onSelectMember?.(next[0] ?? null);
    } else {
      const isCurrent = activeSelectedIds.includes(userId);
      const next = isCurrent ? [] : [userId];
      onChange?.(next);
      onSelectMember?.(isCurrent ? null : userId);
      setOpen(false);
    }
  };

  const clearSelection = () => {
    onChange?.([]);
    onSelectMember?.(null);
    if (!multiple) setOpen(false);
  };

  const defaultTrigger = (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 p-0.5 rounded-full transition-all cursor-pointer outline-none select-none',
        'hover:ring-2 hover:ring-primary/40 focus-visible:ring-2 focus-visible:ring-primary',
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        className,
      )}
      aria-label={label}
    >
      {selectedMembers.length > 0 ? (
        <UserAvatarGroup users={selectedMembers} size="xs" />
      ) : (
        <div className="size-5 rounded-full border border-dashed border-muted-foreground/50 flex items-center justify-center bg-muted/20 hover:bg-muted/40 transition-colors">
          <UserX className="size-3 text-muted-foreground" />
        </div>
      )}
    </button>
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>{trigger ?? defaultTrigger}</DropdownMenuTrigger>

      <DropdownMenuContent
        align={align}
        sideOffset={6}
        className="w-60 p-1.5 rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl space-y-1 select-none animate-in fade-in zoom-in-95"
      >
        {/* Search Input Box */}
        <div className="relative flex items-center px-2 py-1 border-b border-border/60">
          <Search className="size-3.5 text-muted-foreground shrink-0 mr-2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
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

        {/* Action Header: Clear selection / Count */}
        <div className="flex items-center justify-between px-2 pt-1 pb-0.5 text-[11px] text-muted-foreground">
          <span>{multiple ? 'Assignees' : 'Assignee'}</span>
          {activeSelectedIds.length > 0 && (
            <button
              type="button"
              onClick={clearSelection}
              className="text-[10px] font-medium text-destructive hover:underline cursor-pointer"
            >
              Clear ({activeSelectedIds.length})
            </button>
          )}
        </div>

        {/* Member Options List */}
        <div className="max-h-56 overflow-y-auto space-y-0.5 py-0.5">
          {filteredMembers.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              No users found
            </div>
          ) : (
            filteredMembers.map((member) => {
              const isSelected = activeSelectedIds.includes(member.id);
              const displayName = member.displayName ?? member.name;

              return (
                <DropdownMenuItem
                  key={member.id}
                  onSelect={(e) => {
                    if (multiple) {
                      e.preventDefault(); // keep menu open for multi-selection
                    }
                    toggleUser(member.id);
                  }}
                  className={cn(
                    'flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer font-medium transition-colors',
                    isSelected
                      ? 'bg-accent/80 text-foreground'
                      : 'text-foreground/90 hover:bg-accent/50',
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {/* Selection bullet indicator */}
                    <span
                      className={cn(
                        'size-3.5 rounded flex items-center justify-center text-[10px] shrink-0 border transition-colors',
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground/40 bg-background/50',
                      )}
                    >
                      {isSelected ? <Check className="size-2.5 stroke-[3]" /> : null}
                    </span>

                    {/* Standard UserAvatar */}
                    <UserAvatar
                      name={displayName}
                      seed={member.id}
                      src={member.avatarUrl}
                      size="xs"
                      className="size-5 shrink-0 font-bold"
                    />

                    <div className="min-w-0 flex-1 leading-none">
                      <span className="block text-xs truncate font-medium text-foreground">
                        {displayName}
                      </span>
                      {member.email ? (
                        <span className="block text-[10px] truncate text-muted-foreground mt-0.5 font-mono">
                          {member.email}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </DropdownMenuItem>
              );
            })
          )}
        </div>

        {/* Invite new user footer */}
        {onInvite && (
          <>
            <DropdownMenuSeparator className="my-1" />
            <DropdownMenuItem
              onSelect={() => onInvite()}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer text-foreground/85 hover:bg-accent/60 font-medium"
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

export const MultiUserSelector = UserSelector;
export const AssigneeSelector = UserSelector;
export const UserSearch = UserSelector;
