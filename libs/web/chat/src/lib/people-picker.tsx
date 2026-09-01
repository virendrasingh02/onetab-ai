import type { WorkspaceMember } from '@org/types';
import {
  Badge,
  EmptyState,
  SearchInput,
  toPresenceStatus,
  UserAvatar,
} from '@org/ui';
import { cn } from '@org/utils';
import { Check, Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';

function peerKind(id: string): 'agent' | 'app' | 'person' {
  if (id.startsWith('agent-')) return 'agent';
  if (id.startsWith('app-')) return 'app';
  return 'person';
}

export interface PeoplePickerProps {
  members: WorkspaceMember[];
  /** Ids currently chosen. */
  selectedIds: string[];
  onToggle: (id: string) => void;
  /** Ids to hide entirely — people already in the group. */
  excludeIds?: string[];
  /**
   * The viewer's own id. When set, that row is pinned to the top and tagged
   * "You" — so a note-to-self conversation is easy to start.
   */
  currentUserId?: string;
  /** Shown when the roster (after exclusions) is empty. */
  emptyHint?: string;
  className?: string;
}

/**
 * A searchable multi-select roster of teammates, AI agents and apps.
 *
 * Shared by "New direct message" and a group's "Add people" dialog so the two
 * present an identical picker — same rows, same badges, same search.
 */
export function PeoplePicker({
  members,
  selectedIds,
  onToggle,
  excludeIds,
  currentUserId,
  emptyHint = 'Invite someone to this workspace to start a conversation.',
  className,
}: PeoplePickerProps) {
  const [query, setQuery] = useState('');
  const excluded = useMemo(() => new Set(excludeIds ?? []), [excludeIds]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);

  const roster = useMemo(() => {
    const list = members.filter((member) => !excluded.has(member.user.id));
    if (!currentUserId) return list;
    // Keep the viewer's own row at the top so "message yourself" is one click.
    return [...list].sort((a, b) => {
      if (a.user.id === currentUserId) return -1;
      if (b.user.id === currentUserId) return 1;
      return 0;
    });
  }, [members, excluded, currentUserId]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return roster;
    return roster.filter((member) => {
      const name = (member.user.displayName ?? member.user.name).toLowerCase();
      return (
        name.includes(needle) ||
        member.user.name.toLowerCase().includes(needle) ||
        (member.user.statusText ?? '').toLowerCase().includes(needle)
      );
    });
  }, [roster, query]);

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div className="p-3 border-b border-border">
        <SearchInput
          value={query}
          onValueChange={setQuery}
          placeholder="Search people, agents & apps"
          label="Search people, agents & apps"
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          size="sm"
          icon={roster.length === 0 ? <Users /> : <Search />}
          title={roster.length === 0 ? 'No one to add' : 'No matches'}
          description={
            roster.length === 0
              ? emptyHint
              : 'No person, agent, or app matches that search.'
          }
        />
      ) : (
        <ul className="min-h-0 p-2 space-y-px overflow-y-auto">
          {visible.map((member) => {
            const name = member.user.displayName ?? member.user.name;
            const kind = peerKind(member.user.id);
            const isSelected = selected.has(member.user.id);
            const isSelf = member.user.id === currentUserId;

            return (
              <li key={member.user.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={isSelected}
                  onClick={() => onToggle(member.user.id)}
                  className={cn(
                    'gap-2.5 p-2 flex w-full items-center rounded-md text-left transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none',
                    isSelected && 'bg-primary/10 hover:bg-primary/15',
                  )}
                >
                  <UserAvatar
                    name={name}
                    src={member.user.avatarUrl}
                    seed={member.user.id}
                    presence={toPresenceStatus(member.user.presence)}
                    className={cn(
                      kind === 'agent' && 'ring-2 ring-primary/40',
                      kind === 'app' && 'ring-2 ring-accent-violet/40',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-sm font-medium gap-1.5 flex items-center truncate">
                      <span className="truncate">{name}</span>
                      {isSelf ? (
                        <Badge
                          variant="neutral"
                          className="py-0 h-3.5 font-bold tracking-wider text-[9px] uppercase"
                        >
                          You
                        </Badge>
                      ) : null}
                      {kind === 'agent' ? (
                        <Badge
                          variant="primary"
                          className="py-0 h-3.5 font-bold tracking-wider text-[9px] uppercase"
                        >
                          AI Agent
                        </Badge>
                      ) : kind === 'app' ? (
                        <Badge
                          variant="neutral"
                          className="py-0 h-3.5 font-bold tracking-wider border-accent-violet/20 bg-accent-violet-soft text-[9px] text-accent-violet uppercase"
                        >
                          App
                        </Badge>
                      ) : null}
                    </span>
                    <span className="text-xs block truncate text-muted-foreground">
                      @{member.user.name}
                      {member.user.statusText
                        ? ` · ${member.user.statusText}`
                        : ''}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'size-4 shrink-0 rounded-[5px] border flex items-center justify-center transition-colors',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border',
                    )}
                  >
                    {isSelected ? <Check className="size-3" /> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
