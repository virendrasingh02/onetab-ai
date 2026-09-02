import { cn } from '@org/utils';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Check, Search, Send, UserX, X } from 'lucide-react';
import React, { useId, useMemo, useRef, useState } from 'react';
import { UserAvatarGroup } from './avatar-group.js';
import { UserAvatar } from './avatar.js';

export interface UserSelectorMember {
  id: string;
  name: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  email?: string | null;
  role?: string | null;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
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
  /** Variant of the trigger: 'input' (chips + inline search) or 'avatar' (compact button). */
  variant?: 'input' | 'avatar' | 'button';
  /** Optional custom trigger node. */
  trigger?: React.ReactNode;
  /** Alignment of the popover content. */
  align?: 'start' | 'center' | 'end';
  /** Placeholder text for the search input or empty state. */
  searchPlaceholder?: string;
  placeholder?: string;
  /** Label for the trigger or accessibility aria-label. */
  label?: string;
  /** Optional callback when "Invite and add..." is clicked. */
  onInvite?: () => void;
  /** Disabled state. */
  disabled?: boolean;
  /** Maximum chips to show before "+N more" badge. */
  maxSelectedChips?: number;
  className?: string;
  popoverClassName?: string;
}

/**
 * Universal user search and selector component supporting both single and
 * multi-user assignment with fast search, keyboard navigation, chips input, and consistent avatars.
 */
