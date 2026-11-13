import { cn } from '@org/utils';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Check, Search, Send, UserX, X } from 'lucide-react';
import React, { useId, useMemo, useRef, useState } from 'react';
import { UserAvatarGroup } from './avatar-group.js';
import { UserAvatar } from './avatar.js';
import { SkeletonAvatar, SkeletonText } from './skeleton.js';

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
  /** Show skeleton rows while member data is loading. */
  isLoading?: boolean;
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
  isLoading = false,
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
      const role = (
        m.role ||
        m.title ||
        m.subtitle ||
        m.description ||
        ''
      ).toLowerCase();
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

  const activePlaceholder = query ? '' : searchPlaceholder || placeholder;

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
        'px-2.5 py-1.5 gap-1.5 flex min-h-[42px] w-full cursor-text flex-wrap items-center rounded-xl border border-border bg-surface-raised transition-colors',
        'focus-within:border-ring focus-within:ring-1 focus-within:ring-ring/25 hover:border-field-border',
        open && 'border-brand ring-1 ring-brand/25',
        disabled &&
          'pointer-events-none cursor-not-allowed bg-muted/40 opacity-50',
        className,
      )}
    >
      <div
        role="group"
        aria-label="Selected members"
        className="gap-1.5 flex flex-wrap items-center"
      >
        {visibleChips.map((member) => {
          const displayName = member.displayName ?? member.name;
          return (
            <span
              key={member.id}
              className="gap-1.5 pl-1 pr-2 py-0.5 text-xs font-medium shadow-2xs inline-flex items-center rounded-full border border-border/80 bg-surface text-foreground transition-all hover:bg-accent/40"
            >
              <UserAvatar
                name={displayName}
                seed={member.id}
                src={member.avatarUrl}
                size="xs"
                className="size-5 font-bold shrink-0"
              />
              <span className="text-xs font-medium max-w-[140px] truncate">
                {displayName}
              </span>
              {!disabled && (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={`Remove ${displayName}`}
                  onClick={(e) => removeUser(e, member.id)}
                  className="p-0.5 cursor-pointer rounded-full text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          );
        })}

        {remainingCount > 0 && (
          <span className="px-2 py-0.5 font-medium inline-flex items-center rounded-full border border-border bg-surface text-meta text-muted-foreground">
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
        className="text-xs p-0 min-w-[120px] flex-1 border-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground focus:ring-0"
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
        'gap-1.5 p-0.5 inline-flex cursor-pointer items-center rounded-full transition-all outline-none select-none',
        'hover:ring-2 hover:ring-brand/40 focus-visible:ring-2 focus-visible:ring-ring',
        disabled && 'pointer-events-none cursor-not-allowed opacity-50',
        className,
      )}
      aria-label={label}
    >
      {selectedMembers.length > 0 ? (
        <UserAvatarGroup users={selectedMembers} size="xs" />
      ) : (
        <div className="size-5 flex items-center justify-center rounded-full border border-dashed border-muted-foreground/50 bg-muted/20 transition-colors hover:bg-muted/40">
          <UserX className="size-3 text-muted-foreground" />
        </div>
      )}
    </button>
  );

  const activeTrigger =
    trigger ?? (effectiveVariant === 'input' ? inputTrigger : avatarTrigger);

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
            'w-72 sm:w-80 p-1.5 shadow-2xl space-y-0.5 z-50 rounded-2xl border border-border bg-popover text-popover-foreground outline-none select-none',
            popoverClassName,
          )}
        >
          {/* Search Input Box when trigger is not an inline input */}
          {effectiveVariant !== 'input' && (
            <div className="px-2.5 py-1.5 mb-1 relative flex items-center border-b border-border/60">
              <Search className="size-3.5 mr-2 shrink-0 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="text-xs p-0 w-full border-none bg-transparent text-foreground outline-none placeholder:text-muted-foreground focus:ring-0"
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
          <div className="max-h-64 space-y-0.5 py-0.5 scrollbar-subtle overflow-y-auto">
            {isLoading ? (
              <div role="status" aria-busy="true" className="space-y-1 p-1">
                <span className="sr-only">Loading members…</span>
                {Array.from({ length: 4 }, (_, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 flex w-full items-center justify-between rounded-xl"
                  >
                    <div className="gap-2.5 min-w-0 flex flex-1 items-center">
                      <SkeletonAvatar size="sm" shape="circle" />
                      <div className="min-w-0 space-y-1 flex-1">
                        <SkeletonText size="xs" className="w-28" />
                        <SkeletonText size="xs" className="w-20 opacity-70" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredMembers.length === 0 ? (
              <div className="px-3 py-4 text-xs text-center text-muted-foreground">
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
                      'px-3 py-2 text-xs flex w-full cursor-pointer items-center justify-between rounded-xl text-left transition-colors duration-150 outline-none',
                      isSelected
                        ? 'bg-accent/40 text-foreground hover:bg-accent/70'
                        : 'text-foreground/90 hover:bg-accent/60',
                    )}
                  >
                    <div className="gap-3 min-w-0 flex flex-1 items-center">
                      {/* User Avatar */}
                      <UserAvatar
                        name={displayName}
                        seed={member.id}
                        src={member.avatarUrl}
                        size="sm"
                        className="size-8 font-bold shrink-0 rounded-full"
                      />

                      {/* Name + Subtitle (Role/Title/Email) Stack */}
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-semibold leading-tight block truncate text-foreground">
                          {displayName}
                        </span>
                        {subtitle && (
                          <span className="mt-0.5 leading-tight font-normal block truncate text-meta text-muted-foreground">
                            {subtitle}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Clean Right-aligned checkmark when selected */}
                    {isSelected && (
                      <Check className="size-4 ml-2 shrink-0 stroke-[2.5] text-foreground" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Invite new user footer */}
          {onInvite && (
            <>
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  onInvite();
                }}
                className="gap-2 px-3 py-2 text-xs font-medium flex w-full cursor-pointer items-center rounded-xl text-foreground/85 transition-colors hover:bg-accent/60"
              >
                <Send className="size-3.5 shrink-0 text-muted-foreground" />
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
