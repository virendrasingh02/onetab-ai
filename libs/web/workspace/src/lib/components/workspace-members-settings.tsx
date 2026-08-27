import {
  invitationApi,
  memberApi,
  queryKeys,
} from '@org/api-client';
import { useCurrentUser } from '@org/auth';
import {
  WorkspaceRole,
  hasWorkspaceRole,
  type WorkspaceMember,
} from '@org/types';
import {
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  EmptyState,
  LocalTime,
  SearchInput,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SkeletonList,
  UserAvatar,
} from '@org/ui';
import { formatRelative } from '@org/utils';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Crown,
  Link as LinkIcon,
  Mail,
  MoreHorizontal,
  Plus,
  Shield,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTransferOwnership } from '../use-workspaces.js';
import { UpgradePlanBanner } from './upgrade-plan-banner.js';

export interface WorkspaceMembersSettingsProps {
  workspaceId: string | undefined;
  workspaceSlug?: string;
  workspaceName?: string;
  workspaceRole?: WorkspaceRole;
  onNavigateToTab?: (tab: string) => void;
}

const ROLE_BADGES: Record<
  string,
  { variant: 'primary' | 'info' | 'neutral' | 'warning'; label: string }
> = {
  OWNER: { variant: 'primary', label: 'Owner' },
  ADMIN: { variant: 'info', label: 'Admin' },
  MEMBER: { variant: 'neutral', label: 'Member' },
  GUEST: { variant: 'warning', label: 'Guest' },
};