export function UserSelector({
  members,
  selectedIds,
  selectedId,
  onChange,
  onSelectMember,
  multiple = true,
  variant,
  trigger,
  align = 'start',
  searchPlaceholder = 'Search users...',
  placeholder = 'Add members...',
  label = 'Change assignees',
  onInvite,
  disabled = false,
  maxSelectedChips,
  className,
  popoverClassName,
}: UserSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  // Determine effective trigger variant: default to 'input' for multi-mode, 'avatar' if specified or single without custom trigger
  const effectiveVariant = variant ?? (multiple ? 'input' : 'avatar');

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
      const role = (m.role || m.title || m.subtitle || m.description || '').toLowerCase();
      return (
        name.includes(q) ||
        rawName.includes(q) ||
        email.includes(q) ||
        role.includes(q)
      );
    });
  }, [members, query]);

  const toggleUser = (userId: string) => {
    if (multiple) {
      const next = activeSelectedIds.includes(userId)
        ? activeSelectedIds.filter((id) => id !== userId)
        : [...activeSelectedIds, userId];
      onChange?.(next);
      onSelectMember?.(next[0] ?? null);
      setQuery('');
    } else {
      const isCurrent = activeSelectedIds.includes(userId);
      const next = isCurrent ? [] : [userId];
      onChange?.(next);
      onSelectMember?.(isCurrent ? null : userId);
      setOpen(false);
      setQuery('');
    }
  };

  const removeUser = (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const next = activeSelectedIds.filter((id) => id !== userId);
    onChange?.(next);
    onSelectMember?.(next[0] ?? null);
  };

  const visibleChips = maxSelectedChips
    ? selectedMembers.slice(0, maxSelectedChips)
    : selectedMembers;
  const remainingCount = maxSelectedChips
    ? Math.max(0, selectedMembers.length - maxSelectedChips)
    : 0;

  const activePlaceholder = query ? '' : (searchPlaceholder || placeholder);

  // Render input-style trigger (Chips with avatar, label, remove X + inline search input)
  const inputTrigger = (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-expanded={open}
      onClick={() => {
        if (!disabled) {
          setOpen(true);
          inputRef.current?.focus();
        }
      }}
      className={cn(
        'min-h-[42px] w-full px-2.5 py-1.5 rounded-xl border border-border bg-surface-raised flex flex-wrap items-center gap-1.5 cursor-text transition-colors',
        'hover:border-border-strong focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/25',
        open && 'border-primary ring-1 ring-primary/25',
        disabled && 'opacity-50 cursor-not-allowed pointer-events-none bg-muted/40',
        className,
      )}
    >
      <div
        role="group"
        aria-label="Selected members"
        className="flex flex-wrap items-center gap-1.5"
      >
        {visibleChips.map((member) => {
          const displayName = member.displayName ?? member.name;
          return (
            <span
              key={member.id}
              className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full bg-surface border border-border/80 text-xs font-medium text-foreground shadow-2xs transition-all hover:bg-accent/40"
            >
              <UserAvatar
                name={displayName}
                seed={member.id}
                src={member.avatarUrl}
                size="xs"
                className="size-5 font-bold shrink-0"
              />
              <span className="truncate max-w-[140px] text-xs font-medium">
                {displayName}
              </span>
              {!disabled && (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Remove ${displayName}`}
                  onClick={(e) => removeUser(e, member.id)}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-full p-0.5 transition-colors cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          );
        })}

        {remainingCount > 0 && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-surface border border-border text-[11px] font-medium text-muted-foreground">
            +{remainingCount} more
          </span>
        )}
      </div>

      <input
        ref={inputRef}
        id={inputId}
        type="text"
        value={query}
        disabled={disabled}
        placeholder={activePlaceholder}
        onChange={(e) => {
          setQuery(e.target.value);
          if (!open) setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Backspace' && !query && selectedMembers.length > 0) {
            const last = selectedMembers[selectedMembers.length - 1];
            if (last) {
              toggleUser(last.id);
            }
          } else if (e.key === 'Escape') {
            setOpen(false);
          }
        }}
        className="flex-1 min-w-[120px] bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none border-none p-0 focus:ring-0"
      />
    </div>
  );

  // Render compact avatar trigger
  const avatarTrigger = (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (!disabled) setOpen((prev) => !prev);
      }}
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

  const activeTrigger = trigger ?? (effectiveVariant === 'input' ? inputTrigger : avatarTrigger);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>{activeTrigger}</PopoverPrimitive.Anchor>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
          className={cn(
            'z-50 w-72 sm:w-80 p-1.5 rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl space-y-0.5 select-none outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'duration-(--duration-fast) ease-standard',
            popoverClassName,
          )}
        >
          {/* Search Input Box when trigger is not an inline input */}
          {effectiveVariant !== 'input' && (
            <div className="relative flex items-center px-2.5 py-1.5 border-b border-border/60 mb-1">
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
          )}

          {/* Member Options List matching reference image */}
          <div className="max-h-64 overflow-y-auto space-y-0.5 py-0.5 scrollbar-subtle">
            {filteredMembers.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                No users found
              </div>
            ) : (
              filteredMembers.map((member) => {
                const isSelected = activeSelectedIds.includes(member.id);
                const displayName = member.displayName ?? member.name;
                const subtitle =
                  member.role ||
                  member.title ||
                  member.subtitle ||
                  member.description ||
                  member.email ||
                  null;

                return (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleUser(member.id)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-left cursor-pointer transition-colors duration-150 outline-none',
                      isSelected
                        ? 'bg-accent/40 text-foreground hover:bg-accent/70'
                        : 'text-foreground/90 hover:bg-accent/60',
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* User Avatar */}
                      <UserAvatar
                        name={displayName}
                        seed={member.id}
                        src={member.avatarUrl}
                        size="sm"
                        className="size-8 shrink-0 font-bold rounded-full"
                      />

                      {/* Name + Subtitle (Role/Title/Email) Stack */}
                      <div className="min-w-0 flex-1">
                        <span className="block text-xs truncate font-semibold text-foreground leading-tight">
                          {displayName}
                        </span>
                        {subtitle && (
                          <span className="block text-[11px] truncate text-muted-foreground mt-0.5 leading-tight font-normal">
                            {subtitle}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Clean Right-aligned checkmark when selected */}
                    {isSelected && (
                      <Check className="size-4 text-foreground shrink-0 stroke-[2.5] ml-2" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Invite new user footer */}
          {onInvite && (
            <>
              <div className="h-px bg-border my-1" />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onInvite();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs cursor-pointer text-foreground/85 hover:bg-accent/60 font-medium transition-colors"
              >
                <Send className="size-3.5 text-muted-foreground shrink-0" />
                <span>Invite and add...</span>
              </button>
            </>
          )}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

export const MultiUserSelector = UserSelector;
export const AssigneeSelector = UserSelector;
export const UserSearch = UserSelector;
