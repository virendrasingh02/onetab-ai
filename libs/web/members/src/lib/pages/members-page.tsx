import { useCurrentUser } from '@org/auth';
import { WorkspaceRole, hasWorkspaceRole } from '@org/types';
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
  Input,
  SkeletonList,
  UserAvatar,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import { useCurrentWorkspace } from '@org/web-workspace';
import { MoreHorizontal, Search, UserPlus, Users } from 'lucide-react';
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
  const { slug, workspace, workspaceId } = useCurrentWorkspace();
  const members = useMembers(workspaceId);
  const { updateRole, remove } = useMemberMutations(workspaceId);
  const currentUser = useCurrentUser();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const canManage = workspace
    ? hasWorkspaceRole(workspace.role, WorkspaceRole.ADMIN)
    : false;

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
    <div className="max-w-3xl p-6 mx-auto">
      <div className="mb-5 gap-3 flex flex-wrap items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Members</h2>
          <p className="text-sm text-muted-foreground">
            {members.data?.length ?? 0} people in {workspace?.name}
          </p>
        </div>
        {canManage ? (
          <Button
            onClick={() => navigate(`/w/${slug}/invitations`)}
            leadingIcon={<UserPlus />}
          >
            Invite people
          </Button>
        ) : null}
      </div>

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search members"
        leadingIcon={<Search />}
        aria-label="Search members"
        className="mb-4"
      />

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
              <li key={member.id} className="gap-3 px-4 py-3 flex items-center">
                <UserAvatar
                  name={member.user.displayName ?? member.user.name}
                  src={member.user.avatarUrl}
                  seed={member.user.id}
                  presence={
                    member.user.presence === 'ONLINE' ? 'online' : 'offline'
                  }
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {member.user.displayName ?? member.user.name}
                    {isSelf ? (
                      <span className="font-normal text-muted-foreground">
                        {' '}
                        (you)
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Joined {formatRelative(member.joinedAt)}
                  </p>
                </div>

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
  );
}