function parseEmails(raw: string): string[] {
  return raw
    .split(/[\s,;]+/)
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

export function WorkspaceMembersSettings({
  workspaceId,
  workspaceSlug,
  workspaceName = 'Workspace',
  workspaceRole,
  onNavigateToTab,
}: WorkspaceMembersSettingsProps) {
  const currentUser = useCurrentUser();
  const queryClient = useQueryClient();

  // Queries
  const membersQuery = useQuery({
    queryKey: queryKeys.members.list(workspaceId ?? ''),
    queryFn: () => memberApi.list(workspaceId as string),
    enabled: !!workspaceId,
  });

  const invitationsQuery = useQuery({
    queryKey: queryKeys.invitations.list(workspaceId ?? ''),
    queryFn: () => invitationApi.list(workspaceId as string),
    enabled: !!workspaceId,
  });

  // Mutations
  const updateRoleMutation = useMutation({
    mutationFn: ({
      userId,
      role,
    }: {
      userId: string;
      role: 'ADMIN' | 'MEMBER' | 'GUEST';
    }) =>
      memberApi.updateRole(workspaceId as string, userId, { role }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.members.all(workspaceId ?? ''),
      });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId: string) =>
      memberApi.remove(workspaceId as string, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.members.all(workspaceId ?? ''),
      });
      setMemberToRemove(null);
    },
  });

  const navigate = useNavigate();

  const revokeInvitationMutation = useMutation({
    mutationFn: (invitationId: string) =>
      invitationApi.revoke(workspaceId as string, invitationId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.invitations.all(workspaceId ?? ''),
      });
    },
  });

  const transferOwnershipMutation = useTransferOwnership(workspaceId);

  // States
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [activeSubTab, setActiveSubTab] = useState<'members' | 'invitations'>(
    'members',
  );
  const [copiedLink, setCopiedLink] = useState(false);
  const [inviteSuccessMessage, setInviteSuccessMessage] = useState<
    string | null
  >(null);

  // Dialog States
  const [memberToRemove, setMemberToRemove] = useState<WorkspaceMember | null>(
    null,
  );
  const [memberToTransfer, setMemberToTransfer] =
    useState<WorkspaceMember | null>(null);

  const isOwner = workspaceRole === WorkspaceRole.OWNER;
  const isAdmin =
    workspaceRole && hasWorkspaceRole(workspaceRole, WorkspaceRole.ADMIN);

  const membersList = membersQuery.data ?? [];
  const invitationsList = invitationsQuery.data ?? [];

  // Member stats
  const totalCount = membersList.length;
  const activeCount = membersList.filter(
    (m) => m.user.presence === 'ONLINE',
  ).length;
  const adminCount = membersList.filter(
    (m) => m.role === WorkspaceRole.ADMIN || m.role === WorkspaceRole.OWNER,
  ).length;
  const maxFreeSeats = 5;

  // Filtered members
  const filteredMembers = useMemo(() => {
    return membersList.filter((member) => {
      const name = (member.user.displayName ?? member.user.name).toLowerCase();
      const username = member.user.name.toLowerCase();
      const query = searchQuery.trim().toLowerCase();

      const matchesSearch = !query || name.includes(query) || username.includes(query);
      const matchesRole =
        roleFilter === 'ALL' ||
        member.role.toUpperCase() === roleFilter.toUpperCase();

      return matchesSearch && matchesRole;
    });
  }, [membersList, searchQuery, roleFilter]);

  const handleCopyInviteLink = async () => {
    try {
      const res = await invitationApi.createLink(workspaceId as string, {
        role: WorkspaceRole.MEMBER,
        expiresInDays: 30,
      });
      const url = `${window.location.origin}${res.url.startsWith('/') ? '' : '/'}${res.url}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setInviteSuccessMessage('Shareable invitation link copied to clipboard!');
      setTimeout(() => {
        setCopiedLink(false);
        setInviteSuccessMessage(null);
      }, 3000);
    } catch {
      // Fallback
      const url = `${window.location.origin}/w/${workspaceSlug}`;
      navigator.clipboard.writeText(url);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <span>Members & Team Directory</span>
            <Badge variant="neutral" className="text-xs px-2 font-semibold">
              {totalCount} {totalCount === 1 ? 'member' : 'members'}
            </Badge>
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage who has access to {workspaceName}, assign administrative roles,
            and send invitations.
          </p>
        </div>

        {isAdmin ? (
          <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyInviteLink}
              className="text-xs font-medium"
            >
              {copiedLink ? (
                <>
                  <Check className="size-3.5 mr-1 text-success-text" />
                  <span>Link Copied!</span>
                </>
              ) : (
                <>
                  <LinkIcon className="size-3.5 mr-1" />
                  <span>Copy Invite Link</span>
                </>
              )}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate(`/w/${workspaceSlug}/invitations`)}
              className="text-xs font-semibold shadow-xs"
            >
              <UserPlus className="size-3.5 mr-1.5" />
              <span>Invite Members</span>
            </Button>
          </div>
        ) : null}
      </div>

      {/* Upgrade Plan Hero Banner */}
      <UpgradePlanBanner
        totalMembers={totalCount}
        maxSeats={maxFreeSeats}
        currentPlan="starter"
        onUpgradeClick={() => {
          if (onNavigateToTab) {
            onNavigateToTab('billing');
          }
        }}
      />

      {/* Overview Metric Cards Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="rounded-xl border border-border bg-surface p-3.5 space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <Users className="size-3.5 text-primary" />
            Total Members
          </span>
          <p className="text-xl font-bold text-foreground">{totalCount}</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-3.5 space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-success animate-pulse" />
            Active Online
          </span>
          <p className="text-xl font-bold text-foreground">{activeCount}</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-3.5 space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <Shield className="size-3.5 text-accent-indigo" />
            Admins & Owners
          </span>
          <p className="text-xl font-bold text-foreground">{adminCount}</p>
        </div>

        <div className="rounded-xl border border-border bg-surface p-3.5 space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
            <Mail className="size-3.5 text-accent-amber" />
            Pending Invites
          </span>
          <p className="text-xl font-bold text-foreground">
            {invitationsList.length}
          </p>
        </div>
      </div>

      {/* Section Sub-tabs */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveSubTab('members')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              activeSubTab === 'members'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
            }`}
          >
            Active Directory ({totalCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubTab('invitations')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              activeSubTab === 'invitations'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-accent/40'
            }`}
          >
            <span>Pending Invitations</span>
            {invitationsList.length > 0 ? (
              <Badge variant="info" className="text-[10px] px-1.5 py-0">
                {invitationsList.length}
              </Badge>
            ) : null}
          </button>
        </div>

        {activeSubTab === 'members' ? (
          <div className="flex items-center gap-2">
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-8 text-xs w-[130px] bg-surface">
                <SelectValue placeholder="All Roles" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Roles</SelectItem>
                <SelectItem value="OWNER">Owners</SelectItem>
                <SelectItem value="ADMIN">Admins</SelectItem>
                <SelectItem value="MEMBER">Members</SelectItem>
                <SelectItem value="GUEST">Guests</SelectItem>
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {/* Feedback Toast Banner */}
      {inviteSuccessMessage ? (
        <div className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 p-3 text-xs text-success-text">
          <CheckCircle2 className="size-4 shrink-0 text-success-text" />
          <span>{inviteSuccessMessage}</span>
        </div>
      ) : null}

      {/* Tab: Members Directory */}
      {activeSubTab === 'members' && (
        <div className="space-y-4">
          <SearchInput
            value={searchQuery}
            onValueChange={setSearchQuery}
            placeholder="Search members by name or username…"
            label="Search members"
            className="h-9 bg-surface"
          />

          {membersQuery.isLoading ? (
            <SkeletonList rows={5} withAvatar />
          ) : filteredMembers.length === 0 ? (
            <EmptyState
              icon={<Users className="size-8" />}
              title="No members found"
              description={
                searchQuery
                  ? `No members match "${searchQuery}".`
                  : 'No members match the selected filter.'
              }
            />
          ) : (
            <div className="rounded-xl border border-border bg-surface divide-y divide-border/60 overflow-hidden shadow-2xs">
              {filteredMembers.map((member) => {
                const isSelf = member.user.id === currentUser?.id;
                const isMemberOwner = member.role === WorkspaceRole.OWNER;
                const badgeConfig =
                  ROLE_BADGES[member.role] ?? ROLE_BADGES.MEMBER;

                return (
                  <div
                    key={member.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-accent/25 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <UserAvatar
                        name={member.user.displayName ?? member.user.name}
                        src={member.user.avatarUrl}
                        seed={member.user.id}
                        presence={
                          member.user.presence === 'ONLINE'
                            ? 'online'
                            : 'offline'
                        }
                        className="size-9"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-foreground truncate">
                            {member.user.displayName ?? member.user.name}
                          </span>
                          {isSelf ? (
                            <Badge
                              variant="neutral"
                              className="text-[10px] px-1.5 py-0 font-medium"
                            >
                              You
                            </Badge>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground mt-0.5">
                          <span>@{member.user.name}</span>
                          <span>·</span>
                          <span>Joined {formatRelative(member.joinedAt)}</span>
                          <span>·</span>
                          <LocalTime
                            timezone={member.user.timezone}
                            icon
                            withHint
                            hintName={
                              member.user.displayName ?? member.user.name
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                      <Badge
                        variant={badgeConfig.variant}
                        className="text-[11px] font-semibold px-2 py-0.5 capitalize"
                      >
                        {isMemberOwner ? (
                          <span className="flex items-center gap-1">
                            <Crown className="size-3 text-accent-amber" />
                            Owner
                          </span>
                        ) : (
                          badgeConfig.label
                        )}
                      </Badge>

                      {/* Management Dropdown Menu */}
                      {isAdmin && !isMemberOwner && !isSelf ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Manage ${member.user.name}`}
                              className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
                            >
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48 text-xs">
                            <DropdownMenuLabel>Change Role</DropdownMenuLabel>
                            {[
                              WorkspaceRole.ADMIN,
                              WorkspaceRole.MEMBER,
                              WorkspaceRole.GUEST,
                            ].map((role) => (
                              <DropdownMenuItem
                                key={role}
                                disabled={member.role === role}
                                onClick={() =>
                                  updateRoleMutation.mutate({
                                    userId: member.user.id,
                                    role: role as 'ADMIN' | 'MEMBER' | 'GUEST',
                                  })
                                }
                              >
                                {role === WorkspaceRole.ADMIN && (
                                  <Shield className="size-3.5 mr-2 text-info" />
                                )}
                                {role === WorkspaceRole.MEMBER && (
                                  <Users className="size-3.5 mr-2" />
                                )}
                                {role === WorkspaceRole.GUEST && (
                                  <Clock className="size-3.5 mr-2" />
                                )}
                                <span>Make {role.toLowerCase()}</span>
                              </DropdownMenuItem>
                            ))}

                            {isOwner ? (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setMemberToTransfer(member)}
                                  className="text-accent-amber"
                                >
                                  <Crown className="size-3.5 mr-2 text-accent-amber" />
                                  <span>Transfer Ownership</span>
                                </DropdownMenuItem>
                              </>
                            ) : null}

                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setMemberToRemove(member)}
                            >
                              <UserMinus className="size-3.5 mr-2" />
                              <span>Remove from workspace</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Pending Invitations */}
      {activeSubTab === 'invitations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Invitations that have been sent and are awaiting acceptance.
            </p>
            {isAdmin ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate(`/w/${workspaceSlug}/invitations`)}
                className="text-xs font-semibold"
              >
                <Plus className="size-3.5 mr-1" />
                Invite People
              </Button>
            ) : null}
          </div>

          {invitationsQuery.isLoading ? (
            <SkeletonList rows={3} withAvatar={false} />
          ) : invitationsList.length === 0 ? (
            <EmptyState
              icon={<Mail className="size-8" />}
              title="No pending invitations"
              description="Invite team members to collaborate in this workspace."
            />
          ) : (
            <div className="rounded-xl border border-border bg-surface divide-y divide-border/60 overflow-hidden shadow-2xs">
              {invitationsList.map((invitation) => (
                <div
                  key={invitation.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-accent/25 transition-colors"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="size-9 rounded-full bg-accent flex items-center justify-center text-muted-foreground shrink-0">
                      <Mail className="size-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-xs text-foreground truncate">
                          {invitation.email}
                        </span>
                        <Badge
                          variant="neutral"
                          className="text-[10px] px-1.5 py-0 font-medium capitalize"
                        >
                          {invitation.role.toLowerCase()}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Sent {formatRelative(invitation.createdAt)}
                      </p>
                    </div>
                  </div>

                  {isAdmin ? (
                    <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const link = invitation.token
                            ? `${window.location.origin}/invite/${invitation.token}`
                            : `${window.location.origin}/w/${workspaceSlug}/invitations`;
                          navigator.clipboard.writeText(link);
                          setInviteSuccessMessage(
                            `Copied link for ${invitation.email}`,
                          );
                          setTimeout(() => setInviteSuccessMessage(null), 3000);
                        }}
                        className="text-xs h-7.5 px-2.5"
                      >
                        <Copy className="size-3 mr-1" />
                        Copy Link
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          revokeInvitationMutation.mutate(invitation.id)
                        }
                        className="text-xs h-7.5 text-destructive hover:bg-destructive/10 px-2.5"
                      >
                        <Trash2 className="size-3.5 mr-1" />
                        Revoke
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Remove Member Confirmation Dialog */}
      <Dialog
        open={memberToRemove !== null}
        onOpenChange={(open) => {
          if (!open) setMemberToRemove(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <UserMinus className="size-5" />
              Remove Member from Workspace
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to remove{' '}
              <strong>
                {memberToRemove?.user.displayName ?? memberToRemove?.user.name}
              </strong>{' '}
              from {workspaceName}? They will lose access to all channels, documents,
              and workspace data immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                if (memberToRemove) {
                  removeMemberMutation.mutate(memberToRemove.user.id);
                }
              }}
              disabled={removeMemberMutation.isPending}
            >
              {removeMemberMutation.isPending ? 'Removing...' : 'Remove Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Ownership Dialog */}
      <Dialog
        open={memberToTransfer !== null}
        onOpenChange={(open) => {
          if (!open) setMemberToTransfer(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-accent-amber">
              <Crown className="size-5" />
              Transfer Workspace Ownership
            </DialogTitle>
            <DialogDescription>
              You are transferring full ownership of {workspaceName} to{' '}
              <strong>
                {memberToTransfer?.user.displayName ?? memberToTransfer?.user.name}
              </strong>
              . You will remain an Admin in the workspace.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (memberToTransfer) {
                  transferOwnershipMutation.mutate(memberToTransfer.user.id, {
                    onSuccess: () => setMemberToTransfer(null),
                  });
                }
              }}
              disabled={transferOwnershipMutation.isPending}
            >
              {transferOwnershipMutation.isPending
                ? 'Transferring...'
                : 'Confirm Transfer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
