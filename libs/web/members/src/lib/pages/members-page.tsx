import { useCurrentUser } from '@org/auth';
import { WorkspacePermission, WorkspaceRole } from '@org/types';
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  LocalTime,
  SearchInput,
  SkeletonList,
  UserAvatar,
  useRightPanelStore,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import {
  useCurrentWorkspace,
  useWorkspacePermission,
} from '@org/web-workspace';
import { MoreHorizontal, UserPlus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMemberMutations, useMembers } from '../use-members.js';

const ROLE_BADGE: Record<string, 'primary' | 'info' | 'neutral'> = {
  OWNER: 'primary',
  ADMIN: 'info',
  MEMBER: 'neutral',
  GUEST: 'neutral',
};

export function MembersPage() {
  const { slug, workspaceId } = useCurrentWorkspace();
  const members = useMembers(workspaceId);
  const { updateRole, remove } = useMemberMutations(workspaceId);
  const currentUser = useCurrentUser();
  const openProfilePanel = useRightPanelStore((s) => s.openProfile);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  // Asks for the capability rather than comparing role rungs, so this agrees
  // with what the API's guard will decide for the same request.
  const { can } = useWorkspacePermission();
  const canManage = can(WorkspacePermission.MANAGE_MEMBERS);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    const list = members.data ?? [];
    if (!term) return list;
    return list.filter((member) =>
      (member.user.displayName ?? member.user.name)
        .toLowerCase()
        .includes(term),
    );
  }, [members.data, query]);

  return (
    <div className="min-h-0 flex flex-1 flex-col">
      {/* Channel-style Header */}
      <div className="border-b border-border bg-background">
        <div className="gap-2.5 px-3 sm:px-6 py-2.5 flex flex-wrap items-center justify-between">
          <div className="min-w-0 gap-2 flex items-center">
            <div className="min-w-0 gap-1.5 flex items-center">
              <Users
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <h2 className="text-sm font-semibold tracking-tight truncate text-foreground">
                Members
              </h2>
              <Badge
                variant="neutral"
                className="px-1.5 py-0 h-4.5 text-[11px]"
              >
                {members.data?.length ?? 0} people
              </Badge>
            </div>
            {/*
            <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

            <p className="hidden min-w-0 max-w-[48ch] truncate text-xs text-muted-foreground sm:block">
              Everyone in {workspace?.name ?? 'this workspace'}
            </p> */}
          </div>

          <div className="gap-2 flex items-center">
            <SearchInput
              value={query}
              onValueChange={setQuery}
              placeholder="Search members…"
              className="h-7 text-xs"
              wrapperClassName="w-36 sm:w-48"
            />
            {canManage ? (
              <Button
                onClick={() => navigate(`/w/${slug}/invitations`)}
                size="sm"
                className="h-7 text-xs gap-1"
                leadingIcon={<UserPlus className="size-3.5" />}
              >
                Invite people
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="min-h-0 p-4 sm:p-6 flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          {members.isLoading ? (
            <SkeletonList rows={6} withAvatar />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Users />}
              title="No members match"
              description={`Nothing matched "${query}".`}
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {filtered.map((member) => {
                const isSelf = member.user.id === currentUser?.id;
                const isOwner = member.role === WorkspaceRole.OWNER;

                return (
                  <li
                    key={member.id}
                    className="gap-3 px-4 py-3 flex items-center justify-between"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        openProfilePanel({
                          userId: member.user.id,
                          name: member.user.displayName ?? member.user.name,
                          avatarUrl: member.user.avatarUrl ?? undefined,
                          // No email: `PublicUser` is the public projection and
                          // deliberately withholds it.
                          role: member.role,
                          timezone: member.user.timezone,
                          statusEmoji: member.user.statusEmoji,
                          statusText: member.user.statusText,
                          status:
                            member.user.presence === 'ONLINE'
                              ? 'online'
                              : 'offline',
                        })
                      }
                      className="gap-3 min-w-0 flex flex-1 cursor-pointer items-center text-left transition-opacity hover:opacity-80"
                    >
                      <UserAvatar
                        name={member.user.displayName ?? member.user.name}
                        src={member.user.avatarUrl}
                        seed={member.user.id}
                        presence={
                          member.user.presence === 'ONLINE'
                            ? 'online'
                            : 'offline'
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate hover:underline">
                          {member.user.displayName ?? member.user.name}
                          {isSelf ? (
                            <span className="font-normal text-muted-foreground">
                              {' '}
                              (you)
                            </span>
                          ) : null}
                        </p>
                        <p className="gap-1.5 text-xs flex items-center text-muted-foreground">
                          <span>Joined {formatRelative(member.joinedAt)}</span>
                          {/*
                        Their local time, ticking, from their own profile zone —
                        the thing you actually want to know before pinging someone
                        in a workspace spread across timezones.
                      */}
                          <span aria-hidden>·</span>
                          <LocalTime
                            timezone={member.user.timezone}
                            icon
                            withHint
                            hintName={
                              member.user.displayName ?? member.user.name
                            }
                          />
                        </p>
                      </div>
                    </button>

                    <Badge variant={ROLE_BADGE[member.role] ?? 'neutral'}>
                      {member.role.toLowerCase()}
                    </Badge>

                    {/* The owner is only reassignable through an explicit transfer. */}
                    {canManage && !isOwner && !isSelf ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Manage ${member.user.name}`}
                          >
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Change role</DropdownMenuLabel>
                          {[
                            WorkspaceRole.ADMIN,
                            WorkspaceRole.MEMBER,
                            WorkspaceRole.GUEST,
                          ].map((role) => (
                            <DropdownMenuItem
                              key={role}
                              disabled={member.role === role}
                              onClick={() =>
                                updateRole.mutate({
                                  userId: member.user.id,
                                  input: { role },
                                })
                              }
                            >
                              {role.toLowerCase()}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => remove.mutate(member.user.id)}
                          >
                            Remove from workspace
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
